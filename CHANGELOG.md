# Changelog

## 0.1.3 — 2026-11-02

First public release of **Lune Glide**, formerly Neovide Cursor.

- Unified the VS Code and IntelliJ IDEA plugin names, settings labels, commands, and original cursor-trail icons.
- Preserved plugin IDs, command IDs, and configuration keys so existing installations keep their settings.
- Included the IDEA native-caret geometry fix: animated height, vertical offset, and zoom-scaled bar width match the resting caret.
- Added public source, support, and license links.

### Installation

- **VS Code:** install `lune-glide-vscode-0.1.3.vsix`, run **Lune Glide: Enable**, and reload the window. This experimental desktop extension uses reversible workbench injection. Run **Disable (Restore Native Cursor)** before uninstalling. Tested baseline: VS Code 1.143.0 on macOS; other versions and operating systems are not fully validated.
- **IntelliJ IDEA 2026.2.x:** use **Settings → Plugins → Install Plugin from Disk…** with `lune-glide-jetbrains-0.1.3.zip`, then restart IDEA if requested. Configure **Settings → Editor → Lune Glide**. Compatibility is limited to build 262.*.

If IDEA still displays **Neovide Cursor**, check the installed version and restart after upgrading. The old internal ID `dev.lune.neovide-cursor` and installation directory are retained for upgrade compatibility; they are not the display name.

This release provides Neovide-inspired four-corner spring motion, not pixel-identical reproduction of every Neovide effect. Marketplace availability is separate from GitHub Release availability.
