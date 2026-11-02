# Lune Glide · 流光

- 插件显示名称：Lune Glide（两端一致）。
- 中文称呼：流光。
- 简介：让光标如流光般滑行。
- 英文简介：Neovide-inspired spring cursor animation.
- 图标：深蓝圆角底、薄荷绿方块光标、斜向拉伸拖尾。原创 SVG 位于 `assets/icon.svg`，VS Code 使用 256×256 PNG，JetBrains 使用 40×40 SVG（含明暗主题资源）。
- GitHub 仓库：[BowlofThinSoup/Lune-Glide](https://github.com/BowlofThinSoup/Lune-Glide)。

0.1.3 是本地品牌统一版本，未发布市场，名称可用性尚未在市场注册流程中确认。

为保留现有安装的升级路径，VS Code 的 `lune.neovide-cursor`、`neovideCursor.*` 命令和配置键，以及 JetBrains 的 `dev.lune.neovide-cursor` 均保持不变。VS Code 安装器的文件名、所有权标记和恢复协议也保持不变，以便识别和撤销旧版注入。显示名称与包文件名已经使用 Lune Glide。

源码版权和 Neovide 的 MIT 来源说明保留原文，不随产品改名替换。

本地打包验证（2026-11-02）：VS Code 类型检查、13 个单元测试、9 个浏览器测试通过；JetBrains 6 个核心测试及实际 IDEA 隔离集成测试通过。检查两份安装包中的显示名称、版本、命令/设置页名称、图标内容与尺寸，确认内部 ID 和旧注入恢复标记保留。安装包为 `lune-glide-vscode-0.1.3.vsix` 与 `jetbrains-neovide-cursor/build/distributions/lune-glide-jetbrains-0.1.3.zip`，未执行市场上传。
