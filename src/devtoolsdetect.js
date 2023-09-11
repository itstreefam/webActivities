// import devtools from './node/node_modules/devtools-detect/index.js';
window.onload = function() {
    // https://github.com/sindresorhus/devtools-detect
    const devtools = require('devtools-detect');
    
    // // Check if it's open
    // console.log('Is DevTools open:', devtools.isOpen);
    chrome.runtime.sendMessage({devtools: devtools.isOpen});
    
    // Get notified when it's opened/closed or orientation changes
    window.addEventListener('devtoolschange', event => {
        // console.log('Is DevTools open:', event.detail.isOpen);
        chrome.runtime.sendMessage({devtools: event.detail.isOpen});
    });
}

// (async () => {
//     const src = chrome.runtime.getURL("./node/node_modules/devtools-detect/index.js");
//     const devtools = await import(src);

//     chrome.runtime.sendMessage({devtools: devtools.isOpen});
//     chrome.runtime.sendMessage({devtoolsOrientation: devtools.orientation});

//     window.addEventListener('devtoolschange', event => {
//         // console.log('Is DevTools open:', event.detail.isOpen);
//         // console.log('DevTools orientation:', event.detail.orientation);

//         chrome.runtime.sendMessage({devtools: event.detail.isOpen});
//         chrome.runtime.sendMessage({devtoolsOrientation: event.detail.orientation});
//     });
// })();