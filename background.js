"use strict";

const onCreatedTab = (tab) => {
	if (tab.status === "complete" && !isBlankUrl(tab.url)) {
		if (options.autoCloseTab) {
			searchAndCloseNewDuplicateTabs({ tab: tab, queryStatus: "complete", eventType: "onCreatedTab" });
		}
		else {
			refreshDuplicateTabsInfo(tab.windowId);
		}
	}
};

const onBeforeNavigate = async (details) => {
	if (options.autoCloseTab && (details.frameId == 0) && (details.tabId !== -1) && !isBlankUrl(details.url)) {
		const tab = await getTab(details.tabId);
		if (tab) {
			const loadingUrl = (environment.isChrome && (tab.url.startsWith("chrome:") || tab.url.startsWith("view-source:"))) ? tab.url : details.url;
			searchAndCloseNewDuplicateTabs({ tab: tab, queryStatus: "complete", loadingUrl: loadingUrl, eventType: "onBeforeNavigate" });
		}
	}
};

const onUpdatedTab = (tabId, changeInfo, tab) => {
	if ((changeInfo.url || changeInfo.status) && !isBlankUrl(tab.url)) {
		if (tab.status === "complete") {
			if (options.autoCloseTab) {
				searchAndCloseNewDuplicateTabs({ tab: tab, eventType: "onUpdatedTab" });
			}
			else {
				refreshDuplicateTabsInfo(tab.windowId);
			}
		}
		else if (!environment.isFirefox62Compatible) {
			if (tab.active) {
				setBadge({ tabId: tab.id, windowId: tab.windowId });
			}
		}
	}
};

const onAttached = async (tabId) => {
	const tab = await getTab(tabId);
	if (tab) {
		if (options.autoCloseTab) {
			searchAndCloseNewDuplicateTabs({ tab: tab, eventType: "onAttached" });
		}
		else {
			refreshDuplicateTabsInfo(tab.windowId);
		}
	}
};

const onRemovedTab = async (removedTabId, removeInfo) => {
	if (!removeInfo.isWindowClosing && hasDuplicatedTabs(removeInfo.windowId)) {
		addToIgnoreTabs(removedTabId);
		await refreshDuplicateTabsInfo(removeInfo.windowId);
		removeFromIgnoreTabs(removedTabId);
	}
};

const onDetachedTab = (detachedTabId, detachInfo) => {
	if (hasDuplicatedTabs(detachInfo.oldWindowId)) refreshDuplicateTabsInfo(detachInfo.oldWindowId);
};

const onActivatedTab = (activeInfo) => {
	if (isIgnoreTab(activeInfo.tabId)) return;
	setBadge({ tabId: activeInfo.tabId, windowId: activeInfo.windowId });
};

const onCommand = (command) => {
	if (command == "close-duplicate-tabs") closeDuplicateTabs(chrome.windows.WINDOW_ID_CURRENT); 
};


const start = async () => {

	await initializeOptions();
	
	if (!environment.isAndroid) {
		setBadgeIcon();
		await refreshGlobalDuplicateTabsInfo();
	}

	chrome.tabs.onCreated.addListener(onCreatedTab);
	chrome.webNavigation.onBeforeNavigate.addListener(onBeforeNavigate);
	chrome.tabs.onAttached.addListener(onAttached);
	chrome.tabs.onDetached.addListener(onDetachedTab);
	chrome.tabs.onUpdated.addListener(onUpdatedTab);
	chrome.tabs.onRemoved.addListener(onRemovedTab);
	if (!environment.isFirefox62Compatible) chrome.tabs.onActivated.addListener(onActivatedTab);
	chrome.commands.onCommand.addListener(onCommand);
};

start();