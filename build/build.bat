@ECHO OFF


SET FIREFOX_PACKAGE=duplicate-tabs-closer-firefox.zip
SET CHROME_PACKAGE=duplicate-tabs-closer-chrome.zip
SET FIREFOX_MANIFEST=manifest-f.json
SET CHROME_MANIFEST=manifest-c.json

CD ..

IF NOT EXIST %FIREFOX_MANIFEST% (
	ECHO ERROR: Missing file %FIREFOX_MANIFEST%
	GOTO :END
)

IF NOT EXIST %CHROME_MANIFEST% (
	ECHO ERROR: Missing file %CHROME_MANIFEST%
	GOTO :END
)

IF EXIST manifest.json ren manifest.json manifest.json-bkpbuild

IF EXIST %FIREFOX_PACKAGE% del %FIREFOX_PACKAGE%
COPY %FIREFOX_MANIFEST% manifest.json
"C:\Program Files\7-Zip\7z.exe" a -tzip %FIREFOX_PACKAGE% @build/list.txt


IF EXIST manifest.json del manifest.json

IF EXIST %CHROME_PACKAGE% del %CHROME_PACKAGE%
COPY %CHROME_MANIFEST% manifest.json
"C:\Program Files\7-Zip\7z.exe" a -tzip %CHROME_PACKAGE% @build/list.txt

:END

PAUSE