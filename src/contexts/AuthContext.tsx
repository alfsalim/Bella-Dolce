import React, { createContext, useContext, useState, useEffect } from 'react';
import { db, doc, getDoc, setDoc, collection, query, where, getDocs, deleteDoc } from '../lib/firebase';
import { UserProfile, Role } from '../types';

interface AuthContextType {
  user: any | null;
  profile: UserProfile | null;
  permissions: string[] | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, name: string, role?: Role) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [permissions, setPermissions] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedUser = localStorage.getItem('bakery_user');
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          setUser(userData);
          setProfile(userData as UserProfile);
          
          // Fetch permissions
          if (userData.role === 'admin') {
            setPermissions(['*']);
          } else {
            const permSnap = await getDoc(doc(db, 'rolePermissions', userData.role));
            if (permSnap.exists()) {
              setPermissions(permSnap.data().allowedPaths);
            } else {
              setPermissions([]);
            }
          }
        }
      } catch (error) {
        console.error('Error initializing local auth:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Invalid credentials');
      }

      const { user: userData, token } = await res.json();
      setUser(userData);
      setProfile(userData as UserProfile);
      localStorage.setItem('bakery_user', JSON.stringify(userData));
      localStorage.setItem('bakery_token', token);

      // Fetch permissions
      if (userData.role === 'admin') {
        setPermissions(['*']);
      } else {
        const permSnap = await getDoc(doc(db, 'rolePermissions', userData.role));
        if (permSnap.exists()) {
          setPermissions(permSnap.data().allowedPaths);
        } else {
          setPermissions([]);
        }
      }
    } catch (error: any) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const register = async (username: string, password: string, name: string, role: Role = 'customer_customers') => {
    try {
      const email = `${username.toLowerCase()}@bakery.local`;
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, name, email, role })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Registration failed');
      }

      const { user: userData } = await res.json();
      setUser(userData);
      setProfile(userData as UserProfile);
      localStorage.setItem('bakery_user', JSON.stringify(userData));

      // Fetch permissions
      if (userData.role === 'admin') {
        setPermissions(['*']);
      } else {
        const permSnap = await getDoc(doc(db, 'rolePermissions', userData.role));
        if (permSnap.exists()) {
          setPermissions(permSnap.data().allowedPaths);
        } else {
          setPermissions([]);
        }
      }
    } catch (error: any) {
      console.error('Registration failed:', error);
      throw error;
    }
  };

  const logout = async () => {
    setUser(null);
    setProfile(null);
    setPermissions(null);
    localStorage.removeItem('bakery_user');
    localStorage.removeItem('bakery_token');
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
