# Lune Glide — IntelliJ IDEA

**流光 · 让光标如流光般滑行。** 两端统一使用 Lune Glide 名称与薄荷绿拖尾图标。

Neovide 风格的四角弹簧光标动画。原生 JetBrains 插件，通过编辑器事件和 glass-pane painter 绘制，不修改 IDEA 安装文件，不依赖 REA、Neovide 或网络。

## 安装

当前安装包：`build/distributions/lune-glide-jetbrains-0.1.3.zip`。

0.1.3 将插件列表、设置页和操作名称统一为 **Lune Glide**。插件 ID 与设置存储保持不变，可覆盖升级；包含 0.1.2 的光标尺寸修复。

0.1.2 修复移动时光标突然变高、停止后缩短的问题：动画沿用 IDEA 原生光标的高度和垂直偏移，默认竖线宽度也跟随编辑器字体缩放。

1. 打开 IDEA **Settings / 设置 → Plugins / 插件**。
2. 点击齿轮菜单 → **Install Plugin from Disk… / 从磁盘安装插件…**，选择上面的 ZIP（不要解压）。
3. 按 IDEA 提示重启。插件默认启用。

本版适配 **IntelliJ IDEA 2026.2.x（build 262）**，已使用本机 **2026.2.3 / 262.10968.63** 编译和执行隔离集成测试。未宣称兼容其他年份或其他 JetBrains 产品；插件描述符有版本限制。

## 效果和设置

打开 **Settings → Editor → Lune Glide**：

| 设置 | 默认 | 用途 |
|---|---|---|
| Enable | 开启 | 动画总开关 |
| Animation length | 0.15 秒 | 长距离移动的弹簧时间参数 |
| Short movement | 0.04 秒 | 两字符以内移动的时间参数 |
| Trail size | 1 | 0 为四角同步，1 为 Neovide 默认前后缘差速 |
| Animate typing | 开启 | 输入和短移动动画 |
| Use a block while moving | 关闭 | 移动时使用方块，拖尾更明显 |
| Reduce motion | 关闭 | 使用原生光标；需手动设置，不自动检测系统偏好 |

想要更接近 Neovide 的视觉效果，可启用 **Use a block while moving**。默认跟随 IDEA / IdeaVim 提供的光标形状。停止后恢复原生光标的形状、字形和闪烁；移动时方块半透明，以保留代码可读性。

使用 **Find Action（⇧⌘A / Ctrl+Shift+A）→ Lune Glide: Toggle Animation** 可以随时开关。也可从 View 菜单使用该操作。

## 实现与边界

- 使用与 VS Code 版相同的 Neovide 四角临界阻尼弹簧公式，按实际帧间隔推进；静止时停止动画计时器。
- 支持多个 caret、可见区域裁剪、滚动、焦点切换、输入法组合事件和编辑器释放清理。仅附着主代码编辑器，不附着终端、搜索框、预览或 diff 编辑器。
- 使用实际 visual position 和字符宽度，处理 tab、换行和宽字符。复杂 bidi、连字、软换行和折叠组合仍需进一步真人视觉验收。
- 临时隐藏原生 caret 使用零厚度 BAR，避免 IDEA 的方块反色字形重复绘制。恢复前检查属性对象，保留其他插件在动画期间修改的设置。
- 本版不含 railgun 粒子效果，不是逐像素 Skia 复刻；IdeaVim 的 shape 属性契约已测，但未完成 IdeaVim 全部模式的端到端验收。
- 正常禁用/卸载即可清理，不需要 VS Code 版的安装文件恢复步骤。

## 开发与验证

无需下载 Gradle 或另一份 IDEA。Python 3.9+ 和安装中的 JBR/JDK 即可构建：

```sh
python3 scripts/build.py --test
python3 scripts/smoke.py
```

自定义 SDK/JDK 路径：

```sh
python3 scripts/build.py --test --idea-home "/Applications/IntelliJ IDEA.app/Contents" --jdk-home "/path/to/jdk"
```

`build.py` 编译 Java 21 字节码、运行纯算法/绘图测试、打包 ZIP，并生成仅测试使用的独立插件。`smoke.py` 启动实际 IDEA 的无界面测试入口，使用临时 config/system/log 和独立插件目录，不加载日常项目或日常插件。需要允许本地 Unix socket。该测试不代表真人窗口中的视觉、帧率或完整中文输入法验收。

安装包只包含本插件代码、描述符、图标和 MIT 声明，不包含测试类或 JetBrains SDK。测试结果见 [docs/verification.md](docs/verification.md)。Neovide 源码引用和 MIT 原文随 JAR 放在 `META-INF/THIRD_PARTY_NOTICES.md`。

运行 `python3 scripts/smoke.py --performance` 测量生产弹簧与 Java2D 离屏绘制成本，并验证真实无界面 IDEA 的空闲计时器和编辑器释放。可选 `--gui` 使用独立图形配置，需要该配置完成正常许可证初始化；当前本机未取得此路径的性能数据。测量结果与边界见 [性能报告](../docs/performance/README.md)。
