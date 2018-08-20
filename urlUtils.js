"use strict";

/* exported isBlankUrl */
const isBlankUrl = (url) => {
	return url === "about:blank";
};

const isValidUrl = (url) => {
	const regex  = /^(f|ht)tps?:\/\//i;
	return regex.test(url);
};

/* exported areMatchingURL */
const areMatchingURL = (url1, url2) => {

	if (isValidUrl(url1) && isValidUrl(url2)) {

		if (options.ignorePathPart) {
			const uri1 = new URL(url1);
			url1 =  uri1.origin;
			const uri2 = new URL(url2);
			url2 =  uri2.origin;
		}
		else {
			if (options.ignoreHashPart) {
				url1 = url1.split("#")[0];
				url2 = url2.split("#")[0];
			}
			if (options.ignoreSearchPart) {
				url1 = url1.split("?")[0];
				url2 = url2.split("?")[0];
			}
		}

		if (options.keepTabWithHttps) {
			url1 = url1.replace(/^https:\/\//i, "http://");
			url2 = url2.replace(/^https:\/\//i, "http://");
		}

		url1 = url1.toUpperCase().replace(/\/$/, "");
		url2 = url2.toUpperCase().replace(/\/$/, "");
	}

	return url1 === url2;
};

/* exported matchingURL */
const matchingURL = (url) => {

	if (isValidUrl(url)) {

		if (options.ignorePathPart) {
			const uri = new URL(url);
			url =  uri.origin;
		}
		else {
			if (options.ignoreHashPart) {
				url = url.split("#")[0];
			}
			if (options.ignoreSearchPart) {
				url = url.split("?")[0];
			}
		}
		
		if (options.keepTabWithHttps) {
			url = url.replace(/^https:\/\//i, "http://");
		}

		url = url.toUpperCase().replace(/\/$/, "");
	}

	return url;
};
