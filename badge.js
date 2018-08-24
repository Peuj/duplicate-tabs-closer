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

/* exported setBadge */
const setBadge = async (tabId, windowId, nbDuplicateTabs) => {

	if (!nbDuplicateTabs) {
		nbDuplicateTabs = getNbDuplicatedTabs(windowId);
		// const badgeText = options.isFirefox ? await getWindowBadgeText(windowId) : await getTabBadgeText(tabId);
		const badgeText = await getTabBadgeText(tabId);
		if (nbDuplicateTabs === badgeText) return;
	}
	
	const backgroundColor = (nbDuplicateTabs) => nbDuplicateTabs !== "0" ? options.badgeColorDuplicateTabs : options.badgeColorNoDuplicateTabs;
	chrome.browserAction.setBadgeText({ tabId: tabId, text: nbDuplicateTabs });
	chrome.browserAction.setBadgeBackgroundColor({ tabId: tabId, color: backgroundColor(nbDuplicateTabs) });

	// getBadgeText, setBadgeText and setBadgeBackgroundColor raised an error with windowId ??? need to check
	
	// if (options.isFirefox) {
		// console.log("setBadge isFirefox windowId", windowId);
		// browser.browserAction.setBadgeText({ text: nbDuplicateTabs, windowId: windowId });		
		// browser.browserAction.setBadgeBackgroundColor({ color: backgroundColor(nbDuplicateTabs), windowId: windowId });
	// }
	// else {
		// console.log("setBadge not isFirefox");
		// chrome.browserAction.setBadgeText({ tabId: tabId, text: nbDuplicateTabs });
		// chrome.browserAction.setBadgeBackgroundColor({ tabId: tabId, color: backgroundColor(nbDuplicateTabs) });
	// }

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
	const activeTab = await getActiveTab(windowId);
	setBadge(activeTab.id, windowId, nbDuplicateTabs);

	// getBadgeText, setBadgeText and setBadgeBackgroundColor raised an error with windowId ??? need to check

	// if (options.isFirefox) {
		// setBadge(null, windowId, nbDuplicateTabs);
	// }
	// else {
		// const activeTab = await getActiveTab(windowId);
		// setBadge(activeTab.id, windowId, nbDuplicateTabs);
	// }
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