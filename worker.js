"use strict";

const tabstoIgnore = new Set();

const isIgnoreTab = (tabId) => tabstoIgnore.has(tabId);
const removeFromIgnoreTabs = (tabId) => tabstoIgnore.delete(tabId);
const addToIgnoreTabs = (tabId) => tabstoIgnore.add(tabId);

const isWhiteListed = (url) => {
    const matches = options.whiteList.filter(pattern => pattern.test(url));
    return matches.length !== 0;
};

const matchTitle = (openTab, signaledTab) => {

    if (options.compareWithTitle) {
        if ((isTabComplete(openTab) && isTabComplete(signaledTab)) && (openTab.title === signaledTab.title)) {
            return true;
        }
    }

    return false;
};

const getHttpsTabId = (tab1, url1, tab2) => {

    if (options.keepTabWithHttps) {
        const regex = /^https:\/\//i;
        const match1 = regex.test(url1);
        const match2 = regex.test(tab2.url);

        if (match1) {
            return match2 ? null : tab1.id;
        } else {
            return match2 ? tab2.id : null;
        }
    }

    return null;
};

const getPinnedTabId = (tab1, tab2) => {

    if (options.keepPinnedTab) {
        const tab1Pinned = tab1.pinned;
        const tab2Pinned = tab2.pinned;

        if (tab1Pinned) {
            return tab2Pinned ? null : tab1.id;
        } else {
            return tab2Pinned ? tab2.id : null;
        }
    }

    return null;
};

const getByAgeTabId = (tab1, tab2) => {

    if (isTabComplete(tab1) && isTabComplete(tab2)) {
        if (options.keepNewerTab) {
            return (tab1.id > tab2.id) ? tab1.id : tab2.id;
        } else {
            return (tab1.id < tab2.id) ? tab1.id : tab2.id;
        }
    } else {
        if (options.keepNewerTab) {
            return isTabLoading(tab1) ? tab1.id : tab2.id;
        } else {
            return isTabComplete(tab1) ? tab1.id : tab2.id;
        }
    }

};

const keepIfHttps = (tabToCloseUrl, tabToKeepurl) => {

    if (options.keepTabWithHttps) {
        const regex = /^https:\/\//i;
        if (regex.test(tabToCloseUrl) && !regex.test(tabToKeepurl)) return true;
    }

    return false;
};

const keepIfPinnedTab = (tabToClose, tabToKeep) => {

    if (options.keepPinnedTab) {
        if (tabToClose.pinned && !tabToKeep.pinned) return true;
    }

    return false;
};

const getTabsPriority = (signaledTab, signaledTabUrl, openTab) => {

    const tabsPriority = {};

    let tabIdToKeep = getPinnedTabId(signaledTab, openTab);

    if (!tabIdToKeep) {

        tabIdToKeep = getHttpsTabId(signaledTab, signaledTabUrl, openTab);
        if (!tabIdToKeep) {
            tabIdToKeep = getByAgeTabId(signaledTab, openTab);
        }
    }

    if (tabIdToKeep == signaledTab.id) {
        tabsPriority.closeSignaledTab = false;
        tabsPriority.tabToClose = openTab;
        tabsPriority.tabToKeep = signaledTab;
        tabsPriority.tabReload = false;
    } else if (tabIdToKeep == openTab.id) {
        tabsPriority.closeSignaledTab = true;
        tabsPriority.tabToClose = signaledTab;
        tabsPriority.tabToKeep = openTab;
        tabsPriority.tabReload = options.keepReloadOlderTab ? true : false;
    }

    return tabsPriority;
};

const closeDuplicateTab = (tabsPriority) => {

    const tabToCloseActive = tabsPriority.tabToClose.active;
    const tabToCloseIndex = tabsPriority.tabToClose.index;

    addToIgnoreTabs(tabsPriority.tabToClose.id);

    chrome.tabs.remove(tabsPriority.tabToClose.id, async () => {

        removeFromIgnoreTabs(tabsPriority.tabToClose.id);

        if (chrome.runtime.lastError) return;

        if (tabsPriority.tabReload) {
            addToIgnoreTabs(tabsPriority.tabToKeep.id);
            reloadTab(tabsPriority.tabToKeep.id).then(removeFromIgnoreTabs(tabsPriority.tabToKeep.id));
        }

        if (options.defaultTabBehavior) {
            if (tabsPriority.closeSignaledTab) {
                if (tabToCloseIndex > 0) await moveTab(tabsPriority.tabToKeep.id, { index: tabToCloseIndex });
                if (tabToCloseActive) activateTab(tabsPriority.tabToKeep.id);
            }
        } else if (options.activateKeptTab) {
            activateTab(tabsPriority.tabToKeep.id, tabsPriority.tabToKeep.windowId);
        }

    });
};

const manageUniqueTab = (matchingInfo) => {

    let matchingTabURL = getMatchingURL(matchingInfo.tab.url);
    let matchingTabTitle = options.compareWithTitle && isTabComplete(matchingInfo.tab) ? matchingInfo.tab.title : "";

    if (options.searchInSameContainer) {
        matchingTabURL += matchingInfo.tab.cookieStoreId;
        if (matchingTabTitle) matchingTabTitle += matchingInfo.tab.cookieStoreId;
    }

    let tabMatchingId = matchingTabURL;
    let uniqueTab = matchingInfo.uniqueMatchingIds.get(tabMatchingId);

    if (!uniqueTab) {
        if (isTabComplete(matchingInfo.tab)) matchingInfo.uniqueMatchingIds.set(tabMatchingId, matchingInfo.tab);
        if (matchingTabTitle) {
            tabMatchingId = matchingTabTitle;
            uniqueTab = matchingInfo.uniqueMatchingIds.get(tabMatchingId);
            if (!uniqueTab) {
                matchingInfo.uniqueMatchingIds.set(tabMatchingId, matchingInfo.tab);
            }
        }
    }

    if (uniqueTab) {
        if (matchingInfo.closeTabs) {
            if (keepIfPinnedTab(matchingInfo.tab, uniqueTab) || keepIfHttps(matchingInfo.tab.url, uniqueTab.url) ||
                ((matchingInfo.tab.windowId === matchingInfo.focusedWindowId) && (matchingInfo.tab.active || (uniqueTab.windowId !== matchingInfo.focusedWindowId)))) {
                chrome.tabs.remove(uniqueTab.id);
                matchingInfo.uniqueMatchingIds.set(tabMatchingId, matchingInfo.tab);
            } else {
                chrome.tabs.remove(matchingInfo.tab.id);
            }
        } else {
            const tabs = matchingInfo.duplicateGroupTabs.get(tabMatchingId);
            matchingInfo.duplicateGroupTabs.set(tabMatchingId, tabs ? tabs.add(matchingInfo.tab) : new Set([uniqueTab, matchingInfo.tab]));
        }
    }
};

const searchForDuplicateTabs = async (windowId, closeTabs) => {

    const queryInfo = { windowType: "normal" };

    const focusedWindowId = await getActiveWindowId();

    if (!options.searchInAllWindows) {
        queryInfo.windowId = (windowId === chrome.windows.WINDOW_ID_CURRENT) ? focusedWindowId : windowId;
    }

    const openTabs = await getTabs(queryInfo);

    if (closeTabs && options.keepNewerTab) openTabs.reverse();

    const duplicateGroupTabs = new Map();
    const uniqueMatchingIds = new Map();

    for (const openTab of openTabs) {

        if (isBlankUrl(openTab.url) || isIgnoreTab(openTab.id)) {
            continue;
        }

        const matchingInfo = {
            tab: openTab,
            uniqueMatchingIds: uniqueMatchingIds,
            focusedWindowId: focusedWindowId,
            closeTabs: closeTabs,
            duplicateGroupTabs: duplicateGroupTabs
        };

        manageUniqueTab(matchingInfo);
    }
    
    if (!closeTabs) {
        updateBadges(duplicateGroupTabs, windowId);

        return {
            duplicateGroupTabs: duplicateGroupTabs,
            focusedWindowId: focusedWindowId
        };
    }

};

/* exported searchAndCloseNewDuplicateTabs */
const searchAndCloseNewDuplicateTabs = async (searchInfo) => {

    const signaledTab = searchInfo.tab;
    const signaledWindowsId = signaledTab.windowId;
    const signaledTabUrl = searchInfo.loadingUrl ? searchInfo.loadingUrl : signaledTab.url;

    if (isIgnoreTab(signaledTab.id)) {
        return;
    }

    if (isWhiteListed(signaledTabUrl)) {
        if (isTabComplete(signaledTab)) refreshDuplicateTabsInfo(signaledTab.windowId);
        return;
    }

    const queryInfo = {};

    if (!options.searchInAllWindows) {
        queryInfo.windowId = signaledTab.windowId;
        if (options.searchInSameContainer) queryInfo.cookieStoreId = signaledTab.cookieStoreId;
    }

    queryInfo.status = searchInfo.queryStatus;
    queryInfo.url = getPatternUrl(signaledTabUrl);

    const openTabs = await getTabs(queryInfo);

    const matchingSignaledTabUrl = getMatchingURL(signaledTabUrl);

    let match = false;

    for (const openTab of openTabs) {

        if ((openTab.id === signaledTab.id) || isBlankUrl(openTab.url) || isIgnoreTab(openTab.id)) {
            continue;
        }

        if ((getMatchingURL(openTab.url) === matchingSignaledTabUrl) || matchTitle(openTab, signaledTab)) {
            match = true;
            const tabsPriority = getTabsPriority(signaledTab, signaledTabUrl, openTab);
            closeDuplicateTab(tabsPriority);
            if (tabsPriority.closeSignaledTab) break;
        }
    }

    if (!match) {
        if (hasDuplicatedTabs(signaledWindowsId)) refreshDuplicateTabsInfo(signaledWindowsId);
    }
};

/* exported closeDuplicateTabs */
const closeDuplicateTabs = (windowId) => searchForDuplicateTabs(windowId, true);

/* exported getDuplicateTabs */
const getDuplicateTabs = async (windowId) => {
    const searchResult = await searchForDuplicateTabs(windowId, false);
    return setupDuplicateTabs(searchResult.duplicateGroupTabs);
};

const addDuplicateTabInfo = async (tab, duplicateTabs) => {

    let containerColor = "";
    if (environment.isFirefox && (!tab.incognito && tab.cookieStoreId !== "firefox-default")) {
        const getContext = await browser.contextualIdentities.get(tab.cookieStoreId);
        if (getContext) containerColor = getContext.color;
    }

    duplicateTabs.add({
        id: tab.id,
        url: tab.url,
        title: tab.title,
        windowId: tab.windowId,
        containerColor: containerColor,
        icon: tab.favIconUrl || "../images/default-favicon.png"
    });

};

const setupDuplicateTabs = async (duplicateGroupsTabs) => {

    if (duplicateGroupsTabs.size === 0) {
        return null;
    }

    const duplicateTabs = new Set();

    for (const groupTab of duplicateGroupsTabs) {
        const duplicateGroupTabs = groupTab[1];
        const promises = [...duplicateGroupTabs].map(duplicateTab => addDuplicateTabInfo(duplicateTab, duplicateTabs));
        await Promise.all(promises);
    }

    return [...duplicateTabs];
};

/* exported refreshDuplicateTabsInfo */
const refreshDuplicateTabsInfo = async (windowId) => {
    const searchResult = await searchForDuplicateTabs(windowId, false);
    if (isOptionOpen() && (!windowId || (windowId === searchResult.focusedWindowId) || (windowId === chrome.windows.WINDOW_ID_CURRENT))) {
        const duplicateTabs = await setupDuplicateTabs(searchResult.duplicateGroupTabs);
        chrome.runtime.sendMessage({
            action: "updateDuplicateTabsTable",
            data: {
                "duplicateTabs": duplicateTabs
            }
        });
    }
};

/* exported refreshGlobalDuplicateTabsInfo */
const refreshGlobalDuplicateTabsInfo = async () => {
    if (options.searchInAllWindows) {
        refreshDuplicateTabsInfo();
    } else {
        const windows = await getWindows();
        windows.forEach(window => refreshDuplicateTabsInfo(window.id));
    }
};