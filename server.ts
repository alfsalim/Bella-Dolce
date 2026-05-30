import "dotenv/config";
import config from './app.config';
import Redis from 'ioredis';
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient, Prisma } from "@prisma/client";
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
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";
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
    'fixedAssetMaintenances': prisma.fixedAssetMaintenance,
    'cashReconciliations': prisma.dailyCashReconciliation,
    'riskSnapshots': prisma.riskSnapshot,
    'budgets': prisma.budget,
    'system': prisma.system,
    'financialEmployees': prisma.financialEmployee,
    'stockMovements': prisma.stockMovement,
    'promotions': prisma.promotion,
    'settings': prisma.setting,
    'utilities': prisma.utility,
    'utilityDefinitions': prisma.utilityDefinition,
    'taxConfigs': prisma.taxConfig,
    'ifuDeclarations': prisma.ifuDeclaration
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

function preparePromotionForPrisma(src: Record<string, any>) {
  const isCampaign = src.type === 'campaign';
  if (isCampaign) {
    const campaignPayload = {
      campaignName: String(src.name ?? src.title ?? "").trim(),
      description: String(src.description ?? "").trim(),
      productIds: Array.isArray(src.productIds) ? src.productIds : [],
      productPrices: Array.isArray(src.productPrices) ? src.productPrices : [],
    };
    return {
      title: campaignPayload.campaignName || null,
      description: JSON.stringify(campaignPayload),
      imageUrl: null,
      expiryDate: src.expiryDate,
      active: src.active !== false,
      type: 'campaign',
      createdAt: src.createdAt,
    };
  }
  return {
    title: src.title ?? null,
    description: src.description ?? null,
    imageUrl: src.imageUrl ?? null,
    expiryDate: src.expiryDate,
    active: src.active !== false,
    type: src.type ?? 'banner',
    createdAt: src.createdAt,
  };
}

function hydratePromotionFromStored(row: Record<string, any>) {
  if (row.type !== 'campaign') return row;
  const payload = typeof row.description === 'object' && row.description !== null
    ? row.description
    : {};
  return {
    ...row,
    name: typeof payload.campaignName === 'string' ? payload.campaignName : (row.title ?? ''),
    description: typeof payload.description === 'string' ? payload.description : '',
    productIds: Array.isArray(payload.productIds) ? payload.productIds : [],
    productPrices: Array.isArray(payload.productPrices) ? payload.productPrices : [],
  };
}

/** Coerces JSON/API values to `string | null` for optional Prisma `String?` fields (avoids Prisma Int/object rejects). */
function optionalEmployeeTextField(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") {
    const t = v.trim();
    return t !== "" ? t : null;
  }
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

const FINANCIAL_EMPLOYEE_WRITE_KEYS = [
  "name",
  "role",
  "email",
  "phone",
  "matricule",
  "nin",
  "cnasNumber",
  "department",
  "hireDate",
  "baseSalary",
  "transportAllowance",
  "performanceBonus",
  "otherAllowances",
  "contributesToCNAS",
  "bankRIB",
  "status",
] as const;

/** Keeps only fields on Prisma `FinancialEmployee` create/update input (no `createdAt`, stray client keys, etc.). */
function pickFinancialEmployeeWriteData(src: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k of FINANCIAL_EMPLOYEE_WRITE_KEYS) {
    if (src[k] !== undefined) out[k] = src[k];
  }
  return out;
}

/** Maps app payroll payload to Prisma `FinancialEmployee` (strips UserProfile-only fields like username/password). */
function prepareFinancialEmployeeForPrisma(body: Record<string, any>, explicitId?: string) {
  const id = explicitId ?? body.id;
  const matriculeRaw = body.matricule != null ? String(body.matricule).trim() : "";
  const matricule = matriculeRaw || `EMP-${String(id ?? "x").replace(/-/g, "")}`;
  let hireDate: Date | null = null;
  if (body.hireDate) {
    const d = new Date(body.hireDate);
    if (!Number.isNaN(d.getTime())) hireDate = d;
  }
  const baseSalary = Number(body.baseSalary);
  const transportAllowance = Number(body.transportAllowance) || 0;
  const performanceBonus = Number(body.performanceBonus) || 0;
  const otherAllowances = Number(body.otherAllowances) || 0;
  const contributesToCNAS = body.contributesToCNAS !== false && body.contributesToCNAS !== "false";
  return {
    name: String(body.name ?? ""),
    role: String(body.role ?? ""),
    email: optionalEmployeeTextField(body.email),
    phone: optionalEmployeeTextField(body.phone),
    matricule,
    nin: optionalEmployeeTextField(body.nin),
    cnasNumber: optionalEmployeeTextField(body.cnasNumber),
    department: optionalEmployeeTextField(body.department),
    hireDate,
    baseSalary: Number.isFinite(baseSalary) ? baseSalary : 0,
    transportAllowance,
    performanceBonus,
    otherAllowances,
    contributesToCNAS,
    bankRIB: optionalEmployeeTextField(body.bankRIB),
    status: body.status != null ? String(body.status) : "ACTIF",
  };
}

const FIXED_ASSET_CANDIDATE_FIELDS = [
  "code",
  "name",
  "category",
  "location",
  "acquisitionCost",
  "usefulLifeYears",
  "salvageValue",
  "depreciationMethod",
  "notes",
  "lastMaintenanceAt",
  "nextMaintenanceAt",
  "maintenanceNotes",
  "status",
  "acquisitionDate",
] as const;

const fixedAssetRuntimeFields = new Set(
  (Prisma.dmmf.datamodel.models.find((m) => m.name === "FixedAsset")?.fields ?? [])
    .map((f) => f.name)
);

function prepareFixedAssetForPrisma(raw: Record<string, any>) {
  const num = (v: unknown, d: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  };
  const int = (v: unknown, d: number) => {
    const n = parseInt(String(v), 10);
    return Number.isFinite(n) ? n : d;
  };
  const out: Record<string, any> = {};
  const has = (field: string) => fixedAssetRuntimeFields.has(field);
  for (const key of FIXED_ASSET_CANDIDATE_FIELDS) {
    if (has(key) && key in raw && raw[key] !== undefined) out[key] = raw[key];
  }
  if (has("acquisitionCost")) out.acquisitionCost = num(out.acquisitionCost ?? raw.acquisitionCost, 0);
  if (has("usefulLifeYears")) out.usefulLifeYears = int(out.usefulLifeYears ?? raw.usefulLifeYears, 5);
  if (has("name")) out.name = String(out.name ?? raw.name ?? "");
  if (has("code")) out.code = String(out.code ?? raw.code ?? "").trim();
  if (has("status")) out.status = String(out.status ?? raw.status ?? "IN_SERVICE");
  if (has("acquisitionDate")) {
    if (out.acquisitionDate) out.acquisitionDate = new Date(out.acquisitionDate);
    else out.acquisitionDate = new Date();
  }
  if (has("category")) out.category = String(out.category ?? raw.category ?? "other");
  if (has("salvageValue")) out.salvageValue = num(out.salvageValue ?? raw.salvageValue, 0);
  if (has("depreciationMethod")) out.depreciationMethod = String(out.depreciationMethod ?? raw.depreciationMethod ?? "LINEAR");
  if (has("location")) {
    if (out.location != null && out.location !== "") out.location = String(out.location);
    else delete out.location;
  }
  if (has("notes")) {
    if (out.notes != null && out.notes !== "") out.notes = String(out.notes);
    else delete out.notes;
  }
  if (has("maintenanceNotes")) {
    if (out.maintenanceNotes != null && out.maintenanceNotes !== "") out.maintenanceNotes = String(out.maintenanceNotes);
    else delete out.maintenanceNotes;
  }
  if (has("lastMaintenanceAt")) {
    if (raw.lastMaintenanceAt === null) {
      out.lastMaintenanceAt = null;
    } else if (out.lastMaintenanceAt) {
      out.lastMaintenanceAt = new Date(out.lastMaintenanceAt);
    } else {
      delete out.lastMaintenanceAt;
    }
  }
  if (has("nextMaintenanceAt")) {
    if (raw.nextMaintenanceAt === null) {
      out.nextMaintenanceAt = null;
    } else if (out.nextMaintenanceAt) {
      out.nextMaintenanceAt = new Date(out.nextMaintenanceAt);
    } else {
      delete out.nextMaintenanceAt;
    }
  }
  return out;
}

function prepareFixedAssetMaintenanceForPrisma(raw: Record<string, any>) {
  const num = (v: unknown, d: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  };
  const fixedAssetId = String(raw.fixedAssetId ?? "").trim();
  if (!fixedAssetId) {
    throw new Error("fixedAssetId is required for maintenance");
  }
  const out: Record<string, any> = {
    fixedAssetId,
    description: String(raw.description ?? "").trim(),
    cost: Math.max(0, num(raw.cost, 0)),
  };
  if (raw.date) {
    out.date = new Date(raw.date);
  } else {
    out.date = new Date();
  }
  if (raw.nextDueDate === null || raw.nextDueDate === "") {
    out.nextDueDate = null;
  } else if (raw.nextDueDate != null) {
    out.nextDueDate = new Date(raw.nextDueDate);
  }
  return out;
}

function deriveUtilityStatus(raw: Record<string, any>): string {
  if (raw.paidAt) return "PAID";
  if (raw.dueDate) {
    const dueDate = new Date(raw.dueDate);
    if (dueDate < new Date()) return "OVERDUE";
  }
  return "PENDING";
}

function prepareUtilityForPrisma(raw: Record<string, any>) {
  const num = (v: unknown, d: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  };
  const out: Record<string, any> = {
    type: String(raw.type ?? "OTHER").trim().toUpperCase(),
    provider: String(raw.provider ?? "").trim(),
    amount: num(raw.amount, 0),
    currency: String(raw.currency ?? "DZD"),
  };
  if (raw.periodStart) out.periodStart = new Date(raw.periodStart);
  if (raw.periodEnd) out.periodEnd = new Date(raw.periodEnd);
  if (raw.dueDate) out.dueDate = new Date(raw.dueDate);
  else out.dueDate = null;
  if (raw.paidAt) out.paidAt = new Date(raw.paidAt);
  else out.paidAt = null;
  out.status = deriveUtilityStatus(raw);
  if (raw.invoiceNumber) out.invoiceNumber = String(raw.invoiceNumber).trim();
  else out.invoiceNumber = null;
  if (raw.attachmentUrl) out.attachmentUrl = String(raw.attachmentUrl).trim();
  else out.attachmentUrl = null;
  if (raw.notes) out.notes = String(raw.notes).trim();
  else out.notes = null;
  return out;
}

async function createWithUnknownArgRetry(model: any, data: Record<string, any>) {
  const payload = { ...data };
  for (let i = 0; i < 20; i++) {
    try {
      return await model.create({ data: payload });
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      const m = msg.match(/Unknown argument `([^`]+)`/);
      if (!m) throw e;
      const badKey = m[1];
      if (!(badKey in payload)) throw e;
      delete payload[badKey];
    }
  }
  throw new Error("Failed to create fixed asset: too many unknown arguments.");
}

async function updateWithUnknownArgRetry(model: any, id: string, data: Record<string, any>) {
  const payload = { ...data };
  for (let i = 0; i < 20; i++) {
    try {
      return await model.update({ where: { id }, data: payload });
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      const m = msg.match(/Unknown argument `([^`]+)`/);
      if (!m) throw e;
      const badKey = m[1];
      if (!(badKey in payload)) throw e;
      delete payload[badKey];
    }
  }
  throw new Error("Failed to update fixed asset: too many unknown arguments.");
}

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
  fixedAssets:              '/finance',
  fixedAssetMaintenances:   '/finance',
  financialEmployees:       '/finance',
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
// `users`: reads allowed for finance / procurement / settings (sanitized); see requireCollectionAccess.
const ADMIN_ONLY_COLLECTIONS = new Set(['rolePermissions', 'system']);

const PUBLIC_GET_COLLECTIONS: string[] = ['products', 'promotions', 'settings'];
const PUBLIC_POST_COLLECTIONS: string[] = ['orders', 'customers', 'activityLogs'];
const PUBLIC_PUT_COLLECTIONS: string[] = ['products'];

/** Mirrors `requireCollectionAccess` for GET (authenticated search). */
async function canReadCollectionForSearch(userRole: string, collection: string): Promise<boolean> {
  if (PUBLIC_GET_COLLECTIONS.includes(collection)) return true;
  const role = userRole.trim();
  if (role === 'admin') return true;
  if (ADMIN_ONLY_COLLECTIONS.has(collection)) return false;
  const routeRequired = COLLECTION_ROUTE_MAP[collection];
  if (!routeRequired) return true;
  const allowedPaths = await getCachedAllowedPaths(role);
  if (allowedPaths.includes('*') || allowedPaths.includes(routeRequired)) return true;
  // Expenses view in finance reads the same rows as procurement (purchases → SupplierInvoice)
  if (collection === 'purchases' && allowedPaths.includes('/finance')) return true;
  // Paie / payroll uses financialEmployees; procurement staff use same supplier-facing access pattern
  if (collection === 'financialEmployees' && allowedPaths.includes('/procurement')) return true;
  // User list (sanitized) for paie onboarding: finance or procurement without /settings
  if (
    collection === 'users' &&
    (allowedPaths.includes('/finance') || allowedPaths.includes('/procurement'))
  ) {
    return true;
  }
  return false;
}

const SEARCH_HITS_PER_TYPE = 8;

type SearchHitDto = {
  type: string;
  id: string;
  label: string;
  subtitle?: string;
  path: string;
};

/** Global staff search: only whitelisted collections; RBAC per row type. */
async function runGlobalSearch(userRole: string, q: string): Promise<SearchHitDto[]> {
  const prisma = getPrisma();
  const trimmed = q.trim();
  const hits: SearchHitDto[] = [];
  const take = SEARCH_HITS_PER_TYPE;

  const [
    okProducts,
    okCustomers,
    okOrders,
    okSuppliers,
    okRawMaterials,
    okPromotions,
    okDeliveries,
    okUsers,
    okAccounts,
    okJournalEntries,
    okPurchases,
    okSupplierInvoices,
    okActivityLogs,
    okStockMovements,
  ] = await Promise.all([
    canReadCollectionForSearch(userRole, 'products'),
    canReadCollectionForSearch(userRole, 'customers'),
    canReadCollectionForSearch(userRole, 'orders'),
    canReadCollectionForSearch(userRole, 'suppliers'),
    canReadCollectionForSearch(userRole, 'rawMaterials'),
    canReadCollectionForSearch(userRole, 'promotions'),
    canReadCollectionForSearch(userRole, 'deliveries'),
    canReadCollectionForSearch(userRole, 'users'),
    canReadCollectionForSearch(userRole, 'accounts'),
    canReadCollectionForSearch(userRole, 'journalEntries'),
    canReadCollectionForSearch(userRole, 'purchases'),
    canReadCollectionForSearch(userRole, 'supplierInvoices'),
    canReadCollectionForSearch(userRole, 'activityLogs'),
    canReadCollectionForSearch(userRole, 'stockMovements'),
  ]);

  const tasks: Promise<void>[] = [];

  if (okProducts) {
    tasks.push(
      (async () => {
        const rows = await prisma.product.findMany({
          where: {
            OR: [
              { name: { contains: trimmed } },
              { description: { contains: trimmed } },
              { category: { contains: trimmed } },
            ],
          },
          take,
          orderBy: { name: 'asc' },
        });
        for (const r of rows) {
          hits.push({
            type: 'product',
            id: r.id,
            label: r.name,
            subtitle: r.category,
            path: `/products/${r.id}`,
          });
        }
      })()
    );
  }

  if (okCustomers) {
    tasks.push(
      (async () => {
        const rows = await prisma.customer.findMany({
          where: {
            OR: [
              { name: { contains: trimmed } },
              { email: { contains: trimmed } },
              { phone: { contains: trimmed } },
            ],
          },
          take,
          orderBy: { name: 'asc' },
        });
        for (const r of rows) {
          hits.push({
            type: 'customer',
            id: r.id,
            label: r.name,
            subtitle: r.email ?? undefined,
            path: '/customers',
          });
        }
      })()
    );
  }

  if (okOrders) {
    tasks.push(
      (async () => {
        const rows = await prisma.order.findMany({
          where: {
            OR: [
              { id: { contains: trimmed } },
              { clientName: { contains: trimmed } },
              { description: { contains: trimmed } },
              { status: { contains: trimmed } },
            ],
          },
          take,
          orderBy: { createdAt: 'desc' },
        });
        for (const r of rows) {
          hits.push({
            type: 'order',
            id: r.id,
            label: r.clientName || r.id,
            subtitle: r.status,
            path: '/orders',
          });
        }
      })()
    );
  }

  if (okSuppliers) {
    tasks.push(
      (async () => {
        const rows = await prisma.supplier.findMany({
          where: {
            OR: [
              { name: { contains: trimmed } },
              { email: { contains: trimmed } },
              { phone: { contains: trimmed } },
            ],
          },
          take,
          orderBy: { name: 'asc' },
        });
        for (const r of rows) {
          hits.push({
            type: 'supplier',
            id: r.id,
            label: r.name,
            subtitle: r.phone ?? undefined,
            path: '/procurement',
          });
        }
      })()
    );
  }

  if (okRawMaterials) {
    tasks.push(
      (async () => {
        const rows = await prisma.rawMaterial.findMany({
          where: {
            OR: [{ name: { contains: trimmed } }, { category: { contains: trimmed } }],
          },
          take,
          orderBy: { name: 'asc' },
        });
        for (const r of rows) {
          hits.push({
            type: 'rawMaterial',
            id: r.id,
            label: r.name,
            subtitle: r.category,
            path: '/inventory',
          });
        }
      })()
    );
  }

  if (okPromotions) {
    tasks.push(
      (async () => {
        const rows = await prisma.promotion.findMany({
          where: {
            OR: [{ title: { contains: trimmed } }, { description: { contains: trimmed } }],
          },
          take,
          orderBy: { createdAt: 'desc' },
        });
        for (const r of rows) {
          hits.push({
            type: 'promotion',
            id: r.id,
            label: r.title || r.id,
            subtitle: r.type,
            path: '/settings',
          });
        }
      })()
    );
  }

  if (okDeliveries) {
    tasks.push(
      (async () => {
        const rows = await prisma.delivery.findMany({
          where: {
            OR: [
              { id: { contains: trimmed } },
              { orderId: { contains: trimmed } },
              { comments: { contains: trimmed } },
            ],
          },
          take,
          orderBy: { updatedAt: 'desc' },
        });
        for (const r of rows) {
          hits.push({
            type: 'delivery',
            id: r.id,
            label: r.orderId,
            subtitle: r.status,
            path: '/orders',
          });
        }
      })()
    );
  }

  if (okUsers) {
    tasks.push(
      (async () => {
        const rows = await prisma.user.findMany({
          where: {
            OR: [
              { name: { contains: trimmed } },
              { email: { contains: trimmed } },
              { username: { contains: trimmed } },
            ],
          },
          take,
          orderBy: { name: 'asc' },
        });
        for (const r of rows) {
          const safe = sanitizeUser(r);
          hits.push({
            type: 'user',
            id: safe.id,
            label: safe.name,
            subtitle: safe.email ?? safe.username ?? undefined,
            path: '/settings',
          });
        }
      })()
    );
  }

  if (okAccounts) {
    tasks.push(
      (async () => {
        const rows = await prisma.account.findMany({
          where: {
            OR: [{ number: { contains: trimmed } }, { name: { contains: trimmed } }],
          },
          take,
          orderBy: { number: 'asc' },
        });
        for (const r of rows) {
          hits.push({
            type: 'account',
            id: r.id,
            label: r.name,
            subtitle: r.number,
            path: '/finance',
          });
        }
      })()
    );
  }

  if (okJournalEntries) {
    tasks.push(
      (async () => {
        const rows = await prisma.journalEntry.findMany({
          where: {
            OR: [
              { number: { contains: trimmed } },
              { label: { contains: trimmed } },
              { reference: { contains: trimmed } },
            ],
          },
          take,
          orderBy: { date: 'desc' },
        });
        for (const r of rows) {
          hits.push({
            type: 'journalEntry',
            id: r.id,
            label: r.label,
            subtitle: r.number,
            path: '/finance',
          });
        }
      })()
    );
  }

  const okInvoiceSearch = okPurchases || okSupplierInvoices;
  if (okInvoiceSearch) {
    tasks.push(
      (async () => {
        const rows = await prisma.supplierInvoice.findMany({
          where: {
            OR: [
              { invoiceNumber: { contains: trimmed } },
              { supplierName: { contains: trimmed } },
            ],
          },
          take,
          orderBy: { date: 'desc' },
        });
        for (const r of rows) {
          const dest =
            okPurchases && okSupplierInvoices
              ? '/procurement'
              : okPurchases
                ? '/procurement'
                : '/finance';
          hits.push({
            type: 'supplierInvoice',
            id: r.id,
            label: r.invoiceNumber,
            subtitle: r.supplierName ?? undefined,
            path: dest,
          });
        }
      })()
    );
  }

  if (okActivityLogs) {
    tasks.push(
      (async () => {
        const rows = await prisma.activityLog.findMany({
          where: {
            OR: [
              { action: { contains: trimmed } },
              { details: { contains: trimmed } },
              { userName: { contains: trimmed } },
            ],
          },
          take,
          orderBy: { timestamp: 'desc' },
        });
        for (const r of rows) {
          hits.push({
            type: 'activityLog',
            id: r.id,
            label: r.action,
            subtitle: r.userName,
            path: '/dashboard',
          });
        }
      })()
    );
  }

  if (okStockMovements) {
    tasks.push(
      (async () => {
        const rows = await prisma.stockMovement.findMany({
          where: {
            OR: [
              { itemName: { contains: trimmed } },
              { reason: { contains: trimmed } },
              { userName: { contains: trimmed } },
            ],
          },
          take,
          orderBy: { timestamp: 'desc' },
        });
        for (const r of rows) {
          hits.push({
            type: 'stockMovement',
            id: r.id,
            label: r.itemName || r.reason,
            subtitle: r.itemType,
            path: '/inventory',
          });
        }
      })()
    );
  }

  await Promise.all(tasks);
  return hits;
}

// Redis client — shared cross-user cache for read-heavy collections
// retryStrategy: null disables automatic reconnection so dev runs without Redis stay clean
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  lazyConnect: true,
  enableOfflineQueue: false,
  retryStrategy: () => null,
});
redis.on('error', () => {}); // suppress unhandled error events when Redis is unavailable
redis.connect().catch(() => {}); // graceful: app works without Redis

const CACHED_COLLECTIONS = new Set([
  'products', 'rawMaterials', 'promotions', 'recipes',
  'suppliers', 'customers', 'settings',
]);
const CACHE_TTL_SECONDS = 3600;
// These collections trigger rawMaterials invalidation as a side-effect (stock changes)
const INVALIDATES_RAW_MATERIALS = new Set(['purchases', 'batches']);

function buildCacheKey(collection: string, params: object): string {
  const sorted = Object.keys(params).sort().reduce((acc, k) => {
    (acc as any)[k] = (params as any)[k];
    return acc;
  }, {} as object);
  return `bella:${collection}:${JSON.stringify(sorted)}`;
}
async function cacheGet(key: string): Promise<any[] | null> {
  try { const v = await redis.get(key); return v ? JSON.parse(v) : null; }
  catch { return null; }
}
async function cacheSet(key: string, data: any[]): Promise<void> {
  try { await redis.set(key, JSON.stringify(data), 'EX', CACHE_TTL_SECONDS); }
  catch {}
}
async function cacheInvalidate(collection: string): Promise<void> {
  try {
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', `bella:${collection}:*`, 'COUNT', 100);
      cursor = next;
      if (keys.length) await redis.del(...(keys as string[]));
    } while (cursor !== '0');
  } catch {}
}

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
  const PORT = parseInt(process.env.PORT || '3000', 10);

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

    // users: sanitized list / get for finance & paie onboarding, procurement parity, or settings; mutations admin-only
    if (collection === 'users') {
      if (method !== 'GET') {
        return res.status(403).json({ error: 'Forbidden: admin only' });
      }
      return getCachedAllowedPaths(userRole)
        .then((allowedPaths) => {
          if (allowedPaths.includes('*')) return next();
          if (
            allowedPaths.includes('/settings') ||
            allowedPaths.includes('/finance') ||
            allowedPaths.includes('/procurement')
          ) {
            return next();
          }
          return res.status(403).json({ error: 'Forbidden: insufficient role' });
        })
        .catch(() => res.status(403).json({ error: 'Forbidden: could not verify permissions' }));
    }

    // Admin-only collections — no regular user access
    if (ADMIN_ONLY_COLLECTIONS.has(collection)) {
      return res.status(403).json({ error: 'Forbidden: admin only' });
    }

    // For all other collections, check against the DB rolePermissions asynchronously
    const routeRequired = COLLECTION_ROUTE_MAP[collection];
    if (!routeRequired) return next(); // Unknown collection — allow (safe default for new collections)

    getCachedAllowedPaths(userRole).then((allowedPaths) => {
      if (allowedPaths.includes('*')) return next();
      const routeRequired = COLLECTION_ROUTE_MAP[collection];
      if (!routeRequired) return next();
      if (allowedPaths.includes(routeRequired)) return next();
      // Finance users may list purchases for the Dépenses tab (read-only expense mirror).
      if (
        collection === 'purchases' &&
        method === 'GET' &&
        allowedPaths.includes('/finance')
      ) {
        return next();
      }
      // Paie: financialEmployees readable/writable with procurement access (same staff as suppliers)
      if (
        collection === 'financialEmployees' &&
        allowedPaths.includes('/procurement')
      ) {
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

  app.get('/api/search', requireAuth, async (req: any, res: express.Response) => {
    try {
      const qRaw = req.query.q;
      const q = typeof qRaw === 'string' ? qRaw.trim() : '';
      if (q.length < 2) {
        return res.status(400).json({ error: 'searchQueryTooShort' });
      }
      if (q.length > 80) {
        return res.status(400).json({ error: 'searchQueryTooLong' });
      }
      const roleRaw = req.user?.role;
      const role = typeof roleRaw === 'string' ? roleRaw.trim() : '';
      if (!role) {
        return res.status(400).json({ error: 'Invalid token: missing role' });
      }
      const results = await runGlobalSearch(role, q);
      return res.json({ query: q, results });
    } catch (error: any) {
      console.error('search error:', error);
      return res.status(500).json({ error: error?.message || 'Search failed' });
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
        { expiresIn: JWT_EXPIRES_IN as any }
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

  // Finance: atomic journal entry creation
  app.post("/api/finance/journal", requireAuth, async (req: any, res: express.Response) => {
    const { entry, lines } = req.body;
    if (!entry || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ error: 'entry and lines required' });
    }
    try {
      const prisma = getPrisma();
      const number = `JV-${new Date().toISOString().replace(/[-T:]/g, '').slice(0, 15)}`;
      const result = await prisma.$transaction(async (tx) => {
        const created = await tx.journalEntry.create({
          data: { ...entry, number, createdAt: new Date() },
        });
        await tx.journalLine.createMany({
          data: lines.map((l: any) => ({ ...l, journalId: created.id })),
        });
        return created;
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Finance: account balances aggregated from journal lines
  app.get("/api/finance/balances", requireAuth, async (req: any, res: express.Response) => {
    const { period } = req.query as { period?: string };
    try {
      const prisma = getPrisma();
      const rows: { accountNumber: string; totalDebit: number; totalCredit: number }[] =
        await prisma.$queryRaw(
          period
            ? Prisma.sql`
                SELECT jl.accountNumber,
                       CAST(SUM(jl.debit) AS REAL) as totalDebit,
                       CAST(SUM(jl.credit) AS REAL) as totalCredit
                FROM JournalLine jl
                JOIN JournalEntry je ON je.id = jl.journalId
                WHERE je.period = ${period}
                GROUP BY jl.accountNumber`
            : Prisma.sql`
                SELECT jl.accountNumber,
                       CAST(SUM(jl.debit) AS REAL) as totalDebit,
                       CAST(SUM(jl.credit) AS REAL) as totalCredit
                FROM JournalLine jl
                GROUP BY jl.accountNumber`
        );
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/utilities/summary", requireAuth, async (req: any, res: express.Response) => {
    const { month, year } = req.query;
    try {
      const prisma = getPrisma();
      let where: Record<string, any> = {};
      if (month && year) {
        const startDate = new Date(Number(year), Number(month) - 1, 1);
        const endDate = new Date(Number(year), Number(month), 0, 23, 59, 59);
        where = {
          periodStart: { gte: startDate },
          periodEnd: { lte: endDate }
        };
      }
      const utilities = await prisma.utility.findMany({
        where,
        orderBy: { periodStart: 'desc' }
      });
      const grouped: Record<string, { total: number; count: number; status: Record<string, number> }> = {};
      utilities.forEach(util => {
        if (!grouped[util.type]) {
          grouped[util.type] = { total: 0, count: 0, status: { PENDING: 0, PAID: 0, OVERDUE: 0 } };
        }
        grouped[util.type].total += util.amount;
        grouped[util.type].count += 1;
        grouped[util.type].status[util.status] = (grouped[util.type].status[util.status] || 0) + 1;
      });
      res.json({
        period: month && year ? { month: Number(month), year: Number(year) } : null,
        total: utilities.reduce((sum, u) => sum + u.amount, 0),
        byType: grouped,
        utilities: utilities
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/db/utilities/generate-recurring", requireAuth, async (req: any, res: express.Response) => {
    const { definitionId } = req.body;
    if (!definitionId) {
      return res.status(400).json({ error: 'definitionId is required' });
    }

    try {
      const prisma = getPrisma();
      const definition = await prisma.utilityDefinition.findUnique({ where: { id: definitionId } });
      if (!definition || !definition.fixedPrice) {
        return res.status(400).json({ error: 'Definition not found or fixedPrice not set' });
      }

      const now = new Date();
      const startDate = definition.contractStartDate || now;
      const endDate = definition.contractEndDate || new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());

      const created = [];
      let current = new Date(startDate);

      while (current <= endDate) {
        const periodStart = new Date(current);
        let periodEnd = new Date(current);

        // Calculate period end based on frequency
        if (definition.frequency === 'MONTHLY') {
          periodEnd.setMonth(periodEnd.getMonth() + 1);
          periodEnd.setDate(0);
        } else if (definition.frequency === 'QUARTERLY') {
          periodEnd.setMonth(periodEnd.getMonth() + 3);
          periodEnd.setDate(0);
        } else if (definition.frequency === 'ANNUAL') {
          periodEnd.setFullYear(periodEnd.getFullYear() + 1);
          periodEnd.setDate(periodEnd.getDate() - 1);
        }

        // Calculate due date
        const dueDate = new Date(periodEnd);
        const dueDay = definition.dueDay || 31;
        if (dueDay < 31) {
          dueDate.setDate(dueDay);
        }

        // Check if utility for this period already exists
        const existing = await prisma.utility.findFirst({
          where: {
            definitionId,
            periodStart: {
              gte: new Date(periodStart.getFullYear(), periodStart.getMonth(), 1),
              lt: new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 1)
            }
          }
        });

        if (!existing) {
          const utility = await prisma.utility.create({
            data: {
              definitionId,
              type: definition.type,
              provider: definition.provider,
              periodStart,
              periodEnd,
              amount: definition.fixedPrice,
              dueDate,
              currency: 'DZD',
              status: 'PENDING'
            }
          });
          created.push(utility);
        }

        // Move to next period
        if (definition.frequency === 'MONTHLY') {
          current.setMonth(current.getMonth() + 1);
        } else if (definition.frequency === 'QUARTERLY') {
          current.setMonth(current.getMonth() + 3);
        } else if (definition.frequency === 'ANNUAL') {
          current.setFullYear(current.getFullYear() + 1);
        }
      }

      res.json({ created: created.length, utilities: created });
    } catch (error) {
      console.error('Error generating recurring utilities:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Generalized API routes for CRUD (Prisma bridge)
  app.get("/api/db/:collection", (req, res, next) => {
    if (PUBLIC_GET_COLLECTIONS.includes(req.params.collection)) return next();
    return requireAuth(req, res, next);
  }, requireCollectionAccess, async (req: express.Request, res: express.Response) => {
    const { collection } = req.params;
    const { where, orderBy, take, skip } = req.query;

    try {
      const model = getModel(collection);
      if (!model) return res.status(404).json({ error: `Collection ${collection} not found` });

      const parsedWhereRaw = parseWhereQuery(where);
      let parsedWhere =
        parsedWhereRaw != null ? deepNormalizePrismaWhere(parsedWhereRaw) : undefined;
      const includeDisabled =
        req.query.includeDisabled === '1' ||
        req.query.includeDisabled === 'true';
      if ((collection === 'rawMaterials' || collection === 'products') && !includeDisabled) {
        parsedWhere = {
          ...((parsedWhere as Record<string, unknown> | undefined) || {}),
          disabled: false,
        };
      }
      let takeLimit: number | undefined;
      if (take !== undefined && String(take).length > 0) {
        const n = parseInt(String(take), 10);
        if (!Number.isNaN(n) && n > 0)
          takeLimit = Math.min(n, config.QUERY_MAX_ITEMS);
      }
      let skipN: number | undefined;
      if (skip !== undefined && String(skip).length > 0) {
        const n = parseInt(String(skip), 10);
        if (!Number.isNaN(n) && n >= 0) skipN = n;
      }

      const cacheKey = CACHED_COLLECTIONS.has(collection)
        ? buildCacheKey(collection, { where: parsedWhere, orderBy, take: takeLimit, skip: skipN })
        : null;
      if (cacheKey) {
        const hit = await cacheGet(cacheKey);
        if (hit) return res.json(hit);
      }

      const rawData = await model.findMany({
        where: parsedWhere as object | undefined,
        orderBy: orderBy ? JSON.parse(orderBy as string) : undefined,
        ...(skipN != null ? { skip: skipN } : {}),
        ...(takeLimit != null ? { take: takeLimit } : {}),
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

      const finalData = collection === 'users'
        ? data.map(sanitizeUser)
        : collection === 'promotions'
          ? data.map((r: any) => hydratePromotionFromStored(r))
          : data;
      if (cacheKey) await cacheSet(cacheKey, finalData);
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

      const finalData = collection === 'users'
        ? sanitizeUser(data)
        : collection === 'promotions'
          ? hydratePromotionFromStored(data)
          : data;
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
        // Keep only fields supported by Prisma RawMaterial model.
        const allowedRawMaterialFields = ['id', 'name', 'category', 'unit', 'description', 'stock', 'currentStock', 'wasteQuantity', 'minStock', 'status', 'imageUrl', 'brand', 'expiryDate', 'disabled', 'createdAt', 'updatedAt'];
        Object.keys(dataToSave).forEach((key) => {
          if (!allowedRawMaterialFields.includes(key)) delete dataToSave[key];
        });
      }

      if (collection === 'promotions') {
        const preparedPromo = preparePromotionForPrisma(dataToSave);
        Object.keys(dataToSave).forEach((k) => delete dataToSave[k]);
        Object.assign(dataToSave, preparedPromo);
      }

      if (collection === 'fixedAssets') {
        const idKeep = dataToSave.id;
        const prepared = prepareFixedAssetForPrisma(dataToSave);
        Object.keys(dataToSave).forEach((k) => delete dataToSave[k]);
        Object.assign(dataToSave, prepared);
        if (idKeep) dataToSave.id = idKeep;
      }

      if (collection === 'fixedAssetMaintenances') {
        const idKeep = dataToSave.id;
        const prepared = prepareFixedAssetMaintenanceForPrisma(dataToSave);
        Object.keys(dataToSave).forEach((k) => delete dataToSave[k]);
        Object.assign(dataToSave, prepared);
        if (idKeep) dataToSave.id = idKeep;
      }

      if (collection === 'utilities') {
        const idKeep = dataToSave.id;
        const prepared = prepareUtilityForPrisma(dataToSave);
        Object.keys(dataToSave).forEach((k) => delete dataToSave[k]);
        Object.assign(dataToSave, prepared);
        if (idKeep) dataToSave.id = idKeep;
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

      // Must run after other collection transforms + stringify; guarantees matricule & Prisma types (compat clients omit matricule).
      if (collection === 'financialEmployees') {
        const rowId = dataToSave.id != null ? String(dataToSave.id) : undefined;
        const preparedFe = prepareFinancialEmployeeForPrisma({ ...dataToSave, id: rowId }, rowId);
        Object.keys(dataToSave).forEach((k) => delete dataToSave[k]);
        Object.assign(dataToSave, pickFinancialEmployeeWriteData(preparedFe));
        if (rowId) dataToSave.id = rowId;
      }

      const data =
        collection === 'fixedAssets' || collection === 'fixedAssetMaintenances'
          ? await createWithUnknownArgRetry(model, dataToSave)
          : await model.create({ data: dataToSave });
      const result = unwrapDataIfNeeded(collection, data);

      // Invalidate cache for affected collections
      if (CACHED_COLLECTIONS.has(collection)) await cacheInvalidate(collection);
      if (INVALIDATES_RAW_MATERIALS.has(collection)) await cacheInvalidate('rawMaterials');
      if (collection === 'batches') await cacheInvalidate('products');

      // For purchases, return original data merged with saved data
      if (collection === 'purchases') {
        res.json({ ...originalData, ...result, id: result.id });
      } else {
        const payload = collection === 'users'
          ? sanitizeUser(result)
          : collection === 'promotions'
            ? hydratePromotionFromStored(result)
            : result;
        res.json(payload);
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
        // Keep only fields supported by Prisma RawMaterial model.
        const allowedRawMaterialFields = ['name', 'category', 'unit', 'description', 'stock', 'currentStock', 'wasteQuantity', 'minStock', 'status', 'imageUrl', 'brand', 'expiryDate', 'disabled', 'createdAt', 'updatedAt'];
        Object.keys(dataToSave).forEach((key) => {
          if (!allowedRawMaterialFields.includes(key)) delete dataToSave[key];
        });
      }

      if (collection === 'promotions') {
        const preparedPromo = preparePromotionForPrisma(dataToSave);
        Object.keys(dataToSave).forEach((k) => delete dataToSave[k]);
        Object.assign(dataToSave, preparedPromo);
      }

      if (collection === 'fixedAssets') {
        const prepared = prepareFixedAssetForPrisma(dataToSave);
        Object.keys(dataToSave).forEach((k) => delete dataToSave[k]);
        Object.assign(dataToSave, prepared);
        delete dataToSave.id;
      }

      if (collection === 'fixedAssetMaintenances') {
        const prepared = prepareFixedAssetMaintenanceForPrisma(dataToSave);
        Object.keys(dataToSave).forEach((k) => delete dataToSave[k]);
        Object.assign(dataToSave, prepared);
        delete dataToSave.id;
      }

      if (collection === 'utilities') {
        const prepared = prepareUtilityForPrisma(dataToSave);
        Object.keys(dataToSave).forEach((k) => delete dataToSave[k]);
        Object.assign(dataToSave, prepared);
        delete dataToSave.id;
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

      if (collection === 'financialEmployees') {
        const preparedFe = prepareFinancialEmployeeForPrisma({ ...dataToSave, id }, id);
        Object.keys(dataToSave).forEach((k) => delete dataToSave[k]);
        Object.assign(dataToSave, pickFinancialEmployeeWriteData(preparedFe));
        delete dataToSave.id;
      }

      const existing = await model.findUnique({ where: { id } });
      let data;
      if (existing) {
        data =
          collection === 'fixedAssets' || collection === 'fixedAssetMaintenances'
            ? await updateWithUnknownArgRetry(model, id, dataToSave)
            : await model.update({
                where: { id },
                data: dataToSave
              });
      } else {
        data =
          collection === 'fixedAssets' || collection === 'fixedAssetMaintenances'
            ? await createWithUnknownArgRetry(model, { ...dataToSave, id })
            : await model.create({
                data: { ...dataToSave, id }
              });
      }
      const result = unwrapDataIfNeeded(collection, data);

      // Bust the permissions cache when an admin updates a rolePermission row
      if (collection === 'rolePermissions') invalidatePermissionsCache(id);

      // Invalidate cache for affected collections
      if (CACHED_COLLECTIONS.has(collection)) await cacheInvalidate(collection);
      if (INVALIDATES_RAW_MATERIALS.has(collection)) await cacheInvalidate('rawMaterials');
      if (collection === 'batches') await cacheInvalidate('products');

      // For purchases, return original data merged with saved data
      if (collection === 'purchases') {
        res.json({ ...originalData, ...result, id: result.id });
      } else {
        const payload = collection === 'users'
          ? sanitizeUser(result)
          : collection === 'promotions'
            ? hydratePromotionFromStored(result)
            : result;
        res.json(payload);
      }
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.delete("/api/db/:collection/:id", requireAuth, requireCollectionAccess, async (req, res) => {
    const { collection, id } = req.params;
    try {
      if (collection === "purchases") {
        const prisma = getPrisma();
        const invoice = await prisma.supplierInvoice.findUnique({ where: { id } });
        if (!invoice) return res.status(404).json({ error: "Purchase not found" });

        let details: { materialId?: string; quantity?: number } = {};
        if (invoice.amountHT) {
          try {
            details = typeof invoice.amountHT === "string" ? JSON.parse(invoice.amountHT) : invoice.amountHT;
          } catch {
            return res.status(400).json({ error: "Invalid purchase payload" });
          }
        }

        const materialId = details.materialId;
        const quantity = Number(details.quantity) || 0;
        if (!materialId) {
          await prisma.supplierInvoice.delete({ where: { id } });
          return res.json({ success: true });
        }

        const mat = await prisma.rawMaterial.findUnique({ where: { id: materialId } });
        const current = mat?.currentStock ?? 0;
        if (current < quantity - 1e-6) {
          return res.status(409).json({
            error: `Cannot delete: removing ${quantity} ${mat?.unit || "units"} would leave insufficient stock (${current} on hand).`,
          });
        }

        await prisma.$transaction(async (tx) => {
          const row = await tx.rawMaterial.findUnique({ where: { id: materialId } });
          if (!row || (row.currentStock ?? 0) < quantity - 1e-6) {
            throw new Error("STOCK_GUARD");
          }
          await tx.supplierInvoice.delete({ where: { id } });
          const next = (row.currentStock ?? 0) - quantity;
          const baseline = Number((row as { stock?: number }).stock ?? row.currentStock ?? 0);
          const nextStock = baseline - quantity;
          await tx.rawMaterial.update({
            where: { id: materialId },
            data: { currentStock: next, stock: nextStock } as Prisma.RawMaterialUncheckedUpdateInput,
          });
        });
        await cacheInvalidate('rawMaterials');
        return res.json({ success: true });
      }

      const model = getModel(collection);
      if (!model) return res.status(404).json({ error: `Collection ${collection} not found` });

      await model.delete({ where: { id } });
      if (CACHED_COLLECTIONS.has(collection)) await cacheInvalidate(collection);
      if (INVALIDATES_RAW_MATERIALS.has(collection)) await cacheInvalidate('rawMaterials');
      if (collection === 'batches') await cacheInvalidate('products');
      res.json({ success: true });
    } catch (error) {
      const msg = (error as Error).message;
      if (msg === "STOCK_GUARD") {
        return res.status(409).json({
          error: "Cannot delete: insufficient stock to remove this purchase line.",
        });
      }
      res.status(500).json({ error: msg });
    }
  });

  // Tax & IFU Declaration Endpoints
  app.get("/api/tax/ifu-declarations", requireAuth, async (req: any, res: express.Response) => {
    try {
      const prisma = getPrisma();
      const year = req.query.year ? parseInt(String(req.query.year), 10) : undefined;
      const where = year ? { year } : {};
      const declarations = await prisma.ifuDeclaration.findMany({ where });
      res.json(declarations);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get("/api/tax/ifu-declarations/:id", requireAuth, async (req: any, res: express.Response) => {
    try {
      const prisma = getPrisma();
      const declaration = await prisma.ifuDeclaration.findUnique({ where: { id: req.params.id } });
      if (!declaration) return res.status(404).json({ error: 'Declaration not found' });
      res.json(declaration);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/tax/ifu-declarations", requireAuth, async (req: any, res: express.Response) => {
    try {
      const prisma = getPrisma();
      const { year, grossTurnover, taxRatePercent, taxAmountDue, monthlyBreakdown, status } = req.body;

      if (!year || grossTurnover === undefined || !taxRatePercent) {
        return res.status(400).json({ error: 'Missing required fields: year, grossTurnover, taxRatePercent' });
      }

      const existing = await prisma.ifuDeclaration.findFirst({ where: { year, version: 1 } });
      if (existing) {
        return res.status(409).json({ error: `Declaration for year ${year} already exists` });
      }

      const declaration = await prisma.ifuDeclaration.create({
        data: {
          year,
          version: 1,
          grossTurnover: Number(grossTurnover),
          taxRatePercent: Number(taxRatePercent),
          taxAmountDue: Number(taxAmountDue || 0),
          monthlyBreakdown: monthlyBreakdown ? JSON.stringify(monthlyBreakdown) : null,
          status: status || 'BROUILLON',
        },
      });
      res.json(declaration);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.put("/api/tax/ifu-declarations/:id", requireAuth, async (req: any, res: express.Response) => {
    try {
      const prisma = getPrisma();
      const { grossTurnover, taxRatePercent, taxAmountDue, monthlyBreakdown } = req.body;

      const decl = await prisma.ifuDeclaration.findUnique({ where: { id: req.params.id } });
      if (!decl) return res.status(404).json({ error: 'Declaration not found' });
      if (decl.status !== 'BROUILLON') return res.status(409).json({ error: 'Only BROUILLON declarations can be updated' });

      const updates: any = {};
      if (grossTurnover !== undefined) updates.grossTurnover = Number(grossTurnover);
      if (taxRatePercent !== undefined) updates.taxRatePercent = Number(taxRatePercent);
      if (taxAmountDue !== undefined) updates.taxAmountDue = Number(taxAmountDue);
      if (monthlyBreakdown !== undefined) updates.monthlyBreakdown = JSON.stringify(monthlyBreakdown);

      const declaration = await prisma.ifuDeclaration.update({
        where: { id: req.params.id },
        data: updates,
      });
      res.json(declaration);
    } catch (error) {
      const msg = (error as Error).message;
      if (msg.includes('not found')) {
        return res.status(404).json({ error: 'Declaration not found' });
      }
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/tax/ifu-declarations/:id/submit", requireAuth, async (req: any, res: express.Response) => {
    try {
      const prisma = getPrisma();
      const { submissionReference } = req.body;

      const declaration = await prisma.ifuDeclaration.findUnique({ where: { id: req.params.id } });
      if (!declaration) return res.status(404).json({ error: 'Declaration not found' });
      if (declaration.status !== 'BROUILLON') return res.status(409).json({ error: 'Only BROUILLON declarations can be submitted' });

      const taxConfig = await prisma.taxConfig.findFirst({
        where: { type: 'IFU_RATE', year: declaration.year },
        orderBy: { createdAt: 'desc' },
      });

      let configSnapshot: string | null = null;
      if (taxConfig) {
        configSnapshot = JSON.stringify({
          taxRatePercent: taxConfig.ratePercent,
          year: declaration.year,
          description: taxConfig.description,
          snapshotDate: new Date().toISOString(),
          system: 'bella-dolce-v1.0',
        });
      }

      const submitted = await prisma.ifuDeclaration.update({
        where: { id: req.params.id },
        data: {
          status: 'SOUMIS',
          submittedAt: new Date(),
          submissionReference: submissionReference || null,
          configSnapshot,
        },
      });
      res.json(submitted);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/tax/ifu-declarations/:id/amend", requireAuth, async (req: any, res: express.Response) => {
    try {
      const prisma = getPrisma();

      const source = await prisma.ifuDeclaration.findUnique({ where: { id: req.params.id } });
      if (!source) return res.status(404).json({ error: 'Declaration not found' });
      if (source.status !== 'SOUMIS') return res.status(409).json({ error: 'Only SOUMIS declarations can be amended' });

      const newDecl = await prisma.ifuDeclaration.create({
        data: {
          year: source.year,
          version: source.version + 1,
          grossTurnover: source.grossTurnover,
          taxRatePercent: source.taxRatePercent,
          taxAmountDue: source.taxAmountDue,
          monthlyBreakdown: source.monthlyBreakdown,
          amendmentOf: source.id,
          status: 'BROUILLON',
        },
      });
      res.json(newDecl);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Tax Configuration Endpoints
  app.get("/api/admin/tax-config", requireAuth, async (req: any, res: express.Response) => {
    try {
      const prisma = getPrisma();
      const type = req.query.type || 'IFU_RATE';
      const year = req.query.year ? parseInt(String(req.query.year), 10) : undefined;

      const where: any = { type };
      if (year) where.year = year;

      const configs = await prisma.taxConfig.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });
      res.json(configs);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/admin/tax-config", requireAuth, async (req: any, res: express.Response) => {
    try {
      const prisma = getPrisma();
      const { type, year, ratePercent, description, effectiveFrom, effectiveUntil } = req.body;

      if (!type || ratePercent === undefined) {
        return res.status(400).json({ error: 'Missing required fields: type, ratePercent' });
      }

      const config = await prisma.taxConfig.create({
        data: {
          type,
          year: year ? Number(year) : null,
          ratePercent: Number(ratePercent),
          description: description || null,
          effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : null,
          effectiveUntil: effectiveUntil ? new Date(effectiveUntil) : null,
          createdBy: req.user?.id,
        },
      });
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Atomic POS sale endpoint — creates sale + deducts stock in a single transaction
  app.post("/api/sale", requireAuth, async (req: any, res) => {
    const { customerId, totalAmount, amountPaid, change, paymentMethod, items, comment, returnComment } = req.body;
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

        // Stock validation and deduction are handled client-side via Firestore.
        // SQLite is used only for recording the sale transaction.

        // Compute discount
        const paid = amountPaid ?? 0;
        const discount = paid === 0 ? totalAmount : (totalAmount > paid ? totalAmount - paid : 0);

        // Create sale record
        return await tx.sale.create({
          data: {
            cashierId,
            cashierName,
            customerId: customerId || null,
            totalAmount,
            amountPaid,
            change,
            paymentMethod,
            items: JSON.stringify(items),
            discount: discount > 0 ? discount : null,
            comment: comment || null,
            returnComment: returnComment || null
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

 
  app.post("/api/print-receipt", requireAuth, async (req: any, res) => {
    const isProduction = process.env.NODE_ENV === 'production';
    const PRINT_AGENT_URL = isProduction ? config.PRINT_AGENT_URL_PROD : config.PRINT_AGENT_URL_DEV;
    const PRINT_AGENT_TIMEOUT = config.PRINT_AGENT_TIMEOUT;
    const { saleId, items, total, amountPaid, change, paymentMethod, receiptNumber, cashierName, printLanguage } = req.body;

    if (!saleId) {
      return res.status(400).json({ error: 'saleId is required' });
    }

    // Health check
    try {
      const healthCheck = await fetch(`${PRINT_AGENT_URL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(PRINT_AGENT_TIMEOUT)
      });

      if (!healthCheck.ok) {
        console.warn('Print Agent health check failed:', healthCheck.status);
        return res.json({ status: 'error', message: 'printer_unavailable' });
      }
    } catch (error) {
      console.warn('Print Agent unreachable:', error);
      return res.json({ status: 'error', message: 'printer_unavailable' });
    }

    // Translate comment based on printLanguage
    let translatedComment = '';
    let translatedCommentFR = '';
    let translatedCommentAR = '';
    const printLang = printLanguage || config.PRINT_LANGUAGE || 'BOTH';

    if (printLang === 'BOTH') {
      if (amountPaid === 0) {
        translatedCommentFR = 'Gratuit';
        translatedCommentAR = 'مجاني';
      } else if (total > amountPaid) {
        const discount = total - amountPaid;
        translatedCommentFR = `Remise DA ${discount.toFixed(0)}`;
        translatedCommentAR = `خصم دج`;
      }
    } else if (printLang === 'FR') {
      if (amountPaid === 0) {
        translatedCommentFR = 'Gratuit';
      } else if (total > amountPaid) {
        const discount = total - amountPaid;
        translatedCommentFR = `Remise DA ${discount.toFixed(0)}`;
      }
      translatedCommentAR = '';
    } else if (printLang === 'AR') {
      if (amountPaid === 0) {
        translatedCommentAR = 'مجاني';
      } else if (total > amountPaid) {
        const discount = total - amountPaid;
        translatedCommentAR = `خصم دج ${discount.toFixed(0)}`;
      }
      translatedCommentFR = '';
    }

    // Send print job
    try {
      const printResponse = await fetch(`${PRINT_AGENT_URL}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          SaleId: saleId,
          ReceiptNumber: receiptNumber || '',
          Date: new Date().toISOString().split('T')[0],
          Time: new Date().toTimeString().split(' ')[0],
          CashierName: req.body.cashierName || req.user?.username || 'Unknown',
          PaymentMethod: paymentMethod || 'cash',
          Items: (items || []).map((item: any) => ({
            Name: item.name,
            Quantity: item.quantity,
            UnitPrice: item.unitPrice || item.price || 0,
            LineTotal: item.lineTotal || (item.quantity * (item.unitPrice || item.price || 0))
          })),
          Subtotal: total || 0,
          TaxRate: 0,
          TaxAmount: 0,
          Total: total || 0,
          AmountPaid: amountPaid || 0,
          ChangeGiven: change || 0,
          ProductCount: (items || []).length,
          UnitCount: (items || []).reduce((sum: number, item: any) => sum + (item.quantity || 0), 0),
          Comment: translatedComment,
          CommentFR: translatedCommentFR,
          CommentAR: translatedCommentAR,
          PrintLanguage: printLang
        })
      });

      const result = await printResponse.json();
      console.log('Print Agent response:', result);
      return res.json(result);

    } catch (error) {
      console.error('Print job failed:', error);
      return res.json({ status: 'error', message: 'print_failed' });
    }
  });

  app.get("/api/sales", requireAuth, async (req: any, res) => {
    try {
      const prisma = getPrisma();
      const { date, cashierId, limit = config.QUERY_MAX_ITEMS, sort = 'desc', from, to } = req.query;

      const userRole: string = (req.user?.role ?? '').trim();
      const canSeeAll = userRole === 'admin' || userRole === 'manager';

      const where: any = {};

      if (from || to) {
        where.createdAt = {};
        if (from) {
          const start = new Date(from as string);
          start.setHours(0, 0, 0, 0);
          where.createdAt.gte = start;
        }
        if (to) {
          const end = new Date(to as string);
          end.setHours(23, 59, 59, 999);
          where.createdAt.lte = end;
        }
      } else if (date) {
        const startOfDay = new Date(date as string);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date as string);
        endOfDay.setHours(23, 59, 59, 999);

        where.createdAt = {
          gte: startOfDay,
          lte: endOfDay
        };
      }

      // Non-admin/manager roles can only see their own sales
      if (!canSeeAll) {
        where.cashierId = req.user.id;
      } else if (cashierId) {
        where.cashierId = cashierId;
      }

      // When a date range is provided, fetch all matching records (no cap)
      const takeOption = (from || to) ? undefined : Math.min(parseInt(limit as string) || config.QUERY_MAX_ITEMS, config.QUERY_MAX_ITEMS);

      const sales = await prisma.sale.findMany({
        where,
        orderBy: { createdAt: sort === 'asc' ? 'asc' : 'desc' },
        ...(takeOption !== undefined ? { take: takeOption } : {})
      });

      const hasQueryFilters = date || cashierId;
      res.json(hasQueryFilters ? { sales } : sales);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/events", requireAuth, async (req: any, res) => {
    try {
      const prisma = getPrisma();
      const { type, message, collection, operation } = req.body;
      if (!type || !message) return res.status(400).json({ error: 'type and message required' });
      const event = await prisma.event.create({
        data: { userId: req.user.id, type, message, collection, operation }
      });
      res.json({ id: event.id });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get("/api/events", requireAuth, async (req: any, res) => {
    try {
      const prisma = getPrisma();
      const events = await prisma.event.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        take: config.QUERY_MAX_ITEMS,
      });
      res.json(events);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.delete("/api/events", requireAuth, async (req: any, res) => {
    try {
      const prisma = getPrisma();
      const { count } = await prisma.event.deleteMany({ where: { userId: req.user.id } });
      res.json({ count });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get("/api/products/category-usage", requireAuth, async (req: any, res) => {
    try {
      const prisma = getPrisma();
      const { name } = req.query;
      if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name required' });
      const count = await prisma.product.count({ where: { category: name } });
      res.json({ count });
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

  function normalizeRawMaterialKey(value: string | null | undefined): string {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  /** Merge duplicate RawMaterial rows and hide deleted/duplicate rows from operational flows. Admin only. */
  app.post("/api/admin/cleanup-raw-materials", requireAuth, async (req: any, res) => {
    if (req.user?.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }

    const dryRun = req.query.dryRun === "1" || req.query.dryRun === "true" || req.body?.dryRun !== false;

    try {
      const prisma = getPrisma();
      const materials = await prisma.rawMaterial.findMany({
        orderBy: [{ disabled: "asc" }, { updatedAt: "desc" }, { createdAt: "desc" }],
      });
      const groups = new Map<string, typeof materials>();

      for (const m of materials) {
        const key = [
          normalizeRawMaterialKey(m.name),
          normalizeRawMaterialKey(m.unit),
          normalizeRawMaterialKey(m.category),
        ].join("|");
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(m);
      }

      const duplicateGroups = [...groups.values()].filter((rows) => rows.length > 1);
      const summary: {
        key: string;
        keepId: string;
        keepName: string;
        duplicateIds: string[];
      }[] = [];
      let updatedPurchases = 0;
      let updatedStockMovements = 0;
      let updatedRecipes = 0;
      let updatedBatches = 0;
      let disabledDuplicates = 0;

      for (const rows of duplicateGroups) {
        const activeRows = rows.filter((m) => !m.disabled);
        const keep = activeRows[0] || rows[0];
        const duplicates = rows.filter((m) => m.id !== keep.id);
        const duplicateIds = new Set(duplicates.map((m) => m.id));

        summary.push({
          key: [
            normalizeRawMaterialKey(keep.name),
            normalizeRawMaterialKey(keep.unit),
            normalizeRawMaterialKey(keep.category),
          ].join("|"),
          keepId: keep.id,
          keepName: keep.name,
          duplicateIds: [...duplicateIds],
        });

        if (dryRun) continue;

        await prisma.$transaction(async (tx) => {
          const invoices = await tx.supplierInvoice.findMany();
          for (const inv of invoices) {
            const details = parseDbJsonField<Record<string, unknown>>(inv.amountHT, {});
            const materialId = typeof details.materialId === "string" ? details.materialId : "";
            if (!duplicateIds.has(materialId)) continue;
            details.materialId = keep.id;
            details.materialName = keep.name;
            details.unit = keep.unit;
            await tx.supplierInvoice.update({
              where: { id: inv.id },
              data: { amountHT: JSON.stringify(details) },
            });
            updatedPurchases += 1;
          }

          const stockResult = await tx.stockMovement.updateMany({
            where: { itemId: { in: [...duplicateIds] }, itemType: "material" },
            data: { itemId: keep.id, itemName: keep.name },
          });
          updatedStockMovements += stockResult.count;

          const recipes = await tx.recipe.findMany();
          for (const recipe of recipes) {
            const rawIngredients = parseDbJsonField<unknown>(recipe.ingredients, []);
            if (!Array.isArray(rawIngredients)) continue;
            let changed = false;
            const nextIngredients = rawIngredients.map((ing: any) => {
              if (ing && duplicateIds.has(String(ing.materialId || ""))) {
                changed = true;
                return { ...ing, materialId: keep.id };
              }
              return ing;
            });
            if (!changed) continue;
            await tx.recipe.update({
              where: { id: recipe.id },
              data: { ingredients: JSON.stringify(nextIngredients) },
            });
            updatedRecipes += 1;
          }

          const batches = await tx.productionBatch.findMany();
          for (const batch of batches) {
            const rawIngredients = parseDbJsonField<unknown>(batch.ingredients, []);
            if (!Array.isArray(rawIngredients)) continue;
            let changed = false;
            const nextIngredients = rawIngredients.map((ing: any) => {
              if (ing && duplicateIds.has(String(ing.materialId || ""))) {
                changed = true;
                return { ...ing, materialId: keep.id };
              }
              return ing;
            });
            if (!changed) continue;
            await tx.productionBatch.update({
              where: { id: batch.id },
              data: { ingredients: JSON.stringify(nextIngredients) },
            });
            updatedBatches += 1;
          }

          const stockSum = rows
            .filter((m) => !m.disabled)
            .reduce((sum, m) => sum + (Number(m.currentStock) || 0), 0);
          const stock = normalizeReconciledStock(keep.unit, stockSum);
          await tx.rawMaterial.update({
            where: { id: keep.id },
            data: { currentStock: stock, stock, disabled: false, updatedAt: new Date() },
          });
          const disabledResult = await tx.rawMaterial.updateMany({
            where: { id: { in: [...duplicateIds] } },
            data: { disabled: true, currentStock: 0, stock: 0, updatedAt: new Date() },
          });
          disabledDuplicates += disabledResult.count;
        });
      }

      res.json({
        dryRun,
        duplicateGroups: summary.length,
        duplicates: summary,
        updatedPurchases,
        updatedStockMovements,
        updatedRecipes,
        updatedBatches,
        disabledDuplicates,
        note: dryRun ? "Dry run only. Send { dryRun: false } to apply." : "Cleanup applied.",
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

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
    app.use('/belladolce', express.static(distPath));
    app.get('/belladolce', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    app.get('/belladolce/*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    app.get('/', (_req, res) => res.redirect('/belladolce'));
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

      const itemCategoriesSetting = await prisma.setting.findUnique({ where: { id: 'item_categories' } });
      if (!itemCategoriesSetting) {
        console.log("Seeding default item categories...");
        await prisma.setting.create({
          data: {
            id: 'item_categories',
            data: JSON.stringify({
              product: ['boulangerie', 'patisserie', 'viennoiserie', 'boissons', 'emballages'],
              rawMaterial: ['kitchen'],
              consumable: ['maintenance', 'cleaning', 'others']
            })
          }
        });
      }


      // Normalize legacy product stock buckets once at startup:
      // if shopStock was never populated, derive it from total stock.
      try {
        const allProducts = await prisma.product.findMany({
          select: {
            id: true,
            stock: true,
            shopStock: true as any,
            freezerStock: true as any,
            wasteQuantity: true as any,
          } as any,
        } as any);
        for (const p of allProducts as any[]) {
          const total = Number(p.stock || 0);
          const freezer = Number(p.freezerStock || 0);
          const waste = Number(p.wasteQuantity || 0);
          const hasShop = typeof p.shopStock === "number" && Number.isFinite(p.shopStock);
          const shop = hasShop ? Number(p.shopStock) : Math.max(0, total - freezer - waste);
          const normalizedTotal = Math.max(0, shop) + Math.max(0, freezer) + Math.max(0, waste);
          await prisma.product.update({
            where: { id: p.id },
            data: {
              shopStock: Math.max(0, shop),
              freezerStock: Math.max(0, freezer),
              wasteQuantity: Math.max(0, waste),
              stock: normalizedTotal,
            } as any,
          });
        }
      } catch (e) {
        console.warn("Product stock normalization skipped:", (e as Error).message);
      }

    } catch (error) {
      console.error("Error during auto-seeding:", error);
    }

    const scheduleNextPromotionExpiryPass = () => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 0, 0);
      const delayMs = Math.max(1_000, nextMidnight.getTime() - now.getTime());

      setTimeout(async () => {
        try {
          const prisma = getPrisma();
          const nowAtRun = new Date();
          await prisma.promotion.updateMany({
            where: {
              active: true,
              expiryDate: { lte: nowAtRun },
            },
            data: {
              active: false,
            },
          });
        } catch (e) {
          console.error("Promotion midnight expiry job failed:", e);
        } finally {
          scheduleNextPromotionExpiryPass();
        }
      }, delayMs);
    };

    scheduleNextPromotionExpiryPass();

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
