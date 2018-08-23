"use strict";

/* exported tabComplete */
const tabComplete = tab => tab.status === "complete";

/* exported tabLoading */
const tabLoading = tab => tab.status === "loading";

/* exported getTab */
const getTab = (tabId) => {
    return new Promise((resolve) => chrome.tabs.get(tabId, tab => resolve(chrome.runtime.lastError ? null : tab)));
};

/* exported getTabs */
const getTabs = (queryInfo) => {
    return new Promise((resolve) => {
        queryInfo.windowType = "normal";
        chrome.tabs.query(queryInfo, tabs => resolve(chrome.runtime.lastError ? null : tabs));
    });
};

/* exported getWindow */
const getWindow = (windowId) => {
    return new Promise((resolve) => chrome.windows.get(windowId, windows => resolve(windows)));
};

/* exported getWindows */
const getWindows = () => {
    return new Promise((resolve) => chrome.windows.getAll({ windowTypes: ["normal"] }, windows => resolve(windows)));
};

/* exported updateWindow */
const updateWindow = (windowId, updateProperties) => {
    return new Promise((resolve) => chrome.windows.update(windowId, updateProperties, () => resolve()));
};

/* exported getActiveTab */
const getActiveTab = async (windowId) => {
    const tabs = await getTabs({ windowId: windowId, active: true });
    return tabs[0];
};

/* exported getActiveWindowId */
const getActiveWindowId = async () => {
    const tabs = await getTabs({ currentWindow: true, active: true });
    return tabs[0].windowId;
};

/* exported updateTab */
const updateTab = (tabId, updateProperties) => {
    return new Promise((resolve) => chrome.tabs.update(tabId, updateProperties, () => resolve()));
};

/* exported activateWindow */
const activateWindow = (windowId) => updateWindow(windowId, { focused: true });

/* exported activateTab */
const activateTab = async (tabId, windowId) => {
    if (windowId) {
        const window = await getWindow(windowId);
        if (!window.focused) await activateWindow(windowId);
    }
    updateTab(tabId, { active: true });
};

/* exported moveTab */
const moveTab = (tabId, moveProperties) => {
    return new Promise((resolve) => chrome.tabs.move(tabId, moveProperties, () => resolve()));
};

/* exported setIcon */
const setIcon = (details) => {
    return new Promise((resolve) => chrome.browserAction.setIcon(details, () => resolve()));
};

/* exported getTabBadgeText */
const getTabBadgeText = (tabId) => {
    return new Promise((resolve) => chrome.browserAction.getBadgeText({ tabId: tabId }, badgeText => resolve(badgeText)));
};

/* exported getWindowBadgeText */
const getWindowBadgeText = (windowId) => {
    return browser.browserAction.getBadgeText({ windowId: windowId });
};

/* exported getStoredOptions */
const getStoredOptions = () => {
    return new Promise((resolve) => chrome.storage.local.get(null, options => resolve(options)));
};

/* exported clearStoredOptions */
const clearStoredOptions = () => {
    return new Promise((resolve) => chrome.storage.local.clear(() => resolve()));
};

/* exported saveStoredOptions */
const saveStoredOptions = async (options, overwrite) => {
    if (overwrite) await clearStoredOptions();
    return new Promise((resolve) => chrome.storage.local.set(options, () => resolve(Object.assign({}, options))));
};

/* exported getPlatformInfo */
const getPlatformInfo = () => {
    return new Promise((resolve) => chrome.runtime.getPlatformInfo(info => resolve(info)));
};