import navigationDB from './navigationdb';
const db = navigationDB.db;

// Utility functions
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

async function readLocalStorage(key) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([key], function (result) {
      if (result[key] === undefined) {
        resolve(undefined);
      } else {
        resolve(result[key]);
      }
    });
  });
}

async function tabInfoExists(curTabId) {
  const count = await db.navigationTable.where('curTabId').equals(curTabId).count();
  return count > 0;
}

function timeStamp() {
  let d = new Date();
  let seconds = Math.round(d.getTime() / 1000);
  return seconds;
}

function replaceTextInParentheses(text, replacement) {
  if (text.includes('(') && text.includes(')')) {
    return text.replace(/\(.*?\)/g, `(${replacement})`);
  }
  return `${text} (${replacement})`;
}

// Setup General Settings
async function setupGeneralSettings() {
  await setupProjectPath();
  await setupScreenshotCapture();
  await setupPortConfiguration();
  await setupRecordAllTabs();
}

// Project Path Setup
async function setupProjectPath() {
  const pathInput = document.getElementById('projectPathInput');
  const updatePathBtn = document.getElementById('updatePathBtn');
  const currentPath = document.getElementById('currentPath');
  
  // Load current path
  try {
    const projectPath = await readLocalStorage('projectPath');
    const displayPath = projectPath || 'Using default from webActivities\\node\\index.js';
    currentPath.textContent = `Current: ${displayPath}`;
    pathInput.value = projectPath || '';
  } catch (error) {
    currentPath.textContent = 'Current: Error loading path';
  }
  
  // Update button handler
  updatePathBtn.addEventListener('click', async () => {
    const newPath = pathInput.value.trim();
    if (!newPath) {
      return;
    }
    
    try {
      await writeLocalStorage('projectPath', newPath);
      currentPath.textContent = `Current: ${newPath}`;
      
      // Send to background script
      chrome.runtime.sendMessage({
        action: 'updateSettings',
        settings: { projectPath: newPath }
      });
      
    } catch (error) {
      console.error('Failed to update project path:', error);
    }
  });
}

// Screenshot Capture Setup
async function setupScreenshotCapture() {
  const screenshotToggle = document.getElementById('screenshotToggle');
  
  // Load current setting
  try {
    const enableCapture = await readLocalStorage('enableCapture');
    screenshotToggle.checked = enableCapture !== undefined ? enableCapture : true;
  } catch (error) {
    screenshotToggle.checked = true;
  }
  
  // Toggle handler
  screenshotToggle.addEventListener('change', async () => {
    try {
      await writeLocalStorage('enableCapture', screenshotToggle.checked);
      
      // Send to background script
      chrome.runtime.sendMessage({
        action: 'updateSettings',
        settings: { enableCapture: screenshotToggle.checked }
      });
      
    } catch (error) {
      console.error('Failed to update screenshot setting:', error);
    }
  });
}

// Port Configuration Setup
async function setupPortConfiguration() {
  const portInput = document.getElementById('portInput');
  const updatePortBtn = document.getElementById('updatePortBtn');
  
  // Load current port
  try {
    const port = await readLocalStorage('port');
    portInput.value = port || '4000';
  } catch (error) {
    portInput.value = '4000';
  }
  
  // Update button handler
  updatePortBtn.addEventListener('click', async () => {
    const newPort = parseInt(portInput.value);
    if (!newPort || newPort < 1000 || newPort > 65535) {
      return;
    }
    
    try {
      await writeLocalStorage('port', newPort.toString());
    } catch (error) {
      console.error('Failed to update port:', error);
    }
  });
}

// Record All Tabs Setup
async function setupRecordAllTabs() {
  const recordAllToggle = document.getElementById('recordAllToggle');
  
  try {
    let currentWindow = await chrome.windows.getLastFocused({ populate: true, windowTypes: ['normal'] });
    let curWindowId = `curWindowId ${currentWindow.id}`;
    let curWindowInfo = await readLocalStorage(curWindowId);
    
    recordAllToggle.checked = curWindowInfo?.recording ?? false;
    
    recordAllToggle.addEventListener('change', async () => {
      const tabsList = currentWindow.tabs.map(tab => tab.id);
      
      // Update current window recording status
      curWindowInfo.recording = recordAllToggle.checked;
      await writeLocalStorage(curWindowId, { 
        tabsList: tabsList, 
        recording: curWindowInfo.recording 
      });
      
      // Update all individual tab toggles
      const individualToggles = document.querySelectorAll('.tabs-list .toggle-switch');
      individualToggles.forEach(toggle => {
        toggle.checked = recordAllToggle.checked;
      });
      
      // Process updates for each tab
      const updates = currentWindow.tabs.map(async (tab) => {
        const tabIdStr = tab.id.toString();
        const tabInfo = await readLocalStorage(tabIdStr);
        if (tabInfo) {
          tabInfo.recording = recordAllToggle.checked;
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
      
      await Promise.all(updates);
    });
    
  } catch (error) {
    console.error("Failed to setup record all tabs:", error);
  }
}

// Individual Tabs Setup
async function setupIndividualTabs() {
  const tabsList = document.getElementById('tabsList');
  
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    
    for (const tab of tabs) {
      const tabItem = document.createElement('div');
      tabItem.className = 'tab-item';
      
      // Tab info container
      const tabInfo = document.createElement('div');
      tabInfo.className = 'tab-info';
      
      const tabTitle = document.createElement('div');
      tabTitle.className = 'tab-title';
      tabTitle.textContent = tab.title || 'Untitled';
      tabTitle.title = tab.title; // Tooltip for full title
      
      const tabUrl = document.createElement('div');
      tabUrl.className = 'tab-url';
      tabUrl.textContent = tab.url;
      tabUrl.title = tab.url; // Tooltip for full URL
      
      tabInfo.appendChild(tabTitle);
      tabInfo.appendChild(tabUrl);
      
      // Toggle switch
      const toggle = document.createElement('input');
      toggle.type = 'checkbox';
      toggle.className = 'toggle-switch';
      toggle.id = `tab-${tab.id}`;
      
      // Check if tab exists in database
      let tabInfoExistsInDb = await tabInfoExists(tab.id);
      if (!tabInfoExistsInDb) {
        const curWindowInfo = await readLocalStorage(`curWindowId ${tab.windowId}`);
        toggle.checked = curWindowInfo?.recording ?? false;
        
        const tabInfoData = {
          curUrl: tab.url,
          curTabId: tab.id,
          prevUrl: "",
          prevTabId: tab.id,
          curTitle: tab.title,
          recording: toggle.checked,
          action: "add opened tab that is not in storage",
          time: timeStamp(),
          img: ""
        };
        
        await writeLocalStorage(tab.id.toString(), tabInfoData);
        await navigationDB.addTabInfo("navigationTable", tabInfoData);
      } else {
        const existingTabInfo = await readLocalStorage(tab.id.toString());
        toggle.checked = existingTabInfo?.recording ?? false;
      }
      
      // Toggle event listener
      toggle.addEventListener('change', async () => {
        const tabInfoData = await readLocalStorage(tab.id.toString());
        if (tabInfoData) {
          tabInfoData.recording = toggle.checked;
          tabInfoData.action = replaceTextInParentheses(
            tabInfoData.action,
            toggle.checked ? 'recording on' : 'recording off'
          );
          
          await writeLocalStorage(tab.id.toString(), tabInfoData);
          await navigationDB.updateTabInfoByCurTabId(tab.id, tabInfoData);
          await chrome.tabs.sendMessage(tab.id, { action: "updateRecording", recording: tabInfoData.recording });
        }
      });
      
      tabItem.appendChild(tabInfo);
      tabItem.appendChild(toggle);
      tabsList.appendChild(tabItem);
    }
  } catch (error) {
    console.error("Failed to setup individual tabs:", error);
  }
}

// Initialize popup
window.onload = async function () {
  try {
    await setupGeneralSettings();
    await setupIndividualTabs();
  } catch (error) {
    console.error("Failed to initialize popup:", error);
  }
};