param([ValidateSet('all','chromium','firefox')][string]$Target = 'all')
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$targets = if ($Target -eq 'all') { @('chromium', 'firefox') } else { @($Target) }
foreach ($browser in $targets) {
    $out = Join-Path $root "dist/$browser"
    New-Item -ItemType Directory -Force -Path $out | Out-Null
    Copy-Item -LiteralPath (Join-Path $root "manifest.$browser.json") -Destination (Join-Path $out 'manifest.json')
    foreach ($file in @('background.js', 'content.js', 'content.css', 'color-picker.js', 'color-picker.css', 'options.html', 'options.js', 'options.css', 'popup.html', 'popup.js')) {
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
    Write-Output $out
}
