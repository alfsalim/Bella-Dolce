import "dotenv/config";
import config from './app.config';
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import fs from "fs/promises";
import {
  createWriteStream,
  existsSync,
  readFileSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
} from "fs";
import https from "https";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || "bella-dolce-secret-change-in-production";
const SALT_ROUNDS = 10;

const BACKUP_DIR = path.join(process.cwd(), "backups");
const BACKUP_RETENTION_DAYS = 3;

function sanitizeUser(user: any) {
  const { password, ...safe } = user;
  return safe;
}

let prismaInstance: PrismaClient | null = null;

function getPrisma() {
  if (!prismaInstance) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is missing. Please configure it in the Secrets panel.");
    }
    prismaInstance = new PrismaClient();
  }
  return prismaInstance;
}

const getModel = (collectionName: string) => {
  const prisma = getPrisma();
  const mapping: Record<string, any> = {
    'users': prisma.user,
    'products': prisma.product,
    'rawMaterials': prisma.rawMaterial,
    'recipes': prisma.recipe,
    'batches': prisma.productionBatch,
    'sales': prisma.sale,
    'suppliers': prisma.supplier,
    'customers': prisma.customer,
    'orders': prisma.order,
    'deliveries': prisma.delivery,
    'activityLogs': prisma.activityLog,
    'rolePermissions': prisma.rolePermission,
    'accounts': prisma.account,
    'journalEntries': prisma.journalEntry,
    'journalLines': prisma.journalLine,
    'payrollRuns': prisma.payrollRun,
    'payslips': prisma.payslip,
    'supplierInvoices': prisma.supplierInvoice,
    'purchases': prisma.supplierInvoice,
    'customerInvoices': prisma.customerInvoice,
    'fixedAssets': prisma.fixedAsset,
    'cashReconciliations': prisma.dailyCashReconciliation,
    'riskSnapshots': prisma.riskSnapshot,
    'budgets': prisma.budget,
    'system': prisma.system,
    'financialEmployees': prisma.financialEmployee,
    'stockMovements': prisma.stockMovement,
    'promotions': prisma.promotion,
    'settings': prisma.setting
  };
  const model = mapping[collectionName];
  if (!model && collectionName !== 'health') {
    console.warn(`Collection model not found for: ${collectionName}. Available: ${Object.keys(mapping).join(', ')}`);
  }
  return model;
};

const wrapDataIfNeeded = (collection: string, body: any) => {
  if (collection === 'settings') {
    const { id, ...data } = body;
    return {
      id: id,
      data: JSON.stringify(data)
    };
  }
  return body;
};

const unwrapDataIfNeeded = (collection: string, item: any) => {
  if (collection === 'settings' && item && item.data) {
    try {
      const parsed = JSON.parse(item.data);
      return { id: item.id, ...parsed };
    } catch (e) {
      return item;
    }
  }
  return item;
};

/** Prisma DateTime filters reject bare YYYY-MM-DD; normalize at any depth (Express query shapes vary). */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function deepNormalizePrismaWhere(where: unknown): unknown {
  if (where == null) return where;
  if (typeof where === 'string') {
    const s = where.trim();
    return DATE_ONLY.test(s) ? `${s}T00:00:00.000Z` : where;
  }
  if (Array.isArray(where)) {
    return where.map((x) => deepNormalizePrismaWhere(x));
  }
  if (typeof where !== 'object') return where;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(where as Record<string, unknown>)) {
    out[k] = deepNormalizePrismaWhere(v);
  }
  return out;
}

function parseWhereQuery(raw: unknown): unknown | undefined {
  if (raw == null || raw === '') return undefined;
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (typeof first === 'string') return JSON.parse(first);
  if (typeof first === 'object') return first;
  return JSON.parse(String(first));
}

// Role-based collection access control
/**
 * Maps each DB collection to the app route that grants access to it.
 * Access is controlled entirely by the rolePermissions table in the DB —
 * no role names are hardcoded here. Admin always bypasses this check.
 */
const COLLECTION_ROUTE_MAP: Record<string, string> = {
  // Admin-only (no regular-user route)
  users:               '/settings',
  rolePermissions:     '/settings',
  system:              '/settings',
  // Dashboard
  activityLogs:        '/dashboard',
  // Finance
  accounts:            '/finance',
  journalEntries:      '/finance',
  journalLines:        '/finance',
  payrollRuns:         '/finance',
  payslips:            '/finance',
  cashReconciliations: '/finance',
  budgets:             '/finance',
  riskSnapshots:       '/finance',
  supplierInvoices:    '/finance',
  customerInvoices:    '/finance',
  fixedAssets:         '/finance',
  financialEmployees:  '/finance',
  // Procurement
  suppliers:           '/procurement',
  purchases:           '/procurement',
  // Orders / Deliveries
  deliveries:          '/orders',
  orders:              '/orders',
  // Settings / Promotions
  promotions:          '/settings',
  settings:            '/settings',
  // Product management
  products:            '/product-management',
  // Inventory
  rawMaterials:        '/inventory',
  stockMovements:      '/inventory',
  // Production
  recipes:             '/production',
  batches:             '/production',
  // POS / Customers
  sales:               '/pos',
  customers:           '/customers',
};

// Collections that are always admin-only regardless of rolePermissions
const ADMIN_ONLY_COLLECTIONS = new Set(['users', 'rolePermissions', 'system']);

// In-memory cache for role → allowedPaths (avoids a DB hit on every API call)
const _permCache = new Map<string, { paths: string[]; at: number }>();
const PERM_CACHE_TTL = 60_000; // 1 minute

async function getCachedAllowedPaths(role: string): Promise<string[]> {
  if (role === 'admin') return ['*'];
  const hit = _permCache.get(role);
  if (hit && Date.now() - hit.at < PERM_CACHE_TTL) return hit.paths;
  const paths = await resolveAllowedPaths(role);
  _permCache.set(role, { paths, at: Date.now() });
  return paths;
}

/** Call this whenever an admin saves role permissions so the cache refreshes immediately. */
function invalidatePermissionsCache(role?: string) {
  if (role) _permCache.delete(role);
  else _permCache.clear();
}

async function getBackupConfig(): Promise<{ enabled: boolean; time: string }> {
  try {
    const prisma = getPrisma();
    const setting = await prisma.setting.findUnique({ where: { id: "backup_config" } });
    if (!setting?.data) return { enabled: true, time: "23:59" };
    return JSON.parse(setting.data);
  } catch {
    return { enabled: true, time: "23:59" };
  }
}

function cleanOldBackups() {
  if (!existsSync(BACKUP_DIR)) return;
  const cutoff = Date.now() - BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  for (const file of readdirSync(BACKUP_DIR)) {
    if (!file.endsWith(".db.bak")) continue;
    const fp = path.join(BACKUP_DIR, file);
    try {
      if (statSync(fp).mtimeMs < cutoff) unlinkSync(fp);
    } catch {
      /* ignore */
    }
  }
}

async function performBackup() {
  if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true });
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const filename = `${dateStr}_${hh}-${mm}_dev.db.bak`;
  const destPath = path.resolve(BACKUP_DIR, filename);
  const prisma = getPrisma();
  const sqlPath = destPath.replace(/\\/g, "/").replace(/'/g, "''");
  await prisma.$executeRawUnsafe(`VACUUM INTO '${sqlPath}'`);
  cleanOldBackups();
  return { filename, size: statSync(destPath).size };
}

function listBackups() {
  if (!existsSync(BACKUP_DIR)) return [];
  return readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith(".db.bak"))
    .map((f) => {
      const fp = path.join(BACKUP_DIR, f);
      const st = statSync(fp);
      return { filename: f, size: st.size, createdAt: st.mtime.toISOString() };
    })
    .sort((a, b) => b.filename.localeCompare(a.filename));
}

function parseAllowedPathsRaw(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === 'string');
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Load allowedPaths for a role from SQLite (SQLite-safe, no insensitive mode). */
async function resolveAllowedPaths(role: string): Promise<string[]> {
  if (role === 'admin') return ['*'];
  try {
    const prisma = getPrisma();
    // Try exact match first, then lowercase
    const row = await prisma.rolePermission.findUnique({ where: { id: role } })
      ?? await prisma.rolePermission.findUnique({ where: { id: role.toLowerCase() } });
    if (!row) return [];
    return parseAllowedPathsRaw(row.allowedPaths);
  } catch {
    return [];
  }
}

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || String(config.PORT), 10);
  const PUBLIC_GET_COLLECTIONS = ['products', 'promotions', 'settings'];
  const PUBLIC_POST_COLLECTIONS = ['orders', 'customers', 'activityLogs'];
  const PUBLIC_PUT_COLLECTIONS = ['products'];

  app.use(express.json());

  // Auth middleware
  function requireAuth(req: any, res: any, next: any) {
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.slice(7);
    try {
      req.user = jwt.verify(token, JWT_SECRET);
      next();
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  function requireCollectionAccess(req: any, res: any, next: any) {
    const { collection } = req.params;
    const method = req.method;

    // Public collections bypass all role checks
    if (method === 'GET' && PUBLIC_GET_COLLECTIONS.includes(collection)) return next();
    if (method === 'POST' && PUBLIC_POST_COLLECTIONS.includes(collection)) return next();
    if (method === 'PUT' && PUBLIC_PUT_COLLECTIONS.includes(collection)) return next();

    const userRole: string = (req.user?.role ?? '').trim();

    // Admin bypasses everything
    if (userRole === 'admin') return next();

    // backup_config is admin-only even within settings
    if (collection === 'settings' && req.params.id === 'backup_config') {
      return res.status(403).json({ error: 'Forbidden: admin only' });
    }

    // Any authenticated user can read their own rolePermissions row
    if (
      method === 'GET' &&
      collection === 'rolePermissions' &&
      req.params.id &&
      String(req.params.id).trim().toLowerCase() === userRole.toLowerCase()
    ) {
      return next();
    }

    // Admin-only collections — no regular user access
    if (ADMIN_ONLY_COLLECTIONS.has(collection)) {
      return res.status(403).json({ error: 'Forbidden: admin only' });
    }

    // For all other collections, check against the DB rolePermissions asynchronously
    const routeRequired = COLLECTION_ROUTE_MAP[collection];
    if (!routeRequired) return next(); // Unknown collection — allow (safe default for new collections)

    getCachedAllowedPaths(userRole).then((allowedPaths) => {
      if (allowedPaths.includes('*') || allowedPaths.includes(routeRequired)) {
        return next();
      }
      return res.status(403).json({ error: 'Forbidden: insufficient role' });
    }).catch(() => res.status(403).json({ error: 'Forbidden: could not verify permissions' }));
  }

  /** Load allowed paths for the JWT role only — avoids /api/db/rolePermissions GET (admin-only list guard). */
  app.get('/api/auth/role-permissions', requireAuth, async (req: any, res: express.Response) => {
    try {
      const roleRaw = req.user?.role;
      const role = typeof roleRaw === 'string' ? roleRaw.trim() : '';
      if (!role) {
        return res.status(400).json({ error: 'Invalid token: missing role' });
      }
      if (role === 'admin') {
        return res.json({ id: role, allowedPaths: ['*'] });
      }
      const prisma = getPrisma();
      let row = await prisma.rolePermission.findUnique({ where: { id: role } });
      if (!row) {
        row = await prisma.rolePermission.findUnique({ where: { id: role.toLowerCase() } });
      }
      if (!row) {
        const rows = await prisma.rolePermission.findMany({ select: { id: true, allowedPaths: true } });
        const hit = rows.find((r) => r.id.toLowerCase() === role.toLowerCase());
        row = hit
          ? await prisma.rolePermission.findUnique({ where: { id: hit.id } })
          : null;
      }
      if (!row) {
        return res.json({ id: role, allowedPaths: [] });
      }
      let allowedPaths: unknown = row.allowedPaths;
      if (typeof allowedPaths === 'string') {
        try {
          allowedPaths = JSON.parse(allowedPaths);
        } catch {
          allowedPaths = [];
        }
      }
      const paths = Array.isArray(allowedPaths)
        ? allowedPaths.filter((x): x is string => typeof x === 'string')
        : [];
      return res.json({ id: row.id, allowedPaths: paths });
    } catch (error: any) {
      console.error('role-permissions error:', error);
      return res.status(500).json({ error: error?.message || 'Failed to load permissions' });
    }
  });

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    console.log(`Login attempt for username: ${username}`);
    try {
      const prisma = getPrisma();
      const normalizedUsername = username.toLowerCase();

      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { username: normalizedUsername },
            { email: normalizedUsername },
            { username: username },
            { email: username }
          ]
        }
      });

      if (!user) {
        console.log(`User not found: ${username}`);
        return res.status(401).json({ error: "Invalid username or password" });
      }

      const passwordMatch = await bcrypt.compare(password, user.password || '');
      if (!passwordMatch) {
        console.log(`Invalid password for user: ${username}`);
        return res.status(401).json({ error: "Invalid username or password" });
      }

      console.log(`Login successful for user: ${username}`);
      const roleForJwt = user.role != null && String(user.role).trim() !== '' ? String(user.role).trim() : 'customer_customers';
      const token = jwt.sign(
        { id: user.id, username: user.username, role: roleForJwt },
        JWT_SECRET,
        { expiresIn: '8h' }
      );

      // Embed allowedPaths so the client needs zero extra requests after login.
      const allowedPaths = await resolveAllowedPaths(roleForJwt);
      res.json({ user: sanitizeUser(user), token, allowedPaths });
    } catch (error) {
      console.error("Login route error:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    const { username, password, name, email, role, phone, companyRegistrationNumber } = req.body;
    const effectiveRole =
      role != null && String(role).trim() !== "" ? String(role).trim() : "cashier";
    console.log(`Register attempt for username: ${username} role: ${effectiveRole}`);
    try {
      const prisma = getPrisma();

      const uname = typeof username === "string" ? username.trim() : "";
      const displayName = typeof name === "string" ? name : "";
      if (!uname || !password || !displayName.trim()) {
        return res.status(400).json({ error: "missing_fields" });
      }

      const derivedEmail =
        typeof email === "string" && email.trim()
          ? email.trim().toLowerCase()
          : `${uname.toLowerCase()}@bakery.local`;

      const existingLogin = await prisma.user.findFirst({
        where: {
          OR: [{ username: uname }, { email: derivedEmail }],
        },
      });
      if (existingLogin) {
        return res.status(409).json({ error: "username_exists" });
      }

      const normalizeCompany = (s: string) =>
        s.trim().replace(/\s+/g, " ");
      const companyNorm = normalizeCompany(displayName);

      if (effectiveRole === "customer_business" && companyNorm.length > 0) {
        const b2bUsers = await prisma.user.findMany({
          where: { role: "customer_business" },
          select: { name: true },
        });
        const taken = b2bUsers.some(
          (u) =>
            normalizeCompany(u.name).toLowerCase() === companyNorm.toLowerCase()
        );
        if (taken) {
          return res.status(409).json({ error: "b2b_company_exists" });
        }
      }

      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
      const phoneNorm =
        typeof phone === "string" && phone.trim() ? phone.trim() : null;
      const companyRegNorm =
        typeof companyRegistrationNumber === "string" &&
        companyRegistrationNumber.trim()
          ? companyRegistrationNumber.trim()
          : null;
      const user = await prisma.user.create({
        data: {
          username: uname,
          password: hashedPassword,
          name: companyNorm,
          email: derivedEmail,
          role: effectiveRole,
          status: "active",
          phone: phoneNorm,
          companyRegistrationNumber: companyRegNorm,
        },
      });
      console.log(`Registration successful for: ${derivedEmail}`);
      const roleForJwt =
        user.role != null && String(user.role).trim() !== ""
          ? String(user.role).trim()
          : "customer_customers";
      const token = jwt.sign(
        { id: user.id, username: user.username, role: roleForJwt },
        JWT_SECRET,
        { expiresIn: "8h" }
      );

      const allowedPaths = await resolveAllowedPaths(roleForJwt);
      res.json({ user: sanitizeUser(user), token, allowedPaths });
    } catch (error: any) {
      console.error("Register route error:", error);
      if (error?.code === "P2002") {
        return res.status(409).json({ error: "username_exists" });
      }
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // File upload endpoint for invoices - accepts base64 encoded PDF
  app.post("/api/upload/invoice", requireAuth, async (req: any, res) => {
    try {
      const { file } = req.body;
      if (!file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      const uploadsDir = path.join(process.cwd(), 'uploads', 'invoices');
      await fs.mkdir(uploadsDir, { recursive: true });

      // Decode base64 file
      const buffer = Buffer.from(file, 'base64');

      // Validate file size (max 2MB)
      if (buffer.length > 2 * 1024 * 1024) {
        return res.status(400).json({ error: 'File size exceeds 2MB limit' });
      }

      // Check if it's a PDF (magic bytes: %PDF)
      if (!buffer.toString('utf8', 0, 4).includes('%PDF')) {
        return res.status(400).json({ error: 'File must be a valid PDF' });
      }

      // Generate unique filename
      const timestamp = Date.now();
      const filename = `invoice-${timestamp}.pdf`;
      const filepath = path.join(uploadsDir, filename);

      // Write file
      await fs.writeFile(filepath, buffer);

      res.json({
        success: true,
        path: `/uploads/invoices/${filename}`,
        filename
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Serve uploaded files
  app.get("/uploads/invoices/:filename", (req, res) => {
    try {
      const filepath = path.join(process.cwd(), 'uploads', 'invoices', req.params.filename);
      res.download(filepath);
    } catch (error) {
      res.status(404).json({ error: 'File not found' });
    }
  });

  // SQLite backup — admin only
  app.post("/api/backup/trigger", requireAuth, async (req: any, res) => {
    const role = req.user?.role;
    if (role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
    try {
      const result = await performBackup();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/backup/list", requireAuth, (req: any, res) => {
    const role = req.user?.role;
    if (role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
    try {
      res.json(listBackups());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/backup/restore/:filename", requireAuth, async (req: any, res) => {
    const role = req.user?.role;
    if (role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
    const { filename } = req.params;
    if (!/^[\w\-]+\.db\.bak$/.test(filename)) {
      return res.status(400).json({ error: "Invalid filename" });
    }
    const backupPath = path.join(BACKUP_DIR, filename);
    if (!existsSync(backupPath)) {
      return res.status(404).json({ error: "Backup file not found" });
    }
    const dbUrl = process.env.DATABASE_URL || "";
    const dbPath = dbUrl.replace(/^file:/, "");
    if (!dbPath) {
      return res.status(500).json({ error: "DATABASE_URL not configured" });
    }
    try {
      if (prismaInstance) {
        await prismaInstance.$disconnect();
        prismaInstance = null;
      }
      await fs.copyFile(backupPath, dbPath);
      res.json({ ok: true, restored: filename });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Generalized API routes for CRUD (Prisma bridge)
  app.get("/api/db/:collection", (req, res, next) => {
    if (PUBLIC_GET_COLLECTIONS.includes(req.params.collection)) return next();
    return requireAuth(req, res, next);
  }, requireCollectionAccess, async (req: express.Request, res: express.Response) => {
    const { collection } = req.params;
    const { where, orderBy, take } = req.query;

    try {
      const model = getModel(collection);
      if (!model) return res.status(404).json({ error: `Collection ${collection} not found` });

      const parsedWhereRaw = parseWhereQuery(where);
      const parsedWhere =
        parsedWhereRaw != null ? deepNormalizePrismaWhere(parsedWhereRaw) : undefined;
      const rawData = await model.findMany({
        where: parsedWhere as object | undefined,
        orderBy: orderBy ? JSON.parse(orderBy as string) : undefined,
        take: take ? parseInt(take as string) : undefined,
      });

      const data = rawData.map((item: any) => {
        const unwrapped = unwrapDataIfNeeded(collection, item);
        const parsedItem = { ...unwrapped };
        for (const key in parsedItem) {
          const val = parsedItem[key];
          if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
            try {
              parsedItem[key] = JSON.parse(val);
            } catch (e) {
              // Not actual JSON, leave as string
            }
          }
        }

        // For purchases, merge stored purchase details back into response
        if (collection === 'purchases' && parsedItem.amountHT && typeof parsedItem.amountHT === 'object') {
          Object.assign(parsedItem, parsedItem.amountHT);
        }

        return parsedItem;
      });

      const finalData = collection === 'users' ? data.map(sanitizeUser) : data;
      res.json(finalData);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get("/api/db/:collection/:id", (req, res, next) => {
    if (PUBLIC_GET_COLLECTIONS.includes(req.params.collection)) return next();
    return requireAuth(req, res, next);
  }, requireCollectionAccess, async (req: express.Request, res: express.Response) => {
    const { collection, id } = req.params;
    try {
      const model = getModel(collection);
      if (!model) return res.status(404).json({ error: `Collection ${collection} not found` });

      const rawData = await model.findUnique({ where: { id } });
      if (!rawData) return res.json(null);

      const unwrapped = unwrapDataIfNeeded(collection, rawData);
      const data = { ...unwrapped };
      for (const key in data) {
        const val = data[key];
        if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
          try {
            data[key] = JSON.parse(val);
          } catch (e) {
            // Not actual JSON, leave as string
          }
        }
      }

      // For purchases, merge stored purchase details back into response
      if (collection === 'purchases' && data.amountHT && typeof data.amountHT === 'object') {
        Object.assign(data, data.amountHT);
      }

      const finalData = collection === 'users' ? sanitizeUser(data) : data;
      res.json(finalData);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/db/:collection", (req, res, next) => {
    if (PUBLIC_POST_COLLECTIONS.includes(req.params.collection)) return next();
    return requireAuth(req, res, next);
  }, requireCollectionAccess, async (req: express.Request, res: express.Response) => {
    const { collection } = req.params;
    try {
      const model = getModel(collection);
      if (!model) return res.status(404).json({ error: `Collection ${collection} not found` });

      // Hash password if creating a user
      if (collection === 'users' && req.body.password) {
        req.body.password = await bcrypt.hash(req.body.password, SALT_ROUNDS);
      }

      const preparedBody = wrapDataIfNeeded(collection, req.body);
      const dataToSave = { ...preparedBody };
      let originalData = { ...req.body }; // Keep original for purchases

      if (collection === 'rawMaterials') {
        if (dataToSave.stock !== undefined) dataToSave.currentStock = dataToSave.stock;
        else if (dataToSave.currentStock !== undefined) dataToSave.stock = dataToSave.currentStock;
      }

      if (collection === 'purchases') {
        dataToSave.invoiceNumber = `INV-${Date.now()}`;
        dataToSave.date = new Date(dataToSave.purchaseDate);
        dataToSave.totalAmount = dataToSave.price; // Use price as total directly (already total paid price)

        // Store full purchase details as JSON for later retrieval
        const purchaseDetails = {
          materialId: dataToSave.materialId,
          materialName: dataToSave.materialName,
          quantity: dataToSave.quantity,
          price: dataToSave.price,
          brand: dataToSave.brand,
          purchaseDate: dataToSave.purchaseDate,
          expiryDate: dataToSave.expiryDate,
          unit: dataToSave.unit,
          createdBy: dataToSave.createdBy,
          updatedAt: dataToSave.updatedAt
        };
        dataToSave.amountHT = JSON.stringify(purchaseDetails);

        // Only keep valid SupplierInvoice fields
        const validFields = ['invoiceNumber', 'supplierId', 'supplierName', 'date', 'dueDate', 'amountHT', 'tvaAmount', 'totalAmount', 'amountPaid', 'status'];
        const filtered: any = {};
        for (const field of validFields) {
          if (field in dataToSave) filtered[field] = dataToSave[field];
        }
        // Replace dataToSave with only valid fields
        for (const key in dataToSave) {
          delete dataToSave[key];
        }
        Object.assign(dataToSave, filtered);
      }

      for (const key in dataToSave) {
        if (dataToSave[key] !== null && typeof dataToSave[key] === 'object' && !(dataToSave[key] instanceof Date)) {
          dataToSave[key] = JSON.stringify(dataToSave[key]);
        }
      }

      const data = await model.create({ data: dataToSave });
      const result = unwrapDataIfNeeded(collection, data);

      // For purchases, return original data merged with saved data
      if (collection === 'purchases') {
        res.json({ ...originalData, ...result, id: result.id });
      } else {
        res.json(collection === 'users' ? sanitizeUser(result) : result);
      }
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.put("/api/db/:collection/:id", (req, res, next) => {
    if (PUBLIC_PUT_COLLECTIONS.includes(req.params.collection)) return next();
    return requireAuth(req, res, next);
  }, requireCollectionAccess, async (req: express.Request, res: express.Response) => {
    const { collection, id } = req.params;
    try {
      const model = getModel(collection);
      if (!model) return res.status(404).json({ error: `Collection ${collection} not found` });

      // Hash password if updating a user
      if (collection === 'users' && req.body.password) {
        req.body.password = await bcrypt.hash(req.body.password, SALT_ROUNDS);
      }

      const preparedBody = wrapDataIfNeeded(collection, req.body);
      const dataToSave = { ...preparedBody };
      let originalData = { ...req.body }; // Keep original for purchases

      if (collection === 'rawMaterials') {
        if (dataToSave.stock !== undefined) dataToSave.currentStock = dataToSave.stock;
        else if (dataToSave.currentStock !== undefined) dataToSave.stock = dataToSave.currentStock;
      }

      if (collection === 'purchases') {
        if (dataToSave.purchaseDate) dataToSave.date = new Date(dataToSave.purchaseDate);
        if (!dataToSave.totalAmount && dataToSave.price) {
          dataToSave.totalAmount = dataToSave.price; // Use price as total directly (already total paid price)
        }

        // Store full purchase details as JSON for later retrieval
        const purchaseDetails = {
          materialId: dataToSave.materialId,
          materialName: dataToSave.materialName,
          quantity: dataToSave.quantity,
          price: dataToSave.price,
          brand: dataToSave.brand,
          purchaseDate: dataToSave.purchaseDate,
          expiryDate: dataToSave.expiryDate,
          unit: dataToSave.unit,
          updatedAt: new Date().toISOString()
        };
        dataToSave.amountHT = JSON.stringify(purchaseDetails);

        // Only keep valid SupplierInvoice fields
        const validFields = ['invoiceNumber', 'supplierId', 'supplierName', 'date', 'dueDate', 'amountHT', 'tvaAmount', 'totalAmount', 'amountPaid', 'status'];
        const filtered: any = {};
        for (const field of validFields) {
          if (field in dataToSave) filtered[field] = dataToSave[field];
        }
        // Replace dataToSave with only valid fields
        for (const key in dataToSave) {
          delete dataToSave[key];
        }
        Object.assign(dataToSave, filtered);
      }

      for (const key in dataToSave) {
        if (dataToSave[key] !== null && typeof dataToSave[key] === 'object' && !(dataToSave[key] instanceof Date)) {
          dataToSave[key] = JSON.stringify(dataToSave[key]);
        }
      }

      const existing = await model.findUnique({ where: { id } });
      let data;
      if (existing) {
        data = await model.update({
          where: { id },
          data: dataToSave
        });
      } else {
        data = await model.create({
          data: { ...dataToSave, id }
        });
      }
      const result = unwrapDataIfNeeded(collection, data);

      // Bust the permissions cache when an admin updates a rolePermission row
      if (collection === 'rolePermissions') invalidatePermissionsCache(id);

      // For purchases, return original data merged with saved data
      if (collection === 'purchases') {
        res.json({ ...originalData, ...result, id: result.id });
      } else {
        res.json(collection === 'users' ? sanitizeUser(result) : result);
      }
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.delete("/api/db/:collection/:id", requireAuth, requireCollectionAccess, async (req, res) => {
    const { collection, id } = req.params;
    try {
      const model = getModel(collection);
      if (!model) return res.status(404).json({ error: `Collection ${collection} not found` });

      await model.delete({ where: { id } });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Atomic POS sale endpoint — creates sale + deducts stock in a single transaction
  app.post("/api/sale", requireAuth, async (req: any, res) => {
    const { customerId, totalAmount, paymentMethod, items } = req.body;
    const cashierId = req.user.id; // Use authenticated user ID instead of client-provided id
    
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items in sale' });
    }
    try {
      const prisma = getPrisma();

      const result = await prisma.$transaction(async (tx) => {
        // Get cashier name
        const cashier = await tx.user.findUnique({ where: { id: cashierId } });
        const cashierName = cashier?.name || 'Unknown Cashier';

        // Validate stock for all items first
        for (const item of items) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (!product) throw new Error(`Product not found: ${item.productId}`);
          if ((product.stock || 0) < item.quantity) {
            throw new Error(`Insufficient stock for: ${product.name}`);
          }
        }

        // Deduct stock atomically
        for (const item of items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity } }
          });
        }

        // Create sale record
        return await tx.sale.create({
          data: {
            cashierId,
            cashierName,
            customerId: customerId || null,
            totalAmount,
            paymentMethod,
            items: JSON.stringify(items)
          }
        });
      });

      res.json(result);
    } catch (error) {
      const msg = (error as Error).message;
      const status = msg.startsWith('Insufficient stock') || msg.startsWith('Product not found') ? 409 : 500;
      res.status(status).json({ error: msg });
    }
  });

  app.get("/api/sales", requireAuth, async (req: any, res) => {
    try {
      const prisma = getPrisma();
      const sales = await prisma.sale.findMany({
        orderBy: { createdAt: 'desc' },
        take: 500
      });
      res.json(sales);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get("/api/cashiers", requireAuth, async (req: any, res) => {
    try {
      const prisma = getPrisma();
      const cashiers = await prisma.user.findMany({
        where: { role: { in: ['admin', 'manager', 'cashier'] } },
        select: { id: true, name: true, role: true }
      });
      res.json(cashiers);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  function parseDbJsonField<T>(raw: unknown, fallback: T): T {
    if (raw == null) return fallback;
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw) as T;
      } catch {
        return fallback;
      }
    }
    if (typeof raw === "object") return raw as T;
    return fallback;
  }

  function normalizeReconciledStock(unit: string, value: number): number {
    const u = (unit || "").toLowerCase();
    if (u === "dozen" || u.includes("dozen")) {
      return Math.max(0, Math.round(value));
    }
    return Math.max(0, Math.round(value * 100) / 100);
  }

  /** Align raw material stock with sum(purchases) − consumption from completed batches × recipes; refresh batch ingredient snapshots. Admin/manager only. */
  app.post("/api/admin/reconcile-raw-inventory", requireAuth, async (req: any, res) => {
    const role = req.user?.role || "";
    if (!["admin", "manager"].includes(role)) {
      return res.status(403).json({ error: "Admin or manager only" });
    }
    try {
      const prisma = getPrisma();
      const includeTermination =
        req.query.includeTermination === "1" ||
        req.query.includeTermination === "true" ||
        req.body?.includeTermination === true;

      const invoices = await prisma.supplierInvoice.findMany();
      const purchasedByMaterial: Record<string, number> = {};
      for (const inv of invoices) {
        const details = parseDbJsonField<Record<string, unknown>>(inv.amountHT, {});
        const mid = details.materialId as string | undefined;
        const qtyRaw = details.quantity;
        if (!mid || qtyRaw === undefined || qtyRaw === null) continue;
        const q = typeof qtyRaw === "number" ? qtyRaw : parseFloat(String(qtyRaw));
        if (!Number.isFinite(q)) continue;
        purchasedByMaterial[mid] = (purchasedByMaterial[mid] || 0) + q;
      }

      const recipes = await prisma.recipe.findMany();
      const recipeByProduct: Record<string, { batchSize: number; ingredients: { materialId: string; quantity: number; unit: string }[] }> = {};
      for (const r of recipes) {
        const rawIngs = parseDbJsonField<unknown>(r.ingredients, []);
        const arr = Array.isArray(rawIngs) ? rawIngs : [];
        const ingredients = arr.map((x: any) => ({
          materialId: String(x.materialId),
          quantity: Number(x.quantity),
          unit: String(x.unit || ""),
        }));
        recipeByProduct[r.productId] = {
          batchSize: r.batchSize && r.batchSize > 0 ? r.batchSize : 1,
          ingredients,
        };
      }

      const batches = await prisma.productionBatch.findMany();
      const consumedByMaterial: Record<string, number> = {};
      const warnings: string[] = [];

      const countBatchTowardConsumption = (status: string | null | undefined) => {
        if (status === "completed") return true;
        if (includeTermination && status === "termination") return true;
        return false;
      };

      const batchSnapshotPayloads: { id: string; ingredients: string }[] = [];

      for (const b of batches) {
        if (!countBatchTowardConsumption(b.status)) continue;
        const rec = recipeByProduct[b.productId];
        if (!rec || rec.ingredients.length === 0) {
          warnings.push(`Batch ${b.id}: no recipe for product ${b.productId}; consumption not counted`);
          continue;
        }
        const planned = b.plannedQty ?? 0;
        const factor = planned / rec.batchSize;
        const snapshot: { materialId: string; quantity: number; type: string; unit?: string }[] = [];
        for (const ing of rec.ingredients) {
          const used = ing.quantity * factor;
          consumedByMaterial[ing.materialId] = (consumedByMaterial[ing.materialId] || 0) + used;
          snapshot.push({
            materialId: ing.materialId,
            quantity: Math.round(used * 10000) / 10000,
            type: "quantity",
            unit: ing.unit,
          });
        }
        batchSnapshotPayloads.push({ id: b.id, ingredients: JSON.stringify(snapshot) });
      }

      const materials = await prisma.rawMaterial.findMany();
      const materialRows: {
        id: string;
        name: string;
        unit: string;
        oldStock: number;
        newStock: number;
        purchased: number;
        consumed: number;
      }[] = [];

      for (const m of materials) {
        const purchased = purchasedByMaterial[m.id] || 0;
        const consumed = consumedByMaterial[m.id] || 0;
        const newStock = normalizeReconciledStock(m.unit, purchased - consumed);
        await prisma.$executeRaw`
          UPDATE RawMaterial SET currentStock = ${newStock}, stock = ${newStock} WHERE id = ${m.id}
        `;
        materialRows.push({
          id: m.id,
          name: m.name,
          unit: m.unit,
          oldStock: m.currentStock,
          newStock,
          purchased,
          consumed: Math.round(consumed * 10000) / 10000,
        });
      }

      for (const snap of batchSnapshotPayloads) {
        await prisma.productionBatch.update({
          where: { id: snap.id },
          data: { ingredients: snap.ingredients },
        });
      }

      res.json({
        ok: true,
        includeTermination,
        materials: materialRows,
        batchSnapshotsUpdated: batchSnapshotPayloads.length,
        warnings,
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get("/api/health", async (req, res) => {
    let dbStatus = "unknown";
    let userList: string[] = [];
    try {
      const prisma = getPrisma();
      await prisma.$queryRaw`SELECT 1`;
      dbStatus = "connected";

      const users = await prisma.user.findMany({ select: { username: true } });
      userList = users.map(u => u.username || 'null').filter(Boolean) as string[];
    } catch (error) {
      dbStatus = `error: ${(error as Error).message}`;
    }
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      database: "sqlite",
      dbStatus,
      users: userList
    });
  });

  // Serve uploaded files
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Vite middleware in dev — same port as API (default PORT from app.config, e.g. 3000).
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const certPath = process.env.SSL_CERT_PATH || '/app/certs/cert.pem';
  const keyPath = process.env.SSL_KEY_PATH || '/app/certs/key.pem';
  const httpOnly =
    process.env.BELLA_HTTP_ONLY === '1' || process.env.BELLA_HTTP_ONLY === 'true';
  const haveTls = !httpOnly && existsSync(certPath) && existsSync(keyPath);

  const server = haveTls
    ? https.createServer(
        { cert: readFileSync(certPath), key: readFileSync(keyPath) },
        app
      )
    : app;

  server.listen(PORT, "0.0.0.0", async () => {
    const proto = (server !== app) ? 'https' : 'http';
    console.log(`Server running on ${proto}://localhost:${PORT}`);

    // Auto-seed admin user and default settings if missing
    try {
      const prisma = getPrisma();

      const adminUser = await prisma.user.findFirst({
        where: {
          OR: [
            { id: 'admin-001' },
            { username: 'admin' },
            { email: 'admin@bakery.local' }
          ]
        }
      });

      if (!adminUser) {
        console.log("Admin user missing. Creating default admin...");
        await prisma.user.upsert({
          where: { id: 'admin-001' },
          update: {},
          create: {
            id: 'admin-001',
            username: 'admin',
            password: await bcrypt.hash('password', SALT_ROUNDS),
            name: 'Administrator',
            email: 'admin@bakery.local',
            role: 'admin',
            status: 'active'
          }
        });
        console.log("Default admin ensured: admin / password");
      }

      // Seed role permissions only for roles that have NO row yet.
      // Existing rows are owned by the admin and are never overwritten here.
      const DEFAULT_ROLE_PERMISSIONS: { id: string; allowedPaths: string[] }[] = [
        { id: 'admin',              allowedPaths: ['*'] },
        { id: 'manager',            allowedPaths: ['/dashboard','/production','/inventory','/procurement','/customers','/product-management','/pos','/b2b','/orders','/finance','/reports','/settings'] },
        { id: 'cashier',            allowedPaths: ['/pos','/orders'] },
        { id: 'baker',              allowedPaths: ['/production','/inventory'] },
        { id: 'inventory',          allowedPaths: ['/inventory','/product-management'] },
        { id: 'delivery_guy',       allowedPaths: ['/orders'] },
        { id: 'customer_business',  allowedPaths: ['/b2b'] },
        { id: 'customer_customers', allowedPaths: ['/pos'] },
      ];
      for (const rp of DEFAULT_ROLE_PERMISSIONS) {
        const existing = await prisma.rolePermission.findUnique({ where: { id: rp.id } });
        if (!existing) {
          await prisma.rolePermission.create({
            data: { id: rp.id, allowedPaths: JSON.stringify(rp.allowedPaths) }
          });
          console.log(`Seeded role permissions: ${rp.id} → ${rp.allowedPaths.join(', ')}`);
        }
      }

      // Ensure categories exist
      const categoriesSetting = await prisma.setting.findUnique({ where: { id: 'categories' } });
      if (!categoriesSetting) {
        console.log("Seeding default categories...");
        await prisma.setting.create({
          data: {
            id: 'categories',
            data: JSON.stringify({ list: ["Breads", "Pastries", "Cakes", "Cookies", "Savory"] })
          }
        });
      }

      // Seed sample products if none exist
      const productCount = await prisma.product.count();
      if (productCount === 0) {
        console.log("Seeding sample products with images...");
        await prisma.product.createMany({
          data: [
            { id: 'prod-001', name: 'Croissant au Beurre', category: 'viennoiserie', sellingPrice: 120, costPrice: 45, stock: 45, minStock: 20, imageUrl: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&q=80&w=800' },
            { id: 'prod-002', name: 'Pain au Chocolat', category: 'viennoiserie', sellingPrice: 150, costPrice: 55, stock: 38, minStock: 20, imageUrl: 'https://images.unsplash.com/photo-1530610476181-d83430b64dcd?auto=format&fit=crop&q=80&w=800' },
            { id: 'prod-003', name: 'Macarons Assortis (6pcs)', category: 'patisserie', sellingPrice: 850, costPrice: 350, stock: 15, minStock: 10, imageUrl: 'https://images.unsplash.com/photo-1569864358642-9d1619702661?auto=format&fit=crop&q=80&w=800' },
            { id: 'prod-004', name: 'Baguette Tradition', category: 'boulangerie', sellingPrice: 50, costPrice: 15, stock: 60, minStock: 30, imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=800' },
            { id: 'prod-005', name: 'Éclair au Chocolat', category: 'patisserie', sellingPrice: 250, costPrice: 90, stock: 12, minStock: 8, imageUrl: 'https://images.unsplash.com/photo-1612203985729-70726954388c?auto=format&fit=crop&q=80&w=800' },
            { id: 'prod-006', name: 'Tarte aux Fraises', category: 'patisserie', sellingPrice: 350, costPrice: 150, stock: 8, minStock: 5, imageUrl: 'https://images.unsplash.com/photo-1519915028121-7d3463d20b13?auto=format&fit=crop&q=80&w=800' },
            { id: 'prod-007', name: 'Pain aux Raisins', category: 'viennoiserie', sellingPrice: 140, costPrice: 50, stock: 25, minStock: 15, imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=800' },
            { id: 'prod-008', name: 'Croissant aux Amandes', category: 'viennoiserie', sellingPrice: 180, costPrice: 70, stock: 20, minStock: 10, imageUrl: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&q=80&w=800' },
            { id: 'prod-009', name: 'Paris-Brest', category: 'patisserie', sellingPrice: 450, costPrice: 180, stock: 10, minStock: 5, imageUrl: 'https://images.unsplash.com/photo-1612203985729-70726954388c?auto=format&fit=crop&q=80&w=800' },
            { id: 'prod-010', name: 'Mille-Feuille', category: 'patisserie', sellingPrice: 400, costPrice: 160, stock: 12, minStock: 6, imageUrl: 'https://images.unsplash.com/photo-1519915028121-7d3463d20b13?auto=format&fit=crop&q=80&w=800' },
          ]
        });
      }

      // Seed sample customers if none exist
      const customerCount = await prisma.customer.count();
      if (customerCount === 0) {
        console.log("Seeding sample customers...");
        await prisma.customer.createMany({
          data: [
            { id: 'cust-001', name: 'John Smith', email: 'john@example.com', phone: '555-0101', type: 'b2c' },
            { id: 'cust-002', name: 'Sarah Johnson', email: 'sarah@example.com', phone: '555-0102', type: 'b2c' },
            { id: 'cust-003', name: 'Mike\'s Cafe', email: 'mikes@cafe.com', phone: '555-0103', type: 'b2b' },
            { id: 'cust-004', name: 'Hotel Grand', email: 'booking@hotelgrand.com', phone: '555-0104', type: 'b2b' },
            { id: 'cust-005', name: 'Emma Wilson', email: 'emma@example.com', phone: '555-0105', type: 'b2c' },
          ]
        });
      }

      // Seed sample raw materials if none exist
      const materialCount = await prisma.rawMaterial.count();
      if (materialCount === 0) {
        console.log("Seeding sample raw materials...");
        await prisma.rawMaterial.createMany({
          data: [
            { id: 'mat-001', name: 'All-Purpose Flour', category: 'Flour', unit: 'kg', currentStock: 50, minStock: 10 },
            { id: 'mat-002', name: 'Cocoa Powder', category: 'Chocolate', unit: 'kg', currentStock: 5, minStock: 1 },
            { id: 'mat-003', name: 'Sugar', category: 'Sweeteners', unit: 'kg', currentStock: 40, minStock: 10 },
            { id: 'mat-004', name: 'Butter', category: 'Dairy', unit: 'kg', currentStock: 15, minStock: 5 },
            { id: 'mat-005', name: 'Eggs', category: 'Dairy', unit: 'dozen', currentStock: 20, minStock: 5 },
            { id: 'mat-006', name: 'Salt', category: 'Seasoning', unit: 'kg', currentStock: 5, minStock: 1 },
            { id: 'mat-007', name: 'Vanilla Extract', category: 'Flavorings', unit: 'liter', currentStock: 2, minStock: 0.5 },
            { id: 'mat-008', name: 'Dark Chocolate', category: 'Chocolate', unit: 'kg', currentStock: 8, minStock: 2 },
          ]
        });
      }

      // Seed sample production batches if none exist
      const batchCount = await prisma.productionBatch.count();
      if (batchCount === 0) {
        console.log("Seeding sample production batches...");
        const now = new Date();
        await prisma.productionBatch.createMany({
          data: [
            { id: 'batch-001', productId: 'prod-001', recipeId: 'recipe-001', plannedQty: 30, actualQty: 28, status: 'completed', startDate: new Date(now.getTime() - 86400000) },
            { id: 'batch-002', productId: 'prod-002', recipeId: 'recipe-002', plannedQty: 20, actualQty: null, status: 'in-progress', startDate: now },
            { id: 'batch-003', productId: 'prod-003', recipeId: 'recipe-003', plannedQty: 10, actualQty: null, status: 'planned', startDate: new Date(now.getTime() + 86400000) },
          ]
        });
      }

      // Seed sample sales if none exist
      const saleCount = await prisma.sale.count();
      if (saleCount === 0) {
        console.log("Seeding sample sales...");
        await prisma.sale.createMany({
          data: [
            { id: 'sale-001', cashierId: 'admin-001', customerId: 'cust-001', totalAmount: 15.50, paymentMethod: 'cash', items: JSON.stringify([{ productId: 'prod-001', quantity: 2, price: 3.50 }, { productId: 'prod-004', quantity: 3, price: 2.00 }]) },
            { id: 'sale-002', cashierId: 'admin-001', customerId: 'cust-003', totalAmount: 45.00, paymentMethod: 'card', items: JSON.stringify([{ productId: 'prod-003', quantity: 1, price: 12.00 }, { productId: 'prod-002', quantity: 6, price: 5.00 }]) },
            { id: 'sale-003', cashierId: 'admin-001', customerId: null, totalAmount: 8.50, paymentMethod: 'cash', items: JSON.stringify([{ productId: 'prod-007', quantity: 1, price: 8.50 }]) },
          ]
        });
      }

    } catch (error) {
      console.error("Error during auto-seeding:", error);
    }

    // Nightly backup scheduler — check every minute against config in settings
    let lastBackupDate = "";
    setInterval(async () => {
      try {
        const cfg = await getBackupConfig();
        if (!cfg.enabled) return;
        const now = new Date();
        const today = now.toISOString().slice(0, 10);
        const parts = cfg.time.split(":");
        const h = parseInt(parts[0] ?? "23", 10);
        const m = parseInt(parts[1] ?? "59", 10);
        if (
          now.getHours() === h &&
          now.getMinutes() === m &&
          lastBackupDate !== today
        ) {
          lastBackupDate = today;
          performBackup().catch((err) =>
            console.error("Scheduled backup failed:", err)
          );
        }
      } catch (e) {
        console.error("Backup scheduler tick failed:", e);
      }
    }, 60_000);
  });
}

startServer();
