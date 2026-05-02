import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { ChefHat, ShieldCheck, TrendingUp, Package, Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react';
import { Navigate } from 'react-router-dom';

const Login: React.FC = () => {
  const { login, register, user, profile, loading } = useAuth();
  const { t } = useLanguage();
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      if (isRegistering) {
        await register(username, password, name);
      } else {
        await login(username, password);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return null;
  if (user) {
    if (profile?.role === 'admin') {
      return <Navigate to="/dashboard" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-slate-50 dark:bg-black">
      {/* Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-600/5 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/5 rounded-full blur-[120px]"></div>

      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-0 overflow-hidden rounded-3xl shadow-2xl bg-white dark:bg-[#0a0a0a] border border-slate-100 dark:border-[#2a1e17]">
        {/* Brand Column */}
        <div className="hidden md:flex flex-col justify-between p-12 bg-gradient-to-br from-primary-600 to-primary-700 relative overflow-hidden">
          {/* Subtle dot pattern overlay */}
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '20px 20px'
          }}></div>

          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                <ChefHat className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-display font-bold text-white">Bella Dolce</h1>
                <p className="text-primary-100 text-sm font-medium">Système de Gestion</p>
              </div>
            </div>
            <p className="text-primary-50 text-sm max-w-xs opacity-90">Gestion intégrée pour votre boulangerie artisanale</p>
          </div>

          {/* Features */}
          <div className="relative z-10 space-y-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-primary-100 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-white font-medium text-sm">Sécurité Renforcée</p>
                <p className="text-primary-100 text-xs">Accès contrôlé par rôle</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <TrendingUp className="w-5 h-5 text-primary-100 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-white font-medium text-sm">Analyses Temps Réel</p>
                <p className="text-primary-100 text-xs">Ventes, inventaire, production</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Package className="w-5 h-5 text-primary-100 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-white font-medium text-sm">Gestion Intelligente</p>
                <p className="text-primary-100 text-xs">Inventaire et production</p>
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-4 border-t border-white/20">
            <p className="text-primary-50 text-xs opacity-75">© Bella Dolce 2024 • v1.0</p>
          </div>
        </div>

        {/* Form Column */}
        <div className="p-8 md:p-16 flex flex-col justify-center bg-white dark:bg-[#0a0a0a]">
          <div className="mb-10">
            <h2 className="font-display text-3xl font-bold text-slate-900 dark:text-white">
              {isRegistering ? 'Rejoignez-nous' : 'Bienvenue'}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">
              {isRegistering
                ? 'Créez votre compte pour accéder au système.'
                : 'Accédez à votre espace de gestion'}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium border border-red-100 dark:border-red-800">
              {error}
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            {isRegistering && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">
                  Nom Complet <span className="text-red-500 ml-0.5">*</span>
                </label>
                <div className="relative">
                  <input
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-black border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-600 focus:border-transparent transition-all text-sm text-slate-900 dark:text-white placeholder-slate-400"
                    placeholder="Jean Dupont"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">
                Nom d'utilisateur <span className="text-red-500 ml-0.5">*</span>
              </label>
              <div className="relative">
                <input
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-black border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-600 focus:border-transparent transition-all text-sm text-slate-900 dark:text-white placeholder-slate-400"
                  placeholder="admin"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">
                Mot de passe <span className="text-red-500 ml-0.5">*</span>
              </label>
              <div className="relative">
                <input
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-black border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-600 focus:border-transparent transition-all text-sm text-slate-900 dark:text-white placeholder-slate-400 pr-12"
                  placeholder="••••••••"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 bg-primary-600 text-white font-bold rounded-2xl shadow-lg shadow-primary-600/20 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm flex items-center justify-center gap-3"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Connexion en cours...
                </>
              ) : (
                <>
                  {isRegistering ? 'S\'inscrire' : t('login')}
                </>
              )}
            </button>

            <div className="text-center space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {isRegistering ? 'Vous avez déjà un compte ?' : "Vous n'avez pas de compte ?"}{' '}
                <button
                  type="button"
                  onClick={() => setIsRegistering(!isRegistering)}
                  className="text-primary-600 font-bold hover:underline"
                >
                  {isRegistering ? 'Connectez-vous' : 'Inscrivez-vous'}
                </button>
              </p>

              {!isRegistering && (
                <div className="pt-4 border-t border-slate-100 dark:border-[#2a1e17]">
                  <p className="text-xs text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-widest font-bold">Client Professionnel ?</p>
                  <a
                    href="/b2b-register"
                    className="inline-flex items-center gap-2 text-primary-600 font-bold text-sm hover:underline"
                  >
                    Accès B2B
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
              )}
            </div>
          </form>
        </div>
      </div>
    </main>
  );
};

export default Login;
