# Privacy

Lune Glide does not send editor contents, keystrokes, cursor positions, settings, or usage data to a server. It has no telemetry, analytics, advertising, or network requests in its plugin runtime.

Cursor positions and the editor geometry needed to draw animations are processed locally. The VS Code renderer may read the visible character beneath a block caret to preserve readability during animation; it does not transmit that character.

Settings are stored through the host editor's settings facilities. The VS Code edition also writes its renderer script and a marked script reference into the local VS Code installation, with a local backup for restoration. See the README for disabling and uninstalling it.

Marketplace downloads, update checks, optional editor settings synchronization, and GitHub visits are handled by those services under their own privacy policies.

For questions, open an issue at https://github.com/BowlofThinSoup/Lune-Glide/issues. Avoid posting private source code or credentials.
