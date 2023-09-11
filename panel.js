console.log("Content script running");

// Listen for messages from the DevTools page
// Make a connection to the background page
const backgroundPageConnection = chrome.runtime.connect({
    name: "devtools-page"
});
  
backgroundPageConnection.onMessage.addListener(function (message) {
    if (message.name === "log") {
        const logElement = document.getElementById("logs");
        logElement.innerHTML += `<div>${message.data}</div>`;
    }
});
  
  