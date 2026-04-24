import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    'promotions': prisma.promotion
  };
  return mapping[collectionName];
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

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
            { username: username }, // Fallback for case-sensitive matches if any
            { email: username }
          ]
        }
      });

      if (!user) {
        console.log(`User not found: ${username}`);
        return res.status(401).json({ error: "Invalid username or password" });
      }

      // Simple password check (should be hashed in production)
      if (user.password !== password) {
        console.log(`Invalid password for user: ${username}`);
        return res.status(401).json({ error: "Invalid username or password" });
      }

      console.log(`Login successful for user: ${username}`);
      res.json(user);
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
      const user = await prisma.user.create({
        data: {
          username,
          password,
          name,
          email,
          role: role || 'cashier',
          status: 'active'
        }
      });
      console.log(`Registration successful for: ${email}`);
      res.json(user);
    } catch (error) {
      console.error("Register route error:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Generalized API routes for CRUD (Prisma bridge)
  app.get("/api/db/:collection", async (req, res) => {
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

      // Auto-parse JSON strings back to objects for the client
      const data = rawData.map((item: any) => {
        const parsedItem = { ...item };
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

      res.json(data);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get("/api/db/:collection/:id", async (req, res) => {
    const { collection, id } = req.params;
    try {
      const model = getModel(collection);
      if (!model) return res.status(404).json({ error: `Collection ${collection} not found` });

      const rawData = await model.findUnique({ where: { id } });
      if (!rawData) return res.json(null);

      // Auto-parse JSON strings back to objects for the client
      const data = { ...rawData };
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

      res.json(data);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/db/:collection", async (req, res) => {
    const { collection } = req.params;
    try {
      const model = getModel(collection);
      if (!model) return res.status(404).json({ error: `Collection ${collection} not found` });

      // Auto-stringify objects for SQLite String-based JSON fields
      const dataToSave = { ...req.body };
      for (const key in dataToSave) {
        if (dataToSave[key] !== null && typeof dataToSave[key] === 'object') {
          dataToSave[key] = JSON.stringify(dataToSave[key]);
        }
      }

      const data = await model.create({ data: dataToSave });
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.put("/api/db/:collection/:id", async (req, res) => {
    const { collection, id } = req.params;
    try {
      const model = getModel(collection);
      if (!model) return res.status(404).json({ error: `Collection ${collection} not found` });

      // Auto-stringify objects for SQLite String-based JSON fields
      const dataToSave = { ...req.body };
      for (const key in dataToSave) {
        if (dataToSave[key] !== null && typeof dataToSave[key] === 'object') {
          dataToSave[key] = JSON.stringify(dataToSave[key]);
        }
      }

      const data = await model.upsert({
        where: { id },
        update: dataToSave,
        create: { ...dataToSave, id }
      });
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.delete("/api/db/:collection/:id", async (req, res) => {
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
    
    // Auto-seed admin user if missing
    try {
      const prisma = getPrisma();
      
      // Check for specific admin user
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
            password: 'password',
            name: 'Administrator',
            email: 'admin@bakery.local',
            role: 'admin',
            status: 'active'
          }
        });
        console.log("Default admin ensured: admin / password");
      } else {
        console.log("Admin user already exists.");
      }

      // Also ensure basic role permissions exist in Firestore if needed, 
      // but here we are using Prisma for users.
      
    } catch (error) {
      console.error("Error during auto-seeding:", error);
    }
  });
}

startServer();
