# Theme previews

These are real screenshots of the bundled extension applied to the public
`YarilaFox/figcraft` repository on GitHub. The same 1440×810 crop is used for all
11 themes. No repository controls or page contents are redrawn for the previews.
Optional plugins, personal palette overrides and motion are disabled for capture.

Source URL, capture time and filenames are recorded in `captures.json`.
The repository name, avatar and GitHub interface belong to their respective owners;
these images demonstrate BetterGitHub's appearance on that public page.

To refresh after changing themes, build the extension first and run:

```powershell
powershell -NoProfile -File build.ps1 -Target chromium
node tools/capture-theme-previews.mjs
powershell -NoProfile -File build.ps1 -Target all
```

The capture script uses Playwright Chromium from the local cache, or the path in
`CHROMIUM_BINARY`. It opens an isolated temporary browser profile and does not use
the user's signed-in browser. Built extensions include the PNGs locally; opening
the theme catalogue does not load previews from an external website.
