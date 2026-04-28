chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ tracefyInstalledAt: Date.now() });
});
