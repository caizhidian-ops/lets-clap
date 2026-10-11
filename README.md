# let's clap · 一起拍手吧

严格按根目录 PRD v2.0 的 P0 开发：宠物首页和单关卡风车页；知识库合法两小节；真实拍手采集、保守分析、主动保留与混音试听。

## 在这台 Mac 上运行

```sh
./scripts/run.sh
```

打开 http://127.0.0.1:5173。Chrome 优先。点击“开始挑战”才申请拍手录音授权；首次点麦克风开启语音互动，之后每步讲解结束自动收听，停顿后提交；可随时暂停。名字确认、开始拍手录音、保留作品需点击。技术信息与开发按钮收在“开发信息”。建议用耳机。

其他环境需 Node.js 22+，先 pnpm install --frozen-lockfile，再 pnpm start（也可 npm install / npm start）。

## 配置

.env 已从本地 Animal Band 配置复用 API Key，仅在服务器使用，已 gitignore。
已配置用户提供的北京地域、Workspace ID 与更新后的 API Key。2026-10-11 新 Key 已通过真实鉴权、探险意图工具调用、合法 8 拍 AI 编排和批准台词的 PCM 语音输出验证。合成测试语音经实际业务代理进入探险、降低难度的完整闭环也已通过。断网或响应失败时仍明确使用规则后备。

| 环境变量 | 用途 |
|---|---|
| DASHSCOPE_API_KEY | 服务端 API Key，不传浏览器 |
| DASHSCOPE_WORKSPACE_ID | 百炼业务空间 ID；新实时模型必须配置 |
| DASHSCOPE_REGION | cn-beijing 或 ap-southeast-1，与 Key 和业务空间同地域 |
| QWEN_REALTIME_MODEL | 已固定默认 qwen3.8-omni-flash-realtime |
| DEMO_BPM | 默认 72，开发速度，非原唱权威值 |
| DEMO_BACKING_ASSET | 可选 /assets/audio/文件名.wav，已审核前两小节 |
| PORT | 默认 5173 |

配置后重启服务。密钥不应发到聊天或加入 Git。
未找到数据库中的大风车已渲染伴奏，当前混音使用实际前两小节曲谱的合成旋律，界面有开发标记。

接口根据阿里云 [实时连接](https://help.aliyun.com/zh/model-studio/realtime)、[客户端事件](https://help.aliyun.com/zh/model-studio/client-events)、[服务端事件](https://help.aliyun.com/zh/model-studio/server-events) 实现并核对。启动时检查真实连接；鉴权失败会明确显示并禁用语音入口。真实鉴权与基础调用已通过；本地模拟不能代替现场真人语音与拍手验收。

## 测试

```sh
pnpm test
# 已启动服务后，加入 HTTP 与本地千问协议模拟测试：
BOBO_INTEGRATION=1 pnpm test
# 可选：安装 Playwright，并提供 Chrome 路径：
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node tests/hatch-browser.mjs
# 真实千问语音联调（明确标记的合成输入，仅测试）：
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node --env-file=.env tests/voice-first-browser.mjs
```

浏览器集成测试采用清楚标记的 Chromium 假麦克风；模拟数据仅测试使用，应用没有模拟录音入口。现场真人拍手精度、硬件延迟仍需单独验证；真实千问链路已做合成语音联调。

详见 [实施与模块分工](docs/IMPLEMENTATION.md)、[验收记录](docs/TEST_REPORT.md)、[素材出处与审核状态](public/assets/README.md)。

## 语音文案统一调整

[每页提示文本](docs/VOICE_COPY.md)，固定口播源文件 src/app/prompts.js。固定音频为真实千问生成并通过原文校验；动态反馈来自实际拍手检测。
