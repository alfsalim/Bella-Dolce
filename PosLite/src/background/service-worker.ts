import { runSyncCycle, refreshCachesIfOnline } from '../sync/engine';

const SYNC_ALARM = 'pos-lite-sync';
const REFRESH_ALARM = 'pos-lite-refresh';

// BRD §7.1: every 30s reachability check + sync; §7.4: slower 15min cache refresh.
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(SYNC_ALARM, { periodInMinutes: 0.5 });
  chrome.alarms.create(REFRESH_ALARM, { periodInMinutes: 15 });
});

// Toolbar icon click opens the till as a standalone app window (no popup,
// no browser tab chrome) instead of a tab — manifest has no default_popup.
chrome.action.onClicked.addListener(() => {
  chrome.windows.create({
    url: chrome.runtime.getURL('index.html'),
    type: 'popup',
    width: 1280,
    height: 800,
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SYNC_ALARM) {
    runSyncCycle();
  } else if (alarm.name === REFRESH_ALARM) {
    refreshCachesIfOnline();
  }
});

// BRD §7.1: trigger sync immediately when the device comes back online.
// (Service workers can't listen to window 'online' directly; the POS page
// forwards this via chrome.runtime messaging.)
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'pos-lite:online' || message?.type === 'pos-lite:sync-now') {
    runSyncCycle().then(sendResponse);
    return true;
  }
  if (message?.type === 'pos-lite:refresh-caches') {
    refreshCachesIfOnline().then(() => sendResponse({ ok: true }));
    return true;
  }
  return false;
});
