window.onload = function () {

  function timeStamp() {
    var time = Date.now || function () {
      return +new Date;
    };
    return time();
  }

  function setStorageKey(key, value) {
    chrome.storage.local.set({ [key]: value });
  }

  function getStorageKeyValue(id, onGetStorageKeyValue) {
    chrome.storage.local.get(null, function (result) {
      for (var key in result) {
        if (id.toString() == key) {
          return onGetStorageKeyValue(result[key]);
        }
      }
      onGetStorageKeyValue(undefined);
    });
  }

  // loop through currently tabs and get their title
  chrome.tabs.query({ currentWindow: true }, function (tabs) {
    let urlList = document.getElementById("urlList");
    for (let i = 0; i < tabs.length; i++) {
      let tab = tabs[i];
      let url = tab.url;
      let title = tab.title;
      let id = tab.id;

      let toggle = document.createElement("input");
      toggle.type = "checkbox";
      toggle.id = "switch " + id.toString();
      toggle.className = "toggle";
      // toggle.checked = true;

      // add a div to hold the toggle switch and the title
      let div = document.createElement("div");
      div.className = "url";

      getStorageKeyValue(id, function (value) {
        if (typeof value === 'undefined') {
          toggle.checked = true;
          setStorageKey(id.toString(), {
            "curUrl": url,
            "curTabId": id,
            "prevUrl": "",
            "prevTabId": id,
            "recording": toggle.checked,
            "action": "add opened tab that is not in storage",
            "time": new Date(timeStamp()).toLocaleString('en-US')
          });
        }
        else {
          toggle.checked = value.recording;
        }

        // add the title to the div
        let textNode = document.createTextNode(title);
        div.appendChild(textNode);

        // add the toggle switch to the div
        div.appendChild(toggle);
      });

      // add the div to the ul
      urlList.appendChild(div);

      toggle.addEventListener("click", function () {
        getStorageKeyValue(id, function (value) {
          if (typeof value !== 'undefined') {
            value.recording = toggle.checked;
            setStorageKey(id.toString(), value);
          }
        });
      });
    }
  });

};

