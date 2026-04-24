import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  Sparkles, 
  Calendar, 
  TrendingUp, 
  ChefHat, 
  Package, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ArrowRight,
  RefreshCcw,
  FileText,
  Download,
  Share2,
  MessageSquare,
  Send
} from 'lucide-react';
import { db, collection, onSnapshot, query, where, orderBy, getDocs } from '../lib/firebase';
import { ProductionBatch, Sale, Product, RawMaterial, Order, ActivityLog, DailyCashReconciliation } from '../types';
import { generateDailyReport, askAiManager, ReportContext } from '../services/aiManagerService';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';
import { CURRENCY } from '../constants';
import toast from 'react-hot-toast';

const AIManager: React.FC = () => {
  const { t, isRTL, language } = useLanguage();
  const { profile } = useAuth();
  
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  
  const [data, setData] = useState<ReportContext | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile || !['admin', 'manager'].includes(profile.role)) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const startOfDay = new Date(selectedDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(selectedDate);
        endOfDay.setHours(23, 59, 59, 999);

        const [salesSnap, batchesSnap, productsSnap, materialsSnap, ordersSnap, logsSnap, cashSnap] = await Promise.all([
          getDocs(query(collection(db, 'sales'), where('createdAt', '>=', startOfDay.toISOString()), where('createdAt', '<=', endOfDay.toISOString()))),
          getDocs(query(collection(db, 'batches'), where('startDate', '>=', startOfDay.toISOString()), where('startDate', '<=', endOfDay.toISOString()))),
          getDocs(collection(db, 'products')),
          getDocs(collection(db, 'rawMaterials')),
          getDocs(query(collection(db, 'orders'), where('createdAt', '>=', startOfDay.toISOString()), where('createdAt', '<=', endOfDay.toISOString()))),
          getDocs(query(collection(db, 'activityLogs'), where('timestamp', '>=', startOfDay.toISOString()), where('timestamp', '<=', endOfDay.toISOString()))),
          getDocs(query(collection(db, 'cashReconciliations'), where('date', '==', selectedDate)))
        ]);

        const context: ReportContext = {
          date: selectedDate,
          sales: salesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale)),
          batches: batchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductionBatch)),
          products: productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)),
          materials: materialsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RawMaterial)),
          orders: ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)),
          logs: logsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog)),
          cashReconciliation: cashSnap.docs.length > 0 ? { id: cashSnap.docs[0].id, ...cashSnap.docs[0].data() } as DailyCashReconciliation : undefined
        };

        setData(context);
      } catch (error) {
        console.error("Error fetching report data:", error);
        toast.error("Error loading daily data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedDate, profile]);

  const handleGenerateReport = async () => {
    if (!data) return;
    setIsGenerating(true);
    setReport(null);
    try {
      const generatedReport = await generateDailyReport(data, language as 'fr' | 'ar');
      setReport(generatedReport);
      toast.success("Daily report generated successfully");
    } catch (error) {
      console.error("Error generating report:", error);
      toast.error("Failed to generate AI report");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || !question.trim()) return;
    
    setIsAsking(true);
    setAiResponse(null);
    try {
      const response = await askAiManager(question, data, language as 'fr' | 'ar');
      setAiResponse(response);
      toast.success("AI Manager responded");
    } catch (error) {
      console.error("Error asking AI:", error);
      toast.error("Failed to get AI response");
    } finally {
      setIsAsking(false);
    }
  };

  if (!profile || !['admin', 'manager'].includes(profile.role)) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
        <AlertTriangle className="w-16 h-16 text-amber-500 mb-4" />
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Access Restricted</h2>
        <p className="text-slate-500 max-w-md">Only administrators and managers have access to the AI Manager insights and daily reports.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      {/* Header Section */}
      <div className="relative overflow-hidden rounded-[40px] bg-slate-900 dark:bg-black p-10 lg:p-16 border border-white/5 shadow-2xl">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary-600/10 rounded-full blur-[120px] -mr-40 -mt-40" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-amber-600/5 rounded-full blur-[100px] -ml-20 -mb-20" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-600/10 border border-primary-500/20 text-primary-400 text-xs font-bold uppercase tracking-widest mb-6">
              <Sparkles className="w-4 h-4" />
              AI Bakery Manager
            </div>
            <h1 className="text-4xl lg:text-6xl font-display font-bold text-white mb-6 leading-tight">
              {language === 'ar' ? 'رؤى المدير الذكي' : 'Insights du Manager IA'}
            </h1>
            <p className="text-slate-400 text-lg lg:text-xl font-medium leading-relaxed mb-8">
              {language === 'ar' 
                ? 'تحليل ذكي لبياناتك اليومية، الأرباح، الإنتاج، وأداء الموظفين مع تقارير استراتيجية.' 
                : 'Analyse intelligente de vos données quotidiennes, profits, production et performance des employés avec des rapports stratégiques.'}
            </p>
            
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative group">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-hover:text-primary-400 transition-colors" />
                <input 
                  type="date" 
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-4 text-white font-semibold focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 outline-none transition-all hover:bg-white/10"
                />
              </div>
              <button 
                onClick={handleGenerateReport}
                disabled={isGenerating || loading}
                className={clsx(
                  "flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-white transition-all shadow-xl shadow-primary-600/20",
                  isGenerating ? "bg-slate-800 cursor-not-allowed" : "bg-primary-600 hover:bg-primary-500 active:scale-95"
                )}
              >
                {isGenerating ? (
                  <>
                    <RefreshCcw className="w-5 h-5 animate-spin" />
                    {language === 'ar' ? 'جاري التحليل...' : 'Analyse en cours...'}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    {language === 'ar' ? 'توليد التقرير اليومي' : 'Générer le rapport du jour'}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-4 w-full lg:w-auto">
            {[
              { label: t('sales'), value: data?.sales.reduce((acc, s) => acc + s.totalAmount, 0) || 0, icon: TrendingUp, color: 'text-emerald-400', suffix: CURRENCY },
              { label: t('production'), value: data?.batches.length || 0, icon: ChefHat, color: 'text-amber-400', suffix: t('batches') },
              { label: t('orders'), value: data?.orders.length || 0, icon: Package, color: 'text-blue-400', suffix: t('orders') },
              { label: t('alerts'), value: (data?.products.filter(p => p.stock < p.minStock).length || 0) + (data?.materials.filter(m => m.currentStock < m.minStock).length || 0), icon: AlertTriangle, color: 'text-red-400', suffix: t('items') },
            ].map((stat, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md hover:bg-white/10 transition-all group">
                <stat.icon className={clsx("w-6 h-6 mb-4 transition-transform group-hover:scale-110", stat.color)} />
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">{stat.label}</p>
                <p className="text-xl font-display font-bold text-white">
                  {stat.value.toLocaleString()} <span className="text-[10px] text-slate-500">{stat.suffix}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Ask AI Section */}
      <div className="bg-white dark:bg-zinc-900 rounded-[40px] border border-slate-100 dark:border-white/5 shadow-xl overflow-hidden">
        <div className="p-8 lg:p-10">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {language === 'ar' ? 'اسأل المدير الذكي' : 'Demander au Manager IA'}
              </h2>
              <p className="text-slate-500 text-sm">
                {language === 'ar' ? 'اطرح أي سؤال حول أداء المخبز اليوم.' : 'Posez n\'importe quelle question sur la performance de la boulangerie aujourd\'hui.'}
              </p>
            </div>
          </div>

          <form onSubmit={handleAskQuestion} className="relative mb-8">
            <input 
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={language === 'ar' ? 'مثلاً: ما هي المنتجات الأكثر مبيعاً اليوم؟' : 'Ex: Quels sont les produits les plus vendus aujourd\'hui ?'}
              className="w-full bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-white/5 rounded-2xl pl-6 pr-16 py-5 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-primary-500 outline-none transition-all"
            />
            <button 
              type="submit"
              disabled={isAsking || !question.trim() || loading}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-xl bg-primary-600 text-white flex items-center justify-center hover:bg-primary-500 transition-all disabled:bg-slate-300 dark:disabled:bg-zinc-700"
            >
              {isAsking ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </form>

          <AnimatePresence>
            {aiResponse && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-8 rounded-3xl bg-primary-50 dark:bg-primary-900/10 border border-primary-100 dark:border-primary-500/20"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center text-white shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div className={clsx(
                    "prose prose-slate dark:prose-invert max-w-none",
                    "prose-headings:font-display prose-headings:font-bold prose-headings:text-lg",
                    "prose-p:text-slate-700 dark:prose-p:text-slate-300 prose-p:leading-relaxed",
                    "prose-strong:text-slate-900 dark:prose-strong:text-white",
                    "prose-ul:list-disc prose-ol:list-decimal",
                    isRTL ? "text-right" : "text-left"
                  )}>
                    <Markdown>{aiResponse}</Markdown>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Report Content */}
      <AnimatePresence mode="wait">
        {isGenerating ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col items-center justify-center py-20 bg-white dark:bg-zinc-900 rounded-[40px] border border-slate-100 dark:border-white/5 shadow-sm"
          >
            <div className="relative w-24 h-24 mb-8">
              <div className="absolute inset-0 border-4 border-primary-500/20 rounded-full" />
              <div className="absolute inset-0 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
              <Sparkles className="absolute inset-0 m-auto w-10 h-10 text-primary-500 animate-pulse" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
              {language === 'ar' ? 'المدير الذكي يراجع البيانات...' : 'Le Manager IA examine les données...'}
            </h3>
            <p className="text-slate-500 max-w-sm text-center leading-relaxed">
              {language === 'ar' 
                ? 'نقوم بتحليل المبيعات، تكاليف الإنتاج، وأداء الموظفين لنقدم لك تقريراً شاملاً.' 
                : 'Nous analysons les ventes, les coûts de production et la performance des employés pour vous fournir un rapport complet.'}
            </p>
          </motion.div>
        ) : report ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-zinc-900 rounded-[40px] border border-slate-100 dark:border-white/5 shadow-xl overflow-hidden"
          >
            {/* Report Header */}
            <div className="px-8 lg:px-12 py-8 bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-primary-600 flex items-center justify-center text-white shadow-lg shadow-primary-600/20">
                  <FileText className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                    {language === 'ar' ? 'التقرير اليومي للمدير' : 'Rapport Quotidien du Manager'}
                  </h2>
                  <p className="text-slate-500 font-medium flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {new Date(selectedDate).toLocaleDateString(language === 'ar' ? 'ar-DZ' : 'fr-FR', { dateStyle: 'full' })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white font-bold hover:bg-slate-50 dark:hover:bg-zinc-700 transition-all"
                >
                  <Download className="w-4 h-4" />
                  {t('print')}
                </button>
                <button className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary-600 text-white font-bold hover:bg-primary-500 transition-all shadow-lg shadow-primary-600/20">
                  <Share2 className="w-4 h-4" />
                  {t('share')}
                </button>
              </div>
            </div>

            {/* Report Body */}
            <div className={clsx(
              "px-8 lg:px-16 py-12 prose prose-slate dark:prose-invert prose-lg max-w-none",
              "prose-headings:font-display prose-headings:font-bold prose-headings:tracking-tight",
              "prose-a:text-primary-600 dark:prose-a:text-primary-400 prose-strong:text-slate-900 dark:prose-strong:text-white",
              "prose-table:border prose-table:border-slate-200 dark:prose-table:border-white/10 prose-th:bg-slate-50 dark:prose-th:bg-zinc-800 prose-th:px-4 prose-th:py-2 prose-td:px-4 prose-td:py-2",
              isRTL ? "text-right" : "text-left"
            )}>
              <Markdown>{report}</Markdown>
            </div>

            {/* Report Footer */}
            <div className="px-8 lg:px-12 py-8 bg-slate-50 dark:bg-zinc-800/50 border-t border-slate-100 dark:border-white/5 text-center">
              <p className="text-slate-500 text-sm font-medium italic">
                {language === 'ar' 
                  ? 'هذا التقرير تم إنشاؤه بواسطة الذكاء الاصطناعي بناءً على بيانات اليوم. يرجى مراجعته بعناية.' 
                  : 'Ce rapport a été généré par IA sur la base des données du jour. Veuillez le consulter attentivement.'}
              </p>
            </div>
          </motion.div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 bg-white dark:bg-zinc-900 rounded-[40px] border border-slate-100 dark:border-white/5 border-dashed">
            <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-zinc-800 flex items-center justify-center text-slate-300 dark:text-slate-700 mb-6">
              <FileText className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              {language === 'ar' ? 'لا يوجد تقرير متاح' : 'Aucun rapport disponible'}
            </h3>
            <p className="text-slate-500 mb-8">
              {language === 'ar' ? 'اختر تاريخاً واضغط على زر التوليد للحصول على رؤى المدير.' : 'Choisissez une date et cliquez sur le bouton de génération pour obtenir les insights du manager.'}
            </p>
            <button 
              onClick={handleGenerateReport}
              disabled={loading}
              className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all"
            >
              <Sparkles className="w-5 h-5" />
              {language === 'ar' ? 'توليد تقرير اليوم' : 'Générer le rapport du jour'}
            </button>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AIManager;
