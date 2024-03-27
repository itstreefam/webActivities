// https://github.com/sindresorhus/devtools-detect
const devtools = require('devtools-detect');

// // Check if it's open
console.log('Is DevTools open:', devtools.isOpen);
// chrome.runtime.sendMessage({devtools: window.devtools.isOpen}, (response) => {
//     if (!response || chrome.runtime.lastError) {
//         console.log('Service worker is not responding');
//     } else {
//         console.log(response);
//     }
// });

// Get notified when it's opened/closed or orientation changes
window.addEventListener('devtoolschange', event => {
    console.log('Is DevTools open:', event.detail.isOpen);
    // chrome.runtime.sendMessage({devtools: event.detail.isOpen}, (response) => {
    //     if (!response || chrome.runtime.lastError) {
    //         console.log('Service worker is not responding');
    //     } else {
    //         console.log(response);
    //     }
    // });
});
