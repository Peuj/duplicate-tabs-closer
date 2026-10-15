"use strict";

const _urlRuleTypePlaceholders = {
    group: chrome.i18n.getMessage("urlRuleGroupPlaceholder"),
    normalize: chrome.i18n.getMessage("urlRuleNormalizePlaceholder"),
    pathDepth: chrome.i18n.getMessage("urlRulePathDepthPlaceholder")
};

const _urlRuleTypeTooltips = {
    group: chrome.i18n.getMessage("urlRuleGroupTooltip"),
    normalize: chrome.i18n.getMessage("urlRuleNormalizeTooltip"),
    pathDepth: chrome.i18n.getMessage("urlRulePathDepthTooltip")
};

const _urlRulePatternTitles = {
    group: chrome.i18n.getMessage("urlRuleGroupPatternTitle"),
    normalize: chrome.i18n.getMessage("urlRuleNormalizePatternTitle"),
    pathDepth: chrome.i18n.getMessage("urlRulePathDepthPatternTitle")
};

const buildUrlRuleRow = (rule, onChangeFn) => {
    const type = rule.type || "group";
    const pattern = rule.pattern || "";

    const row = document.createElement("div");
    row.className = "url-rule-row";

    const main = document.createElement("div");
    main.className = "url-rule-main";

    const patternInput = document.createElement("input");
    patternInput.type = "text";
    patternInput.className = "url-rule-pattern form-control form-control-sm";
    patternInput.value = pattern;
    patternInput.placeholder = _urlRuleTypePlaceholders[type] || _urlRuleTypePlaceholders.group;
    patternInput.title = _urlRulePatternTitles[type] || "";

    const typeSelect = document.createElement("select");
    typeSelect.className = "url-rule-type form-select form-select-sm";
    typeSelect.title = _urlRuleTypeTooltips[type] || "";
    [["group", "Group"], ["normalize", "Normalize"], ["pathDepth", "Path depth"]].forEach(([val, label]) => {
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

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "url-rule-delete";
    deleteBtn.setAttribute("aria-label", "Remove rule");
    deleteBtn.textContent = "×";

    main.append(patternInput, typeSelect, depthInput, deleteBtn);
    row.appendChild(main);

    typeSelect.addEventListener("change", function () {
        patternInput.placeholder = _urlRuleTypePlaceholders[this.value] || _urlRuleTypePlaceholders.group;
        patternInput.title = _urlRulePatternTitles[this.value] || "";
        this.title = _urlRuleTypeTooltips[this.value] || "";
        depthInput.classList.toggle("hidden", this.value !== "pathDepth");
        if (onChangeFn) onChangeFn();
    });

    patternInput.addEventListener("change", () => {
        if (onChangeFn) onChangeFn();
    });
    patternInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); patternInput.blur(); }
    });
    depthInput.addEventListener("change", () => {
        if (onChangeFn) onChangeFn();
    });
    deleteBtn.addEventListener("click", () => {
        row.remove();
        if (onChangeFn) onChangeFn();
    });

    return row;
};

const collectUrlRulesJson = (containerEl) => {
    const rules = [];
    containerEl.querySelectorAll(".url-rule-row").forEach(row => {
        const type = row.querySelector(".url-rule-type").value;
        const pattern = row.querySelector(".url-rule-pattern").value.trim();
        if (!pattern) return;
        if (type === "pathDepth") {
            const depth = Math.max(1, parseInt(row.querySelector(".url-rule-depth").value, 10) || 1);
            rules.push({ type, pattern, depth });
        } else {
            rules.push({ type, pattern });
        }
    });
    return JSON.stringify(rules);
};
