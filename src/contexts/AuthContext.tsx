import React, { createContext, useContext, useState, useEffect } from 'react';
import { authFetch, readApiErrorMessage, parseJsonResponse } from '../lib/api-client';
import { UserProfile, Role, RegisterOptions } from '../types';

interface AuthContextType {
  user: any | null;
  profile: UserProfile | null;
  permissions: string[] | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (
    username: string,
    password: string,
    name: string,
    role?: Role,
    options?: RegisterOptions
  ) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function normalizeAllowedPaths(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === 'string');
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }
  return [];
}

const PERMS_KEY = 'bakery_permissions';

function storePermissions(paths: string[]) {
  localStorage.setItem(PERMS_KEY, JSON.stringify(paths));
}

function loadStoredPermissions(role: string | undefined): string[] | null {
  if (role === 'admin') return ['*'];
  const raw = localStorage.getItem(PERMS_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : null;
  } catch {
    return null;
  }
}

/** Fetch permissions from the server. Tries the dedicated endpoint first, then the DB collection endpoint. */
async function fetchPermissionsFromServer(role: string): Promise<string[]> {
  if (role === 'admin') return ['*'];
  const token = localStorage.getItem('bakery_token');
  if (!token) return [];

  // 1. Dedicated auth endpoint (new server builds)
  try {
    const res = await authFetch('/api/auth/role-permissions');
    if (res.ok) {
      const data = await parseJsonResponse<{ allowedPaths?: unknown }>(res);
      const paths = normalizeAllowedPaths(data.allowedPaths);
      if (paths.length > 0) return paths;
    }
  } catch { /* fall through */ }

  // 2. DB collection endpoint (works on all server builds — each user can read their own row)
  try {
    const res = await authFetch(`/api/db/rolePermissions/${encodeURIComponent(role)}`);
    if (res.ok) {
      const data = await parseJsonResponse<{ allowedPaths?: unknown }>(res);
      const paths = normalizeAllowedPaths(data.allowedPaths);
      if (paths.length > 0) return paths;
    }
  } catch { /* fall through */ }

  return [];
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [permissions, setPermissions] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleAuthError = () => {
      console.warn('Authentication error detected, logging out...');
      logout();
    };
    window.addEventListener('bakery_auth_error', handleAuthError);

    const initAuth = async () => {
      try {
        const storedUser = localStorage.getItem('bakery_user');
        const storedToken = localStorage.getItem('bakery_token');

        if (storedUser && storedToken) {
          const userData = JSON.parse(storedUser);
          // Prefer fresh permissions from the server; fall back to the
          // localStorage cache when the server returns empty (e.g. endpoint
          // not yet available or under restart). This avoids stranding users
          // with empty permissions while the server warms up.
          let perms = await fetchPermissionsFromServer(userData.role);
          if (perms.length === 0 && userData.role !== 'admin') {
            const cached = loadStoredPermissions(userData.role);
            if (cached && cached.length > 0) perms = cached;
          }
          storePermissions(perms);
          setUser(userData);
          setProfile(userData as UserProfile);
          setPermissions(perms);
        } else {
          if (storedUser || storedToken) logout();
        }
      } catch (error) {
        console.error('Error initializing local auth:', error);
        logout();
      } finally {
        setLoading(false);
      }
    };

    initAuth();
    return () => window.removeEventListener('bakery_auth_error', handleAuthError);
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        throw new Error(await readApiErrorMessage(res));
      }

      const data = await parseJsonResponse<{ user: any; token: string; allowedPaths?: unknown }>(res);
      const { user: userData, token } = data;

      // Store the token first so fetchPermissionsFromServer can use it.
      localStorage.setItem('bakery_user', JSON.stringify(userData));
      localStorage.setItem('bakery_token', token);

      let nextPermissions: string[] =
        userData.role === 'admin' ? ['*'] : normalizeAllowedPaths(data.allowedPaths);

      // If the login response didn't include allowedPaths (old server build),
      // fetch from the dedicated endpoint using the fresh token.
      if (nextPermissions.length === 0 && userData.role !== 'admin') {
        nextPermissions = await fetchPermissionsFromServer(userData.role);
      }

      storePermissions(nextPermissions);
      setUser(userData);
      setProfile(userData as UserProfile);
      setPermissions(nextPermissions);
    } catch (error: any) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const register = async (
    username: string,
    password: string,
    name: string,
    role: Role = 'customer_customers',
    options?: RegisterOptions
  ) => {
    try {
      const email = `${username.toLowerCase()}@bakery.local`;
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          name,
          email,
          role,
          phone: options?.phone,
          companyRegistrationNumber: options?.companyRegistrationNumber,
        }),
      });

      if (!res.ok) {
        throw new Error(await readApiErrorMessage(res));
      }

      const data = await parseJsonResponse<{ user: any; token?: string; allowedPaths?: unknown }>(res);
      const { user: userData, token } = data;

      const nextPermissions =
        userData.role === 'admin' ? ['*'] : normalizeAllowedPaths(data.allowedPaths);

      localStorage.setItem('bakery_user', JSON.stringify(userData));
      if (token) localStorage.setItem('bakery_token', token);
      storePermissions(nextPermissions);

      setUser(userData);
      setProfile(userData as UserProfile);
      setPermissions(nextPermissions);
    } catch (error: any) {
      console.error('Registration failed:', error);
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    setProfile(null);
    setPermissions(null);
    localStorage.removeItem('bakery_user');
    localStorage.removeItem('bakery_token');
    localStorage.removeItem(PERMS_KEY);
    if (!window.location.pathname.startsWith('/login')) {
      window.location.replace('/login');
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, permissions, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
