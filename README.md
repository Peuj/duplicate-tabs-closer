# Duplicate Tabs Closer


Duplicate Tabs Closer detects and closes duplicate tabs.

* Use the WebExtensions API
* Support [Firefox](https://addons.mozilla.org/en-US/firefox/addon/duplicate-tabs-closer) and [Chrome](https://chrome.google.com/webstore/detail/duplicate-tabs-closer/gnmdbogfankgjepgglmmfmbnimcmcjle)
* Firefox Container Tab feature is supported.

## Options:

### On duplicate tab detected:

* **Close tab automatically**: automatically closes the detected duplicate tab.
* **Do nothing**: monitor tabs and update the badge icon to indicate the number of duplicate tabs detected.

#### On remaining tab:
(Used with option *Close tab automatically*)
* **Do nothing** *(default)*: nothing is done after the duplicate tab is closed.
* **Activate**: once the duplicate tab is closed, the remaining tab is activated.
* **Apply opening tab behavior**: once the duplicate tab is closed, depending on the default tab behavior, the remaining tab will be moved to the position of the closed tab and activated if needed.

#### Whiltelist":
(Used with option *Close tab automatically*)
List of urls to not close automatically. Duplicate tabs skipped will be notified in badge.
Wildcards and RegExp are supported.


### Priority:
(Used with option *Close tab automatically* and *Close all duplicate tabs* button)
* **Keep older tab** *(default)*: Keep the already existing tab.
* **Keep newer tab**: Keep the newer tab.
* **Keep tab with https** *(default on)*: Ignore the scheme part during comparison and keep the tab with the https scheme.
* **Keep pinned tab** *(default on)*: Keep the pinned tab.


### matchingRules:

* **Ignore case in URL** *(default off)*
* **Ignore 'www' in URL domain name** *(default off)*
* **Ignore hash part in URL** *(default off)*
* **Ignore search part in URL** *(default off)*
* **Ignore path part in URL** *(default off)*
* **Compare with tab title** *(default off)*


### Scope:

* **Container in active window<**: only closes/displays duplicate tabs that belong to a same container in the active window.
* **Container in all windows**: only closes/displays duplicate tabs that belong to a same container in all windows.
* **Active window** *(default)*: only closes/displays duplicate tabs that belong to a same window.
* **All window**: closes/displays duplicate tabs for all windows.


### Customization:
(only accessible from the *page Options* - opened from extension popup panel by clicking on top right icon or by opening the Extensions panel and select extension's options )

* **Duplicate tabs badge color**: Set the badge color for duplicate tabs
* **No duplicate tab badge color**: Set the badge color for no duplicate tabs
* **Show badge if no duplicate tab**: Show badge with value `0` if no duplicate tab


### Hotkey:

* **Alt+Shift+W** to close all duplicate tabs (this could be configured in the options in future version)

## Installing from Source in Firefox

To install this add-on from source in Firefox, follow these steps:

1.  **Download the Source Code:**
    *   Clone the repository or download the source code ZIP file from the repository page and extract it to a local directory.

2.  **Copy appropriate manifest:**
    *   Copy either manifest to manifest.json using the cp command.
    *   For **Firefox**:
        ```sh
        cp manifest-f.json manifest.json
        ```
    *   For **Chrome**:
        ```sh
        cp manifest-c.json manifest.json
        ```

2.  **Open Firefox and Navigate to `about:debugging`:**
    *   Type `about:debugging` into the Firefox address bar and press Enter.

3.  **Enable Add-on Debugging:**
    *   Click on "This Firefox" (or "This Nightly", "This Developer Edition" depending on your Firefox version).

4.  **Load Temporary Add-on:**
    *   Click the "Load Temporary Add-on…" button.
    *   Navigate to the directory where you extracted the add-on's source code.
    *   Select the `manifest.json` file.
    *   Click "Open".

5.  **The add-on is now installed temporarily.** It will remain installed until you remove it or restart Firefox. If you make changes to the add-on's code, you'll need to click the "Reload" button for the add-on in `about:debugging` to apply the changes.
