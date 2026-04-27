export type Role = 'admin' | 'manager' | 'cashier' | 'baker' | 'delivery_guy' | 'inventory' | 'customer_business' | 'customer_customers';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  username: string;
  password?: string;
  phone?: string;
  role: Role;
  createdAt: string;
  status?: 'active' | 'inactive' | 'pending';
}

export interface Product {
  id: string;
  name: string;
  category: string;
  sellingPrice: number;
  costPrice: number;
  shelfLife: number; // in hours
  imageUrl?: string;
  stock: number;
  shopStock?: number;
  freezerStock?: number;
  minStock: number;
  description?: string;
  specifications?: string;
  weight?: number; // total weight in grams
  ingredients?: RecipeIngredient[];
  unit?: string; // e.g., "piece", "kg"
  status?: 'none' | 'frozen' | 'ordered' | 'requested' | 'cancelled';
  isPack?: boolean;
  itemType?: 'product' | 'pack' | 'material';
  packItems?: { productId: string; quantity: number }[];
  createdAt?: string;
  disabled?: boolean;
}

export interface StockMovement {
  id: string;
  itemId: string; // productId or materialId
  itemName?: string;
  itemType: 'product' | 'material';
  type: 'in' | 'out' | 'adjustment' | 'transfer';
  quantity: number;
  previousStock: number;
  newStock: number;
  location?: 'shop' | 'freezer' | 'warehouse' | 'none';
  reason: 'production' | 'sale' | 'waste' | 'restock' | 'adjustment' | 'transfer' | 'cancellation' | 'manual_adjustment';
  referenceId?: string; // batchId, orderId, etc.
  userId: string;
  userName: string;
  timestamp: any;
}

export interface RawMaterial {
  id: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  minStock: number;
  status?: 'none' | 'ordered' | 'requested' | 'cancelled';
  imageUrl?: string;
  brand?: string;
  expiryDate?: string;
  createdAt?: string;
  disabled?: boolean;
}

export interface RecipeIngredient {
  materialId: string;
  quantity: number;
  type: 'quantity' | 'weight' | 'percentage';
}

export interface Recipe {
  id: string;
  productId: string;
  batchSize: number;
  prepTime: number;
  ingredients: RecipeIngredient[];
}

export interface ProductionBatch {
  id: string;
  productId: string;
  recipeId: string;
  plannedQty: number;
  actualQty?: number;
  ingredients?: RecipeIngredient[];
  status: 'planned' | 'started' | 'in-progress' | 'termination' | 'completed' | 'cancelled';
  startDate: string;
  endDate?: string;
  createdBy?: string;
}

export interface SaleItem {
  productId: string;
  quantity: number;
  price: number;
}

export interface Sale {
  id: string;
  cashierId: string;
  customerId?: string;
  totalAmount: number;
  paymentMethod: 'cash' | 'card' | 'mobile';
  items: SaleItem[];
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  phone: string;
  email: string;
  address?: string;
  materials?: string[]; // Array of RawMaterial IDs
  createdAt?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  type: 'b2b' | 'b2c';
  email: string;
}

export interface Order {
  id: string;
  customerId: string;
  clientName?: string;
  description?: string;
  items: SaleItem[];
  totalAmount: number;
  status: 'ordered' | 'in-progress' | 'delayed' | 'delivered' | 'cancelled';
  deliveryStatus?: 'pending' | 'assigned' | 'picked-up' | 'delivered';
  deliveryType: 'customer' | 'business';
  expectedTime: string;
  expectedDate: string;
  createdAt: string;
  updatedAt?: string;
  deliveryId?: string;
  notes?: string;
  createdBy?: string;
}

export interface Delivery {
  id: string;
  orderId: string;
  deliveryGuyId?: string;
  status: 'pending' | 'assigned' | 'picked-up' | 'delivered';
  trackingUrl?: string;
  comments?: string;
  updatedAt: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  timestamp: string;
}

export interface RolePermission {
  id: Role;
  allowedPaths: string[];
}

export interface Promotion {
  id: string;
  imageUrl: string;
  title?: string;
  description?: string;
  expiryDate: string;
  active: boolean;
  type?: 'banner' | 'popup' | 'discount';
  createdAt: string;
}

// Financial Module Types
export type AccountType = 'ACTIF' | 'PASSIF' | 'CAPITAUX' | 'PRODUIT' | 'CHARGE' | 'CMV';
export type JournalStatus = 'BROUILLON' | 'EN_ATTENTE_VALIDATION' | 'APPROUVÉ' | 'COMPTABILISÉ' | 'ANNULÉ';
export type PayrollStatus = 'BROUILLON' | 'CALCULÉ' | 'VÉRIFIÉ' | 'APPROUVÉ' | 'PAYÉ';
export type InvoiceStatus = 'BROUILLON' | 'EN_ATTENTE' | 'EN_ATTENTE_VALIDATION' | 'APPROUVÉ' | 'PROGRAMMÉ' | 'PAYÉ' | 'ANNULÉ';

export interface Account {
  id: string;
  number: string;
  name: string;
  type: AccountType;
  parent?: string;
  isCategory: boolean;
  normalBalance: 'DÉBIT' | 'CRÉDIT';
  active: boolean;
  createdAt: string;
}

export interface JournalEntry {
  id: string;
  number: string;
  date: string;
  period: string; // YYYY-MM
  label: string;
  reference?: string;
  sourceModule: string;
  sourceId?: string;
  status: JournalStatus;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
  postedAt?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  createdAt: string;
}

export interface JournalLine {
  id: string;
  journalId: string;
  accountNumber: string;
  debit: number;
  credit: number;
  label?: string;
  costCenterId?: string;
  branchId?: string;
  createdAt: string;
}

export interface FinancialEmployee extends Omit<Partial<UserProfile>, 'role' | 'status'> {
  id: string;
  name: string;
  role: string;
  matricule: string;
  nin: string;
  cnasNumber?: string;
  department?: string;
  hireDate: string;
  endDate?: string;
  baseSalary: number;
  transportAllowance: number;
  performanceBonus: number;
  otherAllowances: number;
  contributesToCNAS: boolean;
  bankRIB?: string;
  branchId?: string;
  status: string;
  createdAt: string;
}

export interface PayrollRun {
  id: string;
  period: string; // YYYY-MM
  executionDate: string;
  totalGross: number;
  totalCNASEmployee: number; // 9%
  totalIRG: number;
  totalNet: number;
  totalCNASEmployer: number; // 26%
  totalEmployerCost: number;
  employeeCount: number;
  status: PayrollStatus;
  approvedBy?: string;
  journalId?: string;
  createdAt: string;
}

export interface Payslip {
  id: string;
  runId: string;
  employeeId: string;
  period: string;
  baseSalary: number;
  transportAllowance: number;
  performanceBonus: number;
  overtimeHours: number;
  overtimeAmount: number;
  grossSalary: number;
  cnasEmployee: number;
  taxableGross: number;
  irgAbatement: number;
  netFiscalSalary: number;
  irgRetained: number;
  otherDeductions: number;
  netSalary: number;
  cnasEmployer: number;
  totalEmployerCost: number;
}

export interface SupplierInvoice {
  id: string;
  invoiceNumber: string;
  supplierId: string;
  supplierName?: string;
  orderId?: string;
  receiptId?: string;
  date: string;
  dueDate: string;
  amountHT: number;
  tvaAmount: number;
  totalAmount: number;
  amountPaid: number;
  status: InvoiceStatus;
  category?: string;
  journalId?: string;
  createdAt: string;
}

export interface CustomerInvoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  date: string;
  dueDate: string;
  amountHT: number;
  amountTVA: number;
  amountTTC: number;
  amountPaid: number;
  status: InvoiceStatus;
  paymentMethod: 'CASH';
  journalId?: string;
  createdAt: string;
}

export interface FixedAsset {
  id: string;
  code: string;
  name: string;
  category: string;
  acquisitionDate: string;
  acquisitionCost: number;
  residualValue: number;
  usefulLifeYears: number;
  depreciationMethod: 'LINÉAIRE' | 'DÉGRESSIF';
  accumulatedDepreciation: number;
  location?: string;
  branchId?: string;
  status: 'ACTIF' | 'CÉDÉ' | 'MIS_AU_REBUT';
  disposalDate?: string;
  disposalPrice?: number;
}

export interface DailyCashReconciliation {
  id: string;
  date: string;
  branchId: string;
  openingBalance: number;
  totalSales: number;
  totalARCollections: number;
  totalAPPayments: number;
  totalExpensesPaid: number;
  bankDeposits: number;
  systemClosingBalance: number;
  physicalClosingBalance: number;
  discrepancy: number;
  discrepancyNote?: string;
  closedBy: string;
  closedAt: string;
  status: 'OUVERT' | 'CLÔTURÉ' | 'LITIGIEUX';
  createdAt: string;
}

export interface RiskSnapshot {
  id: string;
  date: string;
  currentRatio: number;
  quickRatio: number;
  cashRunwayDays: number;
  arRiskPct: number;
  apDelayPct: number;
  concentrationPct: number;
  cogsRate: number;
  payrollRate: number;
  wasteCostDZD: number;
  compositeScore: number;
  riskLevel: 'FAIBLE' | 'MODÉRÉ' | 'ÉLEVÉ' | 'CRITIQUE';
  alerts: string[];
  calculatedAt: string;
}

export interface Budget {
  id: string;
  year: number;
  costCenterId?: string;
  branchId?: string;
  accountNumber: string;
  monthlyAmounts: number[]; // 12 months
  totalAmount: number;
  status: 'BROUILLON' | 'RÉVISION' | 'APPROUVÉ';
  approvedBy?: string;
  createdAt: string;
}

export type Language = 'fr' | 'ar';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}
