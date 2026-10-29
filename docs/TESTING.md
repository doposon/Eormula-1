# 整理版本验证结果

日期：2026-10-29。环境：Linux 云环境、Chromium、Playwright 1.62.0、SwiftShader 软件 WebGL。

## 已通过

- `python3 tools/verify_assets.py`：28 个资源大小与 SHA-256 一致，重建 HTML 的 SHA-256 与用户原版完全一致。
- Git 暂存区的 28 个资源逐个核对 SHA-256 通过；`.gitattributes` 标记为二进制，防止 Windows 换行转换破坏内容。
- 两个 JavaScript 模块的 Node 语法检查通过。
- `python3 tools/smoke.py`：6/6 场景通过，均使用 960×540 窗口。
- `python3 tools/smoke.py --failure-only`：模拟资源返回 HTTP 503，加载界面正确显示可见错误。此检查也已加入后续完整测试入口。
- 文档中的本地 HTTP 启动命令实际执行成功，首页和资源清单请求通过。

| 赛道 | 玩家车队 | 幽灵车模型选择 | 结果 |
| --- | --- | --- | --- |
| Oval | McLaren | Red Bull | 通过 |
| Shanghai | Ferrari | Mercedes | 通过 |
| Silverstone | Williams | Alpine | 通过 |
| Spa | Audi | Haas | 通过 |
| Singapore | Racing Bulls | Aston Martin | 通过 |
| Oval | Cadillac | Red Bull | 通过 |

每个场景通过真实菜单操作选择赛道与两支车队，等待模型就绪与起步灯熄灭，按 W 验证车速大于零，确认计时进入第一圈、WebGL 上下文未丢失，再验证暂停与恢复。没有未捕获 JavaScript 异常或模型加载报错。测试截图与详细日志在本地 `test-results/` 中，不提交到 Git。

## 结果的边界

- 幽灵车模型加载通过不等于幽灵回放通过：没有跑完完整有效圈，未验证回放或最佳圈更新。
- 只验证发车附近的短距离驾驶，没有验证完整赛道的悬挂、碰撞、路肩或所有驾驶视角。
- 尚未在用户的 Windows 电脑上复测；软件 WebGL 的画面与帧率不能代表真实 GPU 的表现。
- 原版已有的非 2 的幂尺寸纹理 mipmap 警告仍存在；浏览器请求可选 favicon 返回 404。二者已记录，未在此次资源整理中修改。
- 首次下载仍需约 231 MiB 资源，资源按需加载与性能优化尚未完成。

原版对照：在 1920×1080 下已完成 Oval/McLaren 起步测试；在 960×540 下原版车队确认按钮超出可操作区域。新版本仅通过新增滚动样式修复该布局问题，并保留原版样式文件用于完整性校验。
