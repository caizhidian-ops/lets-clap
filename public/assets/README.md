# P0 素材与来源

## 当前资源

- 三种固定宠物：src/scenes/pet/art.js 内自绘 SVG，欢快熊、安静长耳角色、搞怪紫色角色。作为开发占位形象；不是最终毛绒 PNG/WebP 成品。
- 风车场景：public/style.css 自绘 CSS 分层场景、风车转动、短入场动作。
- 节奏示范：按知识库事件合成短噪声拍手音，仅用于示范，绝不作为用户拍手轨。
- 旋律测试伴奏：读取 data/verified-score.json 第 1–2 小节真实音高与时值，用三角波音色合成。无鼓声。72 BPM 仅开发测试速度。
- 用户拍手：设备麦克风采集，仅本机 IndexedDB，主动点击保留后保存。无任何预置用户录音。

## 歌曲与知识库出处

- [大风车曲谱](https://github.com/Mio0707/animal-band-data/blob/main/textbooks/renjiao/grade-1/lower/songs/pep22_g1b_dafengche/verified-score.json)
- [歌曲元数据](https://github.com/Mio0707/animal-band-data/blob/main/textbooks/renjiao/grade-1/lower/songs/pep22_g1b_dafengche/song.json)
- [节奏知识库](https://github.com/Mio0707/animal-band-data/blob/main/exercises/rhythm/vocabulary/notation-patterns.v1.json)

本地歌曲记录和发布包均为 SCORE_ONLY，未找到已渲染的大风车伴奏。曲谱数据已有 verified 标记，但真实音乐审核、作品演示和公开视频授权尚未确认，开发合成不代表授权已完成。

## 接入外部伴奏

将审核后的 **无预备拍、无前导静音、无鼓或少鼓、仅第 1–2 小节**音频放在 public/assets/audio/。
设 DEMO_BACKING_ASSET=/assets/audio/文件名.wav，DEMO_BPM 与该片段的实际速度一致。
长度应为 8 × 60 / BPM 秒。程序检查时长，不推断原唱 BPM，不会把长度相同视为人工节拍审核。
外部伴奏缺失或时长不符时明确报错，不假装完整播放。未配置外部文件时明确标记开发曲谱合成。

## 用户提供的毛绒宠物（2026-10-11）

来源：lets-clap-plush-animals-v2.zip。原始文件保留在 pets/*.glb。

固定对应：happy / 欢快 → penguin；quiet / 安静 → whale；silly / 搞怪 → dachshund。开心、平静、兴奋分别对应上述视觉气质。孵化后固定角色不随探险情绪更换。

运行时使用模型渲染的 768×768 透明 PNG，继续沿用呼吸、行走、破壳动画，无运行时 3D 依赖。
渲染工具：scripts/render-pets.mjs + scripts/pet-render.html；Three.js 0.184.0、正交相机、透明背景及柔和灯光。
重新渲染：设置 THREE_PACKAGE_DIR 为解压后的 Three.js 包路径，PLAYWRIGHT_MODULE 和 CHROME_PATH 为本机工具路径，再运行 node scripts/render-pets.mjs。

## 孵化固定语音提示

`audio/hatch-select.wav`（6.66 秒）和 `audio/hatch-guide.wav`（7.51 秒）由当前配置的 qwen3.8-omni-flash-realtime 生成，输出转写通过固定原文校验后才保存。生成脚本：scripts/render-hatch-prompts.mjs，使用本机 .env；运行时直接播放本地 WAV，无额外模型调用。第一段询问“你希望这个宠物是什么性格？”，第二段在节奏孵化前讲解拍手。孵化节奏现为固定 3 小节 2/4 拍（4.5 秒），之后 1.2 秒破壳，宠物转身一圈，不续播节奏或跳动。首次自动播放被浏览器阻止时，可点击“听语音提示”。

最新孵化表现：3 个 2/4 小节（4.5 秒），破壳后播放一次 1.8 秒转身，不再续播节奏或跳动。`pets/*-turn.png` 是原 GLB 模型围绕竖轴渲染的 25 帧横向序列（每帧 320×320，含起止同朝向帧）。生成脚本同时统一静态图片与旋转序列的相机范围，避免转身时缩放跳变。

## 当前固定语音引导

17 段 prompt-*.wav 均由已配置的 qwen3.8-omni-flash-realtime 真实生成，输出转写必须与 src/app/prompts.js 的固定台词一致才写入。生成脚本 scripts/render-prompts.mjs，24 kHz 单声道 PCM WAV。旧 hatch-*.wav 仅保留历史素材，当前页面使用 prompt-guide.wav 与 prompt-select.wav。固定口播不代表实时 AI 判断；实时回答只经当前场景工具校验后推进。
