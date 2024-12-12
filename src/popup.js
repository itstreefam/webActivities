import navigationDB from './navigationdb';
const db = navigationDB.db;

// Check if a tab info record exists
async function tabInfoExists(curTabId) {
  const count = await db.navigationTable.where('curTabId').equals(curTabId).count();
  return count > 0;
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
    let currentWindow = await chrome.windows.getLastFocused({ populate: true, windowTypes: ['normal'] });
    let curWindowId = `curWindowId ${currentWindow.id}`;
    let curWindowInfo = await readLocalStorage(curWindowId);

    toggleAllTabs.id = `switchAllTabs ${currentWindow.id}`;
    toggleAllTabs.checked = curWindowInfo?.recording ?? false;

    toggleAllTabs.addEventListener("click", async () => {
      const urlList = document.getElementById("urlList");
      const toggles = urlList.querySelectorAll(".toggle");
      for (let toggle of toggles) {
        toggle.checked = toggleAllTabs.checked; // Update UI immediately
      }
      const tabsList = currentWindow.tabs.map(tab => tab.id);

      // Update current window recording status
      curWindowInfo.recording = toggleAllTabs.checked;
      await writeLocalStorage(curWindowId, { tabsList: tabsList, recording: curWindowInfo.recording });

      // Process updates for each tab
      const updates = currentWindow.tabs.map(async (tab) => {
        const tabIdStr = tab.id.toString();
        const tabInfo = await readLocalStorage(tabIdStr);
        if (tabInfo) {
          tabInfo.recording = toggleAllTabs.checked;
          if(tabInfo.recording){
              tabInfo.action = replaceTextInParentheses(tabInfo.action, 'recording on');
          } else {
              tabInfo.action = replaceTextInParentheses(tabInfo.action, 'recording off');
          }

          await writeLocalStorage(tabIdStr, tabInfo);
          await navigationDB.updateTabInfoByCurTabId(tab.id, tabInfo);
          await chrome.tabs.sendMessage(tab.id, { action: "updateRecording", recording: tabInfo.recording });
        }
      });

      // Wait for all updates to complete
      await Promise.all(updates);
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
        await navigationDB.addTabInfo("navigationTable", tabInfo);
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
        const tabInfo = await readLocalStorage(id.toString());
        if (typeof tabInfo !== 'undefined') {
          tabInfo.recording = toggle.checked;
          if(tabInfo.recording){
              tabInfo.action = replaceTextInParentheses(tabInfo.action, 'recording on');
          } else {
              tabInfo.action = replaceTextInParentheses(tabInfo.action, 'recording off');
          }
          
          await writeLocalStorage(id.toString(), tabInfo);
          await navigationDB.updateTabInfoByCurTabId(id, tabInfo);
          await chrome.tabs.sendMessage(id, { action: "updateRecording", recording: tabInfo.recording });
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

function replaceTextInParentheses(text, replacement) {
  // Check if the text contains parentheses
  if (text.includes('(') && text.includes(')')) {
      // Use a regular expression to match text within parentheses
      return text.replace(/\(.*?\)/g, `(${replacement})`);
  }
  // Return the original text + (replacement)
  return `${text} (${replacement})`
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

