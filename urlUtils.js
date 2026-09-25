"use strict";

const isBlankURL = (url) => url === "about:blank" || url === "about:newtab" || url === "about:home" || url === "chrome://newtab/";

const isChromeURL = (url) => url.startsWith("chrome://") || url.startsWith("chrome-extension://") || url.startsWith("edge://") || url.startsWith("opera://") || url.startsWith("vivaldi://") || url.startsWith("brave://") || url.startsWith("view-source:chrome-search");

const isBrowserURL = (url) => url.startsWith("about:") || url.startsWith("chrome://") || url.startsWith("edge://") || url.startsWith("opera://") || url.startsWith("vivaldi://") || url.startsWith("brave://");

const _VALID_URL_RE = /^((f|ht)tps?|file):\/\//i;
const _HTTPS_RE = /^https:\/\//i;

const isValidURL = (url) => _VALID_URL_RE.test(url);

const isHttps = (url) => _HTTPS_RE.test(url);

const getMatchingURL = (url) => {	
	if (!isValidURL(url)) return url;
	let matchingURL = url;
	if (options.ignorePathPart) {
		const uri = new URL(matchingURL);
		if (uri.protocol !== "file:") matchingURL = uri.origin;
	} else {
		if (options.ignoreSearchPart) {
			matchingURL = matchingURL.split("?")[0];
		}
		if (options.ignoreHashPart) {
			matchingURL = matchingURL.split("#")[0];
		}
	}
	if (options.keepTabWithHttps) {
		matchingURL = matchingURL.replace(/^http:\/\//i, "https://");
	}
	if (options.ignore3w) {
		matchingURL = matchingURL.replace(/(:\/\/)www\./i, "$1");
	}
	if (options.caseInsensitive) {
		matchingURL = matchingURL.toLowerCase();
	}
	matchingURL = matchingURL.replace(/\/$/, "");
	return matchingURL;
};

const getMatchPatternURL = (url) => {
	let urlPattern = null;
	if (isValidURL(url)) {
		const uri = new URL(url);
		if (uri.protocol === "file:") return null;
		urlPattern = `*://${uri.hostname}`;
		if (options.ignorePathPart) {
			urlPattern += "/*";
		}
		else {
			urlPattern += uri.pathname;
			if (uri.search || uri.hash) {
				urlPattern += "*";
			}
		}
	}
	else if (isBrowserURL(url)) {
		urlPattern = `${url}*`;
	}

	return urlPattern;
};