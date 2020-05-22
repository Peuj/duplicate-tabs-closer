
"use strict";

// eslint-disable-next-line no-unused-vars
const wait = timeout => new Promise(resolve => setTimeout(resolve, timeout));

// eslint-disable-next-line no-unused-vars
const debounce = (func, delay) => {
    const storedArguments = new Map();
    return (...args) => {
        const windowId = args[0] || 1;
        const later = () => {
            const laterArgs = storedArguments.get(windowId);
            if (laterArgs) {
                func(laterArgs);
                setTimeout(later, delay);
                storedArguments.set(windowId, null);
            }
            else {
                storedArguments.delete(windowId);
            }
        };

        if (!storedArguments.has(windowId)) {
            func(args[1] || args[0]);
            setTimeout(later, delay);
            storedArguments.set(windowId, null);
        }
        else {
            storedArguments.set(windowId, args[1] || args[0] || 1);
        }
    };
};

// eslint-disable-next-line no-unused-vars
const isTabComplete = tab => tab.status === "complete";

// eslint-disable-next-line no-unused-vars
const isTabLoading = tab => tab.status === "loading";

// eslint-disable-next-line no-unused-vars
const getTab = (tabId) => new Promise((resolve) => {
    chrome.tabs.get(tabId, tab => {
        if (chrome.runtime.lastError) console.error("getTab error:", chrome.runtime.lastError.message);
        resolve(chrome.runtime.lastError ? null : tab);
    });
});

const getTabs = (queryInfo) => new Promise((resolve) => {
    queryInfo.windowType = "normal";
    chrome.tabs.query(queryInfo, tabs => {
        if (chrome.runtime.lastError) console.error("getTabs error:", chrome.runtime.lastError.message);
        resolve(chrome.runtime.lastError ? null : tabs);
    });
});

// eslint-disable-next-line no-unused-vars
const getWindows = () => new Promise((resolve) => {
    chrome.windows.getAll(null, windows => {
        if (chrome.runtime.lastError) console.error("getWindows error:", chrome.runtime.lastError.message);
        resolve(chrome.runtime.lastError ? null : windows);
    });
});

const updateWindow = (windowId, updateProperties) => new Promise((resolve, reject) => {
    chrome.windows.update(windowId, updateProperties, () => {
        if (chrome.runtime.lastError) {
            console.error("updateWindow error:", chrome.runtime.lastError.message);
            reject();
        }
        else resolve();
    });
});

const getActiveTab = async (windowId) => {
    const tabs = await getTabs({ windowId: windowId, active: true });
    return tabs ? tabs[0] : null;
};

// eslint-disable-next-line no-unused-vars
const getActiveTabId = async (windowId) => {
    const activeTab = await getActiveTab(windowId);
    return activeTab ? activeTab.id : null;
};

// eslint-disable-next-line no-unused-vars
const reloadTab = (tabId) => new Promise((resolve, reject) => {
    chrome.tabs.reload(tabId, () => {
        if (chrome.runtime.lastError) {
            console.error("reloadTab error:", chrome.runtime.lastError.message);
            reject();
        }
        else resolve();
    });
});

// eslint-disable-next-line no-unused-vars
const getActiveWindowId = () => new Promise((resolve) => {
    chrome.windows.getLastFocused(null, window => {
        if (chrome.runtime.lastError) console.error("getActiveWindowId error:", chrome.runtime.lastError.message);
        resolve(chrome.runtime.lastError ? null : window.id);
    });
});

const updateTab = (tabId, updateProperties) => new Promise((resolve, reject) => {
    chrome.tabs.update(tabId, updateProperties, () => {
        if (chrome.runtime.lastError) {
            console.error("updateTab error:", tabId, updateProperties, chrome.runtime.lastError.message);
            reject();
        }
        else resolve();
    });
});

const activateWindow = (windowId) => updateWindow(windowId, { focused: true });

const activateTab = (tabId) => updateTab(tabId, { active: true });

// eslint-disable-next-line no-unused-vars
const focusTab = (tabId, windowId) => Promise.all([activateTab(tabId), activateWindow(windowId)]);

// eslint-disable-next-line no-unused-vars
const moveTab = (tabId, moveProperties) => new Promise((resolve, reject) => {
    chrome.tabs.move(tabId, moveProperties, () => {
        if (chrome.runtime.lastError) {
            console.error("moveTab error:", chrome.runtime.lastError.message);
            reject();
        }
        else resolve();
    });
});

// eslint-disable-next-line no-unused-vars
const removeTab = (tabId) => new Promise((resolve, reject) => {
    chrome.tabs.remove(tabId, () => {
        if (chrome.runtime.lastError) {
            console.error("removeTab error:", chrome.runtime.lastError.message);
            reject();
        }
        else resolve();
    });
});

// eslint-disable-next-line no-unused-vars
const setIcon = (details) => new Promise((resolve) => {
    chrome.browserAction.setIcon(details, () => {
        if (chrome.runtime.lastError) console.error("setIcon error:", chrome.runtime.lastError.message);
        resolve();
    });
});

// eslint-disable-next-line no-unused-vars
const getTabBadgeText = (tabId) => new Promise((resolve) => {
    chrome.browserAction.getBadgeText({ tabId: tabId }, badgeText => {
        if (chrome.runtime.lastError) console.error("getTabBadgeText error:", chrome.runtime.lastError.message);
        resolve(badgeText);
    });
});

// eslint-disable-next-line no-unused-vars
const getWindowBadgeText = (windowId) => browser.browserAction.getBadgeText({ windowId: windowId });

// eslint-disable-next-line no-unused-vars
const setTabBadgeText = (tabId, text) => new Promise((resolve) => {
    if (!tabId) {
        console.error("setTabBadgeText error: no tabId");
        resolve();
        return;
    }    
    chrome.browserAction.setBadgeText({ tabId: tabId, text: text }, () => {
        if (chrome.runtime.lastError) console.error("setTabBadgeText error:", chrome.runtime.lastError.message);
        resolve();
    });
});

// eslint-disable-next-line no-unused-vars
const setWindowBadgeText = (windowId, text) => browser.browserAction.setBadgeText({ windowId: windowId, text: text });

// eslint-disable-next-line no-unused-vars
const setTabBadgeBackgroundColor = (tabId, color) => new Promise((resolve) => {
    chrome.browserAction.setBadgeBackgroundColor({ tabId: tabId, color: color }, () => {
        if (chrome.runtime.lastError) console.error("setTabBadgeBackgroundColor error:", chrome.runtime.lastError.message);
        resolve();
    });
});

// eslint-disable-next-line no-unused-vars
const setWindowBadgeBackgroundColor = (windowId, color) => browser.browserAction.setBadgeBackgroundColor({ windowId: windowId, color: color });

// eslint-disable-next-line no-unused-vars
const getStoredOptions = () => Promise.all([
    new Promise((resolve) => {
        chrome.storage.local.get(null, localOptions => {
            if (chrome.runtime.lastError) console.error("getStoredOptions error on getting local storage:", chrome.runtime.lastError.message);
            resolve(localOptions);
        });
    }),
    // chrome.storage.managed is supported on Firefox 57 and later
    !chrome.storage.managed ? null : new Promise((resolve) => {
        chrome.storage.managed.get(null, managedOptions => {
            if (chrome.runtime.lastError) {
                if (chrome.runtime.lastError.message === "Managed storage manifest not found") {
                    // only log warning as that is expected when no manifest file is found
                    console.warn("could not get managed options:", chrome.runtime.lastError.message);
                }
                else {
                    console.error("getStoredOptions error on getting managed storage:", chrome.runtime.lastError.message);
                }
            }
            resolve(managedOptions);
        });
    })
]).then(results => {
    const [localOptions, managedOptions] = results;
    return {
        storedOptions: Object.assign({}, localOptions || {}, managedOptions || {}),
        lockedKeys: Object.keys(managedOptions || {})
    };
});

const clearStoredOptions = () => new Promise((resolve) => {
    chrome.storage.local.clear(() => {
        if (chrome.runtime.lastError) console.error("clearStoredOptions error:", chrome.runtime.lastError.message);
        resolve();
    });
});

// eslint-disable-next-line no-unused-vars
const saveStoredOptions = async (options, overwrite) => {
    if (overwrite) await clearStoredOptions();
    return new Promise((resolve) => {
        chrome.storage.local.set(options, () => {
            if (chrome.runtime.lastError) console.error("saveStoredOptions error:", chrome.runtime.lastError.message);
            resolve(Object.assign({}, options));
        });
    });
};

// eslint-disable-next-line no-unused-vars
const getPlatformInfo = () => new Promise((resolve) => {
    chrome.runtime.getPlatformInfo(info => {
        if (chrome.runtime.lastError) console.error("getPlatformInfo error:", chrome.runtime.lastError.message);
        resolve(info);
    });
});

// eslint-disable-next-line no-unused-vars
const getFirefoxMajorVersion = async () => {
    const browserInfo = await browser.runtime.getBrowserInfo();
    const majorVersion = parseInt(browserInfo.version.split(".")[0], 10);
    return majorVersion;
};

// eslint-disable-next-line no-unused-vars
const sendMessage = (action, data) => new Promise((resolve, reject) => {
    const CHROME_SEND_MESSAGE_CALLBACK_NO_RESPONSE_MESSAGE = "The message port closed before a response was received.";
    chrome.runtime.sendMessage({ action: action, data: data }, response => {
        if (chrome.runtime.lastError) {
            if (chrome.runtime.lastError.message === CHROME_SEND_MESSAGE_CALLBACK_NO_RESPONSE_MESSAGE) {
                resolve();
            } else {
                reject(chrome.runtime.lastError);
            }
        }
        else {
            resolve(response);
        }
    });
});

// eslint-disable-next-line no-unused-vars
const areSameArrays = (array1, array2) => {
    if (!array1 && !array2) {
        return true;
    }
    if (!array1 || !array2) {
        return false;
    }
    return JSON.stringify(array1) === JSON.stringify(array2);
};