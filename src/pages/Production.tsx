import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  ChefHat, 
  Plus, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Play, 
  MoreVertical,
  Search,
  Filter,
  Calendar,
  Zap,
  RefreshCcw,
  LayoutGrid,
  LayoutList,
  AlertCircle,
  Edit2,
  Trash2,
  Store,
  Snowflake
} from 'lucide-react';
import { db, collection, onSnapshot, query, orderBy, addDoc, updateDoc, doc, deleteDoc, Timestamp, getDoc, limit, handleFirestoreError, OperationType, getCountFromServer, where, getDocs, writeBatch } from '../lib/firebase-compat';
import { toast } from 'react-hot-toast';
import { ProductionBatch, Product, Recipe } from '../types';
import { clsx } from 'clsx';
import { format } from 'date-fns';

import { logActivity } from '../lib/logger';
import { useAuth } from '../contexts/AuthContext';
import Pagination from '../components/Pagination';
import { PAGE_SIZE } from '../constants';

const Production: React.FC = () => {
  const { t, isRTL, tProduct, tCategory } = useLanguage();
  const { profile } = useAuth();
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditingBatch, setIsEditingBatch] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('All');
  const [viewMode, setViewMode] = useState<'list' | 'card'>(() => {
    return (localStorage.getItem('productionViewMode') as 'list' | 'card') || 'card';
  });
  const [error, setError] = useState<string | null>(null);
  const [rawMaterials, setRawMaterials] = useState<any[]>([]);
  const [isDistributionModalOpen, setIsDistributionModalOpen] = useState(false);
  const [batchToComplete, setBatchToComplete] = useState<any | null>(null);
  const [distribution, setDistribution] = useState({ shop: 0, frozen: 0, waste: 0 });
  // Helper to convert Date to Local ISO string for datetime-local input (YYYY-MM-DDTHH:mm)
  const toLocalISO = (date: Date) => {
    const tzOffset = date.getTimezoneOffset() * 60000; // offset in milliseconds
    const localISOTime = new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
    return localISOTime;
  };

  const [newBatch, setNewBatch] = useState<{
    productId: string;
    recipeId: string;
    plannedQty: number;
    ingredients: { materialId: string; quantity: number; type: 'quantity' | 'weight' | 'percentage' }[];
    status?: string;
    startDate?: string;
    location?: 'shop' | 'freezer';
  }>({
    productId: '',
    recipeId: '',
    plannedQty: 0,
    ingredients: [],
    startDate: toLocalISO(new Date()),
    location: 'shop'
  });

  useEffect(() => {
    if (isEditingBatch && selectedBatch) {
      setNewBatch({
        productId: selectedBatch.productId || '',
        recipeId: selectedBatch.recipeId || '',
        plannedQty: selectedBatch.plannedQty || 0,
        ingredients: selectedBatch.ingredients || [],
        status: selectedBatch.status,
        startDate: selectedBatch.startDate ? toLocalISO(new Date(selectedBatch.startDate)) : toLocalISO(new Date()),
        location: selectedBatch.location || 'shop'
      });
    } else if (isModalOpen && !isEditingBatch) {
      setNewBatch({
        productId: '',
        recipeId: '',
        plannedQty: 0,
        ingredients: [],
        startDate: toLocalISO(new Date()),
        location: 'shop'
      });
    }
  }, [isEditingBatch, selectedBatch, isModalOpen]);

  useEffect(() => {
    // Only auto-populate if we just selected a product and ingredients are empty
    if (newBatch.productId && !isEditingBatch && newBatch.ingredients.length === 0) {
      const recipe = recipes.find(r => r.productId === newBatch.productId);
      const product = products.find(p => p.id === newBatch.productId);
      
      // Try recipe first, then product ingredients
      const sourceIngredients = recipe?.ingredients || product?.ingredients;
      const batchSize = recipe?.batchSize || 10;

      if (sourceIngredients && sourceIngredients.length > 0) {
        setNewBatch(prev => ({
          ...prev,
          ingredients: sourceIngredients.map(ing => ({ 
            ...ing, 
            quantity: Number(((ing.quantity / (batchSize || 1)) * batchSize).toFixed(3))
          })),
          plannedQty: batchSize,
          recipeId: recipe?.id || ''
        }));
      }
    }
  }, [newBatch.productId, recipes, products, isEditingBatch]);

  const getMaxPossible = () => {
    if (newBatch.ingredients.length === 0) return 0;

    let minPossible = Infinity;
    newBatch.ingredients.forEach(ing => {
      if (!ing.materialId) return;
      const material = rawMaterials.find(m => m.id === ing.materialId);
      if (material && ing.quantity > 0) {
        // Current quantity is for the current plannedQty
        // We want to know how many units we can produce with current proportions
        const qtyPerUnit = ing.quantity / (newBatch.plannedQty || 1);
        if (qtyPerUnit > 0) {
          const possible = Math.floor(material.currentStock / qtyPerUnit);
          if (possible < minPossible) minPossible = possible;
        }
      } else if (!material && ing.materialId) {
        minPossible = 0;
      }
    });

    return minPossible === Infinity ? 0 : minPossible;
  };

  const isShortValue = (ing: any) => {
    if (!ing.materialId) return false;
    const material = rawMaterials.find(m => m.id === ing.materialId);
    if (!material) return false;
    const qty = typeof ing.quantity === 'number' ? ing.quantity : parseFloat(ing.quantity) || 0;
    return material.currentStock < qty;
  };

  const handlePlannedQtyChange = (qty: number) => {
    const safeQty = Math.max(0, qty);
    const oldQty = newBatch.plannedQty;
    
    setNewBatch(prev => {
      // If old qty was 0 or invalid, or new qty is 0, we can't scale. We just update the qty.
      // This prevents ingredients from being zeroed out when the user is typing/clearing the field.
      if (!oldQty || oldQty <= 0 || safeQty <= 0) {
        return { ...prev, plannedQty: safeQty };
      }

      const ratio = safeQty / oldQty;
      
      // Scale current ingredients proportionally to preserve manual additions
      const updatedIngredients = prev.ingredients.map(ing => ({
        ...ing,
        quantity: Number((ing.quantity * ratio).toFixed(3))
      }));
      
      return { 
        ...prev, 
        plannedQty: safeQty,
        ingredients: updatedIngredients
      };
    });
  };

  const handleIngredientChange = (index: number, field: string, value: any) => {
    setNewBatch(prev => {
      const updatedIngredients = [...prev.ingredients];
      updatedIngredients[index] = { ...updatedIngredients[index], [field]: value };
      return { ...prev, ingredients: updatedIngredients };
    });
  };

  const addIngredient = () => {
    setNewBatch(prev => ({
      ...prev,
      ingredients: [...prev.ingredients, { materialId: '', quantity: 1, type: 'quantity' }]
    }));
  };

  const removeIngredient = (index: number) => {
    setNewBatch(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index)
    }));
  };

  useEffect(() => {
    localStorage.setItem('productionViewMode', viewMode);
  }, [viewMode]);

  const [isCleaning, setIsCleaning] = useState(false);

  // Automatic cleanup of unknown batches for admins
  useEffect(() => {
    const cleanUnknownBatches = async () => {
      if (profile?.role === 'admin' && products.length > 0 && !isCleaning) {
        setIsCleaning(true);
        try {
          const q = query(collection(db, 'batches'));
          const snapshot = await getDocs(q);
          const batchCleanup = writeBatch(db);
          let count = 0;
          
          snapshot.docs.forEach(docSnap => {
            const data = docSnap.data();
            const product = products.find(p => p.id === data.productId);
            const productName = data.productName || 'Unknown';
            const isUnknown = !product && (
              productName === 'Unknown' || 
              productName === 'Inconnu' || 
              productName === 'Unknown Product' ||
              !data.productId
            );
            
            if (isUnknown) {
              batchCleanup.delete(docSnap.ref);
              count++;
            }
          });
          
          if (count > 0) {
            await batchCleanup.commit();
            toast.success(`Cleaned up ${count} unknown batches`);
          }
        } catch (error) {
          console.error('Error cleaning unknown batches:', error);
        } finally {
          setIsCleaning(false);
        }
      }
    };
    
    cleanUnknownBatches();
  }, [profile, products.length]);

  useEffect(() => {
    const unsubscribeMaterials = onSnapshot(collection(db, 'rawMaterials'), (snapshot) => {
      const mats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setRawMaterials(prev => {
        // Only keep active ones and merge with current to avoid flickering
        const newMats = mats.filter(m => !m.disabled);
        return newMats;
      });
    }, (error) => handleFirestoreError(error, OperationType.GET, 'rawMaterials'));
    return () => unsubscribeMaterials();
  }, []);

  useEffect(() => {
    const fetchCounts = async () => {
      let q = query(collection(db, 'batches'));
      
      // Apply status filter to count
      if (statusFilter !== 'all') {
        q = query(q, where('status', '==', statusFilter));
      }
      
      // Apply user filter to count
      if (userFilter !== 'All') {
        q = query(q, where('createdBy', '==', userFilter));
      }

      const snapshot = await getCountFromServer(q);
      setTotalPages(Math.ceil(snapshot.data().count / PAGE_SIZE));
    };
    fetchCounts();

    let q = query(collection(db, 'batches'), orderBy('startDate', 'desc'), limit(PAGE_SIZE * currentPage));
    
    // Apply status filter to query
    if (statusFilter !== 'all') {
      q = query(q, where('status', '==', statusFilter));
    }
    
    // Apply user filter to query
    if (userFilter !== 'All') {
      q = query(q, where('createdBy', '==', userFilter));
    }

    const unsubscribeBatches = onSnapshot(q, (snapshot) => {
      const allBatches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductionBatch));
      const startIndex = (currentPage - 1) * PAGE_SIZE;
      setBatches(allBatches.slice(startIndex, startIndex + PAGE_SIZE));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'batches'));

    const unsubscribeProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'products'));

    const unsubscribeRecipes = onSnapshot(collection(db, 'recipes'), (snapshot) => {
      setRecipes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Recipe)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'recipes'));

    return () => {
      unsubscribeBatches();
      unsubscribeProducts();
      unsubscribeRecipes();
    };
  }, [currentPage, PAGE_SIZE, statusFilter, userFilter]);

  const handleDeleteBatch = async (batch: ProductionBatch) => {
    if (!window.confirm(t('confirmDeleteBatch') || 'Are you sure you want to delete this batch?')) return;

    try {
      // 1. Revert ingredients if batch was active (deducted stock)
      if (batch.status === 'started') {
        for (const ing of batch.ingredients || []) {
          const rawMaterialRef = doc(db, 'rawMaterials', ing.materialId);
          const rawMaterialSnap = await getDoc(rawMaterialRef);
          if (rawMaterialSnap.exists()) {
            const currentStock = rawMaterialSnap.data().currentStock || 0;
            const newStock = currentStock + ing.quantity;
            await updateDoc(rawMaterialRef, { currentStock: newStock });
            
            await addDoc(collection(db, 'stockMovements'), {
              itemId: ing.materialId,
              itemName: rawMaterialSnap.data().name,
              itemType: 'material',
              type: 'in',
              quantity: ing.quantity,
              previousStock: currentStock,
              newStock: newStock,
              reason: 'cancellation',
              referenceId: batch.id,
              userId: profile?.id || 'system',
              userName: profile?.name || 'System',
              timestamp: new Date().toISOString()
            });
          }
        }
      }

      // 2. Revert produced products if batch was completed
      if (batch.status === 'completed') {
        const product = products.find(p => p.id === batch.productId);
        if (product) {
          const productRef = doc(db, 'products', product.id);
          const qty = batch.actualQty || batch.plannedQty;
          const location = (batch as any).location || 'shop';
          
          const currentStock = product.stock || 0;
          const newStock = Math.max(0, currentStock - qty);
          
          const updateFields: any = { stock: newStock };
          if (location === 'shop') {
            updateFields.shopStock = Math.max(0, (product.shopStock || 0) - qty);
          } else {
            updateFields.freezerStock = Math.max(0, (product.freezerStock || 0) - qty);
          }
          
          await updateDoc(productRef, updateFields);
          
          await addDoc(collection(db, 'stockMovements'), {
            itemId: product.id,
            itemName: product.name,
            itemType: 'product',
            type: 'out',
            quantity: qty,
            previousStock: currentStock,
            newStock: newStock,
            reason: 'cancellation',
            referenceId: batch.id,
            userId: profile?.id || 'system',
            userName: profile?.name || 'System',
            location: location,
            timestamp: new Date().toISOString()
          });
        }
      }

      await deleteDoc(doc(db, 'batches', batch.id));
      setIsModalOpen(false);
      setIsEditingBatch(false);
      setSelectedBatch(null);
      toast.success(t('batchDeleted') || 'Batch deleted successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'batches');
    }
  };

  const handleAddBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBatch.productId || !newBatch.plannedQty) return;

    // Validate ingredients for non-cancelled batches
    if (newBatch.ingredients.length === 0 && newBatch.status !== 'cancelled') {
      toast.error(t('ingredientsRequired') || 'At least one ingredient is required to start production');
      return;
    }

    try {
      const recipe = recipes.find(r => r.productId === newBatch.productId);
      const initialStatus = newBatch.status || 'started';

      if (isEditingBatch && selectedBatch) {
        const batchId = selectedBatch.id;
        // Logic for inventory sync
        const wasActive = selectedBatch.status === 'started';
        const isNowActive = newBatch.status === 'started';

        if (wasActive && !isNowActive) {
          // Returning stock (Active -> Non-active)
          if (selectedBatch.ingredients) {
            for (const ingredient of selectedBatch.ingredients) {
              const rawMaterialRef = doc(db, 'rawMaterials', ingredient.materialId);
              const rawMaterialSnap = await getDoc(rawMaterialRef);
              if (rawMaterialSnap.exists()) {
                const currentStock = rawMaterialSnap.data().currentStock || 0;
                const newStock = currentStock + ingredient.quantity;
                await updateDoc(rawMaterialRef, { currentStock: newStock });
                
                await addDoc(collection(db, 'stockMovements'), {
                  itemId: ingredient.materialId,
                  itemName: rawMaterialSnap.data().name,
                  itemType: 'material',
                  type: 'in',
                  quantity: ingredient.quantity,
                  previousStock: currentStock,
                  newStock: newStock,
                  reason: 'adjustment_revert',
                  referenceId: batchId,
                  userId: profile?.id || 'system',
                  userName: profile?.name || 'System',
                  timestamp: new Date().toISOString()
                });
              }
            }
          }
        } else if (!wasActive && isNowActive) {
          // Deducting stock (Non-active -> Active)
          for (const ingredient of newBatch.ingredients) {
            const rawMaterialRef = doc(db, 'rawMaterials', ingredient.materialId);
            const rawMaterialSnap = await getDoc(rawMaterialRef);
            if (rawMaterialSnap.exists()) {
              const currentStock = rawMaterialSnap.data().currentStock || 0;
              const newStock = Math.max(0, currentStock - ingredient.quantity);
              await updateDoc(rawMaterialRef, { currentStock: newStock });
              
              await addDoc(collection(db, 'stockMovements'), {
                itemId: ingredient.materialId,
                itemName: rawMaterialSnap.data().name,
                itemType: 'material',
                type: 'out',
                quantity: ingredient.quantity,
                previousStock: currentStock,
                newStock: newStock,
                reason: 'production_started',
                referenceId: batchId,
                userId: profile?.id || 'system',
                userName: profile?.name || 'System',
                timestamp: new Date().toISOString()
              });
            }
          }
        } else if (wasActive && isNowActive) {
          // Adjusting stock if quantities or ingredients changed
          // We calculate the net difference per material to record accurate movements
          const oldIngredients = selectedBatch.ingredients || [];
          const newIngredients = newBatch.ingredients || [];
          
          // Get all material IDs involved
          const allMaterialIds = Array.from(new Set([
            ...oldIngredients.map(i => i.materialId),
            ...newIngredients.map(i => i.materialId)
          ]));

          for (const materialId of allMaterialIds) {
            const oldQty = oldIngredients.find(i => i.materialId === materialId)?.quantity || 0;
            const newQty = newIngredients.find(i => i.materialId === materialId)?.quantity || 0;
            
            if (oldQty !== newQty) {
              const diff = newQty - oldQty; // Positive means we need to deduct more
              const rawMaterialRef = doc(db, 'rawMaterials', materialId);
              const rawMaterialSnap = await getDoc(rawMaterialRef);
              
              if (rawMaterialSnap.exists()) {
                const currentStock = rawMaterialSnap.data().currentStock || 0;
                const newStock = Math.max(0, currentStock - diff);
                await updateDoc(rawMaterialRef, { currentStock: newStock });
                
                // Record movement for the adjustment
                await addDoc(collection(db, 'stockMovements'), {
                  itemId: materialId,
                  itemName: rawMaterialSnap.data().name,
                  itemType: 'material',
                  type: diff > 0 ? 'out' : 'in',
                  quantity: Math.abs(diff),
                  previousStock: currentStock,
                  newStock: newStock,
                  reason: 'production_adjustment',
                  referenceId: batchId,
                  userId: profile?.id || 'system',
                  userName: profile?.name || 'System',
                  timestamp: new Date().toISOString()
                });
              }
            }
          }
        }

        // --- NEW: Sync finished product stock if status changed to/from completed ---
        const wasCompleted = selectedBatch.status === 'completed';
        const isNowCompleted = newBatch.status === 'completed';
        
        if (wasCompleted !== isNowCompleted) {
          const product = products.find(p => p.id === newBatch.productId);
          if (product) {
            const productRef = doc(db, 'products', product.id);
            const location = newBatch.location || 'shop';
            const qty = Number(newBatch.plannedQty);
            
            if (!wasCompleted && isNowCompleted) {
              // Now completed -> Add stock
              const currentStock = product.stock || 0;
              const newTotalStock = currentStock + qty;
              const updateFields: any = { 
                stock: newTotalStock,
                status: location === 'freezer' ? 'frozen' : 'none'
              };
              if (location === 'shop') {
                updateFields.shopStock = (product.shopStock || 0) + qty;
              } else {
                updateFields.freezerStock = (product.freezerStock || 0) + qty;
              }
              await updateDoc(productRef, updateFields);
              
              await addDoc(collection(db, 'stockMovements'), {
                itemId: product.id,
                itemName: product.name,
                itemType: 'product',
                type: 'in',
                quantity: qty,
                previousStock: currentStock,
                newStock: newTotalStock,
                location: location,
                reason: 'production',
                referenceId: batchId,
                userId: profile?.id || 'system',
                userName: profile?.name || 'System',
                timestamp: new Date().toISOString()
              });
            } else if (wasCompleted && !isNowCompleted) {
              // Status moved away from completed -> Revert stock
              const currentStock = product.stock || 0;
              const newTotalStock = Math.max(0, currentStock - qty);
              const updateFields: any = { stock: newTotalStock };
              
              const oldLocation = (selectedBatch as any).location || 'shop';
              if (oldLocation === 'shop') {
                updateFields.shopStock = Math.max(0, (product.shopStock || 0) - qty);
              } else {
                updateFields.freezerStock = Math.max(0, (product.freezerStock || 0) - qty);
              }
              await updateDoc(productRef, updateFields);
              
              await addDoc(collection(db, 'stockMovements'), {
                itemId: product.id,
                itemName: product.name,
                itemType: 'product',
                type: 'out',
                quantity: qty,
                previousStock: currentStock,
                newStock: newTotalStock,
                location: oldLocation,
                reason: 'cancellation',
                referenceId: batchId,
                userId: profile?.id || 'system',
                userName: profile?.name || 'System',
                timestamp: new Date().toISOString()
              });
            }
          }
        }
        // --- END NEW ---

        // Update the batch
        await updateDoc(doc(db, 'batches', selectedBatch.id), {
          productId: newBatch.productId,
          recipeId: recipe?.id || '',
          plannedQty: Number(newBatch.plannedQty),
          ingredients: newBatch.ingredients,
          status: newBatch.status || selectedBatch.status,
          startDate: new Date(newBatch.startDate || Date.now()).toISOString(),
          location: newBatch.location || 'shop'
        });

        toast.success(t('batchUpdatedSuccessfully') || 'Batch updated successfully');
      } else {
        const batchRef = await addDoc(collection(db, 'batches'), {
          productId: newBatch.productId,
          recipeId: recipe?.id || '',
          plannedQty: Number(newBatch.plannedQty),
          ingredients: newBatch.ingredients,
          status: initialStatus,
          startDate: new Date(newBatch.startDate || Date.now()).toISOString(),
          createdBy: profile?.name || 'Unknown',
          location: newBatch.location || 'shop'
        });

        const batchId = batchRef.id;

        // If created with active status, deduct stock immediately
        if (initialStatus === 'started') {
          for (const ing of newBatch.ingredients || []) {
            const rawMaterialRef = doc(db, 'rawMaterials', ing.materialId);
            const rawMaterialSnap = await getDoc(rawMaterialRef);
            if (rawMaterialSnap.exists()) {
              const currentStock = rawMaterialSnap.data().currentStock || 0;
              const newStock = Math.max(0, currentStock - ing.quantity);
              await updateDoc(rawMaterialRef, { currentStock: newStock });
              
              // Record movement
              await addDoc(collection(db, 'stockMovements'), {
                itemId: ing.materialId,
                itemName: rawMaterialSnap.data().name,
                itemType: 'material',
                type: 'out',
                quantity: ing.quantity,
                previousStock: currentStock,
                newStock: newStock,
                reason: 'production',
                referenceId: batchId,
                userId: profile?.id || 'system',
                userName: profile?.name || 'System',
                timestamp: new Date().toISOString()
              });
            }
          }
        }

        // If created as completed, also add products
        if (initialStatus === 'completed') {
          const product = products.find(p => p.id === newBatch.productId);
          if (product) {
            const productRef = doc(db, 'products', product.id);
            const location = newBatch.location || 'shop';
            const qty = Number(newBatch.plannedQty);
            const newShopStock = location === 'shop' ? (product.shopStock || 0) + qty : (product.shopStock || 0);
            const newFrozenStock = location === 'freezer' ? (product.freezerStock || 0) + qty : (product.freezerStock || 0);

            const updateFields: any = {
              stock: (product.stock || 0) + qty,
              status: newShopStock === 0 && newFrozenStock > 0 ? 'frozen' : 'none',
              shopStock: newShopStock,
              freezerStock: newFrozenStock
            };
            
            await updateDoc(productRef, updateFields);

            // Record movement
            await addDoc(collection(db, 'stockMovements'), {
              itemId: product.id,
              itemName: product.name,
              itemType: 'product',
              type: 'in',
              quantity: Number(newBatch.plannedQty),
              previousStock: product.stock || 0,
              newStock: (product.stock || 0) + Number(newBatch.plannedQty),
              location: location,
              reason: 'production',
              referenceId: batchId,
              userId: profile?.id || 'system',
              userName: profile?.name || 'System',
              timestamp: new Date().toISOString()
            });
          }
        }

        toast.success(t('batchCreatedSuccessfully') || 'Batch created successfully');
      }

      setIsModalOpen(false);
      setIsEditingBatch(false);
      setSelectedBatch(null);
      setError(null);
      setNewBatch({ productId: '', recipeId: '', plannedQty: 0, ingredients: [] });
      
    } catch (err) {
      console.error('Error saving batch:', err);
      setError(t('errorCreatingBatch') || 'Error saving batch');
    }
  };

  const updateBatchStatus = async (id: string, status: ProductionBatch['status'], distribution?: { shop: number; frozen: number; waste: number }) => {
    try {
      const batchRef = doc(db, 'batches', id);
      const batch = batches.find(b => b.id === id);
      if (!batch) return;

      const previousStatus = batch.status;
      const updateData: any = { status };

      if (status === 'completed' || status === 'started') {
        const needsMaterialDeduction = previousStatus === 'cancelled';
        
        if (needsMaterialDeduction) {
          const insufficient = [];
          for (const ing of batch.ingredients || []) {
            const material = rawMaterials.find(m => m.id === ing.materialId);
            if (!material || material.currentStock < ing.quantity) {
              insufficient.push({
                name: material ? tProduct(material) : t('unknownMaterial'),
                short: ing.quantity - (material?.currentStock || 0),
                unit: material?.unit || ''
              });
            }
          }

          if (insufficient.length > 0) {
            const message = insufficient.map(i => `${i.name}: -${i.short.toFixed(2)} ${t(i.unit)}`).join(', ');
            toast.error(`${t('insufficientStock')}: ${message}`, { duration: 5000 });
            return;
          }

          // Deduct stock now
          for (const ing of batch.ingredients || []) {
            const rawMaterialRef = doc(db, 'rawMaterials', ing.materialId);
            const rawMaterialSnap = await getDoc(rawMaterialRef);
            if (rawMaterialSnap.exists()) {
              const currentStock = rawMaterialSnap.data().currentStock || 0;
              const newStock = Math.max(0, currentStock - ing.quantity);
              await updateDoc(rawMaterialRef, { currentStock: newStock });
              
              // Record movement
              await addDoc(collection(db, 'stockMovements'), {
                itemId: ing.materialId,
                itemName: rawMaterialSnap.data().name,
                itemType: 'material',
                type: 'out',
                quantity: ing.quantity,
                previousStock: currentStock,
                newStock: newStock,
                reason: 'production',
                referenceId: id,
                userId: profile?.id || 'system',
                userName: profile?.name || 'System',
                timestamp: new Date().toISOString()
              });
            }
          }
        }
      }

      if (status === 'started') {
        if (!batch.startDate) {
          updateData.startDate = new Date().toISOString();
        }
      }
      
      if (status === 'completed') {
        updateData.endDate = new Date().toISOString();

        // Update product stock with distribution
        const product = products.find(p => p.id === batch.productId);
        if (product) {
          const productRef = doc(db, 'products', product.id);
          const dist = distribution || { shop: batch.plannedQty, frozen: 0, waste: 0 };
          // stock = shopStock + freezerStock + wasteQuantity (invariant)
          // Production adds to all three; waste goes to wasteQuantity, not lost
          const newShopStock = (product.shopStock || 0) + dist.shop;
          const newFrozenStock = (product.freezerStock || 0) + dist.frozen;
          const newWasteQuantity = (product.wasteQuantity || 0) + dist.waste;
          const newTotalStock = newShopStock + newFrozenStock + newWasteQuantity;

          // Determine status: frozen only if ALL sellable stock is in freezer
          const productStatus = newShopStock === 0 && newFrozenStock > 0 ? 'frozen' : 'none';

          const updateFields: any = {
            stock: newTotalStock,
            shopStock: newShopStock,
            freezerStock: newFrozenStock,
            wasteQuantity: newWasteQuantity,
            status: productStatus
          };


          await updateDoc(productRef, updateFields);

          // Record stock movement for shop
          if (dist.shop > 0) {
            await addDoc(collection(db, 'stockMovements'), {
              itemId: product.id,
              itemName: product.name,
              itemType: 'product',
              type: 'in',
              quantity: dist.shop,
              previousStock: product.stock || 0,
              newStock: newTotalStock,
              location: 'shop',
              reason: 'production',
              referenceId: id,
              userId: profile?.id || 'system',
              userName: profile?.name || 'System',
              timestamp: new Date().toISOString()
            });
          }

          // Record stock movement for frozen
          if (dist.frozen > 0) {
            await addDoc(collection(db, 'stockMovements'), {
              itemId: product.id,
              itemName: product.name,
              itemType: 'product',
              type: 'in',
              quantity: dist.frozen,
              previousStock: product.stock || 0,
              newStock: newTotalStock,
              location: 'freezer',
              reason: 'production',
              referenceId: id,
              userId: profile?.id || 'system',
              userName: profile?.name || 'System',
              timestamp: new Date().toISOString()
            });
          }

          // Record waste
          if (dist.waste > 0) {
            await addDoc(collection(db, 'stockMovements'), {
              itemId: product.id,
              itemName: product.name,
              itemType: 'product',
              type: 'out',
              quantity: dist.waste,
              previousStock: product.stock || 0,
              newStock: newTotalStock,
              location: 'none',
              reason: 'waste',
              referenceId: id,
              userId: profile?.id || 'system',
              userName: profile?.name || 'System',
              timestamp: new Date().toISOString()
            });
          }
        }
      }

      if (status === 'cancelled' && previousStatus !== 'cancelled') {
        // Return ingredients to inventory if it was started
        if (previousStatus === 'started') {
          if (batch.ingredients && batch.ingredients.length > 0) {
            for (const ingredient of batch.ingredients) {
              const rawMaterialRef = doc(db, 'rawMaterials', ingredient.materialId);
              const rawMaterialSnap = await getDoc(rawMaterialRef);
              if (rawMaterialSnap.exists()) {
                const currentStock = rawMaterialSnap.data().currentStock || 0;
                const newStock = currentStock + ingredient.quantity;
                await updateDoc(rawMaterialRef, { currentStock: newStock });

                // Record movement
                await addDoc(collection(db, 'stockMovements'), {
                  itemId: ingredient.materialId,
                  itemName: rawMaterialSnap.data().name,
                  itemType: 'material',
                  type: 'in',
                  quantity: ingredient.quantity,
                  previousStock: currentStock,
                  newStock: newStock,
                  reason: 'cancellation',
                  referenceId: id,
                  userId: profile?.id || 'system',
                  userName: profile?.name || 'System',
                  timestamp: new Date().toISOString()
                });
              }
            }
          }
        }
      }

      await updateDoc(batchRef, updateData);
      toast.success(t('batchStatusUpdated') || 'Batch status updated');

      if (profile) {
        const p = products.find(prod => prod.id === batch.productId);
        logActivity(profile.id, profile.name, 'Production', `Batch for ${p?.name || 'Unknown'} updated to ${status}`);
      }
    } catch (err) {
      console.error('Error updating batch status:', err);
      toast.error(t('errorUpdatingBatchStatus') || 'Error updating batch status');
    }
  };

  const getStatusColor = (status: ProductionBatch['status']) => {
    switch (status) {
      case 'started': return 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400';
      case 'completed': return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400';
      case 'cancelled': return 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400';
      default: return 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-slate-400';
    }
  };

  const filteredBatches = batches.filter(batch => {
    const product = products.find(p => p.id === batch.productId);
    // Exclude raw materials from product search
    if (product?.category === 'raw_material') return false;
    
    const matchesSearch = (() => {
      if (!product) return false;
      const q = searchTerm.toLowerCase().trim();
      if (!q) return true;
      const blob = [product.name, product.nameAr].filter(Boolean).join(' ').toLowerCase();
      return blob.includes(q);
    })();
    return matchesSearch;
  });

  const uniqueCreators = Array.from(new Set(batches.map(b => b.createdBy).filter(Boolean)));

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setUserFilter('All');
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white">{t('production')}</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">{t('productionDesc')}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
            <button 
              onClick={() => setViewMode('list')}
              className={clsx(
                "p-2 rounded-lg transition-all",
                viewMode === 'list' ? "bg-slate-900 dark:bg-primary-600 text-white shadow-md" : "text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400"
              )}
              title={t('listView')}
            >
              <LayoutList className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setViewMode('card')}
              className={clsx(
                "p-2 rounded-lg transition-all",
                viewMode === 'card' ? "bg-slate-900 dark:bg-primary-600 text-white shadow-md" : "text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400"
              )}
              title={t('cardView')}
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
          </div>
          <button onClick={() => { setIsModalOpen(true); setError(null); }} className="btn-primary gap-2 w-full sm:w-auto justify-center">
            <Plus className="w-5 h-5" />
            {t('addBatch')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <div className="card flex flex-col lg:flex-row items-stretch lg:items-center gap-4 py-4 border-slate-100 dark:border-white/10">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600 w-5 h-5" />
              <input 
                type="text" 
                placeholder={t('search')} 
                className="input pl-12 bg-slate-50/50 dark:bg-zinc-900/50 border-none w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-3">
              <select 
                className="input py-2 bg-slate-50/50 dark:bg-zinc-900/50 border-none text-sm font-bold min-w-[150px]"
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
              >
                <option value="All">{t('allUsers')}</option>
                {uniqueCreators.map(user => (
                  <option key={user} value={user}>{user}</option>
                ))}
              </select>
              <select 
                className="input py-2 bg-slate-50/50 dark:bg-zinc-900/50 border-none text-sm font-bold"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">{t('allStatuses')}</option>
                <option value="started">{t('started')}</option>
                <option value="completed">{t('completed')}</option>
                <option value="cancelled">{t('cancelled')}</option>
              </select>
              <button 
                onClick={resetFilters}
                className="btn-secondary gap-2 justify-center"
              >
                <RefreshCcw className="w-4 h-4" />
                {t('reset')}
              </button>
            </div>
          </div>

          {viewMode === 'card' ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredBatches.map((batch) => {
                  const product = products.find(p => p.id === batch.productId);
                  return (
                    <div key={batch.id} className="card group hover:shadow-xl transition-all duration-300 border-slate-100 dark:border-white/10">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 flex items-center justify-center">
                            <ChefHat className="w-6 h-6" />
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-900 dark:text-white">{product ? tProduct(product) : 'Unknown Product'}</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">{tCategory(product?.category || '')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedBatch(batch);
                              setIsEditingBatch(true);
                              setIsModalOpen(true);
                            }}
                            className="p-2 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-all"
                            title={t('edit')}
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                          {(profile?.role === 'admin' || profile?.role === 'manager' || profile?.role === 'baker') && (
                            <button 
                              onClick={() => handleDeleteBatch(batch)} 
                              className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                              title={t('delete')}
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          )}
                          <div className={clsx("px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider", getStatusColor(batch.status))}>
                            {t(batch.status)}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900">
                          <p className="text-[10px] text-slate-400 dark:text-slate-600 font-bold uppercase mb-1">{t('plannedQty')}</p>
                          <p className="text-lg font-display font-bold text-slate-900 dark:text-white">{batch.plannedQty} <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{t('units')}</span></p>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900 overflow-hidden">
                          <p className="text-[10px] text-slate-400 dark:text-slate-600 font-bold uppercase mb-1">{t('startDate')}</p>
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{format(new Date(batch.startDate), 'dd/MM HH:mm')}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {batch.status === 'started' && (
                          <button
                            onClick={() => {
                              setBatchToComplete(batch);
                              setDistribution({ shop: batch.plannedQty, frozen: 0, waste: 0 });
                              setIsDistributionModalOpen(true);
                            }}
                            className="flex-1 btn bg-emerald-600 text-white hover:bg-emerald-700 gap-2 justify-center"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            {t('completeProduction')}
                          </button>
                        )}
                        {batch.status !== 'completed' && batch.status !== 'cancelled' && (
                          <button 
                            onClick={() => updateBatchStatus(batch.id, 'cancelled')}
                            className="w-11 h-11 flex items-center justify-center rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all shrink-0"
                          >
                            <XCircle className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <Pagination 
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          ) : (
            <div className="card p-0 overflow-hidden border-slate-100 dark:border-white/10">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-slate-400 dark:text-slate-600 text-[10px] font-bold uppercase tracking-widest border-b border-slate-100 dark:border-white/10">
                      <th className="px-4 py-5 whitespace-nowrap">{t('product')}</th>
                      <th className="px-4 py-5 whitespace-nowrap text-center">{t('plannedQty')}</th>
                      <th className="px-4 py-5 whitespace-nowrap text-center">{t('status')}</th>
                      <th className="px-2 py-5 whitespace-nowrap text-center">{t('startDate')}</th>
                      <th className="px-2 py-5 whitespace-nowrap text-center">{t('createdBy')}</th>
                      <th className="px-4 py-5 text-right whitespace-nowrap min-w-[120px]">{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-white/10">
                    {filteredBatches.map((batch) => {
                      const product = products.find(p => p.id === batch.productId);
                      const productName = product ? tProduct(product) : 'Unknown';
                      return (
                        <tr key={batch.id} className="group hover:bg-primary-50/[0.02] dark:hover:bg-primary-900/[0.05] transition-all">
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0 shadow-sm">
                                <ChefHat className="w-5 h-5" />
                              </div>
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-900 dark:text-white whitespace-nowrap text-sm leading-tight">{productName}</span>
                                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-600 mt-0.5">{tCategory(product?.category || '')}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className="font-display font-bold text-slate-900 dark:text-white text-base tracking-tight">{batch.plannedQty}</span>
                            <span className="ml-1 text-[9px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-wider">{t('units')}</span>
                          </td>
                          <td className="px-2 py-4 text-center">
                            <span className={clsx("px-3 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest inline-flex shadow-sm", getStatusColor(batch.status))}>
                              {t(batch.status)}
                            </span>
                          </td>
                          <td className="px-2 py-4 text-center whitespace-nowrap">
                            <div className="flex flex-col items-center">
                              <span className="font-bold text-slate-900 dark:text-white text-xs">{format(new Date(batch.startDate), 'dd/MM')}</span>
                              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-600 uppercase mt-0.5">{format(new Date(batch.startDate), 'HH:mm')}</span>
                            </div>
                          </td>
                          <td className="px-2 py-4 text-center">
                            <span className="font-bold text-slate-600 dark:text-slate-400 text-xs">{batch.createdBy || '-'}</span>
                          </td>
                          <td className="px-4 py-4 text-right min-w-[120px]">
                            <div className="flex items-center justify-end gap-2 px-1">
                              <button 
                                onClick={() => {
                                  setSelectedBatch(batch);
                                  setIsEditingBatch(true);
                                  setIsModalOpen(true);
                                }} 
                                className="w-9 h-9 flex items-center justify-center text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-xl transition-all border border-slate-100 dark:border-white/5 shadow-sm bg-white dark:bg-zinc-800"
                                title={t('edit')}
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              
                              {batch.status === 'started' && (
                                <>
                                  <button 
                                    onClick={() => updateBatchStatus(batch.id, 'completed')} 
                                    className="w-9 h-9 flex items-center justify-center text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-md shadow-emerald-600/20 active:scale-95"
                                    title={t('completeProduction')}
                                  >
                                    <CheckCircle2 className="w-5 h-5" />
                                  </button>
                                  <button 
                                    onClick={() => updateBatchStatus(batch.id, 'cancelled')} 
                                    className="w-9 h-9 flex items-center justify-center text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-xl transition-all border border-red-100 dark:border-red-900/30 shadow-sm"
                                    title={t('cancelled')}
                                  >
                                    <XCircle className="w-5 h-5" />
                                  </button>
                                </>
                              )}
                              
                              {(profile?.role === 'admin' || profile?.role === 'manager' || profile?.role === 'baker') && (
                                <button 
                                  onClick={() => handleDeleteBatch(batch)} 
                                  className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-red-600 dark:text-slate-600 dark:hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                                  title={t('delete')}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
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
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="card border-slate-100 dark:border-white/10">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">{t('productionStats')}</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-medium">{t('completedToday')}</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">12</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-medium">{t('activeNow')}</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">4</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-medium">{t('efficiency')}</span>
                <span className="font-bold text-primary-600 dark:text-primary-400">94%</span>
              </div>
            </div>
          </div>

          <div className="card bg-slate-900 dark:bg-zinc-900 text-white border-slate-800 dark:border-white/10">
            <Zap className="w-10 h-10 mb-4 text-primary-400" />
            <h3 className="text-lg font-bold mb-2">Recipe Optimization</h3>
            <p className="text-slate-400 dark:text-slate-500 text-sm mb-4">Your "Croissant" recipe could be optimized for 15% less waste.</p>
            <button className="w-full py-2 bg-primary-500/10 hover:bg-primary-500/20 text-primary-400 rounded-xl text-sm font-bold transition-all border border-primary-500/20">
              View Insights
            </button>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="card w-full max-w-2xl shadow-2xl border-slate-100 dark:border-white/10 my-auto">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
              {isEditingBatch ? t('editBatch') : t('addBatch')}
            </h2>
            <form onSubmit={handleAddBatch} className="space-y-6">
              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl flex items-center gap-3 text-red-600 dark:text-red-400 animate-shake">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p className="text-sm font-bold">{error}</p>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-2">{t('product')}</label>
                  <select 
                    className="input"
                    value={newBatch.productId || ''}
                    onChange={(e) => setNewBatch({
                      ...newBatch, 
                      productId: e.target.value, 
                      ingredients: [], 
                      plannedQty: 0,
                      recipeId: ''
                    })}
                    required
                    disabled={isEditingBatch}
                  >
                    <option value="">{t('selectProduct')}</option>
                    {products
                      .filter(p => p.itemType === 'product')
                      .map(p => <option key={p.id} value={p.id}>{tProduct(p)}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-2">{t('plannedQty')}</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      className="input pr-12 bg-white dark:bg-zinc-900 border-slate-200 dark:border-white/10 font-bold text-lg"
                      value={newBatch.plannedQty || ''}
                      onChange={(e) => handlePlannedQtyChange(Number(e.target.value))}
                      min="1"
                      required
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 dark:text-slate-600 uppercase">{t('units')}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-[10px] text-slate-400 dark:text-slate-600 italic">{t('updatesIngredientsAutomatically')}</p>
                    {newBatch.productId && (
                      <p className="text-[10px] font-bold text-primary-600 dark:text-primary-400">
                        {t('maxPossible')}: {getMaxPossible()} {t('units')}
                      </p>
                    )}
                  </div>
                </div>
              </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-2">{t('startDate')}</label>
                  <input 
                    type="datetime-local" 
                    className="input"
                    value={newBatch.startDate || ''}
                    onChange={(e) => setNewBatch({...newBatch, startDate: e.target.value})}
                    required
                  />
                </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-2">{t('location')}</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setNewBatch({...newBatch, location: 'shop'})}
                    className={clsx(
                      "p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2",
                      newBatch.location === 'shop'
                        ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400"
                        : "border-slate-100 dark:border-white/5 bg-white dark:bg-zinc-900 text-slate-400 dark:text-slate-600 hover:border-slate-200 dark:hover:border-white/10"
                    )}
                  >
                    <Store className="w-6 h-6" />
                    <span className="text-xs font-bold uppercase tracking-widest">{t('shop')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewBatch({...newBatch, location: 'freezer'})}
                    className={clsx(
                      "p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2",
                      newBatch.location === 'freezer'
                        ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400"
                        : "border-slate-100 dark:border-white/5 bg-white dark:bg-zinc-900 text-slate-400 dark:text-slate-600 hover:border-slate-200 dark:hover:border-white/10"
                    )}
                  >
                    <Snowflake className="w-6 h-6" />
                    <span className="text-xs font-bold uppercase tracking-widest">{t('freezer')}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-2">{t('status')}</label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewBatch({...newBatch, status: 'started'})}
                    className={clsx(
                      "py-3 px-2 rounded-xl border-2 font-bold text-xs transition-all uppercase tracking-wider flex items-center justify-center gap-2",
                      newBatch.status === 'started'
                        ? "border-amber-500 bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400"
                        : "border-slate-100 dark:border-white/5 bg-white dark:bg-zinc-900 text-slate-400 dark:text-slate-600 hover:border-slate-200"
                    )}
                  >
                    <Play className="w-3 h-3" />
                    {t('started')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewBatch({...newBatch, status: 'completed'})}
                    className={clsx(
                      "py-3 px-2 rounded-xl border-2 font-bold text-xs transition-all uppercase tracking-wider flex items-center justify-center gap-2",
                      newBatch.status === 'completed'
                        ? "border-emerald-500 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
                        : "border-slate-100 dark:border-white/5 bg-white dark:bg-zinc-900 text-slate-400 dark:text-slate-600 hover:border-slate-200"
                    )}
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    {t('completed')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewBatch({...newBatch, status: 'cancelled'})}
                    className={clsx(
                      "py-3 px-2 rounded-xl border-2 font-bold text-xs transition-all uppercase tracking-wider flex items-center justify-center gap-2",
                      newBatch.status === 'cancelled'
                        ? "border-red-500 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
                        : "border-slate-100 dark:border-white/5 bg-white dark:bg-zinc-900 text-slate-400 dark:text-slate-600 hover:border-slate-200"
                    )}
                  >
                    <XCircle className="w-3 h-3" />
                    {t('cancelled')}
                  </button>
                </div>
              </div>

              {newBatch.productId && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <ChefHat className="w-4 h-4" />
                      {t('ingredients')}
                    </h3>
                    <button 
                      type="button" 
                      onClick={addIngredient}
                      className="text-xs font-bold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      {t('addIngredient')}
                    </button>
                  </div>
                  
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                    {newBatch.ingredients.length === 0 ? (
                      <div className="p-8 text-center bg-slate-50 dark:bg-zinc-900 rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/10">
                        <p className="text-sm text-slate-400 dark:text-slate-600">{t('noIngredientsDefined')}</p>
                      </div>
                    ) : (
                      newBatch.ingredients.map((ing, idx) => {
                        const material = rawMaterials.find(m => m.id === ing.materialId);
                        const isShort = isShortValue(ing);
                        
                        return (
                          <div key={idx} className="flex flex-col sm:flex-row gap-3 p-4 bg-slate-50 dark:bg-zinc-900 rounded-xl border border-slate-100 dark:border-white/10 relative group">
                            <div className="flex-1">
                              <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase mb-1">{t('rawMaterial')}</label>
                              <select
                                className="input py-1.5 text-sm dark:bg-zinc-900 dark:border-white/10"
                                value={ing.materialId || ''}
                                onChange={(e) => handleIngredientChange(idx, 'materialId', e.target.value)}
                                required
                              >
                                <option value="">{t('selectMaterial') || 'Select Material'}</option>
                                  {rawMaterials
                                    .filter(m => !m.disabled && !newBatch.ingredients.some((otherIng, otherIdx) => otherIdx !== idx && otherIng.materialId === m.id))
                                    .sort((a, b) => a.name.localeCompare(b.name))
                                    .map(m => (
                                    <option key={m.id} value={m.id}>
                                      {tProduct(m)} {m.brand ? `(${m.brand})` : ''} - {m.currentStock} {t(m.unit) || m.unit}
                                    </option>
                                  ))}
                              </select>
                            </div>
                            <div className="w-full sm:w-40">
                                <div className="flex justify-between items-center mb-1 gap-2">
                                  <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase whitespace-nowrap">{t('totalQuantity')}</label>
                                  {material && (
                                    <span className={clsx(
                                      "text-[9px] font-bold whitespace-nowrap",
                                      isShort ? "text-red-500" : "text-primary-600 dark:text-primary-400"
                                    )}>
                                      {t('available')}: {material.currentStock}
                                    </span>
                                  )}
                                </div>
                              <div className="relative">
                                <input
                                  type="number"
                                  className={clsx(
                                    "input py-1.5 text-sm pr-12 dark:bg-zinc-900",
                                    isShort && "border-red-300 dark:border-red-900/30 bg-red-50 dark:bg-red-900/20"
                                  )}
                                  value={ing.quantity || ''}
                                  onChange={(e) => handleIngredientChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                                  required
                                  min="0"
                                  step="0.001"
                                />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase">
                                  {t(material?.unit || '')}
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeIngredient(idx)}
                              className="absolute -right-2 -top-2 w-6 h-6 bg-white dark:bg-zinc-900 shadow-md rounded-full flex items-center justify-center text-red-500 opacity-0 group-hover:opacity-100 transition-all border border-slate-100 dark:border-white/10"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                            {isShort && (
                              <div className="absolute left-4 -bottom-2 px-2 py-0.5 bg-red-500 text-white text-[8px] font-bold rounded uppercase tracking-wider shadow-sm">
                                {t('insufficientStock')}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-100 dark:border-white/10">
                {isEditingBatch && (profile?.role === 'admin' || profile?.role === 'manager' || profile?.role === 'baker') && (
                  <button 
                    type="button" 
                    onClick={() => handleDeleteBatch(selectedBatch!)} 
                    className="btn-secondary text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-100 dark:border-red-900/30"
                  >
                    <Trash2 className="w-4 h-4" />
                    {t('delete')}
                  </button>
                )}
                <div className="flex-1 flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => {
                      setIsModalOpen(false);
                      setIsEditingBatch(false);
                      setSelectedBatch(null);
                    }} 
                    className="flex-1 btn-secondary justify-center"
                  >
                    {t('cancel')}
                  </button>
                  <button 
                    type="submit" 
                    disabled={newBatch.plannedQty <= 0}
                    className="flex-1 btn-primary justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isEditingBatch ? t('updateBatch') : t('save')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Distribution Modal */}
      {isDistributionModalOpen && batchToComplete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-md p-6 shadow-2xl border-slate-100 dark:border-white/10 bg-white dark:bg-zinc-900">
            <h2 className="text-2xl font-bold mb-1 text-slate-900 dark:text-white">{t('completeProduction')}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              {t('distribute')} {batchToComplete.plannedQty} {t('units')}
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                  <Store className="w-4 h-4 inline mr-2" />
                  {t('shopStock')} <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    max={batchToComplete.plannedQty}
                    className="input flex-1"
                    value={distribution.shop}
                    onChange={(e) => {
                      const val = Math.max(0, Number(e.target.value));
                      const remaining = batchToComplete.plannedQty - val;
                      setDistribution({ shop: val, frozen: Math.max(0, Math.min(remaining, distribution.frozen)), waste: Math.max(0, batchToComplete.plannedQty - val - Math.max(0, Math.min(remaining, distribution.frozen))) });
                    }}
                  />
                  <span className="text-xs font-bold text-slate-500">{t('units')}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                  <Snowflake className="w-4 h-4 inline mr-2" />
                  {t('freezerStock')} <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    max={batchToComplete.plannedQty - distribution.shop}
                    className="input flex-1"
                    value={distribution.frozen}
                    onChange={(e) => {
                      const val = Math.max(0, Number(e.target.value));
                      const available = batchToComplete.plannedQty - distribution.shop;
                      setDistribution({ shop: distribution.shop, frozen: Math.min(available, val), waste: Math.max(0, batchToComplete.plannedQty - distribution.shop - Math.min(available, val)) });
                    }}
                  />
                  <span className="text-xs font-bold text-slate-500">{t('units')}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                  {t('waste')}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    max={batchToComplete.plannedQty - distribution.shop - distribution.frozen}
                    className="input flex-1"
                    value={distribution.waste}
                    onChange={(e) => {
                      const val = Math.max(0, Number(e.target.value));
                      const available = batchToComplete.plannedQty - distribution.shop - distribution.frozen;
                      setDistribution({ shop: distribution.shop, frozen: distribution.frozen, waste: Math.min(available, val) });
                    }}
                  />
                  <span className="text-xs font-bold text-slate-500">{t('units')}</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-white/10">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{t('total')}</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{distribution.shop + distribution.frozen + distribution.waste} / {batchToComplete.plannedQty} {t('units')}</span>
                </div>
                {distribution.shop + distribution.frozen + distribution.waste !== batchToComplete.plannedQty && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">{batchToComplete.plannedQty - (distribution.shop + distribution.frozen + distribution.waste)} {t('units')} not assigned</p>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setIsDistributionModalOpen(false);
                  setBatchToComplete(null);
                }}
                className="flex-1 btn-secondary justify-center"
              >
                {t('cancel')}
              </button>
              <button
                onClick={async () => {
                  if (distribution.shop + distribution.frozen + distribution.waste !== batchToComplete.plannedQty) {
                    toast.error('Distribution total must equal batch quantity');
                    return;
                  }
                  await updateBatchStatus(batchToComplete.id, 'completed', distribution);
                  setIsDistributionModalOpen(false);
                  setBatchToComplete(null);
                }}
                className="flex-1 btn-primary justify-center"
              >
                <CheckCircle2 className="w-4 h-4" />
                {t('complete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Production;
