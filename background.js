"use strict";

// Chrome MV3 service worker only — Firefox loads scripts via manifest background.scripts
if (typeof importScripts === "function") {
	importScripts("helper.js", "tabsInfo.js", "options.js", "urlUtils.js", "badge.js", "tst.js", "worker.js", "messageListener.js");
}

let initPromise = null;
let monitoringPaused = false;
const generateTabSessionId = () => `dtc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

// Firefox fires onBeforeNavigate twice per navigation (once on URL resolve, once on request start).
// Track last dispatched URL+timestamp per tab to skip the redundant second call.
const _lastNavigate = new Map(); // tabId -> { url, ts }

// Tabs that existed when DTC initialized — their session IDs are seeded by initializeTabSessionIds.
// onCreatedTab fires for these tabs too at startup, but they must NOT be marked intentional-duplicate
// (they are pre-existing tabs, not undo-close restores).
const _seededTabIds = new Set();
const _preCreatedTabs = new Set(); // Chrome: before-navigate fired before tab-created (= Duplicate Tab command)

// eslint-disable-next-line no-unused-vars
const ensureInitialized = () => {
	if (!initPromise) initPromise = initialize().catch(err => { initPromise = null; throw err; });
	return initPromise;
};

const initialize = async () => {
	await initializeOptions();
	await tabsInfo.initialize();
	if (environment.isFirefox) await registerWithTST();
	const sessionData = await chrome.storage.session.get('monitoringPaused');
	monitoringPaused = sessionData.monitoringPaused || false;
	setBadgeIcon();
	if (monitoringPaused) setPausedBadge();
	if (environment.isFirefox) await initializeTabSessionIds();
	if (!monitoringPaused) await refreshGlobalDuplicateTabsInfo();
	startupBurst.active = true;
	startupBurst.startedAt = Date.now();
	startupBurst.timerId = setTimeout(() => {
		startupBurst.active = false;
		_seededTabIds.clear(); // all startup onCreatedTab events have now been processed
	}, 3000);
};

// eslint-disable-next-line no-unused-vars
const toggleMonitorPause = async () => {
	monitoringPaused = !monitoringPaused;
	await chrome.storage.session.set({ monitoringPaused });
	if (monitoringPaused) {
		await setStoredOption("onDuplicateTabDetected", "N", false);
		chrome.runtime.sendMessage({ action: "setStoredOption", data: { name: "onDuplicateTabDetected", value: "N" } }).catch(() => {});
		setPausedBadge();
		chrome.runtime.sendMessage({ action: "updateDuplicateTabsTable", data: { duplicateTabs: null } }).catch(() => {});
	} else {
		await tabsInfo.initialize();
		setBadgeIcon();
		updateBadgeStyle();
		refreshGlobalDuplicateTabsInfo();
	}
};

const initializeTabSessionIds = async () => {
	const tabs = await getTabs({ windowType: "normal" });
	if (!tabs) return;
	await Promise.allSettled(tabs.map(async tab => {
		_seededTabIds.add(tab.id);
		const existingId = await browser.sessions.getTabValue(tab.id, 'dtc-tab-id');
		const id = existingId || generateTabSessionId();
		tabsInfo.storeTabSessionId(tab.id, id); // in-memory first — never skipped
		if (!existingId) await browser.sessions.setTabValue(tab.id, 'dtc-tab-id', id);
	}));
};

const onCreatedTab = async (tab) => {
	await ensureInitialized();
	if (monitoringPaused) return;
	if (typeof browser !== "undefined" && browser.sessions) {
		// Register pending session check synchronously (no await before this block)
		// to prevent race with webNavigation events
		const checkPromise = (async () => {
			if (!environment.isFirefox) return;
			try {
				const existingId = await browser.sessions.getTabValue(tab.id, 'dtc-tab-id');
				if (existingId !== undefined && tabsInfo.isKnownSessionId(existingId) && !_seededTabIds.has(tab.id)) {
					tabsInfo.setIntentionalDuplicate(tab.id);
				}
				const newId = generateTabSessionId();
				tabsInfo.storeTabSessionId(tab.id, newId);
				await browser.sessions.setTabValue(tab.id, 'dtc-tab-id', newId);
			} catch (e) {
				// session API error — tab will not be marked intentional-duplicate
			} finally {
				_seededTabIds.delete(tab.id); // clean up — always runs even if sessions API throws
			}
		})();
		tabsInfo.setPendingCheck(tab.id, checkPromise);
	}
	if (environment.isChrome && _preCreatedTabs.has(tab.id)) {
		_preCreatedTabs.delete(tab.id);
		tabsInfo.setIntentionalDuplicate(tab.id);
	}
	tabsInfo.setTab(tab.id, {});
	if (!tabsInfo.hasNbDuplicateTabs(tab.windowId)) {
		tabsInfo.setNbDuplicateTabs(tab.windowId, 0);
		updateBadgeStyle();
	}
	if (tab.status === "complete") {
		tabsInfo.setTab(tab.id, { url: tab.url, complete: true });
		// Only skip about:blank (no content, no URL meaning at creation).
		// about:newtab, about:home, chrome://newtab/ are semantic URLs and must
		// go through dispatchTabCompletion so duplicates are detected.
		// The skipBlankTabs option handles user-facing exclusion downstream in worker.js.
		if (tab.url !== "about:blank") {
			dispatchTabCompletion(tab, null, { queryComplete: true });
		}
	}
};

const onBeforeNavigate = async (details) => {
	await ensureInitialized();
	if (monitoringPaused) return;
	if (details.frameId !== 0 || details.tabId === -1) return;
	if (environment.isChrome && !tabsInfo.hasTab(details.tabId)) {
		_preCreatedTabs.add(details.tabId);
	}
	// Firefox fires onBeforeNavigate twice for the same URL (~10-30ms apart). Skip the duplicate.
	const prev = _lastNavigate.get(details.tabId);
	if (prev && prev.url === details.url && (Date.now() - prev.ts) < 1000) return;
	_lastNavigate.set(details.tabId, { url: details.url, ts: Date.now() });
	if (options.autoCloseTab && !startupBurst.active && !isBlankURL(details.url) && !details.url.startsWith("view-source:")) {
		if (!tabsInfo.hasTab(details.tabId)) return;
		if (tabsInfo.isClosingTab(details.tabId)) return;
		if (details.transitionQualifiers &&
				(details.transitionQualifiers.includes("server_redirect") ||
				details.transitionQualifiers.includes("client_redirect"))) return;
		const tab = await getTab(details.tabId);
		if (tab) {
			tabsInfo.setTab(tab.id, { complete: false });
			searchForDuplicateTabsToClose(tab, true, details.url);
		}
	} else if (!options.autoCloseTab && isBlankURL(details.url) && tabsInfo.hasTab(details.tabId)
			&& tabsInfo.getStoredUrl(details.tabId) === "about:blank") {
		// Manual mode: Firefox creates newtabs as about:blank first, then navigates to about:newtab.
		// tabs.onUpdated is unreliable for this transition. Update the stored URL and refresh
		// so the panel detects the newtab as a duplicate without waiting for tabs.onUpdated.
		const tab = await getTab(details.tabId);
		if (tab) {
			tabsInfo.setTab(tab.id, { url: details.url, complete: true });
			refreshDuplicateTabsInfo(tab.windowId);
		}
	}
};

const onCompletedTab = async (details) => {
	await ensureInitialized();
	if (monitoringPaused) return;
	if ((details.frameId == 0) && (details.tabId !== -1)) {
		if (tabsInfo.isClosingTab(details.tabId)) return;
		const tab = await getTab(details.tabId);
		if (tab) {
			const prevUrl = tabsInfo.getStoredUrl(tab.id);
			const alreadyComplete = tabsInfo.getLastComplete(tab.id) !== null && !tabsInfo.hasUrlChanged(tab);
			const wasIntentionalDup = !alreadyComplete && prevUrl && tabsInfo.isIntentionalDuplicate(tab.id);
			if (wasIntentionalDup) tabsInfo.clearIntentionalDuplicate(tab.id);
			if (!alreadyComplete) tabsInfo.setTab(tab.id, { url: tab.url, complete: true });
			if (wasIntentionalDup) refreshDuplicateTabsInfo(tab.windowId);
			dispatchTabCompletion(tab, tab.id, { alreadyComplete });
		}
	}
};

const onUpdatedTab = async (tabId, changeInfo, tab) => {
	await ensureInitialized();
	if (monitoringPaused) return;
	if (tabsInfo.isClosingTab(tabId)) return;
	if (Object.prototype.hasOwnProperty.call(changeInfo, "status") && changeInfo.status === "complete") {
		if (Object.prototype.hasOwnProperty.call(changeInfo, "url") && (changeInfo.url !== tab.url)) {
			if (isBlankURL(tab.url) || !tab.favIconUrl || !tabsInfo.hasUrlChanged(tab)) return;
			tabsInfo.setTab(tab.id, { url: tab.url, complete: true });
			dispatchTabCompletion(tab, tab.id);
		}
		else if (isChromeURL(tab.url) || isBlankURL(tab.url)) {
			tabsInfo.setTab(tab.id, { url: tab.url, complete: true });
			dispatchTabCompletion(tab, tab.id);
		}
	}
};

const onAttached = async (tabId) => {
	await ensureInitialized();
	if (monitoringPaused) return;
	const tab = await getTab(tabId);
	if (tab) dispatchTabCompletion(tab, null);
};

const onRemovedTab = async (removedTabId, removeInfo) => {
	await ensureInitialized();
	tabsInfo.removeTab(removedTabId);
	_lastNavigate.delete(removedTabId);
	if (monitoringPaused) return;
	if (removeInfo.isWindowClosing) {
		if (options.searchInAllWindows && tabsInfo.needsRefresh(removeInfo.windowId)) refreshDuplicateTabsInfo();
		tabsInfo.clearDuplicateTabsInfo(removeInfo.windowId);
		refreshDuplicateTabsInfo.cleanup(removeInfo.windowId);
		handleRemainingTab.cleanup(removeInfo.windowId);
		debouncedBatchClose.cleanup(removeInfo.windowId);
		updateBadgeStyle();
	}
	else if (tabsInfo.needsRefresh(removeInfo.windowId)) {
		refreshDuplicateTabsInfo(removeInfo.windowId);
	}
};

const onDetachedTab = async (detachedTabId, detachInfo) => {
	await ensureInitialized();
	if (monitoringPaused) return;
	if (tabsInfo.needsRefresh(detachInfo.oldWindowId)) {
		refreshDuplicateTabsInfo(detachInfo.oldWindowId);
	} else {
		setBadge(detachInfo.oldWindowId);
	}
};

const onActivatedTab = async (activeInfo) => {
	await ensureInitialized();
	if (environment.isFirefox) return;
	setBadge(activeInfo.windowId, activeInfo.tabId);
};

// Chrome only — Firefox does not fire tabs.onReplaced (used when a tab is discarded/replaced by a new one).
const onReplacedTab = async (addedTabId, removedTabId) => {
	await ensureInitialized();
	if (monitoringPaused) return;
	const prevLastComplete = tabsInfo.getLastComplete(removedTabId);
	tabsInfo.removeTab(removedTabId);
	const tab = await getTab(addedTabId);
	if (tab) {
		tabsInfo.setTab(addedTabId, prevLastComplete !== null
			? { url: tab.url, complete: true, lastComplete: prevLastComplete }
			: { url: tab.url });
		await searchForDuplicateTabsToClose(tab);
	}
};

const onCommittedTab = async (details) => {
	if (!environment.isChrome) return;
	if (details.frameId !== 0 || details.tabId <= 0) return;
	await ensureInitialized();
	const tab = await getTab(details.tabId);
	if (tab && tab.id > 0) setBadge(tab.windowId, tab.id);
};

const onHistoryStateUpdated = async (details) => {
	await ensureInitialized();
	if (monitoringPaused) return;
	if (details.frameId !== 0 || details.tabId === -1) return;
	if (isBlankURL(details.url)) return;
	if (!tabsInfo.hasTab(details.tabId)) return;
	if (tabsInfo.isClosingTab(details.tabId)) return;
	const prev = _lastNavigate.get(details.tabId);
	if (prev && prev.url === details.url && (Date.now() - prev.ts) < 1000) return;
	_lastNavigate.set(details.tabId, { url: details.url, ts: Date.now() });
	const tab = await getTab(details.tabId);
	if (!tab) return;
	if (!tabsInfo.hasUrlChanged(tab)) return;
	const wasIntentionalDup = tabsInfo.isIntentionalDuplicate(tab.id);
	if (wasIntentionalDup) tabsInfo.clearIntentionalDuplicate(tab.id);
	tabsInfo.setTab(tab.id, { url: details.url, complete: true });
	dispatchTabCompletion(tab, tab.id);
	if (wasIntentionalDup) refreshDuplicateTabsInfo(tab.windowId);
};

const onReferenceFragmentUpdated = async (details) => {
	await ensureInitialized();
	if (monitoringPaused) return;
	if (details.frameId !== 0 || details.tabId === -1) return;
	if (isBlankURL(details.url)) return;
	if (!tabsInfo.hasTab(details.tabId)) return;
	if (tabsInfo.isClosingTab(details.tabId)) return;
	const prev = _lastNavigate.get(details.tabId);
	if (prev && prev.url === details.url && (Date.now() - prev.ts) < 1000) return;
	_lastNavigate.set(details.tabId, { url: details.url, ts: Date.now() });
	const tab = await getTab(details.tabId);
	if (!tab) return;
	if (!tabsInfo.hasUrlChanged(tab)) return;
	const wasIntentionalDup = tabsInfo.isIntentionalDuplicate(tab.id);
	if (wasIntentionalDup) tabsInfo.clearIntentionalDuplicate(tab.id);
	tabsInfo.setTab(tab.id, { url: details.url, complete: true });
	dispatchTabCompletion(tab, tab.id);
	if (wasIntentionalDup) refreshDuplicateTabsInfo(tab.windowId);
};

const onCommand = async (command) => {
	await ensureInitialized();
	if (command == "close-duplicate-tabs") {
		const windowId = options.searchInAllWindows ? undefined : await getActiveWindowId();
		closeDuplicateTabs(windowId, true);
	}
	else if (command == "toggle-close-mode") setStoredOption("onDuplicateTabDetected", options.autoCloseTab ? "N" : "A", false);
	else if (command == "toggle-monitor-pause") toggleMonitorPause();
};

// MV3: event listeners must be registered synchronously at top level (no await before this point),
// so the service worker can receive events immediately on restart.
chrome.runtime.onStartup.addListener(() => ensureInitialized());
// Sync in-memory options when storage is written externally (e.g. from the dtc-test
// companion extension, or when multiple option pages are open simultaneously)
chrome.storage.onChanged.addListener((changes, area) => {
	if (area !== "local") return;
	const wasSavingLocally = _savingLocally;
	_savingLocally = false;
	if (wasSavingLocally) return;
	if (monitoringPaused) return;
	let hasOptionChange = false;
	for (const key of Object.keys(changes)) {
		if (key in defaultOptions) { hasOptionChange = true; break; }
	}
	if (!hasOptionChange) return;
	getStoredOptions().then(current => {
		setOptions(current.storedOptions);
		refreshGlobalDuplicateTabsInfo();
	});
});
const onCommittedTab = async (details) => {
	if (!environment.isChrome) return;
	if (details.frameId !== 0 || details.tabId <= 0) return;
	await ensureInitialized();
	const tab = await getTab(details.tabId);
	if (tab && tab.id > 0) setBadge(tab.windowId, tab.id);
};

const onHistoryStateUpdated = async (details) => {
	await ensureInitialized();
	if (monitoringPaused) return;
	if (details.frameId !== 0 || details.tabId === -1) return;
	if (isBlankURL(details.url)) return;
	if (!tabsInfo.hasTab(details.tabId)) return;
	if (tabsInfo.isClosingTab(details.tabId)) return;
	const prev = _lastNavigate.get(details.tabId);
	if (prev && prev.url === details.url && (Date.now() - prev.ts) < 1000) return;
	_lastNavigate.set(details.tabId, { url: details.url, ts: Date.now() });
	const tab = await getTab(details.tabId);
	if (!tab) return;
	if (!tabsInfo.hasUrlChanged(tab)) return;
	tabsInfo.setTab(tab.id, { url: details.url, complete: true });
	dispatchTabCompletion(tab, tab.id);
};

const onReferenceFragmentUpdated = async (details) => {
	await ensureInitialized();
	if (monitoringPaused) return;
	if (details.frameId !== 0 || details.tabId === -1) return;
	if (isBlankURL(details.url)) return;
	if (!tabsInfo.hasTab(details.tabId)) return;
	if (tabsInfo.isClosingTab(details.tabId)) return;
	const prev = _lastNavigate.get(details.tabId);
	if (prev && prev.url === details.url && (Date.now() - prev.ts) < 1000) return;
	_lastNavigate.set(details.tabId, { url: details.url, ts: Date.now() });
	const tab = await getTab(details.tabId);
	if (!tab) return;
	if (!tabsInfo.hasUrlChanged(tab)) return;
	tabsInfo.setTab(tab.id, { url: details.url, complete: true });
	dispatchTabCompletion(tab, tab.id);
};

chrome.tabs.onCreated.addListener(onCreatedTab);
chrome.webNavigation.onBeforeNavigate.addListener(onBeforeNavigate);
chrome.webNavigation.onCommitted.addListener(onCommittedTab);
chrome.webNavigation.onHistoryStateUpdated.addListener(onHistoryStateUpdated);
chrome.webNavigation.onReferenceFragmentUpdated.addListener(onReferenceFragmentUpdated);
chrome.tabs.onAttached.addListener(onAttached);
chrome.tabs.onDetached.addListener(onDetachedTab);
chrome.tabs.onUpdated.addListener(onUpdatedTab);
chrome.webNavigation.onCompleted.addListener(onCompletedTab);
chrome.tabs.onRemoved.addListener(onRemovedTab);
chrome.tabs.onActivated.addListener(onActivatedTab);
chrome.tabs.onReplaced.addListener(onReplacedTab);
chrome.commands.onCommand.addListener(onCommand);

// Kick off initialization immediately when the service worker starts
ensureInitialized();
