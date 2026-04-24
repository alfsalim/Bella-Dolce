import { db, collection, getDocs, addDoc, setDoc, doc } from './firebase';
import { Product, RawMaterial, Supplier, Customer, ProductionBatch, Sale, RolePermission } from '../types';

export const DEFAULT_PERMISSIONS: RolePermission[] = [
  { id: 'admin', allowedPaths: ['*'] },
  { id: 'manager', allowedPaths: ['/dashboard', '/ai-manager', '/production', '/inventory', '/suppliers', '/product-management', '/orders', '/delivery', '/reports', '/settings'] },
  { id: 'cashier', allowedPaths: ['/dashboard', '/pos', '/orders'] },
  { id: 'baker', allowedPaths: ['/dashboard', '/production', '/inventory'] },
  { id: 'inventory', allowedPaths: ['/dashboard', '/inventory', '/product-management'] },
  { id: 'delivery_guy', allowedPaths: ['/dashboard', '/delivery'] },
  { id: 'customer_business', allowedPaths: ['/dashboard', '/business'] },
  { id: 'customer_customers', allowedPaths: ['/dashboard', '/pos'] },
];

const PRODUCTS: Partial<Product>[] = [
  {
    name: 'Croissant au Beurre',
    category: 'viennoiserie',
    sellingPrice: 120,
    costPrice: 45,
    shelfLife: 24,
    stock: 45,
    minStock: 20,
    imageUrl: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&q=80&w=800'
  },
  {
    name: 'Pain au Chocolat',
    category: 'viennoiserie',
    sellingPrice: 150,
    costPrice: 55,
    shelfLife: 24,
    stock: 38,
    minStock: 20,
    imageUrl: 'https://images.unsplash.com/photo-1530610476181-d83430b64dcd?auto=format&fit=crop&q=80&w=800'
  },
  {
    name: 'Macarons Assortis (6pcs)',
    category: 'patisserie',
    sellingPrice: 850,
    costPrice: 350,
    shelfLife: 72,
    stock: 15,
    minStock: 10,
    imageUrl: 'https://images.unsplash.com/photo-1569864358642-9d1619702661?auto=format&fit=crop&q=80&w=800'
  },
  {
    name: 'Baguette Tradition',
    category: 'boulangerie',
    sellingPrice: 50,
    costPrice: 15,
    shelfLife: 12,
    stock: 60,
    minStock: 30,
    imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=800'
  },
  {
    name: 'Éclair au Chocolat',
    category: 'patisserie',
    sellingPrice: 250,
    costPrice: 90,
    shelfLife: 24,
    stock: 12,
    minStock: 8,
    imageUrl: 'https://images.unsplash.com/photo-1612203985729-70726954388c?auto=format&fit=crop&q=80&w=800'
  },
  {
    name: 'Tarte aux Fraises',
    category: 'patisserie',
    sellingPrice: 350,
    costPrice: 150,
    shelfLife: 24,
    stock: 8,
    minStock: 5,
    imageUrl: 'https://images.unsplash.com/photo-1519915028121-7d3463d20b13?auto=format&fit=crop&q=80&w=800'
  },
  {
    name: 'Pain aux Raisins',
    category: 'viennoiserie',
    sellingPrice: 140,
    costPrice: 50,
    shelfLife: 24,
    stock: 25,
    minStock: 15,
    imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=800'
  },
  {
    name: 'Croissant aux Amandes',
    category: 'viennoiserie',
    sellingPrice: 180,
    costPrice: 70,
    shelfLife: 24,
    stock: 20,
    minStock: 10,
    imageUrl: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&q=80&w=800'
  },
  {
    name: 'Paris-Brest',
    category: 'patisserie',
    sellingPrice: 450,
    costPrice: 180,
    shelfLife: 24,
    stock: 10,
    minStock: 5,
    imageUrl: 'https://images.unsplash.com/photo-1612203985729-70726954388c?auto=format&fit=crop&q=80&w=800'
  },
  {
    name: 'Mille-Feuille',
    category: 'patisserie',
    sellingPrice: 400,
    costPrice: 160,
    shelfLife: 24,
    stock: 12,
    minStock: 6,
    imageUrl: 'https://images.unsplash.com/photo-1519915028121-7d3463d20b13?auto=format&fit=crop&q=80&w=800'
  }
];

const MATERIALS: Partial<RawMaterial>[] = [
  { name: 'Farine T55', category: 'Base', unit: 'kg', currentStock: 150, minStock: 50, brand: 'Generic' },
  { name: 'Beurre AOP', category: 'Base', unit: 'kg', currentStock: 45, minStock: 20, brand: 'Generic' },
  { name: 'Chocolat Noir 70%', category: 'Garniture', unit: 'kg', currentStock: 25, minStock: 10, brand: 'Generic' },
  { name: 'Sucre Cristal', category: 'Base', unit: 'kg', currentStock: 80, minStock: 20, brand: 'Generic' },
  { name: 'Levure Boulangère', category: 'Base', unit: 'kg', currentStock: 5, minStock: 2, brand: 'Generic' },
  { name: 'Lait Entier', category: 'Base', unit: 'L', currentStock: 40, minStock: 15, brand: 'Generic' }
];

const SUPPLIERS: Partial<Supplier>[] = [
  { 
    name: 'Grands Moulins de Paris', 
    contact: 'Jean Dupont', 
    phone: '01 45 67 89 00', 
    email: 'contact@gmp.fr',
    address: '99 Rue Mirabeau, 94200 Ivry-sur-Seine, France',
    materials: [] // Will be linked after materials are seeded
  },
  { 
    name: 'Lactalis Professionnel', 
    contact: 'Marie Martin', 
    phone: '02 33 44 55 66', 
    email: 'pro@lactalis.fr',
    address: '10-12 Cours Louis Lumière, 94300 Vincennes, France',
    materials: []
  },
  { 
    name: 'Valrhona', 
    contact: 'Pierre Durand', 
    phone: '04 75 07 90 90', 
    email: 'service@valrhona.com',
    address: '14 Avenue du Président Roosevelt, 26600 Tain-l\'Hermitage, France',
    materials: []
  }
];

const CUSTOMERS: Partial<Customer>[] = [
  { name: 'Hôtel Ritz Paris', email: 'contact@ritzparis.com', phone: '01 43 16 30 30', address: '15 Place Vendôme, 75001 Paris' },
  { name: 'Café de Flore', email: 'contact@cafedeflore.fr', phone: '01 45 48 55 26', address: '172 Boulevard Saint-Germain, 75006 Paris' }
];

export const seedDatabase = async () => {
  const now = new Date().toISOString();
  try {
    // Seed Role Permissions if missing
    const rolePermsSnap = await getDocs(collection(db, 'rolePermissions'));
    if (rolePermsSnap.empty) {
      console.log('Seeding role permissions...');
      for (const perm of DEFAULT_PERMISSIONS) {
        await setDoc(doc(db, 'rolePermissions', perm.id), {
          allowedPaths: perm.allowedPaths
        });
      }
    }

    // Seed default users if missing
    const usersSnap = await getDocs(collection(db, 'users'));
    if (usersSnap.empty) {
      console.log('Seeding default administrator...');
      // Use setDoc with a fixed ID for the primary admin
      await setDoc(doc(db, 'users', 'admin-001'), {
        id: 'admin-001',
        username: 'admin',
        password: 'password', // Default password
        name: 'Administrator',
        email: 'admin@bakery.local',
        role: 'admin',
        status: 'active',
        createdAt: now
      });

      // Also create a cashier for testing
      await setDoc(doc(db, 'users', 'cashier-001'), {
        id: 'cashier-001',
        username: 'cashier',
        password: 'password',
        name: 'John Cashier',
        email: 'cashier@bakery.local',
        role: 'cashier',
        status: 'active',
        createdAt: now
      });
    }

    const productsSnap = await getDocs(collection(db, 'products'));
    if (!productsSnap.empty) {
      console.log('Database already seeded');
      return;
    }

    console.log('Seeding database...');

    // Seed Products
    const productIds: string[] = [];
    for (const p of PRODUCTS) {
      const docRef = await addDoc(collection(db, 'products'), p);
      productIds.push(docRef.id);
    }

    // Seed Materials
    const materialIds: string[] = [];
    for (const m of MATERIALS) {
      const docRef = await addDoc(collection(db, 'rawMaterials'), m);
      materialIds.push(docRef.id);
    }

    // Seed Suppliers
    const supplierIds: string[] = [];
    for (let i = 0; i < SUPPLIERS.length; i++) {
      const s = SUPPLIERS[i];
      // Link materials to suppliers
      if (i === 0) s.materials = [materialIds[0], materialIds[3], materialIds[4]]; // Flour, Sugar, Yeast
      if (i === 1) s.materials = [materialIds[1], materialIds[5]]; // Butter, Milk
      if (i === 2) s.materials = [materialIds[2]]; // Chocolate
      
      const docRef = await addDoc(collection(db, 'suppliers'), s);
      supplierIds.push(docRef.id);

      // Seed some initial invoices for each supplier
      for (let j = 0; j < 2; j++) {
        await addDoc(collection(db, 'supplierInvoices'), {
          invoiceNumber: `INV-${s.name.substring(0, 3).toUpperCase()}-${2024001 + j}`,
          supplierId: docRef.id,
          supplierName: s.name,
          date: new Date(Date.now() - (j * 7 * 24 * 60 * 60 * 1000)).toISOString(),
          dueDate: new Date(Date.now() + (14 * 24 * 60 * 60 * 1000)).toISOString(),
          amountHT: 15000 + (j * 5000),
          tvaAmount: (15000 + (j * 5000)) * 0.19,
          totalAmount: (15000 + (j * 5000)) * 1.19,
          amountPaid: j === 0 ? (15000 + (j * 5000)) * 1.19 : 0,
          status: j === 0 ? 'PAYÉ' : 'EN_ATTENTE',
          createdAt: now
        });
      }
    }

    // Seed Customers
    for (const c of CUSTOMERS) {
      await addDoc(collection(db, 'customers'), c);
    }

    // Seed some initial sales
    for (let i = 0; i < 5; i++) {
      const sale: Partial<Sale> = {
        cashierId: 'system',
        totalAmount: 25.50 + i * 10,
        paymentMethod: 'card',
        items: [
          { productId: productIds[0], quantity: 2, price: 2.50 },
          { productId: productIds[1], quantity: 1, price: 2.80 }
        ],
        createdAt: now
      };
      await addDoc(collection(db, 'sales'), sale);
    }

    // Seed some initial batches
    for (let i = 0; i < 3; i++) {
      const batch: Partial<ProductionBatch> = {
        productId: productIds[i],
        recipeId: 'recipe_' + i,
        plannedQty: 50,
        status: i === 0 ? 'in-progress' : 'completed',
        startDate: now
      };
      await addDoc(collection(db, 'batches'), batch);
    }

    // Seed a sample promotion
    const promoExpiry = new Date();
    promoExpiry.setDate(promoExpiry.getDate() + 30);
    await addDoc(collection(db, 'promotions'), {
      title: 'Offre Spéciale Printemps',
      description: 'Profitez de -20% sur toutes nos viennoiseries ce mois-ci !',
      imageUrl: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&q=80&w=1000',
      expiryDate: promoExpiry.toISOString(),
      active: true,
      createdAt: now
    });

    // Seed Role Permissions
    for (const perm of DEFAULT_PERMISSIONS) {
      await setDoc(doc(db, 'rolePermissions', perm.id), {
        allowedPaths: perm.allowedPaths
      });
    }

    console.log('Seeding complete!');
  } catch (error) {
    console.error('Error seeding database:', error);
  }
};
