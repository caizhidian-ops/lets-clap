# P0 实施与模块分工

范围依据根目录 PRD v2.0。仅两个页面、一个风车关卡、曲谱可见第 1–2 小节，共 8 拍。未实现 P1 导出、历史、多曲目、设备校准互动或全曲展开。

| 模块 | 文件 | 责任 |
|---|---|---|
| 两页 UI | src/app/main.js、src/scenes/pet/art.js、public/style.css | 孵化、确认名字、首页、风车场景内面板、手机布局 |
| 统一状态 | src/app/fsm.js、server/index.js | 服务端权威 FSM、当前动作守卫、场景版本、幂等、取消 |
| 乐理数据 | data/、src/music/rhythm.js、server/arrangement/service.js | 真实白名单、时值/重叠验证、8 拍编译、一次修正后规则后备 |
| 采集与播放 | src/audio/engine.js、public/capture-worklet.js | 同一 AudioContext 倒计时与录制窗口，MediaRecorder 和逐帧 PCM 同源采集 |
| 检测与反馈 | src/audio/detector.js、src/audio/analysis.js | 高通能量、噪声门限、130ms 抑制、全局单调匹配、保守反馈 |
| 本地保存 | src/store/storage.js | localStorage 宠物；IndexedDB 仅一份主动保留录音 |
| 千问 | server/realtimeProxy/qwen.js、server/index.js | 服务端密钥、Manual WebSocket、工具校验、转录规则后备、确认后播出音频 |

实施顺序：数据核对 → 离线 FSM 和 UI → 预览时钟 → 真实采集 → 分析/保留/混音 → 千问代理 → 单元/接口/浏览器测试。

## 已核对的复用来源

- 本地 music 仓库：/Users/mio/Documents/ChatGPT/Animal bank，HEAD 1cba60c792eb292e0b2ae53f0b4c5f8d285f7a45。
- prototype/app.js 的 MediaRecorder 定长采集、主动保留、分轨思想可用；原先 setTimeout 和特定拍号时长未照搬。
- animal-band-data 实际知识库 57 单元，快照已保存到 data/notation-patterns.v1.json。Git blob e7211346cd08d1185127982985ffbce5e2982bd6。
- 远端歌曲与曲谱快照 blob 分别为 be7122ba27fb019b15b1b50c584583fdd7809c8a、240f082d7f77033801404b9932f82fdd301be9f1。
- 第 1–2 小节各 4 拍。72 BPM 是开发速度。没有展开反复与结尾。
- 候选 001/002/003/004/009 实际载入并验证；011 暂不纳入，避免把未审核年龄建议当作官方分级。
- 本地大风车 song.json 的 resourceMode=SCORE_ONLY、originalAudio=null；发布包 3a82362ac89189ca 的 stickerStemPacks 与 measureAlignments 为 null。未找到该歌曲已渲染伴奏，使用真实曲谱开发合成。

## 关键实现取舍

- 正式录音无外放伴奏或示范，仅视觉指示，减少误报。四拍预备声在录制窗口前；最终 WAV 严格由窗口内采样帧生成，不含预备拍。原始 MediaRecorder 编码仅采集过程暂存，不用不确定编码起点做混音。
- 当前未校准设备延迟，算法保留真实误差，但儿童反馈不确定地指责早/晚，不显示分数。
- 瞬态检测无法确保区分所有人声与拍手；持续噪声、削波、捕获缺帧或无清晰起始点返回不可靠。现场验收仍必需。
- 混音原样播放用户 WAV，不纠错、不补拍、不用示范轨替代；拍手/旋律独立调音量。
- 变更计划产生新 ID；旧保留版本不覆盖，也不能成为新谱子的完成结果。
- 千问选择反馈时只能选程序从本次真实分析生成的候选 code。语音输出先收集，只有转录与已批准台词一致才播放，避免未校验口播捏造结论。
- 每轮对话使用独立上游会话，前端边采集边发业务代理，代理在点击结束后提交音频；不持续监听、不保存聊天音频。录音期间不能启用对话。
- 刷新重新回到宠物首页，绝不恢复倒计时或麦克风。作品从 IndexedDB 恢复。
- 所有资源在本机。程序未部署或公开分发；宠物和场景为 SVG/CSS 开发素材。
