## Spa runoff and Singapore ground contact

- Spa surface classification now uses the actual asphalt and kerb triangles. Green grass and sand runoff outside those meshes use low grip and strong speed-dependent drag, with slow throttle recovery. Other tracks retain their drag tuning.
- Singapore asphalt, lane markings and bridge deck now provide triangle-based contact across their complete elevation range. Removed the kerb-only 47.54 ± 0.8m height gate.
- Singapore chassis height follows the current road immediately, fits pitch/roll to its slope and samples four tyres for clearance, excluding height jumps onto overlapping bridge layers. RB22 origin clearance and projected shadows follow this contact.

## RB22 separated wheels

- Replaced the RB22 asset with the supplied 22.6 MB GLB, preserving its 41 material parts and embedded textures.
- Applied exported wheel rest transforms and pivots; four wheels spin, only the front pair steer. Camber axes are preserved during spin.
- Player, ghost and projected shadow use the same wheel articulation.
- Browser check passed for model loading, all four pivots and axes, spin and front-only steering uniforms.

# 开发记录

## 2.17.1 座舱镜头

- 按用户最终范围，仅校准 Red Bull RB22 与 Ferrari SF26；其余车型保留旧座舱行为。
- 将镜头从车外高位移到驾驶员位置，降低眼高，向前避开头枕，让 Halo 位于前方视野上方，看到方向盘、车鼻与前轮。
- 镜头与车身使用同一位置、俯仰、侧倾变换；天空方向同步使用镜头上方向。
- 这两种座舱的近裁切改为 0.05 米，避免银石原来的 0.45 米裁切切掉近处内饰。
- V 只循环第三人称、座舱、前翼和朝后；环绕与全图观察单独保留。
- 增加摄像机数学与浏览器画面检查；模型资源及原始基线指纹不变。
- 记录未来 Blender 空物体标记约定，见 CAMERA_MARKERS.md；当前版本尚未读取新模型的空物体。
- 提供单文件导出工具，便于无需开发服务器直接试玩。

## 2.17.0 项目整理

- 保留原始 HTML 与压缩包，放在仓库外 `/workspace/formula-racing-import/`。
- 将 28 份 base64 资源提取成二进制文件，未降低模型或贴图精度。
- 分离 HTML、原版样式、游戏脚本与资源加载入口；保留原版游戏逻辑。
- 新增加载进度及失败提示。
- 修复较矮窗口下车队确认按钮被裁切的问题：菜单面板现在可以滚动。
- 添加资源指纹清单与原版重建校验。
- 添加五条赛道、十一支车队选择、起步和暂停/恢复的浏览器检查。

## 已知限制和后续工作

- 原版存在非 2 的幂尺寸纹理生成 mipmap 的 WebGL 警告，本次未改动渲染逻辑。
- 尚未验证完整圈速、幽灵回放、墙体碰撞、所有镜头以及 Spa 长距离坡面驾驶。
- 浏览器自动检查使用软件渲染，不能证明实际设备上的 60 FPS。
- 全部资源仍在启动时下载；按需加载与更深入的渲染优化留待后续。
- 动态声浪和悬挂改进尚未实施。
- GitHub 发布与云环境发布是独立步骤；本地测试不代表已经发布。
