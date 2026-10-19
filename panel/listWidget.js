"use strict";

let _listWidgetIdCounter = 0;

const buildListWidgetRow = (item, onChangeFn, { placeholder = "", readOnly = false } = {}) => {
    const value = item.value || "";
    const enabled = item.enabled !== false;

    const row = document.createElement("div");
    row.className = `list-widget-row${enabled ? "" : " list-widget-row--disabled"}`;

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "url-rule-enabled list-widget-enabled";
    cb.checked = enabled;
    cb.title = chrome.i18n.getMessage("urlRuleEnabled");

    const del = document.createElement("button");
    del.type = "button";
    del.className = "url-rule-delete list-widget-delete";
    del.setAttribute("aria-label", "Remove entry");
    const icon = document.createElement("span");
    icon.className = "fa-solid fa-xmark";
    icon.setAttribute("aria-hidden", "true");
    del.appendChild(icon);

    if (readOnly) {
        row.classList.add("list-widget-row--readonly");
        const cbId = `list-widget-cb-${(_listWidgetIdCounter += 1)}`;
        cb.id = cbId;
        const valueDisplay = document.createElement("label");
        valueDisplay.htmlFor = cbId;
        valueDisplay.className = "url-rule-pattern form-control form-control-sm list-widget-value";
        valueDisplay.textContent = value;
        del.classList.add("hidden");
        row.append(cb, valueDisplay, del);
        row.addEventListener("click", (e) => {
            if (e.target !== cb && e.target !== valueDisplay) cb.click();
        });
    } else {
        const input = document.createElement("input");
        input.type = "text";
        input.className = "url-rule-pattern form-control form-control-sm list-widget-value";
        input.value = value;
        if (placeholder) input.placeholder = placeholder;
        row.append(cb, input, del);
        input.addEventListener("change", () => {
            if (onChangeFn) onChangeFn();
        });
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                input.blur();
            }
        });
        del.addEventListener("click", () => {
            row.remove();
            if (onChangeFn) onChangeFn();
        });
    }

    cb.addEventListener("change", function () {
        row.classList.toggle("list-widget-row--disabled", !this.checked);
        if (onChangeFn) onChangeFn();
    });

    return row;
};

const collectListWidgetJson = (containerEl) => {
    const items = [];
    containerEl.querySelectorAll(".list-widget-row").forEach(row => {
        const el = row.querySelector(".list-widget-value");
        const value = (el.value ?? el.textContent ?? "").trim();
        if (!value) return;
        const enabled = row.querySelector(".list-widget-enabled").checked;
        const entry = { value };
        if (!enabled) entry.enabled = false;
        items.push(entry);
    });
    return JSON.stringify(items);
};

const parseListWidgetItems = (stored) => {
    if (typeof stored === "string" && stored.trimStart().startsWith("[")) {
        try {
            const arr = JSON.parse(stored);
            if (Array.isArray(arr)) {
                return arr.
                    map(item => ({ value: String(item.value || "").trim(), enabled: item.enabled !== false })).
                    filter(item => item.value);
            }
        } catch {
            // fall through to legacy
        }
    }
    if (typeof stored === "string") {
        return stored.split("\n").
            map(line => line.trim()).
            filter(line => line.length > 0).
            map(line => ({ value: line, enabled: true }));
    }
    return [];
};