import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { ChefHat, Smartphone, User as UserIcon, Lock, ArrowRight } from 'lucide-react';
import { Navigate } from 'react-router-dom';

const Login: React.FC = () => {
  const { login, register, user, profile, loading } = useAuth();
  const { t } = useLanguage();
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isRegistering) {
        await register(username, password, name);
      } else {
        await login(username, password);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
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
        <div className="hidden md:flex flex-col justify-between p-12 bg-primary-600 relative overflow-hidden">
          <div 
            className="absolute inset-0 opacity-20 bg-cover bg-center" 
            style={{ backgroundImage: "url('https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=1000')" }}
          ></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center shadow-xl overflow-hidden">
                <img 
                  src="/logo.jpg" 
                  alt="Bella Dolce" 
                  className="w-full h-full object-contain" 
                  referrerPolicy="no-referrer" 
                />
              </div>
            </div>
            <p className="text-primary-100 text-lg font-medium max-w-xs">Artisanal excellence delivered from our ovens to your morning table.</p>
          </div>
          
          <div className="relative z-10">
            <div className="flex -space-x-3 mb-4">
              {[1, 2, 3].map((i) => (
                <img 
                  key={i}
                  className="w-10 h-10 rounded-full border-2 border-primary-600" 
                  src={`https://i.pravatar.cc/100?img=${i + 10}`} 
                  alt="Customer"
                />
              ))}
            </div>
            <p className="text-white/80 text-sm italic">"The best croissant I've had outside of Paris."</p>
          </div>
        </div>

        {/* Form Column */}
        <div className="p-8 md:p-16 flex flex-col justify-center bg-white dark:bg-[#0a0a0a]">
          <div className="mb-10">
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              {isRegistering ? 'Join the Atelier' : 'Welcome Back'}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">
              {isRegistering ? 'Create your account to start your artisanal journey.' : 'Access your account to manage your orders.'}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100">
              {error}
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            {isRegistering && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Full Name</label>
                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input 
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-black border-none rounded-xl focus:ring-2 focus:ring-primary-600 transition-all text-sm text-slate-900 dark:text-white" 
                      placeholder="John Doe" 
                      type="text" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">{t('username')}</label>
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input 
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-black border-none rounded-xl focus:ring-2 focus:ring-primary-600 transition-all text-sm text-slate-900 dark:text-white" 
                  placeholder="johndoe" 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input 
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-black border-none rounded-xl focus:ring-2 focus:ring-primary-600 transition-all text-sm text-slate-900 dark:text-white" 
                  placeholder="••••••••" 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button 
              type="submit"
              className="w-full py-4 bg-primary-600 text-white font-bold rounded-2xl shadow-lg shadow-primary-600/20 hover:scale-[1.02] active:scale-95 transition-all text-sm flex items-center justify-center gap-3"
            >
              {isRegistering ? 'Register' : t('login')}
            </button>

            <div className="text-center space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {isRegistering ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button 
                  type="button"
                  onClick={() => setIsRegistering(!isRegistering)}
                  className="text-primary-600 font-bold hover:underline"
                >
                  {isRegistering ? 'Login here' : 'Register here'}
                </button>
              </p>
              
              {!isRegistering && (
                <div className="pt-4 border-t border-slate-100 dark:border-[#2a1e17]">
                  <p className="text-xs text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-widest font-bold">Business Customer?</p>
                  <a 
                    href="/b2b-register"
                    className="inline-flex items-center gap-2 text-primary-600 font-bold text-sm hover:underline"
                  >
                    Register for a B2B Account
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
