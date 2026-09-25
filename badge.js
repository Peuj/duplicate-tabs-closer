"use strict";

const PAUSED_BADGE_TEXT = "⏸";
const PAUSED_BADGE_COLOR = "#888888";

const setBadgeIcon = () => {
	chrome.action.setIcon({ path: options.autoCloseTab ? "images/auto_close_16.png" : "images/manual_close_16.png" });
	if (environment.isFirefox) browser.action.setBadgeTextColor({ color: "white" });
};

const setBadge = async (windowId, activeTabId = null, windowTabs = null) => {
	if (monitoringPaused) {
		if (!environment.isFirefox && activeTabId !== null) {
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
	else if (activeTabId !== null) {
		setTabBadgeText(activeTabId, badgeText);
		setTabBadgeBackgroundColor(activeTabId, backgroundColor);
	} else {
		const tabs = windowTabs ?? await getTabs({ windowId });
		if (tabs) tabs.forEach(tab => {
			setTabBadgeText(tab.id, badgeText);
			setTabBadgeBackgroundColor(tab.id, backgroundColor);
		});
	}
};

const getNbDuplicateTabs = (duplicateTabsGroups) => {
	let nbDuplicateTabs = 0;
	duplicateTabsGroups.forEach(duplicateTabs => {
		if (options.hideWhitelistedTabs) {
			let hasWhitelisted = false;
			for (const tab of duplicateTabs) {
				if (isUrlWhiteListed(tab.url)) {
					hasWhitelisted = true;
					break;
				}
			}
			if (hasWhitelisted) {
				return;
			}
		}
		nbDuplicateTabs += duplicateTabs.size - 1;
	});
	return nbDuplicateTabs;
};

const updateBadgeValue = async (nbDuplicateTabs, windowId, triggerTabId, windowTabs = null) => {
	if (tabsInfo.hasNbDuplicateTabs(windowId) && tabsInfo.getNbDuplicateTabs(windowId) === nbDuplicateTabs) {
		return;
	}
	const hadPriorCount = tabsInfo.hasNbDuplicateTabs(windowId);
	const prevCount = hadPriorCount ? tabsInfo.getNbDuplicateTabs(windowId) : 0;
	tabsInfo.setNbDuplicateTabs(windowId, nbDuplicateTabs);
	// hadPriorCount guards against startup hydration (count going from unset→N on addon load).
	// For a new browser window (count goes 0→N where 0 was explicitly set by onCreatedTab),
	// hadPriorCount is true so the popup fires correctly.
	// openPopup must be triggered before any await to preserve the synchronous event-callback
	// context Firefox requires; await setBadge is moved after so callers still get completion.
	if (options.openPopupOnDuplicateDetected && hadPriorCount && nbDuplicateTabs > prevCount) {
		chrome.storage.session.set({ autoOpenedPopup: true, autoOpenedTabId: triggerTabId ?? null }).then(() => {
			chrome.action.openPopup().catch(() => {
				// Popup already open or dismissed: remove the stale flag we just wrote.
				chrome.storage.session.remove(["autoOpenedPopup", "autoOpenedTabId"]).catch(() => {
					// ignore
				});
			});
			// Cancel the highlight flag if the duplicate was transient (count dropped within 400ms).
			// Chained inside session.set.then() so session.remove only runs after session.set completes.
			wait(400).then(() => {
				if (tabsInfo.getNbDuplicateTabs(windowId) <= prevCount) {
					chrome.storage.session.remove(["autoOpenedPopup", "autoOpenedTabId"]).catch(() => {
						// ignore
					});
				}
			});
		});
	}
	await setBadge(windowId, null, windowTabs);
};

const updateBadgesValue = async (duplicateTabsGroups, windowId, triggerTabId) => {
	const nbDuplicateTabs = getNbDuplicateTabs(duplicateTabsGroups);
	if (options.searchInAllWindows) {
		const [windows, allTabs] = await Promise.all([getWindows(), getTabs({})]);
		if (!windows) return;
		await Promise.all(windows.map(w => {
			const wTabs = allTabs ? allTabs.filter(t => t.windowId === w.id) : null;
			return updateBadgeValue(nbDuplicateTabs, w.id, w.id === windowId ? triggerTabId : null, wTabs);
		}));
	}
	else {
		await updateBadgeValue(nbDuplicateTabs, windowId, triggerTabId);
	}
};

const updateBadgeStyle = async () => {
	const windows = await getWindows();
	if (!windows) return;
	await Promise.all(windows.map(async w => {
		const activeTabId = await getActiveTabId(w.id);
		setBadge(w.id, activeTabId);
	}));
};

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