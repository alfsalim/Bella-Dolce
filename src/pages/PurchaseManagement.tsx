import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import {
  Plus,
  Trash2,
  Edit2,
  Search,
  AlertCircle,
  ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';

interface Purchase {
  id: string;
  invoiceNumber: string;
  materialId: string;
  materialName: string;
  supplierId: string;
  supplierName: string;
  quantity: number;
  price: number;
  brand: string;
  purchaseDate: string;
  expiryDate: string;
  unit: string;
  totalAmount: number;
  createdAt: string;
  createdBy: string;
}

interface RawMaterial {
  id: string;
  name: string;
  currentStock: number;
  unit: string;
}

const PurchaseManagement: React.FC = () => {
  const { t, formatCurrency } = useLanguage();
  const { profile } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    materialId: '',
    supplierId: '',
    quantity: 0,
    price: 0,
    brand: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    expiryDate: ''
  });
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const getDefaultExpiryDate = () => {
    const date = new Date();
    date.setMonth(date.getMonth() + 3);
    return date.toISOString().split('T')[0];
  };

  // Check admin access
  if (profile && profile.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center text-red-600 mb-6">
          <AlertCircle className="w-10 h-10" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Access Denied</h1>
        <p className="text-slate-500 max-w-md">Only administrators can access purchase management.</p>
      </div>
    );
  }

  // Fetch purchases, materials, and suppliers
  useEffect(() => {
    fetchPurchases();
    fetchMaterials();
    fetchSuppliers();
  }, []);

  const fetchPurchases = async () => {
    try {
      const token = localStorage.getItem('bakery_token');
      const response = await fetch('/api/db/purchases', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch purchases');
      const data = await response.json();
      console.log('Fetched purchases:', data); // Debug log
      setPurchases(data || []);
    } catch (error) {
      console.error('Error fetching purchases:', error);
      toast.error('Failed to load purchases');
    } finally {
      setLoading(false);
    }
  };

  const fetchMaterials = async () => {
    try {
      const token = localStorage.getItem('bakery_token');
      const response = await fetch('/api/db/rawMaterials', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch materials');
      const data = await response.json();
      setMaterials(data || []);
    } catch (error) {
      console.error('Error fetching materials:', error);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const token = localStorage.getItem('bakery_token');
      const response = await fetch('/api/db/suppliers', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch suppliers');
      const data = await response.json();
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const updateInventory = async (
    materialId: string,
    quantityChange: number,
    operation: 'add' | 'subtract'
  ) => {
    try {
      const token = localStorage.getItem('bakery_token');

      // Fetch fresh material data instead of using stale state
      const freshResponse = await fetch(`/api/db/rawMaterials/${materialId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!freshResponse.ok) {
        console.warn(`Material not found: ${materialId}`);
        return;
      }
      const freshMaterial = await freshResponse.json();
      const currentStock = freshMaterial.currentStock || 0;

      const newStock = operation === 'add'
        ? currentStock + quantityChange
        : currentStock - quantityChange;

      const response = await fetch(`/api/db/rawMaterials/${materialId}`, {
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

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Inventory update error:', errorData);
        toast.error(`Inventory update failed: ${errorData.error}`);
        return;
      }

      // Update local materials list
      setMaterials(materials.map(m =>
        m.id === materialId
          ? { ...m, currentStock: newStock }
          : m
      ));
    } catch (error) {
      console.error('Error updating inventory:', error);
      toast.error(`Inventory sync error: ${error}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const material = materials.find(m => m.id === formData.materialId);
    if (!material) {
      toast.error('Please select a material');
      return;
    }

    if (!formData.supplierId) {
      toast.error('Please select a supplier');
      return;
    }

    const token = localStorage.getItem('bakery_token');

    try {
      // Upload PDF if provided
      let pdfPath: string | undefined;
      if (pdfFile) {
        const reader = new FileReader();
        await new Promise((resolve, reject) => {
          reader.onload = async () => {
            try {
              const base64 = (reader.result as string).split(',')[1];
              const uploadRes = await fetch('/api/upload/invoice', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ file: base64 })
              });
              if (!uploadRes.ok) throw new Error('Failed to upload PDF');
              const uploadData = await uploadRes.json();
              pdfPath = uploadData.path;
              resolve(null);
            } catch (error) {
              reject(error);
            }
          };
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(pdfFile);
        });
      }

      if (editingPurchase) {
        // UPDATE: Calculate quantity difference
        const quantityDifference = formData.quantity - editingPurchase.quantity;

        const supplier = suppliers.find(s => s.id === formData.supplierId);
        const response = await fetch(`/api/db/purchases/${editingPurchase.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            ...formData,
            materialName: material.name,
            supplierName: supplier?.name || 'Unknown Supplier',
            unit: material.unit,
            totalAmount: formData.price,
            ...(pdfPath && { invoicePdfPath: pdfPath }),
            updatedAt: new Date().toISOString()
          })
        });

        if (!response.ok) throw new Error('Failed to update purchase');

        // Update inventory if quantity changed (don't fail if it errors)
        if (quantityDifference !== 0) {
          try {
            if (quantityDifference > 0) {
              await updateInventory(formData.materialId, quantityDifference, 'add');
            } else {
              await updateInventory(formData.materialId, Math.abs(quantityDifference), 'subtract');
            }
          } catch (invError) {
            console.error('Inventory sync warning:', invError);
            // Don't fail the purchase update if inventory sync fails
          }
        }

        toast.success('Purchase updated successfully');
      } else {
        // CREATE: Add to inventory
        const supplier = suppliers.find(s => s.id === formData.supplierId);
        const purchaseData = {
          ...formData,
          materialName: material.name,
          supplierName: supplier?.name || 'Unknown Supplier',
          unit: material.unit,
          totalAmount: formData.price,
          ...(pdfPath && { invoicePdfPath: pdfPath }),
          createdAt: new Date().toISOString(),
          createdBy: profile?.id
        };

        const response = await fetch('/api/db/purchases', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(purchaseData)
        });

        if (!response.ok) throw new Error('Failed to create purchase');

        // Update inventory (don't fail if it errors)
        try {
          const material = materials.find(m => m.id === formData.materialId);
          if (material) {
            const previousStock = material.currentStock || 0;
            await updateInventory(formData.materialId, formData.quantity, 'add');
            const newStock = previousStock + formData.quantity;

            // Create stock movement record
            await fetch('/api/db/stockMovements', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({
                itemId: formData.materialId,
                itemName: material.name,
                itemType: 'material',
                type: 'in',
                quantity: formData.quantity,
                previousStock: previousStock,
                newStock: newStock,
                location: 'none',
                reason: 'purchase',
                userId: profile?.id || 'unknown',
                userName: profile?.name || 'Unknown User',
                timestamp: new Date().toISOString()
              })
            });
          }
        } catch (invError) {
          console.error('Inventory sync warning:', invError);
          // Don't fail the purchase creation if inventory sync fails
        }

        toast.success('Purchase created successfully');
      }

      setIsModalOpen(false);
      setEditingPurchase(null);
      setPdfFile(null);
      resetForm();
      fetchPurchases();
    } catch (error) {
      console.error('Error saving purchase:', error);
      toast.error(editingPurchase ? 'Failed to update purchase' : 'Failed to create purchase');
    }
  };

  const handleSyncToInventory = async (purchase: Purchase) => {
    try {
      const material = materials.find(m => m.id === purchase.materialId);
      if (!material) {
        toast.error(`Material not found: ${purchase.materialId}`);
        return;
      }

      const newStock = (material.currentStock || 0) + purchase.quantity;
      const token = localStorage.getItem('bakery_token');

      const response = await fetch(`/api/db/rawMaterials/${purchase.materialId}`, {
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

      if (!response.ok) {
        const errorData = await response.json();
        toast.error(`Sync failed: ${errorData.error || response.statusText}`);
        return;
      }

      // Create stock movement record
      try {
        const movementResponse = await fetch('/api/db/stockMovements', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            itemId: purchase.materialId,
            itemName: purchase.materialName,
            itemType: 'material',
            type: 'in',
            quantity: purchase.quantity,
            previousStock: material.currentStock || 0,
            newStock: newStock,
            location: 'none',
            reason: 'purchase',
            userId: profile?.id || 'unknown',
            userName: profile?.name || 'Unknown User',
            timestamp: new Date().toISOString()
          })
        });
        if (!movementResponse.ok) {
          console.warn('Failed to create stock movement');
        }
      } catch (movementError) {
        console.warn('Error creating stock movement:', movementError);
      }

      toast.success(`Synced ${purchase.quantity} ${purchase.unit} to inventory`);
      fetchMaterials();
    } catch (error) {
      toast.error(`Sync error: ${(error as Error).message}`);
    }
  };

  const handleDelete = async (purchase: Purchase) => {
    if (!confirm('Are you sure you want to delete this purchase? This will also decrease the material inventory.')) {
      return;
    }

    const token = localStorage.getItem('bakery_token');

    try {
      // Delete purchase
      const response = await fetch(`/api/db/purchases/${purchase.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to delete purchase');

      // Decrease inventory
      await updateInventory(purchase.materialId, purchase.quantity, 'subtract');

      toast.success('Purchase deleted successfully');
      fetchPurchases();
    } catch (error) {
      console.error('Error deleting purchase:', error);
      toast.error('Failed to delete purchase');
    }
  };

  const resetForm = () => {
    setFormData({
      materialId: '',
      supplierId: '',
      quantity: 0,
      price: 0,
      brand: '',
      purchaseDate: new Date().toISOString().split('T')[0],
      expiryDate: getDefaultExpiryDate()
    });
  };

  const handleEdit = (purchase: Purchase) => {
    setEditingPurchase(purchase);
    setFormData({
      materialId: purchase.materialId,
      supplierId: purchase.supplierId,
      quantity: purchase.quantity,
      price: purchase.price,
      brand: purchase.brand,
      purchaseDate: purchase.purchaseDate,
      expiryDate: purchase.expiryDate
    });
    setIsModalOpen(true);
  };

  const filteredPurchases = purchases.filter(p =>
    (p.materialName?.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (p.supplierName?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return <div className="flex items-center justify-center h-96">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
    </div>;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Purchase Management</h1>
          <p className="text-slate-500 mt-1">Manage purchases and inventory sync</p>
        </div>
        <button
          onClick={() => {
            setEditingPurchase(null);
            resetForm();
            setIsModalOpen(true);
          }}
          className="btn-primary gap-2 inline-flex"
        >
          <Plus className="w-5 h-5" />
          New Purchase
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Search by material, invoice number, or supplier..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input pl-12 w-full"
        />
      </div>

      {/* Purchases Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-100 dark:border-white/5">
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-600 dark:text-slate-300">Material</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-600 dark:text-slate-300">Supplier</th>
                <th className="px-6 py-4 text-right text-sm font-bold text-slate-600 dark:text-slate-300">Qty</th>
                <th className="px-6 py-4 text-right text-sm font-bold text-slate-600 dark:text-slate-300">Price</th>
                <th className="px-6 py-4 text-right text-sm font-bold text-slate-600 dark:text-slate-300">Total</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-600 dark:text-slate-300">Date</th>
                <th className="px-6 py-4 text-center text-sm font-bold text-slate-600 dark:text-slate-300">Invoice</th>
                <th className="px-6 py-4 text-center text-sm font-bold text-slate-600 dark:text-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPurchases.map((purchase) => (
                <tr key={purchase.id} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <td className="px-6 py-4 text-sm font-semibold text-slate-900 dark:text-white">{purchase.materialName}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{purchase.supplierName}</td>
                  <td className="px-6 py-4 text-sm text-right font-medium text-slate-900 dark:text-white">
                    {purchase.quantity} {purchase.unit}
                  </td>
                  <td className="px-6 py-4 text-sm text-right font-medium text-slate-900 dark:text-white">
                    {formatCurrency(purchase.price)}
                  </td>
                  <td className="px-6 py-4 text-sm text-right font-bold text-primary-600">
                    {formatCurrency(purchase.totalAmount)}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                    {purchase.purchaseDate ? new Date(purchase.purchaseDate).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {(purchase as any).invoicePdfPath ? (
                      <a
                        href={(purchase as any).invoicePdfPath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:underline text-sm font-medium"
                      >
                        📄 View
                      </a>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleSyncToInventory(purchase)}
                        className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-all"
                        title="Sync to Inventory"
                      >
                        ⤴️
                      </button>
                      <button
                        onClick={() => handleEdit(purchase)}
                        className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(purchase)}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredPurchases.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-500">No purchases found</p>
          </div>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-800/50">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {editingPurchase ? 'Edit Purchase' : 'New Purchase'}
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                      Material <span className="text-red-600">*</span>
                    </label>
                    <select
                      required
                      value={formData.materialId}
                      onChange={(e) => setFormData({ ...formData, materialId: e.target.value })}
                      className="input w-full"
                    >
                      <option value="">Select Material</option>
                      {materials.map(m => (
                        <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                      Supplier <span className="text-red-600">*</span>
                    </label>
                    <select
                      required
                      value={formData.supplierId}
                      onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                      className="input w-full"
                    >
                      <option value="">Select Supplier</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                      Quantity <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                      className="input w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                      Price <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                      className="input w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                      Brand
                    </label>
                    <input
                      type="text"
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      className="input w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                      Purchase Date <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.purchaseDate}
                      onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                      className="input w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                      Expiry Date
                    </label>
                    <input
                      type="date"
                      value={formData.expiryDate}
                      onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                      className="input w-full"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                      Invoice PDF (Optional, Max 2MB)
                    </label>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 2 * 1024 * 1024) {
                            toast.error('PDF file must be less than 2MB');
                            return;
                          }
                          setPdfFile(file);
                        }
                      }}
                      className="input w-full"
                    />
                    {pdfFile && (
                      <p className="text-sm text-slate-500 mt-1">Selected: {pdfFile.name}</p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-4 pt-6">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                  >
                    {editingPurchase ? 'Update' : 'Create'} Purchase
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PurchaseManagement;
