"use strict";

const onCreatedTab = (tab) => {
	tabsInfo.setNewTab(tab.id);
	if (tab.status === "complete" && !isBlankURL(tab.url)) {
		options.autoCloseTab ? searchForDuplicateTabsToClose(tab, true) : refreshDuplicateTabsInfo(tab.windowId);
	}
};

const onBeforeNavigate = async (details) => {
	if (options.autoCloseTab && (details.frameId == 0) && (details.tabId !== -1) && !isBlankURL(details.url)) {
		if (tabsInfo.isIgnoredTab(details.tabId)) return;
		const tab = await getTab(details.tabId);
		if (!tab) return;
		tabsInfo.resetTab(tab.id);
		searchForDuplicateTabsToClose(tab, true, details.url);
	}
};

const onUpdatedTab = (tabId, changeInfo, tab) => {
	if (tabsInfo.isIgnoredTab(tabId)) return;
	if (Object.prototype.hasOwnProperty.call(changeInfo, "status") && changeInfo.status === "complete") {
		if (Object.prototype.hasOwnProperty.call(changeInfo, "url") && (changeInfo.url !== tab.url)) {
			if (isBlankURL(tab.url) || !tab.favIconUrl || !tabsInfo.hasUrlChanged(tab)) return;
			tabsInfo.updateTab(tab);
			options.autoCloseTab ? searchForDuplicateTabsToClose(tab) : refreshDuplicateTabsInfo(tab.windowId);
		}
		else if (isChromeURL(tab.url)) {
			options.autoCloseTab ? searchForDuplicateTabsToClose(tab) : refreshDuplicateTabsInfo(tab.windowId);
		}
	}
};

const onCompletedTab = async (details) => {
	if ((details.frameId == 0) && (details.tabId !== -1)) {
		if (tabsInfo.isIgnoredTab(details.tabId)) return;
		const tab = await getTab(details.tabId);
		if (!tab) return;
		tabsInfo.updateTab(tab);
		options.autoCloseTab ? searchForDuplicateTabsToClose(tab) : refreshDuplicateTabsInfo(tab.windowId);
	}
};

const onAttached = async (tabId) => {
	const tab = await getTab(tabId);
	if (tab) {
		options.autoCloseTab ? searchForDuplicateTabsToClose(tab) : refreshDuplicateTabsInfo(tab.windowId);
	}
};

const onRemovedTab = (removedTabId, removeInfo) => {
	tabsInfo.removeTab(removedTabId);
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
	// for Chrome only
	if (tabsInfo.isIgnoredTab(activeInfo.tabId)) return;
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
	chrome.webNavigation.onCompleted.addListener(onCompletedTab);
	chrome.tabs.onRemoved.addListener(onRemovedTab);
	if (!environment.isFirefox) chrome.tabs.onActivated.addListener(onActivatedTab);
	chrome.commands.onCommand.addListener(onCommand);
};

start();