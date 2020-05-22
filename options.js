"use strict";

const defaultOptions = {
    onDuplicateTabDetected: {
        value: "N"
    },
    onRemainingTab: {
        value: "A"
    },
    keepTabBasedOnAge: {
        value: "O"
    },
    keepTabWithHttps: {
        value: true
    },
    keepPinnedTab: {
        value: true
    },
    keepTabWithHistory: {
        value: false
    },
    scope: {
        value: "C"
    },
    ignoreHashPart: {
        value: false
    },
    ignoreSearchPart: {
        value: false
    },
    ignorePathPart: {
        value: false
    },
    ignore3w: {
        value: false
    },
    caseInsensitive: {
        value: false
    },
    compareWithTitle: {
        value: false
    },
    onDuplicateTabDetectedThumbChecked: {
        value: true
    },
    tabPriorityThumbChecked: {
        value: true
    },
    filtersThumbChecked: {
        value: true
    },
    scopeThumbChecked: {
        value: true
    },
    customizationThumbChecked: {
        value: true
    },
    whiteList: {
        value: ""
    },
    blackList: {
        value: ""
    },
    badgeColorDuplicateTabs: {
        value: "#f22121"
    },
    badgeColorNoDuplicateTabs: {
        value: "#1e90ff"
    },
    showBadgeIfNoDuplicateTabs: {
        value: true
    },
    environment: {
        value: "firefox"
    }
};

const setupDefaultOptions = async () => {
    const environment = await getEnvironment();
    const options = Object.assign({}, defaultOptions);
    options.environment.value = environment;
    return options;
};

const getEnvironment = async () => {
    const info = await getPlatformInfo();
    const environment = (info.os === "android") ? "android" : (typeof InstallTrigger !== "undefined") ? "firefox" : "chrome";
    return environment;
};

const getNotInReferenceKeys = (referenceKeys, keys) => {
    const setKeys = new Set(keys);
    return Array.from(referenceKeys).filter(key => !setKeys.has(key));
};

// eslint-disable-next-line no-unused-vars
const initializeOptions = async () => {
    const options = await getStoredOptions();
    let storedOptions = options.storedOptions;
    if (storedOptions.length === 0) {
        const intialOptions = await setupDefaultOptions();
        storedOptions = await saveStoredOptions(intialOptions);
    } else {
        const storedKeys = Object.keys(storedOptions).sort();
        const defaultKeys = Object.keys(defaultOptions).sort();
        if (JSON.stringify(storedKeys) != JSON.stringify(defaultKeys)) {
            const obsoleteKeys = getNotInReferenceKeys(storedKeys, defaultKeys);
            obsoleteKeys.forEach(key => delete storedOptions[key]);
            const missingKeys = getNotInReferenceKeys(defaultKeys, storedKeys);
            // eslint-disable-next-line no-return-assign
            missingKeys.forEach(key => storedOptions[key] = { value: defaultOptions[key].value });
            const environment = await getEnvironment();
            storedOptions.environment.value = environment;
            storedOptions = await saveStoredOptions(storedOptions, true);
        }
    }
    setOptions(storedOptions);
    setEnvironment(storedOptions);
};

// eslint-disable-next-line no-unused-vars
const setStoredOption = async (name, value, refresh) => {
    const options = await getStoredOptions();
    const storedOptions = options.storedOptions;
    storedOptions[name].value = value;
    saveStoredOptions(storedOptions);
    setOptions(storedOptions);
    if (refresh) refreshGlobalDuplicateTabsInfo();
    else if (name === "onDuplicateTabDetected") setBadgeIcon();
    else if (name === "showBadgeIfNoDuplicateTabs" || name === "badgeColorNoDuplicateTabs" || name === "badgeColorDuplicateTabs") updateBadgeStyle();
};

const options = {};

const setOptions = (storedOptions) => {
    options.autoCloseTab = storedOptions.onDuplicateTabDetected.value === "A";
    options.defaultTabBehavior = storedOptions.onRemainingTab.value === "B";
    options.activateKeptTab = storedOptions.onRemainingTab.value === "A";
    options.keepNewerTab = storedOptions.keepTabBasedOnAge.value === "N";
    options.keepReloadOlderTab = storedOptions.keepTabBasedOnAge.value === "R";
    options.keepTabWithHttps = storedOptions.keepTabWithHttps.value;
    options.keepPinnedTab = storedOptions.keepPinnedTab.value;
    options.ignoreHashPart = storedOptions.ignoreHashPart.value;
    options.ignoreSearchPart = storedOptions.ignoreSearchPart.value;
    options.ignorePathPart = storedOptions.ignorePathPart.value;
    options.compareWithTitle = storedOptions.compareWithTitle.value;
    options.ignore3w = storedOptions.ignore3w.value;
    options.caseInsensitive = storedOptions.caseInsensitive.value;
    options.searchInAllWindows = storedOptions.scope.value === "A" || storedOptions.scope.value === "CA";
    options.searchPerContainer = storedOptions.scope.value === "CC" || storedOptions.scope.value === "CA";
    options.whiteList = whiteListToPattern(storedOptions.whiteList.value);
    options.badgeColorDuplicateTabs = storedOptions.badgeColorDuplicateTabs.value;
    options.badgeColorNoDuplicateTabs = storedOptions.badgeColorNoDuplicateTabs.value;
    options.showBadgeIfNoDuplicateTabs = storedOptions.showBadgeIfNoDuplicateTabs.value;
};

const environment = {
    isAndroid: false,
    isFirefox: false,
    isChrome: false
};

const setEnvironment = (storedOptions) => {
    if (storedOptions.environment.value === "android") {
        environment.isAndroid = true;
        environment.isFirefox = false;
    } else if (storedOptions.environment.value === "firefox") {
        environment.isAndroid = false;
        environment.isFirefox = true;
        environment.isChrome = false;
    }
    else if (storedOptions.environment.value === "chrome") {
        environment.isAndroid = false;
        environment.isFirefox = false;
        environment.isChrome = true;
    }
};

// eslint-disable-next-line no-unused-vars
const isPanelOptionOpen = () => {
    const popups = chrome.extension.getViews({ type: "popup" });
    if (popups.length) return true;
    const tabs = chrome.extension.getViews({ type: "tab" });
    return tabs.length > 0;
};

const whiteListToPattern = (whiteList) => {
    const whiteListPatterns = new Set();
    const whiteListLines = whiteList.split("\n").map(line => line.trim());
    whiteListLines.forEach(whiteListLine => {
        const length = whiteListLine.length;
        let pattern = "^";
        for (let index = 0; index < length; index += 1) {
            const character = whiteListLine.charAt(index);
            pattern = (character === "*") ? `${pattern}.*` : pattern + character;
        }
        whiteListPatterns.add(new RegExp(`${pattern}$`));
    });
    return Array.from(whiteListPatterns);
};