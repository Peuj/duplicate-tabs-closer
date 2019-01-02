"use strict";

const storedNbDuplicatedTabs = new Map();
const getNbDuplicatedTabs = windowId => storedNbDuplicatedTabs.get(windowId) || "0";
const setNbDuplicatedTabs = (windowId, tabId) => storedNbDuplicatedTabs.set(windowId, tabId);
/* exported hasDuplicatedTabs */
const hasDuplicatedTabs = windowId => getNbDuplicatedTabs(windowId) !== "0";

/* exported setBadgeIcon */
const setBadgeIcon = () => {
	chrome.browserAction.setIcon({ path: options.autoCloseTab ? "images/auto_close_16.png" : "images/manual_close_16.png" });
	if (environment.isFirefox63Compatible) browser.browserAction.setBadgeTextColor({ color: "white" });
};

/* exported setBadge */
const setBadge = async (badgeInfo) => {

	const backgroundColor = (nbDuplicateTabs) => nbDuplicateTabs !== "0" ? options.badgeColorDuplicateTabs : options.badgeColorNoDuplicateTabs;

	const nbDuplicateTabs = getNbDuplicatedTabs(badgeInfo.windowId);

	if (environment.isFirefox62Compatible) {
		const badgeText = await getWindowBadgeText(badgeInfo.windowId);
		if (nbDuplicateTabs === badgeText) return;
		setWindowBadgeText(badgeInfo.windowId, nbDuplicateTabs);
		setWindowBadgeBackgroundColor(badgeInfo.windowId, backgroundColor(nbDuplicateTabs));
	}
	else {
		if (!badgeInfo.tabId) {
			const activeTab = await getActiveTab(badgeInfo.windowId);
			badgeInfo.tabId = activeTab.id;
		}
		const badgeText = await getTabBadgeText(badgeInfo.tabId);
		if (nbDuplicateTabs === badgeText) return;
		setTabBadgeText(badgeInfo.tabId, nbDuplicateTabs);
		setTabBadgeBackgroundColor(badgeInfo.tabId, backgroundColor(nbDuplicateTabs));
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

const updateBadge = async (windowId, nbDuplicateTabs) => {
	setNbDuplicatedTabs(windowId, nbDuplicateTabs);
	setBadge({ windowId: windowId });
};

/* exported updateBadges */
const updateBadges = async (duplicateGroupTabs, windowId) => {

	const nbDuplicateTabs = countDuplicatedTabs(duplicateGroupTabs);

	if (options.searchInAllWindows) {
		const windows = await getWindows();
		windows.forEach(window => updateBadge(window.id, nbDuplicateTabs));
	}
	else {
		updateBadge(windowId, nbDuplicateTabs);
	}

};