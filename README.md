# Let's Clap · 一起拍手吧

本地儿童音乐 demo，已整合 Mio PR #1 的前置语音与宠物流程，以及现有 3D 节奏游戏、拍手输入、试听、专辑墙与教学报告。

## 运行

Node 22+，依赖固定为 ws@8.21.0；Three.js / GLTFLoader 已放在本地 vendor。

```sh
npm ci
cp .env.example .env # 已有配置时无需复制
./scripts/run.sh
```

本机 bundled Node 路径：`/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`。启动脚本优先使用用户目录中的 bundled Node，也支持 `NODE_BIN`。当前整合体验使用 `PORT=5199 ./scripts/run.sh`，入口 http://127.0.0.1:5199/ 。

## 主流程

孵化 → 命名 → 心情 → 编排/示范/调整难度 → 3D 节奏游戏 → 试听 → 收藏与改名。Mio 负责前置语音与编排；游戏接收她的真实拍点时间轴。性格对应企鹅、鲸鱼、腊肠狗，场景沿用命名后的伙伴。开心、平静可进游戏；兴奋关卡未开放。没有语音连接时可展开“也可以点选”继续。

游戏支持点击、空格与本地麦克风拍手检测，只保存拍点；新主流程不保存原始拍手录音。静态 GLB 整体跳跃，没有骨骼绑定或身体动作识别。八拍编排按小节长度循环到已有 96 BPM、30 秒《大风车》伴奏，鼓声由实际输入拍点合成。专辑保存在当前浏览器，报告使用原始游戏时间轴，动态编排不自动冒充均匀跟拍课程达标。

`/practice.html?view=album` 查看专辑；`/night-rescue.html` 保留旧关卡；`/clap-test.html` 是本地拍手检测测试页。旧 `lets-clap-v1`、Mio 宠物和旧作品保持原样。

## 服务与验证

统一入口 `server/index.js` 提供 HTTP 与实时语音代理；`server.mjs` 的反馈和节奏报告接口被复用。密钥只在服务端 `.env`，禁止提交。启动时连接验证不代表完整语音验收；无密钥或上游失败明确提供后备，不虚构 AI 结果。

```sh
node --test test/*.test.mjs tests/*.test.js
# 运行无密钥本地测试服务后，包含 HTTP 与模拟千问协议：
BASE_URL=http://127.0.0.1:5200 BOBO_INTEGRATION=1 node --test test/*.test.mjs tests/*.test.js
```

本轮 81 项测试通过。真实语音/真人拍手、孩子现场体验与生产发布尚未作为本轮验收。

详细交接与证据见 [PR #1 整合记录](docs/integration/pr1-local.md)、[拍手检测](docs/integration/clap-input.md)、[节奏报告](docs/integration/rhythm-feedback.md)。
