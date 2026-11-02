# Lune Glide 0.1.3

Neovide-inspired spring cursor animation for VS Code and IntelliJ IDEA.

## Changes

- Unified plugin, settings, and command display names as **Lune Glide**, with an original mint cursor-trail icon.
- Included the IDEA caret-size fix so animated height, vertical position, and zoom-scaled width match the native caret.
- Preserved existing plugin identities and settings for upgrades.
- Simplified both READMEs and added privacy and recovery documentation.

## Downloads

| Asset | Installation |
| --- | --- |
| `lune-glide-vscode-0.1.3.vsix` | VS Code: **Install from VSIX…**, then **Lune Glide: Enable** and reload. |
| `lune-glide-jetbrains-0.1.3.zip` | IDEA: **Settings → Plugins → Install Plugin from Disk…**, then restart if prompted. |
| `SHA256SUMS.txt` | SHA-256 checksums for both installation packages. |

IDEA settings are under **Editor → Lune Glide**. Restart after upgrading if an older session still shows **Neovide Cursor**.

## Compatibility and validation

- IDEA support is limited to **2026.2.x / build 262.***. Built and tested against **2026.2.3 / 262.10968.63**.
- JetBrains Plugin Verifier **1.411** reports **Compatible** against that build, with **5 internal API usages and 2 experimental API usages**. These may change in future IDE versions; this is not a clean API-usage report or a Marketplace approval.
- VS Code baseline tested: **1.143.0 on macOS**. Other versions and operating systems have not completed full device testing.
- Local automated checks: 13 VS Code unit tests and 6 IDEA core tests passed. Browser and IDEA integration checks are documented in the repository verification reports.

The VS Code edition uses reversible workbench injection and may trigger an installation-integrity notice. After a VS Code update, run **Repair After VS Code Update**. **Before uninstalling, run Disable (Restore Native Cursor) and reload all windows.** See [usage and recovery](https://github.com/BowlofThinSoup/Lune-Glide/blob/main/docs/usage.md).

GitHub availability does not imply Marketplace approval. The initial Marketplace submissions require developer profiles and review.

MIT licensed. Source attribution is included in both installation packages. See [privacy](https://github.com/BowlofThinSoup/Lune-Glide/blob/main/PRIVACY.md).
