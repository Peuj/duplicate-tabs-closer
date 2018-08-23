"use strict";

const onCreatedTab = (tab) => {

	if (tab.status === "complete" && !isBlankUrl(tab.url)) {
		if (options.autoCloseTab) {
			searchAndCloseNewDuplicateTabs({ tab: tab, queryStatus: "complete", eventType: "onCreatedTab" });
		}
		else {
			getDuplicateTabs(tab.windowId);
		}
	}
};

const onBeforeNavigate = async (details) => {
	
	if (options.autoCloseTab && (details.frameId == 0) && (details.tabId !== -1) && !isBlankUrl(details.url)) {
		const tab = await getTab(details.tabId);
		if (tab) {
			searchAndCloseNewDuplicateTabs({ tab: tab, queryStatus: "complete", loadingUrl: details.url, eventType: "onBeforeNavigate" });
		}
	}
};

const onUpdatedTab = async (tabId, changeInfo, tab) => {
		
	if ((changeInfo.url || changeInfo.status) && (tab.status === "complete") && !isBlankUrl(tab.url)) {
		if (options.autoCloseTab) {
			searchAndCloseNewDuplicateTabs({ tab: tab, eventType: "onUpdatedTab" });
		}
		else {
			getDuplicateTabs(tab.windowId);
		}
	}
	//else if (tab.active && (changeInfo.url || (tab.status === "complete")) {
	else if (tab.active) {
		setTabBadge(tab.id);
	}
};

const onAttached = async (tabId) => {
	const tab = await getTab(tabId);
	if (tab) {
		if (options.autoCloseTab) {
			searchAndCloseNewDuplicateTabs({ tab: tab, eventType: "onAttached" });
		}
		else {
			getDuplicateTabs(tab.windowId);
		}
	}
};

let removingTab = false;

const onRemovedTab = (removedTabId, removeInfo) => {
	if (!removeInfo.isWindowClosing && hasDuplicatedTabs(removeInfo.windowId)) {
		removingTab = true;
		getDuplicateTabs(removeInfo.windowId, removedTabId);
		setTimeout(() => removingTab = false, 50);
	}
};

const onDetachedTab = (detachedTabId, detachInfo) => {
	if (hasDuplicatedTabs(detachInfo.oldWindowId)) getDuplicateTabs(detachInfo.oldWindowId);
};

const onActivatedTab = (activeInfo) => {
	if (removingTab) return;
	setTabBadge(activeInfo.tabId);
};

const start = async () => {
	await initializeOptions();
	if (!options.isAndroid) {
		setBadgeIcon();
		await refreshAllDuplicateTabs();
	}
	chrome.tabs.onCreated.addListener(onCreatedTab);
	chrome.webNavigation.onBeforeNavigate.addListener(onBeforeNavigate);
	chrome.tabs.onAttached.addListener(onAttached);
	chrome.tabs.onDetached.addListener(onDetachedTab);
	chrome.tabs.onUpdated.addListener(onUpdatedTab);
	chrome.tabs.onRemoved.addListener(onRemovedTab);
	chrome.tabs.onActivated.addListener(onActivatedTab);
	chrome.commands.onCommand.addListener(command => {
		if (command == "close-duplicate-tabs") closeDuplicateTabs(chrome.windows.WINDOW_ID_CURRENT);
	});
};

start();