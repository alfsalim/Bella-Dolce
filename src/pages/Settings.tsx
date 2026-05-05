import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { db, collection, onSnapshot, query, orderBy, updateDoc, doc, addDoc, setDoc, deleteDoc, getDocs, getDoc, isAuthError } from '../lib/firebase-compat';
import { UserProfile, ActivityLog, Role, RolePermission, Promotion, Product, RawMaterial } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { DEFAULT_PERMISSIONS } from '../lib/seedData';
import { Settings as SettingsIcon, Users as UsersIcon, Activity, Shield, Globe, Bell, Save, UserPlus, MoreVertical, ShieldCheck, ShieldAlert, Calendar, Search, CheckCircle2, XCircle, RefreshCw, Image as ImageIcon, Plus, Edit2, Trash2, X, Database, Sparkles, Filter, Package } from 'lucide-react';
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
import {
  ItemCategoryConfig,
  buildItemCategoryConfigFromLegacy,
  getDefaultItemCategoryConfig,
  isConsumableCategory,
  sanitizeItemCategoryConfig,
} from '../lib/itemCategories';
import AssetManagement from './AssetManagement';

const Settings: React.FC = () => {
  const { t, isRTL, language, setLanguage, isBilingual, toggleBilingual, tRole, tCategory } = useLanguage();
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'general' | 'users' | 'roles' | 'logs' | 'promotions' | 'categories' | 'assets' | 'consumables' | 'aiManager' | 'data'>('general');
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => document.documentElement.classList.contains('dark'));
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [promotionsPage, setPromotionsPage] = useState(1);
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  const [backupConfig, setBackupConfig] = useState<{ enabled: boolean; time: string }>({ enabled: true, time: '23:59' });
  const [backups, setBackups] = useState<{ filename: string; size: number; createdAt: string }[]>([]);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState<string | null>(null);
  const [backupListError, setBackupListError] = useState<string | null>(null);
  const [logsPage, setLogsPage] = useState(1);
  const [promoFormData, setPromoFormData] = useState<Partial<Promotion>>({
    name: '',
    title: '',
    description: '',
    imageUrl: '',
    expiryDate: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
    active: true,
    type: 'banner',
    productIds: [],
    productPrices: [],
  });
  const [systemAlertsOn, setSystemAlertsOn] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem('systemAlerts') === 'true'
  );
  const [itemCategoryConfig, setItemCategoryConfig] = useState<ItemCategoryConfig>(getDefaultItemCategoryConfig());
  const [newProductCategory, setNewProductCategory] = useState('');
  const [newRawMaterialCategory, setNewRawMaterialCategory] = useState('');
  const [newConsumableCategory, setNewConsumableCategory] = useState('');
  const [consumables, setConsumables] = useState<RawMaterial[]>([]);
  const [isConsumableModalOpen, setIsConsumableModalOpen] = useState(false);
  const [editingConsumable, setEditingConsumable] = useState<RawMaterial | null>(null);
  const [consumableFormData, setConsumableFormData] = useState<Partial<RawMaterial>>({
    name: '',
    category: 'cleaning',
    unit: 'pcs',
    minStock: 0,
    imageUrl: '',
    brand: '',
  });

  const isAdmin = profile?.role === 'admin';
  const isSettingsSection = location.pathname.startsWith('/settings');
  const availableTabs = isSettingsSection
    ? (['general', 'users', 'roles', 'categories', 'data'] as const)
    : (['promotions', 'consumables', 'assets', 'aiManager', 'logs'] as const);
  const sectionTitleKey = isSettingsSection ? 'settings' : 'administration';

  useEffect(() => {
    if (!availableTabs.includes(activeTab as any)) {
      setActiveTab(availableTabs[0]);
    }
  }, [activeTab, availableTabs]);

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
    if (!location.pathname.startsWith('/administration')) return;
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
  }, [location.pathname, profile, searchParams, setSearchParams]);

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
    if (!isAdmin) return;
    const unsubscribe = onSnapshot(collection(db, 'rawMaterials'), (snapshot) => {
      const rows = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as RawMaterial));
      const consumableSet = new Set(itemCategoryConfig.consumable);
      setConsumables(rows.filter((r) => consumableSet.has((r.category || '').toLowerCase())));
    });
    return () => unsubscribe();
  }, [isAdmin, itemCategoryConfig.consumable.join('|')]);

  useEffect(() => {
    const categoriesRef = doc(db, 'settings', 'item_categories');
    const unsubscribe = onSnapshot(
      categoriesRef,
      async (snapshot) => {
        if (snapshot.exists()) {
          const sanitized = sanitizeItemCategoryConfig(snapshot.data());
          setItemCategoryConfig(sanitized);
          return;
        }

        const fallback = getDefaultItemCategoryConfig();
        setItemCategoryConfig(fallback);
        if (!isAdmin) return;

        const legacySnap = await getDoc(doc(db, 'settings', 'categories'));
        const migrated = buildItemCategoryConfigFromLegacy(legacySnap.exists() ? legacySnap.data().list : undefined);
        await setDoc(categoriesRef, migrated, { merge: true });

        // One-time data migration: operational categories become consumables.
        const materialsSnap = await getDocs(collection(db, 'rawMaterials'));
        await Promise.all(
          materialsSnap.docs.map(async (row) => {
            const data = row.data() as any;
            if (isConsumableCategory(String(data.category || '').toLowerCase())) {
              return;
            } else {
              await updateDoc(doc(db, 'rawMaterials', row.id), {
                category: 'kitchen',
              } as any);
            }
          })
        );
      },
      (error) => {
        console.error('Failed to load item categories config', error);
      }
    );

    return () => unsubscribe();
  }, [isAdmin]);

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

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'products'), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(promotions.length / PAGE_SIZE));
    setPromotionsPage((p) => Math.min(p, totalPages));
  }, [promotions.length, PAGE_SIZE]);

  const { promotionsTotalPages, pagedPromotions } = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(promotions.length / PAGE_SIZE));
    const slice = promotions.slice((promotionsPage - 1) * PAGE_SIZE, promotionsPage * PAGE_SIZE);
    return { promotionsTotalPages: totalPages, pagedPromotions: slice };
  }, [promotions, promotionsPage, PAGE_SIZE]);

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
      if (promoFormData.type === 'campaign') {
        const rows = promoFormData.productPrices || [];
        if (!promoFormData.name || rows.length === 0) {
          toast.error(t('promoCampaignValidationRequired'));
          return;
        }
        const hasInvalidPrice = rows.some((row) => row.promotionPrice >= row.originalPrice);
        if (hasInvalidPrice) {
          toast.error(t('promoCampaignValidationPrice'));
          return;
        }
        const nowIso = new Date().toISOString();
        const overlapping = promotions.some((promo) => {
          if (editingPromo && promo.id === editingPromo.id) return false;
          if (!promo.active || promo.type !== 'campaign' || promo.expiryDate <= nowIso) return false;
          const ids = new Set((promo.productPrices || []).map((row) => row.productId));
          return rows.some((row) => ids.has(row.productId));
        });
        if (overlapping) {
          toast.error(t('promoCampaignValidationOverlap'));
          return;
        }
      }

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
        name: '',
        title: '',
        description: '',
        imageUrl: '',
        expiryDate: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
        active: true,
        type: 'banner',
        productIds: [],
        productPrices: [],
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
    { path: '/administration', label: 'administration' },
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

  if (profile && !isAdmin) {
    if (isSettingsSection && activeTab !== 'general') {
      setActiveTab('general');
    }
    if (!isSettingsSection && activeTab !== 'promotions') {
      setActiveTab('promotions');
    }
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

  const normalizeCategoryName = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');

  const updateItemCategoryConfig = async (next: ItemCategoryConfig) => {
    const sanitized = sanitizeItemCategoryConfig(next);
    await setDoc(doc(db, 'settings', 'item_categories'), sanitized, { merge: true });
    setItemCategoryConfig(sanitized);
  };

  const addCategoryByType = async (type: 'product' | 'rawMaterial' | 'consumable') => {
    const input = type === 'product' ? newProductCategory : type === 'rawMaterial' ? newRawMaterialCategory : newConsumableCategory;
    const normalized = normalizeCategoryName(input);
    if (!normalized) return toast.error(t('categoryValidationEmpty'));

    const existing = itemCategoryConfig[type].map((cat) => cat.toLowerCase());
    if (existing.includes(normalized)) return toast.error(t('categoryValidationDuplicate'));

    try {
      await updateItemCategoryConfig({
        ...itemCategoryConfig,
        [type]: [...itemCategoryConfig[type], normalized],
      });
      if (type === 'product') setNewProductCategory('');
      else if (type === 'rawMaterial') setNewRawMaterialCategory('');
      else setNewConsumableCategory('');
      toast.success(t('categorySaved'));
    } catch (error) {
      console.error('Error adding category:', error);
      toast.error(t('errorAddingCategory'));
    }
  };

  const renameCategoryByType = async (type: 'product' | 'rawMaterial' | 'consumable', oldValue: string) => {
    const input = window.prompt(t('renameCategoryPrompt') || 'Rename category', oldValue);
    if (input == null) return;
    const normalized = normalizeCategoryName(input);
    if (!normalized) return toast.error(t('categoryValidationEmpty'));

    const siblingList = itemCategoryConfig[type].filter((cat) => cat !== oldValue).map((cat) => cat.toLowerCase());
    if (siblingList.includes(normalized)) return toast.error(t('categoryValidationDuplicate'));

    try {
      await updateItemCategoryConfig({
        ...itemCategoryConfig,
        [type]: itemCategoryConfig[type].map((cat) => (cat === oldValue ? normalized : cat)),
      });
      toast.success(t('categorySaved'));
    } catch (error) {
      console.error('Error renaming category:', error);
      toast.error(t('errorSavingCategory'));
    }
  };

  const deleteCategoryByType = async (type: 'product' | 'rawMaterial' | 'consumable', value: string) => {
    if (!window.confirm(t('confirmDelete'))) return;
    if (itemCategoryConfig[type].length <= 1) return toast.error(t('categoryValidationKeepOne'));

    try {
      await updateItemCategoryConfig({
        ...itemCategoryConfig,
        [type]: itemCategoryConfig[type].filter((cat) => cat !== value),
      });
      toast.success(t('categoryDeleted'));
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error(t('errorSavingCategory'));
    }
  };

  const saveConsumable = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Partial<RawMaterial> = {
      name: consumableFormData.name?.trim() || '',
      category: consumableFormData.category || itemCategoryConfig.consumable[0] || 'cleaning',
      unit: consumableFormData.unit || 'pcs',
      minStock: Number(consumableFormData.minStock || 0),
      imageUrl: consumableFormData.imageUrl || '',
      brand: consumableFormData.brand || '',
      stock: Number(consumableFormData.stock || 0),
      currentStock: Number(consumableFormData.currentStock || consumableFormData.stock || 0),
      status: 'none',
    };
    if (!payload.name) {
      toast.error(t('categoryValidationEmpty'));
      return;
    }

    try {
      if (editingConsumable?.id) {
        await setDoc(doc(db, 'rawMaterials', editingConsumable.id), payload as any, { merge: true });
      } else {
        await addDoc(collection(db, 'rawMaterials'), { ...payload, createdAt: new Date().toISOString() } as any);
      }
      setIsConsumableModalOpen(false);
      setEditingConsumable(null);
      setConsumableFormData({ name: '', category: itemCategoryConfig.consumable[0] || 'cleaning', unit: 'pcs', minStock: 0, imageUrl: '', brand: '' });
      toast.success(t('categorySaved'));
    } catch (error) {
      console.error('Error saving consumable', error);
      toast.error(t('errorSavingCategory'));
    }
  };

  const deleteConsumable = async (id: string) => {
    if (!window.confirm(t('confirmDelete'))) return;
    try {
      await updateDoc(doc(db, 'rawMaterials', id), { disabled: true } as any);
      toast.success(t('categoryDeleted'));
    } catch (error) {
      console.error('Error deleting consumable', error);
      toast.error(t('errorSavingCategory'));
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white">{t(sectionTitleKey)}</h1>
          <p className="text-zinc-500 font-medium">{t('settingsPageSubtitle')}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-zinc-900 rounded-2xl w-fit overflow-x-auto max-w-full border border-slate-200 dark:border-white/5">
        {isSettingsSection && (
          <>
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
          </>
        )}
        {isSettingsSection && isAdmin && (
          <button
            onClick={() => setActiveTab('categories')}
            className={clsx(
              "px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap",
              activeTab === 'categories'
                ? "bg-amber-600 text-white shadow-lg shadow-amber-600/20"
                : "text-slate-500 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-zinc-200"
            )}
          >
            <Filter className="w-4 h-4" />
            {t('categoryManagement')}
          </button>
        )}
        {isSettingsSection && isAdmin && (
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
        {!isSettingsSection && (
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
        )}
        {!isSettingsSection && isAdmin && (
          <button
            onClick={() => setActiveTab('consumables')}
            className={clsx(
              "px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap",
              activeTab === 'consumables'
                ? "bg-amber-600 text-white shadow-lg shadow-amber-600/20"
                : "text-slate-500 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-zinc-200"
            )}
          >
            <Package className="w-4 h-4" />
            {t('consumables')}
          </button>
        )}
        {!isSettingsSection && isAdmin && (
          <button
            onClick={() => setActiveTab('assets')}
            className={clsx(
              "px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap",
              activeTab === 'assets'
                ? "bg-amber-600 text-white shadow-lg shadow-amber-600/20"
                : "text-slate-500 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-zinc-200"
            )}
          >
            <Package className="w-4 h-4" />
            {t('fixedAssets')}
          </button>
        )}
        {!isSettingsSection && isAdmin && (
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
        {!isSettingsSection && (
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
              {t('settingsDisplayAndNotifications')}
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
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('promoTypeBanner')} + {t('promoTypeCampaign')}</h2>
              <p className="text-sm text-zinc-500">{t('promotionsPageSubtitle')}</p>
            </div>
            <button 
              onClick={() => {
                setEditingPromo(null);
                setPromoFormData({
                  name: '',
                  title: '',
                  description: '',
                  imageUrl: '',
                  expiryDate: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
                  active: true,
                  type: 'banner',
                  productIds: [],
                  productPrices: [],
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
            {pagedPromotions.map((promo) => (
              <div key={promo.id} className="bg-white dark:bg-zinc-900 rounded-[32px] border border-slate-100 dark:border-white/10 shadow-sm dark:shadow-none overflow-hidden group">
                <div className="h-40 bg-slate-100 dark:bg-black relative">
                  {promo.imageUrl && promo.type !== 'campaign' ? (
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
                    <h3 className="font-bold text-slate-900 dark:text-white">
                      {promo.type === 'campaign' ? (promo.name || promo.title) : promo.title}
                    </h3>
                    <span className={clsx(
                      "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      promo.active ? "bg-green-900/20 text-green-400" : "bg-slate-100 dark:bg-zinc-900/20 text-zinc-400"
                    )}>
                      {promo.active ? t('active') : t('inactive')}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-500 mb-4 line-clamp-2">{promo.description}</p>
                  <div className="mb-2 text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-zinc-500">
                    {promo.type === 'campaign' ? t('promoTypeCampaign') : t('promoTypeBanner')}
                  </div>
                  {promo.type === 'campaign' && (
                    <p className="text-xs text-zinc-500 mb-2">
                      {t('promoCampaignProductsCount')}: {promo.productPrices?.length || 0}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{t('promoExpiresOn')}: {format(new Date(promo.expiryDate), 'PPP')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Pagination
            currentPage={promotionsPage}
            totalPages={promotionsTotalPages}
            onPageChange={setPromotionsPage}
          />

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
                    {promoFormData.type !== 'campaign' && (
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
                    )}

                    {promoFormData.type === 'campaign' && (
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-500 dark:text-zinc-400">{t('promoCampaignName')}</label>
                        <input
                          type="text"
                          required
                          className="input"
                          value={promoFormData.name || ''}
                          onChange={(e) => setPromoFormData({ ...promoFormData, name: e.target.value })}
                        />
                      </div>
                    )}

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
                          onChange={(e) => {
                            const nextType = e.target.value as any;
                            setPromoFormData({
                              ...promoFormData,
                              type: nextType,
                              title: nextType === 'campaign' ? '' : (promoFormData.title || ''),
                            });
                          }}
                        >
                          <option value="banner">{t('promoTypeBanner')}</option>
                          <option value="popup">{t('promoTypePopup')}</option>
                          <option value="campaign">{t('promoTypeCampaign')}</option>
                        </select>
                      </div>
                    </div>

                    {promoFormData.type !== 'campaign' ? (
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
                    ) : (
                      <div className="space-y-3">
                        <label className="text-sm font-bold text-slate-500 dark:text-zinc-400">{t('promoCampaignProducts')}</label>
                        <div className="max-h-44 overflow-y-auto border border-slate-200 dark:border-white/10 rounded-xl p-3 space-y-2">
                          {products.map((product) => {
                            const selectedIds = promoFormData.productIds || [];
                            const checked = selectedIds.includes(product.id);
                            return (
                              <label key={product.id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-zinc-300">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    const ids = new Set(selectedIds);
                                    const currentRows = promoFormData.productPrices || [];
                                    if (e.target.checked) {
                                      ids.add(product.id);
                                      const exists = currentRows.some((row) => row.productId === product.id);
                                      const nextRows = exists ? currentRows : [...currentRows, {
                                        productId: product.id,
                                        originalPrice: Number(product.sellingPrice || 0),
                                        promotionPrice: Number(product.sellingPrice || 0) - 1,
                                      }];
                                      setPromoFormData({ ...promoFormData, productIds: Array.from(ids), productPrices: nextRows });
                                    } else {
                                      ids.delete(product.id);
                                      setPromoFormData({
                                        ...promoFormData,
                                        productIds: Array.from(ids),
                                        productPrices: currentRows.filter((row) => row.productId !== product.id),
                                      });
                                    }
                                  }}
                                />
                                <span>{product.name}</span>
                              </label>
                            );
                          })}
                        </div>
                        <div className="space-y-2">
                          {(promoFormData.productPrices || []).map((row) => {
                            const product = products.find((p) => p.id === row.productId);
                            return (
                              <div key={row.productId} className="grid grid-cols-3 gap-2 items-center">
                                <p className="text-xs font-bold text-slate-600 dark:text-zinc-300">{product?.name || row.productId}</p>
                                <p className="text-xs text-slate-500 dark:text-zinc-500">{row.originalPrice}</p>
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  className="input"
                                  value={row.promotionPrice}
                                  onChange={(e) => {
                                    const value = Number(e.target.value);
                                    setPromoFormData({
                                      ...promoFormData,
                                      productPrices: (promoFormData.productPrices || []).map((entry) =>
                                        entry.productId === row.productId ? { ...entry, promotionPrice: value } : entry
                                      ),
                                    });
                                  }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

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
      {activeTab === 'categories' && isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 border border-slate-100 dark:border-white/10 shadow-sm dark:shadow-none space-y-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('productCategories')}</h2>
            <div className="flex gap-3">
              <input
                className="input flex-1"
                value={newProductCategory}
                onChange={(e) => setNewProductCategory(e.target.value)}
                placeholder={t('newCategoryName')}
              />
              <button type="button" className="btn-primary gap-2" onClick={() => addCategoryByType('product')}>
                <Plus className="w-4 h-4" />
                {t('add')}
              </button>
            </div>
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-2">
              {itemCategoryConfig.product.map((cat) => (
                <div key={cat} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-black border border-slate-100 dark:border-white/5">
                  <span className="font-bold text-slate-700 dark:text-zinc-300">{tCategory(cat)}</span>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => renameCategoryByType('product', cat)} className="p-1.5 text-slate-400 hover:text-amber-500 transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => deleteCategoryByType('product', cat)} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 border border-slate-100 dark:border-white/10 shadow-sm dark:shadow-none space-y-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('rawMaterialCategories')}</h2>
            <div className="flex gap-3">
              <input
                className="input flex-1"
                value={newRawMaterialCategory}
                onChange={(e) => setNewRawMaterialCategory(e.target.value)}
                placeholder={t('newCategoryName')}
              />
              <button type="button" className="btn-primary gap-2" onClick={() => addCategoryByType('rawMaterial')}>
                <Plus className="w-4 h-4" />
                {t('add')}
              </button>
            </div>
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-2">
              {itemCategoryConfig.rawMaterial.map((cat) => (
                <div key={cat} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-black border border-slate-100 dark:border-white/5">
                  <span className="font-bold text-slate-700 dark:text-zinc-300">{tCategory(cat)}</span>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => renameCategoryByType('rawMaterial', cat)} className="p-1.5 text-slate-400 hover:text-amber-500 transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => deleteCategoryByType('rawMaterial', cat)} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 border border-slate-100 dark:border-white/10 shadow-sm dark:shadow-none space-y-6 lg:col-span-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('consumableCategories')}</h2>
            <div className="flex gap-3">
              <input
                className="input flex-1"
                value={newConsumableCategory}
                onChange={(e) => setNewConsumableCategory(e.target.value)}
                placeholder={t('newCategoryName')}
              />
              <button type="button" className="btn-primary gap-2" onClick={() => addCategoryByType('consumable')}>
                <Plus className="w-4 h-4" />
                {t('add')}
              </button>
            </div>
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-2">
              {itemCategoryConfig.consumable.map((cat) => (
                <div key={cat} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-black border border-slate-100 dark:border-white/5">
                  <span className="font-bold text-slate-700 dark:text-zinc-300">{tCategory(cat)}</span>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => renameCategoryByType('consumable', cat)} className="p-1.5 text-slate-400 hover:text-amber-500 transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => deleteCategoryByType('consumable', cat)} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {activeTab === 'assets' && isAdmin && (
        <AssetManagement />
      )}
      {activeTab === 'consumables' && isAdmin && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('consumableDefinitions')}</h2>
              <p className="text-sm text-zinc-500">{t('consumableDefinitionsDesc')}</p>
            </div>
            <button
              type="button"
              className="btn-primary gap-2"
              onClick={() => {
                setEditingConsumable(null);
                setConsumableFormData({ name: '', category: itemCategoryConfig.consumable[0] || 'cleaning', unit: 'pcs', minStock: 0, imageUrl: '', brand: '' });
                setIsConsumableModalOpen(true);
              }}
            >
              <Plus className="w-4 h-4" />
              {t('addConsumable')}
            </button>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-[32px] border border-slate-100 dark:border-white/10 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-black">
                <tr>
                  <th className="text-left px-6 py-3 text-xs uppercase text-slate-500">{t('name')}</th>
                  <th className="text-left px-6 py-3 text-xs uppercase text-slate-500">{t('category')}</th>
                  <th className="text-left px-6 py-3 text-xs uppercase text-slate-500">{t('unit')}</th>
                  <th className="text-left px-6 py-3 text-xs uppercase text-slate-500">{t('minStock')}</th>
                  <th className="text-right px-6 py-3 text-xs uppercase text-slate-500">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {consumables.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100 dark:border-white/5">
                    <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-200">{item.name}</td>
                    <td className="px-6 py-4">{tCategory(item.category)}</td>
                    <td className="px-6 py-4">{item.unit}</td>
                    <td className="px-6 py-4">{item.minStock || 0}</td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button type="button" className="p-1.5 text-slate-400 hover:text-amber-500" onClick={() => {
                          setEditingConsumable(item);
                          setConsumableFormData(item);
                          setIsConsumableModalOpen(true);
                        }}>
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button type="button" className="p-1.5 text-slate-400 hover:text-red-600" onClick={() => deleteConsumable(item.id)}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {isConsumableModalOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
              <div className="bg-white dark:bg-zinc-900 rounded-[32px] w-full max-w-lg border border-slate-100 dark:border-white/10 overflow-hidden">
                <form onSubmit={saveConsumable}>
                  <div className="p-6 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
                    <h3 className="text-lg font-bold">{editingConsumable ? t('editConsumable') : t('addConsumable')}</h3>
                    <button type="button" onClick={() => setIsConsumableModalOpen(false)}><X className="w-5 h-5" /></button>
                  </div>
                  <div className="p-6 space-y-4">
                    <input className="input" placeholder={t('name')} value={consumableFormData.name || ''} onChange={(e) => setConsumableFormData({ ...consumableFormData, name: e.target.value })} />
                    <select className="input" value={consumableFormData.category || ''} onChange={(e) => setConsumableFormData({ ...consumableFormData, category: e.target.value })}>
                      {itemCategoryConfig.consumable.map((cat) => <option key={cat} value={cat}>{tCategory(cat)}</option>)}
                    </select>
                    <input className="input" placeholder={t('unit')} value={consumableFormData.unit || ''} onChange={(e) => setConsumableFormData({ ...consumableFormData, unit: e.target.value })} />
                    <input type="number" className="input" placeholder={t('minStock')} value={consumableFormData.minStock || 0} onChange={(e) => setConsumableFormData({ ...consumableFormData, minStock: Number(e.target.value) })} />
                  </div>
                  <div className="p-6 bg-slate-50 dark:bg-black flex gap-3">
                    <button type="button" className="btn-secondary flex-1" onClick={() => setIsConsumableModalOpen(false)}>{t('cancel')}</button>
                    <button type="submit" className="btn-primary flex-1">{t('save')}</button>
                  </div>
                </form>
              </div>
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
