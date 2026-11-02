# Neovide attribution

The critically damped spring and direction-aligned four-corner animation in
`src/motion.ts` are adapted from Neovide, under the MIT license below.

Reference commit: `27e3e17cf4779dee691ddec2222ccfae7343ee37` (inspected 2026-10-24).

- https://github.com/neovide/neovide/blob/27e3e17cf4779dee691ddec2222ccfae7343ee37/src/renderer/cursor_renderer/mod.rs
- https://github.com/neovide/neovide/blob/27e3e17cf4779dee691ddec2222ccfae7343ee37/src/renderer/animation_utils.rs
- https://github.com/neovide/neovide/blob/27e3e17cf4779dee691ddec2222ccfae7343ee37/LICENSE

This project is independent of Neovide and Microsoft. It does not bundle Rust,
Skia, Neovide, REA, or third-party runtime packages. The optional particle trail
is an approximation, not a source port of Neovide's particle modes.

## Upstream license

MIT License

Copyright (c) 2023 Neovide Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
