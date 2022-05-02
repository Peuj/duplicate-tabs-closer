"use strict";

const handleMessage = (message, sender, response) => {
    switch (message.action) {
        case "setStoredOption": {
            setStoredOption(message.data.name, message.data.value, message.data.refresh);
            break;
        }
        case "getStoredOptions": {
            getStoredOptions().then(storedOptions => response({ data: storedOptions }));
            return true;
        }
        case "getDuplicateTabs": {
            requestDuplicateTabsFromPanel(message.data.windowId);
            break;
        }
        case "closeDuplicateTabs": {
            closeDuplicateTabs(message.data.windowId);
            break;
        }
    }
};

chrome.runtime.onMessage.addListener(handleMessage);