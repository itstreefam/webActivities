// window.onbeforeunload = function() {
//     chrome.runtime.sendMessage({name: "beforeunload"});
//     // chrome.runtime.sendMessage({name: "beforeunload", navigationType: print_nav_timing_data()});
//     // print_nav_timing_data();
// };

function print_nav_timing_data() {
    // Use getEntriesByType() to just get the "navigation" events
    var perfEntries = performance.getEntriesByType("navigation");
    var str = "";
  
    for (var i=0; i < perfEntries.length; i++) {
      console.log("= Navigation entry[" + i + "]");
      var p = perfEntries[i];
      // dom Properties
      console.log("DOM content loaded = " + (p.domContentLoadedEventEnd - p.domContentLoadedEventStart));
      console.log("DOM complete = " + p.domComplete);
      console.log("DOM interactive = " + p.interactive);
   
      // document load and unload time
      console.log("document load = " + (p.loadEventEnd - p.loadEventStart));
      console.log("document unload = " + (p.unloadEventEnd - p.unloadEventStart));
      
      // other properties
      console.log("type = " + p.type);
      console.log("redirectCount = " + p.redirectCount);

        str += "= Navigation entry[" + i + "]\n";
        str += "DOM content loaded = " + (p.domContentLoadedEventEnd - p.domContentLoadedEventStart) + "\n";
        str += "DOM complete = " + p.domComplete + "\n";
        str += "DOM interactive = " + p.interactive + "\n";
        str += "document load = " + (p.loadEventEnd - p.loadEventStart) + "\n";
        str += "document unload = " + (p.unloadEventEnd - p.unloadEventStart) + "\n";
        str += "type = " + p.type + "\n";
        str += "redirectCount = " + p.redirectCount + "\n";
    }
    return str;
  }

window.onload = function() {
    // const rrweb = require('rrweb');
    // var events = [];
    // rrweb.record({
    //     emit(event) {
    //         console.log(event);
    //         events.push(event);
    //     },
    // });
    // initForm();

    const scriptWithNonce = document.querySelector('script[nonce]');
    if (scriptWithNonce) {
        const nonce = scriptWithNonce.nonce;

        const scriptContent = `
        const OriginalWebSocket = window.WebSocket;
        window.WebSocket = function(...args) {
            const instance = new OriginalWebSocket(...args);

            instance.addEventListener('message', (event) => {
                // Log all WebSocket messages (for inspection)
                console.log('WebSocket message:', event.data);
            });

            return instance;
        };`;

        const scriptElement = document.createElement('script');
        scriptElement.nonce = nonce;
        scriptElement.textContent = scriptContent;
        (document.head || document.documentElement).appendChild(scriptElement);
        scriptElement.remove();
    } else {
        console.warn("No script with nonce found on the page.");
    }

}

function initForm() {
    // Create the form element
    var form = window.document.createElement("form");
    form.name = "refreshForm";

    // Create the input element
    var input = window.document.createElement("input");
    input.type = "hidden";
    input.name = "visited";
    input.value = "";

    // Append the input to the form
    form.appendChild(input);

    // Append the form to the body
    window.document.body.appendChild(form);

    checkRefresh();
}

function checkRefresh() {
    // Get the form
    let form = window.document.forms["refreshForm"];

    // Get the value of the hidden input
    let visited = form.elements["visited"].value;

    // Check if the page is visited or not
    if (visited == "") {
        // The page is not visited, set the hidden input value
        form.elements["visited"].value = 1;

        // This is a fresh page load
        // You may want to add code here special for
        // fresh page loads
        chrome.runtime.sendMessage({name: "beforeunload", navigationType: "fresh"});
    } else {
        // This is a page refresh
        // Insert code here representing what to do on
        // a refresh
        chrome.runtime.sendMessage({name: "beforeunload", navigationType: "refresh"});
    }
}

// if (module.hot) {
//     module.hot.accept(() => {
//       // Post a message to the content script
//       window.postMessage({ type: "HOT_RELOAD" }, "*");
//     });
//   }
  