"use strict";

const handleMessage = (message, sender, response) => {

    const sendResponse = (data) => response({ data: data });

    switch (message.action) {
        case "setStoredOption": {
            setStoredOption(message.data.name, message.data.value, message.data.refresh);
            break;
        }
        case "getOptions": {
            Promise.all([
                new Promise((resolve) => {
                    chrome.storage.local.get(null, storedOptions => resolve(storedOptions));
                }),
                // chrome.storage.managed is supported on Firefox 57 and later
                !chrome.storage.managed ? null : new Promise((resolve) => {
                    chrome.storage.managed.get(null, managedOptions => {resolve(managedOptions));
                })
            ]).then(results => {
              const [storedOptions, managedOptions] = results;
              sendResponse(Object.assign({}, storedOptions || {}, managedOptions || {}));
            });
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