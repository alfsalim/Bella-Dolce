import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Eye, EyeOff, Loader2, ArrowRight, ShieldOff, Globe } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { clsx } from 'clsx';
import BrandLogo, { BRAND_LOGO_CHIP_CLASS, BRAND_LOGO_MARK_IMG_CLASS, BrandWordmark } from '../components/BrandLogo';
import { APP_VERSION } from '../constants';
import { getDefaultStaffLoginPath, isStaffRole } from '../lib/staff-nav';

const Login: React.FC = () => {
  const { login, register, logout, user, profile, permissions, loading } = useAuth();
  const { t, isRTL, language, setLanguage } = useLanguage();
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
      let msg = typeof err?.message === 'string' ? err.message : '';
      if (!msg) setError(t('authErrorGeneric'));
      else if (msg === 'Unauthorized') setError(t('authErrorSessionExpired'));
      else if (/Forbidden|insufficient role/i.test(msg)) setError(t('authErrorInsufficientRole'));
      else setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return null;
  if (user) {
    if (isStaffRole(profile?.role)) {
      // Wait until permissions are resolved before redirecting.
      if (permissions === null) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-black">
            <Loader2 className="w-10 h-10 text-primary-600 animate-spin" aria-hidden />
          </div>
        );
      }
      const dest = getDefaultStaffLoginPath(permissions);
      if (!dest) {
        // User is authenticated but has no permitted pages — show a clear error.
        return (
          <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-slate-50 dark:bg-black p-8 text-center">
            <ShieldOff className="w-14 h-14 text-red-400" />
            <div>
              <p className="text-lg font-bold text-slate-800 dark:text-white">{t('authErrorInsufficientRole')}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{profile?.role}</p>
            </div>
            <button onClick={logout} className="btn-primary">
              {t('logout')}
            </button>
          </div>
        );
      }
      return <Navigate to={dest} replace />;
    }
    return <Navigate to="/" replace />;
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center p-6 overflow-hidden bg-slate-50 dark:bg-black">
      {/* Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-600/5 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/5 rounded-full blur-[120px]"></div>

      <div className="absolute top-6 end-6 z-10">
        <button
          type="button"
          onClick={() => setLanguage(language === 'fr' ? 'ar' : 'fr')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#2a1e17] bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-sm text-slate-800 dark:text-slate-200 text-sm font-semibold shadow-sm hover:bg-slate-50 dark:hover:bg-[#1a1512] transition-all normal-case"
          aria-label={t('language')}
          title={t('language')}
        >
          <Globe className="w-4 h-4 shrink-0" aria-hidden />
          <span className={clsx('text-sm font-semibold', language === 'fr' && 'font-arabic')}>
            {language === 'fr' ? 'عربي' : 'FR'}
          </span>
        </button>
      </div>

      <div className="w-full max-w-5xl flex flex-col items-center">
        <Link
          to="/"
          className="flex flex-col items-center gap-3 mb-8 group"
          aria-label={t('loginBackHome')}
        >
          <div className={clsx(BRAND_LOGO_CHIP_CLASS, 'transition-transform group-hover:scale-105')}>
            <BrandLogo imgClassName={BRAND_LOGO_MARK_IMG_CLASS} />
          </div>
          <BrandWordmark className="h-9 sm:h-10" />
        </Link>

        <div className="w-full max-w-3xl overflow-hidden rounded-3xl shadow-2xl bg-white dark:bg-[#0a0a0a] border border-slate-100 dark:border-[#2a1e17]">
        <div className="p-10 md:p-16 flex flex-col justify-center bg-white dark:bg-[#0a0a0a]">
          <div className="mb-10 text-center">
            <h2
              className={clsx(
                'leading-snug md:whitespace-nowrap',
                isRTL
                  ? 'font-arabic text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight'
                  : isRegistering
                    ? 'font-sans text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight'
                    : 'font-script text-4xl md:text-5xl bg-clip-text text-transparent [background-image:linear-gradient(160deg,#8C6A2F_0%,#CFAE5B_45%,#F5E6A5_75%,#CFAE5B_100%)] [filter:drop-shadow(0_1px_3px_rgba(42,32,16,0.5))]'
              )}
            >
              {isRegistering ? t('loginTitleJoin') : t('welcome')}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">
              {isRegistering ? t('loginSubtitleRegister') : t('loginSubtitleLogin')}
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
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest ms-1">
                  {t('fullName')} <span className="text-red-500 ms-0.5 text-xs font-bold align-super" aria-hidden>*</span>
                </label>
                <div className="relative">
                  <input
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-black border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-600 focus:border-transparent transition-all text-sm text-slate-900 dark:text-white placeholder-slate-400"
                    placeholder={t('loginPlaceholderFullName')}
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest ms-1">
                {t('username')} <span className="text-red-500 ms-0.5 text-xs font-bold align-super" aria-hidden>*</span>
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
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest ms-1">
                {t('password')} <span className="text-red-500 ms-0.5 text-xs font-bold align-super" aria-hidden>*</span>
              </label>
              <div className="relative">
                <input
                  className="w-full ps-4 pe-12 py-3 bg-slate-50 dark:bg-black border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-600 focus:border-transparent transition-all text-sm text-slate-900 dark:text-white placeholder-slate-400"
                  placeholder="••••••••"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute end-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
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
                  {t('loginSubmitting')}
                </>
              ) : (
                <>
                  {isRegistering ? t('loginRegister') : t('login')}
                </>
              )}
            </button>

            <div className="text-center space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {isRegistering ? t('loginHasAccount') : t('loginNoAccount')}{' '}
                <button
                  type="button"
                  onClick={() => setIsRegistering(!isRegistering)}
                  className="text-primary-600 font-bold hover:underline"
                >
                  {isRegistering ? t('loginToSignIn') : t('loginToSignUp')}
                </button>
              </p>

              {!isRegistering && (
                <div className="pt-4 border-t border-slate-100 dark:border-[#2a1e17]">
                  <p className="text-xs text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-widest font-bold">
                    {t('loginB2bPrompt')}
                  </p>
                  <a
                    href="/b2b-register"
                    className="inline-flex items-center gap-2 text-primary-600 font-bold text-sm hover:underline"
                  >
                    {t('loginB2bAccess')}
                    <ArrowRight className={clsx('w-4 h-4', isRTL && 'rotate-180')} />
                  </a>
                </div>
              )}
            </div>
          </form>

          <div className="mt-8 text-center px-4 text-[10px] font-bold text-slate-300 dark:text-slate-700 uppercase tracking-widest">
            Version {APP_VERSION}
          </div>
        </div>
        </div>
      </div>
    </main>
  );
};

export default Login;
