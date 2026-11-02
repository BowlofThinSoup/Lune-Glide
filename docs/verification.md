# Verification — 2026-10-24

## 0.1.1 follow-up — 2026-10-25

- Added shared original cursor-trail icon; visually inspected the 256px PNG. VSIX manifest references `extension/assets/icon.png`, and PNG dimensions are 256×256. JetBrains ZIP contains 40px light/dark SVG icons.
- Fresh `npm run typecheck`, `npm test` (13/13), local Chrome Playwright tests (9/9), and `npm run package` passed. Final VSIX is 12 files, 47.05 KB; test/benchmark code excluded.
- Packaging initially rejected relative README image/links because no public repository URL exists; removed the README image embed and described source documentation paths as text. The extension's actual manifest icon remains included.
- Added reproducible performance scripts and [scoped performance report](performance/README.md). Final browser run used sequential execution after IDEA completed. All 24 samples passed canvas/animation activation assertions. Added those assertions to future benchmark runs after independent review identified a potential false-pass path.
- Actual IDEA core build/tests (6/6), isolated integration smoke, and headless performance starter passed. GUI performance remains unavailable because the isolated profile stopped at license initialization; no claim of measured full IDE CPU/RSS.
- Packaged releases only; this follow-up did not update daily installed plugins/profiles.

## Final checks

- `npm run typecheck`: passed (TypeScript 5.9.3).
- `npm test`: 13/13 passed, including analytic spring reference, 60/120Hz equivalence, short movement, reversal, scroll translation, config sanitization, real-filesystem install/remove/idempotency, update handling, conflicts and symlinks.
- `CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npx playwright test`: 9/9 passed. Actual Canvas pixel output, native cursor restoration, idle frame count, DOM composition, EditContext composition, detached editors, reinjection/disposal, reduced motion, multiple cursors, full Monaco class replacement and original VS Code CSP.
- `npm run package`: passed, VSIX contains 10 files (~20.53 KB compressed), no third-party runtime packages.
- Archive inspected with `unzip -l`; extension entry, renderer, installer, recovery command, manifest, README and licenses present.

## Actual VS Code integration

macOS arm64; installed VS Code 1.143.0; isolated temporary user profile and extensions directory. `scripts/test-vscode-live.mjs` launched the unchanged application, activated the development extension and injected the built renderer into that disposable window's renderer process only.

Observed actual Monaco keyboard cursor movement and `neovide-cursor-owned` activation, frame updates, settled idle state and complete overlay disposal. The input host was `div.native-edit-context`; native smooth-caret was enabled, exercising our transition suppression. No renderer page errors were observed. Extension-host log explicitly recorded activation of `lune.neovide-cursor` via `onStartupFinished`. The regular installation and regular user profile were not patched.

Integration screenshots are retained locally and excluded from the public repository.

A prior attempt to launch a patched copy of the app was rejected by macOS protection; no protection was disabled. The later everyday-installation check below successfully enabled injection through the extension and reloaded the existing window; a complete application quit/relaunch was not tested.

## Everyday local installation

At the user's request, enabled the already installed `lune.neovide-cursor@0.1.0` in `/Applications/Visual Studio Code.app` using **Neovide Cursor: Enable**, then **Reload Window**. Recovery status reports `installed`; installed renderer SHA-256 matches the project bundle (`d283496b8cede80a8f0b3288e584be6eb65044498dca74893697d2e31cc9c0c2`).

After reload, inspected DevTools Elements without executing diagnostic scripts: the workbench contains `neovide-cursor.runtime.js`, `style#neovide-cursor-style`, and an actual `canvas.neovide-cursor-canvas` under the `motion.ts` editor. The canvas was sized to 466×1422 pixels for a 233×711 CSS-pixel editor. This confirms persistent renderer startup and editor attachment. Direction-key movement and end-of-line navigation worked. Frame timing and idle-frame counts in this everyday window were not measured; those checks passed in the isolated integration above. Console paste protection was left enabled.

Runtime DOM and enabled-editor screenshots are retained locally and excluded from the public repository. DevTools was closed and the extension left enabled. An accidental newline while opening the test file was immediately undone; the original Java editor returned to its clean state.

VS Code displays its expected installation-integrity warning because workbench HTML was modified. Checksums, CSP, workspace trust and OS protections were not bypassed. To restore the workbench, run **Neovide Cursor: Disable**, then reload all windows before uninstalling the extension.

## Review

Independent read-only review checked source, tests and actual installed Monaco code. Two P2 findings were reproduced and fixed:

1. Monaco replaces cursor-layer className: use a dedicated `data-neovide-cursor-tracked` attribute for transition suppression.
2. EditContext composition events do not bubble through DOM: bind to the focused host's EditContext and remove listeners on focus changes/disposal.

Both have failing-before / passing-after regression evidence. An underline-height concern was disproved by actual Monaco code, which already adjusts cursor box geometry.

## Known limits

- Real Chinese IME candidate windows, complex ligatures, 120Hz hardware, Windows/Linux, remote desktops and every VS Code version were not exhaustively tested. 60/120Hz verification is numerical, not a hardware benchmark.
- Moving block text is drawn from Monaco's available cursor glyph. If absent, translucent fill preserves readability; settled glyphs and blinking use the native cursor. Not a pixel-exact Skia reproduction.
- Optional railgun particles are an approximation; default off.
- Installer status verifies disk assets, not a runtime handshake from every window.
- Upstream dev tooling emits Node 26 deprecation and FORCE_COLOR warnings; tests pass. VS Code startup emits unrelated bundled Copilot API-proposal warnings; no activation error for this extension.
- Users must disable injection before uninstalling the extension and reload all windows. Application-file write permissions remain an installation requirement.
