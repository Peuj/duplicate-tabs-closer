"use strict";

const defaultOptions = {
    shrunkMode: {
        value: false
    },
    onDuplicateTabDetected: {
        value: "N"
    },
    openPopupOnDuplicateDetected: {
        value: false
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
    scope: {
        value: "C"
    },
    prioritizeActiveWindow: {
        value: true
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
    titleSimilarityThreshold: {
        value: 100
    },
    urlRegexRules: {
        value: ""
    },
    titleRegexRules: {
        value: ""
    },
    caseInsensitive_popup: {
        value: false
    },
    ignore3w_popup: {
        value: false
    },
    ignoreHashPart_popup: {
        value: false
    },
    ignoreSearchPart_popup: {
        value: false
    },
    ignorePathPart_popup: {
        value: true
    },
    compareWithTitle_popup: {
        value: true
    },
    urlRegexRules_popup: {
        value: true
    },
    titleRegexRules_popup: {
        value: false
    },
    onDuplicateTabDetectedPinned: {
        value: true
    },
    tabPriorityPinned: {
        value: true
    },
    matchingRulesPinned: {
        value: true
    },
    scopePinned: {
        value: true
    },
    themePinned: {
        value: true
    },
    popupPinned: {
        value: true
    },
    badgePinned: {
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
    closePopup: {
        value: false
    },
    hideWhitelistedTabs: {
        value: false
    },
    skipBlankTabs: {
        value: false
    },
    popupTwoColumns: {
        value: "2"
    },
    popupGroupedView: {
        value: false
    },
    popupShowOptions: {
        value: true
    },
    environment: {
        value: "firefox"
    },
    theme: {
        value: "light"
    }
};

const setupDefaultOptions = () => {
    const environment = getEnvironment();
    const options = Object.assign({}, defaultOptions);
    options.environment.value = environment;
    return options;
};

const getEnvironment = () => navigator.userAgent.includes("Firefox") ? "firefox" : "chrome";

const getNotInReferenceKeys = (referenceKeys, keys) => {
    const setKeys = new Set(keys);
    return Array.from(referenceKeys).filter(key => !setKeys.has(key));
};

// eslint-disable-next-line no-unused-vars
const initializeOptions = async () => {
    const options = await getStoredOptions();
    let storedOptions = options.storedOptions;
    if (Object.keys(storedOptions).length === 0) {
        const initialOptions = setupDefaultOptions();
        storedOptions = await saveStoredOptions(initialOptions);
    } else {
        const storedKeys = Object.keys(storedOptions).sort();
        const defaultKeys = Object.keys(defaultOptions).sort();
        if (storedKeys.length !== defaultKeys.length || storedKeys.some((k, i) => k !== defaultKeys[i])) {
            const obsoleteKeys = getNotInReferenceKeys(storedKeys, defaultKeys);
            if (obsoleteKeys.length > 0) {
                obsoleteKeys.forEach(key => delete storedOptions[key]);
                await removeStoredOptions(obsoleteKeys);
            }
            const missingKeys = getNotInReferenceKeys(defaultKeys, storedKeys);
            // eslint-disable-next-line no-return-assign
            missingKeys.forEach(key => storedOptions[key] = { value: defaultOptions[key].value });
            const environment = getEnvironment();
            storedOptions.environment.value = environment;
            storedOptions = await saveStoredOptions(storedOptions);
        }
    }
    setOptions(storedOptions);
    setEnvironment(storedOptions);
};

// eslint-disable-next-line no-unused-vars
let _savingLocally = false;

// eslint-disable-next-line no-unused-vars
const setStoredOption = async (name, value, refresh) => {
    const options = await getStoredOptions();
    const storedOptions = options.storedOptions;
    if (!storedOptions[name]) storedOptions[name] = { value: defaultOptions[name].value };
    storedOptions[name].value = value;
    _savingLocally = true;
    await saveStoredOptions(storedOptions);
    setOptions(storedOptions);
    if (name === "onDuplicateTabDetected") setBadgeIcon();
    else if (name === "showBadgeIfNoDuplicateTabs" || name === "badgeColorNoDuplicateTabs" || name === "badgeColorDuplicateTabs") updateBadgeStyle();
    if (refresh) refreshGlobalDuplicateTabsInfo();
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
    options.titleSimilarityThreshold = storedOptions.titleSimilarityThreshold.value;
    options.ignore3w = storedOptions.ignore3w.value;
    options.caseInsensitive = storedOptions.caseInsensitive.value;
    options.searchInAllWindows = storedOptions.scope.value === "A" || storedOptions.scope.value === "CA";
    options.searchPerContainer = storedOptions.scope.value === "CC" || storedOptions.scope.value === "CA";
    options.prioritizeActiveWindow = storedOptions.prioritizeActiveWindow.value;
    options.whiteList = whiteListToPattern(storedOptions.whiteList.value);
    options.urlRegexRules = parsePatternRules(storedOptions.urlRegexRules.value);
    options.titleRegexRules = parsePatternRules(storedOptions.titleRegexRules.value);
    options.badgeColorDuplicateTabs = storedOptions.badgeColorDuplicateTabs.value;
    options.badgeColorNoDuplicateTabs = storedOptions.badgeColorNoDuplicateTabs.value;
    options.showBadgeIfNoDuplicateTabs = storedOptions.showBadgeIfNoDuplicateTabs.value;
    options.skipBlankTabs = storedOptions.skipBlankTabs.value;
    options.openPopupOnDuplicateDetected = storedOptions.openPopupOnDuplicateDetected.value;
    options.theme = storedOptions.theme.value;
};

const environment = {
    isFirefox: false,
    isChrome: false
};

const setEnvironment = (storedOptions) => {
    if (storedOptions.environment.value === "firefox") {
        environment.isFirefox = true;
        environment.isChrome = false;
    }
    else if (storedOptions.environment.value === "chrome") {
        environment.isFirefox = false;
        environment.isChrome = true;
    }
};

// eslint-disable-next-line no-unused-vars
const isPanelOptionOpen = async () => {
    const contexts = await chrome.runtime.getContexts({});
    const popupUrl = chrome.runtime.getURL("popup/popup.html");
    const optionPageUrl = chrome.runtime.getURL("optionPage/optionPage.html");
    return contexts.some(ctx =>
        ctx.contextType === "POPUP" ||
        (ctx.contextType === "TAB" && ctx.documentUrl && (
            ctx.documentUrl.startsWith(popupUrl) ||
            ctx.documentUrl.startsWith(optionPageUrl)
        ))
    );
};

// Returns true only if the popup itself is already open, not the options page.
// Used to avoid opening a second popup when duplicates are detected.
// eslint-disable-next-line no-unused-vars
const isPopupOpen = async () => {
    const contexts = await chrome.runtime.getContexts({});
    const popupUrl = chrome.runtime.getURL("popup/popup.html");
    return contexts.some(ctx =>
        ctx.contextType === "POPUP" ||
        (ctx.contextType === "TAB" && ctx.documentUrl && ctx.documentUrl.startsWith(popupUrl))
    );
};

const escapeRegexChar = (ch) => ch.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

const whiteListToPattern = (whiteList) => {
    const MAX_WILDCARDS = 5;
    const whiteListPatterns = new Set();
    const whiteListLines = whiteList.split("\n").map(line => line.trim()).filter(line => line.length > 0);
    whiteListLines.forEach(whiteListLine => {
        const regexMatch = whiteListLine.match(/^\/(.+)\/([gimsuy]*)$/);
        if (regexMatch) {
            try { whiteListPatterns.add(new RegExp(regexMatch[1], regexMatch[2])); } catch (_) {}
        } else {
            const normalizedLine = whiteListLine.replace(/\/$/, "");
            if ((normalizedLine.match(/\*/g) || []).length > MAX_WILDCARDS) return;
            const length = normalizedLine.length;
            let pattern = "^";
            for (let index = 0; index < length; index += 1) {
                const character = normalizedLine.charAt(index);
                pattern = (character === "*") ? `${pattern}.*` : pattern + escapeRegexChar(character);
            }
            whiteListPatterns.add(new RegExp(`${pattern}\\/?$`));
        }
    });
    return Array.from(whiteListPatterns);
};

const parsePatternRules = (text) => {
    const MAX_LINE_LENGTH = 200;
    const MAX_WILDCARDS = 5;
    return text.split("\n")
        .map(line => line.trim().slice(0, MAX_LINE_LENGTH))
        .filter(line => line.length > 0)
        .filter(line => (line.match(/\*/g) || []).length <= MAX_WILDCARDS)
        .map(line => {
            let pattern = "^";
            for (const ch of line) pattern = ch === "*" ? `${pattern}.*` : pattern + escapeRegexChar(ch);
            return { source: line, regex: new RegExp(`${pattern}$`) };
        });
};