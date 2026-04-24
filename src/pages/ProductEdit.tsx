import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  ArrowLeft, 
  Save, 
  Trash2, 
  Plus, 
  X, 
  ChefHat, 
  Package, 
  Clock, 
  DollarSign,
  Info,
  Scale,
  Image as ImageIcon
} from 'lucide-react';
import { db, doc, getDoc, updateDoc, onSnapshot, collection, setDoc, deleteDoc } from '../lib/firebase';
import { Product, Recipe, RawMaterial, RecipeIngredient } from '../types';
import { clsx } from 'clsx';
import { CATEGORIES, UNITS, CURRENCY } from '../constants';
import { Percent, Hash } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { compressImage } from '../lib/utils';

const ProductEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, tProduct, tCategory, isRTL } = useLanguage();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;

    const unsubscribeProduct = onSnapshot(doc(db, 'products', id), (snapshot) => {
      if (snapshot.exists()) {
        setProduct({ id: snapshot.id, ...snapshot.data() } as Product);
      }
      setLoading(false);
    });

    const unsubscribeRecipe = onSnapshot(collection(db, 'recipes'), (snapshot) => {
      const found = snapshot.docs.find(doc => doc.data().productId === id);
      if (found) {
        setRecipe({ id: found.id, ...found.data() } as Recipe);
      }
    });

    const unsubscribeMaterials = onSnapshot(collection(db, 'rawMaterials'), (snapshot) => {
      setMaterials(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RawMaterial)));
    });

    return () => {
      unsubscribeProduct();
      unsubscribeRecipe();
      unsubscribeMaterials();
    };
  }, [id]);

  const handleDelete = async () => {
    if (!product || !id) return;
    if (window.confirm(t('confirmDelete') || 'Are you sure you want to delete this product?')) {
      try {
        setSaving(true);
        await deleteDoc(doc(db, 'products', id));
        
        // Delete associated recipe if it exists
        if (recipe) {
          await deleteDoc(doc(db, 'recipes', recipe.id));
        }

        // Delete from rawMaterials if it was synced
        await deleteDoc(doc(db, 'rawMaterials', id));

        toast.success(t('productDeleted') || 'Product deleted successfully');
        navigate('/inventory');
      } catch (error) {
        console.error("Delete error:", error);
        toast.error(t('errorDeletingProduct') || 'Error deleting product');
      } finally {
        setSaving(false);
      }
    }
  };

  const handleSave = async () => {
    if (!product || !id) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'products', id), { ...product });
      if (recipe) {
        await updateDoc(doc(db, 'recipes', recipe.id), { ...recipe });
      }

      // Sync to raw materials if category is 'raw_material'
      if (product.category === 'raw_material') {
        await setDoc(doc(db, 'rawMaterials', id), {
          name: product.name,
          category: 'raw_material',
          unit: 'units',
          currentStock: product.stock,
          minStock: product.minStock,
          imageUrl: product.imageUrl || '',
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }

      // Show success toast or redirect
      navigate('/inventory');
    } catch (error) {
      console.error("Save error:", error);
    } finally {
      setSaving(false);
    }
  };

  const addIngredient = () => {
    if (!recipe) return;
    const newIngredient: RecipeIngredient = { materialId: '', quantity: 0, type: 'weight' };
    setRecipe({ ...recipe, ingredients: [...recipe.ingredients, newIngredient] });
  };

  const removeIngredient = (index: number) => {
    if (!recipe) return;
    const newIngredients = [...recipe.ingredients];
    newIngredients.splice(index, 1);
    setRecipe({ ...recipe, ingredients: newIngredients });
  };

  const updateIngredient = (index: number, field: keyof RecipeIngredient, value: any) => {
    if (!recipe) return;
    const newIngredients = [...recipe.ingredients];
    newIngredients[index] = { ...newIngredients[index], [field]: value };
    setRecipe({ ...recipe, ingredients: newIngredients });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && product) {
      // Check file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        toast.error(t('imageTooLarge') || 'Image is too large (max 5MB)');
        return;
      }
      try {
        // Compress image to ensure it stays under Firestore 1MB limit
        const base64 = await compressImage(file, 800, 800, 0.6);
        setProduct({ ...product, imageUrl: base64 });
      } catch (error) {
        console.error("Error uploading image:", error);
        toast.error(t('errorUploadingImage') || 'Error uploading image');
      }
    }
  };

  if (loading) return <div className="h-96 flex items-center justify-center"><div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div></div>;
  if (!product) return <div className="card text-center py-20"><h2 className="text-2xl font-bold text-slate-400">Product not found</h2></div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)} 
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-400 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white">{tProduct(product.name)}</h1>
            <p className="text-slate-500 dark:text-zinc-500 font-medium">Modifier les détails du produit et la recette artisanale</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleDelete}
            disabled={saving}
            className="px-4 py-2 bg-white dark:bg-zinc-900 text-red-500 dark:text-red-400 border border-red-100 dark:border-red-900/20 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl font-bold text-sm flex items-center gap-2 transition-all disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {t('delete')}
          </button>
          <button 
            onClick={handleSave} 
            disabled={saving} 
            className="px-6 py-2 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-500 transition-all shadow-lg shadow-amber-600/20 flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Enregistrement...' : t('save')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white dark:bg-zinc-900 rounded-[32px] border border-slate-100 dark:border-white/10 p-8">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <Info className="w-5 h-5 text-amber-500" />
              {t('generalInfo')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-2">{t('name')}</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-black border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 transition-all placeholder:text-slate-400 dark:placeholder:text-zinc-700" 
                  value={product.name}
                  onChange={(e) => setProduct({...product, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-2">{t('category')}</label>
                <select 
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-black border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 transition-all appearance-none"
                  value={product.category}
                  onChange={(e) => setProduct({...product, category: e.target.value})}
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{tCategory(c)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-2">{t('shelfLife')} (Heures)</label>
                <div className="relative">
                  <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 w-5 h-5" />
                  <input 
                    type="number" 
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-black border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 transition-all placeholder:text-slate-400 dark:placeholder:text-zinc-700" 
                    value={product.shelfLife}
                    onChange={(e) => setProduct({...product, shelfLife: Number(e.target.value)})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-2">{t('sellingPrice')} ({CURRENCY})</label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 w-5 h-5" />
                  <input 
                    type="number" 
                    step="0.01"
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-black border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 transition-all placeholder:text-slate-400 dark:placeholder:text-zinc-700" 
                    value={product.sellingPrice}
                    onChange={(e) => setProduct({...product, sellingPrice: Number(e.target.value)})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-2">{t('costPrice')} ({CURRENCY})</label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 w-5 h-5" />
                  <input 
                    type="number" 
                    step="0.01"
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-black border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 transition-all placeholder:text-slate-400 dark:placeholder:text-zinc-700" 
                    value={product.costPrice}
                    onChange={(e) => setProduct({...product, costPrice: Number(e.target.value)})}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-[32px] border border-slate-100 dark:border-white/10 p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ChefHat className="w-5 h-5 text-amber-500" />
                {t('artisanalRecipe')}
              </h2>
              <button 
                onClick={addIngredient} 
                className="px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-all font-bold text-xs flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {t('addIngredient')}
              </button>
            </div>
            
            {recipe ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-black rounded-2xl border border-slate-100 dark:border-white/5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1">{t('batchSize')}</label>
                    <input 
                      type="number" 
                      className="bg-transparent border-none p-0 font-bold text-slate-900 dark:text-white focus:ring-0 w-full"
                      value={recipe.batchSize}
                      onChange={(e) => setRecipe({...recipe, batchSize: Number(e.target.value)})}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1">{t('prepTime')} (Min)</label>
                    <input 
                      type="number" 
                      className="bg-transparent border-none p-0 font-bold text-slate-900 dark:text-white focus:ring-0 w-full"
                      value={recipe.prepTime}
                      onChange={(e) => setRecipe({...recipe, prepTime: Number(e.target.value)})}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  {recipe.ingredients.map((ing, idx) => (
                    <div key={idx} className="flex items-center gap-4 group">
                      <div className="flex-1">
                        <select 
                          className="w-full px-4 py-3 bg-slate-50 dark:bg-black border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 transition-all appearance-none"
                          value={ing.materialId}
                          onChange={(e) => updateIngredient(idx, 'materialId', e.target.value)}
                        >
                          <option value="">{t('selectIngredient')}</option>
                          {materials.map(m => <option key={m.id} value={m.id}>{tProduct(m.name)} ({m.unit})</option>)}
                        </select>
                      </div>
                      <div className="w-24">
                        <select 
                          className="w-full px-4 py-3 bg-slate-50 dark:bg-black border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 transition-all appearance-none text-xs"
                          value={ing.type}
                          onChange={(e) => updateIngredient(idx, 'type', e.target.value)}
                        >
                          <option value="weight">{t('weight')}</option>
                          <option value="quantity">{t('quantity')}</option>
                          <option value="percentage">{t('percentage')}</option>
                        </select>
                      </div>
                      <div className="w-32 relative">
                        {ing.type === 'weight' ? <Scale className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 w-4 h-4" /> :
                         ing.type === 'percentage' ? <Percent className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 w-4 h-4" /> :
                         <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 w-4 h-4" />}
                        <input 
                          type="number" 
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-black border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 transition-all placeholder:text-slate-400 dark:placeholder:text-zinc-700"
                          placeholder="Qté"
                          value={ing.quantity}
                          onChange={(e) => updateIngredient(idx, 'quantity', Number(e.target.value))}
                        />
                      </div>
                      <button 
                        onClick={() => removeIngredient(idx)}
                        className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-300 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-400/10 transition-all opacity-0 group-hover:opacity-100 border border-transparent hover:border-red-200 dark:hover:border-red-400/20"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 bg-slate-50/50 dark:bg-black/50 rounded-[32px] border border-dashed border-slate-200 dark:border-white/10">
                <ChefHat className="w-12 h-12 text-slate-200 dark:text-zinc-800 mx-auto mb-3" />
                <p className="text-slate-400 dark:text-zinc-500 font-medium mb-4">{t('noRecipeDefined')}</p>
                <button 
                  onClick={() => setRecipe({ id: '', productId: id!, batchSize: 10, prepTime: 60, ingredients: [] })}
                  className="px-6 py-2 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-500 transition-all shadow-lg shadow-amber-600/20"
                >
                  {t('createRecipe')}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-white dark:bg-zinc-900 rounded-[32px] border border-slate-100 dark:border-white/10 overflow-hidden">
            <div className="h-64 bg-slate-100 dark:bg-black relative group">
              <img 
                src={product.imageUrl || `https://picsum.photos/seed/${product.name}/400/300`} 
                alt={product.name}
                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                referrerPolicy="no-referrer"
              />
              <label className="absolute bottom-4 right-4 px-4 py-2 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold gap-2 cursor-pointer shadow-lg hover:scale-105 transition-transform flex items-center">
                <ImageIcon className="w-4 h-4 text-amber-500" />
                {t('changeImage')}
                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
              </label>
            </div>
            <div className="p-8">
              <h3 className="font-bold text-slate-900 dark:text-white mb-4">{t('inventoryStatus')}</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500 dark:text-zinc-500 font-medium">{t('currentStock')}</span>
                  <span className="font-bold text-slate-900 dark:text-white">{product.stock} unités</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500 dark:text-zinc-500 font-medium">{t('minStock')}</span>
                  <span className="font-bold text-slate-900 dark:text-white">{product.minStock} unités</span>
                </div>
                <div className="pt-4 border-t border-slate-100 dark:border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">{t('stockHealth')}</span>
                    <span className="text-xs font-bold text-emerald-500 dark:text-emerald-400">{t('optimal')}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-black rounded-full overflow-hidden border border-slate-200 dark:border-white/5">
                    <div className="w-3/4 h-full bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.3)]"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-[32px] border border-slate-100 dark:border-white/10 p-8">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">{t('artisanalTip')}</h3>
            <p className="text-slate-500 dark:text-zinc-400 text-sm mb-6 leading-relaxed">
              Maintenir une température constante pendant la préparation de {tProduct(product.name)} est essentiel pour obtenir la texture artisanale parfaite.
            </p>
            <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-black rounded-2xl border border-slate-100 dark:border-white/5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20">
                <Info className="w-5 h-5" />
              </div>
              <div className="text-xs">
                <p className="font-bold text-slate-900 dark:text-white">{t('proInsight')}</p>
                <p className="text-slate-500 dark:text-zinc-500">{t('humidityCheck')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductEdit;
