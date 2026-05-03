import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  Package, 
  Plus, 
  Search, 
  Filter, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight,
  MoreVertical,
  Edit,
  Trash2,
  ChevronRight,
  Droplets,
  List,
  Scale,
  Clock,
  ShoppingCart,
  RefreshCcw,
  LayoutGrid,
  LayoutList,
  Zap,
  Store,
  Snowflake,
  History
} from 'lucide-react';
import { format } from 'date-fns';
import { db, collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc, setDoc, limit, handleFirestoreError, OperationType, getCountFromServer, where, getDoc, getDocs, Timestamp } from '../lib/firebase-compat';
import { authFetch } from '../lib/api-client';
import { Product, RawMaterial, StockMovement, Recipe } from '../types';
import { logActivity } from '../lib/logger';
import { useAuth } from '../contexts/AuthContext';
import { clsx } from 'clsx';
import { CATEGORIES, UNITS, CURRENCY, PAGE_SIZE, QUERY_MAX_ITEMS } from '../constants';
import { compressImage } from '../lib/utils';
import { toast } from 'react-hot-toast';
import Pagination from '../components/Pagination';

interface InventoryProps {
  defaultTab?: 'products' | 'materials' | 'activities';
}

const Inventory: React.FC<InventoryProps> = ({ defaultTab }) => {
  const { t, isRTL, tProduct, tCategory } = useLanguage();
  const { profile: currentUserProfile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [productsPage, setProductsPage] = useState(1);
  const [materialsPage, setMaterialsPage] = useState(1);
  const [totalProductsPages, setTotalProductsPages] = useState(1);
  const [totalMaterialsPages, setTotalMaterialsPages] = useState(1);

  const [activeTab, setActiveTab] = useState<'products' | 'materials' | 'activities' | 'waste'>(defaultTab || 'products');
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [movementsPage, setMovementsPage] = useState(1);
  const [totalMovementsPages, setTotalMovementsPages] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'All' | 'Regular' | 'Pack' | 'RawMaterial'>('All');
  const [showDisabled, setShowDisabled] = useState(false);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [adjustmentData, setAdjustmentData] = useState({
    itemId: '',
    itemName: '',
    itemType: 'material' as 'material' | 'product',
    type: 'in' as 'in' | 'out',
    quantity: 0,
    reason: 'manual_adjustment',
    location: 'shop' as 'shop' | 'freezer' | 'none',
    toLocation: 'waste' as 'shop' | 'freezer' | 'waste' | 'none'
  });
  const [viewMode, setViewMode] = useState<'list' | 'card'>(() => {
    return (localStorage.getItem('inventoryViewMode') as 'list' | 'card') || 'card';
  });
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<Product & { lastPurchaseStatus?: string }>>({});
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [selectedMaterialForPurchase, setSelectedMaterialForPurchase] = useState<RawMaterial | null>(null);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [purchaseFormData, setPurchaseFormData] = useState({
    supplierId: '',
    quantity: 0,
    price: 0,
    brand: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    expiryDate: ''
  });
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
  const [selectedItemForInventory, setSelectedItemForInventory] = useState<(Product | RawMaterial) | null>(null);
  const [inventoryFormData, setInventoryFormData] = useState({
    shopStock: 0,
    freezerStock: 0,
    currentStock: 0,
    wasteQuantity: 0,
    minStock: 0,
    costPrice: 0
  });
  const [inventoryStockWarning, setInventoryStockWarning] = useState(false);
  const [lastBatch, setLastBatch] = useState<any>(null);

  const openInventoryModal = (item: Product | RawMaterial) => {
    const isProduct = !('currentStock' in item);
    setSelectedItemForInventory(item);
    setInventoryFormData(isProduct ? {
      shopStock: (item as Product).shopStock || 0,
      freezerStock: (item as Product).freezerStock || 0,
      currentStock: 0,
      wasteQuantity: (item as Product).wasteQuantity || 0,
      minStock: (item as Product).minStock || 0,
      costPrice: (item as Product).costPrice || 0
    } : {
      shopStock: 0,
      freezerStock: 0,
      currentStock: (item as RawMaterial).currentStock || 0,
      wasteQuantity: (item as RawMaterial).wasteQuantity || 0,
      minStock: (item as RawMaterial).minStock || 0,
      costPrice: 0
    });
    setInventoryStockWarning(false);
    setLastBatch(null);
    setIsInventoryModalOpen(true);
    if (isProduct) {
      const token = localStorage.getItem('bakery_token');
      authFetch(`/api/db/batches?where=${encodeURIComponent(JSON.stringify({productId: item.id, status: 'completed'}))}&orderBy=${encodeURIComponent(JSON.stringify({startDate: 'desc'}))}&take=1`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.ok ? r.json() : []).then((data: any[]) => {
        if (data && data.length > 0) setLastBatch(data[0]);
      }).catch(() => {});
    }
  };


  const updateMaterialStatus = async (id: string, status: RawMaterial['status']) => {
    try {
      await updateDoc(doc(db, 'rawMaterials', id), { status });
      if (currentUserProfile) {
        await logActivity(
          currentUserProfile.id,
          currentUserProfile.name,
          'material_status_updated',
          `Updated material status to ${status}`
        );
      }
    } catch (error) {
      console.error('Error updating material status:', error);
    }
  };

  const getStockStatusKey = (product: Product): string => {
    const shop = product.shopStock || 0;
    const frozen = product.freezerStock || 0;
    if (shop > 0 && frozen > 0) return 'stockLocationMixed';
    if (frozen > 0) return 'stockLocationFrozen';
    return 'stockLocationShop';
  };

  const getStockStatusColor = (statusKey: string): string => {
    if (statusKey === 'stockLocationShop') return "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/30";
    if (statusKey === 'stockLocationFrozen') return "bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/30";
    return "bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/30";
  };

  const getStockStatus = (product: Product): string => {
    return t(getStockStatusKey(product));
  };

  const isProductDeletable = async (productId: string) => {
    try {
      // 1. Check production batches
      const batchesQ = query(
        collection(db, 'productionBatches'), 
        where('productId', '==', productId),
        where('status', 'not-in', ['completed', 'cancelled'])
      );
      const batchesSnapshot = await getDocs(batchesQ);
      if (!batchesSnapshot.empty) return { deletable: false, reason: t('linkedToProduction') || 'Linked to active production' };

      // 2. Check recipes (as ingredient)
      const recipesSnapshot = await getDocs(collection(db, 'recipes'));
      const linkedRecipe = recipesSnapshot.docs.find(doc => {
        const recipe = doc.data() as Recipe;
        return recipe.ingredients.some(ing => ing.materialId === productId);
      });
      if (linkedRecipe) return { deletable: false, reason: t('linkedToRecipe') || 'Linked to a recipe' };

      // 3. Check packs (as pack item)
      const packsSnapshot = await getDocs(query(collection(db, 'products'), where('isPack', '==', true)));
      const linkedPack = packsSnapshot.docs.find(doc => {
        const pack = doc.data() as Product;
        return pack.packItems?.some(item => item.productId === productId);
      });
      if (linkedPack) return { deletable: false, reason: t('linkedToPack') || 'Linked to a pack' };

      return { deletable: true };
    } catch (error) {
      console.error('Error checking deletability:', error);
      return { deletable: false, reason: t('errorCheckingDeletability') || 'Error checking deletability' };
    }
  };

  const deleteMaterial = async (id: string) => {
    const { deletable, reason } = await isProductDeletable(id);
    if (!deletable) {
      toast.error(reason || 'Cannot delete material');
      return;
    }

    if (window.confirm(t('confirmDelete') || 'Are you sure you want to disable this material?')) {
      try {
        await updateDoc(doc(db, 'rawMaterials', id), { disabled: true });
        // Also disable in products if it was synced
        const prodDoc = await getDoc(doc(db, 'products', id));
        if (prodDoc.exists()) {
          await updateDoc(doc(db, 'products', id), { disabled: true });
        }
        toast.success(t('materialDisabled') || 'Material disabled successfully');
      } catch (error) {
        console.error('Error disabling material:', error);
        toast.error(t('errorDeletingMaterial') || 'Error disabling material');
      }
    }
  };

  const deleteProduct = async (id: string) => {
    const { deletable, reason } = await isProductDeletable(id);
    if (!deletable) {
      toast.error(reason || 'Cannot delete product');
      return;
    }

    if (window.confirm(t('confirmDelete') || 'Are you sure you want to disable this product?')) {
      try {
        await updateDoc(doc(db, 'products', id), { disabled: true });
        // Also disable in rawMaterials if it was synced
        const matDoc = await getDoc(doc(db, 'rawMaterials', id));
        if (matDoc.exists()) {
          await updateDoc(doc(db, 'rawMaterials', id), { disabled: true });
        }
        toast.success(t('productDisabled') || 'Product disabled successfully');
      } catch (error) {
        console.error('Error disabling product:', error);
        toast.error(t('errorDeletingProduct') || 'Error disabling product');
      }
    }
  };

  const restoreProduct = async (id: string) => {
    try {
      await updateDoc(doc(db, 'products', id), { disabled: false });
      const matDoc = await getDoc(doc(db, 'rawMaterials', id));
      if (matDoc.exists()) {
        await updateDoc(doc(db, 'rawMaterials', id), { disabled: false });
      }
      toast.success(t('productRestored') || 'Product restored successfully');
    } catch (error) {
      console.error('Error restoring product:', error, id);
      toast.error(t('errorRestoringProduct') || 'Error restoring product');
    }
  };

  const restoreMaterial = async (id: string) => {
    try {
      await updateDoc(doc(db, 'rawMaterials', id), { disabled: false });
      const prodDoc = await getDoc(doc(db, 'products', id));
      if (prodDoc.exists()) {
        await updateDoc(doc(db, 'products', id), { disabled: false });
      }
      toast.success(t('materialRestored') || 'Material restored successfully');
    } catch (error) {
      console.error('Error restoring material:', error, id);
      toast.error(t('errorRestoringMaterial') || 'Error restoring material');
    }
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustmentData.itemId || adjustmentData.quantity <= 0) return;

    try {
      const collectionName = adjustmentData.itemType === 'material' ? 'rawMaterials' : 'products';
      const itemRef = doc(db, collectionName, adjustmentData.itemId);
      const itemSnap = await getDoc(itemRef);

      if (!itemSnap.exists()) {
        toast.error('Item not found');
        return;
      }

      const currentData = itemSnap.data();
      const previousTotalStock = adjustmentData.itemType === 'material' ? currentData.currentStock : currentData.stock;
      
      let newTotalStock = previousTotalStock;
      const updateData: any = {};

      if (adjustmentData.itemType === 'material') {
        const diff = adjustmentData.type === 'in' ? adjustmentData.quantity : -adjustmentData.quantity;
        newTotalStock = Math.max(0, previousTotalStock + diff);
        updateData.currentStock = newTotalStock;
      } else {
        // Products: "Move" stock between shop / freezer / waste — total never changes
        const fromLoc = adjustmentData.location; // 'shop' | 'freezer'
        const toLoc = adjustmentData.toLocation;  // 'shop' | 'freezer' | 'waste'
        const qty = adjustmentData.quantity;

        if (!fromLoc || fromLoc === 'none' || !toLoc || toLoc === 'none') {
          toast.error('Please select both source and destination locations.');
          return;
        }
        if (fromLoc === toLoc) {
          toast.error('Source and destination must be different.');
          return;
        }

        // Check source has enough
        const sourceAvailable = fromLoc === 'shop' ? (currentData.shopStock || 0) : (currentData.freezerStock || 0);
        if (qty > sourceAvailable) {
          toast.error(`Not enough stock in ${fromLoc}: available ${sourceAvailable}, requested ${qty}`);
          return;
        }

        // Deduct from source
        if (fromLoc === 'shop') updateData.shopStock = (currentData.shopStock || 0) - qty;
        else updateData.freezerStock = (currentData.freezerStock || 0) - qty;

        // Add to destination
        if (toLoc === 'shop') updateData.shopStock = (updateData.shopStock ?? currentData.shopStock ?? 0) + qty;
        else if (toLoc === 'freezer') updateData.freezerStock = (updateData.freezerStock ?? currentData.freezerStock ?? 0) + qty;
        else if (toLoc === 'waste') updateData.wasteQuantity = (currentData.wasteQuantity || 0) + qty;

        // stock = shopStock + freezerStock + wasteQuantity (total unchanged)
        newTotalStock = (updateData.shopStock ?? currentData.shopStock ?? 0) + (updateData.freezerStock ?? currentData.freezerStock ?? 0) + (updateData.wasteQuantity ?? currentData.wasteQuantity ?? 0);
        updateData.stock = newTotalStock;
      }

      await updateDoc(itemRef, updateData);

      // Record movement
      if (currentUserProfile) {
        await addDoc(collection(db, 'stockMovements'), {
          itemId: adjustmentData.itemId,
          itemName: adjustmentData.itemName,
          itemType: adjustmentData.itemType,
          type: adjustmentData.itemType === 'product' ? 'move' : adjustmentData.type,
          quantity: adjustmentData.quantity,
          previousStock: previousTotalStock,
          newStock: newTotalStock,
          location: adjustmentData.location,
          toLocation: adjustmentData.itemType === 'product' ? adjustmentData.toLocation : undefined,
          reason: adjustmentData.reason,
          userId: currentUserProfile.id,
          userName: currentUserProfile.name,
          timestamp: Timestamp.now()
        });
      }

      toast.success(t('stockAdjustedSuccessfully') || 'Stock adjusted successfully');
      setIsAdjustmentModalOpen(false);
    } catch (error) {
      console.error('Error adjusting stock:', error);
      toast.error(t('errorAdjustingStock') || 'Error adjusting stock');
    }
  };

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        let productsQ = query(collection(db, 'products'));
        if (selectedCategory !== 'all') {
          productsQ = query(productsQ, where('category', '==', selectedCategory));
        }
        if (selectedStatus !== 'all') {
          productsQ = query(productsQ, where('status', '==', selectedStatus));
        }
        // Note: typeFilter is harder to apply server-side if it's based on isPack boolean
        // but we can try if we want strict server-side filtering.
        // For now, let's keep it simple.

        const materialsQ = query(collection(db, 'rawMaterials'));
        // Materials only have status filter in the UI
        let filteredMaterialsQ = materialsQ;
        if (selectedStatus !== 'all') {
          filteredMaterialsQ = query(materialsQ, where('status', '==', selectedStatus));
        }

        const [productsSnapshot, materialsSnapshot] = await Promise.all([
          getCountFromServer(productsQ),
          getCountFromServer(filteredMaterialsQ)
        ]);
        
        setTotalProductsPages(Math.ceil(productsSnapshot.data().count / PAGE_SIZE));
        setTotalMaterialsPages(Math.ceil(materialsSnapshot.data().count / PAGE_SIZE));
      } catch (error) {
        console.error('Error fetching counts:', error);
      }
    };
    fetchCounts();

    let productsQ = query(collection(db, 'products'), orderBy('name'), limit(PAGE_SIZE * productsPage));
    if (selectedCategory !== 'all') {
      productsQ = query(productsQ, where('category', '==', selectedCategory));
    }
    if (selectedStatus !== 'all') {
      productsQ = query(productsQ, where('status', '==', selectedStatus));
    }

    const unsubscribeProducts = onSnapshot(productsQ, (snapshot) => {
      const allProducts = snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          shopStock: data.shopStock || 0,
          freezerStock: data.freezerStock || 0
        } as Product;
      });
      const startIndex = (productsPage - 1) * PAGE_SIZE;
      setProducts(allProducts.slice(startIndex, startIndex + PAGE_SIZE));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'products'));

    let unsubscribeMaterials = () => {};
    if (currentUserProfile) {
      let materialsQ = query(collection(db, 'rawMaterials'), orderBy('name'), limit(PAGE_SIZE * materialsPage));
      if (selectedStatus !== 'all') {
        materialsQ = query(materialsQ, where('status', '==', selectedStatus));
      }

      unsubscribeMaterials = onSnapshot(materialsQ, async (snapshot) => {
        const allMaterials = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RawMaterial));
        const startIndex = (materialsPage - 1) * PAGE_SIZE;
        const currentMaterials = allMaterials.slice(startIndex, startIndex + PAGE_SIZE);
        setMaterials(currentMaterials);

        // Populate random brands for materials that don't have one
        const materialsWithoutBrand = currentMaterials.filter(m => !m.brand);
        if (materialsWithoutBrand.length > 0) {
          const randomBrands = ['Nestlé', 'Danone', 'Unilever', 'P&G', 'General Mills', 'Kraft Heinz', 'Mars', 'Mondelez', 'PepsiCo', 'Coca-Cola'];
          for (const material of materialsWithoutBrand) {
            const randomBrand = randomBrands[Math.floor(Math.random() * randomBrands.length)];
            try {
              await updateDoc(doc(db, 'rawMaterials', material.id), { brand: randomBrand });
            } catch (error) {
              console.error("Error updating material brand:", error);
            }
          }
        }
      }, (error) => handleFirestoreError(error, OperationType.GET, 'rawMaterials'));
    }

    let unsubscribeMovements = () => {};
    if (currentUserProfile) {
      const movementsQ = query(collection(db, 'stockMovements'), orderBy('timestamp', 'desc'), limit(PAGE_SIZE * movementsPage));
      unsubscribeMovements = onSnapshot(movementsQ, (snapshot) => {
        const allMovements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockMovement));
        const startIndex = (movementsPage - 1) * PAGE_SIZE;
        setMovements(allMovements.slice(startIndex, startIndex + PAGE_SIZE));
        
        // Update total pages for movements
        getCountFromServer(collection(db, 'stockMovements')).then(countSnapshot => {
          setTotalMovementsPages(Math.ceil(countSnapshot.data().count / PAGE_SIZE));
        });
      }, (error) => handleFirestoreError(error, OperationType.GET, 'stockMovements'));
    }

    return () => {
      unsubscribeProducts();
      unsubscribeMaterials();
      unsubscribeMovements();
    };
  }, [productsPage, materialsPage, movementsPage, PAGE_SIZE, currentUserProfile, selectedCategory, selectedStatus]);

  useEffect(() => {
    localStorage.setItem('inventoryViewMode', viewMode);
  }, [viewMode]);

  const fetchSuppliers = async () => {
    try {
      const token = localStorage.getItem('bakery_token');
      const response = await authFetch('/api/db/suppliers', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSuppliers(data || []);
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const getLastPurchaseForMaterial = async (materialId: string) => {
    try {
      const token = localStorage.getItem('bakery_token');
      const qs = new URLSearchParams();
      qs.set('orderBy', JSON.stringify({ date: 'desc' }));
      qs.set('take', String(QUERY_MAX_ITEMS));
      const response = await authFetch(`/api/db/purchases?${qs}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        const lastPurchase = Array.isArray(data)
          ? data.find((p: { materialId?: string }) => p.materialId === materialId)
          : undefined;
        if (lastPurchase) {
          return {
            supplierId: lastPurchase.supplierId,
            price: lastPurchase.price,
            brand: lastPurchase.brand,
            status: lastPurchase.status || 'pending'
          };
        }
      }
    } catch (error) {
      console.error('Error fetching last purchase:', error);
    }
    return { supplierId: '', price: 0, brand: '', status: 'none' };
  };

  const handleOpenPurchaseModal = async (material: RawMaterial) => {
    setSelectedMaterialForPurchase(material);
    await fetchSuppliers();
    const lastPurchase = await getLastPurchaseForMaterial(material.id);
    setPurchaseFormData({
      supplierId: lastPurchase.supplierId,
      quantity: 0,
      price: lastPurchase.price,
      brand: lastPurchase.brand,
      purchaseDate: new Date().toISOString().split('T')[0],
      expiryDate: ''
    });
    setIsPurchaseModalOpen(true);
  };

  const handlePurchaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaterialForPurchase || !purchaseFormData.supplierId) {
      toast.error(t('requiredFieldsMissing') || 'Please fill all required fields');
      return;
    }

    const token = localStorage.getItem('bakery_token');
    try {
      const supplier = suppliers.find(s => s.id === purchaseFormData.supplierId);
      const response = await authFetch('/api/db/purchases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          materialId: selectedMaterialForPurchase.id,
          materialName: selectedMaterialForPurchase.name,
          supplierId: purchaseFormData.supplierId,
          supplierName: supplier?.name || '',
          quantity: purchaseFormData.quantity,
          price: purchaseFormData.price,
          brand: purchaseFormData.brand,
          purchaseDate: purchaseFormData.purchaseDate,
          expiryDate: purchaseFormData.expiryDate,
          unit: selectedMaterialForPurchase.unit,
          totalAmount: purchaseFormData.price,
          createdAt: new Date().toISOString(),
          createdBy: currentUserProfile?.id
        })
      });

      if (!response.ok) throw new Error('Failed to create purchase');

      // Add to inventory
      const newStock = (selectedMaterialForPurchase.currentStock || 0) + purchaseFormData.quantity;
      const updateResponse = await authFetch(`/api/db/rawMaterials/${selectedMaterialForPurchase.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          currentStock: newStock,
          stock: newStock
        })
      });

      if (updateResponse.ok && currentUserProfile) {
        // Log stock movement
        await addDoc(collection(db, 'stockMovements'), {
          itemId: selectedMaterialForPurchase.id,
          itemName: selectedMaterialForPurchase.name,
          itemType: 'material',
          type: 'in',
          quantity: purchaseFormData.quantity,
          previousStock: selectedMaterialForPurchase.currentStock || 0,
          newStock: newStock,
          location: 'none',
          reason: 'purchase',
          userId: currentUserProfile.id,
          userName: currentUserProfile.name,
          timestamp: Timestamp.now()
        });
      }

      toast.success(t('purchaseCreatedSuccessfully') || 'Purchase created and inventory updated');
      setIsPurchaseModalOpen(false);
      setSelectedMaterialForPurchase(null);
    } catch (error) {
      console.error('Error creating purchase:', error);
      toast.error(t('errorCreatingPurchase') || 'Error creating purchase');
    }
  };

  const getStockLevel = (current: number, min: number) => {
    if (current <= 0) return { label: 'empty', color: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20' };
    if (current <= min) return { label: 'critical', color: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 animate-pulse' };
    if (current <= min * 1.5) return { label: 'medium', color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20' };
    return { label: 'good', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' };
  };

  const getPredictiveSuggestions = () => {
    return materials.filter(m => m.currentStock <= m.minStock * 1.2);
  };

  useEffect(() => {
    setSelectedCategory('all');
    setSelectedStatus('all');
  }, [activeTab]);

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
    setSelectedStatus('all');
    setTypeFilter('All');
    setShowDisabled(false);
  };

  const filteredProducts = products.filter(p => {
    const isRawMaterial = p.category === 'raw_material' || p.itemType === 'material';
    
    // Soft delete filtering
    if (p.disabled && !showDisabled) return false;
    
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         p.category.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = typeFilter === 'All' ? !isRawMaterial :
                       (typeFilter === 'Pack' && p.isPack) ||
                       (typeFilter === 'Regular' && !p.isPack && !isRawMaterial) ||
                       (typeFilter === 'RawMaterial' && isRawMaterial);

    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    const matchesStatus = selectedStatus === 'all' || p.status === selectedStatus;

    return matchesSearch && matchesType && matchesCategory && matchesStatus;
  });

  const filteredMaterials = materials.filter(m => {
    // Soft delete filtering
    if (m.disabled && !showDisabled) return false;
    
    const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         m.category.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || m.category === selectedCategory;
    const matchesStatus = selectedStatus === 'all' || m.status === selectedStatus;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    category: '',
    price: 0,
    unit: 'kg',
    stock: 0,
    shopStock: 0,
    freezerStock: 0,
    minStock: 0,
    shelfLife: 24,
    imageUrl: '',
    expiryDate: ''
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check for unique name
    const normalizedNewName = formData.name.trim().toLowerCase().replace(/\s+/g, ' ');
    const productExists = products.some(p => p.name.trim().toLowerCase().replace(/\s+/g, ' ') === normalizedNewName && p.id !== selectedProduct?.id);
    const materialExists = materials.some(m => m.name.trim().toLowerCase().replace(/\s+/g, ' ') === normalizedNewName && m.id !== selectedProduct?.id);

    if (productExists || materialExists) {
      toast.error(t('nameExists') || 'Name already exists in products or materials');
      return;
    }

    try {
      if (selectedProduct && selectedProduct.id) {
        // Handle Edit
        const itemRef = doc(db, activeTab === 'products' ? 'products' : 'rawMaterials', selectedProduct.id);

        // For products: validate that stock total cannot increase through editing
        if (activeTab === 'products') {
          const originalStock = (selectedProduct as Product).stock || 0;
          const existingWaste = (selectedProduct as Product).wasteQuantity || 0;
          const newShop = Number(formData.shopStock);
          const newFrozen = Number(formData.freezerStock);
          const newTotal = newShop + newFrozen + existingWaste;
          if (newTotal !== originalStock) {
            toast.error(
              `Total must stay at ${originalStock}. Shop ${newShop} + Frozen ${newFrozen} + Waste ${existingWaste} = ${newTotal}. Adjust values to sum to ${originalStock}.`
            );
            return;
          }
        }

        const updateData = activeTab === 'products' ? {
          name: formData.name,
          category: formData.category,
          sellingPrice: Number(formData.price),
          stock: (selectedProduct as Product).stock || 0,
          shopStock: Number(formData.shopStock),
          freezerStock: Number(formData.freezerStock),
          minStock: Number(formData.minStock),
          shelfLife: Number(formData.shelfLife),
          imageUrl: formData.imageUrl,
          itemType: formData.category === 'raw_material' ? 'material' : 'product'
        } : {
          name: formData.name,
          brand: formData.brand,
          category: formData.category,
          unit: formData.unit,
          currentStock: Number(formData.stock),
          minStock: Number(formData.minStock),
          imageUrl: formData.imageUrl,
          expiryDate: formData.expiryDate || ''
        };

        await updateDoc(itemRef, updateData);

        // Log stock movements if changed
        if (currentUserProfile) {
          if (activeTab === 'products') {
            const oldProduct = selectedProduct as Product;
            if (Number(formData.shopStock) !== oldProduct.shopStock) {
              const prevStock = oldProduct.shopStock || 0;
              const newStock = Number(formData.shopStock);
              const diff = newStock - prevStock;
              await addDoc(collection(db, 'stockMovements'), {
                itemId: selectedProduct.id,
                itemName: formData.name,
                itemType: 'product',
                type: diff > 0 ? 'in' : 'out',
                quantity: Math.abs(diff),
                previousStock: prevStock,
                newStock: newStock,
                location: 'shop',
                reason: 'manual_adjustment',
                userId: currentUserProfile.id,
                userName: currentUserProfile.name,
                timestamp: Timestamp.now()
              });
            }
            if (Number(formData.freezerStock) !== oldProduct.freezerStock) {
              const prevStock = oldProduct.freezerStock || 0;
              const newStock = Number(formData.freezerStock);
              const diff = newStock - prevStock;
              await addDoc(collection(db, 'stockMovements'), {
                itemId: selectedProduct.id,
                itemName: formData.name,
                itemType: 'product',
                type: diff > 0 ? 'in' : 'out',
                quantity: Math.abs(diff),
                previousStock: prevStock,
                newStock: newStock,
                location: 'freezer',
                reason: 'manual_adjustment',
                userId: currentUserProfile.id,
                userName: currentUserProfile.name,
                timestamp: Timestamp.now()
              });
            }
          } else {
            const oldMaterial = (selectedProduct as unknown) as RawMaterial;
            if (Number(formData.stock) !== oldMaterial.currentStock) {
              const prevStock = oldMaterial.currentStock || 0;
              const newStock = Number(formData.stock);
              const diff = newStock - prevStock;
              await addDoc(collection(db, 'stockMovements'), {
                itemId: selectedProduct.id,
                itemName: formData.name,
                itemType: 'material',
                type: diff > 0 ? 'in' : 'out',
                quantity: Math.abs(diff),
                previousStock: prevStock,
                newStock: newStock,
                location: 'none',
                reason: 'manual_adjustment',
                userId: currentUserProfile.id,
                userName: currentUserProfile.name,
                timestamp: Timestamp.now()
              });
            }
          }
        }

        // Sync logic for Edit
        if (activeTab === 'products' && formData.category === 'raw_material') {
          await setDoc(doc(db, 'rawMaterials', selectedProduct.id), {
            name: formData.name,
            brand: formData.brand,
            category: 'raw_material',
            unit: 'units',
            currentStock: Number(formData.stock),
            minStock: Number(formData.minStock),
            imageUrl: formData.imageUrl || '',
            expiryDate: formData.expiryDate || '',
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } else if (activeTab === 'materials') {
          // If we edit a material, check if it exists as a product and sync back
          try {
            const prodDoc = await getDoc(doc(db, 'products', selectedProduct.id));
            if (prodDoc.exists()) {
              await updateDoc(doc(db, 'products', selectedProduct.id), {
                name: formData.name,
                stock: Number(formData.stock),
                minStock: Number(formData.minStock),
                imageUrl: formData.imageUrl
              });
            }
          } catch (error) {
            // Product doesn't exist in products collection, that's fine
            // Raw material can exist independently
          }
        }

        toast.success(t('itemUpdated') || 'Item updated successfully');
      } else {
        // Handle Add
        if (activeTab === 'products') {
          const productRef = await addDoc(collection(db, 'products'), {
            name: formData.name,
            category: formData.category || CATEGORIES[0],
            sellingPrice: Number(formData.price),
            stock: Number(formData.shopStock) + Number(formData.freezerStock),
            shopStock: Number(formData.shopStock),
            freezerStock: Number(formData.freezerStock),
            minStock: Number(formData.minStock),
            shelfLife: Number(formData.shelfLife),
            imageUrl: formData.imageUrl,
            createdAt: new Date().toISOString(),
            itemType: formData.category === 'raw_material' ? 'material' : 'product'
          });

          // Sync to raw materials if category is 'raw_material'
          if (formData.category === 'raw_material') {
            await setDoc(doc(db, 'rawMaterials', productRef.id), {
              name: formData.name,
              brand: formData.brand,
              category: 'raw_material',
              unit: 'units',
              currentStock: Number(formData.stock),
              minStock: Number(formData.minStock),
              imageUrl: formData.imageUrl || '',
              createdAt: new Date().toISOString()
            });
          }

          if (currentUserProfile) {
            // Log stock movements
            if (Number(formData.shopStock) > 0) {
              await addDoc(collection(db, 'stockMovements'), {
                itemId: productRef.id,
                itemName: formData.name,
                itemType: 'product',
                type: 'in',
                quantity: Number(formData.shopStock),
                location: 'shop',
                reason: 'initial_stock',
                userId: currentUserProfile.id,
                userName: currentUserProfile.name,
                timestamp: Timestamp.now()
              });
            }
            if (Number(formData.freezerStock) > 0) {
              await addDoc(collection(db, 'stockMovements'), {
                itemId: productRef.id,
                itemName: formData.name,
                itemType: 'product',
                type: 'in',
                quantity: Number(formData.freezerStock),
                location: 'freezer',
                reason: 'initial_stock',
                userId: currentUserProfile.id,
                userName: currentUserProfile.name,
                timestamp: Timestamp.now()
              });
            }
          }
        } else {
          const materialRef = await addDoc(collection(db, 'rawMaterials'), {
            name: formData.name,
            brand: formData.brand,
            category: formData.category || 'cooking',
            unit: formData.unit,
            currentStock: Number(formData.stock),
            minStock: Number(formData.minStock),
            imageUrl: formData.imageUrl || '',
            expiryDate: formData.expiryDate || '',
            createdAt: new Date().toISOString()
          });
          if (currentUserProfile) {
            // Log stock movement
            if (Number(formData.stock) > 0) {
              await addDoc(collection(db, 'stockMovements'), {
                itemId: materialRef.id,
                itemName: formData.name,
                itemType: 'material',
                type: 'in',
                quantity: Number(formData.stock),
                location: 'none',
                reason: 'initial_stock',
                userId: currentUserProfile.id,
                userName: currentUserProfile.name,
                timestamp: Timestamp.now()
              });
            }
          }
        }
        toast.success(t('itemAdded') || 'Item added successfully');
      }
      setIsModalOpen(false);
      setSelectedProduct(null);
      setFormData({
        name: '',
        brand: '',
        category: '',
        price: 0,
        unit: 'kg',
        stock: 0,
        shopStock: 0,
        freezerStock: 0,
        minStock: 0,
        shelfLife: 24,
        imageUrl: '',
        expiryDate: ''
      });
    } catch (error) {
      console.error('Error saving inventory item:', error);
      toast.error(t('errorSavingItem') || 'Error saving item');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white">{t('inventory')}</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">{t('inventoryDesc')}</p>
        </div>
        <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
          <button 
            onClick={() => setViewMode('list')}
            className={clsx(
              "p-2 rounded-lg transition-all",
              viewMode === 'list' ? "bg-primary-600 text-white shadow-md" : "text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400"
            )}
            title={t('listView')}
          >
            <LayoutList className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setViewMode('card')}
            className={clsx(
              "p-2 rounded-lg transition-all",
              viewMode === 'card' ? "bg-primary-600 text-white shadow-md" : "text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400"
            )}
            title={t('cardView')}
          >
            <LayoutGrid className="w-5 h-5" />
          </button>
        </div>
      </div>

      {getPredictiveSuggestions().length > 0 && (
        <div className="card bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900/30 p-4">
          <div className="flex items-center gap-3 mb-3">
            <Zap className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <h3 className="font-bold text-amber-900 dark:text-amber-100">{t('reorderSuggestions')}</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {getPredictiveSuggestions().map(m => (
              <div key={m.id} className="px-3 py-1 bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-900/30 rounded-lg text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-2">
                {m.name}
                <span className="text-[10px] opacity-60">({m.currentStock} {m.unit})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 p-1 bg-slate-100 dark:bg-zinc-900 rounded-2xl w-fit">
        <button 
          onClick={() => setActiveTab('products')}
          className={clsx(
            "px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
            activeTab === 'products' ? "bg-white dark:bg-primary-600 text-primary-600 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          {t('product')}
        </button>
        <button 
          onClick={() => setActiveTab('materials')}
          className={clsx(
            "px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
            activeTab === 'materials' ? "bg-white dark:bg-primary-600 text-primary-600 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          {t('rawMaterials')}
        </button>
        <button
          onClick={() => setActiveTab('activities')}
          className={clsx(
            "px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
            activeTab === 'activities' ? "bg-white dark:bg-primary-600 text-primary-600 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          <div className="flex items-center gap-2">
            <History className="w-4 h-4" />
            {t('activities')}
          </div>
        </button>
        <button
          onClick={() => setActiveTab('waste')}
          className={clsx(
            "px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
            activeTab === 'waste' ? "bg-white dark:bg-primary-600 text-primary-600 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Waste Management
          </div>
        </button>
      </div>

      <div className="card flex flex-col lg:flex-row items-stretch lg:items-center gap-4 py-4 border-slate-100 dark:border-white/10">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600 w-5 h-5" />
          <input 
            type="text" 
            placeholder={t('search')} 
            className="input pl-12 bg-slate-50/50 dark:bg-zinc-900/50 border-none w-full" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer select-none px-3 py-2 bg-slate-50/50 dark:bg-zinc-900/50 rounded-xl border border-transparent hover:border-slate-200 dark:hover:border-white/10 transition-all">
            <input 
              type="checkbox" 
              className="w-4 h-4 rounded border-slate-300 dark:border-white/10 text-primary-600 focus:ring-primary-500"
              checked={showDisabled}
              onChange={(e) => setShowDisabled(e.target.checked)}
            />
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t('showDisabled') || 'Show Disabled'}</span>
          </label>
          <select 
            className="input py-2 bg-slate-50/50 dark:bg-zinc-900/50 border-none text-sm font-bold min-w-[140px]"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
          >
            <option value="All">{t('all')}</option>
            <option value="Regular">{t('regular')}</option>
            <option value="Pack">{t('pack')}</option>
            <option value="RawMaterial">{t('rawMaterial')}</option>
          </select>
          <select 
            className="input py-2 bg-slate-50/50 dark:bg-zinc-900/50 border-none text-sm font-bold min-w-[140px]"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="all">{t('allCategories')}</option>
            {activeTab === 'products' ? (
              CATEGORIES.filter(c => !['flour', 'dairy', 'sugar', 'liquid', 'other_material'].includes(c)).map(cat => (
                <option key={cat} value={cat}>{tCategory(cat)}</option>
              ))
            ) : (
              ['flour', 'dairy', 'sugar', 'liquid', 'other_material', 'cooking', 'maintenance', 'cleaning', 'others'].map(cat => (
                <option key={cat} value={cat}>{tCategory(cat)}</option>
              ))
            )}
          </select>
          <select 
            className="input py-2 bg-slate-50/50 dark:bg-[#0a0a0a]/50 border-none text-sm font-bold min-w-[140px]"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="all">{t('allStatuses')}</option>
            {activeTab === 'products' ? (
              ['none', 'frozen', 'ordered', 'requested', 'cancelled'].map(status => (
                <option key={status} value={status}>{t(status)}</option>
              ))
            ) : (
              ['none', 'requested', 'ordered', 'cancelled'].map(status => (
                <option key={status} value={status}>{t(status)}</option>
              ))
            )}
          </select>
          <button 
            onClick={resetFilters}
            className="btn-secondary gap-2 w-full sm:w-auto justify-center"
          >
            <Filter className="w-4 h-4" />
            {t('reset')}
          </button>
        </div>
      </div>

      {activeTab === 'products' ? (
        viewMode === 'card' ? (
          <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
                <div key={product.id}
                  onClick={() => {
                    setSelectedProduct(product);
                    setLastBatch(null);
                    setIsDetailsModalOpen(true);
                    const token = localStorage.getItem('bakery_token');
                    authFetch(`/api/db/batches?where=${encodeURIComponent(JSON.stringify({productId: product.id, status: 'completed'}))}&orderBy=${encodeURIComponent(JSON.stringify({startDate: 'desc'}))}&take=1`, {
                      headers: { Authorization: `Bearer ${token}` }
                    }).then(r => r.ok ? r.json() : []).then((data: any[]) => {
                      if (data && data.length > 0) setLastBatch(data[0]);
                    }).catch(() => {});
                  }}
                  className="card group hover:shadow-xl transition-all duration-300 overflow-hidden p-0 border-slate-100 dark:border-white/10 cursor-pointer"
                >
                <div className="h-48 bg-slate-100 dark:bg-zinc-900 relative overflow-hidden">
                  <img 
                    src={product.imageUrl || `https://picsum.photos/seed/${product.name}/400/300`} 
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-4 right-4 flex flex-col gap-2 items-end">
                    <div className="px-3 py-1 bg-white/90 dark:bg-black/90 backdrop-blur-sm rounded-full text-[10px] font-bold uppercase tracking-wider text-primary-600 dark:text-primary-400 border border-slate-100 dark:border-white/10 shadow-sm">
                      {tCategory(product.category)}
                    </div>
                    {product.status && product.status !== 'none' && (
                      <div className={clsx(
                        "px-3 py-1 backdrop-blur-sm rounded-full text-[10px] font-bold uppercase tracking-wider border border-slate-100 dark:border-white/10 shadow-sm",
                        product.status === 'frozen' ? 'bg-indigo-500/90 text-white' : 'bg-emerald-500/90 text-white'
                      )}>
                        {t(product.status)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-lg">{tProduct(product)}</h3>
                      <p className="text-sm font-bold text-primary-600 dark:text-primary-400">{product.sellingPrice.toLocaleString()} {CURRENCY}</p>
                    </div>
                    <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-900 text-slate-400 transition-all">
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t('stock')}</span>
                      <div className="flex flex-col items-end">
                        <div className={clsx(
                          "flex items-center gap-2 font-bold",
                          product.stock < product.minStock ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-white"
                        )}>
                          {product.stock < product.minStock && <AlertTriangle className="w-4 h-4" />}
                          {product.stock} {t('units')}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setAdjustmentData({
                                itemId: product.id,
                                itemName: product.name,
                                itemType: 'product',
                                type: 'out',
                                quantity: 0,
                                reason: 'manual_adjustment',
                                location: 'shop',
                                toLocation: 'waste'
                              });
                              setIsAdjustmentModalOpen(true);
                            }}
                            className="p-1 rounded-md bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors ml-1"
                            title={t('adjustStock') || 'Adjust Stock'}
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className={clsx(
                            "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                            getStockStatusColor(getStockStatusKey(product))
                          )}>
                            {t(getStockStatusKey(product))}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 dark:text-slate-600">
                            <Store className="w-3 h-3" />
                            Shop: {product.shopStock || 0}
                          </div>
                          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 dark:text-slate-600">
                            <Snowflake className="w-3 h-3" />
                            Frozen: {product.freezerStock || 0}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-zinc-900 rounded-full overflow-hidden">
                      <div 
                        className={clsx(
                          "h-full rounded-full transition-all",
                          product.stock < product.minStock ? "bg-red-500" : "bg-primary-500"
                        )}
                        style={{ width: `${Math.min((product.stock / (product.minStock * 2)) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-slate-50 dark:border-white/10">
                    <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-600 font-medium mb-3">
                      {product.isPack ? <Package className="w-4 h-4" /> : <List className="w-4 h-4" />}
                      <span>
                        {product.isPack 
                          ? `${product.packItems?.length || 0} ${t('packItems')}`
                          : `${product.ingredients?.length || 0} ${t('ingredients')}`
                        }
                      </span>
                    </div>

                    {/* Definition Summary */}
                    <div className="space-y-1">
                      {product.isPack ? (
                        product.packItems?.slice(0, 3).map((item, idx) => {
                          const packProduct = products.find(p => p.id === item.productId);
                          return (
                            <div key={idx} className="flex justify-between text-[10px] text-slate-400 dark:text-slate-600 italic">
                              <span>• {packProduct ? tProduct(packProduct) : t('product')}</span>
                              <span>x{item.quantity}</span>
                            </div>
                          );
                        })
                      ) : (
                        product.ingredients?.slice(0, 3).map((ing, idx) => {
                          const material = materials.find(m => m.id === ing.materialId);
                          return (
                            <div key={idx} className="flex justify-between text-[10px] text-slate-400 dark:text-slate-600 italic">
                              <span>• {material ? tProduct(material) : t('material')}</span>
                              <span>{ing.quantity} {material?.unit || 'g'}</span>
                            </div>
                          );
                        })
                      )}
                      {((product.isPack ? product.packItems?.length : product.ingredients?.length) || 0) > 3 && (
                        <p className="text-[10px] text-primary-500 font-bold">+{((product.isPack ? product.packItems?.length : product.ingredients?.length) || 0) - 3} more...</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-slate-50 dark:border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsDetailsModalOpen(false);
                          openInventoryModal(product);
                        }}
                        className="p-2 text-slate-400 hover:text-white hover:bg-primary-600 dark:hover:bg-primary-500 rounded-lg transition-all duration-200 border border-transparent hover:border-primary-600 dark:hover:border-primary-500"
                        title={t('edit')}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <Pagination 
              currentPage={productsPage}
              totalPages={totalProductsPages}
              onPageChange={setProductsPage}
            />
          </div>
          </>
        ) : (
          <div className="card p-0 overflow-hidden border-slate-100 dark:border-white/10">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-slate-400 dark:text-slate-600 text-xs font-bold uppercase tracking-widest border-b border-slate-100 dark:border-white/10">
                    <th className="px-8 py-5 whitespace-nowrap">{t('name')}</th>
                    <th className="px-8 py-5 whitespace-nowrap">{t('category')}</th>
                    <th className="px-8 py-5 whitespace-nowrap">{t('status')}</th>
                    <th className="px-8 py-5 whitespace-nowrap">{t('stock')}</th>
                    <th className="px-8 py-5 text-right whitespace-nowrap">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-white/10">
                  {filteredProducts.map((product) => (
                    <tr key={product.id}
                      onClick={() => openInventoryModal(product)}
                      className="group hover:bg-slate-50/50 dark:hover:bg-zinc-900/50 transition-all cursor-pointer"
                    >
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-900 overflow-hidden shrink-0 border border-slate-200 dark:border-white/10">
                            <img 
                              src={product.imageUrl || `https://picsum.photos/seed/${product.name}/100/100`} 
                              alt="" 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <span className="font-bold text-slate-900 dark:text-white whitespace-nowrap">{tProduct(product)}</span>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <span className="px-3 py-1 bg-slate-100 dark:bg-zinc-900 rounded-full text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 whitespace-nowrap border border-slate-200 dark:border-white/10">
                          {tCategory(product.category)}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <span className={clsx(
                          "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap border",
                          getStockStatusColor(getStockStatusKey(product))
                        )}>
                          {t(getStockStatusKey(product))}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <div className={clsx(
                          "font-bold text-sm whitespace-nowrap",
                          product.stock < product.minStock ? "text-red-600 dark:text-red-400" : "text-slate-700 dark:text-slate-300"
                        )}>
                          <div>{product.stock} {t('units')}</div>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] font-medium text-slate-400 dark:text-slate-600">
                            <span className="flex items-center gap-0.5"><Store className="w-2.5 h-2.5" /> {product.shopStock || 0}</span>
                            <span className="flex items-center gap-0.5"><Snowflake className="w-2.5 h-2.5" /> {product.freezerStock || 0}</span>
                            <span className="flex items-center gap-0.5"><AlertTriangle className="w-2.5 h-2.5" /> {product.wasteQuantity || 0}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex justify-end items-center gap-2">
                          {product.disabled ? (
                            <button
                              onClick={() => restoreProduct(product.id)}
                              className="p-2 text-slate-400 hover:text-white hover:bg-emerald-600 dark:hover:bg-emerald-500 rounded-lg transition-all duration-200 border border-transparent hover:border-emerald-600 dark:hover:border-emerald-500"
                              title={t('restore')}
                            >
                              <RefreshCcw className="w-4 h-4" />
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsDetailsModalOpen(false);
                                  openInventoryModal(product);
                                }}
                                className="px-3 py-1 text-xs font-bold text-primary-600 dark:text-primary-400 hover:text-white hover:bg-primary-600 dark:hover:bg-primary-500 rounded-lg transition-all duration-200 border border-transparent hover:border-primary-600 dark:hover:border-primary-500"
                                title={t('edit')}
                              >
                                {t('details')}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination 
              currentPage={productsPage}
              totalPages={totalProductsPages}
              onPageChange={setProductsPage}
            />
          </div>
      )) : activeTab === 'activities' ? (
          <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('activities')}</h2>
          </div>
          <div className="card p-0 overflow-hidden border-slate-100 dark:border-white/10">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-slate-400 dark:text-slate-600 text-xs font-bold uppercase tracking-widest border-b border-slate-100 dark:border-white/10">
                  <th className="px-8 py-5 whitespace-nowrap">{t('date')}</th>
                  <th className="px-8 py-5 whitespace-nowrap">{t('item')}</th>
                  <th className="px-8 py-5 whitespace-nowrap">{t('type')}</th>
                  <th className="px-8 py-5 whitespace-nowrap">{t('quantity')}</th>
                  <th className="px-8 py-5 whitespace-nowrap">{t('location')}</th>
                  <th className="px-8 py-5 whitespace-nowrap">{t('reason')}</th>
                  <th className="px-8 py-5 whitespace-nowrap">{t('user')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-white/10">
                {movements.map((movement) => (
                  <tr key={movement.id} className="group hover:bg-slate-50/50 dark:hover:bg-zinc-900/50 transition-all">
                    <td className="px-8 py-5 font-semibold text-slate-400 dark:text-slate-600 text-sm whitespace-nowrap">
                      {movement.timestamp ? (typeof movement.timestamp === 'string' ? format(new Date(movement.timestamp), 'MMM dd, HH:mm') : format(movement.timestamp.toDate(), 'MMM dd, HH:mm')) : '-'}
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 dark:text-white whitespace-nowrap">{tProduct(movement.itemName)}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-600">{t(movement.itemType)}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className={clsx(
                        "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap border",
                        movement.type === 'in' ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/30' : 
                        movement.type === 'out' ? 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/30' :
                        'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/30'
                      )}>
                        {t(movement.type)}
                      </span>
                    </td>
                    <td className="px-8 py-5 font-bold text-slate-700 dark:text-slate-300">
                      {movement.type === 'out' ? '-' : '+'}{movement.quantity}
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
                        {movement.location === 'shop' ? <Store className="w-4 h-4" /> : <Snowflake className="w-4 h-4" />}
                        {t(movement.location || 'none')}
                      </div>
                    </td>
                    <td className="px-8 py-5 font-medium text-slate-500 dark:text-slate-400 text-sm">
                      {t(movement.reason)}
                    </td>
                    <td className="px-8 py-5 font-semibold text-slate-400 dark:text-slate-600 text-sm whitespace-nowrap">
                      {movement.userName}
                    </td>
                  </tr>
                ))}
                {movements.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-8 py-12 text-center text-slate-400 dark:text-slate-600 italic">
                      {t('noMovementsFound')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination 
            currentPage={movementsPage}
            totalPages={totalMovementsPages}
            onPageChange={setMovementsPage}
          />
        </div>
      </div>
      ) : activeTab === 'waste' ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Waste Management</h2>
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Total Waste: <span className="font-bold text-red-600">{movements.filter(m => m.reason === 'waste').reduce((sum, m) => sum + (m.quantity || 0), 0)} units</span>
            </div>
          </div>
          <div className="card p-0 overflow-hidden border-slate-100 dark:border-white/10">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-slate-400 dark:text-slate-600 text-xs font-bold uppercase tracking-widest border-b border-slate-100 dark:border-white/10">
                    <th className="px-8 py-5 whitespace-nowrap">{t('date')}</th>
                    <th className="px-8 py-5 whitespace-nowrap">{t('item')}</th>
                    <th className="px-8 py-5 whitespace-nowrap">Waste Quantity</th>
                    <th className="px-8 py-5 whitespace-nowrap">{t('reason')}</th>
                    <th className="px-8 py-5 whitespace-nowrap">{t('user')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-white/10">
                  {movements.filter(m => m.reason === 'waste').map((movement) => (
                    <tr key={movement.id} className="group hover:bg-slate-50/50 dark:hover:bg-zinc-900/50 transition-all">
                      <td className="px-8 py-5 font-semibold text-slate-400 dark:text-slate-600 text-sm whitespace-nowrap">
                        {movement.timestamp ? (typeof movement.timestamp === 'string' ? format(new Date(movement.timestamp), 'MMM dd, HH:mm') : format(movement.timestamp.toDate(), 'MMM dd, HH:mm')) : '-'}
                      </td>
                      <td className="px-8 py-5">
                        <span className="font-bold text-slate-900 dark:text-white">{tProduct(movement.itemName)}</span>
                      </td>
                      <td className="px-8 py-5">
                        <span className="px-3 py-1 rounded-full text-sm font-bold bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400">
                          -{movement.quantity}
                        </span>
                      </td>
                      <td className="px-8 py-5 font-medium text-slate-500 dark:text-slate-400 text-sm">
                        {t(movement.reason)}
                      </td>
                      <td className="px-8 py-5 font-semibold text-slate-400 dark:text-slate-600 text-sm whitespace-nowrap">
                        {movement.userName}
                      </td>
                    </tr>
                  ))}
                  {movements.filter(m => m.reason === 'waste').length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-8 py-12 text-center text-slate-400 dark:text-slate-600 italic">
                        No waste recorded
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={movementsPage}
              totalPages={totalMovementsPages}
              onPageChange={setMovementsPage}
            />
          </div>
        </div>
      ) : (
        viewMode === 'card' ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredMaterials.map((material) => (
                <div key={material.id} className="card group hover:shadow-xl transition-all duration-300 border-slate-100 dark:border-white/10 p-0 overflow-hidden bg-white dark:bg-zinc-900">
                  <div className="relative h-40">
                    <img 
                      src={material.imageUrl || `https://picsum.photos/seed/${material.name}/400/300`} 
                      alt={material.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-3 right-3">
                      <div className={clsx(
                        "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md border",
                        getStockLevel(material.currentStock, material.minStock).color
                      )}>
                        {t(getStockLevel(material.currentStock, material.minStock).label)}
                      </div>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-1">{material.brand || 'Artisanal'}</p>
                        <h3 className="font-bold text-slate-900 dark:text-white">{tProduct(material)}</h3>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{material.currentStock} {material.unit}</p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenPurchaseModal(material);
                            }}
                            className="p-2 rounded-md bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
                            title={t('purchase') || 'Purchase'}
                          >
                            🛒
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-600 font-bold uppercase tracking-widest">{t('stock')}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/5">
                      <span className="text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">{t('minStock')}: {material.minStock} {material.unit}</span>
                      {material.disabled ? (
                        <button
                          onClick={() => restoreMaterial(material.id)}
                          className="p-2 text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                          title={t('restore')}
                        >
                          <RefreshCcw className="w-4 h-4" />
                        </button>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setIsDetailsModalOpen(false);
                              openInventoryModal(material);
                            }}
                            className="p-2 text-slate-400 hover:text-white hover:bg-primary-600 dark:hover:bg-primary-500 rounded-lg transition-all duration-200 border border-transparent hover:border-primary-600 dark:hover:border-primary-500"
                            title={t('edit')}
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Pagination 
              currentPage={materialsPage}
              totalPages={totalMaterialsPages}
              onPageChange={setMaterialsPage}
            />
          </div>
        ) : (
          <div className="card p-0 overflow-hidden border-slate-100 dark:border-[#2a1e17]">
            <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-slate-400 dark:text-slate-600 text-xs font-bold uppercase tracking-widest border-b border-slate-100 dark:border-[#2a1e17]">
                <th className="px-8 py-5 whitespace-nowrap">{t('name')}</th>
                <th className="px-8 py-5 whitespace-nowrap">{t('category')}</th>
                <th className="px-8 py-5 whitespace-nowrap">{t('currentStock')}</th>
                <th className="px-8 py-5 whitespace-nowrap">{t('minStock')}</th>
                <th className="px-8 py-5 whitespace-nowrap">{t('level')}</th>
                <th className="px-8 py-5 text-right whitespace-nowrap">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-white/10">
              {filteredMaterials.map((material) => (
                <tr key={material.id} className="group hover:bg-slate-50/50 dark:hover:bg-zinc-900/50 transition-all">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-900 overflow-hidden flex items-center justify-center text-slate-500 border border-slate-200 dark:border-white/10">
                        {material.imageUrl ? (
                          <img src={material.imageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          material.category === 'Liquid' ? <Droplets className="w-5 h-5" /> : <Scale className="w-5 h-5" />
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 dark:text-white whitespace-nowrap">{tProduct(material)}</span>
                        {material.brand && (
                          <span className="text-xs font-medium text-slate-400 dark:text-slate-500">{material.brand}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="px-3 py-1 bg-slate-100 dark:bg-zinc-900 rounded-full text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 whitespace-nowrap border border-slate-200 dark:border-white/10">
                      {tCategory(material.category)}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <div className={clsx(
                      "font-bold text-sm whitespace-nowrap",
                      material.currentStock < material.minStock ? "text-red-600 dark:text-red-400" : "text-slate-700 dark:text-slate-300"
                    )}>
                      {material.currentStock} {t(material.unit)}
                    </div>
                  </td>
                  <td className="px-8 py-5 font-semibold text-slate-400 dark:text-slate-500 text-sm whitespace-nowrap">
                    {material.minStock} {t(material.unit)}
                  </td>
                  <td className="px-8 py-5 whitespace-nowrap">
                    {(() => {
                      const level = getStockLevel(material.currentStock, material.minStock);
                      return (
                        <span className={clsx(
                          "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                          level.color,
                          level.label === 'empty' || level.label === 'critical' ? 'border-red-200 dark:border-red-900/30' : 
                          level.label === 'medium' ? 'border-amber-200 dark:border-amber-900/30' : 'border-emerald-200 dark:border-emerald-900/30'
                        )}>
                          {t(level.label)}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex items-center justify-end gap-2 transition-all">
                      {material.disabled ? (
                        <button 
                          onClick={() => restoreMaterial(material.id)}
                          title={t('restore')}
                          className="w-9 h-9 flex items-center justify-center rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-emerald-400 hover:text-emerald-600 hover:border-emerald-200 dark:hover:border-emerald-900/30 transition-all"
                        >
                          <RefreshCcw className="w-4 h-4" />
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsDetailsModalOpen(false);
                              openInventoryModal(material);
                            }}
                            title={t('edit')}
                            className="w-9 h-9 flex items-center justify-center rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-400 hover:text-white hover:bg-primary-600 dark:hover:bg-primary-500 hover:border-primary-600 dark:hover:border-primary-500 transition-all duration-200"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenPurchaseModal(material);
                            }}
                            title={t('purchase') || 'Purchase'}
                            className="w-9 h-9 flex items-center justify-center rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-400 hover:text-white hover:bg-emerald-600 dark:hover:bg-emerald-500 hover:border-emerald-600 dark:hover:border-emerald-500 transition-all duration-200 text-lg"
                          >
                            🛒
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination 
          currentPage={materialsPage}
          totalPages={totalMaterialsPages}
          onPageChange={setMaterialsPage}
        />
        </div>
      ))
    }
      {isDetailsModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-2xl shadow-2xl p-0 overflow-hidden border-slate-100 dark:border-white/10 bg-white dark:bg-zinc-900">
            <div className="h-64 bg-slate-100 dark:bg-zinc-900 relative">
              <img 
                src={selectedProduct.imageUrl || `https://picsum.photos/seed/${selectedProduct.name}/800/600`} 
                alt={selectedProduct.name}
                className="w-full h-full object-cover"
              />
              <button 
                onClick={() => {
                  setIsDetailsModalOpen(false);
                  setIsEditingDetails(false);
                }}
                className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-black/20 hover:bg-black/40 text-white backdrop-blur-md transition-all"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <div className="p-8">
              <div className="flex items-start justify-between mb-8">
                <div className="flex-1 mr-4">
                  {isEditingDetails ? (
                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">{t('category')}</label>
                      <select 
                        className="input py-1 text-sm"
                        value={editFormData.category || ''}
                        onChange={(e) => setEditFormData({...editFormData, category: e.target.value})}
                      >
                        {CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>{tCategory(cat)}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <>
                      <span className="px-3 py-1 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 rounded-full text-[10px] font-bold uppercase tracking-wider border border-primary-100 dark:border-primary-900/30 mb-2 inline-block">
                        {tCategory(selectedProduct.category)}
                      </span>
                      <h2 className="text-3xl font-display font-bold text-slate-900 dark:text-white">{tProduct(selectedProduct)}</h2>
                      {selectedProduct.itemType !== 'material' && (
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500 dark:text-slate-400">
                          <span>🏭</span>
                          {lastBatch ? (
                            <span>
                              <span className="font-semibold text-slate-700 dark:text-slate-200">Production Batch — {lastBatch.location || 'shop'}</span>
                              {lastBatch.createdBy ? <span> · <span className="font-semibold text-slate-700 dark:text-slate-200">{lastBatch.createdBy}</span></span> : ''}
                              {(lastBatch.endDate || lastBatch.startDate) ? (() => { const d = lastBatch.endDate || lastBatch.startDate; return <span> · {new Date(Number(d) || d).toLocaleDateString()} {new Date(Number(d) || d).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>; })() : null}
                            </span>
                          ) : (
                            <span className="italic text-slate-400 dark:text-slate-500">No production batch recorded</span>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-slate-400 dark:text-slate-600 text-xs font-bold uppercase tracking-widest mb-1">{t('status')}</p>
                  {selectedProduct.itemType === 'material' ? (
                    // Raw material: show purchase status (not editable)
                    <span className={clsx(
                      "px-4 py-1.5 rounded-xl text-sm font-bold border",
                      editFormData.lastPurchaseStatus?.toLowerCase().includes('cancel') ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-100 dark:border-red-900/30" :
                      editFormData.lastPurchaseStatus?.toLowerCase().includes('draft') ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/30" :
                      editFormData.lastPurchaseStatus?.toLowerCase().includes('received') || editFormData.lastPurchaseStatus?.toLowerCase().includes('approved') ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30" :
                      "bg-slate-50 dark:bg-zinc-900 text-slate-600 dark:text-slate-400 border-slate-100 dark:border-white/10"
                    )}>
                      {editFormData.lastPurchaseStatus || 'none'}
                    </span>
                  ) : (
                    // Product: show editable status
                    isEditingDetails ? (
                      <select
                        className="input py-1 text-sm"
                        value={editFormData.status || 'none'}
                        onChange={(e) => setEditFormData({...editFormData, status: e.target.value as any})}
                      >
                        <option value="none">{t('none')}</option>
                        <option value="frozen">{t('frozen')}</option>
                        <option value="ordered">{t('ordered')}</option>
                      </select>
                    ) : (
                      <span className={clsx(
                        "px-4 py-1.5 rounded-xl text-sm font-bold border",
                        selectedProduct.status === 'frozen' ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/30" :
                        selectedProduct.status === 'ordered' ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/30" :
                        "bg-slate-50 dark:bg-zinc-900 text-slate-600 dark:text-slate-400 border-slate-100 dark:border-white/10"
                      )}>
                        {t(selectedProduct.status || 'none')}
                      </span>
                    )
                  )}
                </div>
              </div>

              <div className={clsx(
                "grid gap-6 mb-8",
                selectedProduct.itemType === 'product' ? "grid-cols-2 md:grid-cols-4" : "grid-cols-3"
              )}>
                <div className="p-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-white/10">
                  <p className="text-slate-400 dark:text-slate-600 text-[10px] font-bold uppercase tracking-widest mb-1">
                    {t('totalStock')}
                    {isEditingDetails && <span className="text-xs text-amber-600 dark:text-amber-400 ml-1">(read-only)</span>}
                  </p>
                  {isEditingDetails ? (
                    // Both product and raw material: total stock is READ-ONLY (calculated from locations or purchases)
                    <p className="text-xl font-bold text-slate-900 dark:text-white cursor-not-allowed opacity-60">
                      {selectedProduct.itemType === 'product'
                        ? ((editFormData.shopStock || 0) + (editFormData.freezerStock || 0) + (editFormData.wasteQuantity || 0))
                        : (editFormData.stock || (selectedProduct as any).currentStock || 0)} {selectedProduct.unit || 'g'}
                    </p>
                  ) : (
                    <p className="text-xl font-bold text-slate-900 dark:text-white">{selectedProduct.itemType === 'product' ? ((selectedProduct.shopStock || 0) + (selectedProduct.freezerStock || 0) + (selectedProduct.wasteQuantity || 0)) : ((selectedProduct as any).currentStock || selectedProduct.stock || 0)} {selectedProduct.unit || 'g'}</p>
                  )}
                </div>

                {selectedProduct.itemType === 'product' && (
                  <>
                    <div className="p-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-white/10">
                      <p className="text-slate-400 dark:text-slate-600 text-[10px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1">
                        <Store className="w-3 h-3" /> {t('shopStock')}
                      </p>
                      {isEditingDetails ? (
                        <input
                          type="number"
                          className="input py-1 text-sm w-full"
                          value={editFormData.shopStock || 0}
                          onChange={(e) => {
                            const waste = editFormData.wasteQuantity || 0;
                            const originalStock = selectedProduct.stock || 0;
                            const maxShop = Math.max(0, originalStock - waste);
                            const newShop = Math.min(Number(e.target.value), maxShop);
                            const newFrozen = Math.max(0, maxShop - newShop);
                            setEditFormData({...editFormData, shopStock: newShop, freezerStock: newFrozen});
                          }}
                        />
                      ) : (
                        <p className="text-xl font-bold text-slate-900 dark:text-white">{selectedProduct.shopStock || 0}</p>
                      )}
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-white/10">
                      <p className="text-slate-400 dark:text-slate-600 text-[10px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1">
                        <Snowflake className="w-3 h-3" /> {t('freezerStock')}
                      </p>
                      {isEditingDetails ? (
                        <input
                          type="number"
                          className="input py-1 text-sm w-full"
                          value={editFormData.freezerStock || 0}
                          onChange={(e) => {
                            const waste = editFormData.wasteQuantity || 0;
                            const originalStock = selectedProduct.stock || 0;
                            const maxFrozen = Math.max(0, originalStock - waste);
                            const newFrozen = Math.min(Number(e.target.value), maxFrozen);
                            const newShop = Math.max(0, maxFrozen - newFrozen);
                            setEditFormData({...editFormData, freezerStock: newFrozen, shopStock: newShop});
                          }}
                        />
                      ) : (
                        <p className="text-xl font-bold text-slate-900 dark:text-white">{selectedProduct.freezerStock || 0}</p>
                      )}
                    </div>
                  </>
                )}

                <div className="p-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-white/10">
                  <p className="text-slate-400 dark:text-slate-600 text-[10px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-red-500" /> {t('wasteQuantity') || 'Waste'}
                  </p>
                  {isEditingDetails ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        className="input py-1 text-sm w-full"
                        value={editFormData.wasteQuantity || 0}
                        min="0"
                        onChange={(e) => {
                          const newWaste = Math.max(0, Number(e.target.value));
                          setEditFormData({...editFormData, wasteQuantity: newWaste});
                        }}
                      />
                      <span className="text-xs font-bold text-slate-500">{selectedProduct.unit || 'g'}</span>
                    </div>
                  ) : (
                    <p className="text-xl font-bold text-red-600 dark:text-red-400">{selectedProduct.wasteQuantity || 0} {selectedProduct.unit || 'g'}</p>
                  )}
                </div>

                <div className="p-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-white/10">
                  <p className="text-slate-400 dark:text-slate-600 text-[10px] font-bold uppercase tracking-widest mb-1">{t('price')}</p>
                  {isEditingDetails ? (
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        className="input py-1 text-sm w-full"
                        value={editFormData.sellingPrice || 0}
                        onChange={(e) => setEditFormData({...editFormData, sellingPrice: Number(e.target.value)})}
                      />
                      <span className="text-xs font-bold text-slate-500">{CURRENCY}</span>
                    </div>
                  ) : (
                    <p className="text-xl font-bold text-primary-600 dark:text-primary-400">{selectedProduct.sellingPrice} {CURRENCY}</p>
                  )}
                </div>
                <div className="p-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-white/10">
                  <p className="text-slate-400 dark:text-slate-600 text-[10px] font-bold uppercase tracking-widest mb-1">{t('shelfLife')}</p>
                  {isEditingDetails ? (
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        className="input py-1 text-sm w-full"
                        value={editFormData.shelfLife || 0}
                        onChange={(e) => setEditFormData({...editFormData, shelfLife: Number(e.target.value)})}
                      />
                      <span className="text-xs font-bold text-slate-500">h</span>
                    </div>
                  ) : (
                    <p className="text-xl font-bold text-slate-900 dark:text-white">{selectedProduct.shelfLife}h</p>
                  )}
                </div>
                {selectedProduct.itemType !== 'material' && (
                  <div className="p-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-white/10">
                    <p className="text-slate-400 dark:text-slate-600 text-[10px] font-bold uppercase tracking-widest mb-1">{t('minStock')}</p>
                    {isEditingDetails ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          className="input py-1 text-sm w-full"
                          value={editFormData.minStock || 0}
                          onChange={(e) => setEditFormData({...editFormData, minStock: Number(e.target.value)})}
                        />
                        <span className="text-xs font-bold text-slate-500">{selectedProduct.unit || 'g'}</span>
                      </div>
                    ) : (
                      <p className="text-xl font-bold text-slate-900 dark:text-white">{selectedProduct.minStock} {selectedProduct.unit || 'g'}</p>
                    )}
                  </div>
                )}
              </div>

              {selectedProduct.description && (
                <div className="mb-8">
                  <p className="text-slate-400 dark:text-slate-600 text-[10px] font-bold uppercase tracking-widest mb-2">{t('description')}</p>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{selectedProduct.description}</p>
                </div>
              )}

              {/* Raw Material Definition / Pack Items */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    {selectedProduct.isPack ? <Package className="w-5 h-5 text-amber-600" /> : <List className="w-5 h-5 text-amber-600" />}
                    {selectedProduct.isPack ? t('packItems') : t('ingredients')}
                  </h3>
                  {isEditingDetails && (
                    <button 
                      onClick={() => {
                        if (selectedProduct.isPack) {
                          const packItems = [...(editFormData.packItems || [])];
                          packItems.push({ productId: '', quantity: 1 });
                          setEditFormData({...editFormData, packItems});
                        } else {
                          const ingredients = [...(editFormData.ingredients || [])];
                          ingredients.push({ materialId: '', quantity: 1, type: 'quantity' });
                          setEditFormData({...editFormData, ingredients});
                        }
                      }}
                      className="text-xs font-bold text-primary-600 dark:text-primary-400 hover:text-primary-700 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      {t('add')}
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {isEditingDetails ? (
                    selectedProduct.isPack ? (
                      editFormData.packItems?.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-zinc-900 rounded-xl border border-slate-100 dark:border-white/10">
                          <select 
                            className="input py-1 text-sm flex-1"
                            value={item.productId || ''}
                            onChange={(e) => {
                              const packItems = [...(editFormData.packItems || [])];
                              packItems[idx] = { ...item, productId: e.target.value };
                              setEditFormData({...editFormData, packItems});
                            }}
                          >
                            <option value="">{t('selectProduct')}</option>
                            {products.filter(p => p.id !== selectedProduct.id).map(p => (
                              <option key={p.id} value={p.id}>{tProduct(p)}</option>
                            ))}
                          </select>
                          <input 
                            type="number" 
                            className="input py-1 text-sm w-20"
                            value={item.quantity || 0}
                            onChange={(e) => {
                              const packItems = [...(editFormData.packItems || [])];
                              packItems[idx] = { ...item, quantity: Number(e.target.value) };
                              setEditFormData({...editFormData, packItems});
                            }}
                          />
                          <button 
                            onClick={() => {
                              const packItems = editFormData.packItems?.filter((_, i) => i !== idx);
                              setEditFormData({...editFormData, packItems});
                            }}
                            className="p-1 text-red-500 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    ) : (
                      editFormData.ingredients?.map((ing, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-zinc-900 rounded-xl border border-slate-100 dark:border-white/10">
                          <select 
                            className="input py-1 text-sm flex-1"
                            value={ing.materialId || ''}
                            onChange={(e) => {
                              const ingredients = [...(editFormData.ingredients || [])];
                              ingredients[idx] = { ...ing, materialId: e.target.value };
                              setEditFormData({...editFormData, ingredients});
                            }}
                          >
                            <option value="">{t('selectMaterial')}</option>
                            {materials.map(m => (
                              <option key={m.id} value={m.id}>{tProduct(m)}</option>
                            ))}
                          </select>
                          <input 
                            type="number" 
                            className="input py-1 text-sm w-24"
                            value={ing.quantity || 0}
                            onChange={(e) => {
                              const ingredients = [...(editFormData.ingredients || [])];
                              ingredients[idx] = { ...ing, quantity: Number(e.target.value) };
                              setEditFormData({...editFormData, ingredients});
                            }}
                          />
                          <button 
                            onClick={() => {
                              const ingredients = editFormData.ingredients?.filter((_, i) => i !== idx);
                              setEditFormData({...editFormData, ingredients});
                            }}
                            className="p-1 text-red-500 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    )
                  ) : (
                    selectedProduct.isPack ? (
                      selectedProduct.packItems?.map((item, idx) => {
                        const packProduct = products.find(p => p.id === item.productId);
                        return (
                          <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-zinc-900 rounded-xl border border-slate-100 dark:border-white/10">
                            <span className="font-bold text-slate-700 dark:text-slate-300">{packProduct ? tProduct(packProduct) : t('product')}</span>
                            <span className="text-primary-600 dark:text-primary-400 font-bold">x{item.quantity}</span>
                          </div>
                        );
                      })
                    ) : (
                      selectedProduct.ingredients?.map((ing, idx) => {
                        const material = materials.find(m => m.id === ing.materialId);
                        return (
                          <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-zinc-900 rounded-xl border border-slate-100 dark:border-white/10">
                            <span className="font-bold text-slate-700 dark:text-slate-300">{material ? tProduct(material) : t('material')}</span>
                            <span className="text-primary-600 dark:text-primary-400 font-bold">{ing.quantity} {material?.unit || 'g'}</span>
                          </div>
                        );
                      })
                    )
                  )}
                  {((isEditingDetails ? (selectedProduct.isPack ? editFormData.packItems?.length : editFormData.ingredients?.length) : (selectedProduct.isPack ? selectedProduct.packItems?.length : selectedProduct.ingredients?.length)) || 0) === 0 && (
                    <p className="text-sm text-slate-400 dark:text-slate-600 italic">{t('noItemsDefined') || 'No items defined'}</p>
                  )}
                </div>
              </div>

              <div className="flex gap-4">
                {isEditingDetails ? (
                  <>
                    <button 
                      onClick={() => setIsEditingDetails(false)}
                      className="flex-1 btn-secondary justify-center gap-2 dark:bg-zinc-800 dark:border-white/10 dark:text-slate-300"
                    >
                      {t('cancel')}
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          // Get waste values for both products and raw materials
                          let newWaste = editFormData.wasteQuantity || 0;
                          let oldWaste = selectedProduct.wasteQuantity || 0;

                          // stock = shopStock + freezerStock + wasteQuantity (invariant — total cannot change via editing)
                          const originalStock = selectedProduct.stock || 0;
                          let updatedStock: number;

                          if (selectedProduct.itemType === 'product') {
                            const newShop = editFormData.shopStock || 0;
                            const newFrozen = editFormData.freezerStock || 0;
                            const newWasteVal = newWaste || 0;
                            updatedStock = newShop + newFrozen + newWasteVal;
                            if (updatedStock !== originalStock) {
                              toast.error(
                                `Total must stay at ${originalStock}. Current: ${updatedStock} (Shop ${newShop} + Frozen ${newFrozen} + Waste ${newWasteVal}). Adjust the values so they sum to ${originalStock}.`
                              );
                              return;
                            }
                          } else {
                            updatedStock = (editFormData.shopStock || 0) + (editFormData.freezerStock || 0);
                          }

                          const { lastPurchaseStatus, ...dataToSave } = editFormData;
                          const finalData = selectedProduct.itemType === 'product'
                            ? { ...dataToSave, stock: originalStock, wasteQuantity: newWaste }
                            : { ...dataToSave, stock: updatedStock };

                          await updateDoc(doc(db, selectedProduct.itemType === 'material' ? 'rawMaterials' : 'products', selectedProduct.id), finalData);

                          // Log movements and activities if changed
                          if (currentUserProfile) {
                            // Handle waste changes (for both products and raw materials)
                            if (newWaste !== oldWaste) {
                              const wasteDiff = newWaste - oldWaste;
                              const movementType = wasteDiff > 0 ? 'waste' : 'waste_recovery';

                              await addDoc(collection(db, 'stockMovements'), {
                                itemId: selectedProduct.id,
                                itemName: selectedProduct.name,
                                itemType: selectedProduct.itemType === 'material' ? 'material' : 'product',
                                type: wasteDiff > 0 ? 'out' : 'in',
                                quantity: Math.abs(wasteDiff),
                                previousStock: oldWaste,
                                newStock: newWaste,
                                location: 'none',
                                reason: movementType,
                                userId: currentUserProfile.id,
                                userName: currentUserProfile.name,
                                timestamp: Timestamp.now()
                              });
                            }

                            // For products, handle stock distribution changes
                            const prevTotalStock = (selectedProduct.shopStock || 0) + (selectedProduct.freezerStock || 0) + (selectedProduct.wasteQuantity || 0);
                            if (selectedProduct.itemType !== 'material') {
                              if (updatedStock < prevTotalStock) {
                                const autoWaste = prevTotalStock - updatedStock;
                                await addDoc(collection(db, 'stockMovements'), {
                                  itemId: selectedProduct.id,
                                  itemName: selectedProduct.name,
                                  itemType: 'product',
                                  type: 'out',
                                  quantity: autoWaste,
                                  previousStock: prevTotalStock,
                                  newStock: updatedStock,
                                  location: 'none',
                                  reason: 'waste',
                                  userId: currentUserProfile.id,
                                  userName: currentUserProfile.name,
                                  timestamp: Timestamp.now()
                                });
                              }
                              if (editFormData.shopStock !== selectedProduct.shopStock) {
                                const prevStock = selectedProduct.shopStock || 0;
                                const newStock = editFormData.shopStock || 0;
                                const diff = newStock - prevStock;
                                await addDoc(collection(db, 'stockMovements'), {
                                  itemId: selectedProduct.id,
                                  itemName: selectedProduct.name,
                                  itemType: 'product',
                                  type: diff > 0 ? 'in' : 'out',
                                  quantity: Math.abs(diff),
                                  previousStock: prevStock,
                                  newStock: newStock,
                                  location: 'shop',
                                  reason: 'manual_adjustment',
                                  userId: currentUserProfile.id,
                                  userName: currentUserProfile.name,
                                  timestamp: Timestamp.now()
                                });
                              }
                              if (editFormData.freezerStock !== selectedProduct.freezerStock) {
                                const prevStock = selectedProduct.freezerStock || 0;
                                const newStock = editFormData.freezerStock || 0;
                                const diff = newStock - prevStock;
                                await addDoc(collection(db, 'stockMovements'), {
                                  itemId: selectedProduct.id,
                                  itemName: selectedProduct.name,
                                  itemType: 'product',
                                  type: diff > 0 ? 'in' : 'out',
                                  quantity: Math.abs(diff),
                                  previousStock: prevStock,
                                  newStock: newStock,
                                  location: 'freezer',
                                  reason: 'manual_adjustment',
                                  userId: currentUserProfile.id,
                                  userName: currentUserProfile.name,
                                  timestamp: Timestamp.now()
                                });
                              }
                            }
                          }

                          // Sync to raw materials if category is 'raw_material'
                          if (editFormData.category === 'raw_material') {
                            await setDoc(doc(db, 'rawMaterials', selectedProduct.id), {
                              name: editFormData.name,
                              category: 'raw_material',
                              currentStock: updatedStock,
                              minStock: editFormData.minStock,
                              imageUrl: editFormData.imageUrl || '',
                              updatedAt: new Date().toISOString()
                            }, { merge: true });
                          }

                          toast.success(t('productUpdatedSuccessfully') || 'Product updated successfully');
                          setIsEditingDetails(false);
                          setSelectedProduct({...selectedProduct, ...finalData});
                        } catch (error) {
                          console.error('Error updating product:', error);
                          toast.error(t('errorUpdatingProduct') || 'Error updating product');
                        }
                      }}
                      className="flex-1 btn-primary justify-center gap-2 dark:bg-primary-600 dark:hover:bg-primary-700"
                    >
                      <RefreshCcw className="w-4 h-4" />
                      {t('save')}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={async () => {
                        const formData: any = {
                          name: selectedProduct.name,
                          stock: selectedProduct.itemType === 'material' ? (selectedProduct as any).currentStock : selectedProduct.stock,
                          shopStock: selectedProduct.shopStock || 0,
                          freezerStock: selectedProduct.freezerStock || 0,
                          wasteQuantity: selectedProduct.wasteQuantity || 0,
                          status: selectedProduct.status,
                          category: selectedProduct.category,
                          sellingPrice: selectedProduct.sellingPrice,
                          shelfLife: selectedProduct.shelfLife,
                          minStock: selectedProduct.minStock,
                          imageUrl: selectedProduct.imageUrl || '',
                          ingredients: selectedProduct.ingredients || [],
                          packItems: selectedProduct.packItems || []
                        };

                        // For raw materials, fetch last purchase status
                        if (selectedProduct.itemType === 'material') {
                          const lastPurchase = await getLastPurchaseForMaterial(selectedProduct.id);
                          formData.lastPurchaseStatus = lastPurchase.status;
                        }

                        setEditFormData(formData);
                        setIsEditingDetails(true);
                      }}
                      className="flex-1 btn-secondary justify-center gap-2 dark:bg-zinc-800 dark:border-white/10 dark:text-slate-300"
                    >
                      <Edit className="w-4 h-4" />
                      {t('edit')}
                    </button>
                    <button 
                      onClick={() => {
                        // Logic to mark as frozen
                        updateDoc(doc(db, 'products', selectedProduct.id), { status: 'frozen' });
                        setIsDetailsModalOpen(false);
                      }}
                      className="flex-1 btn-primary justify-center gap-2 dark:bg-primary-600 dark:hover:bg-primary-700"
                    >
                      <Droplets className="w-4 h-4" />
                      {t('frozen')}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {isAdjustmentModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-md shadow-2xl border-slate-100 dark:border-white/10 bg-white dark:bg-zinc-900 border-none shadow-primary-600/10">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
              {t('adjustStock') || 'Adjust Stock'} {adjustmentData.itemName ? `- ${adjustmentData.itemName}` : ''}
            </h2>
            <form onSubmit={handleAdjustStock} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                {!adjustmentData.itemId && (
                  <>
                    <div className="col-span-2">
                      <label className="block text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-2">{t('itemType')}</label>
                      <div className="flex gap-2 p-1 bg-slate-100 dark:bg-zinc-800 rounded-xl">
                        <button 
                          type="button"
                          onClick={() => setAdjustmentData({...adjustmentData, itemType: 'product', itemId: '', itemName: '', type: 'out'})}
                          className={clsx(
                            "flex-1 py-1 px-3 rounded-lg text-xs font-bold transition-all",
                            adjustmentData.itemType === 'product' ? "bg-white dark:bg-primary-600 text-primary-600 dark:text-white shadow-sm" : "text-slate-400"
                          )}
                        >
                          {t('product')}
                        </button>
                        <button 
                          type="button"
                          onClick={() => setAdjustmentData({...adjustmentData, itemType: 'material', itemId: '', itemName: ''})}
                          className={clsx(
                            "flex-1 py-1 px-3 rounded-lg text-xs font-bold transition-all",
                            adjustmentData.itemType === 'material' ? "bg-white dark:bg-primary-600 text-primary-600 dark:text-white shadow-sm" : "text-slate-400"
                          )}
                        >
                          {t('rawMaterial')}
                        </button>
                      </div>
                    </div>

                    <div className="col-span-2">
                      <label className="block text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-2">{t('item')}</label>
                      <select 
                        required
                        className="input w-full bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                        value={adjustmentData.itemId}
                        onChange={(e) => {
                          const id = e.target.value;
                          const name = adjustmentData.itemType === 'product' 
                            ? products.find(p => p.id === id)?.name 
                            : materials.find(m => m.id === id)?.name;
                          setAdjustmentData({...adjustmentData, itemId: id, itemName: name || ''});
                        }}
                      >
                        <option value="">{t('selectItem') || 'Select Item'}</option>
                        {adjustmentData.itemType === 'product' 
                          ? products.filter(p => !p.disabled).sort((a, b) => a.name.localeCompare(b.name)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)
                          : materials.filter(m => !m.disabled).sort((a, b) => a.name.localeCompare(b.name)).map(m => <option key={m.id} value={m.id}>{m.name}</option>)
                        }
                      </select>
                    </div>
                  </>
                )}

                {adjustmentData.itemType === 'product' ? (
                  <>
                    <div className="col-span-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-xs text-amber-700 dark:text-amber-400">
                      {t('productMoveInfo') || 'Moves stock between locations. Total stock never changes — only Production can create new stock.'}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-2">{t('from') || 'From'}</label>
                      <select 
                        required
                        className="input w-full bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                        value={adjustmentData.location}
                        onChange={(e) => setAdjustmentData({...adjustmentData, location: e.target.value as any})}
                      >
                        <option value="shop">{t('shop') || 'Shop'}</option>
                        <option value="freezer">{t('freezer') || 'Freezer'}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-2">{t('to') || 'To'}</label>
                      <select 
                        required
                        className="input w-full bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                        value={adjustmentData.toLocation}
                        onChange={(e) => setAdjustmentData({...adjustmentData, toLocation: e.target.value as any})}
                      >
                        {adjustmentData.location !== 'shop' && <option value="shop">{t('shop') || 'Shop'}</option>}
                        {adjustmentData.location !== 'freezer' && <option value="freezer">{t('freezer') || 'Freezer'}</option>}
                        <option value="waste">{t('waste') || 'Waste'}</option>
                      </select>
                    </div>
                  </>
                ) : (
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-2">{t('type')}</label>
                    <div className="flex gap-2 p-1 bg-slate-100 dark:bg-zinc-800 rounded-xl">
                      <button 
                        type="button"
                        onClick={() => setAdjustmentData({...adjustmentData, type: 'in'})}
                        className={clsx(
                          "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all",
                          adjustmentData.type === 'in' ? "bg-white dark:bg-emerald-600 text-emerald-600 dark:text-white shadow-sm" : "text-slate-400 dark:text-slate-500"
                        )}
                      >
                        <ArrowUpRight className="w-4 h-4" />
                        {t('in') || 'In'}
                      </button>
                      <button 
                        type="button"
                        onClick={() => setAdjustmentData({...adjustmentData, type: 'out'})}
                        className={clsx(
                          "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all",
                          adjustmentData.type === 'out' ? "bg-white dark:bg-red-600 text-red-600 dark:text-white shadow-sm" : "text-slate-400 dark:text-slate-500"
                        )}
                      >
                        <ArrowDownRight className="w-4 h-4" />
                        {t('out') || 'Out'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-2">{t('quantity')}</label>
                  <input 
                    type="number" 
                    step="0.001"
                    className="input w-full bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white" 
                    placeholder="0.00" 
                    required
                    value={adjustmentData.quantity || ''}
                    onChange={(e) => setAdjustmentData({...adjustmentData, quantity: Number(e.target.value)})}
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-2">{t('reason')}</label>
                  <select 
                    className="input w-full bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                    value={adjustmentData.reason}
                    onChange={(e) => setAdjustmentData({...adjustmentData, reason: e.target.value})}
                  >
                    <option value="manual_adjustment">{t('manual_adjustment') || 'Manual Adjustment'}</option>
                    <option value="waste">{t('waste') || 'Waste / Loss'}</option>
                    <option value="correction">{t('correction') || 'Inventory Correction'}</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsAdjustmentModalOpen(false)} className="flex-1 btn-secondary justify-center dark:bg-zinc-800 dark:border-white/10 dark:text-slate-300">{t('cancel')}</button>
                <button type="submit" className="flex-1 btn-primary justify-center dark:bg-primary-600 dark:hover:bg-primary-700">{t('confirm')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isPurchaseModalOpen && selectedMaterialForPurchase && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-2xl shadow-2xl p-8 border-slate-100 dark:border-white/10 bg-white dark:bg-zinc-900">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('purchase') || 'Purchase'} - {selectedMaterialForPurchase.name}</h2>
              <button
                onClick={() => setIsPurchaseModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>

            <form onSubmit={handlePurchaseSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-2">{t('supplier')} <span className="text-red-600">*</span></label>
                  <select
                    required
                    value={purchaseFormData.supplierId}
                    onChange={(e) => setPurchaseFormData({...purchaseFormData, supplierId: e.target.value})}
                    className="input w-full"
                  >
                    <option value="">{t('selectSupplier')}</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-2">{t('quantity')} <span className="text-red-600">*</span></label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={purchaseFormData.quantity}
                      onChange={(e) => setPurchaseFormData({...purchaseFormData, quantity: Number(e.target.value)})}
                      className="input flex-1"
                    />
                    <span className="flex items-center px-3 bg-slate-100 dark:bg-zinc-800 rounded-lg text-sm font-bold text-slate-500">{selectedMaterialForPurchase.unit}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-2">{t('price')} <span className="text-red-600">*</span></label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={purchaseFormData.price}
                    onChange={(e) => setPurchaseFormData({...purchaseFormData, price: Number(e.target.value)})}
                    className="input w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-2">{t('brand')}</label>
                  <input
                    type="text"
                    value={purchaseFormData.brand}
                    onChange={(e) => setPurchaseFormData({...purchaseFormData, brand: e.target.value})}
                    className="input w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-2">{t('purchaseDate')} <span className="text-red-600">*</span></label>
                  <input
                    type="date"
                    required
                    value={purchaseFormData.purchaseDate}
                    onChange={(e) => setPurchaseFormData({...purchaseFormData, purchaseDate: e.target.value})}
                    className="input w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-2">{t('expiryDate')}</label>
                  <input
                    type="date"
                    value={purchaseFormData.expiryDate}
                    onChange={(e) => setPurchaseFormData({...purchaseFormData, expiryDate: e.target.value})}
                    className="input w-full"
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setIsPurchaseModalOpen(false)}
                  className="flex-1 btn-secondary justify-center dark:bg-zinc-800 dark:border-white/10 dark:text-slate-300"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 btn-primary justify-center dark:bg-primary-600 dark:hover:bg-primary-700"
                >
                  {t('purchase')} & {t('sync')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isInventoryModalOpen && selectedItemForInventory && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-md shadow-2xl p-8 border-slate-100 dark:border-white/10 bg-white dark:bg-zinc-900">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {t('inventory')} – {selectedItemForInventory.name}
                </h2>
                {!('currentStock' in selectedItemForInventory) && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <span>🏭</span>
                    {lastBatch ? (
                      <span>
                        <span className="font-semibold text-slate-700 dark:text-slate-200">Production Batch — {lastBatch.location || 'shop'}</span>
                        <span className="mx-1">·</span>
                        {(() => { const d = lastBatch.endDate || lastBatch.startDate; return d ? `${new Date(Number(d) || d).toLocaleDateString()} ${new Date(Number(d) || d).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}` : ''; })()}
                        {lastBatch.createdBy ? ` · ${lastBatch.createdBy}` : ''}
                      </span>
                    ) : (
                      <span className="italic text-slate-400 dark:text-slate-500">No production batch recorded</span>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => setIsInventoryModalOpen(false)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors shrink-0 ml-4"
              >
                <Plus className="w-6 h-6 rotate-45 text-slate-400" />
              </button>
            </div>

            <div className="space-y-6">
              {!('currentStock' in selectedItemForInventory) && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-2 flex items-center gap-1">
                      <Store className="w-3 h-3" /> {t('shopStock')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="input w-full"
                      value={inventoryFormData.shopStock}
                      onChange={(e) => {
                        const waste = inventoryFormData.wasteQuantity;
                        const originalStock = (selectedItemForInventory as any).stock || 0;
                        const maxShop = Math.max(0, originalStock - waste);
                        const typed = Math.max(0, Number(e.target.value));
                        const newShop = Math.min(typed, maxShop);
                        setInventoryStockWarning(typed > maxShop);
                        setInventoryFormData({...inventoryFormData, shopStock: newShop, freezerStock: Math.max(0, maxShop - newShop)});
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-2 flex items-center gap-1">
                      <Snowflake className="w-3 h-3" /> {t('freezerStock')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="input w-full"
                      value={inventoryFormData.freezerStock}
                      onChange={(e) => {
                        const waste = inventoryFormData.wasteQuantity;
                        const originalStock = (selectedItemForInventory as any).stock || 0;
                        const maxFrozen = Math.max(0, originalStock - waste);
                        const typed = Math.max(0, Number(e.target.value));
                        const newFrozen = Math.min(typed, maxFrozen);
                        setInventoryStockWarning(typed > maxFrozen);
                        setInventoryFormData({...inventoryFormData, freezerStock: newFrozen, shopStock: Math.max(0, maxFrozen - newFrozen)});
                      }}
                    />
                  </div>
                </>
              )}

              {'currentStock' in selectedItemForInventory && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-2">
                    {t('currentStock') || 'Current Stock'}
                  </label>
                  <div className="p-3 bg-slate-50 dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-white/10">
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                      {inventoryFormData.currentStock} {selectedItemForInventory.unit}
                    </p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-2 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-red-500" /> {t('wasteQuantity') || 'Waste'}
                </label>
                <input
                  type="number"
                  min="0"
                  className="input w-full"
                  value={inventoryFormData.wasteQuantity}
                  onChange={(e) => {
                    const newWaste = Math.max(0, Number(e.target.value));
                    const wasteDifference = newWaste - inventoryFormData.wasteQuantity;
                    const isMaterial = 'currentStock' in selectedItemForInventory;

                    if (isMaterial) {
                      let newCurrentStock = inventoryFormData.currentStock;
                      if (wasteDifference > 0) {
                        newCurrentStock = Math.max(0, newCurrentStock - wasteDifference);
                      } else if (wasteDifference < 0) {
                        newCurrentStock += Math.abs(wasteDifference);
                      }
                      setInventoryFormData({
                        ...inventoryFormData,
                        wasteQuantity: newWaste,
                        currentStock: newCurrentStock
                      });
                    } else {
                      let newShopStock = inventoryFormData.shopStock;
                      let newFrozenStock = inventoryFormData.freezerStock;
                      if (wasteDifference > 0) {
                        if (newShopStock >= wasteDifference) {
                          newShopStock -= wasteDifference;
                        } else {
                          const remaining = wasteDifference - newShopStock;
                          newShopStock = 0;
                          newFrozenStock = Math.max(0, newFrozenStock - remaining);
                        }
                      } else if (wasteDifference < 0) {
                        newShopStock += Math.abs(wasteDifference);
                      }
                      setInventoryFormData({
                        ...inventoryFormData,
                        wasteQuantity: newWaste,
                        shopStock: newShopStock,
                        freezerStock: newFrozenStock
                      });
                    }
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-2">
                  {t('totalStock')}
                </label>
                <div className="p-3 bg-slate-50 dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-white/10">
                  <p className="text-lg font-bold text-slate-900 dark:text-white">
                    {'currentStock' in selectedItemForInventory
                      ? (inventoryFormData.currentStock + inventoryFormData.wasteQuantity)
                      : (inventoryFormData.shopStock + inventoryFormData.freezerStock + inventoryFormData.wasteQuantity)} {selectedItemForInventory.unit}
                  </p>
                </div>
                {inventoryStockWarning && !('currentStock' in selectedItemForInventory) && (
                  <p className="mt-2 text-xs text-red-500 dark:text-red-400">
                    Cannot exceed total of <strong>{(selectedItemForInventory as any).stock || 0} {selectedItemForInventory.unit}</strong> — value was capped. Redistribute between shop and freezer only.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-2">
                  {t('totalCost')}
                </label>
                <div className="p-3 bg-slate-50 dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-white/10">
                  <p className="text-lg font-bold text-slate-900 dark:text-white">
                    {(
                      ((selectedItemForInventory as any).costPrice || 0) *
                      ('currentStock' in selectedItemForInventory
                        ? (inventoryFormData.currentStock + inventoryFormData.wasteQuantity)
                        : (inventoryFormData.shopStock + inventoryFormData.freezerStock + inventoryFormData.wasteQuantity))
                    ).toFixed(2)} {CURRENCY}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-6 border-t border-slate-100 dark:border-white/10">
                <button
                  onClick={() => setIsInventoryModalOpen(false)}
                  className="flex-1 btn-secondary justify-center dark:bg-zinc-800 dark:border-white/10 dark:text-slate-300"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={async () => {
                    try {
                      const itemId = selectedItemForInventory.id;
                      const isMaterial = 'currentStock' in selectedItemForInventory;
                      const token = localStorage.getItem('bakery_token');
                      const wasteChange = inventoryFormData.wasteQuantity - ((selectedItemForInventory as any).wasteQuantity || 0);

                      const endpoint = isMaterial ? `/api/db/rawMaterials/${itemId}` : `/api/db/products/${itemId}`;
                      const computedStock = inventoryFormData.shopStock + inventoryFormData.freezerStock + inventoryFormData.wasteQuantity;
                      const originalStockAtSave = (selectedItemForInventory as any).stock || 0;
                      if (!isMaterial && Math.abs(computedStock - originalStockAtSave) > 0.001) {
                        toast.error(`Total must stay at ${originalStockAtSave}. Current: ${computedStock} (Shop ${inventoryFormData.shopStock} + Frozen ${inventoryFormData.freezerStock} + Waste ${inventoryFormData.wasteQuantity}). Cannot save.`);
                        return;
                      }
                      const updateData = isMaterial
                        ? {
                            currentStock: inventoryFormData.currentStock,
                            wasteQuantity: inventoryFormData.wasteQuantity
                          }
                        : {
                            shopStock: inventoryFormData.shopStock,
                            freezerStock: inventoryFormData.freezerStock,
                            wasteQuantity: inventoryFormData.wasteQuantity,
                            stock: computedStock
                          };

                      const response = await authFetch(endpoint, {
                        method: 'PUT',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${token}`
                        },
                        body: JSON.stringify(updateData)
                      });

                      if (!response.ok) {
                        throw new Error('Failed to update inventory');
                      }

                      if (wasteChange !== 0) {
                        await addDoc(collection(db, 'stockMovements'), {
                          itemId: itemId,
                          itemName: selectedItemForInventory.name,
                          itemType: isMaterial ? 'rawMaterial' : 'product',
                          type: 'out',
                          quantity: Math.abs(wasteChange),
                          previousStock: isMaterial ? (selectedItemForInventory as any).currentStock : ((selectedItemForInventory as any).shopStock + (selectedItemForInventory as any).freezerStock),
                          newStock: isMaterial ? inventoryFormData.currentStock : (inventoryFormData.shopStock + inventoryFormData.freezerStock),
                          location: 'shop',
                          reason: 'waste',
                          referenceId: null,
                          userId: currentUserProfile?.id || '',
                          userName: currentUserProfile?.name || '',
                          timestamp: new Date()
                        });
                      }

                      toast.success(t('updatedSuccessfully') || 'Updated successfully');
                      setIsInventoryModalOpen(false);
                    } catch (error) {
                      console.error('Error updating inventory:', error);
                      toast.error(t('errorUpdating') || 'Error updating');
                    }
                  }}
                  className="flex-1 btn-primary justify-center dark:bg-primary-600 dark:hover:bg-primary-700"
                >
                  {t('save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
