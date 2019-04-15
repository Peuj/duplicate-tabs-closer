"use strict";

/* exported isBlankUrl */
const isBlankUrl = (url) => {
	return url === "about:blank";
};

const isValidUrl = (url) => {
	const regex = /^(f|ht)tps?:\/\//i;
	return regex.test(url);
};

/* exported areMatchingURL */
const areMatchingURL = (url1, url2) => {

	if (isValidUrl(url1) && isValidUrl(url2)) {
		url1 = getMatchingURL(url1);
		url2 = getMatchingURL(url2);
	}

	return url1 === url2;
};

/* exported getMatchingURL */
const getMatchingURL = (url) => {

	if (isValidUrl(url)) {

		if (options.ignorePathPart) {
			const uri = new URL(url);
			url = uri.origin;
		}
		else if (options.ignoreSearchPart) {
			url = url.split("?")[0];
		}
		else if (options.ignoreHashPart) {
			url = url.split("#")[0];
		}

		if (options.keepTabWithHttps) {
			url = url.replace(/^http:\/\//i, "https://");
		}

		url = url.replace(/\/$/, "");
	}

	return url;
};

/* exported getPatternUrl */
const getPatternUrl = (url) => {

	if (!isValidUrl(url))
		return;

	const uri = new URL(url);
	let urlPattern = "*://" + uri.hostname;

	if (options.ignorePathPart) {
		urlPattern += "/*";
	}
	else {
		urlPattern += uri.pathname;
		if (uri.search || uri.hash) {
			urlPattern += "*";
		}
	}
	return urlPattern;
};
