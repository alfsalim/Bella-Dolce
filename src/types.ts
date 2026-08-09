export type Role = 'admin' | 'manager' | 'cashier' | 'baker' | 'delivery_guy' | 'inventory' | 'customer_business' | 'customer_customers';

export interface RegisterOptions {
  phone?: string;
  companyRegistrationNumber?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  username: string;
  password?: string;
  phone?: string;
  companyRegistrationNumber?: string;
  role: Role;
  createdAt: string;
  status?: 'active' | 'inactive' | 'pending';
}

export interface Product {
  id: string;
  name: string;
  /** Optional Arabic display name when UI language is Arabic. Falls back to PRODUCT_NAMES map, then `name`. */
  nameAr?: string;
  category: string;
  sellingPrice: number;
  costPrice: number;
  shelfLife: number; // in hours
  imageUrl?: string;
  stock: number;
  shopStock?: number;
  freezerStock?: number;
  wasteQuantity?: number; // waste tracked separately
  minStock: number;
  description?: string;
  specifications?: string;
  weight?: number; // total weight in grams
  ingredients?: RecipeIngredient[];
  batchSize?: number;
  unit?: string; // e.g., "piece", "kg"
  status?: 'none' | 'frozen' | 'ordered' | 'requested' | 'cancelled';
  isPack?: boolean;
  itemType?: 'product' | 'pack' | 'material' | 'consumable';
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
  /** Optional Arabic display name when UI language is Arabic. Falls back to PRODUCT_NAMES map, then `name`. */
  nameAr?: string;
  category: string;
  unit: string;
  description?: string;
  currentStock: number;
  stock?: number;
  wasteQuantity?: number; // waste tracked separately
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
  productName?: string;
  recipeId: string;
  plannedQty: number;
  actualQty?: number;
  ingredients?: RecipeIngredient[];
  status: 'started' | 'completed' | 'cancelled';
  startDate: string;
  endDate?: string;
  createdBy?: string;
}

export interface OrderItemSpecifications {
  flavor?: string;
  glaze?: string;
  shape?: string;
  size?: string;
  addons?: string;
}

export interface SaleItem {
  productId: string;
  name?: string;
  quantity: number;
  price: number;
  location?: 'shop' | 'frozen';
  specifications?: OrderItemSpecifications;
}

export interface SpecificationOption {
  id: string;
  category: 'flavor' | 'glaze' | 'shape' | 'size' | 'addon';
  value: string;
  createdAt: string;
}

export interface Sale {
  id: string;
  cashierId: string;
  cashierName?: string;
  customerId?: string;
  totalAmount: number;
  amountPaid?: number;
  change?: number;
  paymentMethod: 'cash' | 'card' | 'mobile' | 'transfer';
  items: SaleItem[] | string; // string when fetched from DB (JSON), array when in memory
  comment?: string;
  discount?: number;
  returnComment?: string;
  status?: string;
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
  customerId?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  clientName?: string;
  description?: string;
  items: SaleItem[];
  totalAmount: number;
  status: 'ordered' | 'in-progress' | 'delayed' | 'delivered' | 'cancelled';
  deliveryStatus?: 'pending' | 'assigned' | 'picked-up' | 'delivered';
  deliveryType: 'customer' | 'business';
  type?: string;
  expectedTime: string;
  expectedDate: string;
  createdAt: string;
  updatedAt?: string;
  deliveryId?: string;
  notes?: string;
  createdBy?: string;
  amountPaid?: number;
  paymentStatus?: 'n/a' | 'deposit' | 'paid_full' | 'closed';
  cancellationReason?: string;
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

export interface Purchase {
  id: string;
  materialId: string;
  materialName: string;
  supplierId: string;
  supplierName: string;
  quantity: number;
  price: number;
  brand: string;
  purchaseDate: string;
  expiryDate?: string;
  createdAt: string;
  createdBy: string;
  unit: string;
}

export interface RolePermission {
  id: Role;
  allowedPaths: string[];
}

export interface Promotion {
  id: string;
  imageUrl?: string;
  name?: string;
  title?: string;
  description?: string;
  expiryDate: string;
  active: boolean;
  type?: 'banner' | 'popup' | 'discount' | 'campaign';
  productIds?: string[];
  productPrices?: {
    productId: string;
    originalPrice: number;
    promotionPrice: number;
  }[];
  status?: 'active' | 'expired';
  createdAt: string;
}

// Payroll configuration — stored in Setting.data (key: "payroll_config")
export interface IrgBracket {
  upTo: number | null; // null = unbounded top bracket
  rate: number;        // fraction, e.g. 0.20
}

export interface PayrollConfig {
  // CNAS rates (fractions) — cnasEmployeeRate = sum of the 4 sub-rates below
  cnasEmployeeRate: number;   // e.g. 0.09
  cnasEmployerRate: number;   // e.g. 0.26
  // 4 sub-rates that compose cnasEmployeeRate (display only; engine uses cnasEmployeeRate)
  cnasAssurancesSociales?: number;  // default 0.015
  cnasRetraite?: number;            // default 0.0675
  cnasAssuranceChomage?: number;    // default 0.005
  cnasRetraiteAnticipee?: number;   // default 0.0025
  // IRG brackets (ordered low→high, last upTo must be null)
  irgBrackets: IrgBracket[];
  // IRG rebate (abatement)
  irgRebateRate: number;      // e.g. 0.40
  irgRebateCap: number;       // e.g. 1500 DA/month
  irgRebateFloor?: number;    // e.g. 0 (plancher)
  // IRG thresholds
  irgExemptionThreshold?: number;  // e.g. 10000 DA/month
  irgSmoothingFrom?: number;       // smoothing zone lower bound
  irgSmoothingTo?: number;         // smoothing zone upper bound
  // SNMG
  snmg?: number;              // e.g. 20000 DA/month
  // Employer identity (for payslip header)
  companyName?: string;
  companyAddress?: string;
  nif?: string;
  nis?: string;
  rc?: string;
  cnasRegistration?: string;
  // Shop contact info (for payslip footer)
  shopPhone?: string;
  shopEmail?: string;
}

// Versioned config entry stored in Setting.data history array
export interface PayrollConfigVersion {
  version: number;
  savedAt: string;   // ISO date string
  savedBy: string;
  config: PayrollConfig;
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
  totalCNAS: number;         // employee CNAS (9%) — matches schema column name
  totalCNASEmployer: number; // employer CNAS (26%)
  totalIRG: number;
  totalNet: number;
  employeeCount: number;
  status: PayrollStatus;
  approvedBy?: string;
  configSnapshot?: string;   // JSON-encoded PayrollConfig at time of run
  journalId?: string;
  createdAt: string;
}

export interface Payslip {
  id: string;
  runId: string;
  employeeId: string;
  employeeName: string;
  period: string;
  baseSalary: number;
  transportAllowance: number;
  performanceBonus: number;
  otherAllowances: number;
  overtimeHours?: number;
  overtimeAmount?: number;
  grossSalary: number;
  cnasEmployee: number;
  taxableGross: number;
  irgAbatement?: number;
  netFiscalSalary?: number;
  irgRetained: number;
  otherDeductions?: number;
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

/** Record returned by `/api/db/fixedAssets` (aligned with Prisma `FixedAsset`). */
export interface FixedAssetDbRow {
  id: string;
  code: string;
  name: string;
  category: string;
  location?: string | null;
  acquisitionCost: number;
  usefulLifeYears: number;
  salvageValue: number;
  depreciationMethod: string;
  notes?: string | null;
  lastMaintenanceAt?: string | null;
  nextMaintenanceAt?: string | null;
  maintenanceNotes?: string | null;
  status: string;
  acquisitionDate: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Record returned by `/api/db/fixedAssetMaintenances`. */
export interface FixedAssetMaintenanceRow {
  id: string;
  fixedAssetId: string;
  date: string;
  description: string;
  cost: number;
  nextDueDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
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

export interface Utility {
  id: string;
  type: string; // ELECTRICITY, WATER, GAS, INTERNET, PHONE, OTHER
  provider: string;
  periodStart: string; // ISO date
  periodEnd: string; // ISO date
  amount: number;
  currency: string;
  dueDate?: string | null; // ISO date
  paidAt?: string | null; // ISO date
  status: 'PENDING' | 'PAID' | 'OVERDUE'; // auto-derived
  invoiceNumber?: string | null;
  attachmentUrl?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
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
