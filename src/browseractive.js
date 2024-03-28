// detect when a page is hidden from user
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        // console.log('page is now hidden');
        chrome.runtime.sendMessage({type: "pageHidden"}, (response) => {
            if (!response || chrome.runtime.lastError) {
                console.log('Service worker is not responding');
            } else {
                console.log(response);
            }
        });
    } else {
        // console.log('page is now visible');
        chrome.runtime.sendMessage({type: "pageVisible"}, (response) => {
            if (!response || chrome.runtime.lastError) {
                console.log('Service worker is not responding');
            } else {
                console.log(response);
            }
        });
    }
});