"use strict";

const isUrlWhiteListed = (url) => {
    # mod - reversed this to only check dupe tabs with urls listed (instead of default to everyone)
    const matches = options.whiteList.filter(pattern => !pattern.test(url));
    return matches.length !== 0;
};

const matchTitle = (tab1, tab2) => {
    if (options.compareWithTitle) {
        if ((isTabComplete(tab1) && isTabComplete(tab2)) && (tab1.title === tab2.title)) {
            return true;
        }
    }
    return false;
};

const getHttpsTabId = (observedTab, observedTabUrl, openedTab) => {
    if (options.keepTabWithHttps) {
        const regex = /^https:\/\//i;
        const match1 = regex.test(observedTabUrl);
        const match2 = regex.test(openedTab.url);
        if (match1) {
            return match2 ? null : observedTab.id;
        } else {
            return match2 ? openedTab.id : null;
        }
    }
    return null;
};

const getPinnedTabId = (tab1, tab2) => {
    if (options.keepPinnedTab) {
        if (tab1.pinned) {
            return tab2.pinned ? null : tab1.id;
        } else {
            return tab2.pinned ? tab2.id : null;
        }
    }
    return null;
};

const getLastUpdatedTabId = (observedTab, openedTab) => {
    const observedTabLastUpdate = tabsInfo.getLastComplete(observedTab.id);
    const openedTabLastUpdate = tabsInfo.getLastComplete(openedTab.id);
    if (options.keepNewerTab) {
        if (observedTabLastUpdate === null) return observedTab.id;
        if (openedTabLastUpdate === null) return openedTab.id;
        return (observedTabLastUpdate > openedTabLastUpdate) ? observedTab.id : openedTab.id;
    } else {
        if (observedTabLastUpdate === null) return openedTab.id;
        if (openedTabLastUpdate === null) return observedTab.id;
        return (observedTabLastUpdate < openedTabLastUpdate) ? observedTab.id : openedTab.id;
    }
};

const getFocusedTab = (observedTab, openedTab, activeWindowId, retainedTabId) => {
    if (retainedTabId === observedTab.id) {
        return ((openedTab.windowId === activeWindowId) && (openedTab.active || (observedTab.windowId !== activeWindowId)) ? openedTab.id : observedTab.id);
    }
    else {
        return ((observedTab.windowId === activeWindowId) && (observedTab.active || (openedTab.windowId !== activeWindowId)) ? observedTab.id : openedTab.id);
    }
};


const getCloseInfo = (details) => {
    const observedTab = details.observedTab;
    const observedTabUrl = details.observedTabUrl || observedTab.url;
    const openedTab = details.openedTab;
    const activeWindowId = details.activeWindowId;
    let retainedTabId = getPinnedTabId(observedTab, openedTab);
    if (!retainedTabId) {
        retainedTabId = getHttpsTabId(observedTab, observedTabUrl, openedTab);
        if (!retainedTabId) {
            retainedTabId = getLastUpdatedTabId(observedTab, openedTab);
            if (activeWindowId) {
                retainedTabId = getFocusedTab(observedTab, openedTab, activeWindowId, retainedTabId);
            }
        }
    }
    if (retainedTabId == observedTab.id) {
        const keepInfo = {
            observedTabClosed: false,
            active: openedTab.active,
            tabIndex: openedTab.index,
            tabId: observedTab.id,
            windowId: observedTab.windowId,
            reloadTab: false
        };
        return [openedTab.id, keepInfo];
    } else {
        const keepInfo = {
            observedTabClosed: true,
            active: observedTab.active,
            tabIndex: observedTab.index,
            tabId: openedTab.id,
            windowId: openedTab.windowId,
            reloadTab: options.keepReloadOlderTab ? true : false
        };
        return [observedTab.id, keepInfo];
    }
};

// eslint-disable-next-line no-unused-vars
const searchForDuplicateTabsToClose = async (observedTab, queryComplete, loadingUrl) => {
    const observedTabUrl = loadingUrl || observedTab.url;
    const observedWindowsId = observedTab.windowId;
    if (isUrlWhiteListed(observedTabUrl)) {
        if (isTabComplete(observedTab)) refreshDuplicateTabsInfo(observedWindowsId);
        return;
    }
    const queryInfo = {};
    queryInfo.status = queryComplete ? "complete" : null;
    queryInfo.url = getMatchPatternURL(observedTabUrl);
    queryInfo.windowId = options.searchInAllWindows ? null : observedWindowsId;
    if (environment.isFirefox) queryInfo.cookieStoreId = options.searchPerContainer ? observedTab.cookieStoreId : null;
    const openedTabs = await getTabs(queryInfo);
    if (openedTabs.length > 1) {
        const matchingObservedTabUrl = getMatchingURL(observedTabUrl);
        let match = false;
        for (const openedTab of openedTabs) {
            if ((openedTab.id === observedTab.id) || tabsInfo.isIgnoredTab(openedTab.id) || (isBlankURL(openedTab.url) && !isTabComplete(openedTab))) continue;
            if ((getMatchingURL(openedTab.url) === matchingObservedTabUrl) || matchTitle(openedTab, observedTab)) {
                match = true;
                const [tabToCloseId, remainingTabInfo] = getCloseInfo({ observedTab: observedTab, observedTabUrl: observedTabUrl, openedTab: openedTab });
                closeDuplicateTab(tabToCloseId, remainingTabInfo);
                if (remainingTabInfo.observedTabClosed) break;
            }
        }
        if (!match) {
            if (tabsInfo.hasDuplicateTabs(observedWindowsId)) refreshDuplicateTabsInfo(observedWindowsId);
            else if (environment.isChrome && observedTab.active) setBadge(observedTab.windowId, observedTab.id);
        }
    }
};

const closeDuplicateTab = async (tabToCloseId, remainingTabInfo) => {
    try {
        tabsInfo.ignoreTab(tabToCloseId, true);
        await removeTab(tabToCloseId);
    }
    catch (ex) {
        tabsInfo.ignoreTab(tabToCloseId, false);
        return;
    }
    if (tabsInfo.hasTab(tabToCloseId)) {
        await wait(10);
        if (tabsInfo.hasTab(tabToCloseId)) {
            tabsInfo.ignoreTab(tabToCloseId, false);
            refreshDuplicateTabsInfo(remainingTabInfo.windowId);
            return;
        }
    }
    handleRemainingTab(remainingTabInfo.windowId, remainingTabInfo);
};

const _handleRemainingTab = async (details) => {
    if (!tabsInfo.hasTab(details.tabId)) return;
    if (options.defaultTabBehavior && details.observedTabClosed) {
        if (details.tabIndex > 0) moveTab(details.tabId, { index: details.tabIndex });
        if (details.active) activateTab(details.tabId);
    } else if (options.activateKeptTab) {
        focusTab(details.tabId, details.windowId);
    }
    if (details.reloadTab) {
        tabsInfo.ignoreTab(details.tabId, true);
        await reloadTab(details.tabId);
        tabsInfo.ignoreTab(details.tabId, false);
    }
};

const handleRemainingTab = debounce(_handleRemainingTab, 500);

const handleObservedTab = (details) => {
    const observedTab = details.tab;
    const retainedTabs = details.retainedTabs;
    const duplicateTabsGroups = details.duplicateTabsGroups;
    let matchingTabURL = getMatchingURL(observedTab.url);
    let matchingTabTitle = options.compareWithTitle && isTabComplete(observedTab) ? `title=${observedTab.title}` : null;
    if (options.searchPerContainer) {
        matchingTabURL += observedTab.cookieStoreId;
        if (matchingTabTitle) matchingTabTitle += observedTab.cookieStoreId;
    }
    let matchingKey = matchingTabURL;
    let retainedTab = retainedTabs.get(matchingKey);
    if (!retainedTab) {
        if (isTabComplete(observedTab)) retainedTabs.set(matchingKey, observedTab);
        if (matchingTabTitle) {
            matchingKey = matchingTabTitle;
            retainedTab = retainedTabs.get(matchingKey);
            if (!retainedTab) {
                retainedTabs.set(matchingKey, observedTab);
            }
        }
    }
    if (retainedTab) {
        if (details.closeTab) {
            const [tabToCloseId] = getCloseInfo({ observedTab: observedTab, openedTab: retainedTab, activeWindowId: details.activeWindowId });
            if (tabToCloseId === observedTab.id) {
                chrome.tabs.remove(observedTab.id);
            }
            else {
                chrome.tabs.remove(retainedTab.id);
                retainedTabs.set(matchingKey, observedTab);
            }
        } else {
            const tabs = duplicateTabsGroups.get(matchingKey) || new Set([retainedTab]);
            tabs.add(observedTab);
            duplicateTabsGroups.set(matchingKey, tabs);
        }
    }
};

// eslint-disable-next-line no-unused-vars
const searchForDuplicateTabs = async (windowId, closeTabs) => {
    const queryInfo = { windowType: "normal" };
    if (!options.searchInAllWindows) queryInfo.windowId = windowId;
    const [activeWindowId, openedTabs] = await Promise.all([getActiveWindowId(), getTabs(queryInfo)]);
    const duplicateTabsGroups = new Map();
    const retainedTabs = new Map();
    for (const openedTab of openedTabs) {
        if ((isBlankURL(openedTab.url) && !isTabComplete(openedTab)) || tabsInfo.isIgnoredTab(openedTab.id)) continue;
        const details = {
            tab: openedTab,
            retainedTabs: retainedTabs,
            activeWindowId: activeWindowId,
            closeTab: closeTabs,
            duplicateTabsGroups: duplicateTabsGroups
        };
        handleObservedTab(details);
    }
    if (!closeTabs) {
        return {
            duplicateTabsGroups: duplicateTabsGroups,
            activeWindowId: activeWindowId
        };
    }
};

// eslint-disable-next-line no-unused-vars
const closeDuplicateTabs = (windowId) => searchForDuplicateTabs(windowId, true);

const setDuplicateTabPanel = async (duplicateTab, duplicateTabs) => {
    let containerColor = "";
    if (environment.isFirefox && (!duplicateTab.incognito && duplicateTab.cookieStoreId !== "firefox-default")) {
        const getContext = await browser.contextualIdentities.get(duplicateTab.cookieStoreId);
        if (getContext) containerColor = getContext.color;
    }
    duplicateTabs.add({
        id: duplicateTab.id,
        url: duplicateTab.url,
        title: duplicateTab.title || duplicateTab.url,
        windowId: duplicateTab.windowId,
        containerColor: containerColor,
        icon: duplicateTab.favIconUrl || "../images/default-favicon.png"
    });
};

const getDuplicateTabsForPanel = async (duplicateTabsGroups) => {
    if (duplicateTabsGroups.size === 0) return null;
    const duplicateTabsPanel = new Set();
    for (const tabsGroup of duplicateTabsGroups) {
        const duplicateTabs = tabsGroup[1];
        await Promise.all(Array.from(duplicateTabs, duplicateTab => setDuplicateTabPanel(duplicateTab, duplicateTabsPanel)));
    }
    return Array.from(duplicateTabsPanel);
};

// eslint-disable-next-line no-unused-vars
const requestDuplicateTabsFromPanel = async (windowId) => {
    const searchResult = await searchForDuplicateTabs(windowId, false);
    sendDuplicateTabs(searchResult.duplicateTabsGroups);
};

const sendDuplicateTabs = async (duplicateTabsGroups) => {
    const duplicateTabs = await getDuplicateTabsForPanel(duplicateTabsGroups);
    chrome.runtime.sendMessage({
        action: "updateDuplicateTabsTable",
        data: { "duplicateTabs": duplicateTabs }
    });
};

const _refreshDuplicateTabsInfo = async (windowId) => {
    const searchResult = await searchForDuplicateTabs(windowId, false);
    updateBadgesValue(searchResult.duplicateTabsGroups, windowId);
    if (isPanelOptionOpen() && (options.searchInAllWindows || (windowId === searchResult.activeWindowId))) {
        sendDuplicateTabs(searchResult.duplicateTabsGroups);
    }
};

const refreshDuplicateTabsInfo = debounce(_refreshDuplicateTabsInfo, 300);

// eslint-disable-next-line no-unused-vars
const refreshGlobalDuplicateTabsInfo = async () => {
    if (options.searchInAllWindows) {
        refreshDuplicateTabsInfo();
    } else {
        const windows = await getWindows();
        windows.forEach(window => refreshDuplicateTabsInfo(window.id));
    }
};
