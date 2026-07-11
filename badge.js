"use strict";

const PAUSED_BADGE_TEXT = "⏸";
const PAUSED_BADGE_COLOR = "#888888";

// eslint-disable-next-line no-unused-vars
const setBadgeIcon = () => {
	chrome.action.setIcon({ path: options.autoCloseTab ? "images/auto_close_16.png" : "images/manual_close_16.png" });
	if (environment.isFirefox) browser.action.setBadgeTextColor({ color: "white" });
};

const setBadge = async (windowId, activeTabId) => {
	if (monitoringPaused) {
		if (!environment.isFirefox && activeTabId != null) {
			setTabBadgeText(activeTabId, PAUSED_BADGE_TEXT);
			setTabBadgeBackgroundColor(activeTabId, PAUSED_BADGE_COLOR);
		}
		return;
	}
	const nbCount = tabsInfo.getNbDuplicateTabs(windowId);
	const badgeText = (nbCount === 0 && !options.showBadgeIfNoDuplicateTabs) ? "" : String(nbCount);
	const backgroundColor = (nbCount !== 0) ? options.badgeColorDuplicateTabs : options.badgeColorNoDuplicateTabs;
	if (environment.isFirefox) {
		setWindowBadgeText(windowId, badgeText);
		setWindowBadgeBackgroundColor(windowId, backgroundColor);
	}
	else {
		if (activeTabId != null) {
			setTabBadgeText(activeTabId, badgeText);
			setTabBadgeBackgroundColor(activeTabId, backgroundColor);
		} else {
			const tabs = await getTabs({ windowId: windowId });
			if (tabs) tabs.forEach(tab => {
				setTabBadgeText(tab.id, badgeText);
				setTabBadgeBackgroundColor(tab.id, backgroundColor);
			});
		}
	}
};

const getNbDuplicateTabs = (duplicateTabsGroups) => {
	let nbDuplicateTabs = 0;
	duplicateTabsGroups.forEach(duplicateTabs => {
		if (options.hideWhitelistedTabs) {
			const firstTab = duplicateTabs.values().next().value;
			if (firstTab && isUrlWhiteListed(firstTab.url)) return;
		}
		nbDuplicateTabs += duplicateTabs.size - 1;
	});
	return nbDuplicateTabs;
};

const updateBadgeValue = async (nbDuplicateTabs, windowId, triggerTabId) => {
	if (tabsInfo.hasNbDuplicateTabs(windowId) && tabsInfo.getNbDuplicateTabs(windowId) === nbDuplicateTabs) return;
	const hadPriorCount = tabsInfo.hasNbDuplicateTabs(windowId);
	const prevCount = hadPriorCount ? tabsInfo.getNbDuplicateTabs(windowId) : 0;
	tabsInfo.setNbDuplicateTabs(windowId, nbDuplicateTabs);
	setBadge(windowId);
	// hadPriorCount guards against startup hydration (count going from unset→N on addon load).
	// For a new browser window (count goes 0→N where 0 was explicitly set by onCreatedTab),
	// hadPriorCount is true so the popup fires correctly.
	if (options.openPopupOnDuplicateDetected && hadPriorCount && nbDuplicateTabs > prevCount && !(await isPopupOpen())) {
		chrome.storage.session.set({ autoOpenedPopup: true, autoOpenedTabId: triggerTabId ?? null }).then(() => {
			chrome.action.openPopup().catch(() => {});
		});
		// Cancel the highlight flag if the duplicate was transient (count dropped within 400ms).
		wait(400).then(async () => {
			if (tabsInfo.getNbDuplicateTabs(windowId) <= prevCount) {
				chrome.storage.session.remove(['autoOpenedPopup', 'autoOpenedTabId']).catch(() => {});
			}
		});
	}
};

// eslint-disable-next-line no-unused-vars
const updateBadgesValue = async (duplicateTabsGroups, windowId, triggerTabId) => {
	const nbDuplicateTabs = getNbDuplicateTabs(duplicateTabsGroups);
	if (options.searchInAllWindows) {
		const windows = await getWindows();
		if (!windows) return;
		await Promise.all(windows.map(window => updateBadgeValue(nbDuplicateTabs, window.id, window.id === windowId ? triggerTabId : null)));
	}
	else {
		updateBadgeValue(nbDuplicateTabs, windowId, triggerTabId);
	}
};

// eslint-disable-next-line no-unused-vars
const updateBadgeStyle = async () => {
	const windows = await getWindows();
	if (!windows) return;
	await Promise.all(windows.map(async w => {
		const activeTabId = await getActiveTabId(w.id);
		setBadge(w.id, activeTabId);
	}));
};

// eslint-disable-next-line no-unused-vars
const setPausedBadge = async () => {
	if (environment.isFirefox) {
		const windows = await getWindows();
		if (windows) windows.forEach(w => {
			setWindowBadgeText(w.id, PAUSED_BADGE_TEXT);
			setWindowBadgeBackgroundColor(w.id, PAUSED_BADGE_COLOR);
		});
	} else {
		const tabs = await getTabs({});
		if (tabs) tabs.forEach(tab => {
			setTabBadgeText(tab.id, PAUSED_BADGE_TEXT);
			setTabBadgeBackgroundColor(tab.id, PAUSED_BADGE_COLOR);
		});
	}
};