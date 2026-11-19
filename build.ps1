param(
    [ValidateSet('all','chromium','firefox')][string]$Target = 'all',
    [switch]$FirefoxSelfDistributed
)
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$targets = if ($Target -eq 'all') { @('chromium', 'firefox') } else { @($Target) }
foreach ($browser in $targets) {
    $selfDistributed = $browser -eq 'firefox' -and $FirefoxSelfDistributed
    $directory = if ($selfDistributed) { 'firefox-self' } else { $browser }
    $out = Join-Path $root "dist/$directory"
    New-Item -ItemType Directory -Force -Path $out | Out-Null
    $sourceManifest = Join-Path $root "manifest.$browser.json"
    $builtManifest = Join-Path $out 'manifest.json'
    if ($selfDistributed) {
        $manifest = Get-Content -LiteralPath $sourceManifest -Raw | ConvertFrom-Json
        $manifest.browser_specific_settings.gecko | Add-Member -NotePropertyName 'update_url' -NotePropertyValue 'https://raw.githubusercontent.com/BetterGith/BetterGitHub/main/updates.json'
        [IO.File]::WriteAllText($builtManifest, ($manifest | ConvertTo-Json -Depth 16), [Text.UTF8Encoding]::new($false))
    } else {
        Copy-Item -LiteralPath $sourceManifest -Destination $builtManifest
    }
    Copy-Item -LiteralPath (Join-Path $root '_locales') -Destination $out -Recurse -Force -ErrorAction Stop
    foreach ($file in @('background.js', 'content.js', 'command-core.js', 'plugin-settings.js', 'navigation.js', 'navigation.css', 'ui-font.css', 'content.css', 'compact-sidebar.css', 'color-picker.js', 'color-picker.css', 'options.html', 'options.js', 'options.css', 'popup.html', 'popup.css', 'popup.js')) {
        Copy-Item -LiteralPath (Join-Path $root $file) -Destination (Join-Path $out $file)
    }
    $iconsOut = Join-Path $out 'icons'
    New-Item -ItemType Directory -Force -Path $iconsOut | Out-Null
    Get-ChildItem -LiteralPath (Join-Path $root 'icons') -Filter '*.png' | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $iconsOut $_.Name)
    }
    $fontsOut = Join-Path $out 'fonts'
    New-Item -ItemType Directory -Force -Path $fontsOut | Out-Null
    Get-ChildItem -LiteralPath (Join-Path $root 'fonts') -File | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $fontsOut $_.Name)
    }
    $previewsOut = Join-Path $out 'previews'
    New-Item -ItemType Directory -Force -Path $previewsOut | Out-Null
    Get-ChildItem -LiteralPath (Join-Path $root 'previews') -Filter '*.png' -File | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $previewsOut $_.Name)
    }
    # Keep options/popup HTML paired with its current assets, even when the extension version is unchanged during development.
    foreach ($page in @('options.html', 'popup.html')) {
        $pagePath = Join-Path $out $page
        $html = [IO.File]::ReadAllText($pagePath)
        $html = [regex]::Replace($html, '(?<attribute>href|src)="(?<asset>[a-zA-Z0-9_./-]+\.(?:css|js))"', {
            param($match)
            $asset = $match.Groups['asset'].Value
            $revision = (Get-FileHash -LiteralPath (Join-Path $out $asset) -Algorithm SHA256).Hash.Substring(0, 12).ToLowerInvariant()
            return $match.Groups['attribute'].Value + '="' + $asset + '?v=' + $revision + '"'
        })
        [IO.File]::WriteAllText($pagePath, $html, [Text.UTF8Encoding]::new($false))
    }
    Write-Output $out
}
