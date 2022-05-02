"use strict";

// eslint-disable-next-line no-unused-vars
const isBlankURL = (url) => url === "about:blank";

// eslint-disable-next-line no-unused-vars
const isChromeURL = (url) => url.startsWith("chrome://") || url.startsWith("view-source:chrome-search");

const isBrowserURL = (url) => url.startsWith("about:") || url.startsWith("chrome://");

const isValidURL = (url) => {
	const regex = /^(f|ht)tps?:\/\//i;
	return regex.test(url);
};

// eslint-disable-next-line no-unused-vars
const isHttps = (url) => {
	const regex = /^https:\/\//i;
	return regex.test(url);
};

// eslint-disable-next-line no-unused-vars
const getMatchingURL = (url) => {	
	if (!isValidURL(url)) return url;
	let matchingURL = url;
	if (options.ignorePathPart) {
		const uri = new URL(matchingURL);
		matchingURL = uri.origin;
	}
	else if (options.ignoreSearchPart) {
		matchingURL = matchingURL.split("?")[0];
	}
	else if (options.ignoreHashPart) {
		matchingURL = matchingURL.split("#")[0];
	}
	if (options.keepTabWithHttps) {
		matchingURL = matchingURL.replace(/^http:\/\//i, "https://");
	}
	if (options.ignore3w) {
		matchingURL = matchingURL.replace("://www.", "://");
	}
	if (options.caseInsensitive) {
		matchingURL = matchingURL.toLowerCase();
	}
	matchingURL = matchingURL.replace(/\/$/, "");
	return matchingURL;
};

// eslint-disable-next-line no-unused-vars
const getMatchPatternURL = (url) => {
	let urlPattern = null;
	if (isValidURL(url)) {
		const uri = new URL(url);
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