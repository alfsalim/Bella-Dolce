import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || "bella-dolce-secret-change-in-production";
const SALT_ROUNDS = 10;

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

// Role-based collection access control
const COLLECTION_ROLES: Record<string, string[]> = {
  users:               ['admin'],
  rolePermissions:     ['admin'],
  system:              ['admin'],
  activityLogs:        ['admin', 'manager'],
  accounts:            ['admin', 'manager'],
  journalEntries:      ['admin', 'manager'],
  journalLines:        ['admin', 'manager'],
  payrollRuns:         ['admin', 'manager'],
  payslips:            ['admin', 'manager'],
  cashReconciliations: ['admin', 'manager'],
  budgets:             ['admin', 'manager'],
  riskSnapshots:       ['admin', 'manager'],
  supplierInvoices:    ['admin', 'manager'],
  customerInvoices:    ['admin', 'manager'],
  fixedAssets:         ['admin', 'manager'],
  financialEmployees:  ['admin', 'manager'],
  suppliers:           ['admin', 'manager'],
  deliveries:          ['admin', 'manager'],
  promotions:          ['admin', 'manager'],
  settings:            ['admin', 'manager'],
  products:            ['admin', 'manager', 'cashier', 'baker'],
  rawMaterials:        ['admin', 'manager', 'baker'],
  recipes:             ['admin', 'manager', 'baker'],
  batches:             ['admin', 'manager', 'baker'],
  stockMovements:      ['admin', 'manager', 'baker'],
  sales:               ['admin', 'manager', 'cashier'],
  customers:           ['admin', 'manager', 'cashier'],
  orders:              ['admin', 'manager', 'cashier'],
};

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);
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
    
    // Skip role check for public routes (access is already gated by requireAuth usage in routes)
    if (method === 'GET' && PUBLIC_GET_COLLECTIONS.includes(collection)) return next();
    if (method === 'POST' && PUBLIC_POST_COLLECTIONS.includes(collection)) return next();
    if (method === 'PUT' && PUBLIC_PUT_COLLECTIONS.includes(collection)) return next();

    const userRole: string = req.user?.role || '';
    const allowed = COLLECTION_ROLES[collection];
    if (!allowed) return next();
    if (userRole === 'admin' || allowed.includes(userRole)) return next();
    return res.status(403).json({ error: 'Forbidden: insufficient role' });
  }

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
      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: '8h' }
      );
      res.json({ user: sanitizeUser(user), token });
    } catch (error) {
      console.error("Login route error:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    const { username, password, name, email, role } = req.body;
    console.log(`Register attempt for email: ${email}`);
    try {
      const prisma = getPrisma();
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
      const user = await prisma.user.create({
        data: {
          username,
          password: hashedPassword,
          name,
          email,
          role: role || 'cashier',
          status: 'active'
        }
      });
      console.log(`Registration successful for: ${email}`);
      res.json({ user: sanitizeUser(user) });
    } catch (error) {
      console.error("Register route error:", error);
      res.status(500).json({ error: (error as Error).message });
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

      const rawData = await model.findMany({
        where: where ? JSON.parse(where as string) : undefined,
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
      for (const key in dataToSave) {
        if (dataToSave[key] !== null && typeof dataToSave[key] === 'object') {
          dataToSave[key] = JSON.stringify(dataToSave[key]);
        }
      }

      const data = await model.create({ data: dataToSave });
      const result = unwrapDataIfNeeded(collection, data);
      res.json(collection === 'users' ? sanitizeUser(result) : result);
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
      for (const key in dataToSave) {
        if (dataToSave[key] !== null && typeof dataToSave[key] === 'object') {
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
      res.json(collection === 'users' ? sanitizeUser(result) : result);
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
    const { cashierId, customerId, totalAmount, paymentMethod, items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items in sale' });
    }
    try {
      const prisma = getPrisma();

      const result = await prisma.$transaction(async (tx) => {
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

  // Vite middleware for development
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

  app.listen(PORT, "0.0.0.0", async () => {
    console.log(`Server running on http://localhost:${PORT}`);

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
  });
}

startServer();
