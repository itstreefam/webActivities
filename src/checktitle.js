chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.message === "checkTitle") {
        // Wait for 1.25 second before sending the response
        setTimeout(function () {
            let title = document.title;
            sendResponse({ title: title });
        }, 1250);

        return true;  // This indicates that sendResponse will be called asynchronously
    }
});
