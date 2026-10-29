# Formula Racing

基于原生 JavaScript、WebGL 和 HTML 的浏览器赛车游戏。此项目从用户提供的 **2.17.0** 单文件版本整理而来，保留原有驾驶、渲染与模型解码逻辑。

## 在本机运行

需要 Python 3 和支持 WebGL、`DecompressionStream` 的现代浏览器（例如 Chrome 或 Edge）。没有生产环境 npm 依赖，也不需要打包。

在项目文件夹中运行：

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Windows 可使用 `py -3` 替代 `python3`。浏览器地址栏输入 `http://127.0.0.1:8000`。关闭服务时在终端按 Ctrl+C。

由于资源已拆成文件，需要通过本地 HTTP 服务打开 `index.html`，不能再双击 HTML 直接运行。原版单文件仍保存在导入目录中，未被覆盖。

## 文件结构

- `index.html`：菜单、画布与 HUD。
- `src/game.js`：原版游戏脚本，只有外层函数包装和资源字符串引用发生改变。
- `src/styles.css`：原版样式。
- `src/main.js`：加载独立资源，显示进度和加载错误，再启动游戏。
- `src/ui.css`：加载界面，以及较矮窗口下菜单可滚动的修正。
- `assets/*.bin`：从原版 base64 精确还原的 28 份二进制资源，保留原有压缩格式。
- `assets/manifest.json`：资源路径、大小和 SHA-256。
- `tools/`：资源一致性校验与浏览器启动测试。
- `docs/`：原版指纹、开发记录与测试范围。

## 检查

```sh
python3 tools/verify_assets.py
node --input-type=module --check < src/game.js
node --input-type=module --check < src/main.js
```

资源校验会在内存中重建原版 HTML，并核对完整 SHA-256，因此能验证拆分后的模型、数据与原始游戏代码是否被改变。它是此次迁移的基线校验；未来确实需要改动游戏逻辑时，应保留原始指纹并相应演进测试，不能悄悄覆盖基线以让检查通过。

浏览器回归测试使用 Python Playwright 和 Chromium；当前云环境已提供。其他环境可以安装测试依赖，然后安装 Playwright Chromium：

```sh
python3 -m pip install -r tools/requirements-test.txt
python3 -m playwright install chromium
python3 tools/smoke.py
```

默认优先使用系统 `chromium`，否则使用 Playwright 的浏览器；可通过 `CHROMIUM_PATH` 指定路径。`--track spa` 可只检查指定赛道。测试输出与截图位于忽略的 `test-results/` 目录。测试使用软件 WebGL，其帧率不能用来衡量玩家设备性能。

## 资源和后续开发

所有资源文件均小于 50 MiB，无需把 309 MiB 的原版 HTML 放入普通 Git。整体资源仍有约 231 MiB；首次下载并不小。目前仍会在启动时加载全部打包资源，尚未实现按赛道下载或性能优化。后续应在验证兼容性后逐步改进加载方式。

优先事项为 Spa 异常颠簸、性能、动态声浪及统一赛道物理语义。每次只做明确的一组修改，保留模型精度，并检查已有功能。模型来源和使用授权沿用用户原有项目；本次整理没有添加新的开源许可。
