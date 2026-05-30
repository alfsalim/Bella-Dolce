import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

const DEFAULT_ROLE_PERMISSIONS: { id: string; allowedPaths: string[] }[] = [
  { id: "admin", allowedPaths: ["*"] },
  {
    id: "manager",
    allowedPaths: [
      "/dashboard",
      "/production",
      "/inventory",
      "/procurement",
      "/customers",
      "/product-management",
      "/pos",
      "/b2b",
      "/orders",
      "/finance",
      "/reports",
      "/settings",
    ],
  },
  { id: "cashier", allowedPaths: ["/pos", "/orders"] },
  { id: "baker", allowedPaths: ["/production", "/inventory"] },
  { id: "inventory", allowedPaths: ["/inventory", "/product-management"] },
  { id: "delivery_guy", allowedPaths: ["/orders"] },
  { id: "customer_business", allowedPaths: ["/b2b"] },
  { id: "customer_customers", allowedPaths: ["/pos"] },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is missing. Copy .env.example to .env and set DATABASE_URL (e.g. file:./prisma/dev.db)."
    );
  }

  const existingUser = await prisma.user.findFirst();
  if (existingUser) {
    console.log("DB already has data — skipping seed.");
    return;
  }

  await prisma.user.upsert({
    where: { id: "admin-001" },
    update: {},
    create: {
      id: "admin-001",
      username: "admin",
      password: await bcrypt.hash("password", SALT_ROUNDS),
      name: "Administrator",
      email: "admin@bakery.local",
      role: "admin",
      status: "active",
    },
  });

  for (const rp of DEFAULT_ROLE_PERMISSIONS) {
    const existing = await prisma.rolePermission.findUnique({ where: { id: rp.id } });
    if (!existing) {
      await prisma.rolePermission.create({
        data: { id: rp.id, allowedPaths: JSON.stringify(rp.allowedPaths) },
      });
    }
  }

  await prisma.setting.upsert({
    where: { id: "categories" },
    update: {},
    create: {
      id: "categories",
      data: JSON.stringify({ list: ["Breads", "Pastries", "Cakes", "Cookies", "Savory"] }),
    },
  });

  const productCount = await prisma.product.count();
  if (productCount === 0) {
    await prisma.product.createMany({
      data: [
        {
          id: "prod-001",
          name: "Croissant au Beurre",
          category: "viennoiserie",
          sellingPrice: 120,
          costPrice: 45,
          stock: 45,
          minStock: 20,
          imageUrl:
            "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&q=80&w=800",
        },
        {
          id: "prod-002",
          name: "Pain au Chocolat",
          category: "viennoiserie",
          sellingPrice: 150,
          costPrice: 55,
          stock: 38,
          minStock: 20,
          imageUrl:
            "https://images.unsplash.com/photo-1530610476181-d83430b64dcd?auto=format&fit=crop&q=80&w=800",
        },
        {
          id: "prod-003",
          name: "Macarons Assortis (6pcs)",
          category: "patisserie",
          sellingPrice: 850,
          costPrice: 350,
          stock: 15,
          minStock: 10,
          imageUrl:
            "https://images.unsplash.com/photo-1569864358642-9d1619702661?auto=format&fit=crop&q=80&w=800",
        },
        {
          id: "prod-004",
          name: "Baguette Tradition",
          category: "boulangerie",
          sellingPrice: 50,
          costPrice: 15,
          stock: 60,
          minStock: 30,
          imageUrl:
            "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=800",
        },
        {
          id: "prod-005",
          name: "Éclair au Chocolat",
          category: "patisserie",
          sellingPrice: 250,
          costPrice: 90,
          stock: 12,
          minStock: 8,
          imageUrl:
            "https://images.unsplash.com/photo-1612203985729-70726954388c?auto=format&fit=crop&q=80&w=800",
        },
        {
          id: "prod-006",
          name: "Tarte aux Fraises",
          category: "patisserie",
          sellingPrice: 350,
          costPrice: 150,
          stock: 8,
          minStock: 5,
          imageUrl:
            "https://images.unsplash.com/photo-1519915028121-7d3463d20b13?auto=format&fit=crop&q=80&w=800",
        },
        {
          id: "prod-007",
          name: "Pain aux Raisins",
          category: "viennoiserie",
          sellingPrice: 140,
          costPrice: 50,
          stock: 25,
          minStock: 15,
          imageUrl:
            "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=800",
        },
        {
          id: "prod-008",
          name: "Croissant aux Amandes",
          category: "viennoiserie",
          sellingPrice: 180,
          costPrice: 70,
          stock: 20,
          minStock: 10,
          imageUrl:
            "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&q=80&w=800",
        },
        {
          id: "prod-009",
          name: "Paris-Brest",
          category: "patisserie",
          sellingPrice: 450,
          costPrice: 180,
          stock: 10,
          minStock: 5,
          imageUrl:
            "https://images.unsplash.com/photo-1612203985729-70726954388c?auto=format&fit=crop&q=80&w=800",
        },
        {
          id: "prod-010",
          name: "Mille-Feuille",
          category: "patisserie",
          sellingPrice: 400,
          costPrice: 160,
          stock: 12,
          minStock: 6,
          imageUrl:
            "https://images.unsplash.com/photo-1519915028121-7d3463d20b13?auto=format&fit=crop&q=80&w=800",
        },
      ],
    });
  }

  const customerCount = await prisma.customer.count();
  if (customerCount === 0) {
    await prisma.customer.createMany({
      data: [
        { id: "cust-001", name: "John Smith", email: "john@example.com", phone: "555-0101", type: "b2c" },
        { id: "cust-002", name: "Sarah Johnson", email: "sarah@example.com", phone: "555-0102", type: "b2c" },
        { id: "cust-003", name: "Mike's Cafe", email: "mikes@cafe.com", phone: "555-0103", type: "b2b" },
        { id: "cust-004", name: "Hotel Grand", email: "booking@hotelgrand.com", phone: "555-0104", type: "b2b" },
        { id: "cust-005", name: "Emma Wilson", email: "emma@example.com", phone: "555-0105", type: "b2c" },
      ],
    });
  }

  const materialCount = await prisma.rawMaterial.count();
  if (materialCount === 0) {
    await prisma.rawMaterial.createMany({
      data: [
        { id: "mat-001", name: "All-Purpose Flour", category: "Flour", unit: "kg", currentStock: 50, minStock: 10 },
        { id: "mat-002", name: "Cocoa Powder", category: "Chocolate", unit: "kg", currentStock: 5, minStock: 1 },
        { id: "mat-003", name: "Sugar", category: "Sweeteners", unit: "kg", currentStock: 40, minStock: 10 },
        { id: "mat-004", name: "Butter", category: "Dairy", unit: "kg", currentStock: 15, minStock: 5 },
        { id: "mat-005", name: "Eggs", category: "Dairy", unit: "dozen", currentStock: 20, minStock: 5 },
        { id: "mat-006", name: "Salt", category: "Seasoning", unit: "kg", currentStock: 5, minStock: 1 },
        {
          id: "mat-007",
          name: "Vanilla Extract",
          category: "Flavorings",
          unit: "liter",
          currentStock: 2,
          minStock: 0.5,
        },
        { id: "mat-008", name: "Dark Chocolate", category: "Chocolate", unit: "kg", currentStock: 8, minStock: 2 },
      ],
    });
  }

  const batchCount = await prisma.productionBatch.count();
  if (batchCount === 0) {
    const now = new Date();
    await prisma.productionBatch.createMany({
      data: [
        {
          id: "batch-001",
          productId: "prod-001",
          recipeId: "recipe-001",
          plannedQty: 30,
          actualQty: 28,
          status: "completed",
          startDate: new Date(now.getTime() - 86400000),
        },
        {
          id: "batch-002",
          productId: "prod-002",
          recipeId: "recipe-002",
          plannedQty: 20,
          actualQty: null,
          status: "in-progress",
          startDate: now,
        },
        {
          id: "batch-003",
          productId: "prod-003",
          recipeId: "recipe-003",
          plannedQty: 10,
          actualQty: null,
          status: "planned",
          startDate: new Date(now.getTime() + 86400000),
        },
      ],
    });
  }

  const saleCount = await prisma.sale.count();
  if (saleCount === 0) {
    await prisma.sale.createMany({
      data: [
        {
          id: "sale-001",
          cashierId: "admin-001",
          customerId: "cust-001",
          totalAmount: 15.5,
          paymentMethod: "cash",
          items: JSON.stringify([
            { productId: "prod-001", quantity: 2, price: 3.5 },
            { productId: "prod-004", quantity: 3, price: 2.0 },
          ]),
        },
        {
          id: "sale-002",
          cashierId: "admin-001",
          customerId: "cust-003",
          totalAmount: 45.0,
          paymentMethod: "card",
          items: JSON.stringify([
            { productId: "prod-003", quantity: 1, price: 12.0 },
            { productId: "prod-002", quantity: 6, price: 5.0 },
          ]),
        },
        {
          id: "sale-003",
          cashierId: "admin-001",
          customerId: null,
          totalAmount: 8.5,
          paymentMethod: "cash",
          items: JSON.stringify([{ productId: "prod-007", quantity: 1, price: 8.5 }]),
        },
      ],
    });
  }

  console.log("Seed finished: admin user, permissions, categories, demo data (where empty).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
