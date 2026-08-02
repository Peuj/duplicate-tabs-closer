"use strict";

let activeWindowId = chrome.windows.WINDOW_ID_NONE;
let lastDuplicateTabs = null;
let panelInitialized = false;
let groupedView = false;
let lastNbRows = 0;
let monitoringPaused = false;

const initialize = async () => {
  const [,, sessionData] = await Promise.all([setPanelOptions(), saveActiveWindowId(), chrome.storage.session.get('monitoringPaused')]);
  monitoringPaused = sessionData.monitoringPaused || false;
  requestGetDuplicateTabs();
  localizePopup(document.documentElement);
  applyPausedState(monitoringPaused);
};

const applyPausedState = (paused) => {
  monitoringPaused = paused;
  const sel = document.getElementById("onDuplicateTabDetected");
  if (sel) sel.disabled = paused;
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

// eslint-disable-next-line max-lines-per-function
const loadPopupEvents = () => {

  /* Save checkbox settings */
  getElements(".list-group input[type='checkbox']").forEach(el => el.addEventListener("change", function () {
    if (this.id.endsWith("_popup")) {
      saveOption(this.id, this.checked, false);
      return;
    }
    if (this.id === "compareWithTitle") {
      const thresh = document.getElementById("titleSimilarityThreshold");
      if (thresh) thresh.disabled = !this.checked;
    }
    else if (this.id === "ignorePathPart") updateIgnorePathPartDependents(this.checked);
    const refresh = this.className.includes("checkbox-filter")
      || this.id === "keepTabWithHttps"
      || this.id === "keepPinnedTab"
      || this.id === "prioritizeActiveWindow"
      || this.id === "skipBlankTabs";
    saveOption(this.id, this.checked, refresh);
  }));

  /* Save combobox settings */
  getElements(".list-group select").forEach(el => el.addEventListener("change", function (event) {
    event.stopPropagation();
    const refresh = this.id === "scope" || this.id === "keepTabBasedOnAge";
    saveOption(this.id, this.value, refresh);
    if (this.id === "onDuplicateTabDetected") changeAutoCloseOptionState(this.value, true);
    else if (this.id === "theme") applyTheme(this.value);
    else if (this.id === "scope") updatePrioritizeActiveWindowState(this.value);
  }));

  /* Save badge color settings */
  getElements(".list-group input[type='color']").forEach(el => el.addEventListener("change", function () {
    saveOption(this.id, this.value);
  }));

  /* Save title similarity threshold */
  const threshEl = getElement(".list-group #titleSimilarityThreshold");
  if (threshEl) threshEl.addEventListener("change", function () {
    const val = Math.min(100, Math.max(1, parseInt(this.value) || 100));
    this.value = val;
    saveOption("titleSimilarityThreshold", val, true);
  });

  /* Save whiteList settings */
  const whiteListEl = document.getElementById("whiteList");
  if (whiteListEl) whiteListEl.addEventListener("change", function () {
    const whiteList = cleanUpWhiteList(this.value);
    setWhiteList(whiteList);
    saveOption(this.id, whiteList, true);
    updateFileAccessWarning();
  });

  /* Save URL/title pattern rules */
  const applyLineHighlight = (textarea) => {
    const { top, bottom } = getHighlightBounds(textarea);
    const s = textarea.scrollTop;
    textarea.style.backgroundImage = `linear-gradient(transparent ${top - s}px, rgba(0, 0, 0, 0.075) ${top - s}px, rgba(0, 0, 0, 0.075) ${bottom - s}px, transparent ${bottom - s}px)`;
  };

  ["urlRegexRules", "titleRegexRules"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("change", function () {
      const cleaned = cleanUpWhiteList(this.value);
      this.value = cleaned;
      saveOption(this.id, cleaned, true);
    });
    ["keyup", "click", "select", "focus", "scroll"].forEach(ev =>
      el.addEventListener(ev, function () { applyLineHighlight(this); })
    );
    el.addEventListener("blur", function () { this.style.backgroundImage = ""; });
  });

  if (whiteListEl) {
    ["keyup", "click", "select", "focus", "scroll"].forEach(ev =>
      whiteListEl.addEventListener(ev, function () { applyLineHighlight(this); })
    );
    whiteListEl.addEventListener("blur", function () { this.style.backgroundImage = ""; });
  }

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

  /* Close all */
  const closeBtn = document.getElementById("closeDuplicateTabsBtn");
  if (closeBtn) closeBtn.addEventListener("click", function () {
    if (!this.classList.contains("disabled")) {
      const skipWhitelisted = document.getElementById("hideWhitelistedTabsBtn")?.classList.contains("active") ?? false;
      requestCloseDuplicateTabs(skipWhitelisted);
    }
  });

  /* Toggle grouped view */
  const groupBtn = document.getElementById("groupDuplicateTabsBtn");
  if (groupBtn) groupBtn.addEventListener("click", function () {
    if (this.classList.contains("disabled")) return;
    groupedView = !groupedView;
    updateGroupButton(groupedView);
    saveOption("popupGroupedView", groupedView, false);
    if (lastDuplicateTabs) {
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

};

const setWhiteList = (whiteList) => {
  const el = document.getElementById("whiteList");
  if (el) el.value = whiteList;
};

const updateFileAccessWarning = async () => {
  const warningEl = document.getElementById("fileAccessWarning");
  if (!warningEl) return;
  const whiteListEl = document.getElementById("whiteList");
  const hasFilePattern = whiteListEl && whiteListEl.value.split("\n").some(line => line.trim().startsWith("file://"));
  if (!hasFilePattern) { warningEl.classList.add("hidden"); return; }
  const allowed = await chrome.extension.isAllowedFileSchemeAccess();
  warningEl.classList.toggle("hidden", allowed);
};

const cleanUpWhiteList = (whiteList) => {
  const whiteListCleaned = new Set();
  const whiteListLines = whiteList.split("\n");
  for (let whiteListLine of whiteListLines) {
    whiteListLine = whiteListLine.trim();
    if (whiteListLine.length !== 0) whiteListCleaned.add(whiteListLine);
  }
  return Array.from(whiteListCleaned).join("\n");
};

/* Show/Hide the AutoClose option */
const changeAutoCloseOptionState = (state, resize) => {
  document.getElementById("onRemainingTabGroup").classList.toggle("hidden", state !== "A");
  if (resize) resizeDuplicateTabsPanel();
};

const setDuplicateTabsTable = (duplicateTabs) => {
  if (duplicateTabs !== null && areSameArrays(duplicateTabs, lastDuplicateTabs)) return;
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
    const frag = document.createDocumentFragment();
    rows.forEach(r => frag.appendChild(r));
    tbody.appendChild(frag);
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
    closeBtn.classList.toggle("disabled", false);
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
    closeBtn.classList.toggle("disabled", true);
    closeBtn.setAttribute("aria-disabled", "true");
    closeBtn.setAttribute("disabled", "");
    groupBtn.classList.add("disabled");
    groupBtn.setAttribute("aria-disabled", "true");
    groupBtn.setAttribute("disabled", "");
    hideBtn.classList.add("disabled");
    hideBtn.setAttribute("aria-disabled", "true");
    hideBtn.setAttribute("disabled", "");
  }
  hideBtn.dataset.wlCount = String(duplicateTabs ? duplicateTabs.filter(t => t.whitelisted).length : 0);
  if (duplicateTabs) resizeDuplicateTabsPanel(isUpdate);
};

const resizeDuplicateTabsPanel = (refresh) => {
  const maxOptionsCardHeight = 720.5;
  const minRow = 3;
  const rowHeight = 26;
  const tbody = document.getElementById("duplicateTabsTableBody");
  const nbRows = lastDuplicateTabs
    ? (tbody ? tbody.querySelectorAll("tr:not(.group-collapsed)").length : lastDuplicateTabs.length)
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

const setPanelOption = (details) => {
  const storedOption = details.storedOption;
  const value = details.value;
  const resize = details.resize || false;
  const isLockedKey = details.isLockedKey || false;
  if (storedOption === "environment" && value === "chrome") {
    getElements(".containerItem").forEach(el => el.classList.toggle("hidden", true));
  }
  else if (storedOption === "whiteList") {
    const el = document.getElementById("whiteList");
    if (el) { el.value = value; if (isLockedKey) el.disabled = true; }
  }
  else if (storedOption === "urlRegexRules" || storedOption === "titleRegexRules") {
    const el = document.getElementById(storedOption);
    if (el) { el.value = value; if (isLockedKey) el.disabled = true; }
  }
  else {
    const el = document.getElementById(storedOption);
    if (typeof (value) === "boolean") {
      if (el) el.checked = value;
      if (storedOption === "compareWithTitle") {
        const thresh = document.getElementById("titleSimilarityThreshold");
        if (thresh) thresh.disabled = !value;
      }
      else if (storedOption === "ignorePathPart") updateIgnorePathPartDependents(value);
      else if (storedOption === "popupGroupedView") {
        groupedView = value;
        updateGroupButton(value);
      }
      else if (storedOption === "hideWhitelistedTabs") {
        updateHideWhitelistedButton(value);
      }
    }
    else if (typeof (value) === "number") {
      if (el) el.value = value;
    }
    else if (typeof value === "string" && value.startsWith("#")) {
      if (el) el.value = value;
    }
    else {
      const opt = getElement(`#${storedOption} option[value='${value}']`);
      if (opt) opt.selected = true;
      if (storedOption === "onDuplicateTabDetected") changeAutoCloseOptionState(value, resize);
      else if (storedOption === "theme") applyTheme(value);
      else if (storedOption === "scope") updatePrioritizeActiveWindowState(value);
    }
    if (isLockedKey && el) el.disabled = true;
  }
};

const setPanelOptions = async () => {
  const response = await sendMessage("getStoredOptions");
  const storedOptions = response.data.storedOptions;
  const lockedKeys = response.data.lockedKeys;
  for (const storedOption in storedOptions) {
    setPanelOption({ storedOption: storedOption, value: storedOptions[storedOption].value, isLockedKey: lockedKeys.includes(storedOption) });
  }
  updateIgnorePathPartDependents(storedOptions.ignorePathPart ? storedOptions.ignorePathPart.value : false);
  updateFileAccessWarning();
};

const handleMessage = (message) => {
  if (message.action === "updateDuplicateTabsTable") setDuplicateTabsTable(message.data.duplicateTabs);
  if (message.action === "setStoredOption") setPanelOption({ storedOption: message.data.name, value: message.data.value, resize: true });
};

chrome.runtime.onMessage.addListener(handleMessage);

const handleDOMContentLoaded = () => {
  initialize();
  loadPopupEvents();
};

document.addEventListener("DOMContentLoaded", handleDOMContentLoaded);

const localizePopup = (node) => {
  const attribute = "i18n-content";
  const elements = node.querySelectorAll(`[${attribute}]`);
  elements.forEach(element => {
    const value = element.getAttribute(attribute);
    element.textContent = chrome.i18n.getMessage(value);
  });

  node.querySelectorAll("[Title]").forEach(el => {
    el.setAttribute("Title", chrome.i18n.getMessage(el.getAttribute("Title")));
  });

  const ariaLabelAttribute = "i18n-aria-label";
  node.querySelectorAll(`[${ariaLabelAttribute}]`).forEach(el => {
    el.setAttribute("aria-label", chrome.i18n.getMessage(el.getAttribute(ariaLabelAttribute)));
  });
};