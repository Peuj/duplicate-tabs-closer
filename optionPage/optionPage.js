"use strict";

let activeWindowId = chrome.windows.WINDOW_ID_NONE;
let lastDuplicateTabs = {};

const initialize = async () => {
  await Promise.all([setPanelOptions(), saveActiveWindowId()]);
  requestGetDuplicateTabs();
  localizePopup(document.documentElement);
};

// eslint-disable-next-line max-lines-per-function
const loadPopupEvents = () => {

  /* Save checkbox settings */
  $(".list-group input[type='checkbox'").on("change", function () {
    if (this.id.endsWith("Pinned")) toggleExpendGroup(this.id, true, true);
    const refresh = this.className.includes("checkbox-filter");
    saveOption(this.id, this.checked, refresh);
  });

  /* Save combobox settings */
  $(".list-group select").on("change", function (event) {
    event.stopPropagation();
    const refresh = this.id === "scope";
    saveOption(this.id, this.value, refresh);
    if (this.id === "onDuplicateTabDetected") changeAutoCloseOptionState(this.value, true);
  });

  /* Save badge color settings */
  $(".list-group input[type='color']").on("change", function () {
    saveOption(this.id, this.value);
  });

  /* Save whiteList settings */
  $("#whiteList").on("change", function () {
    let whiteList = $(this).val();
    whiteList = cleanUpWhiteList(whiteList);
    setWhiteList(whiteList);
    saveOption(this.id, whiteList, false);
  });

  /* Active selected tab */
  $("#duplicateTabsTable").on("click", ".td-tab-title", function () {
    const tabId = parseInt($(this).parent().attr("tabId"), 10);
    const windowId = parseInt($(this).parent().attr("windowId"), 10);
    focusTab(tabId, windowId);
  });

  /* Close selected tab */
  $("#duplicateTabsTable").on("click", ".td-close-button", function () {
    const tabId = parseInt($(this).parent().attr("tabId"), 10);
    removeTab(tabId);
  });

  /* Close all */
  $("#closeDuplicateTabsBtn").on("click", function () {
    if (!$(this).hasClass("disabled")) requestCloseDuplicateTabs();
  });

  /* Toggle subitem panels */
  $(".list-group-item-title").on("click", function () {
    toggleExpendGroup(this.id, false);
  });

};

const setWhiteList = (whiteList) => {
  $("#whiteList").val(whiteList);
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
  $("#onRemainingTabGroup").toggleClass("hidden", state !== "A");
  $("#whiteListGroup").toggleClass("hidden", state !== "A");
  if (resize) resizeDuplicateTabsPanel();
};

const toggleExpendGroup = (groupId, checkbox, resize) => {
  if (checkbox) {
    const thumbChecked = $(`#${groupId}`).prop("checked");
    const listGroupId = groupId.replace("Pinned", "");
    $(`#${listGroupId}Body`).toggleClass("hidden", !thumbChecked);
    if ((thumbChecked && $(`#${listGroupId}`).hasClass("list-group-collapsed")) || (!thumbChecked && $(`#${listGroupId}`).hasClass("list-group-expanded"))) {
      $(`#${listGroupId}`).toggleClass("list-group-expanded list-group-collapsed");
    }
    if (resize) resizeDuplicateTabsPanel();
  }
  else {
    $(`#${groupId}Body`).toggleClass("hidden");
    $(`#${groupId}`).toggleClass("list-group-expanded list-group-collapsed");
    resizeDuplicateTabsPanel();
  }
  $(".list-group-item").toggleClass("list-group-item-overflow", $(".card-body").css("height") >= $(".card-body").css("max-height"));
};

const setDuplicateTabsTable = (duplicateTabs) => {
  if (areSameArrays(duplicateTabs, lastDuplicateTabs)) return;
  lastDuplicateTabs = duplicateTabs ? Array.from(duplicateTabs) : null;
  $("#duplicateTabsTableBody").empty();
  if (duplicateTabs) {
    let tableRows = "";
    duplicateTabs.forEach(duplicateTab => {
      const containerStyle = duplicateTab.containerColor ? `style='text-decoration:underline; text-decoration-color: ${duplicateTab.containerColor};'` : "";
      const title = (duplicateTab.windowId === activeWindowId) ? duplicateTab.title : `<em>${duplicateTab.title}</em>`;
      const tdTabIcon = `<td class='td-tab-icon'><img src='${duplicateTab.icon}' alt=''></td>`;
      const tdTabTitle = `<td class='td-tab-title' ${containerStyle}>${title}</td>`;
      const tdCloseButton = "<td class='td-close-button'><button type='button' class='close' data-dismiss='modal' aria-label='Close'><span aria-hidden='true'>&times;</span></button></td>";
      tableRows += `<tr tabId='${duplicateTab.id}' windowId='${duplicateTab.windowId}'>${tdTabIcon}${tdTabTitle}${tdCloseButton}</tr>`;
    });
    $("#duplicateTabsTableBody").append(tableRows);
    $("#closeDuplicateTabsBtn").toggleClass("disabled", false);
  }
  else {
    $("#duplicateTabsTableBody").append(`<td class='td-tab-text'><em>${chrome.i18n.getMessage("noDuplicateTabs")}.</em></td>`);
    $("#closeDuplicateTabsBtn").toggleClass("disabled", true);
  }
  resizeDuplicateTabsPanel(true);
};

const resizeDuplicateTabsPanel = (refresh) => {
  const maxOptionsCardHeight = 720.5;
  const minRow = 3;
  const rowHeight = 26;
  const nbRows = lastDuplicateTabs ? lastDuplicateTabs.length : 1;
  const maxRows = Math.min(nbRows, Math.floor((maxOptionsCardHeight - $("#optionsCard").height() + (minRow * rowHeight)) / rowHeight));
  $("#duplicateTabsTableContainer").toggleClass("table-scrollable-overflow", nbRows > maxRows);
  if (refresh && (nbRows > maxRows)) highlightBottomScrollShadow();
  $("#duplicateTabsTableContainer").css("height", maxRows * rowHeight);
};

const saveActiveWindowId = async () => {
  activeWindowId = await getActiveWindowId();
};

const requestCloseDuplicateTabs = () => sendMessage("closeDuplicateTabs", { "windowId": activeWindowId });

const saveOption = (name, value, refresh) => sendMessage("setStoredOption", { "name": name, "value": value, "refresh": refresh });

const requestGetDuplicateTabs = () => sendMessage("getDuplicateTabs", { "windowId": activeWindowId });

const setPanelOption = (details) => {
  const storedOption = details.storedOption;
  const value = details.value;
  const resize = details.resize || false;
  const isLockedKey = details.isLockedKey || false;
  if (storedOption === "environment" && value === "chrome") {
    $(".containerItem").toggleClass("hidden", true);
  }
  else if (storedOption === "whiteList") {
    $("#whiteList").val(value);
    if (isLockedKey) $("#whiteList").prop("disabled", true);
  }
  else {
    if (typeof (value) === "boolean") {
      $(`#${storedOption}`).prop("checked", value);
      if (storedOption.endsWith("Pinned")) toggleExpendGroup(storedOption, true);
    }
    else if (value.startsWith("#")) {
      // badge color value
      $(`#${storedOption}`).prop("value", value);
    }
    else {
      $(`#${storedOption} option[value='${value}']`).prop("selected", true);
      if (storedOption === "onDuplicateTabDetected") changeAutoCloseOptionState(value, resize);
    }
    if (isLockedKey) $(`#${storedOption}`).prop("disabled", true);
  }
};

const setPanelOptions = async () => {
  const response = await sendMessage("getStoredOptions");
  const storedOptions = response.data.storedOptions;
  const lockedKeys = response.data.lockedKeys;
  for (const storedOption in storedOptions) {
    setPanelOption({ storedOption: storedOption, value: storedOptions[storedOption].value, isLockedKey: lockedKeys.includes(storedOption) });
  }
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
};

let highlightBottomScrollShadowTimer = null;
const highlightBottomScrollShadow = () => {
  clearTimeout(highlightBottomScrollShadowTimer);
  $("#duplicateTabsTableContainer").toggleClass("table-scrollable-shadow", true);
  highlightBottomScrollShadowTimer = setTimeout(() => $("#duplicateTabsTableContainer").toggleClass("table-scrollable-shadow", false), 400);
};