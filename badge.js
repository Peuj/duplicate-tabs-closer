"use strict";

const storedNbDuplicatedTabs = new Map();
const getNbDuplicatedTabs = windowId => storedNbDuplicatedTabs.get(windowId) || "0";
const setNbDuplicatedTabs = (windowId, tabId) => storedNbDuplicatedTabs.set(windowId, tabId);
/* exported hasDuplicatedTabs */
const hasDuplicatedTabs = windowId => getNbDuplicatedTabs(windowId) !== "0";

/* exported setBadgeIcon */
const setBadgeIcon = () => {
	chrome.browserAction.setIcon({ path: options.autoCloseTab ? "images/auto_close_16.png" : "images/manual_close_16.png" });
};

/* exported setTabBadge */
const setTabBadge = async (tabId, nbDuplicateTabs) => {
	const tab = await getTab(tabId);
	if (tab) {
		if (!nbDuplicateTabs) nbDuplicateTabs = getNbDuplicatedTabs(tab.windowId);
		chrome.browserAction.setBadgeText({ tabId: tab.id, text: nbDuplicateTabs });
		const backgroundColor = (nbDuplicateTabs) => nbDuplicateTabs !== "0" ? options.badgeColorDuplicateTabs : options.badgeColorNoDuplicateTab;
		chrome.browserAction.setBadgeBackgroundColor({ tabId: tabId, color: backgroundColor(nbDuplicateTabs) });
	}
};

const countDuplicatedTabs = duplicateGroupTabs => {
	let nbDuplicateTabs = 0;
	if (duplicateGroupTabs.size !== 0) {
		for (const duplicateTabs of duplicateGroupTabs.values()) {
			nbDuplicateTabs += duplicateTabs.size - 1;
		}
	}
	return nbDuplicateTabs.toString();
};

const updateActiveWindowTabBadge = async (windowId, nbDuplicateTabs) => {
	setNbDuplicatedTabs(windowId, nbDuplicateTabs);
	const activeTab = await getActiveTab(windowId);
	setTabBadge(activeTab.id, nbDuplicateTabs);
};

/* exported updateActiveTabsBadge */
const updateActiveTabsBadge = async (duplicateGroupTabs, windowId) => {

	const nbDuplicateTabs = countDuplicatedTabs(duplicateGroupTabs);

	if (options.searchInAllWindows) {
		const windows = await getWindows();
		windows.forEach(window => updateActiveWindowTabBadge(window.id, nbDuplicateTabs));
	}
	else {
		updateActiveWindowTabBadge(windowId, nbDuplicateTabs);
	}

};