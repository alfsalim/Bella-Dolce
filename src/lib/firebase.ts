// Operation types for logging/errors
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  console.error(`Postgres Migration Error [${operationType}] at ${path}:`, error);
  throw error;
}

// Compatibility Layer for PostgreSQL
// We use 'any' casts to satisfy the complex Firebase types without reimplementing the whole SDK
export const db = {
  type: 'firestore',
  app: {} as any,
  toJSON: () => ({})
} as any;

export function collection(parent: any, path: string, ...segments: string[]) {
  // If parent is a string, it might be the start of a path (segments pattern)
  // But usually it's db or a document reference
  const parentPath = parent?.path || '';
  const fullPath = [parentPath, path, ...segments].filter(Boolean).join('/');
  
  return { 
    type: 'collection',
    id: path,
    path: fullPath,
    params: {},
    converter: null,
    firestore: parent?.firestore || parent,
    parent: parent?.type === 'document' ? parent : null
  } as any;
}

export function doc(parent: any, path?: string, ...segments: string[]) {
  // Handle doc(collectionRef) - random ID
  if (parent?.type === 'collection' && !path) {
    const id = Math.random().toString(36).substring(2, 15);
    const fullPath = `${parent.path}/${id}`;
    return {
      type: 'document',
      id: id,
      path: fullPath,
      firestore: parent.firestore,
      converter: null
    } as any;
  }

  // Handle doc(db, path) or doc(collection, path)
  const parentPath = parent?.path || '';
  const id = path || Math.random().toString(36).substring(2, 15);
  const fullPath = [parentPath, id, ...segments].filter(Boolean).join('/');
  
  return { 
    type: 'document',
    id: id.split('/').pop(),
    path: fullPath,
    firestore: parent?.firestore || parent,
    converter: null
  } as any;
}

export function query(collectionRef: any, ...constraints: any[]) {
  const params = { ...collectionRef.params };
  constraints.forEach(c => {
    if (c?.type === 'where') params.where = { ...params.where, [c.field]: { [c.op]: c.value } };
    if (c?.type === 'orderBy') params.orderBy = { [c.field]: c.direction };
    if (c?.type === 'limit') params.limit = c.value;
  });
  return { ...collectionRef, params } as any;
}

export function where(field: string, op: string, value: any) {
  const opMap: Record<string, string> = {
    '==': 'equals',
    '!=': 'not',
    '>': 'gt',
    '<': 'lt',
    '>=': 'gte',
    '<=': 'lte',
  };
  return { type: 'where', field, op: opMap[op] || op, value };
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
  return { type: 'orderBy', field, direction };
}

export function limit(value: number) {
  return { type: 'limit', value };
}

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('bakery_token');
  const base: HeadersInit = { 'Content-Type': 'application/json' };
  return token ? { ...base, 'Authorization': `Bearer ${token}` } : base;
}

export async function getDocs(queryRef: any) {
  const url = new URL(`/api/db/${queryRef.path}`, window.location.origin);
  if (queryRef.params?.where) url.searchParams.set('where', JSON.stringify(queryRef.params.where));
  if (queryRef.params?.orderBy) url.searchParams.set('orderBy', JSON.stringify(queryRef.params.orderBy));
  if (queryRef.params?.limit) url.searchParams.set('take', queryRef.params.limit.toString());

  const res = await fetch(url.toString(), { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return {
    docs: data.map((item: any) => ({
      id: item.id,
      data: () => item,
      exists: () => true
    })),
    empty: data.length === 0,
    size: data.length,
    forEach: (cb: any) => data.forEach((item: any) => cb({ id: item.id, data: () => item }))
  } as any;
}

export async function getDoc(docRef: any) {
  const res = await fetch(`/api/db/${docRef.path}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(await res.text());
  const item = await res.json();
  return {
    id: item?.id || docRef.id,
    data: () => item,
    exists: () => !!item
  } as any;
}

export async function addDoc(collectionRef: any, data: any) {
  const res = await fetch(`/api/db/${collectionRef.path}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(await res.text());
  const item = await res.json();
  return { id: item.id } as any;
}

export async function updateDoc(docRef: any, data: any) {
  const res = await fetch(`/api/db/${docRef.path}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function setDoc(docRef: any, data: any, options?: any) {
  return updateDoc(docRef, data);
}

export async function deleteDoc(docRef: any) {
  const res = await fetch(`/api/db/${docRef.path}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error(await res.text());
}

export function onSnapshot(queryRef: any, callback: (snapshot: any) => void, errorCallback?: (error: any) => void) {
  const fetchData = async () => {
    try {
      const snap = await getDocs(queryRef);
      callback(snap);
    } catch (e) {
      if (errorCallback) errorCallback(e);
      else console.error('Snapshot error:', e);
    }
  };
  fetchData();
  const id = setInterval(fetchData, 5000);
  return () => clearInterval(id);
}

export const Timestamp = {
  now: () => ({ toISOString: () => new Date().toISOString(), toDate: () => new Date() }),
  fromDate: (date: Date) => ({ toISOString: () => date.toISOString(), toDate: () => date })
};

export const serverTimestamp = () => new Date().toISOString();

export const increment = (n: number) => ({ __increment: n });

export async function getDocFromServer(docRef: any) {
  return getDoc(docRef);
}

export function writeBatch(dbInstance?: any) {
  return {
    set: (docRef: any, data: any) => updateDoc(docRef, data),
    update: (docRef: any, data: any) => updateDoc(docRef, data),
    delete: (docRef: any) => deleteDoc(docRef),
    commit: async () => {}
  } as any;
}

export async function getCountFromServer(queryRef: any) {
  const snap = await getDocs(queryRef);
  return {
    data: () => ({ count: snap.size })
  } as any;
}

// Mock Auth exports for compatibility with a reactive getter for currentUser
export const auth = {
  get currentUser() {
    const stored = localStorage.getItem('bakery_user');
    if (!stored) return null;
    try {
      const user = JSON.parse(stored);
      return {
        uid: user.id || user.uid,
        email: user.email,
        displayName: user.name || user.displayName,
        ...user
      };
    } catch (e) {
      return null;
    }
  },
  signOut: async () => {
    localStorage.removeItem('bakery_user');
    localStorage.removeItem('bakery_token');
  }
} as any;
export const googleProvider = {};
export const signInWithPopup = async () => {
  throw new Error('Google login is disabled. Please use local credentials.');
};
export const signOut = async () => {
  localStorage.removeItem('bakery_user');
  localStorage.removeItem('bakery_token');
};
export const onAuthStateChanged = (auth: any, cb: any) => {
  // Simple periodic check for locality or just return unsubscribe
  return () => {};
};
export type User = any;
