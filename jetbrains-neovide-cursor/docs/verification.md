# Verification — 2026-10-25

## 0.1.2 native caret size fix — 2026-11-02

User reported a short native caret becoming larger during movement and smaller again at rest. `EditorSession.rect` used the full line height and line origin, while build 262's native painter uses `EditorView.getCaretHeight()` and subtracts `getTopOverhang()` when full-line-height carets are disabled. Animation now uses the same metrics. DEFAULT BAR width also includes the native editor font scale; explicit BAR thickness semantics remain unchanged.

Failing-before evidence in an actual isolated IDEA editor at line spacing 1.8: native height 18, y=8; plugin height 33, y=0. After the height fix, the zoom regression independently failed at width 2 vs native 2.9012346267700195. After both fixes, `python3 scripts/build.py --test` (6 core tests) and `python3 scripts/smoke.py` passed. The earlier default-width test also needed its expectation corrected to include native scale (the isolated default scale is not exactly 1).

Added integration coverage for short/full-line height × DEFAULT/BAR/BLOCK/UNDERSCORE, vertical placement, geometry while native attributes are hidden, and font zoom. Expectations use the actual native view metrics, independently of plugin geometry. Independent review confirmed the contract against the installed SDK bytecode. Final ZIP 0.1.2 matches the tested class files, includes both icons, and excludes test classes.

This verifies real IDEA geometry and lifecycle in an isolated headless runtime, not final on-screen pixels. Existing rounded-corner/opacity differences and the intentional movement trail are unchanged. No daily IDE profile or installed plugin was modified; install the new ZIP through Plugins → Install Plugin from Disk and restart as requested by IDEA.

## 0.1.1 icon and performance follow-up

Fresh `build.py --test` (6 core tests), actual `smoke.py`, and headless `smoke.py --performance` succeeded. The 0.1.1 ZIP/JAR was inspected for version, both 40px `META-INF/pluginIcon.svg` / `pluginIcon_dark.svg`, and absence of test classes/starters. Original icon source is shared with VS Code.

Performance report and raw data are in [the shared report](../../docs/performance/README.md). Headless actual-editor idle timer: 0 ticks in 3 seconds; service session map empty after each of 20/40/60 editor releases. Java2D measurements are separate offscreen core costs, not window-level process usage. Isolated GUI execution stopped at license initialization and yielded no usable performance measurements.

Environment: macOS arm64, installed IntelliJ IDEA 2026.2.3 (IU-262.10968.63), bundled JBR 25.0.4, `javac --release 21`. Build is offline against the installed SDK. Compatibility is deliberately bounded to 262.*.

## Results

- `python3 scripts/build.py --test`: succeeds. Six pure tests cover analytic critically damped response, leading/trailing corners, 60/120 Hz equivalence, uninterrupted position on retarget/reversal, settling, disabled typing motion, zero duration, nonfinite settings, actual Java2D pixels and viewport clipping.
- `python3 scripts/smoke.py`: succeeds in actual IDEA via a test-only ApplicationStarter. Uses real EditorFactory, CaretModel, colors, service container and Disposer. Covers plugin loading, main-editor attachment, normal movement, multiple carets, disable/settings refresh, session disposal, preview exclusion, transparent zero-thickness hiding, restoration, preservation of another plugin's attributes, overwrite/block preference and explicit BAR thickness geometry.
- Production ZIP excludes test classes and SDK jars. `build/distributions/neovide-cursor-idea-0.1.0.zip` contains `neovide-cursor/lib/neovide-cursor.jar` with its plugin descriptor, own classes, icon and MIT notices.

## Review fixes

Independent review inspected the real build 262 bytecode. Verified that `PainterHelper` translates graphics into the registered content-component coordinates, and CaretImpl retains visual-attribute identity.

Two P2 findings were fixed with failing-before/passing-after regression tests in actual IDEA:

1. A transparent BLOCK still paints inverse text. Hide using explicit BAR with thickness 0, which skips both fill and glyph painting.
2. DEFAULT shape follows `insertMode != blockCursor`; explicit BAR width uses floored character-width × thickness with the native minimum line width. Preserve these semantics while moving.

An initially mistyped pure-test numeric fixture was corrected against a 45-digit independent Decimal calculation and the existing VS Code reference. The production spring formula was unchanged.

## Scope and limitations

The headless test invokes native attribute/geometry helpers on real editor instances but cannot exercise focused/on-screen Swing animation, glass-pane compositing over actual popups, or real IME candidate windows. Java2D pixel and clipping tests exercise the renderer separately. No claim of visual or frame-rate benchmarking in the everyday IDEA instance is made. No daily IDEA installation or profile was modified.

The test-only ApplicationStarter API emits a deprecation note; the production classes compile without that note. The isolated runtime reports the expected JVM shared-class-archive warning due to IDEA's custom classloader. Successful final run contains no plugin exceptions.

First sandbox run was blocked by local Unix socket restrictions. The same isolated test was then run with approved execution permissions; no OS/IDE protections were changed. IDEA startup/download behavior belongs to the SDK; the shipped plugin itself has no networking.
