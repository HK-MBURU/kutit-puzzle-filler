// background.js
chrome.runtime.onInstalled.addListener(() => {
  console.log('✅ Auto Assignment Bot installed.');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message === 'ping') sendResponse('pong');
});
