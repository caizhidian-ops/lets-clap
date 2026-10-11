import {learningProgress,COURSE_STAGES,MASTERY} from './rhythm-report.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sourceName=source=>source==='microphone_clap'?'麦克风拍手':source==='mixed_mic_tap'?'拍手与按键混合':'按键 / 点击';
export function createReportUI({findTrack,getTracks,startReport,onPractice}){
 const dialog=document.createElement('dialog');dialog.className='rhythm-report-dialog';dialog.setAttribute('aria-labelledby','report-title');document.body.append(dialog);
 let currentId=null;
 function button(track){const status=track.report?.status;return `<button type="button" class="report-icon" data-report="${esc(track.id)}" aria-label="查看${esc(track.title||'这次作品')}的跟拍报告"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M8 8h8M8 12h5M8 16h8"/></svg><span>跟拍报告${status==='pending'?' · 分析中':status==='failed'?' · 可重试':''}</span></button>`;}
 function course(){
  const progress=learningProgress(getTracks());
  return `<section class="learning-path" aria-label="我的节奏成长"><h2>我的节奏成长</h2><ol class="course-stages">${COURSE_STAGES.map((stage,i)=>`<li class="${stage.available?'available':''}"><small>第 ${i+1} 阶段 · ${stage.available?'练习中':'待开放'}</small><strong>${stage.title}</strong><span>${stage.description}</span></li>`).join('')}</ol><p class="note">成长卡练习：96 BPM · 4/4 拍 · 48 拍均匀跟拍。完成游戏后，我们再看看节奏是否稳定。</p><div class="growth-cards">${progress.map(p=>`<article class="growth-card ${p.mastered?'earned':''}"><small>${sourceName(p.inputSource)}成长记录</small><h3>${p.mastered?'我学会了均匀跟拍':'我正在学均匀跟拍'}</h3><p>${p.mastered?'三次稳定跟拍，成长卡已点亮！':`已稳定完成 ${Math.min(p.count,MASTERY.rounds)} / ${MASTERY.rounds} 次，加油，慢慢来。`}</p>${p.mastered?`<p class="note">${new Date(p.earnedAt).toLocaleDateString('zh-CN')} · 96 BPM · 4/4 拍</p><div class="growth-evidence">${p.evidence.map((id,i)=>`<button type="button" data-report="${esc(id)}">第 ${i+1} 次达标报告</button>`).join('')}</div>`:''}</article>`).join('')}</div><details><summary>成长卡怎样点亮？</summary><p>同一输入方式下，3 次不同的完整练习，每次命中至少 85%，有效拍点占输入至少 85%，命中拍点平均偏差不超过 50 毫秒。混合输入不累计；历史作品缺少时间轴时不补发。</p><p>这是项目内、按当前试行标准记录的学习进步。麦克风可能误检，建议家长一起复核。记录保存在本浏览器。</p></details><button type="button" class="primary" data-rhythm-practice>继续练均匀跟拍</button></section>`;
 }
 function content(track){
  const r=track.report;
  return `<div class="report-heading"><div><small>这次跟拍的小发现</small><h2 id="report-title">${esc(track.title||'我的节奏作品')}</h2></div><button type="button" data-close-report aria-label="关闭跟拍报告">关闭</button></div>${!r?'<p role="status">正在准备分析…</p>':r.status==='unavailable'?`<p role="status">${esc(r.notice)}</p><button type="button" class="primary" data-rhythm-practice>再练一次</button>`:`${r.status==='pending'?'<p class="report-state" role="status">后台分析中，你可以先听作品。下面是本地拍点建议。</p>':''}${r.status==='failed'?`<p class="report-state" role="status">${esc(r.error)}</p><button type="button" data-retry-report>重新分析</button>`:''}<p class="report-source">${r.source==='qwen'?'千问教学建议':'本地拍点反馈'} · ${sourceName(r.inputSource)}</p><div class="report-coaching"><section><h3>你做得好的地方</h3><p>${esc(r.strength)}</p></section><section><h3>下一次试试这样</h3><p>${esc(r.nextStep)}</p></section><section><h3>一个小练习</h3><p>${esc(r.exercise)}</p><button type="button" class="primary" data-rhythm-practice>再练一次</button></section></div><p class="report-progress">${r.qualified?'这次稳定跟拍达标，已计入成长记录。':r.stageId===null?'这次是编排节奏练习，已记录反馈；均匀跟拍成长卡需要完成对应练习。':r.inputSource==='mixed_mic_tap'?'这次混合使用了拍手和按键。下次选一种方式，试试稳定跟拍。':!r.reliable?'这次记录不足以判断掌握情况，先看看建议，再试一次。':'这次已记下练习经历，继续跟着小鼓，成长卡等着你。'}</p><details><summary>给家长看：这次拍点与分析依据</summary><dl class="report-metrics"><div><dt>跟上拍点</dt><dd>${r.metrics.matched} / ${r.metrics.expected}</dd></div><div><dt>漏拍 / 多拍</dt><dd>${r.metrics.missed} / ${r.metrics.extra}</dd></div><div><dt>偏早 / 偏晚</dt><dd>${r.metrics.early} / ${r.metrics.late}</dd></div><div><dt>命中平均偏差</dt><dd>${r.metrics.meanAbsOffsetMs===null?'数据不足':r.metrics.meanAbsOffsetMs+' 毫秒'}</dd></div></dl><p class="note">偏早 / 偏晚：比最近鼓点相差超过 30 毫秒的输入次数。命中偏差只统计跟上的拍点。</p><p class="note">${esc(r.notice)}</p></details>`}`;
 }
 function bind(root=document){
  root.querySelectorAll('[data-report]').forEach(b=>b.onclick=()=>open(b.dataset.report));
  root.querySelectorAll('[data-rhythm-practice]').forEach(b=>b.onclick=()=>{dialog.close();onPractice();});
 }
 function draw(){
  const track=findTrack(currentId);if(!track)return;
  const focused=document.activeElement;const focusKey=dialog.contains(focused)?['data-close-report','data-retry-report','data-rhythm-practice'].find(key=>focused.hasAttribute(key)):null;
  dialog.innerHTML=content(track);dialog.querySelector('[data-close-report]').onclick=()=>dialog.close();
  dialog.querySelector('[data-retry-report]')?.addEventListener('click',()=>startReport(track,{retry:true}));bind(dialog);
  if(dialog.open&&focusKey)(dialog.querySelector(`[${focusKey}]`)||dialog.querySelector('[data-close-report]')).focus();
 }
 function open(id){currentId=id;const track=findTrack(id);if(!track)return;draw();if(!dialog.open)dialog.showModal();if(!track.report||track.report.status==='pending')startReport(track);}
 function refresh(){
  document.querySelectorAll('[data-report]').forEach(b=>{const t=findTrack(b.dataset.report);if(t){const wrapper=document.createElement('div');wrapper.innerHTML=button(t);if(b.classList.contains('report-icon'))b.innerHTML=wrapper.firstElementChild.innerHTML;}});
  const path=document.querySelector('#learning-path-slot');if(path){path.innerHTML=course();bind(path);}
  if(dialog.open)draw();
 }
 return {button,course,bind,refresh,close:()=>dialog.close()};
}
