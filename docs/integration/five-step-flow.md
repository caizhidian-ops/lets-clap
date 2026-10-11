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
