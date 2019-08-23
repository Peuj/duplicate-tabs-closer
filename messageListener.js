"use strict";

const handleMessage = (message, sender, response) => {

    const sendResponse = (data) => response({ data: data });

    switch (message.action) {
        case "setStoredOption": {
            setStoredOption(message.data.name, message.data.value, message.data.refresh);
            break;
        }
        case "getStoredOptions": {
            getStoredOptions().then(storedOptions => sendResponse(storedOptions));
            return true;
        }
        case "getDuplicateTabs": {
            getDuplicateTabs(message.data.windowId).then(duplicateTabs => sendResponse(duplicateTabs));
            return true;
        }
        case "closeDuplicateTabs": {
            closeDuplicateTabs(message.data.windowId);
            break;
        }
        case "closeDuplicateTab": {
            chrome.tabs.remove(message.data.tabId);
            break;
        }
        case "activateTab": {
            activateTab(message.data.tabId, message.data.windowId);
            break;
        }
        case "refreshGlobalDuplicateTabsInfo": {
            refreshGlobalDuplicateTabsInfo(message.data.windowId);
            break;
        }
    }

    sendResponse(undefined);
};

chrome.runtime.onMessage.addListener(handleMessage);