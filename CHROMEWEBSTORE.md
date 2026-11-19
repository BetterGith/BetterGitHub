# Chrome Web Store Listing — BetterGitHub

Last updated: 2026-11-19. Local working copy; nothing submitted by this change.

## Store listing

**Name:** BetterGitHub (matches the English manifest locale).

**Short description:** Personal themes and layout options for GitHub repositories, profiles, and organisations.

**Detailed description draft:**

Personalise GitHub with themes, compact layouts and optional navigation tools.

Choose your own theme or allow the page author's published appearance. Configure repository and profile layouts, select light or dark palettes, and optionally dim bright backgrounds. Settings save automatically. Pause the extension from its popup to restore GitHub's appearance.

Enable Command Palette, Quick Navigation, Repository Switcher and Quick Actions separately in Plugins. Each tool has its own button and shortcut. Search commands, jump to page sections, revisit repositories and copy useful links or commands. These tools do not automatically submit issues, pull requests or commits.

Repository Switcher keeps up to 30 recent GitHub repositories locally. Its history can be cleared in its window. No analytics or developer-operated service is used. Loading an author's published appearance requests that repository's public configuration from GitHub.

**Category suggestion:** Developer Tools. **Primary language:** English.

**Single purpose:** Personalise GitHub's appearance and the navigation controls used to browse it.

## Graphics and assets

- Manifest icons: `icons/icon-16.png`, `icons/icon-48.png`, `icons/icon-128.png`.
- Refresh store screenshots before the next submission: current theme catalogue, six independent plugin switches, and individual navigation tools on GitHub. Use 1280×800 or 640×400 captures.
- Current plugin catalogue uses four columns on wide screens, two on medium screens and one on narrow screens. Popup theme names share a baseline; the selected preview is marked without a label pill. Include these fixes in refreshed captures.
- Compact UI sidebar separators and spacing are overridden independently of toolbar readiness and late GitHub utility layers, in both light and dark variants. The override excludes README content.
- Firefox injects only the scoped compact sidebar overrides as a user stylesheet; Chromium loads the same bundled file normally. Host access and permissions are unchanged.
- Theme cards, the recommended theme and recent-theme popup now use bundled screenshots of all 11 themes on the same public FigCraft page. Refresh listing captures to show the real previews instead of schematic bars. Preview images load locally and add no network access.
- Catalogue refinements: shorter recommendation banner with a cropped screenshot, rectangular tone filters, refreshed section icons, visible theme authors, local plugin search and icon-only Configure buttons beside plugin switches. The green hover/selection treatment is on theme cards and enabled plugin cards; the profile editor button uses the normal GitHub hover treatment.
- Existing store artwork and currently published metadata have not been verified against the dashboards in this change.

## Permissions justification

| Permission | Type | Reason |
|---|---|---|
| `storage` | permissions | Save theme preferences, plugin switches, local page layouts and optional recent-repository history. Keep temporary editor drafts until the user handles them. |
| `https://github.com/*` | host_permissions | Apply the selected appearance and optional navigation tools to GitHub. Inspect native page sections and repository links. Determine a repository's default branch when preparing its appearance editor. |
| `https://api.github.com/*` | host_permissions | Read repository metadata to determine the default branch and locate the public appearance configuration when preparing the editor. |
| `https://raw.githubusercontent.com/*` | host_permissions | Read the author's public `bettergithub.json` or `.bettergithub.json` and referenced GitHub assets. |

Content scripts run only on `https://github.com/*`. New navigation tools add no permissions. Only bundled scripts run; appearance files cannot supply executable CSS or JavaScript.

## Privacy and data use

- Locally stored preferences: selected theme, palette, language, plugin switches, recent themes, page-specific appearance and layout.
- With Repository Switcher enabled, local browsing history: up to 30 GitHub `owner/repo` names, last-visit times and available private/public labels. This history is not uploaded or synced. Disabling the plugin stops recording; Clear history deletes it. Full extension pause also stops recording.
- GitHub requests: repository owner/name and configuration/asset paths are sent to GitHub to load public page appearance or prepare an editor. GitHub receives normal request/network metadata. Public configuration requests omit credentials. The optional repository-history list itself is never sent.
- Publishing: only the selected page's appearance is prepared in GitHub's editor. The user reviews and commits it. Personal repository history is not exported with the appearance.
- Temporary editor drafts are stored in session storage; drafts expire after 20 minutes and are removed when their tab closes. Local preferences and history remain until cleared or extension data is removed.
- No analytics, advertising, data sale or developer-operated collection endpoint appears in the current source. No passwords, access tokens or private messages are requested by these tools.

Store disclosures must distinguish local history from the repository identifiers sent to GitHub for public configuration requests. Review the existing privacy policy and its live URL before the next submission; neither a policy URL nor developer contact was verified here. GitHub's own privacy policy applies to GitHub requests.

## Distribution and developer information

- Current manifest/package version: 0.3.0. The new local changes need an explicitly chosen next version before another store submission.
- Publisher, contact email, distribution regions, live privacy-policy URL and store IDs: use the existing developer dashboard values; not inferred here.
- Project support: https://github.com/BetterGith/BetterGitHub/issues
- Project homepage: https://github.com/BetterGith/BetterGitHub

## Version history

GitHub release v0.3.0 was published on 2026-11-19 at commit `9767c3f`; the command-hub changes below are subsequent development and are not included in those release archives.

Unreleased command-hub update: a shared registry for bundled plugin commands, local custom HTTPS/copy commands, configurable shortcuts, last 20 command identifiers, 50 local pinned repositories grouped by owner, Page Navigator for headings/comments/diffs, context-aware Quick Actions and individual Configure buttons. No additional manifest permissions. Custom HTTPS links and github.dev open only on user selection; disclose that user-selected URL templates can include the current repository/page. Command history never stores clipboard contents. Update privacy disclosures and screenshots before the next store submission.

| Version | Date | Changes | Status |
|---|---|---|---|
| Unreleased, version not assigned | 2026-11-19 | Compact layouts, autosave, independent Command Palette, Quick Navigation, Repository Switcher and Quick Actions; Plugins deep link and local-history controls | Local draft |

## Review notes

Build with `powershell -NoProfile -File build.ps1 -Target chromium`. Package only the contents of `dist/chromium`; exclude this file, tests, dependencies, `.git` and local results. Firefox uses its own MV3 background-page declaration, not the Chromium service-worker declaration.

To review the four new tools, enable them separately in Plugins. They are off by default. Test the toolbar buttons, keyboard controls, clear-history action and full extension pause. Repository/issue actions open GitHub forms or copy text; users complete any subsequent operation themselves.
