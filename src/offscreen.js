// send a message every 20 sec to service worker
setInterval(() => {
  chrome.runtime.sendMessage({ keepAlive: true }, (response) => {
    if (!response || chrome.runtime.lastError) {
      console.log('Service worker is not responding');
    } else {
      console.log(response);
    }
  });
}, 20000);