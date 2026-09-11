"use strict";

let activeWindowId = chrome.windows.WINDOW_ID_NONE;
let lastDuplicateTabs = null;
let panelInitialized = false;
let closePopup = false;
let groupedView = false;
let lastNbRows = 0;
let _renderGen = 0;
let monitoringPaused = false;
let _highlightOnOpen = false;
let titleSimilarityThresholdPopupVisible = true;
let titleRegexRulesPopupVisible = false;

const toggleShrunkMode = (checked) => {
    getElements(".list-group-form").forEach(el => el.classList.toggle("shrunk", checked));
    if (!checked && document.getElementById("optionHeader").classList.contains("collapsed")) {
        toggleExpendOptions(true);
    }
};

const applyTwoColumnsMode = (enabled) => {
    document.body.classList.toggle("two-columns", enabled);
    const pauseBtn = document.getElementById("pauseMonitorBtn");
    if (enabled) {
        const dtcHeader = document.querySelector("#duplicateTabsCard .card-header");
        if (pauseBtn && dtcHeader) dtcHeader.appendChild(pauseBtn);
    } else {
        const optionHeaderFlex = document.querySelector("#optionHeader .d-flex");
        if (pauseBtn && optionHeaderFlex) optionHeaderFlex.insertBefore(pauseBtn, optionHeaderFlex.firstChild);
    }
    resizeDuplicateTabsPanel(false);
};

const applyShowOptions = (visible) => {
    document.body.classList.toggle("options-hidden", !visible);
    const btn = document.getElementById("toggleOptionsPanelBtn");
    if (btn) btn.classList.toggle("active", !visible);
    resizeDuplicateTabsPanel(false);
};

const toggleExpendOptions = (resize) => {
    document.getElementById("optionHeader").classList.toggle("collapsed");
    if (resize) resizeDuplicateTabsPanel();
};

const toggleExpendGroup = (eventId, isTitleClickEvent, pinned, resize) => {
    if (isTitleClickEvent) {
        const groupId = eventId.replace("Title", "Group");
        document.getElementById(groupId).classList.toggle("collapsed");
        resizeDuplicateTabsPanel();
    }
    else {
        const groupId = eventId.replace("Pinned", "Group");
        const pinnedEls = getElements(".pinned");
        if (pinnedEls.length) pinnedEls.at(-1).classList.remove("last-list-group");
        const group = document.getElementById(groupId);
        if (!group) return;
        group.classList.toggle("collapsed", !pinned);
        group.classList.toggle("pinned", pinned);
        if (resize) resizeDuplicateTabsPanel();
        const pinnedElsAfter = getElements(".pinned");
        if (pinnedElsAfter.length) pinnedElsAfter.at(-1).classList.add("last-list-group");
    }
};

const setDuplicateTabsTable = async (duplicateTabs) => {
    _renderGen += 1;
    const gen = _renderGen;
    const sameList = duplicateTabs !== null && lastDuplicateTabs !== null &&
        Array.isArray(duplicateTabs) && Array.isArray(lastDuplicateTabs) &&
        duplicateTabs.length === lastDuplicateTabs.length &&
        duplicateTabs.every((t, i) => t.id === lastDuplicateTabs[i].id &&
            t.isRetained === lastDuplicateTabs[i].isRetained &&
            t.whitelisted === lastDuplicateTabs[i].whitelisted);
    if (sameList) return;
    const isFirstRender = lastDuplicateTabs === null;
    const highlightTabId = isFirstRender ? _highlightOnOpen : false;
    if (isFirstRender) _highlightOnOpen = false;
    const newTabIds = new Set(highlightTabId !== null && highlightTabId !== false && duplicateTabs
            ? duplicateTabs.filter(t => t.id === highlightTabId).map(t => t.id)
            : !isFirstRender && duplicateTabs
                ? duplicateTabs.filter(t => !lastDuplicateTabs.some(p => p.id === t.id) && !t.isRetained).map(t => t.id)
                : []);
    const expandedGroups = new Set();
    if (groupedView) {
        document.querySelectorAll(".tr-group-header:not(.collapsed)").forEach(header => {
            expandedGroups.add(header.dataset.groupTabIds.split(",")[0]);
        });
    }
    const isUpdate = panelInitialized;
    panelInitialized = true;
    lastDuplicateTabs = duplicateTabs ? Array.from(duplicateTabs) : null;
    const tbody = document.getElementById("duplicateTabsTableBody");
    tbody.replaceChildren();
    const closeBtn = document.getElementById("closeDuplicateTabsBtn");
    const groupBtn = document.getElementById("groupDuplicateTabsBtn");
    const hideBtn = document.getElementById("hideWhitelistedTabsBtn");
    if (duplicateTabs) {
        const rows = groupedView
            ? buildGroupedDuplicateTabRows(duplicateTabs, activeWindowId)
            : buildDuplicateTabRows(duplicateTabs, activeWindowId);
        if (newTabIds.size > 0) {
            rows.forEach(r => {
                const id = parseInt(r.getAttribute("tabId"), 10);
                if (!isNaN(id) && newTabIds.has(id)) r.classList.add("tab-row-new");
            });
        }
        const CHUNK = 40;
        for (let i = 0; i < rows.length; i += CHUNK) {
            if (_renderGen !== gen) return;
            const frag = document.createDocumentFragment();
            rows.slice(i, i + CHUNK).forEach(r => frag.appendChild(r));
            tbody.appendChild(frag);
            if (i === 0) resizeDuplicateTabsPanel(isUpdate);
            if (i + CHUNK < rows.length) await new Promise(r => requestAnimationFrame(r));
        }
        if (_renderGen !== gen) return;
        if (groupedView && (expandedGroups.size > 0 || newTabIds.size > 0)) {
            tbody.querySelectorAll(".tr-group-header").forEach(header => {
                const groupIds = header.dataset.groupTabIds.split(",");
                const shouldExpand = expandedGroups.has(groupIds[0]) ||
                    (newTabIds.size > 0 && groupIds.map(Number).some(id => newTabIds.has(id)));
                if (!shouldExpand) return;
                header.classList.remove("collapsed");
                let row = header.nextElementSibling;
                while (row && row.classList.contains("group-row")) {
                    row.classList.remove("group-collapsed");
                    row = row.nextElementSibling;
                }
            });
            resizeDuplicateTabsPanel();
        }
        if (newTabIds.size > 0) {
            const firstNewRow = tbody.querySelector(".tab-row-new");
            if (firstNewRow) firstNewRow.scrollIntoView({ block: "nearest" });
        }
        setDuplicateTableButtonsEnabled(closeBtn, groupBtn, hideBtn, true);
    }
    else {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.className = "td-tab-text";
        td.colSpan = 3;
        const em = document.createElement("em");
        em.textContent = monitoringPaused
            ? chrome.i18n.getMessage("monitoringPaused")
            : `${chrome.i18n.getMessage("noDuplicateTabs")}.`;
        td.appendChild(em);
        tr.appendChild(td);
        tbody.appendChild(tr);
        resizeDuplicateTabsPanel(isUpdate);
        setDuplicateTableButtonsEnabled(closeBtn, groupBtn, hideBtn, false);
    }
    hideBtn.dataset.wlCount = String(duplicateTabs ? duplicateTabs.filter(t => t.whitelisted).length : 0);
};

const resizeDuplicateTabsPanel = (refresh) => {
    const tbody = document.getElementById("duplicateTabsTableBody");
    const nbRows = lastDuplicateTabs
        ? (groupedView
            ? (tbody && tbody.children.length > 0
                ? tbody.querySelectorAll("tr:not(.group-collapsed)").length
                : new Set(lastDuplicateTabs.map(t => t.groupIndex)).size)
            : lastDuplicateTabs.length)
        : 1;
    const container = document.getElementById("duplicateTabsTableContainer");
    if (document.body.classList.contains("two-columns")) {
        const dtcBody = document.getElementById("duplicateTabsCard").querySelector(".card-body");
        container.style.height = "";
        container.style.maxHeight = `${dtcBody.offsetHeight}px`;
        const moreRows = nbRows > lastNbRows;
        requestAnimationFrame(() => {
            const overflows = container.scrollHeight > container.clientHeight;
            container.classList.toggle("table-scrollable-overflow", overflows);
            if (!overflows) {
                clearTimeout(highlightBottomScrollShadowTimer);
                container.classList.remove("highlight-scroll-bottom");
            }
            if (refresh && overflows && moreRows) highlightBottomScrollShadow();
        });
    } else {
        const maxOptionsCardHeight = 432;
        const rowHeight = 26;
        const minRow = 2;
        const maxRows = Math.min(nbRows, Math.floor((maxOptionsCardHeight - document.getElementById("optionsCard").offsetHeight + (minRow * rowHeight)) / rowHeight));
        container.style.maxHeight = "";
        container.classList.toggle("table-scrollable-overflow", nbRows > maxRows);
        if (nbRows <= maxRows) {
            clearTimeout(highlightBottomScrollShadowTimer);
            container.classList.remove("highlight-scroll-bottom");
        }
        if (refresh && nbRows > maxRows && nbRows > lastNbRows) highlightBottomScrollShadow();
        if (maxRows > 0) container.style.height = `${maxRows * rowHeight}px`;
        else container.style.height = "";
    }
    lastNbRows = nbRows;
};

const setPanelOptions = async () => {
    const { storedOptions, lockedKeys } = await getStoredOptions();
    let collapseOptions = true;
    for (const storedOption in storedOptions) {
        const value = storedOptions[storedOption].value;
        const isLockedKey = lockedKeys.includes(storedOption);
        if (storedOption === "environment") {
            if (value === "chrome") getElements(".containerItem").forEach(el => el.classList.toggle("hidden", true));
        }
        else {
            const el = document.getElementById(storedOption);
            // checkbox
            if (typeof (value) === "boolean") {
                if (el) el.checked = value;
                if (storedOption.endsWith("Pinned") && storedOption !== "customizationPinned" && storedOption !== "themePinned" && storedOption !== "popupPinned" && storedOption !== "badgePinned") {
                    toggleExpendGroup(storedOption, false, value, false);
                    collapseOptions = collapseOptions && !value;
                }
                else if (storedOption === "shrunkMode") toggleShrunkMode(value);
                else if (storedOption === "closePopup") closePopup = value;
                else if (storedOption === "popupGroupedView") {
                    groupedView = value;
                    updateGroupButton(value);
                }
                else if (storedOption === "hideWhitelistedTabs") {
                    updateHideWhitelistedButton(value);
                }
                else if (storedOption === "popupShowOptions") applyShowOptions(value);
            }
            // number input
            else if (typeof (value) === "number") {
                if (el) el.value = value;
            }
            // textarea (pattern rules and whitelist — whiteList not shown in popup, el will be null)
            else if (storedOption === "urlRegexRules" || storedOption === "titleRegexRules" || storedOption === "whiteList") {
                if (el) el.value = value;
            }
            // combobox
            else {
                const opt = getElement(`#${storedOption} option[value='${value}']`);
                if (opt) opt.selected = true;
                if (storedOption === "onDuplicateTabDetected") changeAutoCloseOptionState(value, false);
                else if (storedOption === "theme") applyTheme(value);
                else if (storedOption === "popupTwoColumns") applyTwoColumnsMode(value === "2");
                else if (storedOption === "titleMatchMode") updateTitleMatchModeDependents(value);
            }
            if (isLockedKey && el) el.disabled = true;
        }
    }
    if (collapseOptions) toggleExpendOptions(false);
    applyPopupRuleVisibility(storedOptions);
    updateIgnorePathPartDependents(storedOptions.ignorePathPart ? storedOptions.ignorePathPart.value : false);
    updateTitleMatchModeDependents(storedOptions.titleMatchMode ? storedOptions.titleMatchMode.value : "N");
    const sessionData = await chrome.storage.session.get(["autoOpenedPopup", "autoOpenedTabId"]);
    if (sessionData.autoOpenedPopup) {
        await chrome.storage.session.remove(["autoOpenedPopup", "autoOpenedTabId"]);
        _highlightOnOpen = sessionData.autoOpenedTabId ?? null;
        document.getElementById("optionHeader").classList.add("collapsed");
        resizeDuplicateTabsPanel();
    }
    if (document.body.classList.contains("two-columns")) document.getElementById("optionHeader").classList.remove("collapsed");
};

const applyPausedState = (paused) => {
    monitoringPaused = paused;
    const sel = document.getElementById("onDuplicateTabDetected");
    if (sel) sel.disabled = paused;
    updatePauseButton(paused);
};

const updateTitleMatchModeDependents = (value) => {
    const showTitleDependents = value === "T";
    const thresh = document.getElementById("titleSimilarityThreshold");
    if (thresh) thresh.disabled = !showTitleDependents;
    const threshRow = thresh?.closest(".checkboxes");
    if (threshRow) threshRow.classList.toggle("hidden", !showTitleDependents || !titleSimilarityThresholdPopupVisible);
    const titleRulesEl = document.getElementById("titleRegexRules");
    const titleRulesRow = titleRulesEl?.closest(".checkboxes");
    if (titleRulesRow) titleRulesRow.classList.toggle("hidden", !showTitleDependents || !titleRegexRulesPopupVisible);
};

const applyPopupRuleVisibility = (storedOptions) => {
    const rules = [
"caseInsensitive", "ignore3w", "ignoreHashPart", "ignoreSearchPart",
        "ignorePathPart", "urlRegexRules", "titleMatchMode"
];
    rules.forEach(rule => {
        const visible = storedOptions[`${rule}_popup`] ? storedOptions[`${rule}_popup`].value : true;
        const el = document.getElementById(rule);
        if (el) el.closest(".checkboxes").classList.toggle("hidden", !visible);
    });
    titleSimilarityThresholdPopupVisible = storedOptions.titleSimilarityThreshold_popup ? storedOptions.titleSimilarityThreshold_popup.value : true;
    titleRegexRulesPopupVisible = storedOptions.titleRegexRules_popup ? storedOptions.titleRegexRules_popup.value : false;
    const titleMatchValue = storedOptions.titleMatchMode ? storedOptions.titleMatchMode.value : "N";
    updateTitleMatchModeDependents(titleMatchValue);
};

const handleMessage = (message) => {
    if (message.action === "updateDuplicateTabsTable") setDuplicateTabsTable(message.data.duplicateTabs);
    if (message.action === "setStoredOption" && message.data.name.endsWith("_popup")) {
        const rule = message.data.name.replace("_popup", "");
        const visible = message.data.value;
        if (rule === "titleSimilarityThreshold" || rule === "titleRegexRules") {
            if (rule === "titleSimilarityThreshold") titleSimilarityThresholdPopupVisible = visible;
            else titleRegexRulesPopupVisible = visible;
            const titleMatchModeEl = document.getElementById("titleMatchMode");
            updateTitleMatchModeDependents(titleMatchModeEl ? titleMatchModeEl.value : "N");
        } else {
            const el = document.getElementById(rule);
            if (el) el.closest(".checkboxes").classList.toggle("hidden", !visible);
        }
        resizeDuplicateTabsPanel();
    }
    if (message.action === "setStoredOption" && message.data.name === "titleMatchMode") {
        updateTitleMatchModeDependents(message.data.value);
        resizeDuplicateTabsPanel();
    }
    if (message.action === "setStoredOption" && message.data.name === "onDuplicateTabDetected") {
        const opt = getElement(`#onDuplicateTabDetected option[value='${message.data.value}']`);
        if (opt) opt.selected = true;
        changeAutoCloseOptionState(message.data.value, true);
    }
};

chrome.runtime.onMessage.addListener(handleMessage);

 
const loadListenerEvents = () => {

    /* Save checkbox settings */
    getElements("input[type='checkbox']").forEach(el => el.addEventListener("change", function () {
        if (this.id.endsWith("Pinned")) toggleExpendGroup(this.id, false, this.checked, true);
        else if (this.id === "shrunkMode") toggleShrunkMode(this.checked);
        else if (this.id === "ignorePathPart") {
            updateIgnorePathPartDependents(this.checked);
        }
        const refresh = this.className.includes("checkbox-filter") ||
            this.id === "keepTabWithHttps" ||
            this.id === "keepPinnedTab";
        saveOption(this.id, this.checked, refresh);
    }));

    /* Save combobox settings */
    getElements(".list-group select").forEach(el => el.addEventListener("change", function (event) {
        event.stopPropagation();
        const refresh = this.id === "scope" || this.id === "keepTabBasedOnAge" || this.id === "titleMatchMode";
        saveOption(this.id, this.value, refresh);
        if (this.id === "onDuplicateTabDetected") changeAutoCloseOptionState(this.value, true);
        else if (this.id === "popupTwoColumns") applyTwoColumnsMode(this.value === "2");
        else if (this.id === "titleMatchMode") updateTitleMatchModeDependents(this.value);
    }));

    /* Save title similarity threshold */
    const threshEl = document.getElementById("titleSimilarityThreshold");
    if (threshEl) threshEl.addEventListener("change", function () {
        const val = Math.min(100, Math.max(1, parseInt(this.value, 10) || 100));
        this.value = val;
        saveOption("titleSimilarityThreshold", val, true);
    });

    /* Save URL/title pattern rules */
    ["urlRegexRules", "titleRegexRules"].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener("change", function () {
            const cleaned = this.value.split("\n").map(l => l.trim()).filter(l => l.length > 0).join("\n");
            this.value = cleaned;
            saveOption(this.id, cleaned, true);
        });
        const applyLineHighlight = (textarea) => {
            const { top, bottom } = getHighlightBounds(textarea);
            const s = textarea.scrollTop;
            textarea.style.backgroundImage = `linear-gradient(transparent ${top - s}px, rgba(0, 0, 0, 0.075) ${top - s}px, rgba(0, 0, 0, 0.075) ${bottom - s}px, transparent ${bottom - s}px)`;
        };
        ["keyup", "click", "select", "focus", "scroll"].forEach(ev => el.addEventListener(ev, function () {
            applyLineHighlight(this);
        }));
        el.addEventListener("blur", function () {
            this.style.backgroundImage = "";
        });
    });

    /* Pause/resume monitoring */
    const pauseBtn = document.getElementById("pauseMonitorBtn");
    if (pauseBtn) pauseBtn.addEventListener("click", () => {
        sendMessage("toggleMonitorPause").then(resp => {
            if (resp) applyPausedState(resp.paused);
        });
    });

    chrome.storage.session.onChanged.addListener((changes) => {
        if ("monitoringPaused" in changes) applyPausedState(changes.monitoringPaused.newValue || false);
    });

    /* Open Option tab */
    const gearBtn = getElement(".fa-gear");
    if (gearBtn) gearBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        chrome.runtime.openOptionsPage();
        window.close();
    });

    /* Active selected tab (delegated) */
    const table = document.getElementById("duplicateTabsTable");
    if (table) {
        table.addEventListener("click", (e) => {
            const groupCloseBtn = e.target.closest(".btn-group-close");
            if (groupCloseBtn) {
                e.stopPropagation();
                const headerRow = groupCloseBtn.closest(".tr-group-header");
                if (!headerRow) return;
                headerRow.dataset.groupTabIds.split(",").map(Number).forEach(id => removeTab(id));
                return;
            }
            const headerRow = e.target.closest(".tr-group-header");
            if (headerRow) {
                const isCollapsed = headerRow.classList.toggle("collapsed");
                let row = headerRow.nextElementSibling;
                while (row && row.classList.contains("group-row")) {
                    row.classList.toggle("group-collapsed", isCollapsed);
                    row = row.nextElementSibling;
                }
                resizeDuplicateTabsPanel(false);
                return;
            }
            const titleCell = e.target.closest(".td-tab-title");
            if (titleCell) {
                const row = titleCell.parentElement;
                const tabId = parseInt(row.getAttribute("tabId"), 10);
                const windowId = parseInt(row.getAttribute("windowId"), 10);
                focusTab(tabId, windowId).catch(err => console.error("DTC: focusTab failed:", err));
            }
            const closeCell = e.target.closest(".td-close-button");
            if (closeCell) {
                const row = closeCell.parentElement;
                const tabId = parseInt(row.getAttribute("tabId"), 10);
                removeTab(tabId);
            }
        });
    }

    /* Close all */
    const closeBtn = document.getElementById("closeDuplicateTabsBtn");
    if (closeBtn) closeBtn.addEventListener("click", function () {
        if (!this.classList.contains("disabled")) {
            const skipWhitelisted = true;
            requestCloseDuplicateTabs(skipWhitelisted);
        }
        if (closePopup) window.close();
    });

    /* Toggle grouped view */
    const groupBtn = document.getElementById("groupDuplicateTabsBtn");
    if (groupBtn) groupBtn.addEventListener("click", function () {
        if (this.classList.contains("disabled")) return;
        groupedView = !groupedView;
        updateGroupButton(groupedView);
        saveOption("popupGroupedView", groupedView, false);
        if (lastDuplicateTabs) {
            _renderGen += 1;
            const rows = groupedView
                ? buildGroupedDuplicateTabRows(lastDuplicateTabs, activeWindowId)
                : buildDuplicateTabRows(lastDuplicateTabs, activeWindowId);
            document.getElementById("duplicateTabsTableBody").replaceChildren(...rows);
            resizeDuplicateTabsPanel(false);
        }
    });

    /* Toggle hide whitelisted */
    const hideWhitelistedBtn = document.getElementById("hideWhitelistedTabsBtn");
    if (hideWhitelistedBtn) hideWhitelistedBtn.addEventListener("click", function () {
        if (this.classList.contains("disabled")) return;
        const newValue = !this.classList.contains("active");
        updateHideWhitelistedButton(newValue);
        saveOption("hideWhitelistedTabs", newValue, true);
    });

    /* Toggle options panel visibility */
    const toggleOptionsPanelBtn = document.getElementById("toggleOptionsPanelBtn");
    if (toggleOptionsPanelBtn) toggleOptionsPanelBtn.addEventListener("click", function () {
        const newVisible = this.classList.contains("active");
        applyShowOptions(newVisible);
        saveOption("popupShowOptions", newVisible, false);
    });

    /* Toggle options panel */
    const optionsTitle = document.getElementById("optionsTitle");
    if (optionsTitle) optionsTitle.addEventListener("click", () => {
        toggleExpendOptions(true);
    });

    /* Toggle subitem panels */
    getElements(".list-group-item-title").forEach(el => el.addEventListener("click", function () {
        toggleExpendGroup(this.id, true);
    }));

};

const initialize = async () => {
    const [, windowId, sessionData] = await Promise.all([setPanelOptions(), getActiveWindowId(), chrome.storage.session.get("monitoringPaused")]);
    activeWindowId = windowId;
    monitoringPaused = sessionData.monitoringPaused || false;
    requestGetDuplicateTabs();
    localizePopup();
    loadListenerEvents();
    applyPausedState(monitoringPaused);
};


document.addEventListener("DOMContentLoaded", initialize);