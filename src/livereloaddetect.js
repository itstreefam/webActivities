// window.onbeforeunload = function() {
//     chrome.runtime.sendMessage({name: "beforeunload"});
//     // chrome.runtime.sendMessage({name: "beforeunload", navigationType: print_nav_timing_data()});
//     // print_nav_timing_data();
// };

window.onload = function() {
    const rrweb = require('rrweb');
    var events = [];
    rrweb.record({
        emit(event) {
            console.log(event);
            if (event.data.adds && event.data.adds.some(add => {
                return add.node.attributes && add.node.attributes.src && add.node.attributes.src.includes("hot-update.js");
            })) {
                console.log("Found hot-update.js");
                // ... further actions ...
            }
        },    
    });
};