"use strict";

const defaultOptions = {
    onDuplicateTabDetected: {
        value: "N",
    },
    onRemainingTab: {
        value: "A",
    },
    keepTabBasedOnAge: {
        value: "O",
    },
    keepTabWithHttps: {
        value: true,
    },
    keepPinnedTab: {
        value: true,
    },
    keepTabWithHistory: {
        value: false,
    },
    scope: {
        value: "C",
    },
    ignoreHashPart: {
        value: false,
    },
    ignoreSearchPart: {
        value: false,
    },
    ignorePathPart: {
        value: false,
    },
    compareWithTitle: {
        value: false,
    },
    onDuplicateTabDetectedGroupPinChecked: {
        value: true,
    },
    priorityTabGroupPinChecked: {
        value: true,
    },
    filtersGroupPinChecked: {
        value: true,
    },
    scopeGroupPinChecked: {
        value: true,
    },
    badgeColorDuplicateTabs: {
        value: "#f22121"
    },
    badgeColorNoDuplicateTab: {
        value: "#1e90ff"
    },
    environment: {
        value: "firefox"
    }
};

const setEnvironmentOptions = async (storedOptions) => {
    const info = await getPlatformInfo();
    const environment = (info.os === "android") ? "android" : (typeof InstallTrigger !== "undefined") ? "firefox" : "chrome";
    storedOptions.environment.value = environment;
    if (environment === "android") {
        storedOptions.scope.value = "A";
        options.isAndroid = true;
    }
};

const getNotInReferenceKeys = (referenceKeys, keys) => {
    const setKeys = new Set(keys);
    const differences = [...new Set([...referenceKeys].filter(x => !setKeys.has(x)))];
    return differences;
};

/* exported initializeOptions */
const initializeOptions = async () => {
    let storedOptions = await getStoredOptions();
    const storedKeys = Object.keys(storedOptions).sort();
    const defaultKeys = Object.keys(defaultOptions).sort();

    if (storedKeys.length === 0) {
        await setEnvironmentOptions(defaultOptions);
        storedOptions = await saveStoredOptions(defaultOptions);
    }
    else if (JSON.stringify(storedKeys) != JSON.stringify(defaultKeys)) {

        const missingKeys = getNotInReferenceKeys(defaultKeys, storedKeys);
        missingKeys.forEach(key => {
            storedOptions[key] = { value: defaultOptions[key].value };
        });

        const obsoleteKeys = getNotInReferenceKeys(storedKeys, defaultKeys);
        obsoleteKeys.forEach(key => {
            delete storedOptions[key];
        });

        await setEnvironmentOptions(storedOptions);
        storedOptions = await saveStoredOptions(storedOptions, true);
    }

    setOptions(storedOptions);
    setBadgeIcon();
};

/* exported setStoredOption */
const setStoredOption = async (name, value) => {
    let storedOptions = await getStoredOptions();
    storedOptions[name].value = value;
    storedOptions = await saveStoredOptions(storedOptions);
    setOptions(storedOptions);
    if (name === "onDuplicateTabDetected") setBadgeIcon();
};

const options = {
    autoCloseTab: false,
    defaultTabBehavior: false,
    activateKeptTab: false,
    keepNewerTab: false,
    keepTabWithHttps: false,
    keepPinnedTab: false,
    ignoreHashPart: false,
    ignoreSearchPart: false,
    ignorePathPart: false,
    compareWithTitle: false,
    searchInSameContainer: false,
    searchInCurrentWindow: false,
    searchInAllWindows: false,
    badgeColorDuplicateTabs: "",
    badgeColorNoDuplicateTab: "",
    isAndroid: false,
    isFirefox: false
};

const setOptions = (storedOptions) => {
    options.autoCloseTab = storedOptions["onDuplicateTabDetected"].value === "A";
    options.defaultTabBehavior = storedOptions["onRemainingTab"].value === "B";
    options.activateKeptTab = storedOptions["onRemainingTab"].value === "A";
    options.keepNewerTab = storedOptions["keepTabBasedOnAge"].value === "N";
    options.keepTabWithHttps = storedOptions["keepTabWithHttps"].value;
    options.keepPinnedTab = storedOptions["keepPinnedTab"].value;
    options.ignoreHashPart = storedOptions["ignoreHashPart"].value;
    options.ignoreSearchPart = storedOptions["ignoreSearchPart"].value;
    options.ignorePathPart = storedOptions["ignorePathPart"].value;
    options.compareWithTitle = storedOptions["compareWithTitle"].value;
    options.searchInSameContainer = storedOptions["scope"].value === "O";
    options.searchInCurrentWindow = storedOptions["scope"].value === "C";
    options.searchInAllWindows = storedOptions["scope"].value === "A";
    options.badgeColorDuplicateTabs = storedOptions["badgeColorDuplicateTabs"].value;
    options.badgeColorNoDuplicateTab = storedOptions["badgeColorNoDuplicateTab"].value;
    options.isFirefox = storedOptions["environment"].value === "firefox";
};

let popupOptionOpen = false;
let tabOptionOpen = false;

/* exported setPopupOptionState */
const setPopupOptionState = (value) => {
    popupOptionOpen = value;
};

/* exported setTabOptionState */
const setTabOptionState = (value) => {
    tabOptionOpen = value;
};

/* exported isOptionOpen */
const isOptionOpen = () => (popupOptionOpen || tabOptionOpen) ? true : false;