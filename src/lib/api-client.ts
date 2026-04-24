import { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged } from './firebase-auth-only';

export const db = {
  // Mock db object that will be used by our compatibility layer
};

export async function getDocsFromApi(collectionPath: string, queryParams?: any) {
  const url = new URL(`/api/db/${collectionPath}`, window.location.origin);
  if (queryParams) {
    if (queryParams.where) url.searchParams.set('where', JSON.stringify(queryParams.where));
    if (queryParams.orderBy) url.searchParams.set('orderBy', JSON.stringify(queryParams.orderBy));
    if (queryParams.limit) url.searchParams.set('take', queryParams.limit.toString());
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return {
    docs: data.map((item: any) => ({
      id: item.id,
      data: () => item,
      exists: () => true
    })),
    empty: data.length === 0,
    size: data.length
  };
}

export async function getDocFromApi(collectionPath: string, id: string) {
  const res = await fetch(`/api/db/${collectionPath}/${id}`);
  if (!res.ok) throw new Error(await res.text());
  const item = await res.json();
  return {
    id: item.id,
    data: () => item,
    exists: () => !!item
  };
}

export async function addDocToApi(collectionPath: string, data: any) {
  const res = await fetch(`/api/db/${collectionPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(await res.text());
  const item = await res.json();
  return { id: item.id };
}

export async function setDocToApi(collectionPath: string, id: string, data: any, options?: { merge?: boolean }) {
  // For simplicity, we'll use PUT which handles both create and update in our API
  const res = await fetch(`/api/db/${collectionPath}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function updateDocInApi(collectionPath: string, id: string, data: any) {
  const res = await fetch(`/api/db/${collectionPath}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function deleteDocFromApi(collectionPath: string, id: string) {
  const res = await fetch(`/api/db/${collectionPath}/${id}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

// Emulating onSnapshot with long polling or just a simple interval for now
export function onSnapshotMock(query: any, callback: (snapshot: any) => void) {
  const { path, params } = query;
  
  const fetchData = async () => {
    try {
      const snap = await getDocsFromApi(path, params);
      callback(snap);
    } catch (error) {
      console.error('Snapshot error:', error);
    }
  };

  fetchData();
  const interval = setInterval(fetchData, 5000); // Poll every 5 seconds
  return () => clearInterval(interval);
}

export { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged };
