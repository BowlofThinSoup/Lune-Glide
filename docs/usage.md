# VS Code 使用与恢复

## 安装与启用

1. 在 VS Code 的扩展视图菜单中选择 **Install from VSIX…**，安装 `lune-glide-vscode-0.1.3.vsix`。
2. 命令面板运行 **Lune Glide: Enable**。
3. 阅读安装说明并确认，然后选择 **Reload Window**。已有的其他 VS Code 窗口也需要重载。
4. 推荐在 User Settings 中设置 `"editor.cursorStyle": "block"`，四角拖尾会更明显。默认线条光标也支持；插件不自动改动你的编辑器设置。

启用会在 VS Code `resources/app/out/vs/code/.../workbench` 下写入一个外部 JS 文件和带标记的 script 引用，影响这一安装下的所有窗口和配置文件。保留内容哈希命名的原始 HTML 备份。**不会放宽 CSP、修改 product.json 校验值或自动提权。**

VS Code 可能提示安装内容已修改，这是该注入方案的固有限制。应用升级后运行 **Repair After VS Code Update**。Windows/Linux/macOS 受保护的安装目录可能不可写；插件会明确报错，不会自动请求管理员权限。使用你有写权限的 VS Code 安装；不建议对整个编辑器目录放宽权限。

## 动效与设置

```json
{
  "editor.cursorStyle": "block",
  "neovideCursor.animationLength": 0.15,
  "neovideCursor.shortAnimationLength": 0.04,
  "neovideCursor.trailSize": 1,
  "neovideCursor.animateTyping": true,
  "neovideCursor.respectReducedMotion": true,
  "neovideCursor.vfx": "none"
}
```

- `animationLength`：弹簧时间参数，单位秒，默认 0.15。
- `shortAnimationLength`：同一行两字符以内的快速运动，默认 0.04。
- `trailSize`：0–1，1 最接近 Neovide 默认的前后缘差速，0 为四角同步。
- `animateTyping`：是否对短移动执行动画。
- `respectReducedMotion`：跟随系统“减少动态效果”；开启时系统减少动态效果会让插件回退原生光标。
- `vfx`：`none` 或实验性的 `railgun` 粒子拖尾；不是 Neovide 全套粒子效果的逐项移植。
- `particleLifetime` / `particleCount`：粒子寿命和每个编辑器的数量上限。

设置使用 **User 层级**，不接受项目提供的参数。修改后运行 **Apply Settings** 并重载窗口。动画只在移动时接管光标，停止后由原生光标负责文字、闪烁和精确落点。

支持多个光标、分屏实例、实际像素定位、视口裁剪、滚动偏移修正、DOM 和 EditContext 的输入法组合事件，以及失焦恢复。不拦截键盘、鼠标、文本输入，不联网。

## 禁用和恢复

**卸载扩展前先执行 Lune Glide: Disable (Restore Native Cursor)，然后重载所有窗口。** VS Code 没有可靠的扩展卸载回调，仅卸载或禁用扩展本身不会撤销已经写入的工作台脚本。

如果插件命令不可用，在项目目录执行（需要 Node.js 20+）：

```sh
node scripts/recover.mjs status "/Applications/Visual Studio Code.app/Contents/Resources/app"
node scripts/recover.mjs disable "/Applications/Visual Studio Code.app/Contents/Resources/app"
```

Windows 通常为 `<VS Code 安装目录>/resources/app`，Linux 通常为 `/usr/share/code/resources/app`。恢复工具和构建后的 `dist/installer.cjs` 也包含在 VSIX 中。

恢复只移除完整匹配的 `neovide-cursor:start` / `neovide-cursor:end` 区块，不会用旧备份覆盖升级后的文件，也不会移除其他扩展的修改。若标记被修改，工具拒绝猜测性覆盖：退出 VS Code 后检查该区块，或重装官方 VS Code 应用程序。用户配置和工作区不在修改范围内。

