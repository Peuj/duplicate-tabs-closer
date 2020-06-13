"use strict";

class TabsInfo {

    constructor() {
        this.tabs = new Map();
        this.nbDuplicateTabs = new Map();
        this.initialize();
    }

    async initialize() {
        const openTabs = await getTabs({ windowType: "normal" });
        for (const openTab of openTabs) {
            this.setNewTab(openTab, true);
        }
    }

    setNewTab(openTab, init) {
        const tab = init ? { url: openTab.url, lastComplete: Date.now(), ignored: false } : { url: null, lastComplete: null, ignored: false };
        this.tabs.set(openTab.id, tab);
    }

    isIgnoredTab(tabId) {
        const tab = this.tabs.get(tabId);
        return (!tab || tab.ignored) ? true : false;
    }

    ignoreTab(tabId, state) {
        const tab = this.tabs.get(tabId);
        tab.ignored = state;
        this.tabs.set(tabId, tab);
    }

    getLastComplete(tabId) {
        const tab = this.tabs.get(tabId);
        return tab.lastComplete;
    }

    updateTab(openTab) {
        const tab = this.tabs.get(openTab.id);
        tab.url = openTab.url;
        tab.lastComplete = Date.now();
        this.tabs.set(openTab.id, tab);
    }

    resetTab(tabId) {
        const tab = this.tabs.get(tabId);
        tab.url = null;
        tab.lastComplete = null;
        if (tab.ignored) console.warn("resetTab tab ignored", tab);
        this.tabs.set(tabId, tab);
    }

    hasUrlChanged(openTab) {
        const tab = this.tabs.get(openTab.id);
        return tab.url !== openTab.url;
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