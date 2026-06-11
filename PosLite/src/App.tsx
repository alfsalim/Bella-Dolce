import React, { useEffect, useState } from 'react';
import { useAuthStore } from './store/auth';
import { usePreferencesStore } from './store/preferences';
import { getSyncMeta } from './db';
import Login from './pages/Login';
import POS from './pages/pos/POS';
import Settings from './pages/Settings';

const App: React.FC = () => {
  const cashier = useAuthStore((s) => s.cashier);
  const loadPreferences = usePreferencesStore((s) => s.load);
  const [showSettings, setShowSettings] = useState(false);
  const [checkingFirstRun, setCheckingFirstRun] = useState(true);

  useEffect(() => {
    Promise.all([
      getSyncMeta().then((meta) => {
        if (!meta.serverBaseUrl) setShowSettings(true);
      }),
      loadPreferences(),
    ]).then(() => setCheckingFirstRun(false));
  }, [loadPreferences]);

  if (checkingFirstRun) return null;

  if (showSettings) {
    return <Settings onClose={() => setShowSettings(false)} />;
  }

  return cashier ? (
    <POS onOpenSettings={() => setShowSettings(true)} />
  ) : (
    <Login onOpenSettings={() => setShowSettings(true)} />
  );
};

export default App;
