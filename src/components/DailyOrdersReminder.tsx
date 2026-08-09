import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Clock, X } from 'lucide-react';
import { format } from 'date-fns';
import { db, collection, getDocs } from '../lib/db';
import { authFetch, getAuthHeaders } from '../lib/api-client';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { isStaffRole } from '../lib/staff-nav';
import { Order } from '../types';

const CHECK_INTERVAL_MS = 60_000;
const UNFULFILLED_STATUSES: Order['status'][] = ['ordered', 'in-progress', 'delayed'];

const DailyOrdersReminder: React.FC = () => {
  const { user, profile, loading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [pendingOrders, setPendingOrders] = useState<Order[] | null>(null);

  useEffect(() => {
    if (loading || !user || !profile || !isStaffRole(profile.role)) return;

    let cancelled = false;

    const checkReminder = async () => {
      try {
        const configRes = await authFetch('/api/db/settings/order_reminder_config', { headers: getAuthHeaders() });
        const config = configRes.ok ? await configRes.json() : null;
        if (config?.enabled === false) return;
        const reminderTime = typeof config?.time === 'string' ? config.time : '06:00';

        const now = new Date();
        const [hh, mm] = reminderTime.split(':').map((n: string) => parseInt(n, 10));
        const reminderMinutes = (Number.isFinite(hh) ? hh : 6) * 60 + (Number.isFinite(mm) ? mm : 0);
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        if (nowMinutes < reminderMinutes) return;

        const todayStr = format(now, 'yyyy-MM-dd');
        const storageKey = `bd_order_reminder_shown_${profile.id}_${todayStr}`;
        if (localStorage.getItem(storageKey)) return;

        // expectedDate is a plain "YYYY-MM-DD" String column, not DateTime — the generic
        // where-clause layer (both client and server side) coerces calendar-day-shaped
        // strings into ISO datetimes, which breaks equality on this field. Filter client-side.
        const snapshot = await getDocs(collection(db, 'orders'));
        const todaysOrders = snapshot.docs
          .map((d: any) => ({ id: d.id, ...d.data() } as Order))
          .filter((o: Order) => o.expectedDate === todayStr && UNFULFILLED_STATUSES.includes(o.status));

        localStorage.setItem(storageKey, '1');
        if (!cancelled && todaysOrders.length > 0) {
          setPendingOrders(todaysOrders);
        }
      } catch (err) {
        console.error('Order reminder check failed:', err);
      }
    };

    void checkReminder();
    const interval = setInterval(checkReminder, CHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user, profile, loading]);

  if (!pendingOrders || pendingOrders.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div role="dialog" aria-label={t('orderReminderTitle')} className="bg-white dark:bg-[#1a1512] w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 dark:border-[#2a1e17]">
        <div className="p-6 border-b border-slate-100 dark:border-[#2a1e17] flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-500" />
            {t('orderReminderTitle')}
          </h2>
          <button
            type="button"
            onClick={() => setPendingOrders(null)}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-3 max-h-96 overflow-y-auto">
          <p className="text-sm text-slate-600 dark:text-slate-300">{t('orderReminderDesc')}</p>
          {pendingOrders.map((order) => (
            <div key={order.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-[#1a1512] rounded-xl">
              <div>
                <p className="font-bold text-slate-900 dark:text-white text-sm">
                  {order.type === 'special'
                    ? [order.firstName, order.lastName].filter(Boolean).join(' ') || t('walkInCustomer')
                    : order.clientName || t('walkInCustomer')}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">#{order.id.slice(-6).toUpperCase()}</p>
              </div>
              <div className="flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                <Clock className="w-3 h-3" />
                {order.expectedTime}
              </div>
            </div>
          ))}
        </div>
        <div className="p-6 pt-0 flex justify-end gap-3">
          <button type="button" onClick={() => setPendingOrders(null)} className="btn-secondary">
            {t('close')}
          </button>
          <button
            type="button"
            onClick={() => { setPendingOrders(null); navigate('/orders'); }}
            className="btn-primary"
          >
            {t('orderReminderViewOrders')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DailyOrdersReminder;
