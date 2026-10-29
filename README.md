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
- `src/game.js`：游戏脚本；从原版整理，并逐步修复功能。
- `src/camera.mjs`：座舱镜头与车身坐标变换。
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
python3 tools/verify_assets.py --baseline
node tools/camera.test.mjs
node --input-type=module --check < src/game.js
node --input-type=module --check < src/main.js
```

默认校验检查当前 28 份模型/数据的 SHA-256、大小及代码引用。`--baseline` 另外读取首次导入的历史提交，在内存中重建原版 HTML 并核对完整 SHA-256。这样可以修改当前游戏逻辑，同时继续验证原始导入版本；原始指纹未被覆盖。历史检查需要 Git 历史中的首次导入提交。

浏览器回归测试使用 Python Playwright 和 Chromium；当前云环境已提供。其他环境可以安装测试依赖，然后安装 Playwright Chromium：

```sh
python3 -m pip install -r tools/requirements-test.txt
python3 -m playwright install chromium
python3 tools/smoke.py
python3 tools/camera_smoke.py
```

默认优先使用系统 `chromium`，否则使用 Playwright 的浏览器；可通过 `CHROMIUM_PATH` 指定路径。`--track spa` 可只检查指定赛道。测试输出与截图位于忽略的 `test-results/` 目录。测试使用软件 WebGL，其帧率不能用来衡量玩家设备性能。

`camera_smoke.py` 使用当前云环境的 `/usr/bin/chromium`，检查 RB22、SF26 座舱和五条赛道，并通过有/无玩家车身的像素对比确认车身真正进入画面。它的测试注入只在浏览器请求拦截中启用，不随游戏发布。

## 驾驶视角

按 `V` 循环切换第三人称、座舱、前翼、朝后四种驾驶视角。环绕观察和全图查看单独保留在设置里。本轮仅为 RB22、SF26 调整座舱：使用模型本身的 Halo、车鼻、前轮与方向盘，镜头跟随车身俯仰和侧倾。其余车队保持旧座舱行为。

## 资源和后续开发

所有资源文件均小于 50 MiB，无需把 309 MiB 的原版 HTML 放入普通 Git。整体资源仍有约 231 MiB；首次下载并不小。目前仍会在启动时加载全部打包资源，尚未实现按赛道下载或性能优化。后续应在验证兼容性后逐步改进加载方式。

优先事项为 Spa 异常颠簸、性能、动态声浪及统一赛道物理语义。每次只做明确的一组修改，保留模型精度，并检查已有功能。模型来源和使用授权沿用用户原有项目；本次整理没有添加新的开源许可。

## 导出双击即玩的单文件

```sh
python3 tools/export_standalone.py ../artifacts/formula_racing_2171_cockpit.html
```

导出文件保留完整模型，约 309 MiB，应放在仓库外。文件可用 Chrome/Edge 直接打开，无需运行服务器；导出器不会覆盖已有文件。

## Offline play and Blender models

On the website, click **DOWNLOAD OFFLINE HTML** on the opening menu (or in the top bar while driving). Your browser saves a complete HTML including all cars and circuits. Open that downloaded file in Chrome or Edge for offline play. This is a large download; wait for the browser to finish saving it. The offline export hides the download button.

Practice: **Esc** opens Quit / View Track / Settings. Viewing the track and settings keep driving paused. Esc returns to the pause menu; Esc or Space resumes after three seconds. Quit returns to track selection.

Original editable GLBs: [RB22](models/RB22.glb?raw=true), [SF26](models/SF26.glb?raw=true). Download these and import them into Blender using File > Import > glTF 2.0. See [model preparation notes](models/README.md) before separating wheels. These exports preserve the source geometry and textures; wheel animation is not implemented yet.
