import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  ChefHat, 
  Headphones, 
  PenTool, 
  RefreshCw, 
  ChevronRight,
  Building2,
  Mail,
  Phone,
  MapPin,
  User as UserIcon,
  Lock
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

const B2BRegistration: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const { register } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  
  // Form state
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      // Register with role customer_business
      await register(username, password, businessName, 'customer_business');
      toast.success('B2B Registration successful!');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-black">
      {/* Brand Sidebar / Context Area */}
      <section className="w-full md:w-1/3 bg-amber-600 p-8 md:p-12 flex flex-col justify-between text-white">
        <div>
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-xl overflow-hidden">
                <img 
                  src="/logo.jpg" 
                  alt="Bella Dolce" 
                  className="w-full h-full object-contain" 
                  referrerPolicy="no-referrer" 
                />
              </div>
              <h1 className="font-display font-extrabold text-2xl tracking-tighter">Bella Dolce</h1>
            </div>
            <p className="text-amber-100 font-medium text-sm">L'Atelier Numérique des Artisans</p>
          </div>

          <div className="space-y-8">
            <div className={clsx(
              "relative pl-8 border-l-2 transition-all",
              step >= 1 ? "border-white" : "border-white/20"
            )}>
              <span className={clsx(
                "absolute -left-[9px] top-0 w-4 h-4 rounded-full ring-4 ring-amber-600 transition-all",
                step >= 1 ? "bg-white" : "bg-amber-400"
              )}></span>
              <h3 className="font-display font-bold leading-tight">Détails de l'entreprise</h3>
              <p className="text-amber-100 text-sm mt-1">Identifiez votre établissement pour commencer.</p>
            </div>
            <div className={clsx(
              "relative pl-8 border-l-2 transition-all",
              step >= 2 ? "border-white" : "border-white/20"
            )}>
              <span className={clsx(
                "absolute -left-[9px] top-0 w-4 h-4 rounded-full ring-4 ring-amber-600 transition-all",
                step >= 2 ? "bg-white" : "bg-amber-400"
              )}></span>
              <h3 className="font-display font-bold leading-tight">Sécurisation</h3>
              <p className="text-amber-100 text-sm mt-1">Configurez vos accès professionnels.</p>
            </div>
            <div className={clsx(
              "relative pl-8 transition-all",
              step >= 3 ? "border-white" : "border-white/20"
            )}>
              <span className={clsx(
                "absolute -left-[9px] top-0 w-4 h-4 rounded-full ring-4 ring-amber-600 transition-all",
                step >= 3 ? "bg-white" : "bg-amber-400"
              )}></span>
              <h3 className="font-display font-bold leading-tight">Partenariat Artisanal</h3>
              <p className="text-amber-100 text-sm mt-1">Signature du contrat de distribution.</p>
            </div>
          </div>
        </div>

        <div className="mt-12 hidden md:block">
          <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/10">
            <p className="text-xs text-amber-200 font-bold uppercase tracking-widest mb-4">Besoin d'aide ?</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <Headphones className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold">Support B2B</p>
                <p className="text-xs text-amber-200">Lundi - Samedi, 8h - 19h</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Form Content Canvas */}
      <section className="flex-1 bg-white dark:bg-black p-8 md:p-20 overflow-y-auto">
        <div className="max-w-2xl mx-auto">
          <header className="mb-10 flex justify-between items-start">
            <div>
              <h2 className="font-display font-extrabold text-3xl text-slate-900 dark:text-white mb-2 tracking-tight">Devenir Partenaire</h2>
              <p className="text-slate-500 dark:text-zinc-400 text-lg">Rejoignez le réseau Bella Dolce et accédez à nos tarifs de gros exclusifs.</p>
            </div>
            <a href="/login" className="text-sm font-bold text-amber-500 hover:underline">Déjà partenaire ? Se connecter</a>
          </header>

          <form className="space-y-8" onSubmit={handleSubmit}>
            {/* Step 1: Business Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="col-span-full">
                <label className="block text-sm font-bold text-slate-500 dark:text-zinc-400 mb-2">Nom de l'entreprise / Raison Sociale</label>
                <div className="relative">
                  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 w-5 h-5" />
                  <input 
                    className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl pl-12 pr-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 transition-all placeholder:text-slate-400 dark:placeholder:text-zinc-600" 
                    placeholder="ex: Boulangerie de la Paix" 
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-500 dark:text-zinc-400 mb-2">Nom d'utilisateur</label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 w-5 h-5" />
                  <input 
                    className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl pl-12 pr-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 transition-all placeholder:text-slate-400 dark:placeholder:text-zinc-600" 
                    placeholder="ex: p_dupont" 
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-500 dark:text-zinc-400 mb-2">Téléphone</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 w-5 h-5" />
                  <input 
                    className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl pl-12 pr-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 transition-all placeholder:text-slate-400 dark:placeholder:text-zinc-600" 
                    placeholder="+213..." 
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>
              <div className="col-span-full">
                <label className="block text-sm font-bold text-slate-500 dark:text-zinc-400 mb-2">Adresse de livraison principale</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-4 text-slate-400 dark:text-zinc-500 w-5 h-5" />
                  <textarea 
                    className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl pl-12 pr-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 transition-all placeholder:text-slate-400 dark:placeholder:text-zinc-600" 
                    placeholder="Numéro, rue, code postal et ville" 
                    rows={3}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  ></textarea>
                </div>
              </div>
            </div>

            {/* Step 2: Security */}
            <div className="pt-8 mt-8 border-t border-slate-100 dark:border-white/10">
              <h3 className="font-display font-bold text-xl text-slate-900 dark:text-white mb-6">Sécurité du compte</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-500 dark:text-zinc-400 mb-2">Mot de passe</label>
                  <input 
                    className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 transition-all" 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-500 dark:text-zinc-400 mb-2">Confirmer le mot de passe</label>
                  <input 
                    className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 transition-all" 
                    type="password" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Step 3: Digital Contract Preview */}
            <div className="pt-8 mt-8 border-t border-slate-100 dark:border-white/10">
              <h3 className="font-display font-bold text-xl text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                <PenTool className="w-6 h-6 text-amber-500" />
                Accord de Partenariat Artisanal
              </h3>
              <div className="bg-slate-50 dark:bg-zinc-900 rounded-2xl p-6 h-64 overflow-y-scroll border border-slate-100 dark:border-white/10 mb-6 text-sm text-slate-500 dark:text-zinc-400 leading-relaxed no-scrollbar">
                <h4 className="font-bold text-slate-900 dark:text-white mb-2">Conditions Générales de Distribution B2B</h4>
                <p className="mb-4">Le présent contrat (ci-après l' "Accord") régit les relations commerciales entre Bella Dolce et le Partenaire susmentionné. En signant ce document, le Partenaire s'engage à respecter les standards de qualité et de conservation des produits artisanaux livrés.</p>
                <p className="mb-4">1. Commandes : Les commandes doivent être passées au plus tard 24h avant la livraison souhaitée via le portail professionnel.</p>
                <p className="mb-4">2. Paiement : Sauf accord particulier, les factures sont dues à réception. Des pénalités de retard pourront être appliquées conformément à la législation en vigueur.</p>
                <p className="mb-4">3. Qualité : Bella Dolce garantit des produits frais du jour. Toute réclamation doit être effectuée dans les 2 heures suivant la livraison.</p>
                <p className="italic">Document généré numériquement le {new Date().toLocaleDateString()}.</p>
              </div>
              <div className="bg-slate-50 dark:bg-zinc-900 rounded-2xl p-6 border-2 border-dashed border-slate-200 dark:border-white/10 relative">
                <label className="block text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-4">Signature Numérique</label>
                <div className="w-full h-32 rounded-xl bg-white dark:bg-black flex items-center justify-center text-slate-300 dark:text-zinc-700 border border-slate-100 dark:border-white/5">
                  <span className="text-sm">Signez ici à l'aide de votre souris ou tablette</span>
                </div>
                <button className="absolute bottom-10 right-10 text-xs font-bold text-red-500 dark:text-red-400 flex items-center gap-1 hover:underline" type="button">
                  <RefreshCw className="w-3 h-3" /> Effacer
                </button>
              </div>
            </div>

            {/* Final Action */}
            <div className="flex flex-col sm:flex-row items-center gap-6 pt-10">
              <button 
                className="w-full sm:w-auto px-10 py-4 bg-amber-600 text-white font-bold rounded-2xl shadow-lg shadow-amber-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed" 
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? 'Inscription en cours...' : "Finaliser l'inscription"}
                <ChevronRight className="w-5 h-5" />
              </button>
              <p className="text-xs text-slate-400 dark:text-zinc-500 max-w-[200px] leading-tight">
                En cliquant, vous acceptez nos <span className="text-amber-500 cursor-pointer hover:underline">Conditions d'Utilisation</span>.
              </p>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
};

export default B2BRegistration;
