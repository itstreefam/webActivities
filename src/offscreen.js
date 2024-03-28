let keepAliveIntervelId;

// send a message every 10 sec to service worker
keepAliveIntervelId = setInterval(() => {
  try {
    chrome.runtime.sendMessage({ keepAlive: true }, (response) => {
      if (!response || chrome.runtime.lastError) {
        console.log('Service worker is not responding');
      } else {
        console.log(response);
      }
    });
  } catch (e) {
    // not the best approach to detecting extension uninstallation
    // but it's a start since chrome.runtime.onSuspend doesnt work
    console.log('Extension is uninstalled. Performing cleanup...');
    
    // remove UI elements
    const draggableRecording = document.getElementById('draggable-recording');
    if (draggableRecording) {
      draggableRecording.remove();
    }

    // remove interval
    clearInterval(keepAliveIntervelId);
  }
}, 10000);