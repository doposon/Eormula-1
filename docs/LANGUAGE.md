# 双语界面（English / 中文）

## 使用

开始界面（PRACTICE / GRAND PRIX）底部的 **LANGUAGE / 语言** 一行有 `English` 和 `中文` 两个按钮；游戏内 ⚙ SETTINGS 面板顶部有同样一组。选择会写入 `localStorage` 的 `formulaLanguage`，下次打开自动沿用，默认 English。切换后 `<html lang>` 也会变为 `zh-CN`。

## 工作方式

- `index.html` 和 `src/game.js` 里的英文原文**不变**，英文仍是源语言。
- 选择中文时，`src/i18n.mjs` 遍历页面文字节点和 `aria-label` / `title` / `alt` / `placeholder` 属性，用词典替换；`MutationObserver` 负责翻译游戏之后写入的文字（速度、圈数、暂停菜单、回放面板、加载状态等）。切回英文会还原所有原文。
- 数字、时间和单位（如 `01:23.456`、`km/h`）不会被改动。
- 带 `data-no-i18n` 的元素（语言切换按钮自身）不会被翻译。
- 加载界面在游戏启动前就应用已保存的语言，所以加载时的 F1 趣闻也是中文。

## 新增或修改界面文字

1. 固定文字：在 `src/i18n.mjs` 的 `DICTIONARY` 里加 `'English': '中文'`（不区分大小写，空白会被合并）。
2. 带数字或名称的文字：在 `PATTERNS` 里加一条正则和生成函数。车队、赛道名在 `NAMES` 里。
3. 运行 `node tools/i18n.test.mjs`。它把真实的 `index.html` 载入 jsdom，切换到中文后扫描是否还有未翻译的英文，并模拟游戏运行时写入的文字。

## 范围与限制

- 已覆盖：开始、赛道选择、车队选择、HUD、计时面板、轮胎面板、设置、帮助、暂停、回放、发动机音效设置、起步灯、加载界面、错误提示（浏览器能力类）。
- 未覆盖：`sound-lab/`（音频实验室）和 `multiplayer-test.html` 是独立页面，仍为英文。
- 程序内部的诊断错误（如 GLB 头无效）保持英文，便于排查。
- 离线 HTML 导出（`src/offline.js` 与 `tools/export_standalone.py`）已包含 `i18n.mjs`。
- 缓存版本号从 `rainwall17` 升为 `lang18`，让浏览器重新取得新文件。
