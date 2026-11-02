# Lune Glide

![Lune Glide](assets/icon.png)

**流光 · 让光标如流光般滑行。**

为 VS Code 和 IntelliJ IDEA 带来 Neovide 风格的流畅光标动画：四角弹簧、柔和拖尾、多光标支持，可调节速度和拖尾强度。停止移动后恢复原生光标。

## 安装与使用

安装包见 [GitHub Releases](https://github.com/BowlofThinSoup/Lune-Glide/releases)。

- **VS Code**：通过 **Install from VSIX…** 安装 `.vsix`，运行 **Lune Glide: Enable** 并重载窗口。通过 **Lune Glide: Settings** 调整效果。
- **IntelliJ IDEA 2026.2.x**：通过 **Settings → Plugins → Install Plugin from Disk…** 安装 JetBrains `.zip`，按提示重启。在 **Settings → Editor → Lune Glide** 中调整效果。

## 使用提示

VS Code 版会修改本机工作台文件，可能出现安装完整性提示。升级 VS Code 后运行 **Lune Glide: Repair After VS Code Update**；卸载前先执行 **Lune Glide: Disable (Restore Native Cursor)** 并重载窗口。[详细使用与恢复说明](docs/usage.md)。

IDEA 版可正常禁用或卸载。升级后仍显示旧名称时，请确认版本为 0.1.3 并重启 IDEA。

当前实机验证环境为 macOS、VS Code 1.143.0 和 IntelliJ IDEA 2026.2.3；IDEA 版限定 build 262.*。VS Code Web、终端和 Notebook 暂不支持。

[更新记录](CHANGELOG.md) · [问题反馈](https://github.com/BowlofThinSoup/Lune-Glide/issues) · [隐私说明](PRIVACY.md) · [开发文档](docs/development.md)

MIT License。动画算法来源与许可见 [第三方声明](THIRD_PARTY_NOTICES.md)。
