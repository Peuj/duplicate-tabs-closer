"use strict";

class TabsInfo {

    constructor() {
        this.tabs = new Map();
        this.nbDuplicateTabs = new Map();
        this.initialize();
    }

    async initialize() {
        const openedTabs = await getTabs({ windowType: "normal" });
        for (const openedTab of openedTabs) {
            this.setOpenedTab(openedTab);
        }
    }

    setNewTab(tabId) {
        const tab = { url: null, lastComplete: null, ignored: false };
        this.tabs.set(tabId, tab);
    }

    setOpenedTab(openedTab) {
        const tab = { url: openedTab.url, lastComplete: Date.now(), ignored: false };
        this.tabs.set(openedTab.id, tab);
    }

    ignoreTab(tabId, state) {
        const tab = this.tabs.get(tabId);
        tab.ignored = state;
        this.tabs.set(tabId, tab);
    }

    isIgnoredTab(tabId) {
        const tab = this.tabs.get(tabId);
        return (!tab || tab.ignored) ? true : false;
    }

    getLastComplete(tabId) {
        const tab = this.tabs.get(tabId);
        return tab.lastComplete;
    }

    updateTab(openedTab) {
        const tab = this.tabs.get(openedTab.id);
        tab.url = openedTab.url;
        tab.lastComplete = Date.now();
        this.tabs.set(openedTab.id, tab);
    }

    resetTab(tabId) {
        this.setNewTab(tabId);
    }

    hasUrlChanged(openedTab) {
        const tab = this.tabs.get(openedTab.id);
        return tab.url !== openedTab.url;
    }

    removeTab(tabId) {
        this.tabs.delete(tabId);
    }

    hasTab(tabId) {
        return this.tabs.has(tabId);
    }

    hasDuplicateTabs(windowId) {
        // Even nothing set, return true so it will force the refresh and set the badge.
        return this.nbDuplicateTabs.get(windowId) !== "0";
    }

    getNbDuplicateTabs(windowId) {
        return this.nbDuplicateTabs.get(windowId) || "0";
    }

    setNbDuplicateTabs(windowId, nbDuplicateTabs) {
        this.nbDuplicateTabs.set(windowId, nbDuplicateTabs.toString());
    }

    clearDuplicateTabsInfo(windowId) {
        if (this.nbDuplicateTabs.has(windowId)) this.nbDuplicateTabs.delete(windowId);
    }

}

// eslint-disable-next-line no-unused-vars
const tabsInfo = new TabsInfo();