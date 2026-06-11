// Mirrors prisma/schema.prisma `Product`, `Sale`, and `User` shapes verbatim
// (only fields PosLite actually needs), plus local-only sync bookkeeping.

export interface LocalProduct {
  id: string;
  name: string;
  category: string;
  sellingPrice: number;
  imageUrl?: string | null;
  shopStock: number;
  stock: number;
  freezerStock: number;
  wasteQuantity: number;
  unit: string;
  status: string;
  disabled: boolean;
}

export interface LocalSaleItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
}

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';

// Mirrors `Sale` model fields sent to POST /api/sale, plus clientTxnId (added
// in prisma/schema.prisma) and local-only sync bookkeeping fields.
export interface LocalTransaction {
  clientTxnId: string; // primary key, also sent as Sale.clientTxnId for dedupe
  customerId: string | null;
  totalAmount: number;
  amountPaid: number;
  change: number;
  paymentMethod: 'cash' | 'card';
  items: LocalSaleItem[];
  comment: string | null;
  returnComment: string | null;
  createdAt: string; // ISO, client-side timestamp (BRD §12 clock skew note)

  // local-only sync bookkeeping (never sent to server)
  syncStatus: SyncStatus;
  syncAttempts: number;
  lastSyncError: string | null;
  serverSaleId: string | null;
  cashierName: string;
}

// Local cache of `User` rows for the till's staff (offline login).
export interface LocalUser {
  id: string;
  username: string;
  name: string;
  role: string;
  password: string; // bcrypt hash, as stored server-side
}

export interface SyncMeta {
  id: 'singleton';
  serverBaseUrl: string;
  authToken: string | null;
  deviceId: string;
  printAgentUrl: string | null; // null/unset on tablets (no local printer)
  lastProductSyncAt: string | null;
  lastUserSyncAt: string | null;
  lastTxnPushAt: string | null;
  theme: 'light' | 'dark';
  lang: 'fr' | 'ar' | 'en';
  syncInProgress: boolean;
  syncBatchTotal: number; // queue size when the current/last sync cycle started
}
