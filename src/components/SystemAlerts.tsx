import React, { useEffect } from 'react';
import { db, collection, onSnapshot, query, where, limit, orderBy } from '../lib/firebase';
import { Bell } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

const SystemAlerts: React.FC = () => {
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    if (loading || !user || !profile) return;

    // Only staff/admins should get system alerts for new orders
    const isStaff = ['admin', 'manager', 'cashier', 'baker'].includes(profile.role);
    if (!isStaff) return;

    const alertsEnabled = localStorage.getItem('systemAlerts') === 'true';
    if (!alertsEnabled) return;

    const q = query(
      collection(db, 'orders'),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    let initialLoad = true;
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (initialLoad) {
        initialLoad = false;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const order = change.doc.data();
          toast.custom((t) => (
            <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white dark:bg-slate-900 shadow-lg rounded-2xl pointer-events-auto flex ring-1 ring-black ring-opacity-5`}>
              <div className="flex-1 w-0 p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0 pt-0.5">
                    <div className="h-10 w-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                      <Bell className="h-6 w-6 text-primary-600" />
                    </div>
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-50">
                      Nouvelle commande !
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Une nouvelle commande de {order.customerName || 'Client'} vient d'arriver.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex border-l border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => toast.dismiss(t.id)}
                  className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-bold text-primary-600 hover:text-primary-500 focus:outline-none"
                >
                  Fermer
                </button>
              </div>
            </div>
          ), { duration: 5000 });
        }
      });
    }, (error) => {
      console.error('SystemAlerts onSnapshot error:', error);
    });

    return () => unsubscribe();
  }, [user, profile, loading]);

  return null;
};

export default SystemAlerts;
