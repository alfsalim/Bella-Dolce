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
  Image as ImageIcon,
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
import { db, collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc, setDoc, limit, handleFirestoreError, OperationType, getCountFromServer, where, getDoc, getDocs, Timestamp } from '../lib/firebase';
import { Product, RawMaterial, StockMovement, Recipe } from '../types';
import { logActivity } from '../lib/logger';
import { useAuth } from '../contexts/AuthContext';
import { clsx } from 'clsx';
import { CATEGORIES, UNITS, CURRENCY } from '../constants';
import { compressImage } from '../lib/utils';
import { toast } from 'react-hot-toast';
import Pagination from '../components/Pagination';

const Inventory: React.FC = () => {
  const { t, isRTL, tProduct, tCategory } = useLanguage();
  const { profile: currentUserProfile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [productsPage, setProductsPage] = useState(1);
  const [materialsPage, setMaterialsPage] = useState(1);
  const [totalProductsPages, setTotalProductsPages] = useState(1);
  const [totalMaterialsPages, setTotalMaterialsPages] = useState(1);
  const [pageSize] = useState(25);
  const [activeTab, setActiveTab] = useState<'products' | 'materials' | 'movements'>('products');
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [movementsPage, setMovementsPage] = useState(1);
  const [totalMovementsPages, setTotalMovementsPages] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'All' | 'Regular' | 'Pack' | 'RawMaterial'>('All');
  const [showDisabled, setShowDisabled] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'card'>(() => {
    return (localStorage.getItem('inventoryViewMode') as 'list' | 'card') || 'card';
  });
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<Product>>({});

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
        
        setTotalProductsPages(Math.ceil(productsSnapshot.data().count / pageSize));
        setTotalMaterialsPages(Math.ceil(materialsSnapshot.data().count / pageSize));
      } catch (error) {
        console.error('Error fetching counts:', error);
      }
    };
    fetchCounts();

    let productsQ = query(collection(db, 'products'), orderBy('name'), limit(pageSize * productsPage));
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
      const startIndex = (productsPage - 1) * pageSize;
      setProducts(allProducts.slice(startIndex, startIndex + pageSize));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'products'));

    let unsubscribeMaterials = () => {};
    if (currentUserProfile) {
      let materialsQ = query(collection(db, 'rawMaterials'), orderBy('name'), limit(pageSize * materialsPage));
      if (selectedStatus !== 'all') {
        materialsQ = query(materialsQ, where('status', '==', selectedStatus));
      }

      unsubscribeMaterials = onSnapshot(materialsQ, async (snapshot) => {
        const allMaterials = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RawMaterial));
        const startIndex = (materialsPage - 1) * pageSize;
        const currentMaterials = allMaterials.slice(startIndex, startIndex + pageSize);
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
      const movementsQ = query(collection(db, 'stockMovements'), orderBy('timestamp', 'desc'), limit(pageSize * movementsPage));
      unsubscribeMovements = onSnapshot(movementsQ, (snapshot) => {
        const allMovements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockMovement));
        const startIndex = (movementsPage - 1) * pageSize;
        setMovements(allMovements.slice(startIndex, startIndex + pageSize));
        
        // Update total pages for movements
        getCountFromServer(collection(db, 'stockMovements')).then(countSnapshot => {
          setTotalMovementsPages(Math.ceil(countSnapshot.data().count / pageSize));
        });
      }, (error) => handleFirestoreError(error, OperationType.GET, 'stockMovements'));
    }

    return () => {
      unsubscribeProducts();
      unsubscribeMaterials();
      unsubscribeMovements();
    };
  }, [productsPage, materialsPage, movementsPage, pageSize, currentUserProfile, selectedCategory, selectedStatus]);

  useEffect(() => {
    localStorage.setItem('inventoryViewMode', viewMode);
  }, [viewMode]);

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
    imageUrl: ''
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check for unique name
    const normalizedNewName = formData.name.trim().toLowerCase().replace(/\s+/g, ' ');
    const productExists = products.some(p => p.name.trim().toLowerCase().replace(/\s+/g, ' ') === normalizedNewName);
    const materialExists = materials.some(m => m.name.trim().toLowerCase().replace(/\s+/g, ' ') === normalizedNewName);

    if (productExists || materialExists) {
      toast.error(t('nameExists') || 'Name already exists in products or materials');
      return;
    }

    try {
      if (selectedProduct && selectedProduct.id) {
        // Handle Edit
        const itemRef = doc(db, activeTab === 'products' ? 'products' : 'rawMaterials', selectedProduct.id);
        const updateData = activeTab === 'products' ? {
          name: formData.name,
          category: formData.category,
          sellingPrice: Number(formData.price),
          stock: Number(formData.shopStock) + Number(formData.freezerStock),
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
          imageUrl: formData.imageUrl
        };

        await updateDoc(itemRef, updateData);

        // Log stock movements if changed
        if (currentUserProfile) {
          if (activeTab === 'products') {
            const oldProduct = selectedProduct as Product;
            if (Number(formData.shopStock) !== oldProduct.shopStock) {
              const diff = Number(formData.shopStock) - (oldProduct.shopStock || 0);
              await addDoc(collection(db, 'stockMovements'), {
                itemId: selectedProduct.id,
                itemName: formData.name,
                itemType: 'product',
                type: diff > 0 ? 'in' : 'out',
                quantity: Math.abs(diff),
                location: 'shop',
                reason: 'manual_adjustment',
                userId: currentUserProfile.id,
                userName: currentUserProfile.name,
                timestamp: Timestamp.now()
              });
            }
            if (Number(formData.freezerStock) !== oldProduct.freezerStock) {
              const diff = Number(formData.freezerStock) - (oldProduct.freezerStock || 0);
              await addDoc(collection(db, 'stockMovements'), {
                itemId: selectedProduct.id,
                itemName: formData.name,
                itemType: 'product',
                type: diff > 0 ? 'in' : 'out',
                quantity: Math.abs(diff),
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
              const diff = Number(formData.stock) - (oldMaterial.currentStock || 0);
              await addDoc(collection(db, 'stockMovements'), {
                itemId: selectedProduct.id,
                itemName: formData.name,
                itemType: 'material',
                type: diff > 0 ? 'in' : 'out',
                quantity: Math.abs(diff),
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
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } else if (activeTab === 'materials') {
          // If we edit a material, check if it exists as a product and sync back
          const prodDoc = await getDoc(doc(db, 'products', selectedProduct.id));
          if (prodDoc.exists()) {
            await updateDoc(doc(db, 'products', selectedProduct.id), {
              name: formData.name,
              stock: Number(formData.stock),
              minStock: Number(formData.minStock),
              imageUrl: formData.imageUrl
            });
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
            await logActivity(
              currentUserProfile.id,
              currentUserProfile.name,
              'product_added',
              `Added product ${formData.name} to inventory`
            );

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
            createdAt: new Date().toISOString()
          });
          if (currentUserProfile) {
            await logActivity(
              currentUserProfile.id,
              currentUserProfile.name,
              'material_added',
              `Added raw material ${formData.name} to inventory`
            );

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
        imageUrl: ''
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
        <button onClick={() => {
          setFormData({
            name: '',
            brand: '',
            category: activeTab === 'products' ? CATEGORIES[0] : 'Flour',
            price: 0,
            unit: 'kg',
            stock: 0,
            shopStock: 0,
            freezerStock: 0,
            minStock: 0,
            shelfLife: 24,
            imageUrl: ''
          });
          setIsModalOpen(true);
        }} className="btn-primary gap-2 w-full sm:w-auto">
          <Plus className="w-5 h-5" />
          {activeTab === 'products' ? t('addProduct') : t('addMaterial')}
        </button>
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
          onClick={() => setActiveTab('movements')}
          className={clsx(
            "px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
            activeTab === 'movements' ? "bg-white dark:bg-primary-600 text-primary-600 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          <div className="flex items-center gap-2">
            <History className="w-4 h-4" />
            {t('movements')}
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
              <div key={product.id} className="card group hover:shadow-xl transition-all duration-300 overflow-hidden p-0 border-slate-100 dark:border-white/10">
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
                      <h3 className="font-bold text-slate-900 dark:text-white text-lg">{tProduct(product.name)}</h3>
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
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 dark:text-slate-600">
                            <Store className="w-3 h-3" />
                            {product.shopStock || 0}
                          </div>
                          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 dark:text-slate-600">
                            <Snowflake className="w-3 h-3" />
                            {product.freezerStock || 0}
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
                              <span>• {packProduct ? tProduct(packProduct.name) : t('product')}</span>
                              <span>x{item.quantity}</span>
                            </div>
                          );
                        })
                      ) : (
                        product.ingredients?.slice(0, 3).map((ing, idx) => {
                          const material = materials.find(m => m.id === ing.materialId);
                          return (
                            <div key={idx} className="flex justify-between text-[10px] text-slate-400 dark:text-slate-600 italic">
                              <span>• {material ? tProduct(material.name) : t('material')}</span>
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
                        onClick={() => {
                          setSelectedProduct(product);
                          setFormData({
                            name: product.name,
                            brand: '',
                            category: product.category,
                            price: product.sellingPrice,
                            unit: 'units',
                            stock: product.stock,
                            shopStock: product.shopStock || 0,
                            freezerStock: product.freezerStock || 0,
                            minStock: product.minStock,
                            shelfLife: product.shelfLife || 24,
                            imageUrl: product.imageUrl || ''
                          });
                          setIsModalOpen(true);
                        }}
                        className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                        title={t('edit')}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => deleteProduct(product.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title={t('delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <button 
                      onClick={() => {
                        setSelectedProduct(product);
                        setIsDetailsModalOpen(true);
                      }}
                      className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-bold text-sm flex items-center gap-1 group/btn"
                    >
                      {t('details')}
                      <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                    </button>
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
                    <tr key={product.id} className="group hover:bg-slate-50/50 dark:hover:bg-zinc-900/50 transition-all">
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
                          <span className="font-bold text-slate-900 dark:text-white whitespace-nowrap">{tProduct(product.name)}</span>
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
                          product.status === 'frozen' ? 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/30' : 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/30'
                        )}>
                          {t(product.status || 'none')}
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
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex justify-end items-center gap-2">
                          {product.disabled ? (
                            <button 
                              onClick={() => restoreProduct(product.id)}
                              className="p-2 text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                              title={t('restore')}
                            >
                              <RefreshCcw className="w-4 h-4" />
                            </button>
                          ) : (
                            <>
                              <button 
                                onClick={() => {
                                  setSelectedProduct(product);
                                  setFormData({
                                    name: product.name,
                                    brand: '',
                                    category: product.category,
                                    price: product.sellingPrice,
                                    unit: 'units',
                                    stock: product.stock,
                                    shopStock: product.shopStock || 0,
                                    freezerStock: product.freezerStock || 0,
                                    minStock: product.minStock,
                                    shelfLife: product.shelfLife || 24,
                                    imageUrl: product.imageUrl || ''
                                  });
                                  setIsModalOpen(true);
                                }}
                                className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                                title={t('edit')}
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => deleteProduct(product.id)}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                title={t('delete')}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          <button 
                            onClick={() => {
                              setSelectedProduct(product);
                              setIsDetailsModalOpen(true);
                            }}
                            className="btn-secondary py-1 px-3 text-xs"
                          >
                            {t('details')}
                          </button>
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
        )
      ) : activeTab === 'movements' ? (
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
                        <h3 className="font-bold text-slate-900 dark:text-white">{tProduct(material.name)}</h3>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{material.currentStock} {material.unit}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-600 font-bold uppercase tracking-widest">{t('stock')}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/5">
                      <span className="text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">{t('minStock')}: {material.minStock} {material.unit}</span>
                      <div className="flex gap-2">
                        {material.disabled ? (
                          <button 
                            onClick={() => restoreMaterial(material.id)}
                            className="p-2 text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                            title={t('restore')}
                          >
                            <RefreshCcw className="w-4 h-4" />
                          </button>
                        ) : (
                          <>
                            <button 
                              onClick={() => {
                                setFormData({
                                  name: material.name,
                                  brand: material.brand || '',
                                  category: material.category,
                                  price: 0,
                                  unit: material.unit,
                                  stock: material.currentStock,
                                  shopStock: 0,
                                  freezerStock: 0,
                                  minStock: material.minStock,
                                  shelfLife: 24,
                                  imageUrl: material.imageUrl || ''
                                });
                                setSelectedProduct(material as any);
                                setIsModalOpen(true);
                              }}
                              className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => deleteMaterial(material.id)}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
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
                <th className="px-8 py-5 whitespace-nowrap">{t('status')}</th>
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
                        <span className="font-bold text-slate-900 dark:text-white whitespace-nowrap">{tProduct(material.name)}</span>
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
                  <td className="px-8 py-5 whitespace-nowrap">
                    {material.status && material.status !== 'none' ? (
                      <span className="px-3 py-1 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 rounded-full text-[10px] font-bold uppercase tracking-wider border border-primary-100 dark:border-primary-900/30">
                        {t(material.status)}
                      </span>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-700 text-[10px] font-bold uppercase tracking-widest">-</span>
                    )}
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
                            onClick={() => updateMaterialStatus(material.id, 'ordered')}
                            title={t('ordered')}
                            className="w-9 h-9 flex items-center justify-center rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:border-primary-200 dark:hover:border-primary-900/30 transition-all"
                          >
                            <ShoppingCart className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => updateMaterialStatus(material.id, 'requested')}
                            title={t('reorder')}
                            className="w-9 h-9 flex items-center justify-center rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-200 dark:hover:border-amber-900/30 transition-all"
                          >
                            <RefreshCcw className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => deleteMaterial(material.id)}
                            className="w-9 h-9 flex items-center justify-center rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-900/30 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
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
      )
    )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-lg shadow-2xl border-slate-100 dark:border-white/10 bg-white dark:bg-zinc-900">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
              {activeTab === 'products' ? t('addProduct') : t('addMaterial')}
            </h2>
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-2">{t('name')}</label>
                  <input 
                    type="text" 
                    className="input bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white" 
                    placeholder="e.g. Croissant" 
                    required
                    value={formData.name || ''}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                {activeTab === 'materials' && (
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-2">{t('brand') || 'Brand'}</label>
                    <input 
                      type="text" 
                      className="input bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white" 
                      placeholder="e.g. Moulins de Paris" 
                      value={formData.brand || ''}
                      onChange={(e) => setFormData({...formData, brand: e.target.value})}
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-2">{t('category')}</label>
                  <select 
                    className="input bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                    value={formData.category || ''}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                  >
                    {activeTab === 'products' ? CATEGORIES.filter(c => !['flour', 'dairy', 'sugar', 'liquid', 'other_material'].includes(c)).map(c => <option key={c} value={c}>{tCategory(c)}</option>) : ['flour', 'dairy', 'sugar', 'liquid', 'other_material', 'cooking', 'maintenance', 'cleaning', 'others'].map(c => <option key={c} value={c}>{tCategory(c)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-2">{activeTab === 'products' ? `${t('price')} (${CURRENCY})` : t('unit')}</label>
                  {activeTab === 'products' ? (
                    <input 
                      type="number" 
                      className="input bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white" 
                      placeholder="0.00" 
                      required
                      value={formData.price || 0}
                      onChange={(e) => setFormData({...formData, price: Number(e.target.value)})}
                    />
                  ) : (
                    <select 
                      className="input bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                      value={formData.unit || 'kg'}
                      onChange={(e) => setFormData({...formData, unit: e.target.value})}
                    >
                      {UNITS.map(u => <option key={u} value={u}>{t(u)}</option>)}
                    </select>
                  )}
                </div>
                {activeTab === 'products' ? (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-2">{t('shopStock')}</label>
                      <div className="relative">
                        <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                          type="number" 
                          className="input pl-10 bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white" 
                          placeholder="0" 
                          required
                          value={formData.shopStock || 0}
                          onChange={(e) => setFormData({...formData, shopStock: Number(e.target.value)})}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-2">{t('freezerStock')}</label>
                      <div className="relative">
                        <Snowflake className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                          type="number" 
                          className="input pl-10 bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white" 
                          placeholder="0" 
                          required
                          value={formData.freezerStock || 0}
                          onChange={(e) => setFormData({...formData, freezerStock: Number(e.target.value)})}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-2">{t('currentStock')}</label>
                    <input 
                      type="number" 
                      className="input bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white" 
                      placeholder="0" 
                      required
                      value={formData.stock || 0}
                      onChange={(e) => setFormData({...formData, stock: Number(e.target.value)})}
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-2">{t('minStock')}</label>
                  <input 
                    type="number" 
                    className="input bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white" 
                    placeholder="0" 
                    required
                    value={formData.minStock || 0}
                    onChange={(e) => setFormData({...formData, minStock: Number(e.target.value)})}
                  />
                </div>
                {activeTab === 'products' && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-2">{t('shelfLife')}</label>
                      <input 
                        type="number" 
                        className="input bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white" 
                        placeholder="24" 
                        required
                        value={formData.shelfLife || 24}
                        onChange={(e) => setFormData({...formData, shelfLife: Number(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-2">{t('imageUrl')}</label>
                      <div className="flex gap-4 items-center">
                        {formData.imageUrl && (
                          <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-zinc-900 overflow-hidden shrink-0 border border-slate-200 dark:border-white/10">
                            <img src={formData.imageUrl} alt="" className="w-full h-full object-cover" />
                          </div>
                        )}
                        <label className="flex-1 cursor-pointer">
                          <div className="input flex items-center gap-2 text-slate-400 dark:text-slate-600 bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-white/10">
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
                  </>
                )}
                {activeTab === 'materials' && (
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-2">{t('imageUrl')}</label>
                    <div className="flex gap-4 items-center">
                      {formData.imageUrl && (
                        <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-zinc-900 overflow-hidden shrink-0 border border-slate-200 dark:border-white/10">
                          <img src={formData.imageUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <label className="flex-1 cursor-pointer">
                        <div className="input flex items-center gap-2 text-slate-400 dark:text-slate-600 bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-white/10">
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
                )}
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-2">{t('imageUrl') || 'Image URL'}</label>
                  <input 
                    type="text" 
                    className="input bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white" 
                    placeholder="https://example.com/image.jpg" 
                    value={formData.imageUrl || ''}
                    onChange={(e) => setFormData({...formData, imageUrl: e.target.value})}
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 btn-secondary justify-center dark:bg-zinc-800 dark:border-white/10 dark:text-slate-300">{t('cancel')}</button>
                <button type="submit" className="flex-1 btn-primary justify-center dark:bg-primary-600 dark:hover:bg-primary-700">{t('save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
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
                      <h2 className="text-3xl font-display font-bold text-slate-900 dark:text-white">{tProduct(selectedProduct.name)}</h2>
                    </>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-slate-400 dark:text-slate-600 text-xs font-bold uppercase tracking-widest mb-1">{t('status')}</p>
                  {isEditingDetails ? (
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
                  )}
                </div>
              </div>

              <div className={clsx(
                "grid gap-6 mb-8",
                selectedProduct.itemType === 'product' ? "grid-cols-2 md:grid-cols-4" : "grid-cols-3"
              )}>
                <div className="p-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-white/10">
                  <p className="text-slate-400 dark:text-slate-600 text-[10px] font-bold uppercase tracking-widest mb-1">{t('totalStock')}</p>
                  {isEditingDetails ? (
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        className="input py-1 text-sm w-full"
                        disabled
                        value={(editFormData.shopStock || 0) + (editFormData.freezerStock || 0)}
                      />
                      <span className="text-xs font-bold text-slate-500">{selectedProduct.unit || 'g'}</span>
                    </div>
                  ) : (
                    <p className="text-xl font-bold text-slate-900 dark:text-white">{selectedProduct.stock} {selectedProduct.unit || 'g'}</p>
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
                          onChange={(e) => setEditFormData({...editFormData, shopStock: Number(e.target.value)})}
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
                          onChange={(e) => setEditFormData({...editFormData, freezerStock: Number(e.target.value)})}
                        />
                      ) : (
                        <p className="text-xl font-bold text-slate-900 dark:text-white">{selectedProduct.freezerStock || 0}</p>
                      )}
                    </div>
                  </>
                )}

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
                              <option key={p.id} value={p.id}>{tProduct(p.name)}</option>
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
                              <option key={m.id} value={m.id}>{tProduct(m.name)}</option>
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
                            <span className="font-bold text-slate-700 dark:text-slate-300">{packProduct ? tProduct(packProduct.name) : t('product')}</span>
                            <span className="text-primary-600 dark:text-primary-400 font-bold">x{item.quantity}</span>
                          </div>
                        );
                      })
                    ) : (
                      selectedProduct.ingredients?.map((ing, idx) => {
                        const material = materials.find(m => m.id === ing.materialId);
                        return (
                          <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-zinc-900 rounded-xl border border-slate-100 dark:border-white/10">
                            <span className="font-bold text-slate-700 dark:text-slate-300">{material ? tProduct(material.name) : t('material')}</span>
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
                          const updatedStock = (editFormData.shopStock || 0) + (editFormData.freezerStock || 0);
                          const finalData = {
                            ...editFormData,
                            stock: updatedStock
                          };

                          await updateDoc(doc(db, 'products', selectedProduct.id), finalData);
                          
                          // Log stock movements if changed
                          if (currentUserProfile) {
                            if (editFormData.shopStock !== selectedProduct.shopStock) {
                              const diff = (editFormData.shopStock || 0) - (selectedProduct.shopStock || 0);
                              await addDoc(collection(db, 'stockMovements'), {
                                itemId: selectedProduct.id,
                                itemName: selectedProduct.name,
                                itemType: 'product',
                                type: diff > 0 ? 'in' : 'out',
                                quantity: Math.abs(diff),
                                location: 'shop',
                                reason: 'manual_adjustment',
                                userId: currentUserProfile.id,
                                userName: currentUserProfile.name,
                                timestamp: Timestamp.now()
                              });
                            }
                            if (editFormData.freezerStock !== selectedProduct.freezerStock) {
                              const diff = (editFormData.freezerStock || 0) - (selectedProduct.freezerStock || 0);
                              await addDoc(collection(db, 'stockMovements'), {
                                itemId: selectedProduct.id,
                                itemName: selectedProduct.name,
                                itemType: 'product',
                                type: diff > 0 ? 'in' : 'out',
                                quantity: Math.abs(diff),
                                location: 'freezer',
                                reason: 'manual_adjustment',
                                userId: currentUserProfile.id,
                                userName: currentUserProfile.name,
                                timestamp: Timestamp.now()
                              });
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
                      onClick={() => {
                        setEditFormData({
                          name: selectedProduct.name,
                          stock: selectedProduct.stock,
                          shopStock: selectedProduct.shopStock || 0,
                          freezerStock: selectedProduct.freezerStock || 0,
                          status: selectedProduct.status,
                          category: selectedProduct.category,
                          sellingPrice: selectedProduct.sellingPrice,
                          shelfLife: selectedProduct.shelfLife,
                          minStock: selectedProduct.minStock,
                          imageUrl: selectedProduct.imageUrl || '',
                          ingredients: selectedProduct.ingredients || [],
                          packItems: selectedProduct.packItems || []
                        });
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
    </div>
  );
};

export default Inventory;
