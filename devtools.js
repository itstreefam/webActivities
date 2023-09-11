// Create a DevTools panel
chrome.devtools.panels.create("Logger", null, "panel.html", function (panel) {
    // Panel created
});
  
// Set up a connection to the content script
const backgroundPageConnection = chrome.runtime.connect({
    name: "devtools-page"
});

backgroundPageConnection.postMessage({
    name: 'init',
    tabId: chrome.devtools.inspectedWindow.tabId
});
