"use strict";

let activeWindowId = chrome.windows.WINDOW_ID_NONE;
let lastDuplicateTabs = null;
let panelInitialized = false;
let closePopup = false;
let environment = "";
let groupedView = false;
let lastNbRows = 0;
let _renderGen = 0;
let monitoringPaused = false;
let _highlightOnOpen = false;

/* Show/Hide the AutoClose option */
const changeAutoCloseOptionState = (state, resize) => {
    document.getElementById("onRemainingTabGroup").classList.toggle("hidden", state !== "A");
    if (resize) resizeDuplicateTabsPanel();
};

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
        group.classList.toggle("collapsed", !pinned);
        group.classList.toggle("pinned", pinned);
        if (resize) resizeDuplicateTabsPanel();
        const pinnedElsAfter = getElements(".pinned");
        if (pinnedElsAfter.length) pinnedElsAfter.at(-1).classList.add("last-list-group");
    }
};

const setDuplicateTabsTable = async (duplicateTabs) => {
    const gen = ++_renderGen;
    const sameList = duplicateTabs !== null && lastDuplicateTabs !== null
        && Array.isArray(duplicateTabs) && Array.isArray(lastDuplicateTabs)
        && duplicateTabs.length === lastDuplicateTabs.length
        && duplicateTabs.every((t, i) => t.id === lastDuplicateTabs[i].id
            && t.isRetained === lastDuplicateTabs[i].isRetained
            && t.whitelisted === lastDuplicateTabs[i].whitelisted);
    if (sameList) return;
    const isFirstRender = lastDuplicateTabs == null;
    const highlightTabId = isFirstRender ? _highlightOnOpen : false;
    if (isFirstRender) _highlightOnOpen = false;
    const newTabIds = new Set(
        highlightTabId != null && highlightTabId !== false && duplicateTabs
            ? duplicateTabs.filter(t => t.id === highlightTabId).map(t => t.id)
            : !isFirstRender && duplicateTabs
                ? duplicateTabs.filter(t => !lastDuplicateTabs.some(p => p.id === t.id) && !t.isRetained).map(t => t.id)
                : []
    );
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
        if (groupedView && expandedGroups.size > 0) {
            tbody.querySelectorAll(".tr-group-header").forEach(header => {
                if (expandedGroups.has(header.dataset.groupTabIds.split(",")[0])) {
                    header.classList.remove("collapsed");
                    let row = header.nextElementSibling;
                    while (row && row.classList.contains("group-row")) {
                        row.classList.remove("group-collapsed");
                        row = row.nextElementSibling;
                    }
                }
            });
        }
        if (newTabIds.size > 0 && groupedView) {
            tbody.querySelectorAll(".tr-group-header").forEach(header => {
                const ids = header.dataset.groupTabIds.split(",").map(Number);
                if (ids.some(id => newTabIds.has(id))) {
                    header.classList.remove("collapsed");
                    let row = header.nextElementSibling;
                    while (row && row.classList.contains("group-row")) {
                        row.classList.remove("group-collapsed");
                        row = row.nextElementSibling;
                    }
                }
            });
        }
        if ((groupedView && expandedGroups.size > 0) || (newTabIds.size > 0 && groupedView)) {
            resizeDuplicateTabsPanel();
        }
        if (newTabIds.size > 0) {
            const firstNewRow = tbody.querySelector(".tab-row-new");
            if (firstNewRow) firstNewRow.scrollIntoView({ block: "nearest" });
        }
        closeBtn.classList.remove("disabled");
        closeBtn.setAttribute("aria-disabled", "false");
        closeBtn.removeAttribute("disabled");
        groupBtn.classList.remove("disabled");
        groupBtn.setAttribute("aria-disabled", "false");
        groupBtn.removeAttribute("disabled");
        hideBtn.classList.remove("disabled");
        hideBtn.setAttribute("aria-disabled", "false");
        hideBtn.removeAttribute("disabled");
    }
    else {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.className = "td-tab-text";
        td.colSpan = 3;
        const em = document.createElement("em");
        em.textContent = monitoringPaused
            ? chrome.i18n.getMessage("monitoringPaused")
            : chrome.i18n.getMessage("noDuplicateTabs") + ".";
        td.appendChild(em);
        tr.appendChild(td);
        tbody.appendChild(tr);
        resizeDuplicateTabsPanel(isUpdate);
        closeBtn.classList.add("disabled");
        closeBtn.setAttribute("aria-disabled", "true");
        closeBtn.setAttribute("disabled", "");
        groupBtn.classList.add("disabled");
        groupBtn.setAttribute("aria-disabled", "true");
        groupBtn.setAttribute("disabled", "");
        hideBtn.classList.add("disabled");
        hideBtn.setAttribute("aria-disabled", "true");
        hideBtn.setAttribute("disabled", "");
    }
};

const resizeDuplicateTabsPanel = (refresh) => {
    const maxOptionsCardHeight = 432;
    const rowHeight = 26;
    const minRow = 2;
    const tbody = document.getElementById("duplicateTabsTableBody");
    const nbRows = lastDuplicateTabs
        ? (groupedView
            ? (tbody && tbody.children.length > 0
                ? tbody.querySelectorAll("tr:not(.group-collapsed)").length
                : new Set(lastDuplicateTabs.map(t => t.groupIndex)).size)
            : lastDuplicateTabs.length)
        : 1;
    const maxRows = Math.min(nbRows, Math.floor((maxOptionsCardHeight - document.getElementById("optionsCard").offsetHeight + (minRow * rowHeight)) / rowHeight));
    const container = document.getElementById("duplicateTabsTableContainer");
    container.classList.toggle("table-scrollable-overflow", nbRows > maxRows);
    if (nbRows <= maxRows) {
        clearTimeout(highlightBottomScrollShadowTimer);
        container.classList.remove("highlight-scroll-bottom");
    }
    if (refresh && nbRows > maxRows && nbRows > lastNbRows) highlightBottomScrollShadow();
    lastNbRows = nbRows;
    if (maxRows > 0) container.style.height = `${maxRows * rowHeight}px`;
    else container.style.height = "";
};

const setPanelOptions = async () => {
    const { storedOptions, lockedKeys } = await getStoredOptions();
    let collapseOptions = true;
    for (const storedOption in storedOptions) {
        const value = storedOptions[storedOption].value;
        const isLockedKey = lockedKeys.includes(storedOption);
        if (storedOption === "environment") {
            environment = value;
            if (value === "chrome") getElements(".containerItem").forEach(el => el.classList.toggle("hidden", true));
        }
        else {
            const el = document.getElementById(storedOption);
            // checkbox
            if (typeof (value) === "boolean") {
                if (el) el.checked = value;
                if (storedOption.endsWith("Pinned") && storedOption !== "customizationPinned" && storedOption !== "themePinned" && storedOption !== "popupPinned" && storedOption !== "badgePinned") {
                    toggleExpendGroup(storedOption, false, value, false);
                    // eslint-disable-next-line max-depth
                    if (value) collapseOptions = false;
                }
                else if (storedOption === "shrunkMode") toggleShrunkMode(value);
                else if (storedOption === "closePopup") closePopup = value;
                else if (storedOption === "popupGroupedView") {
                    groupedView = value;
                    updateGroupButton(value);
                }
                else if (storedOption === "compareWithTitle") {
                    const thresh = document.getElementById("titleSimilarityThreshold");
                    if (thresh) thresh.disabled = !value;
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
            }
            if (isLockedKey && el) el.disabled = true;
        }
    }
    if (collapseOptions) toggleExpendOptions(false);
    applyPopupRuleVisibility(storedOptions);
    updateIgnorePathPartDependents(storedOptions.ignorePathPart ? storedOptions.ignorePathPart.value : false);
    const sessionData = await chrome.storage.session.get(['autoOpenedPopup', 'autoOpenedTabId']);
    if (sessionData.autoOpenedPopup) {
        chrome.storage.session.remove(['autoOpenedPopup', 'autoOpenedTabId']);
        _highlightOnOpen = sessionData.autoOpenedTabId ?? null;
        document.getElementById("optionHeader").classList.add("collapsed");
        resizeDuplicateTabsPanel();
    }
    if (document.body.classList.contains("two-columns"))
        document.getElementById("optionHeader").classList.remove("collapsed");
};

const applyPausedState = (paused) => {
    monitoringPaused = paused;
    const sel = document.getElementById("onDuplicateTabDetected");
    if (sel) sel.disabled = paused;
    updatePauseButton(paused);
};

const updatePauseButton = (paused) => {
    const btn = document.getElementById("pauseMonitorBtn");
    if (!btn) return;
    const icon = btn.querySelector("span");
    btn.classList.toggle("paused", paused);
    if (paused) {
        icon.className = "fa-solid fa-play fa-lg";
        btn.setAttribute("aria-label", chrome.i18n.getMessage("resumeMonitoring"));
        btn.setAttribute("title", chrome.i18n.getMessage("resumeMonitoring"));
    } else {
        icon.className = "fa-solid fa-pause fa-lg";
        btn.setAttribute("aria-label", chrome.i18n.getMessage("pauseMonitoring"));
        btn.setAttribute("title", chrome.i18n.getMessage("pauseMonitoring"));
    }
};

const applyPopupRuleVisibility = (storedOptions) => {
    const rules = ["caseInsensitive", "ignore3w", "ignoreHashPart", "ignoreSearchPart",
        "ignorePathPart", "compareWithTitle", "urlRegexRules", "titleRegexRules"];
    rules.forEach(rule => {
        const visible = storedOptions[rule + "_popup"] ? storedOptions[rule + "_popup"].value : true;
        const el = document.getElementById(rule);
        if (el) el.closest(".checkboxes").classList.toggle("hidden", !visible);
    });
    const compareTitleVisible = (storedOptions["compareWithTitle_popup"]
        ? storedOptions["compareWithTitle_popup"].value : true)
        && (storedOptions["compareWithTitle"]
        ? storedOptions["compareWithTitle"].value : true);
    const thresh = document.getElementById("titleSimilarityThreshold");
    if (thresh) thresh.closest(".checkboxes").classList.toggle("hidden", !compareTitleVisible);
};

const handleMessage = (message) => {
    if (message.action === "updateDuplicateTabsTable") setDuplicateTabsTable(message.data.duplicateTabs);
    if (message.action === "setStoredOption" && message.data.name.endsWith("_popup")) {
        const rule = message.data.name.replace("_popup", "");
        const visible = message.data.value;
        const el = document.getElementById(rule);
        if (el) el.closest(".checkboxes").classList.toggle("hidden", !visible);
        if (rule === "compareWithTitle") {
            const compareWithTitleEl = document.getElementById("compareWithTitle");
            const thresholdVisible = visible && compareWithTitleEl && compareWithTitleEl.checked;
            const thresh = document.getElementById("titleSimilarityThreshold");
            if (thresh) thresh.closest(".checkboxes").classList.toggle("hidden", !thresholdVisible);
        }
        resizeDuplicateTabsPanel();
    }
    if (message.action === "setStoredOption" && message.data.name === "onDuplicateTabDetected") {
        const opt = getElement(`#onDuplicateTabDetected option[value='${message.data.value}']`);
        if (opt) opt.selected = true;
        changeAutoCloseOptionState(message.data.value, true);
    }
};

chrome.runtime.onMessage.addListener(handleMessage);

// eslint-disable-next-line max-lines-per-function
const loadListenerEvents = () => {

    /* Save checkbox settings */
    getElements("input[type='checkbox']").forEach(el => el.addEventListener("change", function () {
        if (this.id.endsWith("Pinned")) toggleExpendGroup(this.id, false, this.checked, true);
        else if (this.id === "shrunkMode") toggleShrunkMode(this.checked);
        else if (this.id === "compareWithTitle") {
            const thresh = document.getElementById("titleSimilarityThreshold");
            thresh.disabled = !this.checked;
            thresh.closest(".checkboxes").classList.toggle("hidden", !this.checked);
        }
        else if (this.id === "ignorePathPart") {
            updateIgnorePathPartDependents(this.checked);
        }
        const refresh = this.className.includes("checkbox-filter")
            || this.id === "keepTabWithHttps"
            || this.id === "keepPinnedTab";
        saveOption(this.id, this.checked, refresh);
    }));

    /* Save combobox settings */
    getElements(".list-group select").forEach(el => el.addEventListener("change", function (event) {
        event.stopPropagation();
        const refresh = this.id === "scope" || this.id === "keepTabBasedOnAge";
        saveOption(this.id, this.value, refresh);
        if (this.id === "onDuplicateTabDetected") changeAutoCloseOptionState(this.value, true);
        else if (this.id === "popupTwoColumns") applyTwoColumnsMode(this.value === "2");
    }));

    /* Save title similarity threshold */
    const threshEl = document.getElementById("titleSimilarityThreshold");
    if (threshEl) threshEl.addEventListener("change", function () {
        const val = Math.min(100, Math.max(1, parseInt(this.value) || 100));
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
        ["keyup", "click", "select", "focus", "scroll"].forEach(ev =>
            el.addEventListener(ev, function () { applyLineHighlight(this); })
        );
        el.addEventListener("blur", function () { this.style.backgroundImage = ""; });
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
        table.addEventListener("click", function (e) {
            const groupCloseBtn = e.target.closest(".btn-group-close");
            if (groupCloseBtn) {
                e.stopPropagation();
                const headerRow = groupCloseBtn.closest(".tr-group-header");
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
                focusTab(tabId, windowId);
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
            const skipWhitelisted = document.getElementById("hideWhitelistedTabsBtn")?.classList.contains("active") ?? false;
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
            ++_renderGen;
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
        saveOption("hideWhitelistedTabs", newValue, false);
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

const localizePopup = () => {
    const node = document.documentElement;
    const attribute = "i18n-content";
    const elements = node.querySelectorAll(`[${attribute}]`);
    elements.forEach(element => {
        const value = element.getAttribute(attribute);
        element.textContent = chrome.i18n.getMessage(value);
    });

    const tooltipAttribute = "Title";
    const tooltipElements = node.querySelectorAll(`[${tooltipAttribute}]`);
    tooltipElements.forEach(tooltipElement => {
        const value = tooltipElement.getAttribute(tooltipAttribute);
        tooltipElement.setAttribute(tooltipAttribute, chrome.i18n.getMessage(value));
    });

    const ariaLabelAttribute = "i18n-aria-label";
    node.querySelectorAll(`[${ariaLabelAttribute}]`).forEach(el => {
        el.setAttribute("aria-label", chrome.i18n.getMessage(el.getAttribute(ariaLabelAttribute)));
    });
};

const initialize = async () => {
    const [,, sessionData] = await Promise.all([setPanelOptions(), saveActiveWindowId(), chrome.storage.session.get('monitoringPaused')]);
    monitoringPaused = sessionData.monitoringPaused || false;
    requestGetDuplicateTabs();
    localizePopup();
    loadListenerEvents();
    applyPausedState(monitoringPaused);
};


document.addEventListener("DOMContentLoaded", initialize);
