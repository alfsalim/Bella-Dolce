/** Fired on `window` when Settings toggles system alerts (same-tab; `storage` alone is not enough). */
export const SYSTEM_ALERTS_PREFERENCE_EVENT = 'bd-system-alerts-changed';

export function notifySystemAlertsPreferenceChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SYSTEM_ALERTS_PREFERENCE_EVENT));
}
