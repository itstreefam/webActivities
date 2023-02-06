window.onload = function () {

  function timeStamp() {
    let d = new Date();
    let seconds = Math.round(d.getTime() / 1000);
    return seconds;
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

  /* record all tabs in current window */
  var recordAllTabs = document.getElementById("recordAllTabs");
  var toggleAllTabs = document.createElement("input");
  toggleAllTabs.type = "checkbox";
  toggleAllTabs.className = "toggle";

  var divAllTabs = document.createElement("div");
  divAllTabs.className = "url";

  var textNodeAllTabs = document.createTextNode("Record all tabs in current window");
  divAllTabs.appendChild(textNodeAllTabs);
  divAllTabs.appendChild(toggleAllTabs);
  recordAllTabs.appendChild(divAllTabs);

  chrome.windows.getLastFocused({ populate: true, windowTypes: ['normal'] }, function (currentWindow) {
    getStorageKeyValue("curWindowId " + currentWindow.id.toString(), function (curWindowInfo) {
      if(typeof curWindowInfo !== 'undefined'){
        toggleAllTabs.id = "switchAllTabs " + currentWindow.id;
        toggleAllTabs.checked = curWindowInfo.recording;
      } else {
        toggleAllTabs.id = "switchAllTabs " + currentWindow.id;
        toggleAllTabs.checked = false;
      }

      // add event listener to toggleAllTabs
      toggleAllTabs.addEventListener("click", function () {

        // updating UI for all tabs in current window
        var urlList = document.getElementById("urlList");
        var urlListChildren = urlList.children;
        for (var i = 0; i < urlListChildren.length; i++) {
          var urlListChild = urlListChildren[i];
          var urlListChildChildren = urlListChild.children;
          for (var j = 0; j < urlListChildChildren.length; j++) {
            var urlListChildChild = urlListChildChildren[j];
            if (urlListChildChild.className == "toggle") {
              urlListChildChild.checked = toggleAllTabs.checked;
            }
          }
        }

        // set recording for all tabs in current window
        let tabsList = [];
        for (let i = 0; i < currentWindow.tabs.length; i++) {
          tabsList.push(currentWindow.tabs[i].id);
          getStorageKeyValue(currentWindow.tabs[i].id.toString(), function (tabInfo) {
            if (typeof tabInfo !== 'undefined') {
              tabInfo.recording = toggleAllTabs.checked;
              setStorageKey(currentWindow.tabs[i].id.toString(), tabInfo);
            }
          });
        }
        setStorageKey("curWindowId " + currentWindow.id.toString(), {
          recording: toggleAllTabs.checked,
          tabsList: tabsList
        });
      });

    });
  });

  /* record any individual tab in current window */
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
          toggle.checked = false;
          setStorageKey(id.toString(), {
            "curUrl": url,
            "curTabId": id,
            "prevUrl": "",
            "prevTabId": id,
            "curTitle": title,
            "recording": toggle.checked,
            "action": "add opened tab that is not in storage",
            "time": timeStamp()
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
  
  /* port number */
  let portInfo = document.getElementById("portInfo");
  // make a form to hold the port number
  let form = document.createElement("form");
  portInfo.appendChild(form);
  let label = document.createElement("label");
  label.innerHTML = "Port number: ";
  form.appendChild(label);
  let input = document.createElement("input");
  input.type = "text";
  input.id = "portNumber";
  input.value = "";
  form.appendChild(input);

  getStorageKeyValue("port", function (value) {
    input.value = value;
    input.style.width = (input.value.length * 10) + "px";
  });

  let submit = document.createElement("input");
  submit.type = "submit";
  submit.value = "Update";
  form.appendChild(submit);

  form.addEventListener("submit", function (e) {
    // e.preventDefault();
    console.log("port: " + input.value);
    setStorageKey("port", input.value);
    input.style.width = (input.value.length * 10) + "px";
  });
};

