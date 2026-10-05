"use strict";

const _urlRuleTypePlaceholders = {
    group: "youtube.com/watch/* or /reddit\\.com\\/(r|user)\\/.*/",
    normalize: "bunkr.* (e.g. bunkr.cr = bunkr.site)"
};

const _urlRuleTypeTooltips = {
    group: "Groups tabs matching this pattern as duplicates of each other (supports * wildcard or /regex/flags)",
    normalize: "Treats matching hostnames as the same site: bunkr.* makes bunkr.cr and bunkr.site match at the same path"
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

    const typeSelect = document.createElement("select");
    typeSelect.className = "url-rule-type form-select form-select-sm";
    typeSelect.title = _urlRuleTypeTooltips[type] || "";
    [["group", "Group"], ["normalize", "Normalize"]].forEach(([val, label]) => {
        const opt = document.createElement("option");
        opt.value = val;
        opt.textContent = label;
        if (val === type) opt.selected = true;
        typeSelect.appendChild(opt);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "url-rule-delete";
    deleteBtn.setAttribute("aria-label", "Remove rule");
    deleteBtn.textContent = "×";

    main.append(patternInput, typeSelect, deleteBtn);
    row.appendChild(main);

    typeSelect.addEventListener("change", function () {
        patternInput.placeholder = _urlRuleTypePlaceholders[this.value] || _urlRuleTypePlaceholders.group;
        this.title = _urlRuleTypeTooltips[this.value] || "";
        if (onChangeFn) onChangeFn();
    });

    patternInput.addEventListener("change", () => {
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
        rules.push({ type, pattern });
    });
    return JSON.stringify(rules);
};