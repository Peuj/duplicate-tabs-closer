
"use strict";

 
const wait = timeout => new Promise(resolve => setTimeout(resolve, timeout));

const debounce = (func, delay, immediate = true) => {
    const storedArguments = new Map();
    const debouncedFn = (...args) => {
        const windowId = typeof args[0] !== "undefined" ? args[0] : 1;
        const later = () => {
            const laterArgs = storedArguments.get(windowId);
            if (laterArgs) {
                func(...laterArgs);
                setTimeout(later, delay);
                storedArguments.set(windowId, null);
            }
            else {
                storedArguments.delete(windowId);
            }
        };

        if (immediate) {
            if (!storedArguments.has(windowId)) {
                func(...args);
                setTimeout(later, delay);
                storedArguments.set(windowId, null);
            }
            else {
                storedArguments.set(windowId, args);
            }
        }
        else {
            const alreadyQueued = storedArguments.has(windowId);
            storedArguments.set(windowId, args);
            if (!alreadyQueued) setTimeout(later, delay);
        }
    };
    debouncedFn.cleanup = (windowId) => {
        storedArguments.delete(windowId);
    };
    return debouncedFn;
};

const tabExists = async (tabId) => {
    const tab = await getTab(tabId, true);
    return tab !== null;
};

const isTabComplete = tab => tab.status === "complete" || tab.status === "unloaded";

 
const getTab = (tabId, silent = false) => new Promise((resolve) => {
    chrome.tabs.get(tabId, tab => {
        if (chrome.runtime.lastError && !silent) console.error("getTab error:", chrome.runtime.lastError.message);
        resolve(chrome.runtime.lastError ? null : tab);
    });
});

const getTabs = (queryInfo) => new Promise((resolve) => {
    const info = { ...queryInfo, windowType: "normal" };
    chrome.tabs.query(info, tabs => {
        if (chrome.runtime.lastError) console.error("getTabs error:", chrome.runtime.lastError.message);
        resolve(chrome.runtime.lastError ? null : tabs);
    });
});

const getWindows = () => new Promise((resolve) => {
    chrome.windows.getAll({}, windows => {
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
    const tabs = await getTabs({ windowId, active: true });
    return tabs ? tabs[0] : null;
};

const getActiveTabId = async (windowId) => {
    const activeTab = await getActiveTab(windowId);
    return activeTab ? activeTab.id : null;
};

const reloadTab = (tabId) => new Promise((resolve, reject) => {
    chrome.tabs.reload(tabId, () => {
        if (chrome.runtime.lastError) {
            console.error("reloadTab error:", chrome.runtime.lastError.message);
            reject();
        }
        else resolve();
    });
});

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

const focusTab = (tabId, windowId) => Promise.all([activateTab(tabId), activateWindow(windowId)]);

const moveTab = (tabId, moveProperties) => new Promise((resolve, reject) => {
    chrome.tabs.move(tabId, moveProperties, () => {
        if (chrome.runtime.lastError) {
            console.error("moveTab error:", chrome.runtime.lastError.message);
            reject();
        }
        else resolve();
    });
});

const removeTab = (tabId) => new Promise((resolve, reject) => {
    chrome.tabs.remove(tabId, () => {
        if (chrome.runtime.lastError) {
            console.error("removeTab error:", chrome.runtime.lastError.message);
            reject();
        }
        else resolve();
    });
});


const setTabBadgeText = (tabId, text) => new Promise((resolve) => {
    if (tabId === null || typeof tabId === "undefined" || tabId < 0) {
        console.error("setTabBadgeText error: no tabId");
        resolve();
        return;
    }
    chrome.action.setBadgeText({ tabId, text }, () => {
        if (chrome.runtime.lastError && !chrome.runtime.lastError.message.includes("No tab with id")) console.error("setTabBadgeText error:", chrome.runtime.lastError.message);
        resolve();
    });
});

const setWindowBadgeText = (windowId, text) => browser.action.setBadgeText({ windowId, text }).catch(() => {
    // ignore: Firefox may not support this in all contexts
});

const setTabBadgeBackgroundColor = (tabId, color) => new Promise((resolve) => {
    if (tabId === null || typeof tabId === "undefined" || tabId < 0) {
        resolve();
        return;
    }
    chrome.action.setBadgeBackgroundColor({ tabId, color }, () => {
        if (chrome.runtime.lastError && !chrome.runtime.lastError.message.includes("No tab with id")) console.error("setTabBadgeBackgroundColor error:", chrome.runtime.lastError.message);
        resolve();
    });
});

const setWindowBadgeBackgroundColor = (windowId, color) => browser.action.setBadgeBackgroundColor({ windowId, color }).catch(() => {
    // ignore: Firefox may not support this in all contexts
});

const getStoredOptions = () => Promise.all([
    new Promise((resolve) => {
        chrome.storage.local.get(null, localOptions => {
            if (chrome.runtime.lastError) console.error("getStoredOptions error on getting local storage:", chrome.runtime.lastError.message);
            resolve(localOptions);
        });
    }),
    // chrome.storage.managed is supported on Firefox 57 and later.
    // On Windows Enterprise, the GP check can block for 5-10s on Chrome startup.
    // Race against a 100ms timeout so the extension initializes quickly.
    !chrome.storage.managed ? null : Promise.race([
        new Promise((resolve) => {
            chrome.storage.managed.get(null, managedOptions => {
                if (chrome.runtime.lastError) {
                    if (chrome.runtime.lastError.message !== "Managed storage manifest not found") {
                        console.error("getStoredOptions error on getting managed storage:", chrome.runtime.lastError.message);
                    }
                }
                resolve(managedOptions);
            });
        }),
        new Promise(resolve => setTimeout(() => resolve(null), 100))
    ])
]).then(results => {
    const [localOptions, managedOptions] = results;
    return {
        storedOptions: Object.assign({}, localOptions || {}, managedOptions || {}),
        lockedKeys: Object.keys(managedOptions || {})
    };
});

const removeStoredOptions = (keys) => new Promise((resolve) => {
    chrome.storage.local.remove(keys, () => {
        if (chrome.runtime.lastError) console.error("removeStoredOptions error:", chrome.runtime.lastError.message);
        resolve();
    });
});

const saveStoredOptions = (options) => new Promise((resolve) => {
        chrome.storage.local.set(options, () => {
            if (chrome.runtime.lastError) console.error("saveStoredOptions error:", chrome.runtime.lastError.message);
            resolve(Object.assign({}, options));
        });
    });

const _sendMessageOnce = (action, data) => new Promise((resolve, reject) => {
    const CHROME_SEND_MESSAGE_CALLBACK_NO_RESPONSE_MESSAGE = "The message port closed before a response was received.";
    chrome.runtime.sendMessage({ action, data }, response => {
        if (chrome.runtime.lastError) {
            const msg = chrome.runtime.lastError.message || "";
            if (msg === CHROME_SEND_MESSAGE_CALLBACK_NO_RESPONSE_MESSAGE ||
                    msg.includes("receiving end does not exist")) {
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

const sendMessage = async (action, data, retries = 3, retryDelay = 300) => {
    for (let i = 0; i < retries; i += 1) {
        const response = await _sendMessageOnce(action, data);
        if (typeof response !== "undefined") return response;
        if (i < retries - 1) await wait(retryDelay);
    }
};

const titleSimilarity = (a, b) => {
    const s1 = a.toLowerCase(), 
s2 = b.toLowerCase();
    const m = s1.length, 
n = s2.length;
    if (m === 0 && n === 0) return 100;
    if (m === 0 || n === 0) return 0;
    let prev = new Int32Array(n + 1);
    let curr = new Int32Array(n + 1);
    for (let i = 0; i <= n; i += 1) prev[i] = i;
    for (let i = 1; i <= m; i += 1) {
        curr[0] = i;
        for (let j = 1; j <= n; j += 1) {
            curr[j] = s1[i - 1] === s2[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
        }
        const tmp = prev;
        prev = curr;
        curr = tmp;
    }
    return Math.round((1 - (prev[n] / Math.max(m, n))) * 100);
};