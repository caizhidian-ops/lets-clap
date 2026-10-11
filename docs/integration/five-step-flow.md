# 五页游戏流程与试听接入

2026-10-11 用户纠正：风车是关卡，不是宠物。流程入口 `public/flow.js`，页面补充样式 `public/flow.css`。复用现有 `mountEscapeScene` 和 `fluffyPet`，不改游戏模块、怪兽和勋章实现；原 `app.js` 保留。

1. 选择风车草地关卡。
2. 进入安静草地，宠物逐字对话；语音、打字和按钮共用回答逻辑。心情先映射为练习风格（平静/舒缓 60 BPM，开心/轻快 90 BPM，兴奋/活力 108 BPM）。这只是前端预设，不是真实 AI 音乐编排。
3. 复用救援游戏。语音用于开始、返回、完成后进入试听，不将口令识别当作拍手检测。
4. 试听；当前仍用实际拍点合成小鼓，正式音频由试听负责人接入。
5. 专辑墙，修改 1～24 字作品名并持久化。沿用 `lets-clap-v1`，保留历史作品和原始拍点。

## 试听接入

游戏完成、进入试听页时，触发事件：

```js
window.addEventListener('letsclap:completed', async ({ detail }) => {
  // detail: id/runId, mood, times, outcome, matchedCount, expectedCount, ...
  // 试听负责人在这里获取正式音频；此流程不会自动调用或收费。
  const { audioUrl, feedback } = await yourPlaybackService(detail);
  window.LetsClapPlayback.setResult({ runId: detail.id, audioUrl, feedback });
});
```

`audioUrl` 使用能在重新打开页面后访问的 HTTP(S) 或同源路径，不要传临时 Blob URL。`feedback` 为可选文字。接口只接受当前作品 id；成功返回 true，其他作品返回 false。已收藏作品会同步保存新音频地址，作品标题保持原值。当前正式音乐、真实语音识别、千问反馈均未作为真实服务验收。

启动需要 Node 22+；本机使用 Codex bundled Node 24。浏览器不支持语音、权限拒绝、识别失败和超时均给出文字/按钮替代。朗读是浏览器 speechSynthesis，提供“听伙伴说”入口。

## 风车内的合并场景（本轮更新）

流程现在为四屏：选关卡 → 风车音乐室（对话与演奏共用房间实例）→ 试听 → 专辑墙。室内场景和游戏 UI 分别在 `public/game/interior-world.js` 与 `interior-session.js`，沿用 `createEscapeRun` 节奏判定；不覆盖其他对话中的 `escape-world.js`、角色生成脚本或模型。木梁、齿轮、圆窗、鼓与地毯是本地 Three.js 场景几何。

形象来源为「打磨宠物与音乐勋章样式」对话现有文件：风车用 `assets/plush-v1/windmill.glb`；宠物优先 `assets/plush-v2/penguin.glb`，文件尚未就绪时使用 `assets/plush-v1/dongdong.glb`。新版小企鹅已到位，沿用该对话的 `plush-fur.js` 细绒表现；本轮没有提交新生成任务。模型是静态 GLB，移动/弹跳为整个模型的场景动画。

专辑墙展示同一母版的圆形歌曲胸针和成长勋章。大风车勋章沿用 `songId === 'da-feng-che' && outcome === 'escaped'`，小鼓练习不会自动伪造正式歌曲通关。改名仍仅改作品标题，不改勋章上的歌曲名称或拍点。
