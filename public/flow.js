import {mountInteriorSession} from './game/interior-session.js';
import {mountInteriorWorld} from './game/interior-world.js';
import {badge} from './flow-medals.js';
import {moodStyles,readMood,trackTitle,renameTrack,gameForMood} from './flow-model.js';
const app=document.querySelector('#app'),notice=document.querySelector('#announcement');
const KEY='lets-clap-v1';
let state={hatched:false,mood:'',tracks:[]};
try{const saved=JSON.parse(localStorage.getItem(KEY));if(saved&&Array.isArray(saved.tracks))state={...state,...saved};}catch{notice.textContent='本地保存暂时不可用，作品完成后可以下载。';}
let view='home',draft=null,scene=null,recognition=null,typing=null,dialogueStep='mood',dialogue=[],editId=null,voiceTimer=null;
const urls=[];
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function sayStatus(text){notice.textContent=text;}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state));return true;}catch{sayStatus('保存失败，请允许浏览器本地存储后重试。');return false;}}
function clean(){scene?.dispose();scene=null;clearInterval(typing);clearTimeout(voiceTimer);recognition?.abort();recognition=null;window.speechSynthesis?.cancel();urls.splice(0).forEach(URL.revokeObjectURL);}
function windmill(){return '<div id="level-preview" class="level-preview" role="img" aria-label="室内节奏乐园"></div>';}
function startGame(){sayStatus('');view='game';$('#room-dialogue').replaceChildren();document.body.dataset.scene='game';scene.start();$('#room-voice').id='voice';$('#voice').onclick=voice;}
function enter(next){sayStatus('');view=next;render();window.scrollTo({top:0,behavior:'instant'});}
function render(){
 clean();document.body.dataset.scene=view;
 document.querySelectorAll('[data-nav]').forEach(b=>{b.classList.toggle('active',b.dataset.nav===view);b.setAttribute('aria-current',b.dataset.nav===view?'page':'false');});
 const steps=['选关卡','室内音乐室','试听作品','专辑墙'];const index={home:0,dialogue:1,game:1,result:2,album:3}[view];
 $('#journey').innerHTML=steps.map((s,i)=>`<span ${i===index?'aria-current="step" class="current"':''}>${i+1} · ${s}</span>`).join('');
 if(view==='home')app.innerHTML=`<section class="level-page"><h1>今天，去哪里冒险？</h1><p>平静和开心，都来室内节奏乐园。</p><button id="choose-level" class="level-card">${windmill()}<span class="level-caption"><strong>心情节奏乐园</strong><span>鲸鱼慢节奏 · 企鹅跳绳</span><b>进入关卡 →</b></span></button><p class="note">进入高高的音乐室，和伙伴聊聊心情，然后一起玩。</p></section>`;
 if(view==='dialogue'){
  const selected=gameForMood(state.mood)||gameForMood('开心');
  const line=dialogueStep==='mood'?(state.hatched?'我们又见面啦！今天你是什么心情？':'你好呀！我是你的音乐伙伴。今天你是什么心情？'): `听见啦，你的心情是${state.mood}。这次和${selected.petName}玩${selected.title}，试试${moodStyles[state.mood].name}的节奏，好吗？准备好就说「开始游戏」。`;
  app.innerHTML='<section id="immersive-room" class="immersive-room" aria-label="室内的对话和音乐游戏"></section>';
  scene=mountInteriorSession($('#immersive-room'),{bpm:selected.bpm,mode:selected.gameId,petId:selected.petId,onCancel:()=>enter('home'),onComplete:result=>{draft={...result,id:result.runId,mood:state.mood,title:`${selected.title} · ${moodStyles[state.mood].name}小调`,date:Date.now(),levelId:selected.gameId,petId:selected.petId,feedback:`${selected.gameId==='jump-rope'?'跳准':'拍准'} ${result.matchedCount} / ${result.expectedCount} 次。`};enter('result');window.dispatchEvent(new CustomEvent('letsclap:completed',{detail:{...draft}}));}});
  $('#room-dialogue').innerHTML=`<div class="dialogue-panel"><div class="speaker">小伙伴 <button id="read-dialogue" class="tiny">听伙伴说</button></div><p class="typed-line" aria-hidden="true" id="typed-line"></p><p class="sr-only" role="status">${esc(line)}</p>${dialogue.length?`<p class="child-answer">你：${esc(dialogue.at(-1))}</p>`:''}<form id="chat-form"><label for="chat-input">${dialogueStep==='mood'?'告诉伙伴你的心情':'回复伙伴'}</label><div class="chat-input-row"><input id="chat-input" aria-label="回复宠物" maxlength="100" autocomplete="off" placeholder="${dialogueStep==='mood'?'我的心情是……':'开始游戏'}"><button class="primary" type="submit">发送</button><button type="button" id="voice">按下说话</button></div></form><p class="note" id="voice-status" role="status">可以用语音，也可以打字或点下面的回答。</p><div class="choices">${dialogueStep==='mood'?['开心','平静'].map(m=>`<button data-answer="我的心情是${m}">${m}</button>`).join(''):'<button class="primary" data-answer="开始游戏">开始游戏</button><button id="change-mood">换个心情</button>'}</div></div>`;
  typeLine(line);$('#read-dialogue').onclick=()=>speak(line);
 }

 if(view==='result'){
  app.innerHTML=`<section class="listen-page"><div class="record"><div class="label">${esc(draft.mood)}<br>${esc(moodStyles[draft.mood]?.name||'小小节奏')}</div></div><div><h1>这是你的音乐作品</h1><p>${esc(trackTitle(draft))}</p><div id="playback-slot"><audio controls src="${audioURL(draft)}" aria-label="试听本次作品"></audio><p class="note">${draft.audioUrl?'已接入作品音频':'当前试听为拍点合成的小鼓；正式音乐试听待接入。'}</p></div><p id="playback-feedback" role="status">${esc(draft.feedback||'一起听听，再把喜欢的作品收进专辑吧。')}</p><div class="actions"><button class="primary" id="save">${state.tracks.some(t=>t.id===draft.id)?'已收藏 · 去专辑墙':'收藏到专辑墙'}</button><button id="voice">按下说话</button><button id="again">再玩一次</button></div><p class="note" id="voice-status" role="status">可以说「播放」「收藏」或「再玩一次」。</p><a href="${audioURL(draft)}" download="lets-clap.wav">下载作品</a></div></section>`;
 }
 if(view==='album')app.innerHTML=`<h1>我的专辑墙</h1><p>每次冒险的音乐，都有一个自己的名字。</p>${albumMedals()}${state.tracks.length?`<div class="collection">${state.tracks.map((t,i)=>`<article class="album-item"><div class="record"><div class="label">${esc(t.mood)}<br>第 ${i+1} 首</div></div>${editId===t.id?`<form data-rename="${esc(t.id)}"><label for="title-${i}">作品名字</label><input id="title-${i}" name="title" maxlength="24" value="${esc(trackTitle(t))}" required><button class="primary" type="submit">保存名字</button><button type="button" id="cancel-rename">取消</button><p class="note" role="status" id="rename-error"></p></form>`:`<h2 class="song-title">${esc(trackTitle(t))}</h2><button data-edit="${esc(t.id)}" aria-label="修改${esc(trackTitle(t))}的名字">修改名字</button>`}<p class="note">${new Date(t.date).toLocaleDateString('zh-CN')} · ${esc(t.mood)}</p><audio controls src="${audioURL(t)}" aria-label="试听${esc(trackTitle(t))}"></audio></article>`).join('')}</div>`:'<div class="empty"><h2>你的第一首作品，会是什么名字？</h2><button class="primary" data-nav="home">去选关卡</button></div>'}`;
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
  const selector=/试听|下一步/.test(text)?'#room-listen':/开始|演奏|救援|风车|跳绳|再来/.test(text)?'#room-play':null;
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
function save(){if(!state.tracks.some(t=>t.id===draft.id)){state.tracks.push({...draft});if(!persist()){state.tracks.pop();return;}}enter('album');sayStatus('作品已收藏，可以给它改个名字。');}
function bind(){
 document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>enter(b.dataset.nav));
 $('#choose-level')?.addEventListener('click',()=>{dialogueStep='mood';dialogue=[];enter('dialogue');});
 $('#chat-form')?.addEventListener('submit',e=>{e.preventDefault();reply($('#chat-input').value);});
 document.querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>reply(b.dataset.answer));
 $('#voice')?.addEventListener('click',voice);$('#change-mood')?.addEventListener('click',()=>{dialogueStep='mood';enter('dialogue');});
 $('#save')?.addEventListener('click',save);$('#again')?.addEventListener('click',()=>enter('home'));
 document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{editId=b.dataset.edit;render();$('input[name="title"]').focus();});
 $('#cancel-rename')?.addEventListener('click',()=>{editId=null;render();});
 document.querySelector('[data-rename]')?.addEventListener('submit',e=>{e.preventDefault();const track=state.tracks.find(t=>t.id===e.target.dataset.rename),old=track?.title;const result=renameTrack(state.tracks,e.target.dataset.rename,new FormData(e.target).get('title'));if(!result.ok){$('#rename-error').textContent=result.error;return;}if(!persist()){track.title=old;return;}editId=null;render();sayStatus('新名字已保存。');});
}
function albumMedals(){const song=state.tracks.some(t=>t.songId==='da-feng-che'&&t.outcome==='escaped');const first=state.tracks.length>0;const moods=new Set(state.tracks.map(t=>t.mood)).size;return `<section class="album-medals" aria-label="我的音乐勋章"><h2>我的音乐勋章</h2><div class="medal-shelf">${[['跳绳达人',state.tracks.some(t=>t.gameId==='jump-rope'&&t.outcome==='completed'),'完成一次开心跳绳'],['大风车',song,'完成正式歌曲后点亮'],['小小音乐家',first,'收藏第一首作品'],['心情收藏家',moods>=3,'收藏三种心情'],['节奏好朋友',state.tracks.length>=5,'收藏五首作品']].map(([title,unlocked,reason])=>`<article class="shelf-medal ${unlocked?'':'locked'}">${badge(title)}<strong>${title} · ${unlocked?'已点亮':'待解锁'}</strong><small>${reason}</small></article>`).join('')}</div></section>`;}
function audioURL(track){if(track.audioUrl)return track.audioUrl;const rate=16000,times=Array.isArray(track.times)?track.times:[];const length=Math.ceil((Math.max(0,...times.map(t=>Math.min(t,60000)))/1000+.5)*rate);const data=new ArrayBuffer(44+length*2),d=new DataView(data);const str=(at,s)=>[...s].forEach((c,i)=>d.setUint8(at+i,c.charCodeAt(0)));str(0,'RIFF');d.setUint32(4,36+length*2,true);str(8,'WAVE');str(12,'fmt ');d.setUint32(16,16,true);d.setUint16(20,1,true);d.setUint16(22,1,true);d.setUint32(24,rate,true);d.setUint32(28,rate*2,true);d.setUint16(32,2,true);d.setUint16(34,16,true);str(36,'data');d.setUint32(40,length*2,true);const samples=new Float32Array(length);for(const ms of times){const at=Math.floor(ms/1000*rate);for(let j=0;j<rate*.22&&at+j<length;j++){const t=j/rate;samples[at+j]+=Math.sin(2*Math.PI*(95*t+1.7*(1-Math.exp(-t*30))))*Math.exp(-t*22)*.6;}}samples.forEach((n,i)=>d.setInt16(44+i*2,Math.max(-1,Math.min(1,n))*32767,true));const url=URL.createObjectURL(new Blob([data],{type:'audio/wav'}));urls.push(url);return url;}
// Playback owner can attach audio after the completed event, without touching this flow.
window.LetsClapPlayback={setResult({runId,audioUrl,feedback}){if(!draft||draft.id!==runId)return false;if(audioUrl&&!/^https?:\/\//.test(audioUrl)&&!audioUrl.startsWith('/'))throw Error('Use a persistent HTTP or relative audio URL');Object.assign(draft,{...(audioUrl?{audioUrl}:{}),...(typeof feedback==='string'?{feedback}:{})});const saved=state.tracks.find(t=>t.id===runId);if(saved){Object.assign(saved,{...(audioUrl?{audioUrl}:{}),...(typeof feedback==='string'?{feedback}:{})});persist();}if(view==='result'||view==='album')render();return true;}};
render();
