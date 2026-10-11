# Let's Clap · 小小节奏岛

2026-10-11 14:31 任务的本地 kids demo。Node 22，无需安装依赖。

```sh
nvm use # 如已安装 nvm，切换到 .nvmrc 指定的 Node 22
npm start
# http://127.0.0.1:5173
npm test
```

第一次孵化风车 → 选择开心/平静/兴奋 → 语音说“开始游戏”或按钮开始 → 点击 8 拍 → 试听、下载、收藏 → 专辑墙和怪物勋章。作品以拍点数据保存在 localStorage，重新进入可重建 WAV 音频；不录制孩子声音。三只怪物在收藏 1/2/3 首后解锁，四枚勋章按孵化、首作、三种心情、五首收藏解锁。语音识别取决于浏览器、联网和麦克风权限，不支持时使用按钮。

千问服务端接口：`POST /api/feedback`，分析点击间隔。默认无凭据返回明确标记的演示反馈。真实接入需在启动服务的环境设置 `DASHSCOPE_API_KEY` 或 `QWEN_API_KEY`，可选 `QWEN_MODEL`（默认 qwen-plus）。密钥只在服务端，禁止提交 `.env`。上游失败显示重试，作品仍可试听、保存。当前交付未验证真实千问调用。未扩展正式风车核心玩法或场景，未发布生产。

本地保存仅属于当前浏览器；不清除浏览器数据，下载 WAV 可保留独立音频副本。

本机默认 npm 可能指向旧 Node。已验证的本机运行命令：

```sh
/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node server.mjs
/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test
```

千问北京地域接口依据 [阿里云官方文档](https://www.alibabacloud.com/help/zh/model-studio/model-calling-in-sub-workspace)。密钥须属于对应地域。

验证：5 项 Node 测试通过（无凭据演示、输入拒绝、HTTP 静态范围、拍点稳定度、模拟上游成功/失败）；浏览器实际完成孵化、三种心情、八拍试听、收藏、刷新持久化、五首作品解锁与 390px 布局。已操作 audio 播放并观察到暂停状态；未验证物理扬声器音质。真实语音口令识别及真实千问调用未验收。

## 风车逃生场景（2026-10-11）

从首页选心情并开始，进入风车救援：点击“开始救援”，四拍预备后跟随八拍亮点点击或按空格。每次目标只计一次，狂风持续拉回宠物；固定两小节结束后，命中至少 60% 才逃生成功，否则保护泡泡救援。两种结果均可试听和收藏，原有作品数据保留。

本轮仅接入点击时间判定、小鼓测试音，未接入真实拍手检测、知识库编排或《大风车》伴奏。反馈为明确标示的规则反馈。玩法独立模块在 `public/game/`；`mountEscapeScene` 支持 bpm、onsets（正式开始后的目标秒数）、planId、onComplete/onCancel，返回 dispose 和 ingestOnset（正式开始后的输入秒数）。外部真实拍手来源接入时还需增加来源/置信度与完整录音分析契约，不能将点击结果改名为真实拍手成绩。

本轮验证：10 项 Node 测试覆盖无输入、正确输入、重复/乱点、固定时长、8/12 拍点阈值、休止与非法时间轴，加上原服务端测试；浏览器检查见本轮交付说明。
