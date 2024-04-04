import Dexie from 'dexie';

let db = new Dexie('NavigationDatabase');
db.version(1).stores({
  navigationTable: '++id, curTabId, curUrl, prevUrl, prevTabId, curTitle, recording, action, time, img',
  navigationHistoryTable: '++id, curTabId, curUrl, prevUrl, prevTabId, curTitle, recording, action, time, img'
});

// Check if a tab info record exists in history
async function tabInfoExistsInHistory(curTabId) {
  const count = await db.navigationHistoryTable.where('curTabId').equals(curTabId).count();
  return count > 0;
}

// Add a new tab info record
async function addTabInfo(tabInfo) {
  try {
    await db.navigationTable.add(tabInfo);
    if (tabInfo.recording === true) {
      let tabInfoExistsInDb = await tabInfoExistsInHistory(tabInfo.curTabId);
      if (!tabInfoExistsInDb) {
        await db.navigationHistoryTable.add(tabInfo);
      }
    }
    console.log('Tab info added successfully:', tabInfo);
  } catch (error) {
    console.error('Failed to add tab info:', error);
  }
}

// Update tab info based on curTabId
async function updateTabInfoByCurTabId(curTabId, updates) {
  try {
    await db.navigationTable.where('curTabId').equals(curTabId).modify(updates);
    if (updates.recording === true) {
      let tabInfoExistsInDb = await tabInfoExistsInHistory(curTabId);
      if (!tabInfoExistsInDb) {
        await db.navigationHistoryTable.add(updates);
      } else {
        await db.navigationHistoryTable.where('curTabId').equals(curTabId).modify(updates);
      }
    }
    console.log(`Tab info with curTabId ${curTabId} updated successfully.`);
  } catch (error) {
    console.error(`Failed to update tab info with curTabId ${curTabId}:`, error);
  }
}

// Sets a key and stores its value into the storage
async function writeLocalStorage(key, value) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [key]: value }, function () {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError.message);
      } else {
        resolve();
      }
    });
  });
}

// Gets a key value from the storage
async function readLocalStorage(key) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([key], function (result) {
      if (result[key] === undefined) {
        console.log("Key not found in chrome storage");
        resolve(undefined);
      } else {
        resolve(result[key]);
      }
    });
  });
}

async function setupRecordAllTabs() {
  const recordAllTabs = document.getElementById("recordAllTabs");
  const toggleAllTabs = document.createElement("input");
  toggleAllTabs.type = "checkbox";
  toggleAllTabs.className = "toggle";

  const divAllTabs = document.createElement("div");
  divAllTabs.className = "url";

  const textNodeAllTabs = document.createTextNode("Record all tabs in current window");
  divAllTabs.appendChild(textNodeAllTabs);
  divAllTabs.appendChild(toggleAllTabs);
  recordAllTabs.appendChild(divAllTabs);

  try {
    const currentWindow = await chrome.windows.getLastFocused({ populate: true, windowTypes: ['normal'] });
    const curWindowId = `curWindowId ${currentWindow.id}`;
    const curWindowInfo = await readLocalStorage(curWindowId);
    console.log("Current window info:", curWindowInfo);

    toggleAllTabs.id = `switchAllTabs ${currentWindow.id}`;
    toggleAllTabs.checked = curWindowInfo?.recording ?? false;

    toggleAllTabs.addEventListener("click", async () => {
      const urlList = document.getElementById("urlList");
      urlList.querySelectorAll(".toggle").forEach(async (toggle) => {
        toggle.checked = toggleAllTabs.checked;
      });

      const currentWindow = await chrome.windows.getLastFocused({ populate: true, windowTypes: ['normal'] });
      const tabsList = currentWindow.tabs.map(async (tab) => tab.id);
      const updates = currentWindow.tabs.map(async (tab) => {
        const tabInfo = await readLocalStorage(tab.id.toString());
        if (tabInfo) {
          tabInfo.recording = toggleAllTabs.checked;
          await writeLocalStorage(tab.id.toString(), tabInfo);
          await updateTabInfoByCurTabId(tab.id, tabInfo);
          await chrome.tabs.sendMessage(tab.id, { action: "updateRecording", recording: toggleAllTabs.checked });
        }
      });

      await Promise.all([tabsList, updates]);
      await writeLocalStorage(curWindowId, { tabsList: tabsList, recording: toggleAllTabs.checked});
    });
  } catch (error) {
    console.error("Failed to setup recording for all tabs:", error);
  }
}

// Check if a tab info record exists
async function tabInfoExists(curTabId) {
  const count = await db.navigationTable.where('curTabId').equals(curTabId).count();
  return count > 0;
}

/* record any individual tab in current window */
// loop through currently tabs and get their title
async function setupIndividualTab() {
  const urlList = document.getElementById("urlList");
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    for (const tab of tabs) {
      const url = tab.url;
      const title = tab.title;
      const id = tab.id;
      const toggle = document.createElement("input");
      toggle.type = "checkbox";
      toggle.id = `switch ${id}`;
      toggle.className = "toggle";

      // add a div to hold the toggle switch and the title
      const div = document.createElement("div");
      div.className = "url";

      let tabInfoExistsInDb = await tabInfoExists(id);
      if (!tabInfoExistsInDb) {
        const curWindowInfo = await readLocalStorage(`curWindowId ${tab.windowId}`);
        toggle.checked = curWindowInfo?.recording ?? false;
        const tabInfo = {
          curUrl: url,
          curTabId: id,
          prevUrl: "",
          prevTabId: id,
          curTitle: title,
          recording: toggle.checked,
          action: "add opened tab that is not in storage",
          time: timeStamp(),
          img: ""
        };
        await writeLocalStorage(id.toString(), tabInfo);
        await addTabInfo(tabInfo);
      } else {
        const existingTabInfo = await readLocalStorage(id.toString());
        toggle.checked = existingTabInfo.recording;
      }

      // add the title to the div
      const textNode = document.createTextNode(title);
      div.appendChild(textNode);

      // add the toggle switch to the div
      div.appendChild(toggle);

      // add the div to the urlList
      urlList.appendChild(div);

      toggle.addEventListener("click", async () => {
        const value = await readLocalStorage(id.toString());
        if (typeof value !== 'undefined') {
          value.recording = toggle.checked;
          await writeLocalStorage(id.toString(), value);
          await updateTabInfoByCurTabId(id, value);
          await chrome.tabs.sendMessage(id, { action: "updateRecording", recording: toggle.checked });
        }
      });
    }
  } catch (error) {
    console.error("Failed to set up individual tabs:", error);
  }
}

function timeStamp() {
  let d = new Date();
  let seconds = Math.round(d.getTime() / 1000);
  return seconds;
}

async function setupPortNumber() {
  const portInfo = document.getElementById("portInfo");
  const form = document.createElement("form");
  portInfo.appendChild(form);
  
  const label = document.createElement("label");
  label.textContent = "Port number:";
  form.appendChild(label);

  const input = document.createElement("input");
  input.type = "text";
  input.id = "portNumber";
  form.appendChild(input);

  const submit = document.createElement("input");
  submit.type = "submit";
  submit.value = "Update";
  form.appendChild(submit);

  try {
    const portValue = await readLocalStorage("port");
    input.value = portValue || ""; // Fallback to an empty string if port is not set
    input.style.width = `${input.value.length * 10}px`;

    form.addEventListener("submit", async (e) => {
      e.preventDefault(); // Prevent form from submitting the traditional way
      console.log("port: " + input.value);
      await writeLocalStorage("port", input.value);
      input.style.width = `${input.value.length * 10}px`;
    });
  } catch (error) {
    console.error("Failed to retrieve port number from storage:", error);
  }
}


window.onload = async function () {
  await setupRecordAllTabs();
  await setupIndividualTab();
  await setupPortNumber();

  // await chrome.runtime.onMessage.addListener(async function (request, sender, sendResponse) {
  //   if(request.action === "startRecording") {
  //     // make sure tab info exists in storage
  //     let tabInfoExistsInDb = await tabInfoExists(request.tabId);
  //     if (!tabInfoExistsInDb) {
  //       const tab = await chrome.tabs.get(request.tabId);
  //       const tabInfo = {
  //         curUrl: tab.url,
  //         curTabId: tab.id,
  //         prevUrl: "",
  //         prevTabId: tab.id,
  //         curTitle: tab.title,
  //         recording: true,
  //         action: "start recording",
  //         time: timeStamp()
  //       };
  //       await writeLocalStorage(tab.id.toString(), tabInfo);
  //       await addTabInfo(tabInfo);
  //     } else {
  //       const existingTabInfo = await readLocalStorage(request.tabId.toString());
  //       existingTabInfo.recording = true;
  //       // grab the switch element and set it to checked
  //       const toggle = document.getElementById(`switch ${request.tabId}`);
  //       toggle.checked = true;
  //       await writeLocalStorage(request.tabId.toString(), existingTabInfo);
  //       await updateTabInfoByCurTabId(request.tabId, existingTabInfo);
  //     }
  //   }

  //   if(request.action === "stopRecording") {
  //     const existingTabInfo = await readLocalStorage(request.tabId.toString());
  //     existingTabInfo.recording = false;
  //     // grab the switch element and set it to unchecked
  //     const toggle = document.getElementById(`switch ${request.tabId}`);
  //     toggle.checked = false;
  //     await writeLocalStorage(request.tabId.toString(), existingTabInfo);
  //     await updateTabInfoByCurTabId(request.tabId, existingTabInfo);
  //   }
  // });
};

