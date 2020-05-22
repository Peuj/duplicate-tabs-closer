"use strict";

const onCreatedTab = (tab) => {
	tabsInfo.setNewTab(tab.id);
	if (tab.status === "complete" && !isBlankURL(tab.url)) {
		options.autoCloseTab ? searchForDuplicateTabsToClose(tab, true) : refreshDuplicateTabsInfo(tab.windowId);
	}
};

const onBeforeNavigate = async (details) => {
	if (options.autoCloseTab && (details.frameId == 0) && (details.tabId !== -1) && !isBlankURL(details.url)) {
		const tab = await getTab(details.tabId);
		if (!tab || tabsInfo.isIgnored(tab.id)) return;
		tabsInfo.clearLastComplete(tab.id);
		const loadingUrl = (environment.isChrome && (tab.url.startsWith("chrome:") || tab.url.startsWith("view-source:"))) ? tab.url : details.url;
		searchForDuplicateTabsToClose(tab, true, loadingUrl);
	}
};

const onUpdatedTab = (tabId, changeInfo, tab) => {
	if (tabsInfo.isIgnored(tabId)) return;
	if (Object.prototype.hasOwnProperty.call(changeInfo, "status") && changeInfo.status === "complete" && !isBlankURL(tab.url)) {
		if (Object.prototype.hasOwnProperty.call(changeInfo, "url") && (changeInfo.url !== tab.url)) return;
		tabsInfo.setLastComplete(tab.id);
		options.autoCloseTab ? searchForDuplicateTabsToClose(tab) : refreshDuplicateTabsInfo(tab.windowId);
	}
	else if (tab.status === "complete") {
		// if (Object.prototype.hasOwnProperty.call(changeInfo, "favIconUrl")) console.warn("_onUpdatedTab complete favIconUrl not observed", tab, changeInfo); //refreshDuplicateTabsInfo(tab.windowId);
		// if (Object.prototype.hasOwnProperty.call(changeInfo, "title")) console.warn("_onUpdatedTab complete title not observed", tab, changeInfo);
		if (!environment.isFirefox && tab.active) setBadge(tab.windowId, tab.id);
	}
};

const onAttached = async (tabId) => {
	const tab = await getTab(tabId);
	if (tab) {
		options.autoCloseTab ? searchForDuplicateTabsToClose(tab) : refreshDuplicateTabsInfo(tab.windowId);
	}
};

const onRemovedTab = (removedTabId, removeInfo) => {
	tabsInfo.remove(removedTabId);
	if (removeInfo.isWindowClosing) {
		if (options.searchInAllWindows && tabsInfo.hasDuplicateTabs(removeInfo.windowId)) refreshDuplicateTabsInfo();
		tabsInfo.clearDuplicateTabsInfo(removeInfo.windowId);
	}
	else if (tabsInfo.hasDuplicateTabs(removeInfo.windowId)) {
		refreshDuplicateTabsInfo(removeInfo.windowId);
	}
};

const onDetachedTab = (detachedTabId, detachInfo) => {
	if (tabsInfo.hasDuplicateTabs(detachInfo.oldWindowId)) refreshDuplicateTabsInfo(detachInfo.oldWindowId);
};

const onActivatedTab = (activeInfo) => {
	if (tabsInfo.isIgnored(activeInfo.tabId)) return;
	setBadge(activeInfo.windowId, activeInfo.tabId);
};

const onCommand = (command) => {
	if (command == "close-duplicate-tabs") closeDuplicateTabs();
};

const start = async () => {
	// eslint-disable-next-line no-unused-vars
	await initializeOptions();
	setBadgeIcon();
	await refreshGlobalDuplicateTabsInfo();
	chrome.tabs.onCreated.addListener(onCreatedTab);
	chrome.webNavigation.onBeforeNavigate.addListener(onBeforeNavigate);
	chrome.tabs.onAttached.addListener(onAttached);
	chrome.tabs.onDetached.addListener(onDetachedTab);
	chrome.tabs.onUpdated.addListener(onUpdatedTab);
	chrome.tabs.onRemoved.addListener(onRemovedTab);
	if (!environment.isFirefox) chrome.tabs.onActivated.addListener(onActivatedTab);
	chrome.commands.onCommand.addListener(onCommand);
};

start();