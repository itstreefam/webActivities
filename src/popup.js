import Dexie from 'dexie';

let db = new Dexie('NavigationDatabase');
db.version(1).stores({
  navigationTable: '++id, curTabId, curUrl, prevUrl, prevTabId, curTitle, recording, action, time, img',
});

// Add a new tab info record
async function addTabInfo(tabInfo) {
  try {
    await db.navigationTable.add(tabInfo);
    console.log('Tab info added successfully:', tabInfo);
  } catch (error) {
    console.error('Failed to add tab info:', error);
  }
}

// Update an existing tab info record
async function updateTabInfo(id, updates) {
  try {
    await db.navigationTable.update(id, updates);
    console.log(`Tab info with id ${id} updated successfully.`);
  } catch (error) {
    console.error(`Failed to update tab info with id ${id}:`, error);
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

    toggleAllTabs.id = `switchAllTabs ${currentWindow.id}`;
    toggleAllTabs.checked = curWindowInfo?.recording ?? false;

    toggleAllTabs.addEventListener("click", async () => {
      // updating UI for all tabs in current window
      const urlList = document.getElementById("urlList");
      for (const urlListChild of urlList.children) {
        for (const urlListChildChild of urlListChild.children) {
          if (urlListChildChild.className === "toggle") {
            urlListChildChild.checked = toggleAllTabs.checked;
          }
        }
      }

      // set recording for all tabs in current window
      const tabsList = currentWindow.tabs.map(tab => tab.id);
      for (const tab of currentWindow.tabs) {
        const tabInfo = await readLocalStorage(tab.id.toString());
        if (tabInfo) {
          tabInfo.recording = toggleAllTabs.checked;
          await writeLocalStorage(tab.id.toString(), tabInfo);
        }
      }
      await writeLocalStorage(curWindowId, { recording: toggleAllTabs.checked, tabsList });
    });
  } catch (error) {
    console.error("Failed to setup recording for all tabs:", error);
  }
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

      let tabInfo = await readLocalStorage(id.toString());
      if (typeof tabInfo === 'undefined') {
        const curWindowInfo = await readLocalStorage(`curWindowId ${tab.windowId}`);
        toggle.checked = curWindowInfo?.recording ?? false;
        tabInfo = {
          curUrl: url,
          curTabId: id,
          prevUrl: "",
          prevTabId: id,
          curTitle: title,
          recording: toggle.checked,
          action: "add opened tab that is not in storage",
          time: timeStamp()
        };
        await writeLocalStorage(id.toString(), tabInfo);
        await updateTabInfo(id, tabInfo);
      } else {
        toggle.checked = tabInfo.recording;
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
          await addTabInfo(value);
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
};

