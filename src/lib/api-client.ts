export const db = {
  // Mock db object that will be used by our compatibility layer
};

export function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('bakery_token');
  const base: HeadersInit = { 'Content-Type': 'application/json' };
  return token ? { ...base, 'Authorization': `Bearer ${token}` } : base;
}

/** Prefer server `error` / `message` JSON fields for readable UI messages. */
export async function readApiErrorMessage(res: Response): Promise<string> {
  const text = (await res.text()).trim();
  if (!text) return res.statusText || `Request failed (${res.status})`;
  try {
    const data = JSON.parse(text) as { error?: string; message?: string };
    if (typeof data.error === 'string' && data.error.length > 0) return data.error;
    if (typeof data.message === 'string' && data.message.length > 0) return data.message;
  } catch {
    /* plain text body */
  }
  return text.length > 400 ? `${text.slice(0, 400)}…` : text;
}

/**
 * Parse a successful JSON response. Many stacks return index.html with 200 for unknown /api routes;
 * `res.json()` then throws "Unexpected token '<'".
 */
export async function parseJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed || trimmed.startsWith('<')) {
    throw new Error(
      'API returned HTML instead of JSON. Use the full app server (npm run dev runs Express + API). If you only start Vite, API routes like /api/auth/* are missing.'
    );
  }
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new Error(
      trimmed.length > 180 ? `Invalid JSON: ${trimmed.slice(0, 180)}…` : `Invalid JSON: ${trimmed || '(empty)'}`
    );
  }
}

/** Dispatches `bakery_auth_error` on 401 so AuthContext can redirect to login. */
export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status === 401) {
    window.dispatchEvent(new Event('bakery_auth_error'));
    throw new Error('Unauthorized');
  }
  return res;
}

export async function getDocsFromApi(collectionPath: string, queryParams?: any) {
  const url = new URL(`/api/db/${collectionPath}`, window.location.origin);
  if (queryParams) {
    if (queryParams.where) url.searchParams.set('where', JSON.stringify(queryParams.where));
    if (queryParams.orderBy) url.searchParams.set('orderBy', JSON.stringify(queryParams.orderBy));
    if (queryParams.limit) url.searchParams.set('take', queryParams.limit.toString());
    if (queryParams.includeDisabled) url.searchParams.set('includeDisabled', '1');
  }
  const res = await authFetch(url.toString(), { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(await readApiErrorMessage(res));
  const data = await res.json();
  return {
    docs: data.map((item: any) => ({
      id: item.id,
      data: () => item,
      exists: () => true,
      ref: { collectionName: collectionPath, id: item.id }
    })),
    empty: data.length === 0,
    size: data.length
  };
}

export async function getDocFromApi(collectionPath: string, id: string) {
  const res = await authFetch(`/api/db/${collectionPath}/${id}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(await readApiErrorMessage(res));
  const item = await res.json();
  return {
    id: item?.id || id,
    data: () => item,
    exists: () => !!item,
    ref: { collectionName: collectionPath, id: item?.id || id }
  };
}

export async function addDocToApi(collectionPath: string, data: any) {
  const res = await authFetch(`/api/db/${collectionPath}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(await readApiErrorMessage(res));
  const item = await res.json();
  return { id: item.id };
}

export async function setDocToApi(collectionPath: string, id: string, data: any, options?: { merge?: boolean }) {
  // For simplicity, we'll use PUT which handles both create and update in our API
  const res = await authFetch(`/api/db/${collectionPath}/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(await readApiErrorMessage(res));
  return await res.json();
}

export async function updateDocInApi(collectionPath: string, id: string, data: any) {
  const res = await authFetch(`/api/db/${collectionPath}/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(await readApiErrorMessage(res));
  return await res.json();
}

export async function deleteDocFromApi(collectionPath: string, id: string) {
  const res = await authFetch(`/api/db/${collectionPath}/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error(await readApiErrorMessage(res));
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

