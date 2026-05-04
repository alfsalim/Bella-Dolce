import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { db, collection, onSnapshot, query, orderBy, updateDoc, doc, addDoc, setDoc, deleteDoc, getDocs, getDoc, isAuthError } from '../lib/firebase-compat';
import { UserProfile, ActivityLog, Role, RolePermission, Promotion, Product, RawMaterial } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { DEFAULT_PERMISSIONS } from '../lib/seedData';
import { Settings as SettingsIcon, Users as UsersIcon, Activity, Shield, Globe, Bell, Save, UserPlus, MoreVertical, ShieldCheck, ShieldAlert, Calendar, Search, CheckCircle2, XCircle, RefreshCw, Image as ImageIcon, Plus, Edit2, Trash2, X, Database, Sparkles } from 'lucide-react';
import UsersPage from './Users';
import AIManager from './AIManager';
import { clsx } from 'clsx';
import { format, addDays } from 'date-fns';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';

import { logActivity } from '../lib/logger';
import { compressImage } from '../lib/utils';
import { PAGE_SIZE } from '../constants';
import Pagination from '../components/Pagination';
import { authFetch } from '../lib/api-client';
import {
  notifySystemAlertsPreferenceChanged,
  SYSTEM_ALERTS_PREFERENCE_EVENT,
} from '../lib/systemAlertsPreference';

const Settings: React.FC = () => {
  const { t, isRTL, language, setLanguage, isBilingual, toggleBilingual, tRole } = useLanguage();
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'general' | 'users' | 'roles' | 'logs' | 'promotions' | 'aiManager' | 'data'>('general');
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => document.documentElement.classList.contains('dark'));
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  const [backupConfig, setBackupConfig] = useState<{ enabled: boolean; time: string }>({ enabled: true, time: '23:59' });
  const [backups, setBackups] = useState<{ filename: string; size: number; createdAt: string }[]>([]);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState<string | null>(null);
  const [backupListError, setBackupListError] = useState<string | null>(null);
  const [logsPage, setLogsPage] = useState(1);
  const [promoFormData, setPromoFormData] = useState<Partial<Promotion>>({
    title: '',
    description: '',
    imageUrl: '',
    expiryDate: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
    active: true,
    type: 'banner'
  });
  const [systemAlertsOn, setSystemAlertsOn] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem('systemAlerts') === 'true'
  );

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    const sync = () => setSystemAlertsOn(localStorage.getItem('systemAlerts') === 'true');
    window.addEventListener('storage', sync);
    window.addEventListener(SYSTEM_ALERTS_PREFERENCE_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(SYSTEM_ALERTS_PREFERENCE_EVENT, sync);
    };
  }, []);

  useEffect(() => {
    if (searchParams.get('tab') !== 'ai-manager') return;
    if (!profile) return;
    if (profile.role === 'admin') setActiveTab('aiManager');
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('tab');
        return next;
      },
      { replace: true }
    );
  }, [profile, searchParams, setSearchParams]);

  const formatBackupSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const saveBackupConfig = async () => {
    const token = localStorage.getItem('bakery_token');
    const headers: HeadersInit = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    try {
      const res = await authFetch('/api/db/settings/backup_config', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ id: 'backup_config', ...backupConfig }),
      });
      if (!res.ok) throw new Error();
      toast.success(t('save'));
    } catch {
      toast.error(t('backupFailed'));
    }
  };

  const triggerBackup = async () => {
    setIsBackingUp(true);
    const token = localStorage.getItem('bakery_token');
    const authHeaders: HeadersInit = { Authorization: `Bearer ${token}` };
    try {
      const r = await authFetch('/api/backup/trigger', {
        method: 'POST',
        headers: authHeaders,
      });
      if (!r.ok) throw new Error();
      const data = await r.json();
      toast.success(`${t('backupSuccess')}: ${data.filename}`);
      const list = await authFetch('/api/backup/list', { headers: authHeaders });
      if (list.ok) {
        const raw = await list.json();
        setBackups(Array.isArray(raw) ? raw : []);
        setBackupListError(null);
      }
    } catch {
      toast.error(t('backupFailed'));
    } finally {
      setIsBackingUp(false);
    }
  };

  const restoreBackup = async (filename: string) => {
    if (!window.confirm(t('restoreConfirm'))) return;
    setIsRestoring(filename);
    const token = localStorage.getItem('bakery_token');
    try {
      const r = await authFetch(`/api/backup/restore/${encodeURIComponent(filename)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || 'restore failed');
      }
      toast.success(t('restoreSuccess'));
    } catch {
      toast.error(t('restoreFailed'));
    } finally {
      setIsRestoring(null);
    }
  };

  useEffect(() => {
    if (activeTab !== 'data' || !isAdmin) return;
    const token = localStorage.getItem('bakery_token');
    const headers: HeadersInit = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    void authFetch('/api/db/settings/backup_config', { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((doc) => {
        if (!doc) return;
        if (typeof doc.enabled === 'boolean' && typeof doc.time === 'string') {
          setBackupConfig({ enabled: doc.enabled, time: doc.time });
        } else if (doc.data && typeof doc.data === 'string') {
          try {
            const p = JSON.parse(doc.data);
            setBackupConfig({
              enabled: p.enabled !== false,
              time: typeof p.time === 'string' ? p.time : '23:59',
            });
          } catch {
            /* keep default */
          }
        }
      })
      .catch(() => {
        /* 401 handled by authFetch */
      });
    const loadBackups = async () => {
      if (!token) {
        setBackupListError(t('backupListError'));
        setBackups([]);
        return;
      }
      try {
        const r = await authFetch('/api/backup/list', { headers: { Authorization: `Bearer ${token}` } });
        if (r.status === 403) {
          setBackupListError(t('backupAccessDenied'));
          setBackups([]);
          return;
        }
        if (!r.ok) {
          setBackupListError(t('backupListError'));
          setBackups([]);
          return;
        }
        const data = await r.json();
        setBackupListError(null);
        setBackups(Array.isArray(data) ? data : []);
      } catch {
        setBackupListError(t('backupListError'));
        setBackups([]);
      }
    };
    void loadBackups();
  }, [activeTab, isAdmin, language]);

  useEffect(() => {
    if (activeTab === 'logs') setLogsPage(1);
  }, [activeTab]);

  useEffect(() => {
    const totalPages = Math.ceil(logs.length / PAGE_SIZE) || 1;
    setLogsPage((p) => Math.min(p, totalPages));
  }, [logs.length, PAGE_SIZE]);

  const { auditLogTotalPages, pagedAuditLogs } = useMemo(() => {
    const totalPages = Math.ceil(logs.length / PAGE_SIZE) || 1;
    const slice = logs.slice((logsPage - 1) * PAGE_SIZE, logsPage * PAGE_SIZE);
    return { auditLogTotalPages: totalPages, pagedAuditLogs: slice };
  }, [logs, logsPage, PAGE_SIZE]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'promotions'), (snapshot) => {
      setPromotions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Promotion)));
    });
    return () => unsubscribe();
  }, []);

  const handlePromoImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('imageTooLarge') || 'Image is too large (max 5MB)');
      return;
    }

    try {
      // Compress image to ensure it stays under Firestore 1MB limit
      const compressedBase64 = await compressImage(file, 1200, 800, 0.6);
      setPromoFormData({ ...promoFormData, imageUrl: compressedBase64 });
    } catch (error) {
      console.error("Error compressing image:", error);
      toast.error(t('errorUploadingImage'));
    }
  };

  const handleSavePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingPromo) {
        await updateDoc(doc(db, 'promotions', editingPromo.id), {
          ...promoFormData,
          updatedAt: new Date().toISOString()
        });
        toast.success(t('promoUpdated'));
      } else {
        await addDoc(collection(db, 'promotions'), {
          ...promoFormData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        toast.success(t('promoAdded'));
      }
      setIsPromoModalOpen(false);
      setEditingPromo(null);
      setPromoFormData({
        title: '',
        description: '',
        imageUrl: '',
        expiryDate: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
        active: true,
        type: 'banner'
      });
    } catch (error) {
      console.error("Error saving promotion:", error);
      toast.error(t('errorSavingPromo'));
    }
  };

  const handleDeletePromo = async (id: string) => {
    if (!window.confirm(t('confirmDeletePromo'))) return;
    try {
      await deleteDoc(doc(db, 'promotions', id));
      toast.success(t('promoDeleted'));
    } catch (error) {
      toast.error(t('errorDeletingPromo'));
    }
  };

  useEffect(() => {
    const performBackgroundCleanup = async () => {
      if (!isAdmin) return;
      
      try {
        // Check if cleanup has already been performed for the database
        const cleanupRef = doc(db, 'system', 'database_cleanup');
        const cleanupSnap = await getDoc(cleanupRef);
        
        if (cleanupSnap.exists() && cleanupSnap.data().performed) {
          return;
        }

        console.log("Starting one-time database cleanup...");
        setIsSeeding(true);
        // Reuse the logic from handleCleanDatabase
        const productsSnapshot = await getDocs(collection(db, 'products'));
        const allProducts = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
        
        const seenNames = new Set<string>();
        const duplicates: Product[] = [];
        
        const sortedProducts = [...allProducts].sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          if (dateB !== dateA) return dateB - dateA;
          return b.id.localeCompare(a.id);
        });
        
        for (const p of sortedProducts) {
          if (!p.name) continue;
          const nameKey = p.name.toLowerCase().trim().replace(/\s+/g, ' ');
          if (seenNames.has(nameKey)) {
            duplicates.push(p);
          } else {
            seenNames.add(nameKey);
          }
        }
        
        const materialsSnapshot = await getDocs(collection(db, 'rawMaterials'));
        const allMaterials = materialsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RawMaterial));
        
        let updatedMaterialsCount = 0;
        for (const m of allMaterials) {
          if (!m.brand || m.brand.trim() === '') {
            try {
              await updateDoc(doc(db, 'rawMaterials', m.id), { brand: 'Generic' });
              updatedMaterialsCount++;
            } catch (err) {
              console.error(`Failed to update material ${m.id}:`, err);
            }
          }
        }

        let deletedCount = 0;
        for (const p of duplicates) {
          try {
            await deleteDoc(doc(db, 'products', p.id));
            if (p.category === 'raw_material') {
              await deleteDoc(doc(db, 'rawMaterials', p.id));
            }
            deletedCount++;
          } catch (err) {
            console.error(`Failed to delete product ${p.id}:`, err);
          }
        }

        const seenMaterialNames = new Set<string>();
        const materialDuplicates: RawMaterial[] = [];
        for (const m of allMaterials) {
          if (!m.name) continue;
          const nameKey = m.name.toLowerCase().trim().replace(/\s+/g, ' ');
          if (seenMaterialNames.has(nameKey)) {
            materialDuplicates.push(m);
          } else {
            seenMaterialNames.add(nameKey);
          }
        }

        for (const m of materialDuplicates) {
          try {
            await deleteDoc(doc(db, 'rawMaterials', m.id));
            deletedCount++;
          } catch (err) {
            console.error(`Failed to delete material ${m.id}:`, err);
          }
        }

        if (deletedCount > 0 || updatedMaterialsCount > 0) {
          if (profile) {
            await logActivity(
              profile.id,
              profile.name,
              'background_cleanup',
              `Background cleanup: Deleted ${deletedCount} duplicates, Updated ${updatedMaterialsCount} materials.`
            );
          }
          toast.success(t('databaseCleanedSuccess').replace('{deleted}', deletedCount.toString()).replace('{updated}', updatedMaterialsCount.toString()));
        }
        
        // Mark cleanup as performed in Firestore
        await setDoc(doc(db, 'system', 'database_cleanup'), {
          performed: true,
          performedAt: new Date().toISOString(),
          performedBy: profile?.name || 'System'
        });
      } catch (error: any) {
        if (!isAuthError(error)) {
          console.error('Background cleanup error:', error);
        }
      } finally {
        setIsSeeding(false);
      }
    };

    performBackgroundCleanup();
  }, [isAdmin, profile]);

  const toggleDarkMode = () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('darkMode', isDark ? 'true' : 'false');
    setIsDarkMode(isDark);
  };

  const ALL_ROUTES = [
    { path: '/dashboard', label: 'dashboard' },
    { path: '/production', label: 'production' },
    { path: '/inventory', label: 'inventory' },
    { path: '/procurement', label: 'procurementAndSuppliers' },
    { path: '/customers', label: 'customers' },
    { path: '/product-management', label: 'recipesAndProducts' },
    { path: '/pos', label: 'pos' },
    { path: '/b2b', label: 'businessStore' },
    { path: '/orders', label: 'orders' },
    { path: '/finance', label: 'finance' },
    { path: '/reports', label: 'reports' },
    { path: '/settings', label: 'settings' },
  ];

  useEffect(() => {
    if (!isAdmin) return;

    const lq = query(collection(db, 'activityLogs'), orderBy('timestamp', 'desc'));
    const lUnsubscribe = onSnapshot(lq, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog)));
    }, (error) => {
      console.error('Error fetching logs:', error);
    });

    const pUnsubscribe = onSnapshot(collection(db, 'rolePermissions'), (snapshot) => {
      setRolePermissions(snapshot.docs.map(doc => ({ id: doc.id as Role, ...doc.data() } as RolePermission)));
    }, (error) => {
      console.error('Error fetching permissions:', error);
    });

    return () => {
      lUnsubscribe();
      pUnsubscribe();
    };
  }, [isAdmin]);

  if (profile && !isAdmin && activeTab !== 'general') {
    setActiveTab('general');
  }

  const handleTogglePermission = async (roleId: Role, path: string) => {
    if (roleId === 'admin') return;

    const rolePerm = rolePermissions.find(p => p.id === roleId);
    if (!rolePerm) return;

    const newPaths = rolePerm.allowedPaths.includes(path)
      ? rolePerm.allowedPaths.filter(p => p !== path)
      : [...rolePerm.allowedPaths, path];

    try {
      await setDoc(doc(db, 'rolePermissions', roleId), {
        allowedPaths: newPaths
      });
      toast.success(t('settingsUpdated'));
    } catch (error) {
      console.error('Error updating permissions:', error);
      toast.error(t('permissionsUpdateFailed'));
    }
  };

  const handleSeedPermissions = async () => {
    setIsSeeding(true);
    try {
      for (const perm of DEFAULT_PERMISSIONS) {
        await setDoc(doc(db, 'rolePermissions', perm.id), {
          allowedPaths: perm.allowedPaths
        });
      }
      toast.success(t('permissionsInitSuccess'));
    } catch (error) {
      console.error('Error seeding permissions:', error);
      toast.error(t('permissionsInitFailed'));
    } finally {
      setIsSeeding(false);
    }
  };

  const handleCleanDatabase = async () => {
    if (!window.confirm(t('confirmCleanDatabase'))) return;
    
    setIsSeeding(true);
    try {
      // 1. Clean Products (Duplicates)
      const productsSnapshot = await getDocs(collection(db, 'products'));
      const allProducts = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      
      const seenNames = new Set<string>();
      const duplicates: Product[] = [];
      
      // Sort by createdAt desc to keep the newest one, fallback to ID for stability
      const sortedProducts = [...allProducts].sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (dateB !== dateA) return dateB - dateA;
        return b.id.localeCompare(a.id);
      });
      
      for (const p of sortedProducts) {
        if (!p.name) continue;
        // More aggressive key: lowercase, trim, and collapse multiple spaces
        const nameKey = p.name.toLowerCase().trim().replace(/\s+/g, ' ');
        if (seenNames.has(nameKey)) {
          duplicates.push(p);
        } else {
          seenNames.add(nameKey);
        }
      }
      
      // 2. Update Raw Materials (Generic Brand)
      const materialsSnapshot = await getDocs(collection(db, 'rawMaterials'));
      const allMaterials = materialsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RawMaterial));
      
      let updatedMaterialsCount = 0;
      for (const m of allMaterials) {
        if (!m.brand || m.brand.trim() === '') {
          try {
            await updateDoc(doc(db, 'rawMaterials', m.id), {
              brand: 'Generic'
            });
            updatedMaterialsCount++;
          } catch (err) {
            console.error(`Failed to update material ${m.id}:`, err);
          }
        }
      }

      // 3. Seed Role Permissions
      try {
        for (const perm of DEFAULT_PERMISSIONS) {
          await setDoc(doc(db, 'rolePermissions', perm.id), {
            allowedPaths: perm.allowedPaths
          });
        }
      } catch (err) {
        console.error('Failed to seed role permissions:', err);
      }
      
      let deletedCount = 0;
      if (duplicates.length > 0) {
        for (const p of duplicates) {
          try {
            await deleteDoc(doc(db, 'products', p.id));
            // Also delete linked raw material if it exists
            if (p.category === 'raw_material') {
              await deleteDoc(doc(db, 'rawMaterials', p.id));
            }
            deletedCount++;
          } catch (err) {
            console.error(`Failed to delete product ${p.id}:`, err);
          }
        }
      }

      // 4. Clean Raw Materials Duplicates (not linked to products)
      const seenMaterialNames = new Set<string>();
      const materialDuplicates: RawMaterial[] = [];
      for (const m of allMaterials) {
        if (!m.name) continue;
        const nameKey = m.name.toLowerCase().trim().replace(/\s+/g, ' ');
        if (seenMaterialNames.has(nameKey)) {
          materialDuplicates.push(m);
        } else {
          seenMaterialNames.add(nameKey);
        }
      }

      for (const m of materialDuplicates) {
        try {
          await deleteDoc(doc(db, 'rawMaterials', m.id));
          deletedCount++;
        } catch (err) {
          console.error(`Failed to delete material ${m.id}:`, err);
        }
      }

      if (deletedCount === 0 && updatedMaterialsCount === 0) {
        toast.success(t('noDuplicatesFound'));
      } else {
        const successMsg = t('databaseCleanedSuccess')
          .replace('{deleted}', deletedCount.toString())
          .replace('{updated}', updatedMaterialsCount.toString());
        toast.success(successMsg);
      }
      
      if (profile) {
        await logActivity(
          profile.id,
          profile.name,
          'database_cleanup',
          `Database cleanup: Deleted ${deletedCount} duplicate products, Updated ${updatedMaterialsCount} raw materials with Generic brand, Seeded role permissions.`
        );
      }
    } catch (error) {
      console.error('Error cleaning database:', error);
      toast.error(t('errorCleaningDatabase'));
    } finally {
      setIsSeeding(false);
    }
  };

  const sortedRolePermissions = [...rolePermissions].sort((a, b) => {
    const order = ['admin', 'manager', 'cashier', 'baker', 'delivery_guy', 'inventory', 'customer_business', 'customer_customers'];
    return order.indexOf(a.id) - order.indexOf(b.id);
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white">{t('settings')}</h1>
          <p className="text-zinc-500 font-medium">{t('settingsPageSubtitle')}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-zinc-900 rounded-2xl w-fit overflow-x-auto max-w-full border border-slate-200 dark:border-white/5">
        <button 
          onClick={() => setActiveTab('general')}
          className={clsx(
            "px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap",
            activeTab === 'general' 
              ? "bg-amber-600 text-white shadow-lg shadow-amber-600/20" 
              : "text-slate-500 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-zinc-200"
          )}
        >
          <SettingsIcon className="w-4 h-4" />
          {t('general')}
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={clsx(
            "px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap",
            activeTab === 'users'
              ? "bg-amber-600 text-white shadow-lg shadow-amber-600/20"
              : "text-slate-500 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-zinc-200"
          )}
        >
          <UsersIcon className="w-4 h-4" />
          {t('users')}
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={clsx(
            "px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap",
            activeTab === 'roles'
              ? "bg-amber-600 text-white shadow-lg shadow-amber-600/20"
              : "text-slate-500 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-zinc-200"
          )}
        >
          <Shield className="w-4 h-4" />
          {t('roleManagement')}
        </button>
        <button 
          onClick={() => setActiveTab('logs')}
          className={clsx(
            "px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap",
            activeTab === 'logs' 
              ? "bg-amber-600 text-white shadow-lg shadow-amber-600/20" 
              : "text-slate-500 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-zinc-200"
          )}
        >
          <Activity className="w-4 h-4" />
          {t('auditLog')}
        </button>
        <button 
          onClick={() => setActiveTab('promotions')}
          className={clsx(
            "px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap",
            activeTab === 'promotions' 
              ? "bg-amber-600 text-white shadow-lg shadow-amber-600/20" 
              : "text-slate-500 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-zinc-200"
          )}
        >
          <ImageIcon className="w-4 h-4" />
          {t('promotions')}
        </button>
        {isAdmin && (
          <button
            onClick={() => setActiveTab('aiManager')}
            className={clsx(
              "px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap",
              activeTab === 'aiManager'
                ? "bg-amber-600 text-white shadow-lg shadow-amber-600/20"
                : "text-slate-500 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-zinc-200"
            )}
          >
            <Sparkles className="w-4 h-4" />
            {t('aiManager')}
          </button>
        )}
        {isAdmin && (
          <button
            onClick={() => setActiveTab('data')}
            className={clsx(
              "px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap",
              activeTab === 'data'
                ? "bg-amber-600 text-white shadow-lg shadow-amber-600/20"
                : "text-slate-500 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-zinc-200"
            )}
          >
            <Database className="w-4 h-4" />
            {t('dataManagement')}
          </button>
        )}
      </div>

      {activeTab === 'users' && (
        <UsersPage />
      )}

      {activeTab === 'general' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 border border-slate-100 dark:border-white/10 shadow-sm dark:shadow-none space-y-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Globe className="w-5 h-5 text-amber-500" />
              {t('language')}
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-black rounded-2xl border border-slate-100 dark:border-white/5">
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">{t('french')}</p>
                  <p className="text-xs text-zinc-500">{t('settingsLangNativeFr')}</p>
                </div>
                <input 
                  type="radio" 
                  name="lang" 
                  checked={language === 'fr'} 
                  onChange={() => setLanguage('fr')}
                  className="w-5 h-5 text-amber-600 focus:ring-amber-500 bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700"
                />
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-black rounded-2xl border border-slate-100 dark:border-white/5">
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">{t('arabic')}</p>
                  <p className="text-xs text-zinc-500 font-arabic">العربية</p>
                </div>
                <input 
                  type="radio" 
                  name="lang" 
                  checked={language === 'ar'} 
                  onChange={() => setLanguage('ar')}
                  className="w-5 h-5 text-amber-600 focus:ring-amber-500 bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700"
                />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 border border-slate-100 dark:border-white/10 shadow-sm dark:shadow-none space-y-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-500" />
              {t('systemAlerts')}
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-black rounded-2xl border border-slate-100 dark:border-white/5">
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">{t('darkMode')}</p>
                  <p className="text-xs text-zinc-500">{t('settingsDarkModeHelp')}</p>
                </div>
                <button 
                  onClick={toggleDarkMode}
                  className={clsx(
                    "w-12 h-6 rounded-full relative transition-all",
                    isDarkMode ? "bg-amber-600" : "bg-slate-200 dark:bg-zinc-800"
                  )}
                >
                  <div className={clsx(
                    "absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all",
                    isDarkMode ? "right-1" : "left-1"
                  )}></div>
                </button>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-black rounded-2xl border border-slate-100 dark:border-white/5">
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">{t('systemAlerts')}</p>
                  <p className="text-xs text-zinc-500">{t('settingsOrderAlertsHelp')}</p>
                </div>
                <button 
                  type="button"
                  onClick={() => {
                    const next = !systemAlertsOn;
                    localStorage.setItem('systemAlerts', String(next));
                    setSystemAlertsOn(next);
                    notifySystemAlertsPreferenceChanged();
                    window.dispatchEvent(new Event('storage'));
                  }}
                  className={clsx(
                    "w-12 h-6 rounded-full relative transition-all",
                    systemAlertsOn ? "bg-amber-600" : "bg-slate-200 dark:bg-zinc-800"
                  )}
                >
                  <div className={clsx(
                    "absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all",
                    systemAlertsOn ? "right-1" : "left-1"
                  )}></div>
                </button>
              </div>
              {/* Background cleanup is now handled automatically for admins */}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'roles' && (
        <div className="space-y-6">
          {rolePermissions.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-12 border border-slate-100 dark:border-white/10 shadow-sm dark:shadow-none text-center">
              <Shield className="w-16 h-16 text-slate-400 dark:text-zinc-600 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{t('noRolePermissionsTitle')}</h3>
              <p className="text-zinc-500 mb-6 max-w-md mx-auto">
                {t('noRolePermissionsBody')}
              </p>
              <button 
                onClick={handleSeedPermissions}
                disabled={isSeeding}
                className="px-6 py-2 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-500 transition-all shadow-lg shadow-amber-600/20 flex items-center justify-center gap-2 mx-auto"
              >
                {isSeeding ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
                {t('initializePermissions')}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1 space-y-4">
                {sortedRolePermissions.map((role) => (
                  <button
                    key={role.id}
                    onClick={() => setEditingRole(role.id)}
                    className={clsx(
                      "w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between group",
                      editingRole === role.id 
                        ? "bg-amber-600/10 border-amber-600/50 text-amber-500 shadow-sm" 
                        : "bg-white dark:bg-zinc-900 border-slate-100 dark:border-white/10 text-slate-500 dark:text-zinc-400 hover:border-amber-600/30 hover:bg-slate-50 dark:hover:bg-zinc-800"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={clsx(
                        "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                        editingRole === role.id 
                          ? "bg-amber-600/20 text-amber-500" 
                          : "bg-slate-50 dark:bg-black text-slate-400 dark:text-zinc-600 group-hover:bg-slate-100 dark:group-hover:bg-zinc-700"
                      )}>
                        <Shield className="w-5 h-5" />
                      </div>
                        <span className="font-bold capitalize">{tRole(role.id)}</span>
                    </div>
                    {role.id === 'admin' && (
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    )}
                  </button>
                ))}
              </div>

              <div className="md:col-span-2">
                {editingRole ? (
                  <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 border border-slate-100 dark:border-white/10 shadow-sm dark:shadow-none space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white capitalize">{tRole(editingRole)}</h3>
                        <p className="text-sm text-zinc-500">{t('permissions')}</p>
                      </div>
                      {editingRole === 'admin' && (
                        <span className="px-3 py-1 bg-emerald-900/20 text-emerald-400 text-xs font-bold rounded-full border border-emerald-800">
                          {t('adminRoleImmutable')}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {ALL_ROUTES.map((route) => {
                        const isAllowed = editingRole === 'admin' || 
                          rolePermissions.find(p => p.id === editingRole)?.allowedPaths.includes(route.path);
                        
                        return (
                          <button
                            key={route.path}
                            disabled={editingRole === 'admin'}
                            onClick={() => handleTogglePermission(editingRole, route.path)}
                            className={clsx(
                              "p-4 rounded-2xl border flex items-center justify-between transition-all",
                              isAllowed 
                                ? "bg-emerald-900/20 border-emerald-800 text-emerald-400" 
                                : "bg-slate-50 dark:bg-black border-slate-100 dark:border-white/5 text-slate-400 dark:text-zinc-600 hover:border-slate-200 dark:hover:border-white/10"
                            )}
                          >
                            <span className="font-medium">{t(route.label)}</span>
                            {isAllowed ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            ) : (
                              <XCircle className="w-5 h-5 text-slate-400 dark:text-zinc-600" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-zinc-900 rounded-[32px] h-full flex flex-col items-center justify-center text-center p-12 text-slate-400 dark:text-zinc-600 border border-slate-100 dark:border-white/10 shadow-sm dark:shadow-none">
                    <Shield className="w-16 h-16 mb-4 text-slate-400 dark:text-zinc-600 opacity-20" />
                    <p className="font-medium">{t('selectRoleForPermissions')}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="bg-white dark:bg-zinc-900 rounded-[32px] overflow-hidden border border-slate-100 dark:border-white/10 shadow-sm dark:shadow-none">
          <div className="p-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-amber-500" />
              {t('auditLog')}
            </h2>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {pagedAuditLogs.map((log) => (
              <div key={log.id} className="p-6 hover:bg-slate-50 dark:hover:bg-black/40 transition-all">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-black flex items-center justify-center text-zinc-500">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-bold text-slate-900 dark:text-white">{log.userName}</p>
                      <p className="text-xs text-zinc-500 font-medium">
                        {log.timestamp ? format(new Date(log.timestamp), 'MMM dd, HH:mm') : t('notAvailableShort')}
                      </p>
                    </div>
                    <p className="text-sm text-zinc-400">
                      <span className="font-bold text-amber-500">{log.action}</span>: {log.details}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {logs.length === 0 && (
              <div className="p-12 text-center">
                <Activity className="w-12 h-12 text-slate-400 dark:text-zinc-600 mx-auto mb-4" />
                <p className="text-zinc-500 font-medium">{t('noAuditLogsEmpty')}</p>
              </div>
            )}
          </div>
          <Pagination
            currentPage={logsPage}
            totalPages={auditLogTotalPages}
            onPageChange={setLogsPage}
          />
        </div>
      )}
      {activeTab === 'promotions' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('promotions')}</h2>
              <p className="text-sm text-zinc-500">{t('promotionsPageSubtitle')}</p>
            </div>
            <button 
              onClick={() => {
                setEditingPromo(null);
                setPromoFormData({
                  title: '',
                  description: '',
                  imageUrl: '',
                  expiryDate: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
                  active: true,
                  type: 'banner'
                });
                setIsPromoModalOpen(true);
              }}
              className="btn-primary gap-2"
            >
              <Plus className="w-4 h-4" />
              {t('addPromotion')}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {promotions.map((promo) => (
              <div key={promo.id} className="bg-white dark:bg-zinc-900 rounded-[32px] border border-slate-100 dark:border-white/10 shadow-sm dark:shadow-none overflow-hidden group">
                <div className="h-40 bg-slate-100 dark:bg-black relative">
                  {promo.imageUrl ? (
                    <img src={promo.imageUrl} alt={promo.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 dark:text-zinc-600">
                      <ImageIcon className="w-12 h-12" />
                    </div>
                  )}
                  <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    <button 
                      onClick={() => {
                        setEditingPromo(promo);
                        setPromoFormData(promo);
                        setIsPromoModalOpen(true);
                      }}
                      className="p-2 bg-black/90 backdrop-blur-sm rounded-lg text-zinc-400 hover:text-amber-500 shadow-lg"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDeletePromo(promo.id)}
                      className="p-2 bg-black/90 backdrop-blur-sm rounded-lg text-zinc-400 hover:text-red-500 shadow-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-slate-900 dark:text-white">{promo.title}</h3>
                    <span className={clsx(
                      "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      promo.active ? "bg-green-900/20 text-green-400" : "bg-slate-100 dark:bg-zinc-900/20 text-zinc-400"
                    )}>
                      {promo.active ? t('active') : t('inactive')}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-500 mb-4 line-clamp-2">{promo.description}</p>
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{t('promoExpiresOn')}: {format(new Date(promo.expiryDate), 'PPP')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {isPromoModalOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white dark:bg-zinc-900 rounded-[32px] w-full max-w-lg overflow-hidden shadow-2xl border border-slate-100 dark:border-white/10"
              >
                <form onSubmit={handleSavePromo}>
                  <div className="p-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                      {editingPromo ? t('editPromotion') : t('addPromotion')}
                    </h3>
                    <button type="button" onClick={() => setIsPromoModalOpen(false)} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
                      <X className="w-5 h-5 text-zinc-500" />
                    </button>
                  </div>

                  <div className="p-6 space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-500 dark:text-zinc-400">{t('title')}</label>
                      <input 
                        type="text" 
                        required
                        className="input"
                        value={promoFormData.title || ''}
                        onChange={(e) => setPromoFormData({ ...promoFormData, title: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-500 dark:text-zinc-400">{t('description')}</label>
                      <textarea 
                        className="input min-h-[80px]"
                        value={promoFormData.description || ''}
                        onChange={(e) => setPromoFormData({ ...promoFormData, description: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-500 dark:text-zinc-400">{t('expiryDate')}</label>
                        <input 
                          type="date" 
                          required
                          className="input"
                          value={promoFormData.expiryDate || ''}
                          onChange={(e) => setPromoFormData({ ...promoFormData, expiryDate: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-500 dark:text-zinc-400">{t('type')}</label>
                        <select 
                          className="input"
                          value={promoFormData.type || 'banner'}
                          onChange={(e) => setPromoFormData({ ...promoFormData, type: e.target.value as any })}
                        >
                          <option value="banner">{t('promoTypeBanner')}</option>
                          <option value="popup">{t('promoTypePopup')}</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-500 dark:text-zinc-400">{t('imageUrl')}</label>
                      <div className="flex gap-4 items-center">
                        {promoFormData.imageUrl && (
                          <div className="w-16 h-16 rounded-lg bg-slate-100 dark:bg-black overflow-hidden shrink-0 border border-slate-200 dark:border-white/10">
                            <img src={promoFormData.imageUrl} alt="" className="w-full h-full object-cover" />
                          </div>
                        )}
                        <label className="flex-1 cursor-pointer">
                          <div className="input flex items-center gap-2 text-zinc-500">
                            <ImageIcon className="w-4 h-4" />
                            <span>{promoFormData.imageUrl ? t('changeImage') : t('uploadImage')}</span>
                          </div>
                          <input 
                            type="file" 
                            accept="image/*"
                            className="hidden" 
                            onChange={handlePromoImageUpload}
                          />
                        </label>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-black rounded-2xl border border-slate-100 dark:border-white/5">
                      <input 
                        type="checkbox" 
                        id="promoActive"
                        checked={!!promoFormData.active}
                        onChange={(e) => setPromoFormData({ ...promoFormData, active: e.target.checked })}
                        className="w-5 h-5 text-amber-600 focus:ring-amber-500 bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 rounded"
                      />
                      <label htmlFor="promoActive" className="text-sm font-bold text-slate-700 dark:text-zinc-300 cursor-pointer">
                        {t('active')}
                      </label>
                    </div>
                  </div>

                  <div className="p-6 bg-slate-50 dark:bg-black flex gap-4">
                    <button 
                      type="button" 
                      onClick={() => setIsPromoModalOpen(false)}
                      className="btn-secondary flex-1"
                    >
                      {t('cancel')}
                    </button>
                    <button 
                      type="submit"
                      className="btn-primary flex-1"
                    >
                      {t('save')}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </div>
      )}
      {activeTab === 'aiManager' && isAdmin && <AIManager embedded />}
      {activeTab === 'data' && isAdmin && (
        <div className="space-y-8">
          <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 border border-slate-100 dark:border-white/10 shadow-sm dark:shadow-none space-y-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-amber-500" />
              {t('databaseBackup')}
            </h2>
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-black rounded-2xl border border-slate-100 dark:border-white/5">
              <div>
                <p className="font-bold text-slate-900 dark:text-white">{t('autoBackup')}</p>
                <p className="text-xs text-zinc-500">{t('backupSchedule')}</p>
              </div>
              <button
                type="button"
                onClick={() => setBackupConfig((c) => ({ ...c, enabled: !c.enabled }))}
                className={clsx(
                  'w-12 h-6 rounded-full relative transition-all',
                  backupConfig.enabled ? 'bg-amber-600' : 'bg-slate-200 dark:bg-zinc-800'
                )}
              >
                <div
                  className={clsx(
                    'absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all',
                    backupConfig.enabled ? 'right-1' : 'left-1'
                  )}
                />
              </button>
            </div>
            {backupConfig.enabled && (
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-500 dark:text-zinc-400">{t('backupSchedule')}</label>
                <input
                  type="time"
                  className="input max-w-xs"
                  value={backupConfig.time}
                  onChange={(e) => setBackupConfig((c) => ({ ...c, time: e.target.value }))}
                />
              </div>
            )}
            <div className="flex flex-wrap gap-4">
              <button type="button" onClick={saveBackupConfig} className="btn-primary gap-2">
                <Save className="w-4 h-4" />
                {t('save')}
              </button>
              <button
                type="button"
                onClick={triggerBackup}
                disabled={isBackingUp}
                className="btn-secondary gap-2 disabled:opacity-50"
              >
                {isBackingUp ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                {t('backupNow')}
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 border border-slate-100 dark:border-white/10 shadow-sm dark:shadow-none">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">{t('backupFiles')}</h3>
            {backupListError && (
              <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl px-4 py-3 mb-4">
                {backupListError}
              </p>
            )}
            {!backupListError && backups.length === 0 ? (
              <p className="text-zinc-500 text-center py-8">{t('noBackups')}</p>
            ) : !backupListError ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-white/10 text-zinc-500">
                      <th className="pb-3 font-bold">{t('name')}</th>
                      <th className="pb-3 font-bold">{t('backupFileSize')}</th>
                      <th className="pb-3 font-bold">{t('backupCreated')}</th>
                      <th className="pb-3 font-bold"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {backups.map((b) => (
                      <tr key={b.filename} className="border-b border-slate-50 dark:border-white/5">
                        <td className="py-3 font-mono text-xs text-slate-800 dark:text-zinc-200">{b.filename}</td>
                        <td className="py-3 text-zinc-600 dark:text-zinc-400">{formatBackupSize(b.size)}</td>
                        <td className="py-3 text-zinc-500">
                          {format(new Date(b.createdAt), 'PPp')}
                        </td>
                        <td className="py-3 text-right">
                          <button
                            type="button"
                            onClick={() => restoreBackup(b.filename)}
                            disabled={isRestoring === b.filename}
                            className="text-xs px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-50 transition-colors font-medium"
                          >
                            {isRestoring === b.filename ? '...' : t('restoreBackup')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
