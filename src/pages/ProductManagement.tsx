import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { db, collection, onSnapshot, query, orderBy, addDoc, updateDoc, doc, deleteDoc, setDoc, handleFirestoreError, OperationType, limit, getCountFromServer, getDoc } from '../lib/firebase-compat';
import { Product, RawMaterial, RecipeIngredient, ProductionBatch, Order, Promotion } from '../types';
import { Plus, Search, Edit2, Trash2, Package, Info, List, Image as ImageIcon, Percent, Scale, Hash, Filter, RotateCcw, ChevronRight, X } from 'lucide-react';
import { logActivity } from '../lib/logger';
import { useAuth } from '../contexts/AuthContext';
import { clsx } from 'clsx';
import { compressImage } from '../lib/utils';
import { PAGE_SIZE } from '../constants';
import { toast } from 'react-hot-toast';
import Pagination from '../components/Pagination';
import { ItemCategoryConfig, getDefaultItemCategoryConfig, sanitizeItemCategoryConfig } from '../lib/itemCategories';
import { getActiveProductPromotion, getEffectiveSellingPrice } from '../lib/promotionPricing';

const ProductManagement: React.FC = () => {
  const { t, tProduct, tCategory, isRTL, currencyUnit } = useLanguage();
  const { profile: currentUserProfile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<RawMaterial | null>(null);
  const [materialFormData, setMaterialFormData] = useState<Partial<RawMaterial>>({
    name: '',
    brand: '',
    category: 'Flour',
    unit: 'kg',
    currentStock: 0,
    minStock: 10,
    imageUrl: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState<'All' | 'Regular' | 'Pack' | 'RawMaterial'>('All');
  const [itemCategoryConfig, setItemCategoryConfig] = useState<ItemCategoryConfig>(getDefaultItemCategoryConfig());
  const kitchenCategorySet = useMemo(() => new Set(itemCategoryConfig.rawMaterial), [itemCategoryConfig.rawMaterial]);
  const [selectedProductForDetails, setSelectedProductForDetails] = useState<Product | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'products' | 'materials'>('products');
  const [showDisabled, setShowDisabled] = useState(false);

  const [productsPage, setProductsPage] = useState(1);
  const [materialsPage, setMaterialsPage] = useState(1);
  const [totalProductsPages, setTotalProductsPages] = useState(1);
  const [totalMaterialsPages, setTotalMaterialsPages] = useState(1);


  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    nameAr: '',
    category: '',
    sellingPrice: 0,
    costPrice: 0,
    shelfLife: 24,
    unit: 'g',
    imageUrl: '',
    description: '',
    specifications: '',
    ingredients: [],
    isPack: false,
    packItems: [],
    stock: 0,
    minStock: 10,
    itemType: 'product'
  });

  const buildRawMaterialPayload = (data: any) => ({
    name: data.name || '',
    category: data.category || 'cooking',
    unit: data.unit || 'kg',
    imageUrl: data.imageUrl || '',
    brand: data.brand || null,
    expiryDate: data.expiryDate || null,
    minStock: Number(data.minStock || 0),
    status: data.status || 'none',
    disabled: !!data.disabled
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        toast.error(t('imageTooLarge') || 'Image is too large (max 5MB)');
        return;
      }
      try {
        // Compress image to ensure it stays under Firestore 1MB limit
        const base64 = await compressImage(file, 800, 800, 0.6);
        setFormData({ ...formData, imageUrl: base64 });
      } catch (error) {
        console.error("Error uploading image:", error);
        toast.error(t('errorUploadingImage') || 'Error uploading image');
      }
    }
  };

  useEffect(() => {
    const fetchCounts = async () => {
      const productsSnapshot = await getCountFromServer(collection(db, 'products'));
      const materialsSnapshot = await getCountFromServer(collection(db, 'rawMaterials'));
      setTotalProductsPages(Math.ceil(productsSnapshot.data().count / PAGE_SIZE));
      setTotalMaterialsPages(Math.ceil(materialsSnapshot.data().count / PAGE_SIZE));
    };
    fetchCounts();

    const pq = query(
      collection(db, 'products'), 
      orderBy('name'), 
      limit(PAGE_SIZE * productsPage)
    );
    const unsubscribeProducts = onSnapshot(pq, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'products'));

    const mq = query(
      collection(db, 'rawMaterials'), 
      orderBy('name'), 
      limit(PAGE_SIZE * materialsPage)
    );
    const unsubscribeMaterials = onSnapshot(mq, (snapshot) => {
      const rows = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RawMaterial));
      setMaterials(rows.filter((m) => kitchenCategorySet.has((m.category || '').toLowerCase())));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'rawMaterials'));

    const unsubscribePromotions = onSnapshot(collection(db, 'promotions'), (snapshot) => {
      setPromotions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Promotion)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'promotions'));

    let bUnsubscribe = () => {};
    let oUnsubscribe = () => {};
    let itemCategoriesUnsubscribe = () => {};

    if (currentUserProfile) {
      const bq = query(collection(db, 'batches'));
      bUnsubscribe = onSnapshot(bq, (snapshot) => {
        setBatches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductionBatch)));
      }, (error) => handleFirestoreError(error, OperationType.GET, 'batches'));

      const oq = query(collection(db, 'orders'));
      oUnsubscribe = onSnapshot(oq, (snapshot) => {
        setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
      }, (error) => handleFirestoreError(error, OperationType.GET, 'orders'));

      itemCategoriesUnsubscribe = onSnapshot(doc(db, 'settings', 'item_categories'), (snapshot) => {
        if (snapshot.exists()) {
          setItemCategoryConfig(sanitizeItemCategoryConfig(snapshot.data()));
        }
      }, (error) => handleFirestoreError(error, OperationType.GET, 'settings/item_categories'));
    }

    return () => {
      unsubscribeProducts();
      unsubscribeMaterials();
      unsubscribePromotions();
      bUnsubscribe();
      oUnsubscribe();
      itemCategoriesUnsubscribe();
    };
  }, [currentUserProfile, PAGE_SIZE, productsPage, materialsPage, kitchenCategorySet]);

  const isProductDeletable = (productId: string) => {
    const activeBatches = batches.filter(b => 
      b.productId === productId && 
      !['Terminated', 'Cancelled'].includes(b.status)
    );
    
    const activeOrders = orders.filter(o => 
      o.items.some(item => item.productId === productId) && 
      !['Delivered', 'Cancelled'].includes(o.status)
    );

    const usedInPacks = products.some(p => 
      p.isPack && p.packItems?.some(item => item.productId === productId)
    );

    return activeBatches.length === 0 && activeOrders.length === 0 && !usedInPacks;
  };

  const handleDelete = async (item: Product | RawMaterial) => {
    const isProduct = 'sellingPrice' in item;
    const collectionName = isProduct ? 'products' : 'rawMaterials';

    if (isProduct && !isProductDeletable(item.id)) {
      toast.error(t('cannotDeleteProductInUse'));
      return;
    }

    if (window.confirm(t('confirmDelete'))) {
      try {
        // Soft delete: set disabled to true
        await updateDoc(doc(db, collectionName, item.id), { disabled: true });
        
        // If it's a product, also check if it has a synced raw material
        if (isProduct) {
          try {
            await updateDoc(doc(db, 'rawMaterials', item.id), { disabled: true });
          } catch (e) {
            // Ignore if raw material doesn't exist
          }
        }
        
        if (currentUserProfile) {
          await logActivity(
            currentUserProfile.id,
            currentUserProfile.name,
            isProduct ? 'product_disabled' : 'material_disabled',
            `Disabled ${isProduct ? 'product' : 'material'}: ${item.name}`
          );
        }
        toast.success(t('itemDisabled') || 'Item disabled successfully');
      } catch (error) {
        console.error("Error disabling item:", error);
        toast.error(t('errorDisablingItem') || 'Error disabling item');
      }
    }
  };

  const handleRestore = async (item: Product | RawMaterial) => {
    const isProduct = 'sellingPrice' in item;
    const collectionName = isProduct ? 'products' : 'rawMaterials';

    try {
      await updateDoc(doc(db, collectionName, item.id), { disabled: false });
      
      if (isProduct) {
        try {
          await updateDoc(doc(db, 'rawMaterials', item.id), { disabled: false });
        } catch (e) {}
      }

      if (currentUserProfile) {
        await logActivity(
          currentUserProfile.id,
          currentUserProfile.name,
          isProduct ? 'product_restored' : 'material_restored',
          `Restored ${isProduct ? 'product' : 'material'}: ${item.name}`
        );
      }
      toast.success(t('itemRestored') || 'Item restored successfully');
    } catch (error) {
      console.error("Error restoring item:", error);
      toast.error(t('errorRestoringItem') || 'Error restoring item');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check for unique name (case-insensitive and trimmed)
    const normalizedNewName = formData.name?.trim().toLowerCase().replace(/\s+/g, ' ');
    const nameExists = (activeTab === 'products' ? products : materials).some(p => 
      p.name.trim().toLowerCase().replace(/\s+/g, ' ') === normalizedNewName && 
      p.id !== (editingProduct?.id || editingMaterial?.id)
    );

    if (nameExists) {
      toast.error(t('itemNameExists') || 'Item name already exists');
      return;
    }

    try {
      const isMaterial = activeTab === 'materials' || formData.itemType === 'material' || formData.category === 'raw_material';
      const collectionName = isMaterial ? 'rawMaterials' : 'products';
      const currentEditingId = editingProduct?.id || editingMaterial?.id;

      if (currentEditingId) {
        const dataToSave = isMaterial
          ? buildRawMaterialPayload(formData)
          : formData;
        await setDoc(doc(db, collectionName, currentEditingId), dataToSave, { merge: true });
        
        // If it's a material that is ALSO used as a product, sync them
        if (isMaterial) {
          try {
            // Check if it exists in products too (some items are both)
            const prodSnap = await getDoc(doc(db, 'products', currentEditingId));
            if (prodSnap.exists()) {
              await setDoc(doc(db, 'products', currentEditingId), {
                name: formData.name,
                nameAr: formData.nameAr,
                category: formData.category,
                unit: formData.unit,
                imageUrl: formData.imageUrl,
                minStock: formData.minStock
              }, { merge: true });
            }
          } catch (e) {}
        }

        if (currentUserProfile) {
          await logActivity(
            currentUserProfile.id,
            currentUserProfile.name,
            isMaterial ? 'material_updated' : 'product_updated',
            `Updated ${isMaterial ? 'material' : 'product'}: ${formData.name}`
          );
        }
      } else {
        const dataToCreate = isMaterial
          ? buildRawMaterialPayload(formData)
          : formData;

        const itemRef = await addDoc(collection(db, collectionName), {
          ...dataToCreate,
          createdAt: new Date().toISOString()
        });

        if (currentUserProfile) {
          await logActivity(
            currentUserProfile.id,
            currentUserProfile.name,
            isMaterial ? 'material_added' : 'product_added',
            `Added new ${isMaterial ? 'material' : 'product'}: ${formData.name}`
          );
        }
      }
      setIsModalOpen(false);
      setEditingProduct(null);
      setEditingMaterial(null);
      setFormData({
        name: '',
        nameAr: '',
        category: '',
        sellingPrice: 0,
        costPrice: 0,
        shelfLife: 24,
        unit: 'g',
        imageUrl: '',
        description: '',
        specifications: '',
        ingredients: [],
        isPack: false,
        packItems: [],
        stock: 0,
        minStock: 10,
        itemType: activeTab === 'products' ? 'product' : 'material'
      });
    } catch (error) {
      console.error("Error saving item:", error);
      toast.error(t('errorSavingItem') || 'Error saving item');
    }
  };

  const addIngredient = () => {
    setFormData({
      ...formData,
      ingredients: [...(formData.ingredients || []), { materialId: '', quantity: 0, type: 'weight' }]
    });
  };

  const updateIngredient = (index: number, field: string, value: any) => {
    const newIngredients = [...(formData.ingredients || [])];
    newIngredients[index] = { ...newIngredients[index], [field]: value };
    setFormData({ ...formData, ingredients: newIngredients });
  };

  const removeIngredient = (index: number) => {
    const newIngredients = [...(formData.ingredients || [])];
    newIngredients.splice(index, 1);
    setFormData({ ...formData, ingredients: newIngredients });
  };

  const addPackItem = () => {
    setFormData({
      ...formData,
      packItems: [...(formData.packItems || []), { productId: '', quantity: 1 }]
    });
  };

  const updatePackItem = (index: number, field: string, value: any) => {
    const newPackItems = [...(formData.packItems || [])];
    newPackItems[index] = { ...newPackItems[index], [field]: value };
    setFormData({ ...formData, packItems: newPackItems });
  };

  const removePackItem = (index: number) => {
    const newPackItems = [...(formData.packItems || [])];
    newPackItems.splice(index, 1);
    setFormData({ ...formData, packItems: newPackItems });
  };

  const filteredItems = useMemo(() => {
    if (activeTab === 'products') {
      return products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             p.category.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = categoryFilter === 'All' || p.category === categoryFilter;
        const matchesType = typeFilter === 'All' || 
                           (typeFilter === 'Pack' && p.isPack) ||
                           (typeFilter === 'Regular' && !p.isPack && p.itemType !== 'material');
        const matchesDisabled = showDisabled ? p.disabled === true : !p.disabled;
        
        // Ensure raw materials don't show up in products tab if they are marked as materials
        const isActuallyProduct = p.itemType !== 'material' && p.category !== 'raw_material';
        
        return matchesSearch && matchesCategory && matchesType && matchesDisabled && isActuallyProduct;
      });
    } else {
      return materials.filter(m => {
        const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             m.category.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = categoryFilter === 'All' || m.category === categoryFilter;
        const matchesDisabled = showDisabled ? m.disabled === true : !m.disabled;
        return matchesSearch && matchesCategory && matchesDisabled;
      });
    }
  }, [products, materials, searchTerm, categoryFilter, typeFilter, activeTab, showDisabled]);

  const paginatedItems = useMemo(() => {
    const page = activeTab === 'products' ? productsPage : materialsPage;
    const startIndex = (page - 1) * PAGE_SIZE;
    return filteredItems.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredItems, productsPage, materialsPage, PAGE_SIZE, activeTab]);

  const resetFilters = () => {
    setSearchTerm('');
    setCategoryFilter('All');
    setTypeFilter('All');
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white">{t('productManagement')}</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">{t('productManagementSubtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white dark:bg-[#0a0a0a] p-1 rounded-xl border border-slate-200 dark:border-[#2a1e17] shadow-sm">
            <button 
              onClick={() => setViewMode('card')}
              className={clsx(
                "p-2 rounded-lg transition-all",
                viewMode === 'card' ? "bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400" : "text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400"
              )}
            >
              <Package className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={clsx(
                "p-2 rounded-lg transition-all",
                viewMode === 'list' ? "bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400" : "text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400"
              )}
            >
              <List className="w-5 h-5" />
            </button>
          </div>
          <button 
            onClick={() => {
              setEditingProduct(null);
              setEditingMaterial(null);
              setFormData({
                name: '',
                category: activeTab === 'materials' ? (itemCategoryConfig.rawMaterial[0] || '') : (itemCategoryConfig.product[0] || ''),
                sellingPrice: 0,
                costPrice: 0,
                shelfLife: 24,
                unit: activeTab === 'materials' ? 'kg' : 'g',
                imageUrl: '',
                description: '',
                specifications: '',
                ingredients: [],
                isPack: false,
                packItems: [],
                stock: 0,
                minStock: 10,
                itemType: activeTab === 'materials' ? 'material' : 'product'
              });
              setIsModalOpen(true);
            }}
            className="btn-primary gap-2 w-full sm:w-auto justify-center"
          >
            <Plus className="w-5 h-5" />
            {activeTab === 'materials' ? t('addMaterial') || 'Add Material' : t('addProduct')}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 border-b border-slate-100 dark:border-[#2a1e17] mb-8">
        <button 
          onClick={() => setActiveTab('products')}
          className={clsx(
            "pb-4 px-2 text-sm font-bold transition-all relative",
            activeTab === 'products' ? "text-primary-600 dark:text-primary-400" : "text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400"
          )}
        >
          {t('products')}
          {activeTab === 'products' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 dark:bg-primary-400 rounded-full" />}
        </button>
        <button 
          onClick={() => setActiveTab('materials')}
          className={clsx(
            "pb-4 px-2 text-sm font-bold transition-all relative",
            activeTab === 'materials' ? "text-primary-600 dark:text-primary-400" : "text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400"
          )}
        >
          {t('rawMaterials')}
          {activeTab === 'materials' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 dark:bg-primary-400 rounded-full" />}
        </button>
      </div>

      <div className="card flex flex-col md:flex-row items-center gap-4 py-4 border-slate-100 dark:border-[#2a1e17]">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600 w-5 h-5" />
          <input 
            type="text" 
            placeholder={t('search')} 
            className="input pl-12 bg-slate-50/50 dark:bg-[#0a0a0a]/50 border-none w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {activeTab === 'products' && (
            <div className="flex bg-slate-100 dark:bg-[#0a0a0a] p-1 rounded-xl gap-1">
              {(['All', 'Regular', 'Pack'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={clsx(
                    "px-4 py-1.5 rounded-lg text-sm font-bold transition-all",
                    typeFilter === type 
                      ? "bg-white dark:bg-[#1a1512] text-primary-600 dark:text-primary-400 shadow-sm" 
                      : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  )}
                >
                  {type === 'All' ? t('all') : type === 'Regular' ? t('regular') : t('pack')}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <select 
              className="input bg-slate-50/50 dark:bg-[#0a0a0a]/50 border-none text-sm font-bold min-w-[150px]"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="All">{t('allCategories')}</option>
              {activeTab === 'products' 
                ? itemCategoryConfig.product.map(cat => (
                    <option key={cat} value={cat}>{tCategory(cat)}</option>
                  ))
                : itemCategoryConfig.rawMaterial.map(cat => (
                    <option key={cat} value={cat}>{tCategory(cat)}</option>
                  ))
              }
            </select>
          </div>

          <button 
            onClick={resetFilters}
            className="p-2.5 text-slate-400 dark:text-slate-600 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-xl transition-all"
            title={t('resetFilters')}
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 ml-auto">
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={showDisabled}
                onChange={(e) => setShowDisabled(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{t('showDisabled') || 'Show Disabled'}</span>
            </label>
          </div>
        </div>
      </div>

      {viewMode === 'card' ? (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedItems.map((item) => {
              const isProduct = 'sellingPrice' in item;
              const product = isProduct ? item as Product : null;
              const material = !isProduct ? item as RawMaterial : null;
              const activePromotion = product ? getActiveProductPromotion(product.id, promotions) : null;
              const effectivePrice = product ? getEffectiveSellingPrice(product, promotions) : null;

              return (
                <div key={item.id} className={clsx(
                  "card group hover:border-primary-200 dark:hover:border-primary-900/50 transition-all p-0 overflow-hidden border-slate-100 dark:border-[#2a1e17]",
                  item.disabled && "opacity-60 grayscale-[0.5]"
                )}>
                  <div className="h-48 bg-slate-100 dark:bg-[#0a0a0a] relative">
                    <img 
                      src={item.imageUrl || `https://picsum.photos/seed/${item.name}/400/300`} 
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                    {item.disabled && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest shadow-lg">
                          {t('disabled') || 'Disabled'}
                        </span>
                      </div>
                    )}
                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                      {item.disabled ? (
                        <button 
                          onClick={() => handleRestore(item)}
                          className="p-2 bg-white/90 dark:bg-black/90 backdrop-blur-sm rounded-lg text-slate-600 dark:text-slate-400 hover:text-green-600 dark:hover:text-green-400 shadow-lg"
                          title={t('restore') || 'Restore'}
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      ) : (
                        <>
                          <button 
                            onClick={() => {
                              if (isProduct) {
                                setEditingProduct(product);
                                setEditingMaterial(null);
                                setFormData(product!);
                              } else {
                                setEditingMaterial(material);
                                setEditingProduct(null);
                                setFormData({
                                  ...material,
                                  itemType: 'material'
                                } as any);
                              }
                              setIsModalOpen(true);
                            }}
                            className="p-2 bg-white/90 dark:bg-black/90 backdrop-blur-sm rounded-lg text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 shadow-lg"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(item)}
                            className="p-2 bg-white/90 dark:bg-black/90 backdrop-blur-sm rounded-lg text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 shadow-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                    {isProduct && (
                      <div className="absolute top-4 left-4">
                        <span className={clsx(
                          "px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-sm backdrop-blur-md",
                          product?.isPack 
                            ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30" 
                            : "bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30"
                        )}>
                          {product?.isPack ? t('pack') : t('regular')}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-6">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{tProduct(item)}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{tCategory(item.category)}</p>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                      <div className="p-3 bg-slate-50 dark:bg-[#0a0a0a] rounded-xl">
                        <p className="text-slate-400 dark:text-slate-600 text-xs font-bold uppercase tracking-wider mb-1">
                          {isProduct ? t('price') : t('minStock')}
                        </p>
                        <p className="font-bold text-slate-900 dark:text-white">
                          {isProduct ? (
                            <span className="flex flex-col">
                              {activePromotion && (
                                <span className="text-xs font-medium line-through text-slate-400 dark:text-slate-500">
                                  {product?.sellingPrice} {currencyUnit}
                                </span>
                              )}
                              <span className={clsx(activePromotion && "text-red-600 dark:text-red-400")}>
                                {effectivePrice} {currencyUnit}
                              </span>
                              {activePromotion && (
                                <span className="text-[10px] font-bold text-red-600/90 dark:text-red-400/90 uppercase tracking-wider">
                                  {activePromotion.campaignName}
                                </span>
                              )}
                            </span>
                          ) : `${material?.minStock} ${material?.unit}`}
                        </p>
                      </div>
                      <div className="p-3 bg-slate-50 dark:bg-[#0a0a0a] rounded-xl">
                        <p className="text-slate-400 dark:text-slate-600 text-xs font-bold uppercase tracking-wider mb-1">{t('unit')}</p>
                        <p className="font-bold text-slate-900 dark:text-white">{item.unit || 'g'}</p>
                      </div>
                    </div>

                    {isProduct && (
                      <>
                        <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-600 font-medium mb-3">
                          <List className="w-4 h-4" />
                          <span>
                            {product?.isPack 
                              ? `${product?.packItems?.length || 0} ${t('packItems')}`
                              : `${product?.ingredients?.length || 0} ${t('ingredients')}`
                            }
                          </span>
                        </div>

                        {/* Definition Summary */}
                        <div className="space-y-1">
                          {product?.isPack ? (
                            product?.packItems?.slice(0, 3).map((pItem, idx) => {
                              const packProduct = products.find(p => p.id === pItem.productId);
                              return (
                                <div key={idx} className="flex justify-between text-[10px] text-slate-400 dark:text-slate-600 italic">
                                  <span>• {packProduct ? tProduct(packProduct) : t('product')}</span>
                                  <span>x{pItem.quantity}</span>
                                </div>
                              );
                            })
                          ) : (
                            product?.ingredients?.slice(0, 3).map((ing, idx) => {
                              const mat = materials.find(m => m.id === ing.materialId);
                              return (
                                <div key={idx} className="flex justify-between text-[10px] text-slate-400 dark:text-slate-600 italic">
                                  <span>• {mat ? tProduct(mat) : t('material')}</span>
                                  <span>{ing.quantity} {mat?.unit || 'g'}</span>
                                </div>
                              );
                            })
                          )}
                          {((product?.isPack ? product?.packItems?.length : product?.ingredients?.length) || 0) > 3 && (
                            <p className="text-[10px] text-primary-500 font-bold">+{((product?.isPack ? product?.packItems?.length : product?.ingredients?.length) || 0) - 3} more...</p>
                          )}
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-50 dark:border-[#2a1e17] flex justify-end">
                          <button 
                            onClick={() => {
                              setEditingProduct(product);
                              setFormData(product!);
                              setIsModalOpen(true);
                            }}
                            className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-bold text-xs flex items-center gap-1 group/btn"
                          >
                            {t('edit')}
                            <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <Pagination 
            currentPage={activeTab === 'products' ? productsPage : materialsPage}
            totalPages={activeTab === 'products' ? totalProductsPages : totalMaterialsPages}
            onPageChange={activeTab === 'products' ? setProductsPage : setMaterialsPage}
          />
        </div>
      ) : (
        <div className="space-y-8">
          <div className="card p-0 overflow-hidden border-slate-100 dark:border-[#2a1e17]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-[#0a0a0a] border-b border-slate-100 dark:border-[#2a1e17]">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">{t('name')}</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">{t('type') || 'Type'}</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">{t('category')}</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">{activeTab === 'products' ? t('price') : t('minStock')}</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">{t('unit')}</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#2a1e17]">
                {paginatedItems.map((item) => {
                  const isProduct = 'sellingPrice' in item;
                  const product = isProduct ? item as Product : null;
                  const material = !isProduct ? item as RawMaterial : null;
                  const activePromotion = product ? getActiveProductPromotion(product.id, promotions) : null;
                  const effectivePrice = product ? getEffectiveSellingPrice(product, promotions) : null;

                  return (
                    <tr key={item.id} className={clsx(
                      "hover:bg-slate-50/50 dark:hover:bg-[#0a0a0a]/50 transition-colors",
                      item.disabled && "opacity-60 bg-slate-50/30 dark:bg-slate-900/30"
                    )}>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-white">{tProduct(item)}</span>
                            {item.disabled && (
                              <span className="text-[8px] bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1 py-0.5 rounded uppercase font-bold tracking-wider">
                                {t('disabled') || 'Disabled'}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {isProduct ? (
                          <span className={clsx(
                            "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                            product?.isPack 
                              ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" 
                              : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                          )}>
                            {product?.isPack ? t('pack') : t('regular')}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-900/30 text-slate-600 dark:text-slate-400">
                            {t('material')}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{tCategory(item.category)}</span>
                      </td>
                      <td className="px-6 py-4">
                        {isProduct ? (
                          <div className="flex flex-col">
                            {activePromotion && (
                              <span className="text-xs line-through text-slate-400 dark:text-slate-500">
                                {product?.sellingPrice} {currencyUnit}
                              </span>
                            )}
                            <span className={clsx(
                              "font-bold",
                              activePromotion ? "text-red-600 dark:text-red-400" : "text-primary-600 dark:text-primary-400"
                            )}>
                              {effectivePrice} {currencyUnit}
                            </span>
                            {activePromotion && (
                              <span className="text-[10px] font-bold text-red-600/90 dark:text-red-400/90 uppercase tracking-wider">
                                {activePromotion.campaignName}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="font-bold text-primary-600 dark:text-primary-400">
                            {material?.minStock} {material?.unit}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-slate-700 dark:text-slate-300">{item.unit || 'g'}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {item.disabled ? (
                            <button 
                              onClick={() => handleRestore(item)}
                              className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all"
                              title={t('restore') || 'Restore'}
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          ) : (
                            <>
                              <button 
                                onClick={() => {
                                  if (isProduct) {
                                    setEditingProduct(product);
                                    setEditingMaterial(null);
                                    setFormData({
                                      ...product,
                                      name: product.name || '',
                                      nameAr: product.nameAr || '',
                                      category: product.category || '',
                                      sellingPrice: product.sellingPrice || 0,
                                      costPrice: product.costPrice || 0,
                                      minStock: product.minStock || 0,
                                      unit: product.unit || 'g',
                                      description: product.description || '',
                                      imageUrl: product.imageUrl || '',
                                      itemType: product.itemType || 'product'
                                    });
                                  } else {
                                    setEditingMaterial(material);
                                    setEditingProduct(null);
                                    setFormData({
                                      ...material,
                                      name: material.name || '',
                                      nameAr: material.nameAr || '',
                                      category: material.category || '',
                                      minStock: material.minStock || 0,
                                      unit: material.unit || 'g',
                                      brand: material.brand || 'Generic',
                                      itemType: 'material'
                                    } as any);
                                  }
                                  setIsModalOpen(true);
                                }}
                                className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDelete(item)}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination 
            currentPage={activeTab === 'products' ? productsPage : materialsPage}
            totalPages={activeTab === 'products' ? totalProductsPages : totalMaterialsPages}
            onPageChange={activeTab === 'products' ? setProductsPage : setMaterialsPage}
          />
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100 dark:border-[#2a1e17]">
            <div className="p-8 border-b border-slate-100 dark:border-[#2a1e17] flex items-center justify-between sticky top-0 bg-white dark:bg-[#0a0a0a] z-10">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                {(editingProduct || editingMaterial) ? t('editItem') || 'Edit Item' : t('addItem') || 'Add Item'}
              </h2>
              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingProduct(null);
                  setEditingMaterial(null);
                }} 
                className="text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('type') || 'Type'}</label>
                  <select 
                    className="input"
                    value={formData.itemType || 'product'}
                    onChange={(e) => {
                      const val = e.target.value as 'product' | 'pack' | 'material';
                      setFormData({ 
                        ...formData, 
                        isPack: val === 'pack',
                        itemType: val,
                        category: val === 'material' ? (itemCategoryConfig.rawMaterial[0] || '') : (itemCategoryConfig.product[0] || '')
                      });
                    }}
                  >
                    <option value="product">{t('regular') || 'Regular'}</option>
                    <option value="pack">{t('pack')}</option>
                    <option value="material">{t('rawMaterial')}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('name')} <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    required
                    className="input" 
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('nameAr')}</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.nameAr || ''}
                    onChange={(e) => setFormData({ ...formData, nameAr: e.target.value || undefined })}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t('nameArHint')}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('category')} <span className="text-red-500">*</span></label>
                  <select 
                    required
                    className="input" 
                    value={formData.category || ''}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    <option value="">{t('selectCategory')}</option>
                    {(formData.itemType === 'material' || formData.category === 'raw_material')
                      ? itemCategoryConfig.rawMaterial.map(cat => (
                        <option key={cat} value={cat}>{tCategory(cat)}</option>
                      ))
                      : itemCategoryConfig.product.map(cat => (
                        <option key={cat} value={cat}>{tCategory(cat)}</option>
                      ))
                    }
                  </select>
                </div>
                {formData.itemType !== 'material' && formData.category !== 'raw_material' && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('sellingPrice')} <span className="text-red-500">*</span></label>
                      <input 
                        type="number" 
                        required
                        className="input" 
                        value={formData.sellingPrice || 0}
                        onChange={(e) => setFormData({ ...formData, sellingPrice: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('costPrice')} <span className="text-red-500">*</span></label>
                      <input 
                        type="number" 
                        required
                        className="input" 
                        value={formData.costPrice || 0}
                        onChange={(e) => setFormData({ ...formData, costPrice: Number(e.target.value) })}
                      />
                    </div>
                  </>
                )}
                {(formData.itemType === 'material' || formData.category === 'raw_material') && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('minStock')} <span className="text-red-500">*</span></label>
                    <input 
                      type="number" 
                      required
                      className="input" 
                      value={formData.minStock || 0}
                      onChange={(e) => setFormData({ ...formData, minStock: Number(e.target.value) })}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('unit')} <span className="text-red-500">*</span></label>
                  <div className="flex bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl gap-1">
                    {['g', 'kg', 'ml', 'l', 'pcs'].map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setFormData({ ...formData, unit: u })}
                        className={clsx(
                          "flex-1 py-2 rounded-lg text-xs font-bold transition-all",
                          (formData.unit || 'g') === u
                            ? "bg-white dark:bg-black text-primary-600 shadow-sm"
                            : "text-slate-400 hover:text-slate-600 dark:text-slate-600 dark:hover:text-slate-400"
                        )}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('imageUrl')}</label>
                  <div className="flex gap-4 items-center">
                    {formData.imageUrl && (
                      <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-[#0a0a0a] overflow-hidden shrink-0 border border-slate-200 dark:border-[#2a1e17]">
                        <img src={formData.imageUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <label className="flex-1 cursor-pointer">
                      <div className="input flex items-center gap-2 text-slate-400 dark:text-slate-600">
                        <ImageIcon className="w-4 h-4" />
                        <span>{formData.imageUrl ? t('changeImage') : t('uploadImage')}</span>
                      </div>
                      <input 
                        type="file" 
                        accept="image/*"
                        className="hidden" 
                        onChange={handleImageUpload}
                      />
                    </label>
                  </div>
                </div>
                {formData.itemType !== 'material' && (
                  <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-[#0a0a0a] rounded-2xl border border-slate-100 dark:border-[#2a1e17]">
                    <input 
                      type="checkbox" 
                      id="isPack"
                      checked={formData.isPack || false}
                      onChange={(e) => setFormData({ ...formData, isPack: e.target.checked })}
                      className="w-5 h-5 text-amber-600 focus:ring-amber-500 bg-white dark:bg-black border-slate-300 dark:border-[#2a1e17] rounded"
                    />
                    <label htmlFor="isPack" className="text-sm font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                      {t('isPack')}
                    </label>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('description')}</label>
                <textarea 
                  className="input min-h-[100px]" 
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              {formData.isPack ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Package className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      {t('packItems')}
                    </h3>
                    <button 
                      type="button"
                      onClick={addPackItem}
                      className="text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 text-sm font-bold flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      {t('addProduct')}
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {formData.packItems?.map((item, index) => (
                      <div key={index} className="flex gap-4 items-end bg-slate-50 dark:bg-[#0a0a0a] p-4 rounded-2xl border border-slate-100 dark:border-[#2a1e17]">
                        <div className="flex-1 space-y-2">
                          <label className="text-xs font-bold text-slate-500 dark:text-slate-500 uppercase">{t('product')}</label>
                          <select 
                            className="input"
                            value={item.productId || ''}
                            onChange={(e) => updatePackItem(index, 'productId', e.target.value)}
                          >
                            <option value="">{t('selectProduct')}</option>
                            {products.filter(p => p.id !== editingProduct?.id && !p.isPack).map(p => (
                              <option key={p.id} value={p.id}>{tProduct(p)}</option>
                            ))}
                          </select>
                        </div>
                        <div className="w-32 space-y-2">
                          <label className="text-xs font-bold text-slate-500 dark:text-slate-500 uppercase">{t('quantity')}</label>
                          <input 
                            type="number" 
                            className="input"
                            value={item.quantity || 1}
                            onChange={(e) => updatePackItem(index, 'quantity', Number(e.target.value))}
                          />
                        </div>
                        <button 
                          type="button"
                          onClick={() => removePackItem(index)}
                          className="p-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (formData as any).itemType === 'material' || formData.category === 'raw_material' ? null : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <List className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      {t('ingredients')}
                    </h3>
                    <button 
                      type="button"
                      onClick={addIngredient}
                      className="text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 text-sm font-bold flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      {t('addIngredient')}
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {formData.ingredients?.map((ing, index) => (
                      <div key={index} className="flex gap-4 items-end bg-slate-50 dark:bg-[#0a0a0a] p-4 rounded-2xl border border-slate-100 dark:border-[#2a1e17]">
                        <div className="flex-1 space-y-2">
                          <label className="text-xs font-bold text-slate-500 dark:text-slate-500 uppercase">{t('material')}</label>
                          <select 
                            className="input"
                            value={ing.materialId || ''}
                            onChange={(e) => updateIngredient(index, 'materialId', e.target.value)}
                          >
                            <option value="">{t('selectMaterial')}</option>
                            {materials.map(m => (
                              <option key={m.id} value={m.id}>{tProduct(m)} {m.brand ? `- ${m.brand}` : ''} ({m.unit})</option>
                            ))}
                          </select>
                        </div>
                        <div className="w-32 space-y-2">
                          <label className="text-xs font-bold text-slate-500 dark:text-slate-500 uppercase">{t('type')}</label>
                          <div className="flex bg-white dark:bg-[#0a0a0a] p-1 rounded-xl border border-slate-200 dark:border-[#2a1e17]">
                            <button 
                              type="button"
                              onClick={() => updateIngredient(index, 'type', 'quantity')}
                              className={clsx(
                                "flex-1 p-2 rounded-lg transition-all",
                                ing.type === 'quantity' ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400" : "text-slate-400 dark:text-slate-600"
                              )}
                            >
                              <Hash className="w-4 h-4 mx-auto" />
                            </button>
                            <button 
                              type="button"
                              onClick={() => updateIngredient(index, 'type', 'weight')}
                              className={clsx(
                                "flex-1 p-2 rounded-lg transition-all",
                                ing.type === 'weight' ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400" : "text-slate-400 dark:text-slate-600"
                              )}
                            >
                              <Scale className="w-4 h-4 mx-auto" />
                            </button>
                            <button 
                              type="button"
                              onClick={() => updateIngredient(index, 'type', 'percentage')}
                              className={clsx(
                                "flex-1 p-2 rounded-lg transition-all",
                                ing.type === 'percentage' ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400" : "text-slate-400 dark:text-slate-600"
                              )}
                            >
                              <Percent className="w-4 h-4 mx-auto" />
                            </button>
                          </div>
                        </div>
                        <div className="w-32 space-y-2">
                          <label className="text-xs font-bold text-slate-500 dark:text-slate-500 uppercase">{t('quantity')}</label>
                          <input 
                            type="number" 
                            className="input"
                            value={ing.quantity || 0}
                            onChange={(e) => updateIngredient(index, 'quantity', Number(e.target.value))}
                          />
                        </div>
                        <button 
                          type="button"
                          onClick={() => removeIngredient(index)}
                          className="p-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-4 pt-4 sticky bottom-0 bg-white dark:bg-[#0a0a0a]">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
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
          </div>
        </div>
      )}

      {isDetailsModalOpen && selectedProductForDetails && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-2xl shadow-2xl p-0 overflow-hidden border-slate-100 dark:border-white/10 bg-white dark:bg-zinc-900">
            <div className="h-64 bg-slate-100 dark:bg-zinc-900 relative">
              <img 
                src={selectedProductForDetails.imageUrl || `https://picsum.photos/seed/${selectedProductForDetails.name}/800/600`} 
                alt={selectedProductForDetails.name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <button 
                onClick={() => setIsDetailsModalOpen(false)}
                className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-black/20 hover:bg-black/40 text-white backdrop-blur-md transition-all"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <div className="p-8">
              <div className="flex items-start justify-between mb-8">
                <div>
                  <span className="px-3 py-1 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 rounded-full text-[10px] font-bold uppercase tracking-wider border border-primary-100 dark:border-primary-900/30 mb-2 inline-block">
                    {tCategory(selectedProductForDetails.category)}
                  </span>
                  <h2 className="text-3xl font-display font-bold text-slate-900 dark:text-white">{tProduct(selectedProductForDetails)}</h2>
                </div>
                <div className="text-right">
                  <p className="text-slate-400 dark:text-slate-600 text-[10px] font-bold uppercase tracking-widest mb-1">{t('price')}</p>
                  <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">{selectedProductForDetails.sellingPrice} {currencyUnit}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-6 mb-8">
                <div className="p-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-white/10">
                  <p className="text-slate-400 dark:text-slate-600 text-[10px] font-bold uppercase tracking-widest mb-1">{t('stock')}</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">{selectedProductForDetails.stock || 0} {selectedProductForDetails.unit || 'g'}</p>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-white/10">
                  <p className="text-slate-400 dark:text-slate-600 text-[10px] font-bold uppercase tracking-widest mb-1">{t('shelfLife')}</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">{selectedProductForDetails.shelfLife}h</p>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-white/10">
                  <p className="text-slate-400 dark:text-slate-600 text-[10px] font-bold uppercase tracking-widest mb-1">{t('costPrice')}</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">{selectedProductForDetails.costPrice || 0} {currencyUnit}</p>
                </div>
              </div>

              {selectedProductForDetails.description && (
                <div className="mb-8">
                  <p className="text-slate-400 dark:text-slate-600 text-[10px] font-bold uppercase tracking-widest mb-2">{t('description')}</p>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{selectedProductForDetails.description}</p>
                </div>
              )}

              {/* Raw Material Definition / Pack Items */}
              {selectedProductForDetails.category !== 'raw_material' && (selectedProductForDetails as any).itemType !== 'material' && (
                <div className="mb-8">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    {selectedProductForDetails.isPack ? <Package className="w-5 h-5 text-amber-600" /> : <List className="w-5 h-5 text-amber-600" />}
                    {selectedProductForDetails.isPack ? t('packItems') : t('ingredients')}
                  </h3>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                    {selectedProductForDetails.isPack ? (
                      selectedProductForDetails.packItems?.map((item, idx) => {
                        const packProduct = products.find(p => p.id === item.productId);
                        return (
                          <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-zinc-900 rounded-xl border border-slate-100 dark:border-white/10">
                            <span className="font-bold text-slate-700 dark:text-slate-300">{packProduct ? tProduct(packProduct) : t('product')}</span>
                            <span className="text-primary-600 dark:text-primary-400 font-bold">x{item.quantity}</span>
                          </div>
                        );
                      })
                    ) : (
                      selectedProductForDetails.ingredients?.map((ing, idx) => {
                        const material = materials.find(m => m.id === ing.materialId);
                        return (
                          <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-zinc-900 rounded-xl border border-slate-100 dark:border-white/10">
                            <span className="font-bold text-slate-700 dark:text-slate-300">{material ? tProduct(material) : t('material')}</span>
                            <span className="text-primary-600 dark:text-primary-400 font-bold">{ing.quantity} {material?.unit || 'g'}</span>
                          </div>
                        );
                      })
                    )}
                    {((selectedProductForDetails.isPack ? selectedProductForDetails.packItems?.length : selectedProductForDetails.ingredients?.length) || 0) === 0 && (
                      <p className="text-sm text-slate-400 dark:text-slate-600 italic">{t('noItemsDefined') || 'No items defined'}</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <button 
                  onClick={() => {
                    setEditingProduct(selectedProductForDetails);
                    setFormData(selectedProductForDetails);
                    setIsDetailsModalOpen(false);
                    setIsModalOpen(true);
                  }}
                  className="flex-1 btn-primary justify-center gap-2"
                >
                  <Edit2 className="w-4 h-4" />
                  {t('edit')}
                </button>
                <button 
                  onClick={() => setIsDetailsModalOpen(false)}
                  className="flex-1 btn-secondary justify-center"
                >
                  {t('close')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductManagement;
