var lastTabID = 0;
var tableData = [];

console.log('This is background service worker - edit me!');

// on install, if there is only chrome://extensions/ in the browser window, then make a new tab
chrome.runtime.onInstalled.addListener(function (details) {
	if (details.reason === 'install') {
		chrome.tabs.query({ currentWindow: true }, function (tabs) {
			if (tabs.length === 1 && tabs[0].url === "chrome://extensions/") {
				chrome.tabs.create({ url: "chrome://newtab/" });
			}
			chrome.storage.local.clear();
			tableData = [];
		});
	}
	else {
		chrome.storage.local.clear();
		tableData = [];
	};
});

chrome.tabs.onActivated.addListener(function (activeInfo) {
	lastTabID = activeInfo.tabId;
});

chrome.storage.onChanged.addListener(function (changes, namespace) {
	for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
		// console.log(key, oldValue, newValue);

		// only push the data to the table if oldValue object is different from newValue object
		// to avoid when the page loads more content as the scrollbar is scrolled down
		if (!objCompare(oldValue, newValue)) {
			// if newValue.recording is true
			if (typeof newValue.recording !== 'undefined') {
				if (newValue.recording) {
					tableData.push(newValue);
				}
			}
		}
	}
});

function objCompare(obj1, obj2) {
	if (typeof obj1 !== 'undefined' && typeof obj2 !== 'undefined') {
		keys1 = Object.keys(obj1);
		keys2 = Object.keys(obj2);
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
	var time = Date.now || function () {
		return +new Date;
	};
	return time();
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
				console.log(ref);
				getStorageKeyValue(tabId.toString(), function (value) {
					if (typeof value === 'undefined') {
						// open hyperlink in new tab or omnibox search
						if (lastTabID === tabId) {
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
												"prevUrl": ((tab.url !== "chrome://newtab/") ? v.curUrl : ""),
												"prevTabId": ((tab.url !== "chrome://newtab/") ? tab.openerTabId : tabId),
												"recording": true,
												"action": ((tab.url !== "chrome://newtab/") ? "hyperlink opened in new tab and new tab is active tab" : "empty new tab is active tab"),
												"time": new Date(timeStamp()).toLocaleString('en-US')
											});
										}
										else {
											// this case happens when reloading the extension
											setStorageKey(tabId.toString(), {
												"curUrl": tab.url,
												"curTabId": tabId,
												"prevUrl": "",
												"prevTabId": tabId,
												"recording": true,
												"action": ((tab.url !== "chrome://newtab/") ? "hyperlink opened in new tab and new tab is active tab" : "empty new tab is active tab"),
												"time": new Date(timeStamp()).toLocaleString('en-US')
											});
										}
									});
								}
								else {
									// this case happens when extension first installs (query a new tab)
									setStorageKey(tabId.toString(), {
										"curUrl": tab.url,
										"curTabId": tabId,
										"prevUrl": "",
										"prevTabId": tabId,
										"recording": true,
										"action": ((tab.url !== "chrome://newtab/") ? "hyperlink opened in new tab and new tab is active tab" : "empty new tab is active tab"),
										"time": new Date(timeStamp()).toLocaleString('en-US')
									});
								}
							});
						}
						else {
							// hyperlink opened in new tab but new tab is not active tab
							getStorageKeyValue(lastTabID.toString(), function (v) {
								if (typeof v !== 'undefined') {
									setStorageKey(tabId.toString(), {
										"curUrl": tab.url,
										"curTabId": tabId,
										"prevUrl": v.curUrl,
										"prevTabId": lastTabID,
										"recording": true,
										"action": ((tab.url !== "chrome://newtab/") ? "hyperlink opened in new tab but new tab is not active tab" : "empty new tab is not active tab"),
										"time": new Date(timeStamp()).toLocaleString('en-US')
									});
								}
							});
						}
					}
					else {
						// navigate between urls in a same tab
						value.prevUrl = value.curUrl;
						value.curUrl = tab.url;
						value.prevTabId = tab.id;
						value.action = "navigate between urls in the same tab";
						value.time = new Date(timeStamp()).toLocaleString('en-US');
						setStorageKey(tabId.toString(), value);
					}
				});
			});
	}
});

var focused = true;
setInterval(function () {
	chrome.windows.getLastFocused(function (window) {
		if (focused && !window.focused) {
			console.log("window unfocused (exporting data to user's working project folder)");
			let result = JSON.stringify(tableData, undefined, 4);

			fetch('http://localhost:5000/log', {
				method: 'POST',
				headers: {
					'Accept': 'application/json, text/plain, */*',
					'Content-Type': 'application/json'
				},
				body: result
			}).then(function (response) {
				console.log(response);
			}).catch(function (error) {
				console.log(error);
			});
		}
		focused = window.focused;
	});
}, 1000);