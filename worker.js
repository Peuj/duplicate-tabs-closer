"use strict";

const duplicateTabsClosing = new Set();

const isWhiteListed = (url) => {

    //https://github.com/kevinzwhuang/wildcard-regex/blob/master/src/wildcardPattern.js
    // console.log(options.whiteList);

    const matches = options.whiteList.filter(pattern => pattern.test(url));
    return matches.length === 0 ? false : true;
}

const matchTitle = (openTab, signaledTab) => {

    if (options.compareWithTitle) {
        if ((tabComplete(openTab) && tabComplete(signaledTab)) && (openTab.title === signaledTab.title)) {
            return true;
        }
    }

    return false;
};

const getHttpsTab = (url1, url2) => {

    if (options.keepTabWithHttps) {
        const regex = /^https:\/\//i;
        const match1 = regex.test(url1);
        const match2 = regex.test(url2);

        if (match1) {
            return match2 ? 0 : 1;
        } else {
            return match2 ? 2 : 0;
        }
    }

    return 0;
};

const getPinnedTab = (tab1, tab2) => {

    if (options.keepPinnedTab) {
        const tab1Pinned = tab1.pinned;
        const tab2Pinned = tab2.pinned;

        if (tab1Pinned) {
            return tab2Pinned ? 0 : 1;
        } else {
            return tab2Pinned ? 2 : 0;
        }
    }

    return 0;
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

    const keepSignaledTab = 1;
    const keepOpenTab = 2;
    const priority = {};

    let tabToKeep = getPinnedTab(signaledTab, openTab);

    if (tabToKeep === 0) {

        tabToKeep = getHttpsTab(signaledTabUrl, openTab.url);

        if (tabToKeep === 0) {

            if (tabComplete(signaledTab) && tabComplete(openTab)) {
                if (options.keepNewerTab) {
                    tabToKeep = (signaledTab.id > openTab.id) ? keepSignaledTab : keepOpenTab;
                } else {
                    tabToKeep = (signaledTab.id < openTab.id) ? keepSignaledTab : keepOpenTab;
                }
            } else {
                if (options.keepNewerTab) {
                    tabToKeep = !(tabComplete(signaledTab) && tabLoading(openTab)) ? keepSignaledTab : keepOpenTab;
                } else {
                    tabToKeep = (tabComplete(signaledTab) && tabLoading(openTab)) ? keepSignaledTab : keepOpenTab;
                }
            }

        }
    }

    if (tabToKeep == keepSignaledTab) {
        priority.closeSignaledTab = false;
        priority.tabToClose = openTab;
        priority.tabToKeep = signaledTab;
        priority.tabReload = false;
    } else if (tabToKeep == keepOpenTab) {
        priority.closeSignaledTab = true;
        priority.tabToClose = signaledTab;
        priority.tabToKeep = openTab;
        priority.tabReload = options.keepReloadOlderTab ? true : false;
    }

    return priority;
};

const closeDuplicateTab = (priority) => {

    duplicateTabsClosing.add(priority.tabToClose.id);

    const tabToCloseActive = priority.tabToClose.active;
    const tabToCloseIndex = priority.tabToClose.index;

    chrome.tabs.remove(priority.tabToClose.id, async () => {

        duplicateTabsClosing.delete(priority.tabToClose.id);

        if (chrome.runtime.lastError) return;

        if (priority.tabReload) reloadTab(priority.tabToKeep.id);

        if (options.defaultTabBehavior) {
            if (priority.closeSignaledTab) {
                if (tabToCloseIndex > 0) await moveTab(priority.tabToKeep.id, {
                    index: tabToCloseIndex
                });
                if (tabToCloseActive) await activateTab(priority.tabToKeep.id);
            }
        } else if (options.activateKeptTab) {
            activateTab(priority.tabToKeep.id, priority.tabToKeep.windowId);
        }

    });
};

const manageUniqueTab = (tab, tabMatchingId, uniqueTabIds, focusedWindowId, closeTabs, duplicateGroupTabs) => {

    if (options.searchInSameContainer) tabMatchingId += tab.cookieStoreId;

    const tabMatch = uniqueTabIds.has(tabMatchingId);

    if (tabMatch) {
        const uniqueTab = uniqueTabIds.get(tabMatchingId);

        if (closeTabs) {
            if (keepIfPinnedTab(tab, uniqueTab) || keepIfHttps(tab.url, uniqueTab.url) ||
                ((tab.windowId === focusedWindowId) && (tab.active || (uniqueTab.windowId !== focusedWindowId)))) {
                chrome.tabs.remove(uniqueTab.id);
                uniqueTabIds.set(tabMatchingId, tab);
            } else {
                chrome.tabs.remove(tab.id);
            }
        } else {
            const tabIds = duplicateGroupTabs.get(tabMatchingId);
            duplicateGroupTabs.set(tabMatchingId, tabIds ? tabIds.add(tab) : new Set([uniqueTab, tab]));
        }

    } else {
        if (tabComplete(tab)) uniqueTabIds.set(tabMatchingId, tab);
    }

    return tabMatch;
};

const searchForDuplicateTabs = async (windowId, closeTabs, removedTabId) => {
    console.log("searchForDuplicateTabs");
    console.log("ignorePathPart", options.ignorePathPart);
    
    const duplicateGroupTabs = new Map();

    const queryInfo = {
        windowType: "normal"
    };

    const focusedWindowId = await getActiveWindowId();

    if (!options.searchInAllWindows) {
        queryInfo.windowId = (windowId === chrome.windows.WINDOW_ID_CURRENT) ? focusedWindowId : windowId;
    }

    const openTabs = await getTabs(queryInfo);

    if (closeTabs && options.keepNewerTab) openTabs.reverse();

    const uniqueUrls = new Map();
    const uniqueTitles = new Map();

    for (const openTab of openTabs) {

        if (isBlankUrl(openTab.url) || (openTab.id === removedTabId)) {
            continue;
        }

        const match = manageUniqueTab(openTab, matchingURL(openTab.url), uniqueUrls, focusedWindowId, closeTabs, duplicateGroupTabs);

        if (!match && options.compareWithTitle && tabComplete(openTab)) {
            manageUniqueTab(openTab, openTab.title, uniqueTitles, focusedWindowId, closeTabs, duplicateGroupTabs);
        }

    }

    if (!closeTabs) updateBadges(duplicateGroupTabs, windowId);

    return {
        duplicateGroupTabs: duplicateGroupTabs,
        focusedWindowId: focusedWindowId
    };
};

/* exported searchAndCloseNewDuplicateTabs */
const searchAndCloseNewDuplicateTabs = async (searchInfo) => {
    console.log("searchAndCloseNewDuplicateTabs");
    if (duplicateTabsClosing.has(searchInfo.tab.id)) {
        return;
    }

    const signaledTab = searchInfo.tab;
    const signaledWindowsId = signaledTab.windowId;
    const signaledTabActive = signaledTab.active;
    const signaledTabUrl = searchInfo.loadingUrl ? searchInfo.loadingUrl : signaledTab.url;

    if (isWhiteListed(signaledTabUrl)) {
        console.log("isWhiteListed: ", signaledTabUrl);
        refreshDuplicateTabsStatus(signaledWindowsId)
        return;
    }

    const matchingSignaledTabUrl = matchingURL(signaledTabUrl);

    const queryInfo = {};

    if (searchInfo.queryStatus) queryInfo.status = searchInfo.queryStatus;

    if (!options.searchInAllWindows) {
        queryInfo.windowId = signaledTab.windowId;
        if (options.searchInSameContainer) queryInfo.cookieStoreId = signaledTab.cookieStoreId;
    }

    const openTabs = await getTabs(queryInfo);
    let match = false;

    for (const openTab of openTabs) {

        if ((openTab.id === signaledTab.id) || isBlankUrl(openTab.url) || duplicateTabsClosing.has(openTab.id)) {
            continue;
        }

        if ((matchingURL(openTab.url) === matchingSignaledTabUrl) || matchTitle(openTab, signaledTab)) {

            match = true;

            const priority = getTabsPriority(signaledTab, signaledTabUrl, openTab);

            closeDuplicateTab(priority);

            if (priority.closeSignaledTab) {
                break;
            }

        }
    }

    if (!match) {
        if (hasDuplicatedTabs(signaledWindowsId)) refreshDuplicateTabsStatus(signaledWindowsId);
        else if (signaledTabActive) setBadge({
            windowId: signaledWindowsId
        });
    }
};

/* exported closeDuplicateTabs */
const closeDuplicateTabs = (windowId) => searchForDuplicateTabs(windowId, true);

/* exported getDuplicateTabs */
const getDuplicateTabs = async (windowId) => {
    const searchInfo = await searchForDuplicateTabs(windowId, false);
    return setDuplicateTabs(searchInfo.duplicateGroupTabs);
};

const addDuplicateTab = async (tab, group, duplicateTabs) => {

    let containerColor = "";
    try {
        if (tab.cookieStoreId !== "firefox-default") {
            const getContext = await browser.contextualIdentities.get(tab.cookieStoreId);
            if (getContext) containerColor = getContext.color;
        }
    } catch (error) {
        // console.error(error);
    }

    duplicateTabs.add({
        id: tab.id,
        url: tab.url,
        title: tab.title,
        windowId: tab.windowId,
        group: group,
        containerColor: containerColor,
        icon: tab.favIconUrl || "../images/default-favicon.png"
    });

};

const setDuplicateTabs = async (duplicateGroupTabs) => {

    if (duplicateGroupTabs.size === 0) {
        return null;
    }

    for (let duplicateTabs of duplicateGroupTabs.values()) {
        duplicateTabs = [...duplicateTabs].sort((tab1, tab2) => tab1.index - tab2.index);
    }

    const sortedGroupTabs = new Map([...duplicateGroupTabs.entries()].sort((entry1, entry2) => entry1[1][0] - entry2[1][0]));

    const sortedTabs = new Set();

    for (const groupTab of sortedGroupTabs) {
        const group = groupTab[0];
        const duplicateTabs = groupTab[1];

        const promises = [...duplicateTabs].map(duplicateTab => addDuplicateTab(duplicateTab, group, sortedTabs));
        await Promise.all(promises);
    }

    return [...sortedTabs];
};

/* exported refreshDuplicateTabsStatus */
const refreshDuplicateTabsStatus = async (windowId, removedTabId) => {
    const searchInfo = await searchForDuplicateTabs(windowId, false, removedTabId);
    if (isOptionOpen() && (!windowId || (windowId === searchInfo.focusedWindowId) || (windowId === chrome.windows.WINDOW_ID_CURRENT))) {
        const duplicateTabs = await setDuplicateTabs(searchInfo.duplicateGroupTabs);
        console.log("refreshDuplicateTabsStatus sendMessage");
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
        refreshDuplicateTabsStatus();
    } else {
        const windows = await getWindows();
        windows.forEach(window => refreshDuplicateTabsStatus(window.id));
    }
};