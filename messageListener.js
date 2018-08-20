"use strict";

chrome.runtime.onMessage.addListener( (message, sender, response) => {

    const sendResponse = (data) => response({ data: data });

    switch (message.action) {
        case "setTabOptionState": {
            setTabOptionState(message.data.value);
            break;
        }
        case "setPopupOptionState": {
            setPopupOptionState(message.data.value);
            break;
        }
        case "setStoredOption": {
            setStoredOption(message.data.name, message.data.value);
            break;
        }
        case "getOptions": {
            chrome.storage.local.get(null, options => sendResponse(options));
            return true;        
        }
        case "getDuplicateTabs": {
            getDuplicateTabs(message.data.windowId);
            break;
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
        case "refreshAllDuplicateTabs": {
            refreshAllDuplicateTabs(message.data.windowId);
            break;
        }
    }

});
