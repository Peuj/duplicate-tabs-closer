# Duplicate Tabs Closer


Duplicate Tabs Closer detects and closes duplicate tabs.

* Use the WebExtensions API
* Support [Firefox](https://addons.mozilla.org/en-US/firefox/addon/duplicate-tabs-closer) and [Chrome](https://chrome.google.com/webstore/detail/duplicate-tabs-closer/gnmdbogfankgjepgglmmfmbnimcmcjle)
* Firefox Container Tab feature is supported.

## Options:

### On duplicate tab detected:

* **Close tab automatically**: automatically closes the detected duplicate tab.
* **Do nothing**: monitor tabs and update the badge icon to indicate the number of duplicate tabs detected.

### On remaining tab:
(used with option *Close tab automatically*):


* **Do nothing** *(default)*: nothing is done after the duplicate tab is closed.
* **Activate**: once the duplicate tab is closed, the remaining tab is activated.
* **Apply opening tab behavior**: once the duplicate tab is closed, depending on the default tab behavior, the remaining tab will be moved to the position of the closed tab and activated if needed.


### Priority:
(used with option *Close tab automatically* and *Close all duplicate tabs* button)

* **Keep older tab** *(default)*: Keep the already existing tab.
* **Keep newer tab**: Keep the newer tab.
* **Keep tab with https** *(default on)*: Ignore the scheme part during comparison and keep the tab with the https scheme.
* **Keep pinned tab** *(default on)*: Keep the pinned tab.


### Filters:

* **Ignore hash part in URL** *(default off)*: for instance https://addons.mozilla.org/en-US/firefox/addon/duplicate-tabs-closer/#detail-relnotes and https://addons.mozilla.org/en-US/firefox/addon/duplicate-tabs-closer will be considered as the same URL.
* **Ignore search part in URL** *(default off)*: for instance https://addons.mozilla.org/en-US/firefox/addon/duplicate-tabs-closer/?src=ss and https://addons.mozilla.org/en-US/firefox/addon/duplicate-tabs-closer will be considered as the same URL.
* **Ignore path part in URL** *(default off)*: for instance https://addons.mozilla.org/en-US/developers and https://addons.mozilla.org/en-US/firefox/addon/duplicate-tabs-closer will be considered as the same URL.
* **Compare with tab title** *(default off)*: If the URL doesn't match then compare using the tab title.


### Scope:

* **Container**: only closes/displays duplicate tabs that belong to a same container.
* **Active window** *(default)*: only closes/displays duplicate tabs that belong to a same window.
* **All window**: closes/displays duplicate tabs for all windows.


### Hotkey:

* **Alt+Shift+W** to close all duplicate tabs (this could be configured in the options in future version)