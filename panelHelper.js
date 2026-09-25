"use strict";

const getElement = (sel, ctx = document) => ctx.querySelector(sel);
const getElements = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

const areSameArrays = (array1, array2) => {
    if (!array1 && !array2) return true;
    if (!array1 || !array2 || array1.length !== array2.length) return false;
    return array1.every((t, i) => t.id === array2[i].id &&
        t.isRetained === array2[i].isRetained &&
        t.whitelisted === array2[i].whitelisted);
};

const buildTabRow = (duplicateTab, activeWindowId) => {
    const tr = document.createElement("tr");
    tr.setAttribute("tabId", parseInt(duplicateTab.id, 10));
    tr.setAttribute("windowId", parseInt(duplicateTab.windowId, 10));
    if (!duplicateTab.isRetained) tr.classList.add("tab-row-duplicate");
    if (duplicateTab.whitelisted) tr.setAttribute("data-whitelisted", "true");

    const tdIcon = document.createElement("td");
    tdIcon.className = "td-tab-icon";
    const img = document.createElement("img");
    img.src = duplicateTab.icon || "../images/default-favicon.png";
    img.alt = "";
    tdIcon.appendChild(img);

    const tdTitle = document.createElement("td");
    tdTitle.className = "td-tab-title";
    tdTitle.title = duplicateTab.url;
    if (duplicateTab.containerColor) {
        tdTitle.style.textDecorationColor = duplicateTab.containerColor;
    }
    if (duplicateTab.whitelisted) {
        const badge = document.createElement("span");
        badge.className = "whitelist-row-badge fa-solid fa-shield-halved";
        badge.title = chrome.i18n.getMessage("whitelistedTab");
        tdTitle.appendChild(badge);
        tdTitle.appendChild(document.createTextNode(" "));
    }
    if (duplicateTab.windowId === activeWindowId) {
        tdTitle.appendChild(document.createTextNode(duplicateTab.title));
    } else {
        const em = document.createElement("em");
        em.textContent = duplicateTab.title;
        tdTitle.appendChild(em);
    }

    const tdClose = document.createElement("td");
    tdClose.className = "td-close-button";
    if (!duplicateTab.isRetained) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn-tab-close";
        btn.setAttribute("aria-label", chrome.i18n.getMessage("closeTabButton"));
        btn.textContent = "×";
        tdClose.appendChild(btn);
    }

    tr.appendChild(tdIcon);
    tr.appendChild(tdTitle);
    tr.appendChild(tdClose);
    return tr;
};

const buildDuplicateTabRows = (duplicateTabs, activeWindowId) => duplicateTabs.map(tab => buildTabRow(tab, activeWindowId));

const buildGroupedDuplicateTabRows = (duplicateTabs, activeWindowId) => {
    const rows = [];
    const groups = new Map();
    duplicateTabs.forEach(tab => {
        if (!groups.has(tab.groupIndex)) groups.set(tab.groupIndex, []);
        groups.get(tab.groupIndex).push(tab);
    });
    groups.forEach((tabs) => {
        const headerTr = document.createElement("tr");
        headerTr.className = "tr-group-header collapsed";
        headerTr.dataset.groupTabIds = tabs.filter(t => !t.isRetained).map(t => t.id).join(",");
        if (tabs.every(tab => tab.whitelisted)) headerTr.setAttribute("data-whitelisted", "true");

        const tdHeader = document.createElement("td");
        tdHeader.className = "td-group-header-cell";
        tdHeader.colSpan = 2;

        const chevron = document.createElement("span");
        chevron.className = "fa-solid fa-chevron-right fa-xs";
        chevron.setAttribute("aria-hidden", "true");

        const img = document.createElement("img");
        img.src = tabs[0].icon || "../images/default-favicon.png";
        img.alt = "";
        img.className = "group-favicon";

        const titleSpan = document.createElement("span");
        titleSpan.className = "group-header-title";
        titleSpan.title = tabs[0].url;
        titleSpan.textContent = tabs[0].title;

        const badge = document.createElement("span");
        badge.className = "group-count-badge";
        badge.textContent = chrome.i18n.getMessage("tabsCount", [String(tabs.length)]);

        const closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.className = "btn-tab-close btn-group-close";
        closeBtn.setAttribute("aria-label", chrome.i18n.getMessage("closeGroup"));
        closeBtn.textContent = "×";

        const innerDiv = document.createElement("div");
        innerDiv.className = "group-header-inner";
        innerDiv.append(chevron, img, titleSpan, badge);
        tdHeader.appendChild(innerDiv);

        const tdClose = document.createElement("td");
        tdClose.className = "td-close-button";
        tdClose.appendChild(closeBtn);

        headerTr.append(tdHeader, tdClose);
        rows.push(headerTr);

        tabs.forEach(tab => {
            const row = buildTabRow(tab, activeWindowId);
            row.classList.add("group-row", "group-collapsed");
            rows.push(row);
        });
    });
    return rows;
};

const applyTheme = (value) => {
    const darkThemes = ["ocean", "charcoal", "purple", "teal", "oled"];
    const lightThemes = ["sage", "rose", "amber", "slate", "violet"];
    const isDark = darkThemes.includes(value);
    document.documentElement.setAttribute("data-bs-theme", isDark ? "dark" : "light");
    document.documentElement.classList.remove(...[...darkThemes, ...lightThemes].map(t => `theme-${t}`));
    if (value !== "light") document.documentElement.classList.add(`theme-${value}`);
};

const updateIgnorePathPartDependents = (checked) => {
    document.getElementById("ignoreSearchPart").disabled = checked;
    document.getElementById("ignoreHashPart").disabled = checked;
};

const updatePrioritizeActiveWindowState = (scopeValue) => {
    const el = document.getElementById("prioritizeActiveWindow");
    if (el) el.disabled = scopeValue !== "A" && scopeValue !== "CA";
};

const updateGroupButton = (grouped) => {
    const btn = document.getElementById("groupDuplicateTabsBtn");
    if (!btn) return;
    btn.classList.toggle("active", grouped);
    btn.setAttribute("aria-pressed", String(grouped));
};

const updateHideWhitelistedButton = (hidden) => {
    const btn = document.getElementById("hideWhitelistedTabsBtn");
    if (!btn) return;
    btn.classList.toggle("active", hidden);
    btn.setAttribute("aria-pressed", String(hidden));
    document.getElementById("duplicateTabsTable")?.classList.toggle("hide-whitelisted", hidden);
};

let highlightBottomScrollShadowTimer = null;
const highlightBottomScrollShadow = () => {
    clearTimeout(highlightBottomScrollShadowTimer);
    const container = document.getElementById("duplicateTabsTableContainer");
    if (!container.classList.contains("table-scrollable-overflow")) return;
    container.classList.toggle("highlight-scroll-bottom", true);
    highlightBottomScrollShadowTimer = setTimeout(() => container.classList.toggle("highlight-scroll-bottom", false), 400);
};

const getHighlightBounds = (textarea) => {
    const cs = window.getComputedStyle(textarea);
    const pt = parseFloat(cs.paddingTop);
    const text = textarea.value;
    const pos = textarea.selectionStart;
    const lineStart = text.lastIndexOf("\n", pos - 1) + 1;
    const lineEndRaw = text.indexOf("\n", pos);
    const lineEnd = lineEndRaw === -1 ? text.length : lineEndRaw;
    let m = textarea._mirror;
    if (!m) {
        m = document.createElement("div");
        m.setAttribute("aria-hidden", "true");
        m.style.cssText = "position:fixed;top:-9999px;visibility:hidden;white-space:pre-wrap;overflow-wrap:break-word;padding:0;margin:0;border:0;box-sizing:content-box;";
        document.body.appendChild(m);
        textarea._mirror = m;
    }
    m.style.width = `${textarea.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)}px`;
    m.style.font = cs.font;
    m.style.lineHeight = cs.lineHeight;
    let topOffset = 0;
    if (lineStart > 0) {
        m.textContent = text.substring(0, lineStart);
        topOffset = m.scrollHeight;
    }
    m.textContent = text.substring(lineStart, lineEnd) || " ";
    return { top: pt + topOffset, bottom: pt + topOffset + m.scrollHeight };
};

const requestCloseDuplicateTabs = (skipWhitelisted) => sendMessage("closeDuplicateTabs", { "windowId": activeWindowId, skipWhitelisted });

const saveOption = (name, value, refresh) => sendMessage("setStoredOption", { name, value, refresh });

const requestGetDuplicateTabs = () => sendMessage("getDuplicateTabs", { "windowId": activeWindowId });

const changeAutoCloseOptionState = (state, resize) => {
    const el = document.getElementById("onRemainingTabGroup");
    if (el) el.classList.toggle("hidden", state !== "A");
    if (resize) resizeDuplicateTabsPanel();
};

const setDuplicateTableButtonsEnabled = (closeBtn, groupBtn, hideBtn, enabled) => {
    [closeBtn, groupBtn, hideBtn].forEach(btn => {
        btn.classList.toggle("disabled", !enabled);
        btn.setAttribute("aria-disabled", String(!enabled));
        if (enabled) btn.removeAttribute("disabled");
        else btn.setAttribute("disabled", "");
    });
};

const updatePauseButton = (paused) => {
    const btn = document.getElementById("pauseMonitorBtn");
    if (!btn) return;
    const icon = btn.querySelector("span");
    btn.classList.toggle("paused", paused);
    btn.setAttribute("aria-pressed", paused ? "true" : "false");
    if (paused) {
        if (icon) icon.className = "fa-solid fa-play fa-lg";
        btn.setAttribute("aria-label", chrome.i18n.getMessage("resumeMonitoring"));
        btn.setAttribute("title", chrome.i18n.getMessage("resumeMonitoring"));
    } else {
        if (icon) icon.className = "fa-solid fa-pause fa-lg";
        btn.setAttribute("aria-label", chrome.i18n.getMessage("pauseMonitoring"));
        btn.setAttribute("title", chrome.i18n.getMessage("pauseMonitoring"));
    }
};

const registerDuplicateTableClickHandler = (table, resizeFn) => {
    table.addEventListener("click", (e) => {
        const groupCloseBtn = e.target.closest(".btn-group-close");
        if (groupCloseBtn) {
            e.stopPropagation();
            const headerRow = groupCloseBtn.closest(".tr-group-header");
            if (!headerRow) return;
            headerRow.dataset.groupTabIds.split(",").filter(Boolean).map(Number).forEach(id => removeTab(id));
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
            resizeFn(false);
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
};

const localizePopup = (node = document.documentElement) => {
    node.querySelectorAll("[i18n-content]").forEach(el => {
        el.textContent = chrome.i18n.getMessage(el.getAttribute("i18n-content"));
    });
    node.querySelectorAll("[Title]").forEach(el => {
        el.setAttribute("Title", chrome.i18n.getMessage(el.getAttribute("Title")));
    });
    node.querySelectorAll("[i18n-aria-label]").forEach(el => {
        el.setAttribute("aria-label", chrome.i18n.getMessage(el.getAttribute("i18n-aria-label")));
    });
};