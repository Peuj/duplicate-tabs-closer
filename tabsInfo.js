"use strict";

class TabsInfo {

    constructor() {
        this.storedTabs = new Map();
        this.nbDuplicateTabs = new Map();
        this.intentionalDuplicates = new Set();
    }

    async initialize() {
        const openedTabs = await getTabs({ windowType: "normal" });
        if (!openedTabs) return;
        for (const openedTab of openedTabs) {
            const lastComplete = openedTab.lastAccessed ?? openedTab.index;
            this.setTab(openedTab.id, { url: openedTab.url, complete: true, lastComplete });
        }
        const result = await chrome.storage.session.get("intentionalDuplicates");
        const ids = result.intentionalDuplicates || [];
        ids.forEach(id => this.intentionalDuplicates.add(id));
    }

    setTab(tabId, details) {
        const storedTab = this.storedTabs.get(tabId) ||
            { url: null, lastComplete: null, closing: false };
        const completeChanged = Object.prototype.hasOwnProperty.call(details, "complete");
        if (Object.prototype.hasOwnProperty.call(details, "url")) storedTab.url = details.url;
        if (completeChanged) storedTab.lastComplete = details.complete ? (details.lastComplete ?? Date.now()) : null;
        if (Object.prototype.hasOwnProperty.call(details, "closing")) storedTab.closing = details.closing;
        this.storedTabs.set(tabId, storedTab);
    }

    setClosingTab(tabId, state) {
        this.setTab(tabId, { closing: state });
    }

    isClosingTab(tabId) {
        const storedTab = this.storedTabs.get(tabId);
        return !storedTab || storedTab.closing;
    }

    getLastComplete(tabId) {
        const storedTab = this.storedTabs.get(tabId);
        return storedTab ? storedTab.lastComplete : null;
    }

    getStoredUrl(tabId) {
        const storedTab = this.storedTabs.get(tabId);
        return storedTab ? storedTab.url : null;
    }

    hasUrlChanged(openedTab) {
        const storedTab = this.storedTabs.get(openedTab.id);
        return storedTab ? storedTab.url !== openedTab.url : true;
    }

    removeTab(tabId) {
        this.storedTabs.delete(tabId);
        if (this.intentionalDuplicates.has(tabId)) {
            this.intentionalDuplicates.delete(tabId);
            this._persistIntentionalDuplicates();
        }
    }

    hasTab(tabId) {
        return this.storedTabs.has(tabId);
    }

    needsRefresh(windowId) {
        // Returns true when undefined (never initialized, forces badge init for new windows)
        // or > 0 (duplicates exist). Do NOT simplify to a boolean — the undefined case is
        // load-bearing for badge initialization on newly created windows.
        return this.nbDuplicateTabs.get(windowId) !== 0;
    }

    getNbDuplicateTabs(windowId) {
        return this.nbDuplicateTabs.get(windowId) ?? 0;
    }

    hasNbDuplicateTabs(windowId) {
        return this.nbDuplicateTabs.has(windowId);
    }

    setNbDuplicateTabs(windowId, nbDuplicateTabs) {
        if (this.nbDuplicateTabs.get(windowId) === nbDuplicateTabs) return;
        this.nbDuplicateTabs.set(windowId, nbDuplicateTabs);
    }

    clearDuplicateTabsInfo(windowId) {
        if (this.nbDuplicateTabs.has(windowId)) this.nbDuplicateTabs.delete(windowId);
    }

    setIntentionalDuplicate(tabId) {
        this.intentionalDuplicates.add(tabId);
        this._persistIntentionalDuplicates();
    }

    clearIntentionalDuplicate(tabId) {
        if (!this.intentionalDuplicates.has(tabId)) return;
        this.intentionalDuplicates.delete(tabId);
        this._persistIntentionalDuplicates();
    }

    _persistIntentionalDuplicates() {
        chrome.storage.session.set({ intentionalDuplicates: Array.from(this.intentionalDuplicates) });
    }

    isIntentionalDuplicate(tabId) {
        return this.intentionalDuplicates.has(tabId);
    }

}

const tabsInfo = new TabsInfo();