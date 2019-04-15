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
    compareWithTitle: {
        value: false
    },
    onDuplicateTabDetectedGroupPinChecked: {
        value: true
    },
    priorityTabGroupPinChecked: {
        value: true
    },
    filtersGroupPinChecked: {
        value: true
    },
    scopeGroupPinChecked: {
        value: true
    },
    whiteList: {
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
    const options = Object.assign({}, defaultOptions);
    const info = await getPlatformInfo();
    const environment = (info.os === "android") ? "android" : (typeof InstallTrigger !== "undefined") ? "firefox" : "chrome";
    options.environment.value = environment;
    if (environment === "android") options.scope.value = "A";
    return options;
};

const getNotInReferenceKeys = (referenceKeys, keys) => {
    const setKeys = new Set(keys);
    return [...referenceKeys].filter(x => !setKeys.has(x));
};

/* exported initializeOptions */
const initializeOptions = async () => {
    let storedOptions = await getStoredOptions();
    const storedKeys = Object.keys(storedOptions).sort();
    const defaultKeys = Object.keys(defaultOptions).sort();

    if (storedKeys.length === 0) {
        const options = await setupDefaultOptions();
        storedOptions = await saveStoredOptions(options);
    } else if (JSON.stringify(storedKeys) != JSON.stringify(defaultKeys)) {
        const obsoleteKeys = getNotInReferenceKeys(storedKeys, defaultKeys);
        obsoleteKeys.forEach(key => delete storedOptions[key]);
        const missingKeys = getNotInReferenceKeys(defaultKeys, storedKeys);
        missingKeys.forEach(key => storedOptions[key] = { value: defaultOptions[key].value });
        storedOptions = await saveStoredOptions(storedOptions, true);
    }

    setOptions(storedOptions);
    await setEnvironment(storedOptions);
};

/* exported setStoredOption */
const setStoredOption = async (name, value, refresh) => {
    let storedOptions = await getStoredOptions();
    storedOptions[name].value = value;
    storedOptions = await saveStoredOptions(storedOptions);
    setOptions(storedOptions);
    if (refresh) refreshGlobalDuplicateTabsInfo(chrome.windows.WINDOW_ID_CURRENT);
    else if (name === "onDuplicateTabDetected") setBadgeIcon();
    else if (name === "showBadgeIfNoDuplicateTabs") setBadge({ "windowId": chrome.windows.WINDOW_ID_CURRENT });
};

const options = {
    autoCloseTab: false,
    defaultTabBehavior: false,
    activateKeptTab: false,
    keepNewerTab: false,
    keepReloadOlderTab: false,
    keepTabWithHttps: false,
    keepPinnedTab: false,
    ignoreHashPart: false,
    ignoreSearchPart: false,
    ignorePathPart: false,
    compareWithTitle: false,
    searchInSameContainer: false,
    searchInCurrentWindow: false,
    searchInAllWindows: false,
    whiteList: [],
    badgeColorDuplicateTabs: "",
    badgeColorNoDuplicateTabs: "",
    showBadgeIfNoDuplicateTabs: false
};

const setOptions = (storedOptions) => {
    options.autoCloseTab = storedOptions["onDuplicateTabDetected"].value === "A";
    options.defaultTabBehavior = storedOptions["onRemainingTab"].value === "B";
    options.activateKeptTab = storedOptions["onRemainingTab"].value === "A";
    options.keepNewerTab = storedOptions["keepTabBasedOnAge"].value === "N";
    options.keepReloadOlderTab = storedOptions["keepTabBasedOnAge"].value === "R";
    options.keepTabWithHttps = storedOptions["keepTabWithHttps"].value;
    options.keepPinnedTab = storedOptions["keepPinnedTab"].value;
    options.ignoreHashPart = storedOptions["ignoreHashPart"].value;
    options.ignoreSearchPart = storedOptions["ignoreSearchPart"].value;
    options.ignorePathPart = storedOptions["ignorePathPart"].value;
    options.compareWithTitle = storedOptions["compareWithTitle"].value;
    options.searchInSameContainer = storedOptions["scope"].value === "O";
    options.searchInCurrentWindow = storedOptions["scope"].value === "C";
    options.searchInAllWindows = storedOptions["scope"].value === "A";
    options.whiteList = whiteListToPattern(storedOptions["whiteList"].value);
    options.badgeColorDuplicateTabs = storedOptions["badgeColorDuplicateTabs"].value;
    options.badgeColorNoDuplicateTabs = storedOptions["badgeColorNoDuplicateTabs"].value;
    options.showBadgeIfNoDuplicateTabs = storedOptions["showBadgeIfNoDuplicateTabs"].value;
};

const environment = {
    isAndroid: false,
    isFirefox: false,
    isChrome: false,
    isFirefox62Compatible: false,
    isFirefox63Compatible: false
};

const setEnvironment = async (storedOptions) => {
    if (storedOptions.environment.value === "android") {
        environment.isAndroid = true;
        environment.isFirefox = false;
    } else if (storedOptions.environment.value === "firefox") {
        environment.isAndroid = false;
        environment.isFirefox = true;
        environment.isChrome = false;
        const majorVersion = await getFirefoxMajorVersion();
        environment.isFirefox62Compatible = majorVersion >= 62;
        environment.isFirefox63Compatible = majorVersion >= 63;
    }
    else if (storedOptions.environment.value === "chrome") {
        environment.isAndroid = false;
        environment.isFirefox = false;
        environment.isChrome = true;
    }
};

/* exported isOptionOpen */
const isOptionOpen = () => {
    const popups = chrome.extension.getViews({
        type: "popup"
    });
    if (popups.length) return true;
    const tabs = chrome.extension.getViews({
        type: "tab"
    });
    return tabs.length > 0;
};

const whiteListToPattern = (whiteList) => {

    const whiteListPatterns = new Set();
    const whiteListLines = whiteList.split('\n').map(line => line.trim());

    whiteListLines.forEach(whiteListLine => {
        const length = whiteListLine.length;
        let pattern = '^';
        for (let index = 0; index < length; index++) {
            const character = whiteListLine.charAt(index);
            pattern = (character === '*') ? pattern + '.*' : pattern + character;
        }
        whiteListPatterns.add(new RegExp(pattern + '$'));
    });

    return Array.from(whiteListPatterns);
};