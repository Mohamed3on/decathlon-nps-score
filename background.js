chrome.webNavigation.onHistoryStateUpdated.addListener(
  (details) => {
    if (details.frameId !== 0) return;
    chrome.scripting.executeScript({
      target: { tabId: details.tabId },
      files: ['content-script.js'],
    });
  },
  {
    url: [
      { hostContains: 'decathlon.de', pathContains: '/p/' },
      { hostContains: 'decathlon.co.uk', pathContains: '/p/' },
    ],
  }
);
