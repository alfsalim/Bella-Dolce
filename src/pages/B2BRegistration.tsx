import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import {
  PenTool,
  ChevronRight,
  Building2,
  Phone,
  MapPin,
  User as UserIcon,
  Globe,
  Hash,
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import BrandLogo, { BRAND_LOGO_CHIP_CLASS, BRAND_LOGO_MARK_IMG_CLASS, BrandWordmark } from '../components/BrandLogo';

const B2BRegistration: React.FC = () => {
  const { t, isRTL, language, setLanguage } = useLanguage();
  const { register } = useAuth();
  const navigate = useNavigate();

  const [businessName, setBusinessName] = useState('');
  const [companyRegistrationNumber, setCompanyRegistrationNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const heading = (extra: string) =>
    clsx(extra, isRTL ? 'font-arabic' : 'font-sans');

  const contractDate = new Date().toLocaleDateString(language === 'ar' ? 'ar-DZ' : 'fr-DZ', {
    dateStyle: 'long',
  });

  const fieldIcon = 'absolute start-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 w-5 h-5 pointer-events-none';
  const inputWithIcon =
    'w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-slate-700 rounded-xl ps-12 pe-4 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent transition-all placeholder:text-slate-400 dark:placeholder:text-zinc-600';
  const inputPlain =
    'w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent transition-all';
  const labelClass = 'block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest ms-1 mb-2';

  const mapRegisterError = (msg: string) => {
    if (msg === 'b2b_company_exists') return t('b2bRegisterCompanyExists');
    if (msg === 'username_exists') return t('registerUsernameTaken');
    return msg || t('b2bRegisterFailed');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error(t('b2bRegisterPasswordMismatch'));
      return;
    }

    setIsLoading(true);
    try {
      await register(username, password, businessName, 'customer_business', {
        phone: phone.trim() || undefined,
        companyRegistrationNumber: companyRegistrationNumber.trim() || undefined,
      });
      toast.success(t('b2bRegisterSuccess'));
      navigate('/dashboard');
    } catch (error: unknown) {
      const msg =
        error && typeof error === 'object' && 'message' in error && typeof (error as Error).message === 'string'
          ? (error as Error).message
          : '';
      toast.error(mapRegisterError(msg));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen py-10 px-6 bg-slate-50 dark:bg-black flex flex-col items-center">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-600/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/5 rounded-full blur-[120px]" />

      <div className="absolute top-6 end-6 z-10">
        <button
          type="button"
          onClick={() => setLanguage(language === 'fr' ? 'ar' : 'fr')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#2a1e17] bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-sm text-slate-800 dark:text-slate-200 text-sm font-semibold shadow-sm hover:bg-slate-50 dark:hover:bg-[#1a1512] transition-all"
          aria-label={t('language')}
          title={t('language')}
        >
          <Globe className="w-4 h-4 shrink-0" aria-hidden />
          <span className="text-sm font-semibold">{language === 'fr' ? 'عربي' : 'FR'}</span>
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
          <div className="p-8 md:p-14 flex flex-col bg-white dark:bg-[#0a0a0a]">
            <div className="mb-10 text-center">
              <h1
                className={clsx(
                  'text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight leading-snug',
                  isRTL ? 'font-arabic' : 'font-sans'
                )}
              >
                {t('b2bRegisterPageTitle')}
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 max-w-xl mx-auto">
                {t('b2bRegisterPageSubtitle')}
              </p>
              <Link
                to="/login"
                className="inline-block mt-4 text-sm font-bold text-primary-600 hover:underline"
              >
                {t('b2bRegisterLoginLink')}
              </Link>
            </div>

            <form className="space-y-8" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="col-span-full">
                  <label className={labelClass}>
                    {t('b2bRegisterBusinessName')}{' '}
                    <span className="text-red-500 ms-0.5 text-xs font-bold align-super" aria-hidden>*</span>
                  </label>
                  <div className="relative">
                    <Building2 className={fieldIcon} aria-hidden />
                    <input
                      className={inputWithIcon}
                      placeholder={t('b2bRegisterBusinessPlaceholder')}
                      type="text"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="col-span-full">
                  <label className={labelClass}>{t('b2bRegisterCompanyRegNumber')}</label>
                  <div className="relative">
                    <Hash className={fieldIcon} aria-hidden />
                    <input
                      className={inputWithIcon}
                      placeholder={t('b2bRegisterCompanyRegPlaceholder')}
                      type="text"
                      value={companyRegistrationNumber}
                      onChange={(e) => setCompanyRegistrationNumber(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>
                    {t('username')}{' '}
                    <span className="text-red-500 ms-0.5 text-xs font-bold align-super" aria-hidden>*</span>
                  </label>
                  <div className="relative">
                    <UserIcon className={fieldIcon} aria-hidden />
                    <input
                      className={inputWithIcon}
                      placeholder={t('b2bRegisterUsernamePlaceholder')}
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>{t('phone')}</label>
                  <div className="relative">
                    <Phone className={fieldIcon} aria-hidden />
                    <input
                      className={inputWithIcon}
                      placeholder={t('b2bRegisterPhonePlaceholder')}
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>
                <div className="col-span-full">
                  <label className={labelClass}>{t('b2bRegisterAddress')}</label>
                  <div className="relative">
                    <MapPin className="absolute start-4 top-4 text-slate-400 dark:text-zinc-500 w-5 h-5 pointer-events-none" aria-hidden />
                    <textarea
                      className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-slate-700 rounded-xl ps-12 pe-4 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent transition-all placeholder:text-slate-400 dark:placeholder:text-zinc-600 min-h-[5.5rem]"
                      placeholder={t('b2bRegisterAddressPlaceholder')}
                      rows={3}
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 dark:border-[#2a1e17]">
                <h2 className={heading('text-lg font-bold text-slate-900 dark:text-white mb-6')}>
                  {t('b2bRegisterAccountSecurity')}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className={labelClass}>
                      {t('password')}{' '}
                      <span className="text-red-500 ms-0.5 text-xs font-bold align-super" aria-hidden>*</span>
                    </label>
                    <input
                      className={inputPlain}
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelClass}>
                      {t('b2bRegisterConfirmPassword')}{' '}
                      <span className="text-red-500 ms-0.5 text-xs font-bold align-super" aria-hidden>*</span>
                    </label>
                    <input
                      className={inputPlain}
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 dark:border-[#2a1e17]">
                <h2 className={heading('text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2 flex-wrap')}>
                  <PenTool className="w-5 h-5 text-primary-600 shrink-0" aria-hidden />
                  {t('b2bRegisterPartnershipTitle')}
                </h2>
                <div className="bg-slate-50 dark:bg-black rounded-2xl p-6 border border-slate-100 dark:border-[#2a1e17] text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
                  <h3 className={clsx('font-bold text-slate-900 dark:text-white mb-2', isRTL ? 'font-arabic' : 'font-sans')}>
                    {t('b2bRegisterContractTitle')}
                  </h3>
                  <p className={clsx('mb-4', isRTL ? 'font-arabic' : 'font-sans')}>{t('b2bRegisterContractIntro')}</p>
                  <p className={clsx('mb-4', isRTL ? 'font-arabic' : 'font-sans')}>{t('b2bRegisterContractOrders')}</p>
                  <p className={clsx('mb-4', isRTL ? 'font-arabic' : 'font-sans')}>{t('b2bRegisterContractPayment')}</p>
                  <p className={clsx('mb-4', isRTL ? 'font-arabic' : 'font-sans')}>{t('b2bRegisterContractQuality')}</p>
                  <p className={clsx('italic', isRTL ? 'font-arabic' : 'font-sans')}>
                    {t('b2bRegisterContractGenerated')} {contractDate}
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-6 pt-6">
                <button
                  className="w-full sm:w-auto px-10 py-4 bg-primary-600 text-white font-bold rounded-2xl shadow-lg shadow-primary-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 text-sm"
                  type="submit"
                  disabled={isLoading}
                >
                  {isLoading ? t('b2bRegisterSubmitting') : t('b2bRegisterSubmit')}
                  <ChevronRight className={clsx('w-5 h-5 shrink-0', isRTL && 'rotate-180')} aria-hidden />
                </button>
                <p className={clsx('text-xs text-slate-500 dark:text-zinc-500 flex-1 leading-relaxed text-center sm:text-start', isRTL ? 'font-arabic' : 'font-sans')}>
                  {t('b2bRegisterLegalPrefix')}{' '}
                  <span className="text-primary-600 cursor-pointer hover:underline font-semibold">{t('b2bRegisterTermsLink')}</span>.
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
};

export default B2BRegistration;
