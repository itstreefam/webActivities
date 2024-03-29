// user can change newTab and extensionTab according to their browser choice, as long as browser is built based on Chrome engine
// e.g. for Opera, newTab is "chrome://startpageshared/" and extensionTab is "chrome://extensions/"
// for Edge, newTab is "edge://newtab/" and extensionTab is "edge://extensions/"
const newTab = "chrome://newtab/";
const extensionTab = "chrome://extensions/";
let portNum = 4000;
let socket = undefined;
let captureLocalhost = false;
console.log('This is background service worker');

import { NavigationDatabase } from "./navigationdb";
const navigationDatabase = new NavigationDatabase();

// https://stackoverflow.com/questions/66618136/persistent-service-worker-in-chrome-extension
// create the offscreen document if it doesn't already exist
async function createOffscreen() {
	if (await chrome.offscreen.hasDocument?.()) return;
	await chrome.offscreen.createDocument({
		url: './dist/offscreen.html',
		reasons: ['BLOBS'],
		justification: 'keep service worker running',
	});
}

// a message from an offscreen document every 20 second resets the inactivity timer
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
	try{
		if (msg.keepAlive) {
			console.log('Service worker is alive');
			sendResponse({alive: true});
		}
		if (msg.devtools) {
			console.log('DevTools is open:', msg.devtools);
			sendResponse({devtools: msg.devtools});
		}
		if (msg.type) {
			if (msg.type === "pageHidden") {
				console.log('page is now hidden');
				sendResponse({type: "pageHidden"});
			} else {
				console.log('page is now visible');
				sendResponse({type: "pageVisible"});
			}
		}
		if (msg.action === "getCurrentTab") {
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
				// Directly send the necessary tab information
				sendResponse({tab: tabs.length > 0 ? tabs[0] : {}});
			});
			return true;
        }
	} catch (error) {
		console.log(error);
	}
});

// only reset the storage when one chrome window first starts up
chrome.runtime.onStartup.addListener(async function () {
	try {
		let windows = await getWindows();
		if(windows.length === 1){
			await writeLocalStorage('latestTab', {});
			await writeLocalStorage('closedTabId', -1);
			await writeLocalStorage('transitionsList', []);
			await writeLocalStorage('port', portNum.toString());
			await writeLocalStorage('curWindowId ' + windows[0].id.toString(), {
				"tabsList": [],
				"recording": false
			});
		}
		await createOffscreen();
		// await defineWebSocket(portNum);
	} catch (error) {
		console.err(error);
	}
});

async function getWindows() {
	return new Promise((resolve, reject) => {
		chrome.windows.getAll({ populate: false, windowTypes: ['normal'] }, function (windows) {
			resolve(windows);
		});
	});
}

// on install, if there is only chrome://extensions/ in the browser window, then make a new tab
chrome.runtime.onInstalled.addListener(async function (details) {
	try {
		await chrome.storage.local.clear();
		await writeLocalStorage('tableData', []);
		await writeLocalStorage('latestTab', {});
		await writeLocalStorage('closedTabId', -1);
		await writeLocalStorage('transitionsList', []);
		await writeLocalStorage('port', portNum.toString());

		if (details.reason === 'install') {
			let tabs = await getTabs();
			// if (tabs.length === 1 && tabs[0].url === extensionTab) {
			// 	chrome.tabs.create({ url: newTab });
			// }
			await writeLocalStorage('curWindowId ' + tabs[0].windowId.toString(), {
				"tabsList": [],
				"recording": false
			});
		}
		else {
			let lastFocusedWindow = await getLastFocusedWindow();
			await writeLocalStorage('curWindowId ' + lastFocusedWindow.id.toString(), {
				"tabsList": [],
				"recording": false
			});
		}
		await createOffscreen();
		// await defineWebSocket(portNum);
		
		// chrome.runtime.setUninstallURL('', function () {
		// 	// send message to draggablerecording to remove the element
		// 	chrome.runtime.sendMessage({ action: "removeControlUI" });
		// });

		chrome.contextMenus.create({
			title: 'Trigger draggable',
			contexts: ["all"],
			id: "myContextMenuId",
		})
	} catch (error) {
		console.error(error);
	}
});

chrome.contextMenus.onClicked.addListener((info, tab) =>
    testDraggable(tab.id).then(response => console.log(response))
);

function testDraggable(tabId) {
	return new Promise((resolve, reject) => {
		chrome.tabs.sendMessage(tabId, {message: "testDraggable"}, function (response) {
			if (chrome.runtime.lastError) {
				reject(chrome.runtime.lastError.message);
			} else {
				resolve(response);
			}
		});
	});
}

async function getLastFocusedWindow() {
	return new Promise((resolve, reject) => {
		chrome.windows.getLastFocused({ populate: false, windowTypes: ['normal'] }, function (currentWindow) {
			resolve(currentWindow);
		});
	});
}

// check windows focus since tabs.onActivated does not get triggered when navigating between different chrome windows
chrome.windows.onFocusChanged.addListener(async function (windowId) {
	try {	
		if (windowId !== -1) {
			let tabs = await getTabs();
			let latestTab = await readLocalStorage("latestTab");
			latestTab.prevId = latestTab.curId;
			latestTab.prevWinId = latestTab.curWinId;
			latestTab.curId = tabs[0].id;
			latestTab.curWinId = tabs[0].windowId;
			await writeLocalStorage("latestTab", latestTab);
	
			let tabInfo = await readLocalStorage(String(latestTab.curId));
			if (typeof tabInfo === "undefined") {
				return;
			}

			let prevTabInfo = await readLocalStorage(String(latestTab.prevId));
			if (typeof prevTabInfo === "undefined") {
				return;
			}

			if (latestTab.curWinId !== latestTab.prevWinId) {
				if (tabInfo.curUrl !== prevTabInfo.curUrl) {
					let curWindowInfo = await readLocalStorage('curWindowId ' + latestTab.curWinId.toString());
					let prevWindowInfo = await readLocalStorage('curWindowId ' + latestTab.prevWinId.toString());

					// only record transitions between two windows if both windows are recording
					if (curWindowInfo.recording && prevWindowInfo.recording) {
						let time = timeStamp();
						let filename = `screencapture-n${String(latestTab.curId)}_${time}.png`;

						if(tabInfo.recording) {
							let info = {
								curUrl: tabInfo.curUrl,
								curTabId: tabInfo.curTabId,
								prevUrl: prevTabInfo.curUrl,
								prevTabId: prevTabInfo.curTabId,
								curTitle: tabs[0].title,
								recording: tabInfo.recording,
								action: "revisit",
								time: time,
								img: filename
							};
							await writeLocalStorage(String(latestTab.curId), info);
							await navigationDatabase.addTabInfo(info);
							// await callDesktopCapture(filename);
						} else {
							let info = {
								curUrl: tabInfo.curUrl,
								curTabId: tabInfo.curTabId,
								prevUrl: prevTabInfo.curUrl,
								prevTabId: prevTabInfo.curTabId,
								curTitle: tabs[0].title,
								recording: tabInfo.recording,
								action: "revisit",
								time: time,
								img: ""
							};
							await writeLocalStorage(String(latestTab.curId), info);
							await navigationDatabase.addTabInfo(info);
						}
					}
				}
			}
		}
	} catch (error) {
		console.error(error);
	}
}, { windowTypes: ["normal"] });

chrome.windows.onCreated.addListener(async function (window) {
	try {
		let result = await readLocalStorage('curWindowId ' + window.id.toString());
		if (typeof result === 'undefined') {
			await writeLocalStorage('curWindowId ' + window.id.toString(), {
				"tabsList": [],
				"recording": false
			});
		}
	} catch (error) {
		console.error(error);
	}
});

// when a tab is opened, set appropriate info for latestTab
// tabs.onActivated handles tabs activities in the same chrome window
chrome.tabs.onActivated.addListener(async function (activeInfo) {
	console.log("onActivated: ", activeInfo);

	let tabs = await getTabs();
	let latestTab = await readLocalStorage('latestTab');
  
	// If the latestTab does not exist, set it for the first time
	if (!latestTab) {
		await writeLocalStorage('latestTab', {
			curId: tabs[0].id,
			curWinId: tabs[0].windowId,
			prevId: -1,
			prevWinId: -1,
		});
	  	return;
	}
  
	// Update the latestTab with the current values
	let updatedLatestTab = {
		...latestTab,
		prevId: latestTab.curId,
		prevWinId: latestTab.curWinId,
		curId: tabs[0].id,
		curWinId: tabs[0].windowId,
	};
	await writeLocalStorage('latestTab', updatedLatestTab);
  
	// If the tab is revisited
	let tabInfo = await readLocalStorage(String(updatedLatestTab.curId));
	let prevTabInfo = await readLocalStorage(String(updatedLatestTab.prevId));
	if (typeof tabInfo === 'undefined' || typeof prevTabInfo === 'undefined') {
	  	return;
	}
  
	let closedTabId = await readLocalStorage('closedTabId');
	let action = 'revisit';
  
	if (updatedLatestTab.curWinId !== updatedLatestTab.prevWinId) {
	  	return;
	}
  
	if (tabInfo.curUrl === prevTabInfo.curUrl) {
	  	return;
	}

	// only record transitions between two tabs if both tabs are recording
	if (!tabInfo.recording || !prevTabInfo.recording) {
		return;
	}

	let time = timeStamp();
	let filename = `screencapture-n${String(updatedLatestTab.curId)}_${time}.png`;

	if(tabInfo.recording){
		// Set the updated tab info
		let info = {
			curUrl: tabInfo.curUrl,
			curTabId: tabInfo.curTabId,
			prevUrl: prevTabInfo.curUrl,
			prevTabId: prevTabInfo.curTabId,
			curTitle: tabs[0].title,
			recording: tabInfo.recording,
			action: action,
			time: time,
			img: filename
		};
		await writeLocalStorage(String(updatedLatestTab.curId), info);
		await navigationDatabase.addTabInfo(info);
		// await callDesktopCapture(filename);
	} else {
		let info = {
			curUrl: tabInfo.curUrl,
			curTabId: tabInfo.curTabId,
			prevUrl: prevTabInfo.curUrl,
			prevTabId: prevTabInfo.curTabId,
			curTitle: tabs[0].title,
			recording: tabInfo.recording,
			action: action,
			time: time,
			img: ""
		};
		await writeLocalStorage(String(updatedLatestTab.curId), info);
		await navigationDatabase.addTabInfo(info);
	}
  
	if (closedTabId !== -1) {
		await writeLocalStorage('closedTabId', -1);
	}
});

chrome.tabs.onCreated.addListener(async function (tab) {
	// this event gets triggered more often in edge than chrome
	try {
		let curWindow = "curWindowId " + tab.windowId.toString();
		let curWindowInfo = await readLocalStorage(curWindow);
		if (typeof curWindowInfo === 'undefined') {
			return;
		}

		// if tab is newtab, write to local storage
		if (tab.url === newTab) {
			let info = {
				curUrl: tab.url,
				curTabId: tab.id,
				prevUrl: "",
				prevTabId: tab.id,
				curTitle: tab.title,
				recording: curWindowInfo.recording,
				action: "empty new tab",
				time: timeStamp(),
				img: ""
			};
			await writeLocalStorage(String(tab.id), info);
			await navigationDatabase.addTabInfo(info);
		}

		// check if the tab is in curWindowInfo.tabsList
		if(!curWindowInfo.tabsList.includes(tab.id)) {
			// add the tab to the list
			curWindowInfo.tabsList.push(tab.id);
			
			// update curWindowInfo
			await writeLocalStorage(curWindow, curWindowInfo);
		}
	} catch (error) {
		console.log(error);
	}
});
  
async function getTabs() {
	return new Promise(resolve => {
		chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
			resolve(tabs);
		});
	});
}

//on tab removed
chrome.tabs.onRemoved.addListener(async function (tabId, removeInfo) {
	await writeLocalStorage('closedTabId', tabId);

	let curWindow = "curWindowId " + removeInfo.windowId.toString();
	let curWindowInfo = await readLocalStorage(curWindow);
	if (typeof curWindowInfo === 'undefined') {
		return;
	}

	// check if the tab is in curWindowInfo.tabsList
	if(curWindowInfo.tabsList.includes(tabId)) {
		// remove the tab from the list
		let index = curWindowInfo.tabsList.indexOf(tabId);
		curWindowInfo.tabsList.splice(index, 1);

		// update curWindowInfo
		await writeLocalStorage(curWindow, curWindowInfo);
	}
});

chrome.storage.onChanged.addListener(function (changes) {
	Object.entries(changes).forEach(([key, { oldValue, newValue }]) => {
		console.log(key, oldValue, newValue);
		
		if (key.includes("curWindowId")) {
			return;
		}

		if (objCompare(oldValue, newValue)) {
			return;
		}

		try {
			if (newValue.recording !== undefined) {
				if (newValue.recording) {
					handleTableData([newValue]);
				}
			}
		} catch (error) {
			console.log(error);
		}
	});
});
  
async function handleTableData(newData) {
	let tableData = await readLocalStorage('tableData');
	if (tableData.length === 0) {
		await writeLocalStorage('tableData', newData);
		return;
	}
	await writeLocalStorage('tableData', tableData.concat(newData));
}

function objCompare(obj1, obj2) {
	if (typeof obj1 !== 'undefined' && typeof obj2 !== 'undefined') {
		// create deep copy of objects
		let o1 = { ...obj1 };
		let o2 = { ...obj2 };

		if(o1.hasOwnProperty('time')) {
			delete o1.time;
		}
		if(o2.hasOwnProperty('time')) {
			delete o2.time;
		}

		if(o1.curUrl && o1.curUrl.includes('localhost') && o2.curUrl && o2.curUrl.includes('localhost')) {
			return false;
		}

		if(o1.curUrl && containsIPAddresses(o1.curUrl) && o2.curUrl && containsIPAddresses(o2.curUrl)) {
			return false;
		}

		if(o1.action && o1.action.includes('reload') && o2.action && o2.action.includes('reload')) {
			return false;
		}

		return JSON.stringify(o1) === JSON.stringify(o2);
	}
}

function timeStamp() {
	let d = new Date();
	let seconds = Math.round(d.getTime() / 1000);
	return seconds;
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

function docReferrer() {
	return document.referrer;
}

function newTabChecker(id) {
	return new Promise((resolve, reject) => {
		chrome.tabs.query({ currentWindow: true }, function (tabs) {
			for (var i = 0; i < tabs.length; i++) {
				if (tabs[i].id == id) {
					resolve(tabs[i]);
				}
			}
			console.log("Tab not found");
			resolve(null);
		});
	});
}

chrome.tabs.onUpdated.addListener(async function (tabId, changeInfo, tab) {
	// console.log("onUpdated: ", changeInfo);
	if (changeInfo.status === 'loading') {
		// e.g. transtionsList = ['typed', 'link', 'link'] for Facebook
		// some events can be grouped together during web navigation 
		// => transitionsList[0] is the correct transition type
		let historyVisits = await getHistoryVisits(tab.url);
		if (historyVisits === null) {
			return;
		}

		let transitionList = await readLocalStorage('transitionsList');
		if (transitionList === undefined) {
			return;
		}

		let lastVisit = historyVisits[historyVisits.length - 1];
		let transitionType = lastVisit.transition;
		transitionList.push(transitionType);
		await writeLocalStorage('transitionsList', transitionList);
	}

	if (changeInfo.status === 'complete') {
		processTab(tab, tabId);
	}
});

async function getHistoryVisits(url) {
	return new Promise((resolve, reject) => {
		chrome.history.getVisits({ url: url }, function (visits) {
			if (visits.length > 0) {
				resolve(visits);
			} else {
				resolve(null);
			}
		});
	});
}

async function processTab(tabInfo, tabId){
	// console.log("processTab: ", tabInfo);

	let curWindow = "curWindowId " + tabInfo.windowId.toString();
	let curWindowInfo = await readLocalStorage(curWindow);
	if(typeof curWindowInfo === 'undefined') {
		return;
	}

	let curTabInfo = await readLocalStorage(tabId.toString());
	if(typeof curTabInfo === 'undefined') {
		let latestTabInfo = await readLocalStorage('latestTab');
		if(typeof latestTabInfo === 'undefined') {
			return;
		}

		if(latestTabInfo.curId === tabId) {
			let newTabInfo = await newTabChecker(tabId);
			if(newTabInfo === null) {
				return;
			}

			// hyperlink opened in new tab and new tab is active tab
			// or empty new tab is active tab (for omnibox search)
			if(newTabInfo.openerTabId) {
				let v = await readLocalStorage(newTabInfo.openerTabId.toString());
				if(typeof v !== 'undefined') {
					// console.log('case 1');
					// if there is hyperlink redirecting, then prevUrl and prevTabId exist
					// if simply opening a new tab, then prevUrl and prevTabId don't exist
					let time = timeStamp();
					let filename = `screencapture-n${tabId.toString()}_${time}.png`;

					if(newTabInfo.url !== newTab) {
						await writeLocalStorage('transitionsList', []);
					}

					if(typeof curWindowInfo.recording !== 'undefined') {
						if(curWindowInfo.recording) {
							let info = {
								curUrl: newTabInfo.url,
								curTabId: tabId,
								prevUrl: ((newTabInfo.url !== newTab) ? v.curUrl : ""),
								prevTabId: ((newTabInfo.url !== newTab) ? newTabInfo.openerTabId : tabId),
								curTitle: newTabInfo.title,
								recording: curWindowInfo.recording,
								action: ((newTabInfo.url !== newTab) ? "hyperlink opened in new tab and new tab is active tab" : "empty new tab is active tab"),
								time: time,
								img: filename
							};
							await writeLocalStorage(tabId.toString(), info);
							await navigationDatabase.addTabInfo(info);
							// await callDesktopCapture(filename);
						} else {
							let info = {
								curUrl: newTabInfo.url,
								curTabId: tabId,
								prevUrl: ((newTabInfo.url !== newTab) ? v.curUrl : ""),
								prevTabId: ((newTabInfo.url !== newTab) ? newTabInfo.openerTabId : tabId),
								curTitle: newTabInfo.title,
								recording: false,
								action: ((newTabInfo.url !== newTab) ? "hyperlink opened in new tab and new tab is active tab" : "empty new tab is active tab"),
								time: time,
								img: ""
							};
							await writeLocalStorage(tabId.toString(), info);
							await navigationDatabase.addTabInfo(info);
						}
					} else {
						let info = {
							curUrl: newTabInfo.url,
							curTabId: tabId,
							prevUrl: ((newTabInfo.url !== newTab) ? v.curUrl : ""),
							prevTabId: ((newTabInfo.url !== newTab) ? newTabInfo.openerTabId : tabId),
							curTitle: newTabInfo.title,
							recording: false,
							action: ((newTabInfo.url !== newTab) ? "hyperlink opened in new tab and new tab is active tab" : "empty new tab is active tab"),
							time: time,
							img: ""
						};
						await writeLocalStorage(tabId.toString(), info);
						await navigationDatabase.addTabInfo(info);
					}
				} else {
					// console.log('case 2');
					// this case happens when reloading the extension
					let time = timeStamp();
					let filename = `screencapture-n${String(tabId.toString())}_${time}.png`;

					if(newTabInfo.url !== newTab) {
						await writeLocalStorage('transitionsList', []);
					}

					if(typeof curWindowInfo.recording !== 'undefined') {
						if(curWindowInfo.recording) {
							let info = {
								curUrl: newTabInfo.url,
								curTabId: tabId,
								prevUrl: "",
								prevTabId: tabId,
								curTitle: newTabInfo.title,
								recording: curWindowInfo.recording,
								action: ((newTabInfo.url !== newTab) ? "hyperlink opened in new tab and new tab is active tab" : "empty new tab is active tab"),
								time: time,
								img: filename
							};
							await writeLocalStorage(tabId.toString(), info);
							await navigationDatabase.addTabInfo(info);
							// await callDesktopCapture(filename);
						} else {
							let info = {
								curUrl: newTabInfo.url,
								curTabId: tabId,
								prevUrl: "",
								prevTabId: tabId,
								curTitle: newTabInfo.title,
								recording: false,
								action: ((newTabInfo.url !== newTab) ? "hyperlink opened in new tab and new tab is active tab" : "empty new tab is active tab"),
								time: time,
								img: ""
							};
							await writeLocalStorage(tabId.toString(), info);
							await navigationDatabase.addTabInfo(info);
						}
					} else {
						let info = {
							curUrl: newTabInfo.url,
							curTabId: tabId,
							prevUrl: "",
							prevTabId: tabId,
							curTitle: newTabInfo.title,
							recording: false,
							action: ((newTabInfo.url !== newTab) ? "hyperlink opened in new tab and new tab is active tab" : "empty new tab is active tab"),
							time: time,
							img: ""
						};
						await writeLocalStorage(tabId.toString(), info);
						await navigationDatabase.addTabInfo(info);
					}
				}
			} else {
				if(typeof latestTabInfo.prevId === 'undefined') {
					// console.log('case 3');
					// this case happens when extension first installs (query a new tab)
					let time = timeStamp();
					let filename = `screencapture-n${String(tabId.toString())}_${time}.png`;

					if(newTabInfo.url !== newTab) {
						await writeLocalStorage('transitionsList', []);
					}

					if(typeof curWindowInfo.recording !== 'undefined') {
						if(curWindowInfo.recording) {
							let info = {
								curUrl: newTabInfo.url,
								curTabId: tabId,
								prevUrl: "",
								prevTabId: tabId,
								curTitle: newTabInfo.title,
								recording: curWindowInfo.recording,
								action: ((newTabInfo.url !== newTab) ? "hyperlink opened in new tab and new tab is active tab" : "empty new tab is active tab"),
								time: time,
								img: filename
							};
							await writeLocalStorage(tabId.toString(), info);
							await navigationDatabase.addTabInfo(info);
							// await callDesktopCapture(filename);
						} else {
							let info = {
								curUrl: newTabInfo.url,
								curTabId: tabId,
								prevUrl: "",
								prevTabId: tabId,
								curTitle: newTabInfo.title,
								recording: false,
								action: ((newTabInfo.url !== newTab) ? "hyperlink opened in new tab and new tab is active tab" : "empty new tab is active tab"),
								time: time,
								img: ""
							};
							await writeLocalStorage(tabId.toString(), info);
							await navigationDatabase.addTabInfo(info);
						}
					} else {
						let info = {
							curUrl: newTabInfo.url,
							curTabId: tabId,
							prevUrl: "",
							prevTabId: tabId,
							curTitle: newTabInfo.title,
							recording: false,
							action: ((newTabInfo.url !== newTab) ? "hyperlink opened in new tab and new tab is active tab" : "empty new tab is active tab"),
							time: time,
							img: ""
						};
						await writeLocalStorage(tabId.toString(), info);
						await navigationDatabase.addTabInfo(info);
					}
				} else {
					// console.log('case 4');
					// this case happens when hyperlink opened in new window
					let x = await readLocalStorage(latestTabInfo.prevId.toString());
					if(typeof x === 'undefined') {
						return;
					}
					let time = timeStamp();
					let filename = `screencapture-n${tabId.toString()}_${time}.png`;

					if(newTabInfo.url !== newTab) {
						await writeLocalStorage('transitionsList', []);
					}

					if(typeof curWindowInfo.recording !== 'undefined') {
						if(curWindowInfo.recording) {
							let info = {
								curUrl: newTabInfo.url,
								curTabId: tabId,
								prevUrl: x.curUrl,
								prevTabId: latestTabInfo.prevId,
								curTitle: newTabInfo.title,
								recording: curWindowInfo.recording,
								action: ((newTabInfo.url !== newTab) ? "hyperlink opened in new window" : "empty tab in new window is active tab"),
								time: time,
								img: filename
							};
							await writeLocalStorage(tabId.toString(), info);
							await navigationDatabase.addTabInfo(info);
							// await callDesktopCapture(filename);
						} else {
							let info = {
								curUrl: newTabInfo.url,
								curTabId: tabId,
								prevUrl: x.curUrl,
								prevTabId: latestTabInfo.prevId,
								curTitle: newTabInfo.title,
								recording: false,
								action: ((newTabInfo.url !== newTab) ? "hyperlink opened in new window" : "empty tab in new window is active tab"),
								time: time,
								img: ""
							};
							await writeLocalStorage(tabId.toString(), info);
							await navigationDatabase.addTabInfo(info);
						}
					} else {
						let info = {
							curUrl: newTabInfo.url,
							curTabId: tabId,
							prevUrl: x.curUrl,
							prevTabId: latestTabInfo.prevId,
							curTitle: newTabInfo.title,
							recording: false,
							action: ((newTabInfo.url !== newTab) ? "hyperlink opened in new window" : "empty tab in new window is active tab"),
							time: time,
							img: ""
						};
						await writeLocalStorage(tabId.toString(), info);
						await navigationDatabase.addTabInfo(info);
					}
				}
			}
		} else {
			// console.log('case 5');
			// hyperlink opened in new tab but new tab is not active tab
			let y = await readLocalStorage(latestTabInfo.curId.toString());
			if(typeof y === 'undefined') {
				return;
			}
			let time = timeStamp();
			let filename = `screencapture-n${tabId.toString()}_${time}.png`;

			if(tabInfo.url !== newTab) {
				await writeLocalStorage('transitionsList', []);
			}

			if(typeof curWindowInfo.recording !== 'undefined') {
				if(curWindowInfo.recording) {
					let info = {
						curUrl: tabInfo.url,
						curTabId: tabId,
						prevUrl: y.curUrl,
						prevTabId: latestTabInfo.curId,
						curTitle: tabInfo.title,
						recording: curWindowInfo.recording,
						action: ((tabInfo.url !== newTab) ? "hyperlink opened in new tab but new tab is not active tab" : "empty new tab is not active tab"),
						time: time,
						img: filename
					};
					await writeLocalStorage(tabId.toString(), info);
					await navigationDatabase.addTabInfo(info);
					// await callDesktopCapture(filename);
				} else {
					let info = {
						curUrl: tabInfo.url,
						curTabId: tabId,
						prevUrl: y.curUrl,
						prevTabId: latestTabInfo.curId,
						curTitle: tabInfo.title,
						recording: false,
						action: ((tabInfo.url !== newTab) ? "hyperlink opened in new tab but new tab is not active tab" : "empty new tab is not active tab"),
						time: time,
						img: ""
					};
					await writeLocalStorage(tabId.toString(), info);
					await navigationDatabase.addTabInfo(info);
				} 
			} else {
				let info = {
					curUrl: tabInfo.url,
					curTabId: tabId,
					prevUrl: y.curUrl,
					prevTabId: latestTabInfo.curId,
					curTitle: tabInfo.title,
					recording: false,
					action: ((tabInfo.url !== newTab) ? "hyperlink opened in new tab but new tab is not active tab" : "empty new tab is not active tab"),
					time: time,
					img: ""
				};
				await writeLocalStorage(tabId.toString(), info);
				await navigationDatabase.addTabInfo(info);
			}
		}
	} else {
		console.log('case 6');
		// it looks like in some cases where navigation is subtle, title is not up-to-date with the curUrl
		// so we need to update the title
		const title = await getUpdatedTitle(tabId);
		console.log("curTitle: ", title);
		let curTitle = tabInfo.title;
		if(title !== "") {
			curTitle = title;
		}

		// navigate between urls in a same tab
		if(curTabInfo.recording) {
			let time = timeStamp();
			let filename = `screencapture-n${tabId.toString()}_${time}.png`;
			let transition = await readLocalStorage('transitionsList');
			curTabInfo.action = "navigate between urls in the same tab";
			if(transition.length > 0) {
				curTabInfo.action = "navigate between urls in the same tab (" + transition[0] + ")";
			}
			await writeLocalStorage('transitionsList', []);
			curTabInfo.prevUrl = curTabInfo.curUrl;
			curTabInfo.curUrl = tabInfo.url;
			curTabInfo.prevTabId = tabInfo.id;
			curTabInfo.curTitle = curTitle;
			curTabInfo.time = time;
			curTabInfo.img = filename;
			await writeLocalStorage(tabId.toString(), curTabInfo);
			await navigationDatabase.addTabInfo(curTabInfo);
			// await callDesktopCapture(filename);
		} else {
			let time = timeStamp();
			let transition = await readLocalStorage('transitionsList');
			curTabInfo.action = "navigate between urls in the same tab";
			if(transition.length > 0) {
				curTabInfo.action = "navigate between urls in the same tab (" + transition[0] + ")";
			}
			await writeLocalStorage('transitionsList', []);
			curTabInfo.prevUrl = curTabInfo.curUrl;
			curTabInfo.curUrl = tabInfo.url;
			curTabInfo.prevTabId = tabInfo.id;
			curTabInfo.curTitle = curTitle;
			curTabInfo.time = time;
			curTabInfo.img = "";
			await writeLocalStorage(tabId.toString(), curTabInfo);
			await navigationDatabase.addTabInfo(curTabInfo);
		}
	}
}

function getUpdatedTitle(tabId) {
    return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, { message: "checkTitle" }, function (response) {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError.message);
            } else {
                resolve(response.title);
            }
        });
    });
}

async function websocketSendData(data) {
	try{
		let port = await readLocalStorage('port');
		if (typeof port === 'undefined') {
			return;
		}

		// check if there is an existing connection
		if (socket.readyState === WebSocket.CLOSED) {
			defineWebSocket(port);
		}
        socket.send(data);
	} catch (error) {
        console.error('Error sending data via WebSocket:', error);
    }
}

setInterval(async function() {
	// let tableData = await readLocalStorage('tableData');
	// if (typeof tableData === 'undefined') {
	// 	console.log("Table data is undefined");
	// 	return;
	// }

	// if (tableData.length > 0) {
	// 	console.log("exporting data to user's working project folder");
	// 	let copyData = tableData;

	// 	// remove the 'recording' keys from the newData
	// 	copyData = copyData.map(el => {
	// 		if (el.recording === true) delete el.recording
	// 		return el;
	// 	});

	// 	let result = JSON.stringify(copyData, undefined, 4);
	// 	// await websocketSendData(result);
	// 	console.log("Table data:", result);
	// }

	// let allTabInfos = await navigationDatabase.getAllTabInfos();
    // console.log("Fetched data:", allTabInfos);
	let recordingTabInfos = await navigationDatabase.getRecordingTabInfos();

	if(recordingTabInfos.length === 0) {
		return;
	} else {
		let copyData = recordingTabInfos;

		// remove the 'recording' keys from the newData
		copyData = copyData.map(el => {
			if (el.recording === true) delete el.recording
			return el;
		});

		let result = JSON.stringify(copyData, undefined, 4);
		// await websocketSendData(result);
		console.log("Table data:", result);
	}
}, 4000);


async function defineWebSocket(portNum){
	try {
		socket = new WebSocket('ws://localhost:' + portNum.toString() + '/');
		socket.addEventListener('open', (event) => {
			console.log('WebSocket connection opened:', event);
		});

		socket.addEventListener('message', (event) => {
			console.log('Message from server:', event.data);
			if(event.data === 'Switched from VS Code to Chrome'){
				// if current tab contains localhost or IPv4 or IPv6, then reload the page
				chrome.tabs.query({ active: true, currentWindow: true, windowType: "normal" }, function (tabs) {
					if(tabs.length === 0) {
						return;
					}
					var y = tabs[0].url;
					if(y.includes("localhost") || containsIPAddresses(y)) {
						captureLocalhost = true;
						chrome.tabs.reload(tabs[0].id);
					}
				});
			}
		});

		socket.addEventListener('close', (event) => {
			console.log('WebSocket connection closed:', event);
		});

		socket.addEventListener('error', (error) => {
			console.error('WebSocket Error:', error);
		});
	} catch (error) {
		console.error(error);
	}
}

// when every chrome window is closed, close the websocket connection
chrome.windows.onRemoved.addListener(async function (windowId) {
	try {
		let windows = await getWindows();
		if (windows.length === 0) {
			socket.close();
		}
	} catch (error) {
		console.error(error);
	}
});

async function callDesktopCapture(filename){
	return new Promise((resolve, reject) => {
		socket.send(JSON.stringify({
			action: 'Capture localhost',
			filename: filename
		}));

		socket.addEventListener('message', (event) => {
			const responseData = JSON.parse(event.data);
			if (responseData.status === "success") {
				console.log("Captured filename successfully: ", filename);
			}
		});

		socket.addEventListener('error', (error) => {
			console.error('WebSocket Error:', error);
		});
	});
}

function containsIPAddresses(url) {
	// Define regex patterns for matching IPv4 and IPv6 addresses
	const ipv4Pattern = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;
	const ipv6Pattern = /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/;

	// Use the regex `test` method to check if the URL contains an IPv4 or IPv6 address
	return ipv4Pattern.test(url) || ipv6Pattern.test(url);
}