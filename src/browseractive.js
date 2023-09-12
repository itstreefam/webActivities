window.onload = function() {
    // detect when a page is hidden from user
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            console.log('page is now hidden');
            chrome.runtime.sendMessage({type: "pageHidden"});
        } else {
            console.log('page is now visible');
            chrome.runtime.sendMessage({type: "pageVisible"});
        }
    });
}    