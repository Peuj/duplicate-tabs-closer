"use strict";

const handleMessage = (message, sender, response) => {
    if (!message || !message.action) return;
    switch (message.action) {
        case "setStoredOption": {
            if (!message.data || !(message.data.name in defaultOptions)) return response({});
            setStoredOption(message.data.name, message.data.value, message.data.refresh).
                then(() => response({})).catch(() => response({}));
            return true;
        }
        case "getStoredOptions": {
            getStoredOptions().then(storedOptions => response({ data: storedOptions })).catch(() => response({}));
            return true;
        }
        case "getDuplicateTabs": {
            if (!message.data) return response({});
            if (monitoringPaused) {
                chrome.runtime.sendMessage({ action: "updateDuplicateTabsTable", data: { duplicateTabs: null } }).catch(() => {
                // ignore: panel may not be open
            });
            } else {
                requestDuplicateTabsFromPanel(message.data.windowId);
            }
            response({});
            break;
        }
        case "closeDuplicateTabs": {
            if (!message.data) return response({});
            closeDuplicateTabs(message.data.windowId, message.data.skipWhitelisted);
            response({});
            break;
        }
        case "toggleMonitorPause": {
            toggleMonitorPause().then(() => response({ paused: monitoringPaused })).catch(() => response({}));
            return true;
        }
        case "getMonitorPauseState": {
            response({ paused: monitoringPaused });
            break;
        }
    }
};

const handleExternalMessage = (message, sender, response) => {
    // externally_connectable is DEV-only and stripped from production builds.
    // This guard is defense-in-depth for the case where the build strip fails.
    if (!sender) return false;
    return handleMessage(message, sender, response);
};

chrome.runtime.onMessage.addListener(handleMessage);
if (chrome.runtime.onMessageExternal) {
    chrome.runtime.onMessageExternal.addListener(handleExternalMessage);
}