# BetterGitHub UI work

- Read the applicable `chrome-extensions` and `modern-web-guidance` skills. State which skills shaped the change; do not claim a skill was used without reading it.
- Treat reference screenshots and marked boundaries as acceptance criteria. Preserve separate plugin toggles, icon-only settings, readable theme authors, and real theme previews.
- Keep card headers, independent controls, and SVG icons in static HTML. JavaScript binds behavior and updates state; it must not reconstruct the header on load or translation.
- Verify the built extension in Chromium and Firefox. Inspect screenshots at wide, medium, and narrow widths, including the extension's actual options page. Check icon visibility, aligned controls, image bounds, text hierarchy, and overflow.
- Compare source files to the exact build being tested. Report which build was verified. Never call a source-only or stale build check live validation of the user's browser.
- Before declaring a visual fix complete, open the resulting screenshots and correct visible problems. Include a local preview link when reporting a visual change.
- Preserve unrelated working changes. Do not publish a PR, merge, or release without the user's authorization.
