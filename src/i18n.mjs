// English / Chinese interface layer.
//
// English stays the source language: game.js and index.html are unchanged text.
// In Chinese mode every text node and a few attributes are translated in place,
// and a MutationObserver translates text the game writes later (HUD, timing,
// pause menu, replay panel...). Switching back restores the English originals.
//
// Everything lives inside one exported object so the offline exporter can paste
// this file into a single script without top-level name clashes.
export const i18n = (() => {
  const STORAGE_KEY = 'formulaLanguage';
  const ATTRIBUTES = ['aria-label', 'title', 'alt', 'placeholder'];
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA']);

  // ---- Exact strings (matched case-insensitively, whitespace collapsed) ----
  const DICTIONARY = {
    // Page / brand
    'Formula Racing 2.17.6 · Cockpit Camera': '方程式赛车 2.17.6 · 座舱镜头',
    'FORMULA RACING 2.17.6 / MULTI-CIRCUIT': '方程式赛车 2.17.6 / 多赛道',
    'MULTI-CIRCUIT · PLAYER MODEL + CONTROLS PRESERVED · VARIABLE-PACE AI': '多赛道 · 保留玩家模型与操控 · 变速 AI',
    'Interactive car and camera test on a fixed oval circuit': '固定椭圆赛道上的赛车与镜头互动测试',
    'Studio': '工作室',
    'JS Studio': 'JS 工作室',

    // Top bar and settings
    'DOWNLOAD OFFLINE HTML': '下载离线 HTML',
    'PREPARING DOWNLOAD…': '正在准备下载…',
    'DOWNLOAD FAILED · CLICK TO RETRY': '下载失败 · 点击重试',
    '⚙ SETTINGS': '⚙ 设置',
    'Game settings': '游戏设置',
    'GAME SETTINGS': '游戏设置',
    'Close settings': '关闭设置',
    'CAMERA VIEWS': '镜头视角',
    'V: Chase → Cockpit → Halo → Front wing → Rear': 'V 键：追尾 → 座舱 → 光环 → 前翼 → 车尾',
    'CHASE': '追尾',
    'COCKPIT': '座舱',
    'HALO / T-CAM': '光环 / 车顶摄像机',
    'FRONT WING': '前翼',
    'REAR VIEW': '车尾视角',
    'TRACK OVERVIEW': '赛道全景',
    'Orbit and overview are independent of V cycling': '环绕与全景不参与 V 键切换',
    'ORBIT CAR': '环绕赛车',
    'FULL TRACK OVERVIEW': '完整赛道全景',
    'ADVANCED & DEBUG': '高级与调试',
    'CHASE CAM': '追尾镜头',
    'RESET VIEW': '重置视角',
    'Change sunlight angle and real 3D projected shadows': '切换阳光角度和真实 3D 投影阴影',
    'Cycles Ferrari texture orientation: normal, flip V, flip U, flip both': '循环切换法拉利贴图方向：正常、翻转 V、翻转 U、两者都翻转',
    'Cycles render resolution only; physics and textures stay unchanged': '仅切换渲染分辨率，物理和贴图不变',
    'RESET GRID (R)': '重置发车位 (R)',
    'MIDDAY': '正午',
    'AFTERNOON': '下午',
    'EVENING': '傍晚',
    'NORMAL': '正常',
    'FLIP V': '翻转 V',
    'FLIP U': '翻转 U',
    'FLIP U+V': '翻转 U+V',
    'ENGINE AUDIO': '发动机音效',
    'Weather': '天气',
    'Sunny': '晴天',
    'Cloudy': '多云',
    'Light Rain': '小雨',
    'Medium Rain': '中雨',
    'Heavy Rain': '大雨',

    // Help
    'ⓘ HELP': 'ⓘ 帮助',
    '✕ CLOSE HELP': '✕ 关闭帮助',
    'Show controls and information': '显示操控与说明',
    'EXIT': '退出',
    'GAS': '油门',
    'BRAKE': '刹车',
    'ROTATE YOUR PHONE TO LANDSCAPE': '请将手机横屏使用',
    'Touch controls': '触屏操控',
    'Steer left (A)': '向左转 (A)',
    'Steer right (D)': '向右转 (D)',
    'Brake (S)': '刹车 (S)',
    'Throttle (W)': '油门 (W)',
    'Change camera view (V)': '切换镜头视角 (V)',
    'Exit / pause (Esc)': '退出 / 暂停 (Esc)',
    'SPACE': '空格',
    'accelerate ·': '加速 ·',
    'progressive brake / reverse ·': '渐进刹车 / 倒车 ·',
    'steer ·': '转向 ·',
    'pause menu ·': '暂停菜单 ·',
    'pause/resume (3-second restart) ·': '暂停/继续（3 秒倒计时重新开始） ·',
    'reset player + NPC grid ·': '重置玩家与 NPC 发车位 ·',
    'cycle camera views.': '循环切换镜头视角。',
    'Player model:': '玩家车模：',
    'NPC model:': 'NPC 车模：',
    'Ferrari model:': '法拉利车模：',
    '· Mercedes model:': '· 梅赛德斯车模：',
    'LOADING CUSTOM CAR…': '正在加载自定义赛车…',
    'CUSTOM MODEL READY': '自定义车模已就绪',
    'MODEL LOAD FAILED · DEFAULT CAR': '车模加载失败 · 使用默认赛车',
    'LOADING AI CAR…': '正在加载 AI 赛车…',
    'NPC LOAD FAILED': 'NPC 加载失败',
    'LOADING FERRARI SF26…': '正在加载法拉利 SF26…',
    'FERRARI LOAD FAILED': '法拉利加载失败',
    'LOADING MERCEDES…': '正在加载梅赛德斯…',
    'MERCEDES CAR READY': '梅赛德斯赛车已就绪',
    'MERCEDES LOAD FAILED': '梅赛德斯加载失败',
    '· Williams, Alpine, Audi, Haas, Racing Bulls, Aston Martin and Cadillac load when selected · GHOST SPAWNS AFTER YOUR FIRST COMPLETE LAP; IT REPLAYS YOUR BEST RECORDED LAP':
      '· 威廉姆斯、阿尔派、奥迪、哈斯、红牛二队、阿斯顿·马丁和凯迪拉克会在选中时才加载 · 幽灵车会在你完成第一个完整圈后出现，并回放你记录到的最佳圈',
    'Tyre lockup requires a high-speed brake application: above 240 km/h it can happen sooner; from 210 km/h it requires a longer sustained brake. Low-speed braking will not lock the tyres. Track selection: Oval Circuit, Silverstone GP, Shanghai International, Spa-Francorchamps and Singapore. Spa and Singapore use your annotated original tracks; the original model is kept at full geometry / texture quality. Singapore uses its annotated FINISH .020 as a timing gate, and Spa uses its authored .026 finish marker. Silverstone uses a provisional virtual finish gate for lap timing; exact painted-line alignment still needs visual calibration. No independent NPC race line or difficulty selection: finish a valid lap to summon your best-lap ghost. Shanghai collisions use actual vertical geometry rather than an invisible raceline boundary. All eleven team models are available: McLaren, Red Bull, Ferrari, Mercedes, Aston Martin, Alpine, Williams, Haas, Racing Bulls, Audi and Cadillac. Green is grass; driving off-road causes strong speed loss and very weak acceleration. Road, edge lines and low red/white kerbs are prebuilt. Cars cast accurate sun-directed silhouettes instead of ellipse decals; the SUN button changes the light angle. Mouse drag orbits; scroll zooms. Chase camera pulls back smoothly and moves forward when braking. Ferrari UV test: use FERRARI UV to compare texture orientations.':
      '轮胎抱死需要在高速下用力刹车：240 km/h 以上更容易发生；从 210 km/h 起需要更长时间的持续刹车。低速刹车不会抱死轮胎。赛道可选：椭圆赛道、银石大奖赛赛道、上海国际赛车场、斯帕-弗朗科尔尚和新加坡。斯帕和新加坡使用你标注过的原始赛道，原始模型保留完整的几何与贴图质量。新加坡以标注的 FINISH .020 作为计时门，斯帕使用自己标注的 .026 终点标记。银石使用临时的虚拟终点门来计圈；与地面喷涂线的精确对齐仍需目测校准。没有独立的 NPC 赛车线，也没有难度选择：完成一个有效圈后，你的最佳圈幽灵车就会出现。上海的碰撞使用真实的垂直几何，而不是看不见的赛车线边界。十一支车队的车模全部可用：迈凯伦、红牛、法拉利、梅赛德斯、阿斯顿·马丁、阿尔派、威廉姆斯、哈斯、红牛二队、奥迪和凯迪拉克。绿色是草地；驶出赛道会大幅掉速，加速也非常弱。路面、边线和低矮的红白路肩都是预先建好的。赛车投下与阳光方向一致的精确影子，而不是椭圆贴花；“光照”按钮可以改变光线角度。鼠标拖动可环绕观察，滚轮缩放。追尾镜头会平滑拉远，刹车时向前移动。法拉利贴图测试：用“法拉利 UV”按钮对比贴图方向。',

    // HUD
    'SPEED': '速度',
    'TURN RADIUS': '转弯半径',
    'GEAR': '挡位',
    'AUTO': '自动',
    'TRACK': '赛道',
    'ROAD': '路面',
    'GRASS': '草地',
    'KERB': '路肩',
    'SHOULDER': '硬路肩',
    'KERB RUMBLE': '路肩震动',
    'WALL IMPACT': '撞墙',
    'TYRE LOCK': '轮胎抱死',
    'GRIP RECOVERY': '抓地力恢复',
    'LOCK-UP': '抱死',
    'Driving instruments': '驾驶仪表',
    'TYRES ·': '轮胎 ·',
    'CONDITION': '状态',
    'FL CONDITION': '左前轮状态',
    'FR CONDITION': '右前轮状态',
    'RL CONDITION': '左后轮状态',
    'RR CONDITION': '右后轮状态',
    'FL': '左前',
    'FR': '右前',
    'RL': '左后',
    'RR': '右后',
    'SOFT · S': '软胎 · S',
    'MEDIUM · M': '中性胎 · M',
    'HARD · H': '硬胎 · H',
    'INTERMEDIATE · I': '半雨胎 · I',
    'FULL WET · W': '全雨胎 · W',
    'R · RESTART SESSION': 'R · 重新开始本场',

    // Timing panel
    'BEST LAP CHALLENGE': '最佳圈速挑战',
    'TOTAL TIME': '总用时',
    'CURRENT LAP': '当前圈',
    'LAST LAP': '上一圈',
    'VS PREVIOUS': '较上一圈',
    'GHOST: waiting for your first valid lap': '幽灵车：等待你完成第一个有效圈',
    'No completed laps yet': '还没有完成的圈',
    'WAIT FOR LIGHTS OUT': '等待熄灯起步',
    'Five red start lights': '五盏红色起步灯',

    // Pause / replay
    'PAUSED': '已暂停',
    'Press SPACE to resume': '按空格键继续',
    'ESC / SPACE · resume with a 3-second countdown': 'ESC / 空格 · 以 3 秒倒计时继续',
    'SPACE · 3-second restart countdown': '空格 · 3 秒重新开始倒计时',
    'This browser lacks DEFLATE support.': '此浏览器不支持 DEFLATE 解压。',
    'This browser lacks built-in DEFLATE support.': '此浏览器不支持内置 DEFLATE 解压。',
    'This browser lacks built-in DEFLATE support. Please use a current Chrome or Edge.': '此浏览器不支持内置 DEFLATE 解压。请使用最新版 Chrome 或 Edge。',
    'This browser lacks 32-bit WebGL index support.': '此浏览器不支持 32 位 WebGL 索引。',
    'This browser lacks 32-bit WebGL index support. Please use a current Chrome or Edge.': '此浏览器不支持 32 位 WebGL 索引。请使用最新版 Chrome 或 Edge。',
    'Browser requires OES_element_index_uint to draw original Silverstone geometry': '浏览器需要 OES_element_index_uint 扩展才能绘制原始银石赛道几何。',
    'Wait for the 3-second countdown': '请等待 3 秒倒计时',
    'QUIT': '退出',
    'VIEW TRACK': '查看赛道',
    'SETTINGS': '设置',
    'REPLAY': '回放',
    'BACK TO PAUSE MENU · ESC': '返回暂停菜单 · ESC',
    'LAP REPLAY': '单圈回放',
    'Recorded lap': '已记录的圈',
    'Complete a lap to unlock replay.': '完成一圈后即可解锁回放。',
    'PAUSE': '暂停',
    'PLAY': '播放',
    'RESTART': '重新开始',
    'Replay camera': '回放镜头',
    'Replay position': '回放进度',
    'Chase': '追尾',
    'Cockpit': '座舱',
    'Halo / T-Cam': '光环 / 车顶摄像机',
    'Front Wing': '前翼',
    'Rear View': '车尾视角',
    'Orbit Car': '环绕赛车',
    'Track Overview': '赛道全景',
    'Drag to orbit · Scroll to zoom · Esc to return': '拖动环绕 · 滚轮缩放 · Esc 返回',

    // Audio setup
    'Engine Audio Setup': '发动机音效设置',
    'Select the original video or audio used in Audio Lab, then choose Continue.': '请选择音频实验室中使用的原始视频或音频，然后点击“继续”。',
    'Load the original 75-second Audio Lab recording to enable engine audio.': '请载入原始的 75 秒音频实验室录音以启用发动机音效。',
    'Volume': '音量',
    'Continue': '继续',
    'Skip for Now': '暂时跳过',
    'Engine audio ready': '发动机音效已就绪',
    'Engine audio ready · source saved for future visits': '发动机音效已就绪 · 录音已保存，下次访问可直接使用',
    'Engine ready · browser storage unavailable; download offline HTML to keep the recording.': '发动机音效已就绪 · 浏览器存储不可用；请下载离线 HTML 来保留录音。',
    'Unable to decode audio.': '无法解码音频。',
    'Select the original 75-second Audio Lab recording.': '请选择原始的 75 秒音频实验室录音。',
    'Audio download failed. Open ENGINE AUDIO to select a recording, or reload to retry.': '音频下载失败。请打开“发动机音效”选择录音，或刷新页面重试。',

    // Mode screen
    'CHOOSE YOUR': '选择你的',
    'RACE MODE': '比赛模式',
    'CIRCUIT': '赛道',
    'TEAMS': '车队',
    'Same car and physics. Choose a circuit, then choose your practice opponent pace.': '同样的赛车与物理。先选择赛道，再选择练习对手的速度。',
    '01 / DRIVE': '01 / 驾驶',
    'PRACTICE': '练习赛',
    'Free driving with the AI car. Choose Oval or Silverstone, then select Easy, Normal, Hard or Master.': '与 AI 赛车一起自由驾驶。选择椭圆或银石赛道，再选择简单、普通、困难或大师难度。',
    'ENTER PRACTICE': '进入练习赛',
    '02 / RACE WEEKEND': '02 / 比赛周末',
    'GRAND PRIX': '大奖赛',
    'COMING SOON': '敬请期待',
    'Grid start, race distance, results and more AI opponents.': '发车位起步、比赛圈数、成绩榜以及更多 AI 对手。',
    'MODE RESERVED': '模式预留中',
    'PRACTICE IS PLAYABLE NOW · GRAND PRIX IS A RESERVED PLACEHOLDER': '练习赛现已可玩 · 大奖赛为预留占位',
    'GRAND PRIX IS RESERVED FOR A FUTURE UPDATE · PRACTICE IS AVAILABLE NOW': '大奖赛将在以后的更新中推出 · 练习赛现已可玩',

    // Circuit select
    'Choose Oval, Silverstone, Shanghai, Spa or Singapore. Spa and Singapore load their unmodified original GLB textures on selection as free-drive previews.': '可选择椭圆、银石、上海、斯帕或新加坡。斯帕和新加坡在选中时会载入未经修改的原始 GLB 贴图，作为自由驾驶预览。',
    'TRACK 01 / SHORT': '赛道 01 / 短赛道',
    'OVAL CIRCUIT': '椭圆赛道',
    'The familiar compact closed loop. Best for testing acceleration, braking, tyre lock and camera behaviour.': '熟悉的紧凑封闭环形赛道。最适合测试加速、刹车、轮胎抱死和镜头表现。',
    'SELECT OVAL': '选择椭圆赛道',
    'TRACK 02 / GRAND PRIX': '赛道 02 / 大奖赛',
    'SILVERSTONE GP': '银石大奖赛赛道',
    'New 2024-model Silverstone visual replacement. Free-drive preview; AI path and lap timing require route calibration.': '全新的 2024 款银石赛道视觉替换模型。自由驾驶预览；AI 路线和计圈需要校准路线。',
    'SELECT SILVERSTONE PREVIEW': '选择银石预览版',
    'SELECT SILVERSTONE 2024': '选择银石 2024',
    'LOADING TRACK MODEL…': '正在加载赛道模型…',
    'TRACK 03 / INTERNATIONAL': '赛道 03 / 国际',
    'SHANGHAI INTERNATIONAL CIRCUIT': '上海国际赛车场',
    'Your imported Shanghai 2018 circuit model. Pit complex, start lights, grid markings, asphalt, grass and kerbs are included; distant scenery is simplified.': '你导入的上海 2018 赛道模型。包含维修区、起步灯、发车格标线、沥青、草地和路肩；远景已简化。',
    'LOADING SHANGHAI…': '正在加载上海…',
    'SELECT SHANGHAI': '选择上海',
    'SHANGHAI FAILED TO LOAD': '上海加载失败',
    'TRACK 04 / BELGIUM · PREVIEW': '赛道 04 / 比利时 · 预览',
    'SPA-FRANCORCHAMPS': '斯帕-弗朗科尔尚',
    'Original 2022 GLB visual mesh; Blender-labelled ROAD, KERB, WALL and GRID_000–025 with separate FINISH. Free driving; no verified AI path yet.': '原始 2022 GLB 视觉网格；在 Blender 中标注了 ROAD、KERB、WALL 和 GRID_000–025，终点 FINISH 单独标注。自由驾驶；尚无经验证的 AI 路线。',
    'LOAD ORIGINAL SPA': '加载原始斯帕',
    'TRACK 05 / SINGAPORE · PREVIEW': '赛道 05 / 新加坡 · 预览',
    'MARINA BAY / SINGAPORE': '滨海湾 / 新加坡',
    'Original GLB, 30 preserved grid markers, missing .021, and .020 reserved exclusively for FINISH. Free driving; mesh terrain and AI pending calibration.': '原始 GLB，保留 30 个发车格标记，缺少 .021，.020 专门留给 FINISH。自由驾驶；网格地形和 AI 有待校准。',
    'LOAD SINGAPORE': '加载新加坡',
    'DECOMPRESSING ORIGINAL GLB / LOADING TEXTURES…': '正在解压原始 GLB / 加载贴图…',
    'FIVE CIRCUITS · SPA/SINGAPORE ARE PREVIEW MAPS · ORIGINAL MODEL DETAILS RETAINED': '五条赛道 · 斯帕/新加坡为预览地图 · 保留原始模型细节',
    'ORIGINAL SILVERSTONE 2024 GLB · ORIGINAL TEXTURES · FREE-DRIVE PREVIEW': '原始银石 2024 GLB · 原始贴图 · 自由驾驶预览',
    'SHANGHAI READY · MESH COLLISION BARRIERS · BLUE GRID MARKERS HIDDEN · DAYLIGHT': '上海已就绪 · 网格碰撞护栏 · 蓝色发车格标记已隐藏 · 白天',
    '← BACK TO CIRCUIT SELECT': '← 返回赛道选择',
    '← BACK TO TRACKS': '← 返回赛道',

    // Team select
    'Choose your team and the AI opponent team. All eleven team models are available; additional models load only when selected to save memory. Red Bull uses the detailed 2026 RB22 model.': '选择你的车队和 AI 对手车队。十一支车队的车模全部可用；为节省内存，其余车模只在选中时加载。红牛使用精细的 2026 款 RB22 模型。',
    'PLAYER · YOU DRIVE': '玩家 · 由你驾驶',
    'Your team': '你的车队',
    'Choose your team': '选择你的车队',
    "The selected team's model becomes your player car.": '所选车队的车模将成为你的玩家赛车。',
    'GHOST · BEST LAP': '幽灵车 · 最佳圈',
    'Ghost car': '幽灵赛车',
    'Choose NPC team': '选择 NPC 车队',
    'This car appears only after you complete your first valid lap, replaying your best lap. You may choose either available team.': '这辆车只会在你完成第一个有效圈之后出现，回放你的最佳圈。你可以选择任一可用车队。',
    'Additional available teams': '其他可用车队',
    '11 TEAMS · BEST-LAP GHOST REPLAY · NO AI DIFFICULTY': '11 支车队 · 最佳圈幽灵回放 · 无 AI 难度',
    'Choose your player and future best-lap ghost car; the ghost stays hidden until a valid lap is completed.': '选择你的玩家赛车和将来的最佳圈幽灵赛车；幽灵车在完成有效圈之前保持隐藏。',
    'Tyres': '轮胎',
    'Soft · High grip / Higher wear': '软胎 · 高抓地 / 磨损更快',
    'Medium · Balanced': '中性胎 · 均衡',
    'Hard · Longer life / Lower grip': '硬胎 · 寿命更长 / 抓地较低',
    'Intermediate · High wear in dry conditions': '半雨胎 · 干地磨损大',
    'Full Wet · Low dry grip / High dry wear': '全雨胎 · 干地抓地低 / 磨损大',
    'Session Laps': '本场圈数',
    '1 Lap': '1 圈',
    '2 Laps': '2 圈',
    '3 Laps': '3 圈',
    '4 Laps': '4 圈',
    '5 Laps': '5 圈',
    'Unlimited': '不限',
    'Weather affects road grip and braking distance. Every lap is recorded. Timing stops at the selected lap count. Press R to restart.': '天气会影响路面抓地力和刹车距离。每一圈都会被记录。到达所选圈数后计时停止。按 R 重新开始。',
    'Enable Tyre Wear': '启用轮胎磨损',
    'Tyres wear while moving. Off-track driving, braking and front-wheel lock-ups increase wear. Disable wear to keep fresh tyres. Restarting fits a new set.': '轮胎会在行驶中磨损。驶出赛道、刹车和前轮抱死都会加剧磨损。关闭磨损可一直保持新胎。重新开始会换上新的一套轮胎。',
    'START SESSION →': '开始比赛 →',
    'CARS READY · START LIGHTS NEXT': '赛车已就绪 · 接下来是起步灯',

    // Errors and loading
    'WebGL unavailable': 'WebGL 不可用',
    'This test needs WebGL enabled in the browser. Try a current version of Chrome or Edge with hardware acceleration enabled.': '此测试需要浏览器启用 WebGL。请使用最新版 Chrome 或 Edge，并开启硬件加速。',
    'Game script error': '游戏脚本错误',
    'Unable to load the game. Check the local server and resource files, then reload.': '无法加载游戏。请检查本地服务器和资源文件，然后刷新页面。',
    'CLICK FOR ANOTHER F1 FACT': '点击查看另一条 F1 趣闻',
    'Next Formula 1 fun fact': '下一条 F1 趣闻',
    'PHOTO COULD NOT LOAD · CLICK TO CONTINUE': '图片无法加载 · 点击继续',
    'Game resource download': '游戏资源下载进度',

    // Loading-screen fun facts and photo captions
    'Fernando Alonso': '费尔南多·阿隆索',
    'Kimi Räikkönen': '基米·莱科宁',
    'Sebastian Vettel': '塞巴斯蒂安·维特尔',
    'Max Verstappen': '马克斯·维斯塔潘',
    'Michael Schumacher': '迈克尔·舒马赫',
    'Lewis Hamilton': '刘易斯·汉密尔顿',
    'Jenson Button': '詹森·巴顿',
    'Charles Leclerc': '夏尔·勒克莱尔',
    'Daniel Ricciardo': '丹尼尔·里卡多',
    'Carlos Sainz': '卡洛斯·塞恩斯',
    'Behind the memes, Fernando Alonso is a two-time F1 World Champion.': '梗图背后的费尔南多·阿隆索，是两届 F1 世界冠军。',
    'They call him “The Iceman.” Kimi Räikkönen became World Champion in 2007—by just one point.': '人称“冰人”。基米·莱科宁在 2007 年夺得世界冠军——仅凭 1 分的优势。',
    'Sebastian Vettel became F1’s youngest World Champion at just 23 years old.': '塞巴斯蒂安·维特尔 23 岁就成为 F1 史上最年轻的世界冠军。',
    'Max Verstappen won his first Grand Prix at 18. What were you doing at 18?': '马克斯·维斯塔潘 18 岁就赢下了自己的第一场大奖赛。你 18 岁在做什么？',
    'Michael Schumacher won seven world titles. One trophy cabinet probably wasn’t enough.': '迈克尔·舒马赫拿过七个世界冠军。一个奖杯柜大概是不够放的。',
    'Lewis Hamilton won the soaking-wet 2008 British Grand Prix by more than a minute. Rain mode: mastered.': '刘易斯·汉密尔顿在大雨倾盆的 2008 年英国大奖赛上以超过一分钟的优势夺冠。雨战模式：精通。',
    'Jenson Button was running last in the 2011 Canadian Grand Prix. He still won the race. Never give up.': '詹森·巴顿在 2011 年加拿大大奖赛中一度跑在最后一名，却依然赢下了比赛。永不放弃。',
    'Charles Leclerc grew up in Monaco—and finally won his home Grand Prix in 2024.': '夏尔·勒克莱尔在摩纳哥长大——并在 2024 年终于赢下了自己的主场大奖赛。',
    'Daniel Ricciardo celebrates podiums by drinking champagne from his shoe. Yes, his actual racing shoe.': '丹尼尔·里卡多登上领奖台后会用鞋子喝香槟。没错，就是他真正的比赛靴。',
    'Carlos Sainz won the 2024 Australian Grand Prix just weeks after appendix surgery. That’s quite a comeback.': '卡洛斯·塞恩斯在阑尾手术后仅几周，就赢下了 2024 年澳大利亚大奖赛。这个回归相当惊艳。'
  };

  // ---- Team and model names (also used inside patterns) ----
  const NAMES = {
    'mclaren': '迈凯伦', 'red bull': '红牛', 'red bull rb22': '红牛 RB22', 'ferrari': '法拉利',
    'ferrari sf26': '法拉利 SF26', 'mercedes': '梅赛德斯', 'aston martin': '阿斯顿·马丁',
    'alpine': '阿尔派', 'williams': '威廉姆斯', 'haas': '哈斯', 'racing bulls': '红牛二队',
    'audi': '奥迪', 'cadillac': '凯迪拉克', 'silverstone': '银石', 'shanghai': '上海',
    'spa': '斯帕', 'singapore': '新加坡', 'oval': '椭圆'
  };

  const lookup = new Map();
  for (const [english, chinese] of Object.entries(DICTIONARY)) lookup.set(normalise(english), chinese);

  function normalise(text) { return text.replace(/\s+/g, ' ').trim().toLowerCase(); }

  // ---- Strings with numbers or names in them ----
  const PATTERNS = [
    [/^LAP (\d+) \/ ∞$/i, (m) => `第 ${m[1]} / ∞ 圈`],
    [/^LAP (\d+) \/ (\d+)$/i, (m) => `第 ${m[1]} / ${m[2]} 圈`],
    [/^LAP (\d+) · (.+)$/i, (m) => `第 ${m[1]} 圈 · ${m[2]}`],
    [/^LAP (\d+) (.+)$/i, (m) => `第 ${m[1]} 圈 ${m[2]}`],
    [/^LAP (\d+)$/i, (m) => `第 ${m[1]} 圈`],
    [/^FINISHED · (\d+) \/ (\d+)$/i, (m) => `已完成 · ${m[1]} / ${m[2]}`],
    [/^(\d+) LAPS COMPLETE · (.+)$/i, (m) => `${m[1]} 圈完成 · ${m[2]}`],
    [/^GHOST: BEST (.+) · replaying$/i, (m) => `幽灵车：最佳 ${m[1]} · 回放中`],
    [/^RESUMING IN (\d+)$/i, (m) => `${m[1]} 秒后继续`],
    [/^SUN: (.+)$/i, (m) => `光照：${tr(m[1])}`],
    [/^FERRARI UV: (.+)$/i, (m) => `法拉利 UV：${tr(m[1])}`],
    [/^RES: AUTO \((\d+)%\)$/i, (m) => `分辨率：自动 (${m[1]}%)`],
    [/^RES: (\d+)%$/i, (m) => `分辨率：${m[1]}%`],
    [/^FPS: (.+)$/i, (m) => `帧率：${m[1]}`],
    [/^(.+) · ROAD GRIP (\d+)%$/i, (m) => `${tr(m[1])} · 路面抓地力 ${m[2]}%`],
    [/^(.+) · WEAR OFF$/i, (m) => `${tr(m[1])} · 磨损关闭`],
    [/^(.+) · Available$/i, (m) => `${tr(m[1])} · 可用`],
    [/^(.+) READY · (\d+) MATERIAL (PARTS|BATCHES)$/i, (m) => `${tr(m[1])} 已就绪 · ${m[2]} 个材质${m[3].toUpperCase() === 'PARTS' ? '部件' : '批次'}`],
    [/^LOADING (.+) \+ (.+)…$/i, (m) => `正在加载 ${tr(m[1])} + ${tr(m[2])}…`],
    [/^LOADING (.+) MODEL…$/i, (m) => `正在加载 ${tr(m[1])} 模型…`],
    [/^(.+) MODEL READY$/i, (m) => `${tr(m[1])} 模型已就绪`],
    [/^(.+) LOAD FAILED · (.+)$/i, (m) => `${tr(m[1])} 加载失败 · ${m[2]}`],
    [/^CAR LOAD ERROR · (.+)$/i, (m) => `赛车加载错误 · ${m[1]}`],
    [/^FAILED: (.+)$/i, (m) => `失败：${m[1]}`],
    [/^SILVERSTONE LOAD FAILED · (.+)$/i, (m) => `银石加载失败 · ${m[1]}`],
    [/^SHANGHAI MODEL FAILED TO LOAD · (.+)$/i, (m) => `上海模型加载失败 · ${m[1]}`],
    [/^SELECT (SPA|SINGAPORE|SILVERSTONE|SHANGHAI) PREVIEW$/i, (m) => `选择${tr(m[1])}预览版`],
    [/^PLAYER: (.+) · GHOST: AFTER YOUR FIRST VALID LAP$/i, (m) => `玩家：${tr(m[1])} · 幽灵车：完成第一个有效圈后出现`],
    [/^FORMULA RACING · BUILD (.+)$/i, (m) => `方程式赛车 · 版本 ${m[1]}`],
    [/^FORMULA RACING · CIRCUIT SELECT$/i, () => '方程式赛车 · 赛道选择'],
    [/^FORMULA RACING · GRID SELECTION$/i, () => '方程式赛车 · 发车队伍选择'],
    [/^LOADING (\d+)%(?: · (\d+) \/ (\d+) FILES)?$/i, (m) => `加载中 ${m[1]}%${m[2] ? ` · ${m[2]} / ${m[3]} 个文件` : ''}`],
    [/^Spa model load failed: (.+)$/i, (m) => `斯帕模型加载失败：${m[1]}`],
    [/^Singapore model load failed: (.+)$/i, (m) => `新加坡模型加载失败：${m[1]}`]
  ];

  // Returns the Chinese text, or null when nothing applies.
  function translateCore(core) {
    if (!/[A-Za-z]/.test(core)) return null;
    const key = normalise(core);
    const exact = lookup.get(key);
    if (exact !== undefined) return exact;
    const named = NAMES[key];
    if (named !== undefined) return named;
    const flat = core.replace(/\s+/g, ' ').trim();
    for (const [pattern, build] of PATTERNS) {
      const match = pattern.exec(flat);
      if (match) return build(match);
    }
    return null;
  }
  function tr(text) { return translateCore(text) ?? text; }

  // Keeps leading and trailing whitespace so inline markup around the text stays put.
  function translate(text) {
    const parts = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
    if (!parts || !parts[2]) return null;
    const result = translateCore(parts[2]);
    return result === null ? null : parts[1] + result + parts[3];
  }

  // ---- DOM layer ----
  let language = 'en';
  let observer = null;
  let started = false;
  const originalText = new WeakMap();   // text node -> English text
  const writtenText = new WeakMap();    // text node -> Chinese text we wrote
  const originalAttr = new WeakMap();   // element -> {attribute: English}
  const writtenAttr = new WeakMap();    // element -> {attribute: Chinese}

  function skipped(node) {
    const element = node.nodeType === 1 ? node : node.parentElement;
    if (!element) return true;
    if (SKIP_TAGS.has(element.tagName)) return true;
    return Boolean(element.closest && element.closest('[data-no-i18n]'));
  }

  function translateTextNode(node) {
    const current = node.nodeValue;
    if (writtenText.get(node) === current) return;
    if (skipped(node)) return;
    const result = translate(current);
    if (result !== null && result !== current) {
      originalText.set(node, current);
      writtenText.set(node, result);
      node.nodeValue = result;
    } else {
      originalText.delete(node);
      writtenText.delete(node);
    }
  }

  function translateAttributes(element) {
    if (skipped(element)) return;
    for (const attribute of ATTRIBUTES) {
      if (!element.hasAttribute(attribute)) continue;
      const current = element.getAttribute(attribute);
      const written = writtenAttr.get(element);
      if (written && written[attribute] === current) continue;
      const result = translate(current);
      if (result !== null && result !== current) {
        const originals = originalAttr.get(element) || {};
        const writes = written || {};
        originals[attribute] = current;
        writes[attribute] = result;
        originalAttr.set(element, originals);
        writtenAttr.set(element, writes);
        element.setAttribute(attribute, result);
      }
    }
  }

  function walk(root, handleText, handleElement) {
    if (root.nodeType === 3) { handleText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1) handleElement(root);
    const doc = root.ownerDocument || root;
    const walker = doc.createTreeWalker(root, 1 | 4);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.nodeType === 3) handleText(node); else handleElement(node);
    }
  }

  function restoreTextNode(node) {
    if (!originalText.has(node)) return;
    if (writtenText.get(node) === node.nodeValue) node.nodeValue = originalText.get(node);
    originalText.delete(node);
    writtenText.delete(node);
  }
  function restoreAttributes(element) {
    const originals = originalAttr.get(element);
    if (!originals) return;
    const writes = writtenAttr.get(element) || {};
    for (const attribute of Object.keys(originals)) {
      if (element.getAttribute(attribute) === writes[attribute]) element.setAttribute(attribute, originals[attribute]);
    }
    originalAttr.delete(element);
    writtenAttr.delete(element);
  }

  function onMutations(records) {
    for (const record of records) {
      if (record.type === 'characterData') translateTextNode(record.target);
      else if (record.type === 'attributes') translateAttributes(record.target);
      else for (const added of record.addedNodes) walk(added, translateTextNode, translateAttributes);
    }
  }

  function updateSwitches() {
    for (const button of document.querySelectorAll('[data-lang]')) {
      button.setAttribute('aria-pressed', String(button.dataset.lang === language));
    }
  }

  function setLanguage(next, persist = true) {
    if (next !== 'en' && next !== 'zh') return language;
    language = next;
    if (persist) { try { localStorage.setItem(STORAGE_KEY, next); } catch { /* storage can be blocked */ } }
    document.documentElement.lang = next === 'zh' ? 'zh-CN' : 'en';
    if (observer) observer.disconnect();
    if (next === 'zh') {
      walk(document.documentElement, translateTextNode, translateAttributes);
      if (observer) observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTES });
    } else {
      walk(document.documentElement, restoreTextNode, restoreAttributes);
    }
    updateSwitches();
    return language;
  }

  // Safe to call more than once (main.js and game.js both call it).
  function init() {
    if (started) return language;
    started = true;
    observer = new MutationObserver(onMutations);
    document.addEventListener('click', (event) => {
      const button = event.target.closest && event.target.closest('[data-lang]');
      if (button) setLanguage(button.dataset.lang);
    });
    let saved = 'en';
    try { saved = localStorage.getItem(STORAGE_KEY) || 'en'; } catch { /* ignore */ }
    setLanguage(saved === 'zh' ? 'zh' : 'en', false);
    return language;
  }

  return { init, setLanguage, translate, get language() { return language; } };
})();
