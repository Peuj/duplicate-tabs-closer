# DTC Architecture

## 1. Overview

Duplicate Tabs Closer (DTC) is a Chrome/Firefox extension that detects and optionally closes duplicate browser tabs. It supports two modes: **auto-close** (closes duplicates immediately on detection) and **manual** (shows duplicates in a popup panel for the user to review).

The core logic runs inside a **service worker** (Chrome MV3) or a **persistent background script** (Firefox MV2). This means all duplicate detection is event-driven: tab lifecycle events arrive asynchronously and out of order, and the worker can be unloaded and restarted at any time (Chrome). Every special-case guard in this codebase exists because of these constraints.

---

## 2. File Map

| File | Responsibility | Consumes |
|---|---|---|
| `background.js` | Service worker entry; registers all event listeners; owns `monitoringPaused`, `_lastNavigate`, `_seededTabIds` | All others |
| `worker.js` | Duplicate detection algorithm; tab-close logic; owns `postStartupBurst*` vars | `tabsInfo`, `options`, `helper`, `badge`, `tst`, `urlUtils` |
| `tabsInfo.js` | In-memory tab state (`TabsInfo` class) | `helper` (for `getTabs`) |
| `options.js` | Settings load/save; `options` runtime object; owns `_savingLocally` | `helper` |
| `badge.js` | Badge text/color updates; popup auto-open | `tabsInfo`, `options`, `helper` |
| `tst.js` | Firefox Tree Style Tab integration; expand-before-close | `helper` |
| `urlUtils.js` | URL normalization; blank/chrome URL detection | . |
| `helper.js` | Browser API wrappers; `debounce`; `sendMessage` retry | . |
| `messageListener.js` | `chrome.runtime.onMessage` handler; routes panel requests | `worker`, `options` |
| `panelHelper.js` | Shared UI helpers for popup and options page (not loaded in worker) | . |
| `dtcLog.js` | Structured debug logging; URL obfuscation | . |
| `testHooks.js` | Test bridge for dtc-test companion extension | `worker`, `tabsInfo` |

---

## 3. State Inventory

All mutable state that affects duplicate detection behavior. If you change a guard or add a handler, check this table first.

| Variable | Owner | Type | Lifetime | Invariant |
|---|---|---|---|---|
| `monitoringPaused` | background.js | `boolean` | session storage (survives SW restart) | Every event handler exits early when `true` |
| `_lastNavigate` | background.js | `Map<tabId, {url, ts}>` | in-memory | Firefox dedup: one entry per open tab, cleaned on `onRemoved` |
| `_seededTabIds` | background.js | `Set<tabId>` | in-memory | Tabs that existed at startup; cleared after burst; see §8 |
| `postStartupBurst` | worker.js | `boolean` | in-memory | Routes detection to batch vs individual; see §8 |
| `postStartupBurstTimer` | worker.js | timer handle | in-memory | Must stay in sync with `postStartupBurst` |
| `postStartupBurstStart` | worker.js | `number` (ms) | in-memory | Enforces 30s max burst ceiling |
| `_savingLocally` | options.js | `boolean` | in-memory | Prevents `storage.onChanged` re-sync when we wrote; see §8 |
| `tabsInfo.storedTabs` | tabsInfo.js | `Map<tabId, {url, lastComplete, closing}>` | in-memory | Source of truth for tab URL, completion time, close state |
| `tabsInfo.nbDuplicateTabs` | tabsInfo.js | `Map<windowId, number>` | in-memory | `undefined` = never initialized (forces badge init); `0` = no dups |
| `tabsInfo.intentionalDuplicates` | tabsInfo.js | `Set<tabId>` | session storage | Ctrl+Shift+D tabs; persisted across SW restarts |
| `tabsInfo.knownSessionIds` | tabsInfo.js | `Set<string>` | in-memory | All Firefox session IDs ever seen; grows monotonically |
| `tabsInfo.tabSessionIdMap` | tabsInfo.js | `Map<tabId, sessionId>` | in-memory | Live tab → its dtc session ID (Firefox only) |
| `tabsInfo.pendingChecks` | tabsInfo.js | `Map<tabId, Promise>` | in-memory | Async session check; detection must await before matching |
| `_tstAvailable` | tst.js | `boolean` | in-memory | Whether Tree Style Tab is installed and responding |

---

## 4. Startup Sequence

Exact order of `initialize()` in `background.js`. Getting this order wrong breaks the intentional-duplicate detection.

```
1. initializeOptions()        : load storage, run version migrations
2. tabsInfo.initialize()      : seed storedTabs from chrome.tabs.query (all normal windows)
3. registerWithTST()          : Firefox only: TST handshake
4. chrome.storage.session     : read monitoringPaused
5. setBadgeIcon()             : set auto/manual icon
6. setPausedBadge()           : if paused, show ⏸ badge
7. initializeTabSessionIds()  : Firefox only: seed knownSessionIds + _seededTabIds
8. refreshGlobalDuplicateTabsInfo() : first full duplicate scan + badge update
9. postStartupBurst = true    : 3s rolling window begins (max 30s)
   postStartupBurstStart = now
   postStartupBurstTimer = setTimeout(...)

-- browser starts firing onCreated for all pre-existing tabs --

10. [onCreated fires per existing tab] → dispatchTabCompletion → debouncedBatchClose (burst)
11. [burst timer fires] → postStartupBurst = false, _seededTabIds.clear()
    → individual detection mode active
```

**Why step 7 must come before step 9:** `initializeTabSessionIds` adds pre-existing tab IDs to `_seededTabIds`. If `onCreated` fired before this was populated (i.e., burst started first), those tabs would not be guarded and would be falsely detected as intentional duplicates.

---

## 5. Per-Tab Event Lifecycle

| Event | Handler | Browser | Key guards | State read | State mutated | Side effect |
|---|---|---|---|---|---|---|
| `tabs.onCreated` | `onCreatedTab` | Both | `monitoringPaused`; `about:blank` skip | `tab.status`, `_seededTabIds` | `storedTabs`, `pendingChecks`, `intentionalDuplicates` (async) | `dispatchTabCompletion` if already complete |
| `webNav.onBeforeNavigate` | `onBeforeNavigate` | Both | `monitoringPaused`; `postStartupBurst`; `_lastNavigate` dedup; `isBlankURL`; `isClosingTab` | `storedTabs`, `_lastNavigate` | `storedTabs` (mark incomplete), `_lastNavigate` | `searchForDuplicateTabsToClose` (auto) or `refreshDuplicateTabsInfo` (manual blank→newtab) |
| `webNav.onCommitted` | `onCommittedTab` | Chrome | `frameId=0`, `tabId>0` | . | . | `setBadge` immediately on nav commit |
| `webNav.onCompleted` | `onCompletedTab` | Both | `monitoringPaused`; `frameId=0`; `isClosingTab` | `storedTabs` (lastComplete, url) | `storedTabs` (url, complete) | `dispatchTabCompletion` with `alreadyComplete` flag |
| `tabs.onUpdated` | `onUpdatedTab` | Both | `monitoringPaused`; `isClosingTab`; `status=complete` only; blank+noFavIcon skip | `storedTabs` | `storedTabs` (url, complete) | `dispatchTabCompletion` |
| `tabs.onAttached` | `onAttached` | Both | `monitoringPaused` | . | . | `dispatchTabCompletion` (re-scan new window) |
| `tabs.onDetached` | `onDetachedTab` | Both | `monitoringPaused` | `nbDuplicateTabs` | . | `refreshDuplicateTabsInfo` or `setBadge` for old window |
| `tabs.onRemoved` | `onRemovedTab` | Both | (cleanup always runs) | `nbDuplicateTabs` | `storedTabs`, `_lastNavigate`, `nbDuplicateTabs` | `refreshDuplicateTabsInfo`; debounce cleanup if window closing |
| `tabs.onActivated` | `onActivatedTab` | Chrome only | `monitoringPaused`; `isFirefox` skip | . | . | `setBadge` for newly active tab |
| `tabs.onReplaced` | `onReplacedTab` | Chrome only | `monitoringPaused` | `storedTabs` (lastComplete) | `storedTabs` (preserve lastComplete) | `dispatchTabCompletion` on replacement tab |
| `storage.onChanged` | (inline listener) | Both | `area=local`; `_savingLocally`; `monitoringPaused`; option key check | . | `options` object | `refreshGlobalDuplicateTabsInfo` |
| `runtime.onMessage` | `handleMessage` | Both | per-action | . | varies | routes to worker functions |

**`dispatchTabCompletion` routing** (the core dispatch function in worker.js):

```
dispatchTabCompletion(tab, activeTabId, { alreadyComplete, queryComplete })
  ├─ if postStartupBurst && within 30s max:
  │    extend burst timer (+3s)
  ├─ if autoCloseTab && !alreadyComplete:
  │    postStartupBurst → debouncedBatchClose(windowId)
  │    else          → searchForDuplicateTabsToClose(tab, queryComplete)
  ├─ if !autoCloseTab:
  │    refreshDuplicateTabsInfo(windowId)   [panel update only]
  └─ Chrome: setBadge(windowId, activeTabId)
```

---

## 6. Duplicate Detection Algorithm

### Two paths

- **Auto-close** (`searchForDuplicateTabsToClose`): called per tab event; finds the single best duplicate pair and closes one; stops after first close per call.
- **Manual / panel** (`searchForDuplicateTabs`): called for panel display or bulk close; finds all groups across the window (or all windows).

### URL normalization pipeline (applied before any comparison)

Options applied in order:
1. `ignorePathPart`: reduce to origin only (overrides hash/search)
2. `ignoreSearchPart`: strip `?...`
3. `ignoreHashPart`: strip `#...`
4. `keepTabWithHttps`: normalize `http://` to `https://`
5. `ignore3w`: strip `www.`
6. `caseInsensitive`: `toLowerCase()`
7. Trailing `/`: stripped

### Match priority (first match wins per tab pair)

1. Normalized URL match
2. Title similarity match (if `compareWithTitle` enabled; configurable Levenshtein threshold)
3. URL regex pattern match (`urlRegexRules`)
4. Title regex pattern match (`titleRegexRules`)

### Tab retention priority (which tab to keep)

1. Pinned tab (if `keepPinnedTab`)
2. HTTPS tab (if `keepTabWithHttps`)
3. Age: older (`keepTabBasedOnAge=O`) / newer (`N`) / reload older (`R`) based on `lastComplete` timestamp
4. Active window tab (if `prioritizeActiveWindow` and `searchInAllWindows`)

### `shouldSkipTab`: reasons a tab is excluded from matching

| Reason | Condition |
|---|---|
| `closing` | Tab is marked as closing in `tabsInfo` |
| `intentional-duplicate` | Firefox: tab was created by Ctrl+Shift+D |
| `skip-blank-option` | Blank URL and `skipBlankTabs=true` |
| `blank-loading` | Blank URL, not complete, and `skipBlankTabs=false` |
| `whitelisted` | URL matches a whitelist pattern (when `skipWhitelisted=true`) |
| `loading` | `queryComplete=true` and tab not yet complete |

### `queryComplete` flag

Set when calling `searchForDuplicateTabsToClose` from `onBeforeNavigate`. Requires matched tabs to already be complete, preventing a still-loading tab from being matched against the incoming navigation.

---

## 7. Browser Compatibility Layer

| Behavior | Chrome | Firefox |
|---|---|---|
| `onBeforeNavigate` fires twice per nav | No | Yes → `_lastNavigate` dedup (1s window) |
| New tab blank→newtab transition via `onBeforeNavigate` | Not needed | Yes → manual-mode refresh when stored URL is `about:blank` |
| Intentional-duplicate detection (Ctrl+Shift+D) | No | Yes → `browser.sessions` API → `_seededTabIds` + `pendingChecks` + `knownSessionIds` |
| `webNav.onCommitted` event | Yes → immediate badge repaint | No |
| `tabs.onReplaced` (discarded tab stub) | Yes → preserve `lastComplete` across replacement | No |
| `tabs.onActivated` badge update | Yes → tab-level badge per active tab | No |
| Badge scope | Per-tab (`setTabBadgeText`) | Per-window (`setWindowBadgeText`) |
| Tree Style Tab integration | No | Yes → expand collapsed children before close |
| Container (`cookieStoreId`) scoping | No | Yes → query includes `cookieStoreId` when `searchPerContainer` enabled |
| Service worker lifecycle | Unloaded after idle; in-memory state lost | Persistent background script |

---

## 8. Known Guards and Why They Exist

Each entry: **what it is**, **what problem it solves**, **what breaks if removed**.

### `postStartupBurst` + `debouncedBatchClose`

When the browser starts with many open tabs, `onCreated` fires for each one in rapid succession. Without batching, each event would trigger a full `searchForDuplicateTabsToClose` scan, O(n²) work. The burst window (3s, rolling, 30s max) routes all startup events to a single debounced `closeDuplicateTabs` call instead.

**Remove it:** Startup with 50+ tabs would trigger 50 individual scans. On slow machines this causes visible lag and risks race conditions between concurrent scans.

### `_lastNavigate` dedup

Firefox fires `webNavigation.onBeforeNavigate` twice per navigation ~10-30ms apart for the same URL. Without dedup, `searchForDuplicateTabsToClose` runs twice per navigation.

**Remove it:** Duplicate scans on every navigation in Firefox. Low risk of correctness errors (idempotent), but wasted work and confusing logs.

### `_seededTabIds`

`initializeTabSessionIds` runs during startup and seeds `knownSessionIds` with session IDs from all currently open tabs. Later, `onCreated` fires for those same tabs (Firefox fires it for pre-existing tabs too). In `onCreatedTab`, if a tab's session ID is in `knownSessionIds`, it would normally be marked as an intentional duplicate. But for startup tabs this is wrong: they are pre-existing, not user-duplicated.

`_seededTabIds` holds the IDs of those startup tabs. The guard `!_seededTabIds.has(tab.id)` in `onCreatedTab` prevents them from being marked intentional-duplicate. After the tab's `onCreated` fires, its ID is deleted from the set.

**Remove it:** Every tab open at startup is treated as a Ctrl+Shift+D duplicate and never auto-closed, even if it genuinely is a duplicate.

### `_savingLocally`

When the extension saves an option (from the popup or options page), it writes to `chrome.storage.local`. This fires `storage.onChanged` in the background listener. Without a guard, the listener would re-read storage and call `refreshGlobalDuplicateTabsInfo`, redundant work since the in-memory `options` object was already updated.

**Remove it:** Every option save triggers a redundant global re-scan. Also risks a feedback loop if the re-scan itself triggers further storage writes.

### `intentionalDuplicates` + `pendingChecks`

Firefox's `browser.sessions.getTabValue` is async. When `onCreatedTab` fires, the session ID check is started but not awaited: it is stored as a pending promise. `searchForDuplicateTabsToClose` awaits it before matching. This ensures intentional-duplicate detection completes before the tab is matched against others.

**Remove `pendingChecks`:** A race where the session check hasn't completed yet; the tab could be auto-closed before DTC knows it was an intentional duplicate.

**Remove `intentionalDuplicates`:** Ctrl+Shift+D always auto-closes the newly duplicated tab, defeating the user's intent.

### `isClosingTab()` guard

When a tab is being closed, multiple events can still fire for it (e.g., `onBeforeNavigate`, `onUpdated`). The `closing` flag in `storedTabs` prevents those events from triggering another close attempt.

**Remove it:** Race condition where a tab close is attempted twice; the second attempt fails silently, but the remaining-tab logic (reactivation, reload) can run twice.

### `alreadyComplete` flag

When `onCompleted` fires for a tab whose URL hasn't changed (e.g., a reload), a fresh duplicate scan is not needed in auto-close mode: the tab was already scanned when it first completed. The `alreadyComplete=true` flag skips `searchForDuplicateTabsToClose` but still updates the panel in manual mode.

**Remove it:** Every page reload triggers a duplicate scan, causing unnecessary close attempts.

### `onBeforeNavigate` manual-mode blank guard

Firefox creates new tabs as `about:blank` before navigating to `about:newtab`. In manual mode, `tabs.onUpdated` is unreliable for this transition (it may not fire or may fire after a long delay). Without this guard, the tab's stored URL stays `about:blank` and the panel never shows it as a duplicate of other new-tab pages.

The guard detects the `about:blank` → blank semantic URL transition via `onBeforeNavigate` and updates the stored URL immediately, then refreshes the panel.

**Remove it:** In manual mode on Firefox, new tabs opened as `about:newtab` are not detected as duplicates until `onUpdated` fires (which may be unreliable or delayed).
