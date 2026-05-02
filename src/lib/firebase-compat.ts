// Firebase compatibility layer - all functions use REST API, not Firebase
import {
  getDocsFromApi,
  getDocFromApi,
  addDocToApi,
  updateDocInApi,
  deleteDocFromApi
} from './api-client';

export { auth, signInWithPopup, signOut, onAuthStateChanged } from './firebase-auth-only';

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

// Query
export function query(collectionRef: any, ...constraints: any[]) {
  const params: any = {};

  for (const constraint of constraints) {
    if (constraint.type === 'where') {
      params.where = constraint.value;
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

// OnSnapshot - listen to collection changes
export function onSnapshot(
  queryOrRef: any,
  onNext: (snapshot: any) => void,
  onError?: (error: any) => void
) {
  const fetchData = async () => {
    try {
      // Check if this is a single document reference (has id) or a query
      const isSingleDoc = queryOrRef.id && !queryOrRef.params;

      if (isSingleDoc) {
        // Single document reference
        const docData = await getDocFromApi(queryOrRef.collectionName, queryOrRef.id);
        const snapshot = {
          exists: () => !!docData,
          data: () => docData,
          id: queryOrRef.id
        };
        onNext(snapshot);
      } else {
        // Collection query
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
    } catch (error) {
      if (onError) {
        onError(error);
      } else {
        console.error('Snapshot error:', error);
      }
    }
  };

  fetchData();
  const interval = setInterval(fetchData, 3000); // Poll every 3 seconds
  return () => clearInterval(interval);
}

// Where constraint
export function where(field: string, operator: string, value: any) {
  // Map Firebase operators to Prisma operators
  const operatorMap: Record<string, string> = {
    '>=': 'gte',
    '<=': 'lte',
    '>': 'gt',
    '<': 'lt',
    '==': 'equals',
    '!=': 'not'
  };

  const prismaOperator = operatorMap[operator] || operator;

  return {
    type: 'where',
    value: { [field]: { [prismaOperator]: value } }
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

// Get documents (alias for getDocsFromApi)
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

// Operation types (HTTP methods)
export enum OperationType {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH'
}

// Handle Firestore error (mock)
export function handleFirestoreError(error: any, operationType?: OperationType, collection?: string) {
  const msg = `Firestore error [${operationType}] on ${collection || 'unknown'}`;
  console.error(msg, error);
  return error;
}

// Batch operations (simplified - just execute sequentially)
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

// Array union (for Firebase array operations)
export function arrayUnion(...elements: any[]) {
  return elements; // Simplified - just return the elements
}

// Array remove (for Firebase array operations)
export function arrayRemove(...elements: any[]) {
  return { _remove: elements };
}

// Mock db object
export const db = {};
