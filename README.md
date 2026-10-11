# Let's Clap · 心情节奏乐园

本地儿童中文 demo：在同一个大场景中对话、选择心情、开始音乐游戏，再试听、保存、改名和查看勋章。

- **平静 → 悠悠（生成的鲸鱼）→ 风车**：舒缓八拍练习，跟拍让风车停下来。
- **开心 → 蹦蹦（生成的企鹅）→ 跳绳**：十六拍绳圈与音乐同步，点击/空格起跳，有连续命中、绊绳提示与重试。
- 兴奋暂未指定玩法；生成的腊肠狗保留供后续使用。

## 运行

Node 22+，无需安装依赖，Three.js/GLTFLoader 已放在本地 vendor。

```sh
nvm use
npm start
npm test
```

主入口 http://127.0.0.1:5173/ 。原有夜行关停版保留在 `/night-rescue.html`。

本机默认 npm 可能指向旧 Node，已验证的本机命令：

```sh
/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node server.mjs
/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test
```

## 真实能力与接入

宠物为 `public/assets/plush-v2/` 中实际生成的鲸鱼、企鹅、腊肠狗 GLB；风车资产在 plush-v1。毛绒额外效果来自 `plush-fur.js`。静态模型的跳跃是整体位移，未绑定骨骼动画。

当前游戏输入是点击/键盘；语音用于心情与关卡指令，依赖浏览器、网络和麦克风权限，失败时可打字或点按钮。没有身体动作或真实拍手检测。

试听当前是实际输入拍点合成的小鼓；正式音乐由试听负责人接入 `LetsClapPlayback.setResult()`，见 [接口说明](docs/integration/five-step-flow.md)。专辑保存在当前浏览器 localStorage；刷新后保留作品名和拍点。保留历史作品。完成跳绳并收藏可点亮跳绳达人；《大风车》歌曲勋章仍需正式歌曲数据。

`POST /api/feedback` 保留千问服务端接口；未配置密钥时明确返回演示反馈。主流程目前使用游戏实际命中数据，不自动调用千问。密钥仅设置在服务端环境 `QWEN_API_KEY` / `DASHSCOPE_API_KEY`，禁止提交 `.env`。真实千问和正式歌曲均未验收，未部署生产。

## 验证

17 项 Node 测试通过；浏览器实际定时操作验证风车 8/8 停转、跳绳 16/16 与最长连跳 16、模型与情绪映射、音乐开关、试听收藏、跳绳勋章，以及 390px 无横向溢出。上述分数来自自动化测试，不是孩子的真实体验结果。完整范围见 [整合记录](docs/integration/mood-games.md)。
