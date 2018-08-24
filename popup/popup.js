"use strict";


const initialize = async () => {
  localizePopup(document.documentElement);
  const nbPinnedOptions = await setPaneOptions();
  toggleOptionPanel(false, nbPinnedOptions);
  requestGetDuplicateTabs();
  sendMessage("setPopupOptionState", { "value": true });
};

const loadEvents = () => {

  // Save checkbox settings
  $(".list-group input[type='checkbox'").on("change", function () {
    saveOption(this.id, this.checked);
    if (this.className === "checkbox-filter") requestRefreshAllDuplicateTabs(false);
  });

  // Save combobox settings
  $(".list-group select").on("change", function () {
    saveOption(this.id, this.value);
    if (this.id === "onDuplicateTabDetected") changeAutoCloseOptionState(this.value, true);
    else if (this.id === "scope") requestRefreshAllDuplicateTabs(true);
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

const toggleOptionPanel = async (clicked, nbPinnedOptions) => {

  const toggleOptionsGroupPromises = [
    toggleOptionsGroup("onDuplicateTabDetectedGroup"),
    toggleOptionsGroup("priorityTabGroup"),
    toggleOptionsGroup("scopeGroup"),
    toggleOptionsGroup("filtersGroup")
  ];

  if (clicked) {
    $("#panelHeadingOptions").toggleClass("group-collapsed group-expanded");

    if ($("#panelHeadingOptions").hasClass("group-expanded")) {
      await Promise.all(toggleOptionsGroupPromises);
    }

    $("#panelHeadingOptions").nextAll(".list-group-collapsible").first().slideToggle(0, "linear", () => {
      resizeDuplicateTabsPanel();
    });
  }
  else if (nbPinnedOptions === 0) {
    $("#panelHeadingOptions").toggleClass("group-collapsed group-expanded");
    $("#panelHeadingOptions").nextAll(".list-group-collapsible").first().slideToggle(0, "linear", () => {
      resizeDuplicateTabsPanel();
    });
  }
  else if (nbPinnedOptions > 0) {
    await Promise.all(toggleOptionsGroupPromises);
    resizeDuplicateTabsPanel();
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
    chrome.windows.getCurrent({ windowTypes: ["normal"] }, focusedWindow => {
      $("#duplicateTabsTable").empty();
      $("#duplicateTabsTable").append("<tbody></tbody>");
      duplicateTabs.forEach(duplicateTab => {
        const containerStyle = duplicateTab.containerColor ? "style='text-decoration:underline; text-decoration-color: " + duplicateTab.containerColor + ";'" : "";
        const title = (duplicateTab.windowId === focusedWindow.id) ? duplicateTab.title : "<em>" + duplicateTab.title + "</em>";
        $("#duplicateTabsTable > tbody").append("<tr tabId='" + duplicateTab.id + "' group='" + duplicateTab.group + "' windowId='" + duplicateTab.windowId + "'><td class='td-tab-link' " + containerStyle + "> <img src='" + duplicateTab.icon + "'>" + title + "</td><td class='td-close-button'><button type='button' class='close'>&times;</button></td></tr>");
      });
      $("#closeDuplicateTabsBtn").toggleClass("disabled", false);
      setDuplicateTabsMaxWidth();
    });
  }
  else {
    $("#duplicateTabsTable").empty();
    $("#duplicateTabsTable").append("<tr><td width='100%'align='center' valign='center'><font color='#9FACBD'><em>" + chrome.i18n.getMessage("noDuplicateTabs") + ".</em></font></td></tr>");
    $("#closeDuplicateTabsBtn").toggleClass("disabled", true);
    $(".td-tab-link").css("max-width", "280px");
  }
};

const resizeDuplicateTabsPanel = () => {
  const optionGroupHeight = $(".list-group").height();
  const duplicateTabsPanelHeight = 550 - optionGroupHeight;
  $("#panelDuplicateTabs").css("max-height", duplicateTabsPanelHeight);
  $(".table-scrollable").css("max-height", duplicateTabsPanelHeight - 100);
  setDuplicateTabsMaxWidth();
};

const setDuplicateTabsMaxWidth = () => {
  $(".table-scrollable").height() + $(".list-group").height() >= 450 ? $(".td-tab-link").css("max-width", "260px") : $(".td-tab-link").css("max-width", "280px");
};

const sendMessage = (action, data) => {
  return new Promise((resolve) => chrome.runtime.sendMessage({ action: action, data: data }, resolve));
};

const requestRefreshAllDuplicateTabs = () => sendMessage("refreshAllDuplicateTabs", { "windowId": chrome.windows.WINDOW_ID_CURRENT });

const requestCloseDuplicateTabs = () => sendMessage("closeDuplicateTabs", { "windowId": chrome.windows.WINDOW_ID_CURRENT });

const requestGetDuplicateTabs = () => sendMessage("getDuplicateTabs", { "windowId": chrome.windows.WINDOW_ID_CURRENT });

const requestCloseDuplicateTab = (tabId) => sendMessage("closeDuplicateTab", { "tabId": tabId });

const activateSelectedTab = (tabId, windowId) => sendMessage("activateTab", { "tabId": tabId, "windowId": windowId });

const saveOption = (name, value) => sendMessage("setStoredOption", { "name": name, "value": value });

const setPaneOptions = async () => {
  const response = await sendMessage("getOptions");
  const options = response.data;
  const pinnedOptions = new Set();
  for (const option in options) {
    const data = options[option];
    if (option === "environment") {
      if (data.value === "chrome") $("#containerItem").toggleClass("hidden", true);
    }
    else {
      if (typeof (data.value) === "boolean") {
        $("#" + option).prop("checked", data.value);
        if (option.endsWith("Checked") && data.value) pinnedOptions.add(option);
      }
      else {
        $("#" + option + " option[value='" + data.value + "']").prop("selected", true);
        if (option === "onDuplicateTabDetected") changeAutoCloseOptionState(data.value, false);
      }
    }
  }

  return pinnedOptions.size;
};


// Localize the popup
const localizePopup = (node) => {
  const attribute = "i18n-content";
  const elements = node.querySelectorAll("[" + attribute + "]");
  elements.forEach(element => {
    const value = element.getAttribute(attribute);
    element.textContent = chrome.i18n.getMessage(value);
  });
};

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "updateDuplicateTabsTable") {
    setDuplicateTabsTable(message.data.duplicateTabs);
  }
});

document.addEventListener("DOMContentLoaded", () => {
  initialize();
  loadEvents();
});

window.addEventListener("unload", () => {
  sendMessage("setPopupOptionState", { "value": false });
});