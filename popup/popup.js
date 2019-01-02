"use strict";

const initialize = async () => {
  const requestGetDuplicateTabsPromise = requestGetDuplicateTabs();
  const setPanelOptionsPromise = setPanelOptions();
  localizePopup(document.documentElement);
  const isPinnedOptions = await setPanelOptionsPromise;
  await toggleOptionPanel(false, isPinnedOptions);
  resizeDuplicateTabsPanel();
  const duplicateTabs = await requestGetDuplicateTabsPromise;
  setDuplicateTabsTable(duplicateTabs);
};

const loadPopupEvents = () => {

  // Save checkbox settings
  $(".list-group input[type='checkbox'").on("change", function () {
    saveOption(this.id, this.checked);
    if (this.className === "checkbox-filter") refreshGlobalDuplicateTabsInfo(false);
  });

  // Save combobox settings
  $(".list-group select").on("change", function () {
    saveOption(this.id, this.value);
    if (this.id === "onDuplicateTabDetected") changeAutoCloseOptionState(this.value, true);
    else if (this.id === "scope") refreshGlobalDuplicateTabsInfo(true);
  });

  // Open Option tab tab
  $(".glyphicon-cog").on("click", function (event) {
    event.stopPropagation();
    chrome.runtime.openOptionsPage();
  });

  // Active selected tab
  $("#duplicateTabsTable").on("click", ".td-tab-link", function () {
    const tabId = parseInt($(this).parent().attr("tabId"));
    const windowId = parseInt($(this).parent().attr("windowId"));
    activateSelectedTab(tabId, windowId);
  });

  // Close selected tab
  $("#duplicateTabsTable").on("click", ".td-close-button", function () {
    const tabId = parseInt($(this).parent().attr("tabId"));
    requestCloseDuplicateTab(tabId);
  });

  // Close all duplicate tabs
  $("#closeDuplicateTabsBtn").on("click", function () {
    if (!$(this).hasClass("disabled")) requestCloseDuplicateTabs();
  });

  // Toggle Options panel
  $("#panelHeadingOptions").on("click", function () {
    toggleOptionPanel(true);
  });

  // Toggle subitem panels
  $(".subitem-title").on("click", function () {
    toggleOptionsGroup(this.id, true);
  });

};

// Show/Hide the AutoClose option
const changeAutoCloseOptionState = (state, resize) => {
  $("#onRemainingTabGroup").toggleClass("hidden", state !== "A");
  if (resize) resizeDuplicateTabsPanel();
};

const toggleOptionPanel = async (clicked, isPinnedOptions) => {

  if (clicked) {
    $("#panelHeadingOptions").toggleClass("group-collapsed group-expanded");

    if ($("#panelHeadingOptions").hasClass("group-expanded")) {
      const toggleOptionsGroupPromises = [
        toggleOptionsGroup("onDuplicateTabDetectedGroup"),
        toggleOptionsGroup("priorityTabGroup"),
        toggleOptionsGroup("scopeGroup"),
        toggleOptionsGroup("filtersGroup")
      ];
      await Promise.all(toggleOptionsGroupPromises);
    }

    $("#panelHeadingOptions").nextAll(".list-group-collapsible").first().slideToggle(0, "linear", () => {
      resizeDuplicateTabsPanel();
    });
  }
  else {
    if (isPinnedOptions) {
      const toggleOptionsGroupPromises = [
        toggleOptionsGroup("onDuplicateTabDetectedGroup"),
        toggleOptionsGroup("priorityTabGroup"),
        toggleOptionsGroup("scopeGroup"),
        toggleOptionsGroup("filtersGroup")
      ];
      await Promise.all(toggleOptionsGroupPromises);
    }
    else {
      $("#panelHeadingOptions").toggleClass("group-collapsed group-expanded");
      await $("#panelHeadingOptions").nextAll(".list-group-collapsible").first().slideToggle(0, "linear");
    }
  }

};

const isPinned = (pinId) => {
  return $("#" + pinId + "PinChecked").prop("checked");
};

const toggleOptionsGroup = (groupId, clicked) => {
  return new Promise((resolve) => {
    if (clicked || (isPinned(groupId) && $("#" + groupId).hasClass("group-collapsed")) || (!isPinned(groupId) && $("#" + groupId).hasClass("group-expanded"))) {
      $("#" + groupId).toggleClass("group-collapsed group-expanded");
      $("#" + groupId + "Pin").toggleClass("hidden", $("#" + groupId).hasClass("group-collapsed"));
      $("#" + groupId).nextAll(".list-group-collapsible").first().slideToggle(0, "linear", () => {
        if (clicked) resizeDuplicateTabsPanel();
        resolve();
      });
    }
    else {
      resolve();
    }
  });
};

const setDuplicateTabsTable = (duplicateTabs) => {
  if (duplicateTabs) {
    chrome.windows.getCurrent(null, focusedWindow => {
      $("#duplicateTabsTable").empty();
      $("#duplicateTabsTable").append("<tbody></tbody>");
      duplicateTabs.forEach(duplicateTab => {
        const containerStyle = duplicateTab.containerColor ? "style='text-decoration:underline; text-decoration-color: " + duplicateTab.containerColor + ";'" : "";
        const title = (duplicateTab.windowId === focusedWindow.id) ? duplicateTab.title : "<em>" + duplicateTab.title + "</em>";
        $("#duplicateTabsTable > tbody").append("<tr tabId='" + duplicateTab.id + "' group='" + duplicateTab.group + "' windowId='" + duplicateTab.windowId + "'><td class='td-tab-link' " + containerStyle + "> <img src='" + duplicateTab.icon + "'>" + title + "</td><td class='td-close-button'><button type='button' class='close'>&times;</button></td></tr>");
      });
      $("#closeDuplicateTabsBtn").toggleClass("disabled", false);
      resizeDuplicateTabsPanel();
    });
  }
  else {
    $("#duplicateTabsTable").empty();
    $("#duplicateTabsTable").append("<tr><td width='100%'align='center' valign='center'><font color='#9FACBD'><em>" + chrome.i18n.getMessage("noDuplicateTabs") + ".</em></font></td></tr>");
    $("#closeDuplicateTabsBtn").toggleClass("disabled", true);
    resizeDuplicateTabsPanel();
  }
};

const resizeDuplicateTabsPanel = () => {
  const optionGroupHeight = $(".list-group").height();
  const duplicateTabsPanelMaxHeight = 550 - optionGroupHeight;
  if ($(".table-scrollable").height() === 0) {
    $("#duplicateTabsPanelHeight").css("height", duplicateTabsPanelMaxHeight);
    $(".table-scrollable").css("height", duplicateTabsPanelMaxHeight - 100);
  }
  else {
    $("#duplicateTabsPanelHeight").css("height", "");
    $(".table-scrollable").css("height", "");
    $("#panelDuplicateTabs").css("max-height", duplicateTabsPanelMaxHeight);
    $(".table-scrollable").css("max-height", duplicateTabsPanelMaxHeight - 100);
    $(".table-scrollable").height() + $(".list-group").height() >= 450 ? $(".td-tab-link").css("max-width", "260px") : $(".td-tab-link").css("max-width", "280px");
  }
};

const sendMessage = (action, data) => {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: action, data: data }, response => {
      if (chrome.runtime.lastError) console.error("sendMessage error:", chrome.runtime.lastError.message);
      resolve(response);
    });
  });
};

const refreshGlobalDuplicateTabsInfo = () => sendMessage("refreshGlobalDuplicateTabsInfo", { "windowId": chrome.windows.WINDOW_ID_CURRENT });

const requestCloseDuplicateTabs = () => sendMessage("closeDuplicateTabs", { "windowId": chrome.windows.WINDOW_ID_CURRENT });

const requestCloseDuplicateTab = (tabId) => sendMessage("closeDuplicateTab", { "tabId": tabId });

const activateSelectedTab = (tabId, windowId) => sendMessage("activateTab", { "tabId": tabId, "windowId": windowId });

const saveOption = (name, value) => sendMessage("setStoredOption", { "name": name, "value": value });

const requestGetDuplicateTabs = async () => {
  const response = await sendMessage("getDuplicateTabs", { "windowId": chrome.windows.WINDOW_ID_CURRENT });
  return response.data;
};

const setPanelOptions = async () => {
  const response = await sendMessage("getOptions");
  const options = response.data;
  let isPinnedOptions = false;

  for (const option in options) {
    const value = options[option].value;
    if (option === "environment") {
      if (value === "chrome") $("#containerItem").toggleClass("hidden", true);
    }
    else {
      if (typeof (value) === "boolean") {
        $("#" + option).prop("checked", value);
        if (option.endsWith("PinChecked") && value) isPinnedOptions = true;
      }
      else {
        $("#" + option + " option[value='" + value + "']").prop("selected", true);
        if (option === "onDuplicateTabDetected") changeAutoCloseOptionState(value, false);
      }
    }
  }

  return isPinnedOptions;
};

const handleMessage = (message) => {
  if (message.action === "updateDuplicateTabsTable") setDuplicateTabsTable(message.data.duplicateTabs);
};

chrome.runtime.onMessage.addListener(handleMessage);

const handleDOMContentLoaded = () => {
  initialize();
  loadPopupEvents();
};

document.addEventListener("DOMContentLoaded", handleDOMContentLoaded);

// Localize the popup
const localizePopup = (node) => {
  const attribute = "i18n-content";
  const elements = node.querySelectorAll("[" + attribute + "]");
  elements.forEach(element => {
    const value = element.getAttribute(attribute);
    element.textContent = chrome.i18n.getMessage(value);
  });
};