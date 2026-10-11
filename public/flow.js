import {loadHandoff} from './integration-handoff.js';
import {createReportController} from './report-controller.js';
import {createReportUI} from './report-view.js';
import {SONG,renderSong} from './game/song-mixer.js';
import {mountInteriorSession} from './game/interior-session.js';
import {mountInteriorWorld} from './game/interior-world.js';
import {badge} from './flow-medals.js';
import {moodStyles,readMood,trackTitle,renameTrack,gameForMood} from './flow-model.js';
const app=document.querySelector('#app'),notice=document.querySelector('#announcement');
const KEY='lets-clap-v1';
let handoff=null;try{handoff=loadHandoff(sessionStorage);}catch{}
let state={hatched:false,mood:'',tracks:[],practiceRuns:[]};
try{const saved=JSON.parse(localStorage.getItem(KEY));if(saved&&Array.isArray(saved.tracks))state={...state,...saved};}catch{notice.textContent='本地保存暂时不可用，作品完成后可以下载。';}
if(!Array.isArray(state.practiceRuns))state.practiceRuns=[];
let view='home',draft=null,scene=null,recognition=null,typing=null,dialogueStep='mood',dialogue=[],voiceTimer=null;
const urls=[];
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function sayStatus(text){notice.textContent=text;}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state));return true;}catch{sayStatus('保存失败，请允许浏览器本地存储后重试。');return false;}}
function clean(){document.querySelectorAll(".album-item audio").forEach(a=>a.pause());scene?.dispose();scene=null;clearInterval(typing);clearTimeout(voiceTimer);recognition?.abort();recognition=null;window.speechSynthesis?.cancel();urls.splice(0).forEach(URL.revokeObjectURL);}
function windmill(){return '<div id="level-preview" class="level-preview" role="img" aria-label="室内节奏乐园"></div>';}
function startGame(){sayStatus('');view='game';$('#room-dialogue').replaceChildren();document.body.dataset.scene='game';scene.start();$('#room-voice').id='voice';$('#voice').onclick=voice;if(handoff){$('#voice').hidden=true;$('#voice-status').textContent='';}}
function enter(next){if(next==='home'){location.assign('/');return;}reportUI.close();sayStatus('');view=next;render();window.scrollTo({top:0,behavior:'instant'});}
function render(){
 clean();document.body.dataset.scene=['integrated','steady'].includes(view)?'dialogue':view;
 document.querySelectorAll('[data-nav]').forEach(b=>{b.classList.toggle('active',b.dataset.nav===view);b.setAttribute('aria-current',b.dataset.nav===view?'page':'false');});
 const steps=['选关卡','室内音乐室','试听作品','专辑墙'];const index={home:0,dialogue:1,integrated:1,steady:1,game:1,result:2,album:3}[view];
 $('#journey').innerHTML=steps.map((s,i)=>`<span ${i===index?'aria-current="step" class="current"':''}>${i+1} · ${s}</span>`).join('');
 if(view==='home')app.innerHTML=`<section class="level-page"><h1>今天，去哪里冒险？</h1><p>平静和开心，都来室内节奏乐园。</p><button id="choose-level" class="level-card">${windmill()}<span class="level-caption"><strong>心情节奏乐园</strong><span>鲸鱼节奏 · 企鹅跳绳</span><b>进入关卡 →</b></span></button><p class="note">进入高高的音乐室，和伙伴聊聊心情，然后一起玩。</p></section>`;
 if(['dialogue','integrated','steady'].includes(view)){
  const selected=['integrated','steady'].includes(view)?{gameId:'jump-rope',petId:handoff?.petId||'penguin',petName:handoff?.pet.name||'小伙伴',title:view==='steady'?'均匀跟拍':'节奏冒险',bpm:view==='steady'?SONG.bpm:handoff.plan.bpm}:gameForMood(state.mood)||gameForMood('开心');
  const activePlan=view==='integrated'?handoff.plan:null;
  const line=dialogueStep==='mood'?(state.hatched?'我们又见面啦！今天你是什么心情？':'你好呀！我是你的音乐伙伴。今天你是什么心情？'): `听见啦，你的心情是${state.mood}。这次和${selected.petName}玩${selected.title}，试试${moodStyles[state.mood].name}的节奏，好吗？准备好就说「开始游戏」。`;
  app.innerHTML='<section id="immersive-room" class="immersive-room" aria-label="室内的对话和音乐游戏"></section>';
  scene=mountInteriorSession($('#immersive-room'),{bpm:selected.bpm,mode:selected.gameId,petId:selected.petId,plan:activePlan,onCancel:()=>enter('home'),onComplete:result=>{draft={...result,id:result.runId,songId:SONG.id,mixVersion:1,sourceBpm:selected.bpm,patternBeats:activePlan?8:result.expectedCount,mioPlan:activePlan,petName:handoff?.pet.name,sourceDurationSec:result.durationSec,durationSec:SONG.duration,mood:state.mood,title:`${selected.title} · ${moodStyles[state.mood].name}小调`,date:Date.now(),levelId:selected.gameId,petId:selected.petId,feedback:`${selected.gameId==='jump-rope'?'跳准':'拍准'} ${result.matchedCount} / ${result.expectedCount} 次。`};rememberCompleted(draft);enter('result');reports.start(draft);window.dispatchEvent(new CustomEvent('letsclap:completed',{detail:{...draft}}));}});
  if(['integrated','steady'].includes(view)){
   $('#room-dialogue').innerHTML=`<div class="dialogue-panel"><h1>${esc(selected.petName)}的${selected.title}</h1><p>${activePlan?'跟着刚才的节奏拍手，空白时休息一下。':'跟着小鼓均匀拍手，每一拍做一次动作。'}</p><button class="primary" id="begin-integrated">开始游戏</button><p class="note">也可以先点上方「开启拍手」，再开始。</p></div>`;
   bind();$('#begin-integrated').onclick=startGame;return;
  }
  $('#room-dialogue').innerHTML=`<div class="dialogue-panel"><div class="speaker">小伙伴 <button id="read-dialogue" class="tiny">听伙伴说</button></div><p class="typed-line" aria-hidden="true" id="typed-line"></p><p class="sr-only" role="status">${esc(line)}</p>${dialogue.length?`<p class="child-answer">你：${esc(dialogue.at(-1))}</p>`:''}<form id="chat-form"><label for="chat-input">${dialogueStep==='mood'?'告诉伙伴你的心情':'回复伙伴'}</label><div class="chat-input-row"><input id="chat-input" aria-label="回复宠物" maxlength="100" autocomplete="off" placeholder="${dialogueStep==='mood'?'我的心情是……':'开始游戏'}"><button class="primary" type="submit">发送</button><button type="button" id="voice">按下说话</button></div></form><p class="note" id="voice-status" role="status">可以用语音，也可以打字或点下面的回答。</p><div class="choices">${dialogueStep==='mood'?['开心','平静'].map(m=>`<button data-answer="我的心情是${m}">${m}</button>`).join(''):'<button class="primary" data-answer="开始游戏">开始游戏</button><button id="change-mood">换个心情</button>'}</div></div>`;
  typeLine(line);$('#read-dialogue').onclick=()=>speak(line);
 }

 if(view==='result'){
  app.innerHTML=`<section class="listen-page"><div class="record"><div class="label" aria-hidden="true"></div></div><div><h1>这是你的音乐作品</h1><p>${esc(trackTitle(draft))}</p><div id="playback-slot"><audio controls src="${audioURL(draft)}" aria-label="试听本次作品"></audio><p class="note">${draft.songId===SONG.id?'大风车伴奏 + 你的鼓点 · 96 BPM · 4/4 拍 · 12 小节 / 48 拍 · 30 秒。':draft.audioUrl?'已接入作品音频':'拍点合成的小鼓作品。'}</p></div><p id="playback-feedback" role="status">${esc(draft.feedback||'一起听听，再把喜欢的作品收进专辑吧。')}</p>${reportUI.button(draft)}<div class="actions"><button class="primary" id="save">${state.tracks.some(t=>t.id===draft.id)?'已收藏 · 去专辑墙':'收藏到专辑墙'}</button><button id="voice">按下说话</button><button id="again">再玩一次</button></div><p class="note" id="voice-status" role="status">可以说「播放」「收藏」或「再玩一次」。</p><a id="download-song" href="${audioURL(draft)}" download="${draft.songId===SONG.id?'大风车-我的节奏作品':'lets-clap'}.wav">下载作品</a></div></section>`;
 }
 if(view==='album')app.innerHTML=`<h1>我的专辑墙</h1><p>每次冒险的音乐，都有一个自己的名字。</p>${albumMedals()}<div id="learning-path-slot">${reportUI.course()}</div>${state.tracks.length?`<div class="collection">${state.tracks.map((t,i)=>`<article class="album-item" data-track-id="${esc(t.id)}" data-mood="${esc(t.mood)}"><div class="album-art"><button type="button" class="record record-play" aria-label="播放${esc(trackTitle(t))}" aria-pressed="false"><svg class="vinyl-etch" viewBox="0 0 220 220" aria-hidden="true"><g fill="none" stroke="#6c656b" stroke-width=".8" opacity=".55"><path d="M37 75a82 82 0 0 1 58-47M40 76a79 79 0 0 1 56-45M43 77a76 76 0 0 1 54-43"/><path d="M182 149a82 82 0 0 1-33 33M179 147a79 79 0 0 1-31 32"/></g><path d="M61 43l3 3M65 40l3 3" stroke="#797076" stroke-width="1" opacity=".55"/></svg><span class="label" aria-hidden="true"></span></button><svg class="record-arm" viewBox="0 0 90 150" aria-hidden="true"><circle cx="70" cy="10" r="8" fill="#a8a099"/><circle cx="70" cy="10" r="4" fill="#eee6dc"/><path d="M70 13L66 76Q65 95 49 107L29 126" fill="none" stroke="#b3aaa1" stroke-width="7" stroke-linecap="round"/><path d="M70 13L66 76Q65 95 49 107L29 126" fill="none" stroke="#eee7de" stroke-width="4" stroke-linecap="round"/><path d="m26 120 10 10-10 10-10-10Z" fill="#ddd4c9" stroke="#a3988b" stroke-width="1"/></svg></div><input class="track-title" aria-label="作品名字 ${i+1}，点击修改" value="${esc(trackTitle(t))}" maxlength="24" readonly><p class="note">${new Date(t.date).toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false})} · ${esc(t.mood)}</p><audio preload="metadata" src="${audioURL(t)}" hidden></audio><div class="vinyl-progress"><span class="elapsed">0:00</span><input class="track-seek" type="range" min="0" max="1" step="0.01" value="0" disabled aria-label="${esc(trackTitle(t))}的播放进度"><span class="duration">—:—</span></div><p class="record-status" role="status">点击唱片播放 · 点击名字修改</p>${reportUI.button(t)}</article>`).join('')}</div>`:'<div class="empty"><h2>你的第一首作品，会是什么名字？</h2><button class="primary" data-nav="home">去选关卡</button></div>'}`;
 bind();
 if(view==='home')scene=mountInteriorWorld($('#level-preview'),{petId:'penguin'});
}
function typeLine(line){let n=0;const target=$('#typed-line');if(matchMedia('(prefers-reduced-motion: reduce)').matches){target.textContent=line;return;}typing=setInterval(()=>{target.textContent=line.slice(0,++n);if(n>=line.length)clearInterval(typing);},45);target.onclick=()=>{clearInterval(typing);target.textContent=line;};}
function speak(text){if(!window.speechSynthesis){sayStatus('浏览器暂时不能朗读，可以看对话文字。');return;}window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);utterance.lang='zh-CN';utterance.rate=.85;utterance.onerror=()=>sayStatus('朗读暂时不可用，可以继续看文字。');window.speechSynthesis.speak(utterance);}
function reply(text){
 text=text.trim();if(!text)return;
 if(view==='dialogue'){
  const mood=readMood(text);
  if(mood&&!gameForMood(mood)){$('#voice-status').textContent='兴奋的关卡还没开放，这次先选开心或平静吧。';return;}
  if(mood){state.mood=mood;state.hatched=true;persist();dialogue.push(text);dialogueStep='ready';render();return;}
  if(/开始|出发|准备好|好呀|好的/.test(text)&&dialogueStep==='ready'){startGame();return;}
  $('#voice-status').textContent=dialogueStep==='mood'?'听见你的回答啦。这次想试试开心还是平静？':'可以说「开始游戏」，或者换一个心情。';return;
 }
 if(view==='game'){
  if(/返回|回去/.test(text)){enter('dialogue');return;}
  const selector=/试听|下一步/.test(text)?'#room-listen':/开始|演奏|救援|风车|跳绳|再来/.test(text)?'#room-tap':null;
  const button=selector?$(selector):null;
  if(button&&!button.disabled&&!button.hidden){button.click();return;}
  $('#voice-status').textContent='可以说「再来一次」；完成游戏后说「试听作品」。';return;
 }
 if(view==='result'){
  if(/收藏|保存|专辑/.test(text)){save();return;}
  if(/再玩|再来|返回/.test(text)){enter('home');return;}
  if(/播放|试听/.test(text)){$('audio').play().catch(()=>sayStatus('请点试听播放器开始播放。'));return;}
  $('#voice-status').textContent='可以说「播放」「收藏」或「再玩一次」。';
 }
}
function voice(){
 const status=$('#voice-status');const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!SR){status.textContent='这个浏览器不支持语音，请打字或使用按钮继续。';return;}
 if(recognition){recognition.abort();recognition=null;clearTimeout(voiceTimer);status.textContent='语音已停止，可以再次按下说话。';return;}
 window.speechSynthesis?.cancel();const current=new SR();recognition=current;current.lang='zh-CN';status.textContent='正在听，请说出你的回答…';
 current.onresult=e=>{const text=e.results[0][0].transcript;status.textContent=`听到：${text}`;reply(text);};
 current.onerror=e=>{status.textContent=e.error==='not-allowed'?'麦克风权限没有打开，请打字或用按钮继续。':'没有听清，请再试一次，也可以打字或用按钮。';};
 current.onend=()=>{if(recognition===current)recognition=null;clearTimeout(voiceTimer);if(status.textContent.includes('正在听'))status.textContent='没有听到回答，请重试，或用文字和按钮继续。';};
 try{current.start();voiceTimer=setTimeout(()=>current.stop(),12000);}catch{recognition=null;status.textContent='语音未能启动，请用文字或按钮继续。';}
}
function save(){if($('#save')?.disabled){sayStatus('歌曲正在合成，请稍等。');return;}if(!state.tracks.some(t=>t.id===draft.id)){state.tracks.push({...draft});if(!persist()){state.tracks.pop();return;}}enter('album');sayStatus('作品已收藏，可以给它改个名字。');}
function bind(){
 reportUI.bind(app);
 bindAlbumPlayers();
 if(view==='result'&&draft.songId===SONG.id&&!draft.audioUrl)prepareResultSong();
 document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>enter(b.dataset.nav));
 $('#choose-level')?.addEventListener('click',()=>{dialogueStep='mood';dialogue=[];enter('dialogue');});
 $('#chat-form')?.addEventListener('submit',e=>{e.preventDefault();reply($('#chat-input').value);});
 document.querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>reply(b.dataset.answer));
 $('#voice')?.addEventListener('click',voice);$('#change-mood')?.addEventListener('click',()=>{dialogueStep='mood';enter('dialogue');});
 $('#save')?.addEventListener('click',save);$('#again')?.addEventListener('click',()=>enter('home'));

}
async function prepareResultSong(){
 const track=draft,audio=$('#playback-slot audio'),link=$('#download-song'),button=$('#save'),feedback=$('#playback-feedback');
 button.disabled=true;link.hidden=true;audio.removeAttribute('src');feedback.textContent='正在把伴奏和你的鼓点合成一首歌…';
 try{
  const blob=await renderSong(track);if(!audio.isConnected)return;
  const url=URL.createObjectURL(blob);urls.push(url);audio.src=url;link.href=url;link.hidden=false;button.disabled=false;
  feedback.textContent=track.feedback+(track.times.length?' 你的鼓点已经加入完整伴奏。':' 这次没有记录到鼓点，先听听伴奏，下次再一起演奏。');
 }catch{
  if(!audio.isConnected)return;feedback.textContent='伴奏没有加载成功，作品还在，请重试。';
  const retry=document.createElement('button');retry.textContent='重新合成';retry.onclick=()=>{retry.remove();prepareResultSong();};feedback.append(retry);
 }
}
function bindAlbumPlayers(){
 const format=t=>Number.isFinite(t)?`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`:'—:—';
 document.querySelectorAll('.album-item').forEach(card=>{
  const audio=card.querySelector('audio'),disc=card.querySelector('.record-play'),seek=card.querySelector('.track-seek'),title=card.querySelector('.track-title'),status=card.querySelector('.record-status');
  const track=state.tracks.find(t=>t.id===card.dataset.trackId);
  function sync(){const valid=Number.isFinite(audio.duration)&&audio.duration>0;seek.disabled=!valid;seek.max=valid?audio.duration:1;seek.value=audio.currentTime;seek.style.setProperty('--played',`${valid?audio.currentTime/audio.duration*100:0}%`);card.querySelector('.elapsed').textContent=format(audio.currentTime);card.querySelector('.duration').textContent=format(audio.duration);seek.setAttribute('aria-label',`${trackTitle(track)}的播放进度`);seek.setAttribute('aria-valuetext',`${format(audio.currentTime)} / ${format(audio.duration)}`);disc.classList.toggle('is-playing',!audio.paused&&!audio.ended);card.classList.toggle('is-playing',!audio.paused&&!audio.ended);disc.setAttribute('aria-pressed',String(!audio.paused&&!audio.ended));disc.setAttribute('aria-label',`${audio.paused?'播放':'暂停'}${trackTitle(track)}`);}
  ['loadedmetadata','durationchange','timeupdate','play','pause','ended'].forEach(event=>audio.addEventListener(event,()=>{sync();if(event==='play')status.textContent='正在播放 · 点击唱片暂停';if(event==='pause')status.textContent='已暂停 · 点击唱片继续';if(event==='ended')status.textContent='播放结束 · 点击唱片再听一次';}));
  audio.addEventListener('error',()=>{sync();status.textContent='音频暂时无法播放，点击唱片重试。';});
  let ready=Promise.resolve();
  function prepare(){status.textContent='正在合成伴奏和你的鼓点…';disc.disabled=true;return renderSong(track).then(blob=>{if(!card.isConnected)return;const url=URL.createObjectURL(blob);urls.push(url);audio.src=url;audio.load();status.textContent='点击唱片播放 · 点击名字修改';}).catch(()=>{if(card.isConnected)status.textContent='伴奏未能加载，点击唱片重试。';throw Error('Song render failed');}).finally(()=>{disc.disabled=false;});}
  if(track.songId===SONG.id&&!track.audioUrl){ready=prepare();ready.catch(()=>{});}
  disc.onclick=async()=>{if(!audio.paused){audio.pause();return;}document.querySelectorAll('.album-item audio').forEach(other=>{if(other!==audio)other.pause();});try{try{await ready;}catch{ready=prepare();await ready;}if(!card.isConnected)return;if(audio.error)audio.load();if(audio.ended)audio.currentTime=0;status.textContent='正在准备播放…';await audio.play();}catch{status.textContent='播放未能开始，请再次点击唱片。';sync();}};
  seek.oninput=()=>{if(Number.isFinite(audio.duration))audio.currentTime=Number(seek.value);sync();};
  function edit(){title.readOnly=false;title.classList.add('editing');title.select();}
  title.onclick=edit;title.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();if(title.readOnly)edit();else title.blur();}if(e.key==='Escape'){title.value=trackTitle(track);title.readOnly=true;title.classList.remove('editing');title.blur();}};
  title.onblur=()=>{if(title.readOnly)return;const old=track.title;const result=renameTrack(state.tracks,track.id,title.value);if(!result.ok){title.value=trackTitle(track);status.textContent=result.error;}else if(!persist()){track.title=old;title.value=trackTitle(track);status.textContent='名字保存失败，请重试。';}else{title.value=trackTitle(track);status.textContent='名字已保存。';}title.readOnly=true;title.classList.remove('editing');sync();};
  sync();
 });
}
function albumMedals(){const song=state.tracks.some(t=>t.songId===SONG.id&&(t.outcome==='escaped'||t.outcome==='completed')); const first=state.tracks.length>0;const moods=new Set(state.tracks.map(t=>t.mood)).size;return `<section class="album-medals" aria-label="我的音乐勋章"><h2>我的音乐勋章</h2><div class="medal-shelf">${[['跳绳达人',state.tracks.some(t=>t.gameId==='jump-rope'&&t.outcome==='completed'),'完成一次开心跳绳'],['大风车',song,'完成正式歌曲后点亮'],['小小音乐家',first,'收藏第一首作品'],['心情收藏家',moods>=3,'收藏三种心情'],['节奏好朋友',state.tracks.length>=5,'收藏五首作品']].map(([title,unlocked,reason])=>`<article class="shelf-medal ${unlocked?'':'locked'}">${badge(title,unlocked)}<strong>${title} · ${unlocked?'已点亮':'待解锁'}</strong><small>${reason}</small></article>`).join('')}</div></section>`;}
function audioURL(track){if(track.audioUrl)return track.audioUrl;if(track.songId===SONG.id)return '';const rate=16000,times=Array.isArray(track.times)?track.times:[];const length=Math.ceil((Math.max(0,...times.map(t=>Math.min(t,60000)))/1000+.5)*rate);const data=new ArrayBuffer(44+length*2),d=new DataView(data);const str=(at,s)=>[...s].forEach((c,i)=>d.setUint8(at+i,c.charCodeAt(0)));str(0,'RIFF');d.setUint32(4,36+length*2,true);str(8,'WAVE');str(12,'fmt ');d.setUint32(16,16,true);d.setUint16(20,1,true);d.setUint16(22,1,true);d.setUint32(24,rate,true);d.setUint32(28,rate*2,true);d.setUint16(32,2,true);d.setUint16(34,16,true);str(36,'data');d.setUint32(40,length*2,true);const samples=new Float32Array(length);for(const ms of times){const at=Math.floor(ms/1000*rate);for(let j=0;j<rate*.22&&at+j<length;j++){const t=j/rate;samples[at+j]+=Math.sin(2*Math.PI*(95*t+1.7*(1-Math.exp(-t*30))))*Math.exp(-t*22)*.6;}}samples.forEach((n,i)=>d.setInt16(44+i*2,Math.max(-1,Math.min(1,n))*32767,true));const url=URL.createObjectURL(new Blob([data],{type:'audio/wav'}));urls.push(url);return url;}
// Playback owner can attach audio after the completed event, without touching this flow.
window.LetsClapPlayback={setResult({runId,audioUrl,feedback}){if(!draft||draft.id!==runId)return false;if(audioUrl&&!/^https?:\/\//.test(audioUrl)&&!audioUrl.startsWith('/'))throw Error('Use a persistent HTTP or relative audio URL');Object.assign(draft,{...(audioUrl?{audioUrl}:{}),...(typeof feedback==='string'?{feedback}:{})});const saved=state.tracks.find(t=>t.id===runId);if(saved){Object.assign(saved,{...(audioUrl?{audioUrl}:{}),...(typeof feedback==='string'?{feedback}:{})});persist();}if(view==='result'||view==='album')render();return true;}};
const reports=createReportController({onChange(track){
 const practice=state.practiceRuns.find(t=>t.id===track.id),saved=state.tracks.find(t=>t.id===track.id);
 if(practice)practice.report=track.report;if(saved)saved.report=track.report;
 persist();reportUI.refresh();
}});
const reportUI=createReportUI({findTrack:id=>state.tracks.find(t=>t.id===id)||state.practiceRuns.find(t=>t.id===id)||(draft?.id===id?draft:null),getTracks:()=>[...state.practiceRuns,...state.tracks],startReport:(track,options)=>reports.start(track,options),onPractice:()=>{reportUI.close();view='steady';render();}});
function rememberCompleted(track){if(!state.practiceRuns.some(t=>t.id===track.id)){state.practiceRuns.push(track);persist();}}
if(new URLSearchParams(location.search).get('view')==='album')view='album';else if(handoff){view='integrated';state.mood=handoff.mood;state.hatched=true;}
window.addEventListener('pagehide',clean);
if(!handoff&&view!=='album')location.replace('/');else render();
