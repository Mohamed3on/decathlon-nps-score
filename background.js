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

chrome.webNavigation.onHistoryStateUpdated.addListener(
  (details) => {
    if (details.frameId !== 0) return;
    chrome.scripting.executeScript({
      target: { tabId: details.tabId },
      files: ['uniqlo-pdp.js'],
    });
  },
  {
    url: [
      { hostContains: 'uniqlo.com', pathContains: '/products/' },
    ],
  }
);

chrome.webNavigation.onHistoryStateUpdated.addListener(
  (details) => {
    if (details.frameId !== 0) return;
    chrome.scripting.executeScript({
      target: { tabId: details.tabId },
      files: ['ikea-pdp.js', 'ikea-plp.js'],
    });
  },
  {
    url: [
      { hostContains: 'ikea.com', pathContains: '/p/' },
    ],
  }
);
