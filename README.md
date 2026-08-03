# Duplicate Tabs Closer

Duplicate Tabs Closer detects and closes duplicate tabs automatically or displays them in a panel for manual review.

* Built with the [WebExtensions API](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions)
* Supports Chrome, Firefox, Edge, Opera, Vivaldi, and Brave
* Firefox Multi-Account Containers are supported

## Supported Browsers

| Browser | Store | Notes |
| --- | --- | --- |
| Chrome | [Chrome Web Store](https://chrome.google.com/webstore/detail/duplicate-tabs-closer/gnmdbogfankgjepgglmmfmbnimcmcjle) | Full support |
| Firefox | [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/duplicate-tabs-closer) | Full support including Multi-Account Containers |
| Microsoft Edge | Chrome Web Store | Full support |
| Opera | Chrome Web Store | Full support |
| Vivaldi | Chrome Web Store | Full support |
| Brave | Chrome Web Store | Full support |

> **Note:** The **Container** scope options are exclusive to Firefox and require the [Multi-Account Containers](https://support.mozilla.org/en-US/kb/containers) feature. They are not available on Chrome, Edge, Opera, Vivaldi, or Brave.

## Accessing Options

The extension offers two configuration interfaces:

* **Popup panel:** click the extension icon in the toolbar. Provides quick access to a configurable subset of options and the list of current duplicate tabs.
* **Options page:** click the gear icon (⚙) at the top-right of the popup, or open your browser's Extensions settings and choose *Options* for Duplicate Tabs Closer. Provides access to all settings.

In the Options page, each option in the **Matching rules** section has an eye icon (👁) that controls whether that option is visible in the popup panel.

## Options

### On Duplicate Tab Detected

Controls what the extension does when a duplicate tab is opened.

| Value | Description |
| --- | --- |
| **Do nothing** *(default)* | Monitors tabs and updates the badge counter. No automatic action is taken. |
| **Close tab automatically** | Immediately closes the duplicate tab when it is detected. |

#### On Remaining Tab

> Only active when **On duplicate tab detected** is set to *Close tab automatically*.

Determines what happens to the kept tab after its duplicate is closed.

| Value | Description |
| --- | --- |
| **Do nothing** | Nothing further happens after the duplicate is closed. |
| **Activate** *(default)* | Switches focus to the kept tab. |
| **Default tab behaviour** | Moves the kept tab to the position of the closed tab and activates it if needed, mimicking the browser's normal tab behaviour. |

#### Intentional Duplicate Protection

> Only active when **On duplicate tab detected** is set to *Close tab automatically*.

Tabs opened on purpose using the browser's built-in **Duplicate Tab** command are never auto-closed. They are still detected and shown in the duplicate tabs list (marked with a shield icon), so you can review and close them manually if needed. Navigating the duplicated tab to a different URL removes the protection.

> **Note:** On Firefox, this uses the sessions API to reliably detect cloned tabs. On Chrome and other Chromium-based browsers (Edge, Vivaldi, Brave), detection is based on the order in which browser events fire — the navigation event arrives before the tab creation event only for the built-in Duplicate Tab command, distinguishing it from links or address bar navigation. Other browsers are not currently supported.

### Priority & Exclusions

Determines which of two duplicate tabs is kept when one must be closed, and defines which tabs are excluded from detection entirely. Rules are applied in this order:

1. Pinned tab preference (if *Keep pinned tab* is enabled)
2. HTTPS preference (if *Keep tab with HTTPS* is enabled)
3. Age-based preference (*Keep older tab* / *Keep newer tab*)
4. Active window preference (if *Prioritize active window* is enabled and scope covers multiple windows)

| Option | Default | Description |
| --- | --- | --- |
| **Keep older tab** | on | Keeps the tab that was opened first. |
| **Keep newer tab** | off | Keeps the most recently opened tab. |
| **Keep and reload older tab** | off | Keeps the older tab but reloads it with the newer tab's URL. Useful when the newer URL contains updated content such as a redirect destination. |
| **Keep tab with HTTPS** | on | When one tab uses HTTP and the other HTTPS for the same URL, the HTTPS tab is kept. Also normalises `http://` to `https://` during URL comparison so the two are treated as duplicates. |
| **Keep pinned tab** | on | A pinned tab is always kept; the unpinned duplicate is closed instead. |
| **Prioritize active window** | on | When duplicates span multiple windows and the age-based preference would close the tab in the currently focused window, keeps that tab instead. Only applies when **Scope** is set to *All windows* or *Container in all windows*. |

> The first three options (Keep older tab / Keep newer tab / Keep and reload older tab) are mutually exclusive. Only one is active at a time.

#### Skip blank tabs

> Available in the **Options page** only.

When enabled, blank tabs (`about:blank` and new tab pages) are completely invisible to the extension — they are never shown in the duplicate tabs list, never auto-closed, and never used as a reference when comparing tabs. This is distinct from the whitelist: whitelisted tabs are still detected and shown; skipped blank tabs are not processed at all.

#### Whitelisted URLs

> Available in the **Options page** only.

A list of URL patterns, one per line. Whitelisted tabs are always detected and shown in the duplicate tabs list, marked with a tooltip indicating they are whitelisted. In *Close tab automatically* mode, they are never auto-closed. When the **Hide whitelisted tabs** button is active, they are also excluded from the **Close duplicates** button in manual mode.

**Pattern syntax:** `*` matches any sequence of characters. All other characters match literally. Lines wrapped in `/…/` are treated as regular expressions: `/^(?!.*google\.com)/` whitelists everything except Google.

```text
https://docs.google.com/*
*://github.com/*/issues
/^(?!.*google\.com)/
```

### Matching Rules

Controls how two tabs are compared to determine whether they are duplicates.

| Option | Default | Description |
| --- | --- | --- |
| **Ignore case in URL** | off | Treats uppercase and lowercase as equal (`Example.com` = `example.com`). |
| **Ignore 'www' in URL domain name** | off | Treats `www.example.com` and `example.com` as identical. |
| **Ignore hash part in URL** | off | Ignores everything after `#` (`page.html#intro` = `page.html#setup`). Has no effect when *Ignore path part* is enabled. |
| **Ignore query parameters in URL (search part)** | off | Ignores the query string (everything after `?`). Has no effect when *Ignore path part* is enabled. |
| **Ignore path part in URL (domain only)** | off | Compares only the origin (scheme + domain), ignoring path, query string, and hash. When this is enabled, *Ignore hash part* and *Ignore search part* are redundant. |
| **Detect duplicates by** | URL only | Controls how tabs are matched: **URL only** uses URL comparison only (default). **URL match or title match** also closes tabs whose page titles match, even across different URLs: useful for pages that display the same title on different URLs. **URL match and same title** keeps tabs with the same URL but different titles: useful when you rename tabs to distinguish them. |
| **% title similarity** | 100 | Minimum similarity percentage (1–100) for two titles to be considered a match. `100` requires an exact match (case-insensitive). Only active when *Detect duplicates by* is set to *URL match or title match*. |

#### URL Pattern Rules

A list of URL patterns, one per line. Any two open tabs whose URLs both match the same pattern are treated as duplicates, even if their full URLs differ.

Useful for grouping all tabs from a single service as duplicates of each other regardless of the specific path.

**Pattern syntax:** `*` matches any sequence of characters. All other characters match literally. For more complex matching, wrap the pattern in `/` slashes to use a regular expression: `/regex/flags`.

```text
*://docs.google.com/*
*://github.com/*/pull/*
/example\.com\/(threads|t)\//
```

#### Title Pattern Rules

Works identically to URL Pattern Rules but is applied to the page title instead of the URL. Any two tabs whose titles both match the same pattern are treated as duplicates.

Only active when *Detect duplicates by* is set to *URL match or title match*.

**Pattern syntax:** `*` matches any sequence of characters. All other characters match literally. Wrap in `/` slashes for regex: `/regex/flags`.

```text
* - Gmail
GitHub - *
```

> **Pattern syntax note:** The Whitelist, URL Pattern Rules, and Title Pattern Rules all support the same syntax. Use `*` as a wildcard (matches any sequence of characters). To use a regular expression, wrap the pattern in `/` slashes: `/regex/flags`. Plain patterns treat `.`, `+`, `?`, `(`, `)` etc. as literals, not regex metacharacters.

### Scope

Defines which tabs are included when searching for duplicates.

| Value | Default | Browser | Description |
| --- | --- | --- | --- |
| **Active window** | on | All | Searches for duplicates only within the currently focused browser window. |
| **All windows** | off | All | Searches for duplicates across all open browser windows. |
| **Container in active window** | off | **Firefox only** | Duplicates are detected only among tabs that share the same [container](https://support.mozilla.org/en-US/kb/containers) within the active window. Tabs in different containers are never treated as duplicates of each other. |
| **Container in all windows** | off | **Firefox only** | Same as above but searches across all open windows. |

> The **Container** options require Firefox with the [Multi-Account Containers](https://support.mozilla.org/en-US/kb/containers) feature enabled.

### Theme

> Available in the **Options page** only.

| Option | Default | Description |
| --- | --- | --- |
| **Theme** | Sky *(default)* | Visual theme for the extension panel. See [Themes](#themes) below. |

#### Themes

11 themes are available from the **Theme** dropdown in the Options page:

**Light themes:** Sky *(default)*, Sage, Rose, Amber, Slate, Violet

**Dark themes:** Ocean Night, Charcoal, Midnight Purple, Dark Teal, OLED Black

### Popup

> Available in the **Options page** only.

| Option | Default | Description |
| --- | --- | --- |
| **Popup layout** | Two columns | Layout of the popup panel. *Single column* shows options above the duplicate tabs list. *Two columns* shows them side by side. |
| **Close popup after closing duplicate tabs** | off | Automatically closes the popup panel after the *Close duplicates* button is clicked. |
| **Open popup on duplicate detected** | off | Automatically opens the popup panel whenever a new duplicate tab is detected. The Options section collapses automatically when the popup is opened this way, giving more space to the duplicate tabs list. |

### Badge

> Available in the **Options page** only.

| Option | Default | Description |
| --- | --- | --- |
| **Duplicate tabs badge color** | `#f22121` (red) | Color of the extension icon badge when duplicate tabs are detected. |
| **No duplicate tabs badge color** | `#1e90ff` (blue) | Color of the badge when no duplicates exist. Only relevant when *Show badge if no duplicate tabs* is enabled. |
| **Show badge if no duplicate tabs** | on | Always displays the badge. When off, the badge is hidden entirely when there are no duplicates. |

### Popup Panel

In the duplicate tabs list, tabs that will be closed show a strikethrough title. The tab that will be kept is shown at full brightness.

* **Grouped view:** click the group icon in the duplicate tabs footer to switch between flat and grouped views. In grouped view, duplicate tabs are organised by matching rule group, collapsed by default. Each group shows a count badge and a close button to close all tabs in the group at once. Expand/collapse state per group is preserved while the panel is open. The view preference is saved and shared with the options page.

* **Hide whitelisted tabs:** click the hide-whitelisted icon in the duplicate tabs footer to suppress whitelisted duplicate groups from the badge count and popup list. A small count bubble on the button shows how many groups are hidden. When active, the **Close duplicates** button also skips whitelisted tabs. The preference is saved and shared with the options page.

* **Hide options column:** in two-column layout, click the chevron tab on the left edge of the duplicate tabs column to hide the options column. The popup narrows to focus on the duplicate tabs list. Click the chevron again to restore the options column. The state is saved and restored the next time the popup is opened.

* **Shrunk mode:** toggle the compress icon in the popup to hide all unpinned sections, keeping the panel compact. Sections can be pinned with the pin icon (📌) in the popup panel so they stay visible when shrunk mode is active.

* **Pause monitoring:** click the pause icon in the popup or options page header to temporarily stop duplicate tab detection. While paused:
  * The extension icon badge shows "⏸" on a grey background
  * The pause button turns amber so the paused state is always visible
  * The mode is automatically set to "Do nothing"
  * The "On duplicate tab detected" setting is disabled
  * No new duplicate tabs are detected or closed
  * Click the play icon or use the keyboard shortcut to resume

* **Popup visibility (eye icon):** in the Options page, each option in the **Matching Rules** section has an eye icon (👁). Enabling it makes the option visible in the popup panel; disabling it hides it.

| Matching Rules option | Visible in popup by default |
| --- | --- |
| Ignore case in URL | No |
| Ignore 'www' in URL domain name | No |
| Ignore hash part in URL | No |
| Ignore query parameters in URL (search part) | No |
| Ignore path part in URL | Yes |
| Detect duplicates by | Yes |
| URL pattern rules | Yes |
| Title pattern rules | No |

### Hotkeys

No default keyboard shortcuts are set to avoid conflicts with browser built-ins.
You can assign custom shortcuts in your browser settings:

| Command | Description |
| --- | --- |
| Close all duplicate tabs | Closes all currently detected duplicate tabs |
| Toggle auto-close / manual mode | Switches between auto-close and manual mode |
| Pause or resume duplicate tab monitoring | Temporarily stops and restarts detection |

To configure shortcuts:

* **Chrome / Edge / Brave / Vivaldi:** open `chrome://extensions/shortcuts`
* **Opera:** open `opera://extensions/shortcuts`
* **Firefox:** open `about:addons`, click the gear icon, then choose *Manage Extension Shortcuts*

## Building

A build script is included that packages the extension for each browser.

**Requirements:** Windows with PowerShell (built-in on Windows 7 and later).

Run from the repository root:

```bat
build\build.bat
```

Or run the PowerShell script directly:

```powershell
# Build both Chrome and Firefox packages (default)
powershell -ExecutionPolicy Bypass -File build\build.ps1

# Build Chrome only
powershell -ExecutionPolicy Bypass -File build\build.ps1 -Target chrome

# Build Firefox only
powershell -ExecutionPolicy Bypass -File build\build.ps1 -Target firefox
```

**Output files** (created in the repository root):

| File | Browser |
| --- | --- |
| `duplicate-tabs-closer-chrome.zip` | Chrome, Edge, Opera, Vivaldi, Brave |
| `duplicate-tabs-closer-firefox.xpi` | Firefox |
