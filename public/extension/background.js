// Sutra Extension — background.js
// Service worker: handles keyboard shortcuts and badge updates

const DEFAULT_SUTRA_URL = 'https://sutra.vercel.app';

// Listen for extension install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['sutraUrl'], (result) => {
    if (!result.sutraUrl) {
      chrome.storage.local.set({ sutraUrl: DEFAULT_SUTRA_URL });
    }
  });
});

// Handle keyboard shortcut (Alt+S) to open popup
chrome.commands.onCommand.addListener((command) => {
  if (command === 'open-sutra') {
    chrome.action.openPopup().catch(() => {
      // Fallback: open Sutra in new tab
      chrome.storage.local.get(['sutraUrl'], (result) => {
        chrome.tabs.create({ url: `${result.sutraUrl || DEFAULT_SUTRA_URL}/dashboard` });
      });
    });
  }
});
