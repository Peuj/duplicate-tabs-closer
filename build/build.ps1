param(
    [ValidateSet("firefox", "chrome", "all")]
    [string]$Target = "all"
)

$Root = Split-Path $PSScriptRoot -Parent

$SingleFiles = @(
    "background.js",
    "badge.js",
    "helper.js",
    "panelHelper.js",
    "messageListener.js",
    "options.js",
    "tabsInfo.js",
    "tst.js",
    "urlUtils.js",
    "worker.js",
    "LICENSE",
    "README.md"
)

$Directories = @(
    "_locales",
    "images",
    "popup",
    "optionPage",
    "panel",
    "ext_lib\bootstrap-5.3.8-dist",
    "ext_lib\font-awesome-7.3.1"
)

function Build-Package {
    param([string]$ManifestSrc, [string]$OutputFile, [string[]]$StripKeys = @(), [string[]]$StripScripts = @())

    $ManifestDst = Join-Path $Root "manifest.json"
    $TempDir = Join-Path $env:TEMP "dtc-build-$(Get-Random)"
    $OutputPath = Join-Path $Root $OutputFile

    try {
        Copy-Item (Join-Path $Root $ManifestSrc) $ManifestDst
        New-Item -ItemType Directory -Path $TempDir | Out-Null

        foreach ($file in $SingleFiles) {
            $src = Join-Path $Root $file
            if (Test-Path $src) {
                Copy-Item $src (Join-Path $TempDir $file)
            } else {
                Write-Warning "Missing: $file"
            }
        }

        $manifestInTmp = Join-Path $TempDir "manifest.json"
        Copy-Item $ManifestDst $manifestInTmp
        if ($StripKeys.Count -gt 0 -or $StripScripts.Count -gt 0) {
            $json = Get-Content $manifestInTmp -Raw | ConvertFrom-Json
            foreach ($key in $StripKeys) {
                $json.PSObject.Properties.Remove($key)
            }
            if ($StripScripts.Count -gt 0 -and $json.background -and $json.background.scripts) {
                $json.background.scripts = $json.background.scripts | Where-Object { $_ -notin $StripScripts }
            }
            $json | ConvertTo-Json -Depth 10 | Set-Content $manifestInTmp -Encoding UTF8
        }

        # Patch inline importScripts() in background.js to match manifest strip
        if ($StripScripts.Count -gt 0) {
            $bgPath = Join-Path $TempDir "background.js"
            if (Test-Path $bgPath) {
                $bgContent = Get-Content $bgPath -Raw
                foreach ($script in $StripScripts) {
                    $esc = [regex]::Escape($script)
                    $bgContent = $bgContent -replace ",\s*""$esc""", ""
                    $bgContent = $bgContent -replace """$esc"",\s*", ""
                }
                Set-Content $bgPath -Value $bgContent -Encoding UTF8 -NoNewline
            }
        }

        foreach ($dir in $Directories) {
            $src = Join-Path $Root $dir
            $dst = Join-Path $TempDir $dir
            if (Test-Path $src) {
                $parent = Split-Path $dst -Parent
                if (!(Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
                Copy-Item $src $dst -Recurse
            } else {
                Write-Warning "Missing directory: $dir"
            }
        }

        if (Test-Path $OutputPath) { Remove-Item $OutputPath }
        Add-Type -AssemblyName System.IO.Compression
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $zip = [System.IO.Compression.ZipFile]::Open($OutputPath, [System.IO.Compression.ZipArchiveMode]::Create)
        try {
            Get-ChildItem $TempDir -Recurse -File | ForEach-Object {
                $entryName = $_.FullName.Substring($TempDir.Length + 1).Replace('\', '/')
                [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $entryName) | Out-Null
            }
        } finally {
            $zip.Dispose()
        }

        Write-Host "Built: $OutputPath" -ForegroundColor Green
    }
    catch {
        Write-Host "ERROR building $OutputFile`: $_" -ForegroundColor Red
        exit 1
    }
    finally {
        if (Test-Path $ManifestDst) { Remove-Item $ManifestDst }
        if (Test-Path $TempDir) { Remove-Item $TempDir -Recurse -Force }
    }
}

if ($Target -eq "firefox" -or $Target -eq "all") {
    Build-Package "manifest-f.json" "duplicate-tabs-closer-firefox.xpi" -StripScripts @("dtcLog.js", "testHooks.js")
}
if ($Target -eq "chrome" -or $Target -eq "all") {
    Build-Package "manifest-c.json" "duplicate-tabs-closer-chrome.zip" -StripKeys @("externally_connectable") -StripScripts @("testHooks.js")
}
