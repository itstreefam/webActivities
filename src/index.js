const tabActivities = require('./tabActivities');
var tabActivities_ = new tabActivities();
var lastTabID = 0;
var tableData = [];

console.log('This is background service worker - edit me!');

// on install, if there is only chrome://extensions/ in the browser window, then make a new tab
// otherwise, open a new browser window
chrome.runtime.onInstalled.addListener(function (details) {
	if (details.reason === 'install') {
		chrome.tabs.query({ currentWindow: true }, function (tabs) {
			if (tabs.length === 1 && tabs[0].url === "chrome://extensions/") {
				chrome.tabs.create({ url: "chrome://newtab" });
			}
			else {
				chrome.windows.create({ url: "chrome://newtab" });
			}
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
		console.log(key, oldValue, newValue);
		
		if(parseInt(key) !== NaN) {
			tableData.push(newValue);
		}
	}
});

function timeStamp() {
	var time = Date.now || function() {
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
							newTabChecker(tabId, function (tab) {
								if (tab.openerTabId) {
									getStorageKeyValue(tab.openerTabId.toString(), function (v) {
										if (typeof v !== 'undefined') {
											setStorageKey(tabId.toString(), { "curUrl": tab.url, "curTabId": tabId, "prevUrl": v.curUrl, "prevTabId": tab.openerTabId, "time": new Date(timeStamp()).toLocaleString('en-US') });
										}
										else {
											// empty new tab or omnibox search
											setStorageKey(tabId.toString(), { "curUrl": tab.url, "curTabId": tabId, "prevUrl": "", "prevTabId": tabId, "time": new Date(timeStamp()).toLocaleString('en-US') });
										}
									});
								}
								else {
									setStorageKey(tabId.toString(), { "curUrl": tab.url, "curTabId": tabId, "prevUrl": "", "prevTabId": tabId, "time": new Date(timeStamp()).toLocaleString('en-US') });
								}
							});
						}
						else {
							// hyperlink opened in new tab but new tab is not active tab
							getStorageKeyValue(lastTabID.toString(), function (v) {
								if (typeof v !== 'undefined') {
									setStorageKey(tabId.toString(), { "curUrl": tab.url, "curTabId": tabId, "prevUrl": v.curUrl, "prevTabId": lastTabID, "time": new Date(timeStamp()).toLocaleString('en-US') });
								}
							});
						}
					}
					else {
						// navigate between urls in a same tab
						value.prevUrl = value.curUrl;
						value.curUrl = tab.url;
						value.prevTabId = tab.id;
						value.time = new Date(timeStamp()).toLocaleString('en-US');
						setStorageKey(tabId.toString(), value);
					}
				});
			});
	}
});

var focused = true;
setInterval(function() {
    chrome.windows.getLastFocused(function(window) {
		if(focused && !window.focused) {
			console.log("window unfocused (can export json data to codeHistories repo)");
			var result = JSON.stringify(tableData, undefined, 4);
			console.log(result);

			// Save as file
			var url = 'data:application/json;base64,' + btoa(result);
			chrome.downloads.download({
				url: url,
				filename: 'webActivities.json',
				// saveAs: true
			});
		}
        focused = window.focused;
    });
}, 1000);

chrome.downloads.onChanged.addListener(function(delta) {
	console.log(delta);
});