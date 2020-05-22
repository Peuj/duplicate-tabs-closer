"use strict";

// eslint-disable-next-line no-unused-vars
const setBadgeIcon = () => {
	chrome.browserAction.setIcon({ path: options.autoCloseTab ? "images/auto_close_16.png" : "images/manual_close_16.png" });
	if (environment.isFirefox) browser.browserAction.setBadgeTextColor({ color: "white" });
};

const setBadge = async (windowId, tabId) => {
	let nbDuplicateTabs = tabsInfo.getNbDuplicateTabs(windowId);
	if (nbDuplicateTabs === "0" && !options.showBadgeIfNoDuplicateTabs) nbDuplicateTabs = "";
	const backgroundColor = (nbDuplicateTabs !== "0") ? options.badgeColorDuplicateTabs : options.badgeColorNoDuplicateTabs;
	if (environment.isFirefox) {
		setWindowBadgeText(windowId, nbDuplicateTabs);
		setWindowBadgeBackgroundColor(windowId, backgroundColor);
	}
	else {
		// eslint-disable-next-line no-param-reassign
		tabId = tabId || await getActiveTabId(windowId);
		if (tabId) {
			setTabBadgeText(tabId, nbDuplicateTabs);
			setTabBadgeBackgroundColor(tabId, backgroundColor);
		}
	}
};

const getNbDuplicateTabs = (duplicateTabsGroups) => {
	let nbDuplicateTabs = 0;
	if (duplicateTabsGroups.size !== 0) {
		duplicateTabsGroups.forEach(duplicateTabs => (nbDuplicateTabs += duplicateTabs.size - 1));
	}
	return nbDuplicateTabs;
};

const updateBadgeValue = (nbDuplicateTabs, windowId) => {
	tabsInfo.setNbDuplicateTabs(windowId, nbDuplicateTabs);
	setBadge(windowId);
};

// eslint-disable-next-line no-unused-vars
const updateBadgesValue = async (duplicateTabsGroups, windowId) => {
	const nbDuplicateTabs = getNbDuplicateTabs(duplicateTabsGroups);
	if (options.searchInAllWindows) {
		const windows = await getWindows();
		windows.forEach(window => updateBadgeValue(nbDuplicateTabs, window.id));
	}
	else {
		updateBadgeValue(nbDuplicateTabs, windowId);
	}
};

// eslint-disable-next-line no-unused-vars
const updateBadgeStyle = async () => {
	const windows = await getWindows();
	windows.forEach(window => setBadge(window.id));
};