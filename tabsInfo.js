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
            this.setNewTab(openTab.id);
        }
    }

    setNewTab(tabId) {
        const tab = { lastComplete: null, ignored: false };
        this.tabs.set(tabId, tab);
    }

    isIgnored(tabId) {
        const tab = this.tabs.get(tabId);
        return (!tab || tab.ignored) ? true : false;
    }

    ignore(tabId, state) {
        const tab = this.tabs.get(tabId);
        tab.ignored = state;
        this.tabs.set(tabId, tab);
    }

    getLastComplete(tabId) {
        const tab = this.tabs.get(tabId);
        return tab.lastComplete;
    }

    setLastComplete(tabId) {
        const tab = this.tabs.get(tabId);
        tab.lastComplete = Date.now();
        this.tabs.set(tabId, tab);
    }

    clearLastComplete(tabId) {
        const tab = this.tabs.get(tabId);
        if (tab.lastComplete) {
            tab.lastComplete = null;
            this.tabs.set(tabId, tab);
        }
    }

    remove(tabId) {
        this.tabs.delete(tabId);
    }

    has(tabId) {
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