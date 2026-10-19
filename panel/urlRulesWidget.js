"use strict";

const _urlRuleTypePlaceholders = {
    group: chrome.i18n.getMessage("urlRuleGroupPlaceholder"),
    normalize: chrome.i18n.getMessage("urlRuleNormalizePlaceholder"),
    pathDepth: chrome.i18n.getMessage("urlRulePathDepthPlaceholder"),
    stripParams: chrome.i18n.getMessage("urlRuleStripParamsPlaceholder"),
    keepParams: chrome.i18n.getMessage("urlRuleKeepParamsPlaceholder")
};

const _urlRuleTypeTooltips = {
    group: chrome.i18n.getMessage("urlRuleGroupTooltip"),
    normalize: chrome.i18n.getMessage("urlRuleNormalizeTooltip"),
    pathDepth: chrome.i18n.getMessage("urlRulePathDepthTooltip"),
    stripParams: chrome.i18n.getMessage("urlRuleStripParamsTooltip"),
    keepParams: chrome.i18n.getMessage("urlRuleKeepParamsTooltip")
};

const _urlRulePatternTitles = {
    group: chrome.i18n.getMessage("urlRuleGroupPatternTitle"),
    normalize: chrome.i18n.getMessage("urlRuleNormalizePatternTitle"),
    pathDepth: chrome.i18n.getMessage("urlRulePathDepthPatternTitle"),
    stripParams: chrome.i18n.getMessage("urlRuleStripParamsPatternTitle"),
    keepParams: chrome.i18n.getMessage("urlRuleKeepParamsPatternTitle")
};

const _urlRuleEnabledTitle = chrome.i18n.getMessage("urlRuleEnabled");

let _urlRuleIdCounter = 0;

const _isRegexPattern = (p) => p.startsWith("/") && (/\/[gimsuy]*$/).test(p);

const _validateRule = (type, pattern) => {
    if (!pattern) return null;
    const p = pattern.trim();
    if (p === "*") {
        if (type === "group") return "A bare * treats every open tab as a duplicate of every other tab. This rule will not be saved.";
        if (type === "normalize") return "A bare * replaces every website's hostname with a placeholder, causing cross-site false duplicates. This rule will not be saved.";
    }
    if (_isRegexPattern(p)) {
        if (type === "normalize") {
            const inner = p.slice(1, p.lastIndexOf("/"));
            if (!inner.includes("(")) return "A normalize regex requires a capture group (...) to extract the canonical URL. Without one it has no effect and will not be saved.";
        }
        if (type === "pathDepth" || type === "stripParams" || type === "keepParams") return "This rule type uses glob patterns only. Regex syntax (/.../) is not supported here and will not be saved.";
    }
    return null;
};

const buildUrlRuleRow = (rule, onChangeFn, { readOnly = false } = {}) => {
    const type = rule.type || "group";
    const pattern = rule.pattern || "";
    const enabled = rule.enabled !== false;

    const row = document.createElement("div");
    row.className = `url-rule-row${enabled ? "" : " url-rule-row--disabled"}`;

    const main = document.createElement("div");
    main.className = "url-rule-main";

    const enabledCheckbox = document.createElement("input");
    enabledCheckbox.type = "checkbox";
    enabledCheckbox.className = "url-rule-enabled";
    enabledCheckbox.checked = enabled;
    enabledCheckbox.title = _urlRuleEnabledTitle;

    const patternInput = document.createElement("input");
    patternInput.type = "text";
    patternInput.className = "url-rule-pattern form-control form-control-sm";
    patternInput.value = pattern;
    patternInput.placeholder = _urlRuleTypePlaceholders[type] || _urlRuleTypePlaceholders.group;
    patternInput.title = _urlRulePatternTitles[type] || "";

    const typeSelect = document.createElement("select");
    typeSelect.className = "url-rule-type form-select form-control-xs";
    typeSelect.title = _urlRuleTypeTooltips[type] || "";
    [["group", "Group"], ["normalize", "Normalize"], ["pathDepth", "Path depth"], ["stripParams", "Strip params"], ["keepParams", "Keep params"]].forEach(([val, label]) => {
        const opt = document.createElement("option");
        opt.value = val;
        opt.textContent = label;
        if (val === type) opt.selected = true;
        typeSelect.appendChild(opt);
    });

    const depthInput = document.createElement("input");
    depthInput.type = "number";
    depthInput.className = "url-rule-depth form-control form-control-sm";
    depthInput.min = "1";
    depthInput.value = rule.depth ?? 1;
    depthInput.title = chrome.i18n.getMessage("urlRuleDepthTitle");
    if (type !== "pathDepth") depthInput.classList.add("hidden");

    const paramsInput = document.createElement("input");
    paramsInput.type = "text";
    paramsInput.className = "url-rule-params form-control form-control-sm";
    paramsInput.placeholder = "z, page, utm_*";
    paramsInput.title = `${chrome.i18n.getMessage("urlRuleParamsTitle")} A lone * matches all parameter names.`;
    paramsInput.value = Array.isArray(rule.params) ? rule.params.join(", ") : "";
    if (type !== "stripParams" && type !== "keepParams") paramsInput.classList.add("hidden");

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "url-rule-delete";
    deleteBtn.setAttribute("aria-label", "Remove rule");
    const deleteBtnIcon = document.createElement("span");
    deleteBtnIcon.className = "fa-solid fa-xmark";
    deleteBtnIcon.setAttribute("aria-hidden", "true");
    deleteBtn.appendChild(deleteBtnIcon);

    const warningEl = document.createElement("p");
    warningEl.className = "url-rule-warning";
    warningEl.hidden = true;

    if (readOnly) {
        row.classList.add("url-rule-row--readonly");
        const cbId = `url-rule-cb-${(_urlRuleIdCounter += 1)}`;
        enabledCheckbox.id = cbId;
        const patternDisplay = document.createElement("label");
        patternDisplay.htmlFor = cbId;
        patternDisplay.className = "url-rule-pattern form-control form-control-sm";
        typeSelect.classList.add("hidden");
        depthInput.classList.add("hidden");
        paramsInput.classList.add("hidden");
        deleteBtn.classList.add("hidden");
        const typeLabels = { group: "Group", normalize: "Normalize", pathDepth: "Path depth", stripParams: "Strip params", keepParams: "Keep params" };
        const typeLabel = typeLabels[type] || type;
        patternDisplay.textContent = pattern;
        if (type === "pathDepth") {
            patternDisplay.title = `${typeLabel}: ${pattern} (depth: ${rule.depth ?? 1})`;
        } else if (type === "stripParams" || type === "keepParams") {
            const paramsList = Array.isArray(rule.params) && rule.params.length ? rule.params.join(", ") : "";
            patternDisplay.title = paramsList ? `${typeLabel}: ${pattern} (params: ${paramsList})` : `${typeLabel}: ${pattern}`;
        } else {
            patternDisplay.title = `${typeLabel}: ${pattern}`;
        }
        main.append(enabledCheckbox, patternDisplay, paramsInput, typeSelect, depthInput, deleteBtn);
        const initMsg = _validateRule(type, pattern);
        if (initMsg) {
            warningEl.textContent = initMsg;
            warningEl.hidden = false;
        }
        row.addEventListener("click", (e) => {
            if (e.target !== enabledCheckbox && e.target !== patternDisplay) enabledCheckbox.click();
        });
    } else {
        main.append(enabledCheckbox, patternInput, depthInput, paramsInput, typeSelect, deleteBtn);
    }

    row.appendChild(main);
    row.appendChild(warningEl);

    if (!readOnly) {
        const _updateWarning = () => {
            const msg = _validateRule(typeSelect.value, patternInput.value);
            warningEl.textContent = msg || "";
            warningEl.hidden = !msg;
        };

        typeSelect.addEventListener("change", function () {
            patternInput.placeholder = _urlRuleTypePlaceholders[this.value] || _urlRuleTypePlaceholders.group;
            patternInput.title = _urlRulePatternTitles[this.value] || "";
            this.title = _urlRuleTypeTooltips[this.value] || "";
            depthInput.classList.toggle("hidden", this.value !== "pathDepth");
            paramsInput.classList.toggle("hidden", this.value !== "stripParams" && this.value !== "keepParams");
            _updateWarning();
            if (onChangeFn) onChangeFn();
        });

        patternInput.addEventListener("input", _updateWarning);
        patternInput.addEventListener("change", () => {
            if (onChangeFn) onChangeFn();
        });
        patternInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                patternInput.blur();
            }
        });
        depthInput.addEventListener("change", () => {
            if (onChangeFn) onChangeFn();
        });
        paramsInput.addEventListener("change", () => {
            if (onChangeFn) onChangeFn();
        });
        paramsInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                paramsInput.blur();
            }
        });
        deleteBtn.addEventListener("click", () => {
            row.remove();
            if (onChangeFn) onChangeFn();
        });

        _updateWarning();
    }

    enabledCheckbox.addEventListener("change", function () {
        row.classList.toggle("url-rule-row--disabled", !this.checked);
        if (onChangeFn) onChangeFn();
    });

    return row;
};

const collectUrlRulesJson = (containerEl) => {
    const rules = [];
    containerEl.querySelectorAll(".url-rule-row").forEach(row => {
        const type = row.querySelector(".url-rule-type").value;
        const patternEl = row.querySelector(".url-rule-pattern");
        const pattern = (patternEl.value ?? patternEl.textContent ?? "").trim();
        if (!pattern) return;
        if (_validateRule(type, pattern)) return;
        const enabled = row.querySelector(".url-rule-enabled").checked;
        if (type === "pathDepth") {
            const depth = Math.max(1, parseInt(row.querySelector(".url-rule-depth").value, 10) || 1);
            const entry = { type, pattern, depth };
            if (!enabled) entry.enabled = false;
            rules.push(entry);
        } else if (type === "stripParams" || type === "keepParams") {
            const rawParams = (row.querySelector(".url-rule-params").value || "").split(",").map(s => s.trim()).filter(Boolean);
            if (!rawParams.length) return;
            const entry = { type, pattern, params: rawParams };
            if (!enabled) entry.enabled = false;
            rules.push(entry);
        } else {
            const entry = { type, pattern };
            if (!enabled) entry.enabled = false;
            rules.push(entry);
        }
    });
    return JSON.stringify(rules);
};
