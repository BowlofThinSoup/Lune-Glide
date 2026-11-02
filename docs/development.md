# 开发与验证

## VS Code

Node.js **22.18+**（测试直接运行 TypeScript）。

```sh
npm ci
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:browser
npm run package
```

首次获取源码：

```sh
git clone https://github.com/BowlofThinSoup/Lune-Glide.git
cd Lune-Glide
```

VS Code 插件位于仓库根目录，IDEA 插件位于 `jetbrains-neovide-cursor/`。安装包由上述构建命令生成，不纳入源码版本控制；目前尚未发布插件市场。

也可指定本机 Chrome 执行浏览器测试：

```sh
CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run test:browser
```

`src/motion.ts` 是独立动画核心，`src/renderer.ts` 是 Monaco DOM/Canvas 适配，`src/installer.ts` 是可恢复安装器，`src/extension.ts` 提供命令与设置。生产包没有第三方运行时依赖。


## IntelliJ IDEA

在 `jetbrains-neovide-cursor/` 目录执行下列命令。

Python 3.9+ 和安装中的 JBR/JDK 即可构建：

```sh
python3 scripts/build.py --test
python3 scripts/smoke.py
```

自定义 SDK/JDK 路径：

```sh
python3 scripts/build.py --test --idea-home "/Applications/IntelliJ IDEA.app/Contents" --jdk-home "/path/to/jdk"
```

`build.py` 编译 Java 21 字节码、运行纯算法/绘图测试、打包 ZIP，并生成仅测试使用的独立插件。`smoke.py` 启动实际 IDEA 的无界面测试入口，使用临时 config/system/log 和独立插件目录，不加载日常项目或日常插件。需要允许本地 Unix socket。该测试不代表真人窗口中的视觉、帧率或完整中文输入法验收。

安装包只包含本插件代码、描述符、图标和 MIT 声明，不包含测试类或 JetBrains SDK。测试结果见 [IDEA 验证记录](../jetbrains-neovide-cursor/docs/verification.md)。Neovide 源码引用和 MIT 原文随 JAR 放在 `META-INF/THIRD_PARTY_NOTICES.md`。

运行 `python3 scripts/smoke.py --performance` 测量生产弹簧与 Java2D 离屏绘制成本，并验证真实无界面 IDEA 的空闲计时器和编辑器释放。可选 `--gui` 使用独立图形配置，需要该配置完成正常许可证初始化；当前本机未取得此路径的性能数据。测量结果与边界见 [性能报告](../docs/performance/README.md)。
