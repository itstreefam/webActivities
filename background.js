// user can change newTab and extensionTab according to their browser choice, as long as browser is built based on Chrome engine
// e.g. for Opera, newTab is "chrome://startpageshared/" and extensionTab is "chrome://extensions/"
// for Edge, newTab is "edge://newtab/" and extensionTab is "edge://extensions/"
const newTab = "chrome://newtab/";
const extensionTab = "chrome://extensions/";
let portNum = 4000;

chrome.alarms.create("postDataToNode", {
	delayInMinutes: 0.1,
	periodInMinutes: 0.15
});

// only reset the storage when one chrome window first starts up
chrome.windows.getAll({ populate: false, windowTypes: ['normal'] }, function (windows) {
	if (windows.length == 1) {
		chrome.runtime.onStartup.addListener(function () {
			chrome.storage.local.clear();
			setStorageKey('tableData', []);
			setStorageKey('latestTab', {});
			setStorageKey('closedTabId', -1);
			setStorageKey('transitionsList', []);
			setStorageKey('port', portNum.toString());
			setStorageKey('curWindowId ' + windows[0].id.toString(), {
				"tabsList": [],
				"recording": true
			});
		});
	}
});

console.log('This is background service worker - edit me!');

// on install, if there is only chrome://extensions/ in the browser window, then make a new tab
chrome.runtime.onInstalled.addListener(function (details) {
	if (details.reason === 'install') {
		chrome.tabs.query({ currentWindow: true }, function (tabs) {
			if (tabs.length === 1 && tabs[0].url === extensionTab) {
				chrome.tabs.create({ url: newTab });
			}
			chrome.storage.local.clear();
			setStorageKey('tableData', []);
			setStorageKey('latestTab', {});
			setStorageKey('closedTabId', -1);
			setStorageKey('transitionsList', []);
			setStorageKey('port', portNum.toString());
			setStorageKey('curWindowId ' + tabs[0].windowId.toString(), {
				"tabsList": [],
				"recording": true
			});
		});
	}
	else {
		chrome.windows.getLastFocused({ populate: false, windowTypes: ['normal'] }, function (currentWindow) {
			chrome.storage.local.clear();
			setStorageKey('tableData', []);
			setStorageKey('latestTab', {});
			setStorageKey('closedTabId', -1);
			setStorageKey('transitionsList', []);
			setStorageKey('port', portNum.toString());
			setStorageKey('curWindowId ' + currentWindow.id.toString(), {
				"tabsList": [],
				"recording": true
			});
		});
	};
});

// check windows focus since tabs.onActivated does not get triggered when navigating between different chrome windows
chrome.windows.onFocusChanged.addListener(function (windowId) {
	if(windowId != -1) {
		// get current focused tab
		chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
			getStorageKeyValue('latestTab', function (value) {
				value.prevId = value.curId;
				value.prevWinId = value.curWinId;
				value.curId = tabs[0].id;
				value.curWinId = tabs[0].windowId;
				setStorageKey('latestTab', value);

				// if tab is revisited
				getStorageKeyValue(String(value.curId), function (tabInfo) {
					getStorageKeyValue(String(value.prevId), function (prevTabInfo) {
						try {
							if (typeof tabInfo.action !== 'undefined') {
								if(value.curWinId !== value.prevWinId) {
									if(tabInfo.curUrl !== prevTabInfo.curUrl) {
										setStorageKey(String(value.curId), {
											"curUrl": tabInfo.curUrl,
											"curTabId": tabInfo.curTabId,
											"prevUrl": prevTabInfo.curUrl,
											"prevTabId": prevTabInfo.curTabId,
											"curTitle": tabs[0].title,
											"recording": tabInfo.recording,
											"action": "revisit",
											"time": timeStamp()
										});
									}
								}
							}
						} catch(error) {
							console.log(error);
						} 
					});
				});
			});
		});
	}
}, { windowTypes: ['normal'] });

chrome.windows.onCreated.addListener(function (window) {
	getStorageKeyValue('curWindowId ' + window.id.toString(), function (result) {
		if(typeof result === 'undefined') {
			setStorageKey('curWindowId ' + window.id.toString(), {
				"tabsList": [],
				"recording": true
			});
		}
	});
});

// when a tab is opened, set appropriate info for latestTab
// tabs.onActivated handles tabs activities in the same chrome window
chrome.tabs.onActivated.addListener(function (activeInfo) {
	chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
		getStorageKeyValue('latestTab', function (value) {
			if(value.length == 0) {
				setStorageKey('latestTab', {
					curId: activeInfo.tabId,
					curWinId: activeInfo.windowId,
					prevId: -1,
					prevWinId: -1
				});
			} else {
				value.prevId = value.curId;
				value.prevWinId = value.curWinId;
				value.curId = tabs[0].id;
				value.curWinId = tabs[0].windowId;

				setStorageKey('latestTab', value);

				// if tab is revisited
				getStorageKeyValue(String(value.curId), function (tabInfo) {
					getStorageKeyValue(String(value.prevId), function (prevTabInfo) {
						try {
							if (typeof tabInfo.action !== 'undefined') {
								if(value.curWinId === value.prevWinId) {
									if(tabInfo.curUrl !== prevTabInfo.curUrl) {
										getStorageKeyValue('closedTabId', function (closedTabId) {
											if(closedTabId === -1) {
												setStorageKey(String(value.curId), {
													"curUrl": tabInfo.curUrl,
													"curTabId": tabInfo.curTabId,
													"prevUrl": prevTabInfo.curUrl,
													"prevTabId": prevTabInfo.curTabId,
													"curTitle": tabs[0].title,
													"recording": tabInfo.recording,
													"action": "revisit",
													"time": timeStamp()
												});
											} else {
												setStorageKey(String(value.curId), {
													"curUrl": tabInfo.curUrl,
													"curTabId": tabInfo.curTabId,
													"prevUrl": prevTabInfo.curUrl,
													"prevTabId": prevTabInfo.curTabId,
													"curTitle": tabs[0].title,
													"recording": tabInfo.recording,
													"action": "revisit after previous tab closed",
													"time": timeStamp()
												});

												setStorageKey('closedTabId', -1);
											}
										});
									}
								}
							}
						} catch(error) {
							console.log(error);
						} 
					});
				});
			}
		});
	});
});

//on tab removed
chrome.tabs.onRemoved.addListener(function (tabId, removeInfo) {
	setStorageKey('closedTabId', tabId);

	let curWindow = "curWindowId " + removeInfo.windowId.toString();
	getStorageKeyValue(curWindow, function (curWindowInfo) {
		if(typeof curWindowInfo !== 'undefined') {
			// check if the tab is in curWindowInfo.tabsList
			if(curWindowInfo.tabsList.includes(tabId)) {
				// remove the tab from the list
				let index = curWindowInfo.tabsList.indexOf(tabId);
				curWindowInfo.tabsList.splice(index, 1);

				// update curWindowInfo
				setStorageKey(curWindow, curWindowInfo);
			}
		}
	});
});

chrome.storage.onChanged.addListener(function (changes, namespace) {
	for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
		console.log(key, oldValue, newValue);

		// no need to evaluate curWindowInfo
		if(key.includes("curWindowId")) {
			continue;
		}

		// only push the data to the table if oldValue object is different from newValue object
		// to avoid when the page loads more content as the scrollbar is scrolled down
		if (!objCompare(oldValue, newValue)) {
			try {
				// if newValue.recording is true
				if (typeof newValue.recording !== 'undefined') {
					if (newValue.recording) {
						// save the data to the storage
						getStorageKeyValue('tableData', function (value) {
							if(value.length === 0) {
								setStorageKey('tableData', [newValue]);
							}
							else {
								let newData = value.concat([newValue]);
								setStorageKey('tableData', newData);
							}
						});
					}
				}
			} catch(error) {
				console.log(error);
			} 
		}
	}
});

function objCompare(obj1, obj2) {
	if (typeof obj1 !== 'undefined' && typeof obj2 !== 'undefined') {
		let keys1 = Object.keys(obj1);
		let keys2 = Object.keys(obj2);

		// delete the time key
		keys1.splice(keys1.indexOf('time'), 1);
		keys2.splice(keys2.indexOf('time'), 1);

		if (keys1.length !== keys2.length) {
			return false;
		}

		for (let i = 0; i < keys1.length; i++) {
			if (obj1[keys1[i]] !== obj2[keys1[i]]) {
				return false;
			}
		}

		return true;
	}
}

function timeStamp() {
	let d = new Date();
	let seconds = Math.round(d.getTime() / 1000);
	return seconds;
}

// Sets a key and stores its value into the storage
function setStorageKey(key, value) {
	chrome.storage.local.set({ [key]: value });
}

// Gets a key value from the storage
function getStorageKeyValue(key, onGetStorageKeyValue) {
	chrome.storage.local.get([key], function (result) {
		onGetStorageKeyValue(result[key]);
	});
}

function docReferrer() {
	return document.referrer;
}

function newTabChecker(id, onGetLastTabId) {
	chrome.tabs.query({ currentWindow: true }, function (tabs) {
		for (var i = 0; i < tabs.length; i++) {
			if (tabs[i].id == id) {
				onGetLastTabId(tabs[i]);
			}
		}
	});
}

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
	if (changeInfo.status === 'loading') {
		// e.g. transtionsList = ['typed', 'link', 'link'] for Facebook
		// some events can be grouped together during web navigation 
		// => transitionsList[0] is the correct transition type
		chrome.history.getVisits({ url: tab.url }, function (visits) {
			if(visits.length > 0) {
				getStorageKeyValue('transitionsList', function (transitionList) {
					let lastVisit = visits[visits.length - 1];
					let transitionType = lastVisit.transition;
					transitionList.push(transitionType);
					setStorageKey('transitionsList', transitionList);
				});
			}
		});
	}

	if (changeInfo.status === 'complete') {
		chrome.scripting.executeScript({
			target: { tabId: tabId },
			func: docReferrer,
		},
			function (ref) {
				var e = chrome.runtime.lastError;
				if (e !== undefined) {
					console.log(tabId, e);
				}
				// console.log(ref);

				let curWindow = "curWindowId " + tab.windowId.toString();
				getStorageKeyValue(curWindow, function(curWindowInfo){
					if (typeof curWindowInfo !== 'undefined') {
						// console.log(curWindowInfo.recording);
						getStorageKeyValue(tabId.toString(), function (value) {
							if (typeof value === 'undefined') {
								getStorageKeyValue('latestTab', function (latestTabInfo) {
									// open hyperlink in new tab or omnibox search
									if (latestTabInfo.curId === tabId) {
										// hyperlink opened in new tab and new tab is active tab
										// or empty new tab is active tab (for omnibox search)
										newTabChecker(tabId, function (tab) {
											if (tab.openerTabId) {
												getStorageKeyValue(tab.openerTabId.toString(), function (v) {
													if (typeof v !== 'undefined') {
														// if there is hyperlink redirecting, then prevUrl and prevTabId exist
														// if simply opening a new tab, then prevUrl and prevTabId don't exist
														setStorageKey(tabId.toString(), {
															"curUrl": tab.url,
															"curTabId": tabId,
															"prevUrl": ((tab.url !== newTab) ? v.curUrl : ""),
															"prevTabId": ((tab.url !== newTab) ? tab.openerTabId : tabId),
															"curTitle": tab.title,
															"recording": ((typeof curWindowInfo.recording !== 'undefined') ? curWindowInfo.recording : true),
															"action": ((tab.url !== newTab) ? "hyperlink opened in new tab and new tab is active tab" : "empty new tab is active tab"),
															"time": timeStamp()
														});
		
														if(tab.url !== newTab) {
															setStorageKey('transitionsList', []);
														}
													}
													else {
														// this case happens when reloading the extension
														setStorageKey(tabId.toString(), {
															"curUrl": tab.url,
															"curTabId": tabId,
															"prevUrl": "",
															"prevTabId": tabId,
															"curTitle": tab.title,
															"recording": ((typeof curWindowInfo.recording !== 'undefined') ? curWindowInfo.recording : true),
															"action": ((tab.url !== newTab) ? "hyperlink opened in new tab and new tab is active tab" : "empty new tab is active tab"),
															"time": timeStamp()
														});
		
														if(tab.url !== newTab) {
															setStorageKey('transitionsList', []);
														}
													}
												});
											}
											else {
												if(typeof latestTabInfo.prevId == 'undefined') {
													// this case happens when extension first installs (query a new tab)
													setStorageKey(tabId.toString(), {
														"curUrl": tab.url,
														"curTabId": tabId,
														"prevUrl": "",
														"prevTabId": tabId,
														"curTitle": tab.title,
														"recording": ((typeof curWindowInfo.recording !== 'undefined') ? curWindowInfo.recording : true),
														"action": ((tab.url !== newTab) ? "hyperlink opened in new tab and new tab is active tab" : "empty new tab is active tab"),
														"time": timeStamp()
													});
		
													if(tab.url !== newTab) {
														setStorageKey('transitionsList', []);
													}
												} 
												if(typeof latestTabInfo.prevId !== 'undefined') {
													getStorageKeyValue(String(latestTabInfo.prevId), function (v) {
														if (typeof v !== 'undefined') {
															// this case happens when hyperlink opened in new window
															setStorageKey(tabId.toString(), {
																"curUrl": tab.url,
																"curTabId": tabId,
																"prevUrl": v.curUrl,
																"prevTabId": latestTabInfo.prevId,
																"curTitle": tab.title,
																"recording": ((typeof curWindowInfo.recording !== 'undefined') ? curWindowInfo.recording : true),
																"action": ((tab.url !== newTab) ? "hyperlink opened in new window" : "empty tab in new window is active tab"),
																"time": timeStamp()
															});
		
															if(tab.url !== newTab) {
																setStorageKey('transitionsList', []);
															}
														}
													});
												}
											}
										});
									}
									else {
										// hyperlink opened in new tab but new tab is not active tab
										getStorageKeyValue(latestTabInfo.curId.toString(), function (v) {
											if (typeof v !== 'undefined') {
												setStorageKey(tabId.toString(), {
													"curUrl": tab.url,
													"curTabId": tabId,
													"prevUrl": v.curUrl,
													"prevTabId": latestTabInfo.curId,
													"curTitle": tab.title,
													"recording": ((typeof curWindowInfo.recording !== 'undefined') ? curWindowInfo.recording : true),
													"action": ((tab.url !== newTab) ? "hyperlink opened in new tab but new tab is not active tab" : "empty new tab is not active tab"),
													"time": timeStamp()
												});
		
												if(tab.url !== newTab) {
													setStorageKey('transitionsList', []);
												}
											}
										});
									}
								});
							}
							else {
								// navigate between urls in a same tab	
								getStorageKeyValue('transitionsList', function (transition) {
									value.action = "navigate between urls in the same tab";
									if(transition.length > 0) {
										value.action = "navigate between urls in the same tab (" + transition[0] + ")";
									}
									value.prevUrl = value.curUrl;
									value.curUrl = tab.url;
									value.prevTabId = tab.id;
									value.curTitle = tab.title;
									value.time = timeStamp();
									setStorageKey(tabId.toString(), value);
									setStorageKey('transitionsList', []);
								});
							}
						});
					} 
				});
			});
	}
});

chrome.alarms.onAlarm.addListener(function(alarm) {
	if (alarm.name === "postDataToNode") {
		getStorageKeyValue('tableData', function (value) {
			if (typeof value !== 'undefined') {
				if (value.length > 0) {
					console.log("exporting data to user's working project folder");
					let copyData = value;

					// remove the 'recording' keys from the newData
					copyData = copyData.map(el => {
						if (el.recording === true) delete el.recording
						return el;
					});

					let result = JSON.stringify(copyData, undefined, 4);
					asyncPostCall(result);
					// console.log(result);
				}
			}
		});
	}
});

const asyncPostCall = async (data) => {
	try {
		getStorageKeyValue('port', function (num) {
			fetch("http://localhost:" + num + "/logWebData", {
				method: 'POST',
				headers: {
					'Accept': 'application/json, text/plain, */*',
					'Content-Type': 'application/json'
				},
				body: data
			});
		});
	} catch(error) {
		console.log(error);
	} 
}