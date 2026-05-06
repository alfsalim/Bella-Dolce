// REST API client — all CRUD operations go through the Express/SQLite backend
import {
  getDocsFromApi,
  getDocFromApi,
  addDocToApi,
  updateDocInApi,
  deleteDocFromApi
} from './api-client';
import { recordStaffSystemError } from './systemErrorNotifications';

// Collection reference
export function collection(db: any, collectionName: string) {
  return { collectionName };
}

// Document reference
export function doc(db: any, collectionName: string, id: string) {
  return { collectionName, id };
}

// Add document
export async function addDoc(collectionRef: any, data: any) {
  const result = await addDocToApi(collectionRef.collectionName, data);
  return { id: result.id };
}

// Update document
export async function updateDoc(docRef: any, data: any) {
  return updateDocInApi(docRef.collectionName, docRef.id, data);
}

// Set document (create or merge)
export async function setDoc(docRef: any, data: any, options?: { merge?: boolean }) {
  return updateDocInApi(docRef.collectionName, docRef.id, data);
}

// Delete document
export async function deleteDoc(docRef: any) {
  return deleteDocFromApi(docRef.collectionName, docRef.id);
}

function mergeWhereClause(a: Record<string, unknown> | undefined, b: Record<string, unknown>): Record<string, unknown> {
  if (!a) return { ...b };
  const out: Record<string, unknown> = { ...a };
  for (const [field, cond] of Object.entries(b)) {
    const existing = out[field];
    if (existing != null && typeof existing === 'object' && !Array.isArray(existing) && cond != null && typeof cond === 'object' && !Array.isArray(cond)) {
      out[field] = { ...(existing as Record<string, unknown>), ...(cond as Record<string, unknown>) };
    } else {
      out[field] = cond;
    }
  }
  return out;
}

// Query
export function query(collectionRef: any, ...constraints: any[]) {
  const params: any = {};

  for (const constraint of constraints) {
    if (constraint.type === 'where') {
      params.where = mergeWhereClause(params.where, constraint.value);
    } else if (constraint.type === 'orderBy') {
      params.orderBy = constraint.value;
    } else if (constraint.type === 'limit') {
      params.limit = constraint.value;
    }
  }

  return {
    path: collectionRef.collectionName,
    params
  };
}

// OnSnapshot - polls the REST API on an interval to simulate real-time updates
export function onSnapshot(
  queryOrRef: any,
  onNext: (snapshot: any) => void,
  onError?: (error: any) => void
) {
  let intervalId: ReturnType<typeof setInterval> | null = null;

  const fetchData = async () => {
    try {
      const isSingleDoc = queryOrRef.id && !queryOrRef.params;

      if (isSingleDoc) {
        const docData = await getDocFromApi(queryOrRef.collectionName, queryOrRef.id);
        const snapshot = {
          exists: () => !!docData,
          data: () => docData,
          id: queryOrRef.id
        };
        onNext(snapshot);
      } else {
        const data = await getDocsFromApi(queryOrRef.path || queryOrRef.collectionName, queryOrRef.params);
        const snapshot = {
          docs: data.docs,
          empty: data.empty,
          size: data.size,
          docChanges: () => data.docs.map((doc: any) => ({
            type: 'added',
            doc: {
              id: doc.id,
              data: () => doc.data()
            }
          }))
        };
        onNext(snapshot);
      }
    } catch (error: any) {
      // Stop polling on permission errors — retrying will never succeed.
      const msg: string = error?.message ?? '';
      if (/Forbidden|insufficient role|401|403/i.test(msg)) {
        if (intervalId !== null) {
          clearInterval(intervalId);
          intervalId = null;
        }
      }
      if (onError) {
        onError(error);
      } else {
        console.error('Snapshot error:', error);
      }
    }
  };

  fetchData();
  intervalId = setInterval(fetchData, 3000);
  return () => {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}

// Calendar day YYYY-MM-DD → UTC midnight ISO (Prisma DateTime)
const CAL_DAY = /^\d{4}-\d{2}-\d{2}$/;

function prismaDateValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const s = value.trim();
  return CAL_DAY.test(s) ? `${s}T00:00:00.000Z` : value;
}

// Where constraint
export function where(field: string, operator: string, value: any) {
  const operatorMap: Record<string, string> = {
    '>=': 'gte',
    '<=': 'lte',
    '>': 'gt',
    '<': 'lt',
    '==': 'equals',
    '!=': 'not'
  };

  const prismaOperator = operatorMap[operator] || operator;
  const v = prismaDateValue(value);

  return {
    type: 'where',
    value: { [field]: { [prismaOperator]: v } }
  };
}

// OrderBy constraint
export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
  return {
    type: 'orderBy',
    value: { [field]: direction }
  };
}

// Limit constraint
export function limit(n: number) {
  return {
    type: 'limit',
    value: n
  };
}

// Timestamp (use current time)
export const Timestamp = {
  now: () => new Date().toISOString()
};

// Get document
export async function getDoc(docRef: any) {
  const doc = await getDocFromApi(docRef.collectionName, docRef.id);
  return doc;
}

// Get documents
export async function getDocs(queryRef: any) {
  return getDocsFromApi(queryRef.path || queryRef.collectionName, queryRef.params);
}

// Check if error is auth-related
export function isAuthError(error: any): boolean {
  return error?.code === 'auth/invalid-api-key' ||
         error?.message?.includes('401') ||
         error?.message?.includes('Unauthorized');
}

// Server timestamp
export const serverTimestamp = () => new Date().toISOString();

// Get count from server
export async function getCountFromServer(queryRef: any) {
  const docs = await getDocsFromApi(queryRef.path || queryRef.collectionName, queryRef.params);
  return { data: () => ({ count: docs.size }) };
}

// Operation types
export enum OperationType {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH'
}

// Handle API error
export function handleFirestoreError(error: any, operationType?: OperationType, collection?: string) {
  const msg = `API error [${operationType}] on ${collection || 'unknown'}`;
  console.error(msg, error);
  recordStaffSystemError({
    operation: operationType,
    collection: collection || 'unknown',
    message: typeof error?.message === 'string' ? error.message : msg,
  });
  return error;
}

// Batch operations — executed sequentially
export function writeBatch(db: any) {
  const batch: any = {
    ops: [],
    set: function(docRef: any, data: any) {
      this.ops.push({ op: 'set', ref: docRef, data });
      return this;
    },
    update: function(docRef: any, data: any) {
      this.ops.push({ op: 'update', ref: docRef, data });
      return this;
    },
    delete: function(docRef: any) {
      this.ops.push({ op: 'delete', ref: docRef });
      return this;
    },
    commit: async function() {
      for (const op of this.ops) {
        if (op.op === 'set') {
          await updateDocInApi(op.ref.collectionName, op.ref.id, op.data);
        } else if (op.op === 'update') {
          await updateDocInApi(op.ref.collectionName, op.ref.id, op.data);
        } else if (op.op === 'delete') {
          await deleteDocFromApi(op.ref.collectionName, op.ref.id);
        }
      }
    }
  };
  return batch;
}

// Array union
export function arrayUnion(...elements: any[]) {
  return elements;
}

// Array remove
export function arrayRemove(...elements: any[]) {
  return { _remove: elements };
}

// Mock db object
export const db = {};
