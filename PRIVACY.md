# BetterGitHub Privacy Policy

Effective 19 November 2026

BetterGitHub is a browser extension for customising the appearance, layout and navigation controls of GitHub pages.

## Data and use

BetterGitHub reads the current GitHub page URL, public-facing GitHub account and repository identifiers and the parts of the page needed to apply the selected theme and layout. It uses these identifiers to look for shared appearance settings. It does not request access to Chrome’s browsing history, passwords, authentication tokens or cookies.

Your appearance preferences, recent theme choices, language, per-page settings and any appearance configuration draft you create through the extension are stored in your browser. If you choose to share your appearance, BetterGitHub can prepare a JSON draft in GitHub’s editor. GitHub receives the published configuration when you commit it there.

If you enable Repository Switcher, BetterGitHub also keeps up to 30 recently visited GitHub repository names, last-visit timestamps and available public/private labels in local extension storage. This list is not uploaded or synced. Disabling Repository Switcher stops recording, and its Clear history button removes the list. Pausing BetterGitHub also stops recording. The other navigation tools read the current page to offer relevant links and copy actions; they do not submit forms or execute copied commands automatically.

Pinned repositories (up to 50), custom command names/templates, keyboard shortcuts and the last 20 command identifiers/timestamps are also stored locally. Command history contains identifiers rather than copied text or clipboard contents. Clear recent commands and Clear repository history remove those separate histories; removing a pin or custom command removes that entry. Pausing the extension stops recording command/repository history. No list is uploaded or synced.

Custom commands only open user-configured HTTPS links or copy text. Opening a custom link can send its configured URL, including repository or page placeholders, to that destination. Opening github.dev sends the selected repository/file URL to GitHub's web editor. These navigations happen only when the user chooses the action. Custom commands do not execute JavaScript or shell commands.

## Network requests

BetterGitHub requests configuration files, repository information and configured image assets from GitHub and its content domains. These requests can include the account and repository identifiers needed to locate those resources. GitHub handles its service traffic under the [GitHub Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement). BetterGitHub does not operate a server that receives this data.

## Limited use and deletion

BetterGitHub uses data for the customisation and navigation features described above. It does not sell data or use it for advertising, analytics or credit decisions. BetterGitHub’s use and transfer of information received from Google APIs, if any, will adhere to the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq), including its Limited Use requirements.

You can remove per-page settings with the extension’s reset control. Uninstall the extension to clear its browser-local extension data. To remove a configuration you committed to GitHub, manage that file in your GitHub repository.

## Contact

For questions about this policy, use the [BetterGitHub issue tracker](https://github.com/BetterGith/BetterGitHub/issues). Avoid posting private information there.
