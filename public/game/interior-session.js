import {RHYTHM} from './rhythm.js';
import {createClapInput} from './clap-input.js';
import {createEscapeRun} from './escape-engine.js';
import {createRescueWorld} from './escape-world.js';
import {createJumpRopeRun} from './jump-rope-engine.js';
import {mountInteriorWorld} from './interior-world.js';
import {createAmbience} from './night-music.js';
export function mountInteriorSession(root,{bpm=RHYTHM.bpm,mode='jump-rope',petId='penguin',plan=null,onComplete,onCancel}={}){
 const isRope=mode==='jump-rope',beats=plan?Math.round(plan.durationSec*bpm/60):RHYTHM.beats,targetCount=plan?.expectedOnsetsSec.length??beats;
 root.dataset.gameId=mode;root.dataset.petId=petId;
 root.dataset.sessionId=crypto.randomUUID();
 root.innerHTML='<div class="mill-stage" id="mill-world" role="img" aria-label="月夜风车内，生成的毛绒宠物跟随节奏跳绳"></div><div class="room-top"><div><button id="room-clap" aria-pressed="false">开启拍手</button> <button id="room-music" aria-pressed="true">背景音乐：开</button> <button id="room-exit">退出关卡</button></div></div><p id="clap-status" class="note clap-status" role="status"></p><div id="jump-callout" class="jump-callout" aria-hidden="true"></div><div id="rhythm-focus" hidden><p id="room-status" role="status">准备</p><div class="room-beats" aria-label="下一次起跳倒计时"></div></div><div id="room-dialogue"></div><div id="room-game" hidden><div class="jump-score"><span id="jump-hits">跳准 0 / 48</span><span id="jump-combo">连跳 0</span></div><p id="jump-feedback" class="sr-only" role="status"></p><div class="room-actions"><button id="room-tap" class="primary">跳一下</button><button id="room-voice">按下说话</button><button id="room-listen" hidden>试听作品</button></div><p class="note" id="voice-status" role="status"></p></div><p class="room-assets" id="room-assets" role="status">伙伴正在走进音乐室…</p>';
 const q=s=>root.querySelector(s),host=q('#mill-world'),status=q('#room-status'),play=q('#room-tap'),tap=q('#room-tap');let world=null,run=null,audio=null,ambience=null,frame=null,phase='dialogue',disposed=false,startAt=0,sources=[],muted=false,lastContact=-1,lastBeat=null,mic=null,micPending=false,micGeneration=0,inputMode='tap_demo',clapCount=0,roundInputSource='tap_demo';
 host.setAttribute('aria-label',isRope?(petId==='whale'?'平静鲸鱼室内节奏':'开心企鹅节奏跳绳'):'平静鲸鱼风车场景');tap.textContent=isRope?'跳一下':'拍一下';if(!isRope){q('#room-status').textContent='慢慢跟着拍点，让风车安静下来。';q('#jump-feedback').textContent='听四拍准备，和悠悠一起拍。';q('#voice-status').textContent='点「拍一下」或按空格 · 可以说「开始风车」「试听作品」';}
 try{world=isRope?mountInteriorWorld(host,{petId}):createRescueWorld(host,{petId:'whale',calm:true});host.addEventListener('assetloaded',()=>q('#room-assets').textContent='');host.addEventListener('asseterror',()=>q('#room-assets').textContent='伙伴模型未加载，请刷新重试；下面的节奏按钮仍可使用。');}catch{q('#room-assets').textContent='立体场景暂时无法显示，可用下面的按钮继续节奏练习。';}
 function stop(closeAudio=true){cancelAnimationFrame(frame);ambience?.stop();ambience=null;sources.forEach(o=>{try{o.stop();}catch{}});sources=[];if(closeAudio){micGeneration++;mic?.stop();mic=null;audio?.close();audio=null;}}
 async function begin(){if(micPending){q('#clap-status').textContent='请先完成麦克风授权，再开始游戏。';return;}if(disposed||['loading','counting','running'].includes(phase))return;stop(false);delete host.dataset.roundStartMs;run=isRope?createJumpRopeRun({bpm,beats,runId:crypto.randomUUID(),onsets:plan?.expectedOnsetsSec,planId:plan?.planId}):createWindmillRun(bpm);phase='loading';root.dataset.phase=phase;clapCount=0;tap.textContent='准备…';play.disabled=true;tap.disabled=true;q('#room-listen').hidden=true;q('#jump-feedback').textContent=isRope?'先听四拍准备，再跟着绳子跳。':'先听四拍准备，再慢慢跟拍。';q('.room-beats').innerHTML='<span>1</span><span>2</span><span>3</span><span>4</span>';q('#jump-hits').textContent=`${isRope?'跳准':'拍准'} 0 / ${targetCount}`;q('#jump-combo').textContent='连跳 0';lastContact=-1;lastBeat=null;q('#jump-callout').className='jump-callout';world?.reset?.();if(!isRope)world?.update({phase:'ready',position:.08});
  try{audio??=new AudioContext({latencyHint:'interactive'});await audio.resume();if(inputMode==='microphone_clap'&&!mic)await openMic();roundInputSource=inputMode;if(isRope){status.textContent='伙伴准备好后，我们就出发。';await world?.ready;}if(disposed)return;if(audio.state!=='running')throw Error();startAt=audio.currentTime+.2+RHYTHM.countInBeats*run.period;host.dataset.bpm=String(bpm);host.dataset.beats=String(beats);host.dataset.duration=String(run.duration);host.dataset.roundStartMs=String(Date.now()+(startAt-audio.currentTime)*1000);
   const cues=[...Array.from({length:RHYTHM.countInBeats},(_,i)=>(i-RHYTHM.countInBeats)*run.period),...run.expected];
   for(const [i,cueAt] of cues.entries()){const o=audio.createOscillator(),g=audio.createGain(),at=startAt+cueAt;o.frequency.setValueAtTime(isRope&&i%4===0?240:180,at);o.frequency.exponentialRampToValueAtTime(65,at+.12);g.gain.setValueAtTime(isRope&&i%4===0?.32:.24,at);g.gain.exponentialRampToValueAtTime(.001,at+.16);o.connect(g).connect(audio.destination);o.start(at);o.stop(at+.18);sources.push(o);}
   ambience=createAmbience(audio,startAt,run.duration,isRope&&petId!=='whale'?'happy':'calm');ambience.setMuted(muted);phase='counting';play.textContent=isRope?'跳一下':'拍一下';frame=requestAnimationFrame(tick);
  }catch(error){phase='ready';root.dataset.phase=phase;play.textContent='重试';play.disabled=false;tap.disabled=false;status.textContent=error.message||'声音未启动，请重试';}
 }
 function feedback(accepted,combo=0){
  const callout=q('#jump-callout');callout.innerHTML=accepted?`<strong>跳准！</strong><span>连跳 ${combo}</span>`:'<strong>绊绳啦</strong><span>等下一拍，再来！</span>';callout.className='jump-callout';void callout.offsetWidth;callout.classList.add('show',accepted?'clear':'trip');
  q('#jump-feedback').textContent=accepted?`跳准啦！绳子从脚下过去了 · 连跳 ${combo}`:'绊绳啦！连跳重新开始，下一拍再试一次。';
  if(audio?.state==='running'&&inputMode!=='microphone_clap'){const o=audio.createOscillator(),g=audio.createGain(),now=audio.currentTime;o.type=accepted?'sine':'triangle';o.frequency.setValueAtTime(accepted?880:150,now);o.frequency.exponentialRampToValueAtTime(accepted?1320:75,now+.12);g.gain.setValueAtTime(accepted?.12:.09,now);g.gain.exponentialRampToValueAtTime(.001,now+.17);o.connect(g).connect(audio.destination);o.start(now);o.stop(now+.18);sources.push(o);}
 }
 function tick(){if(disposed||!audio)return;const t=audio.currentTime-startAt;host.dataset.elapsed=String(t);host.dataset.sampleTimeMs=String(Date.now());if(t>=run.duration){phase='done';root.dataset.phase=phase;tap.disabled=false;play.disabled=false;play.textContent=isRope?'再跳一次':'再拍一次';const result={...run.finish(run.duration),inputSource:roundInputSource,clapCount};mic?.stop();mic=null;q('#clap-status').textContent=inputMode==='microphone_clap'?`本轮识别 ${clapCount} 次拍手 · 麦克风已关闭`:q('#clap-status').textContent;world?.update({phase:isRope?'done':result.outcome==='escaped'?'escaped':'retry',position:result.position??.5,elapsed:t,bpm});status.textContent=`完成啦！${isRope?'跳准':'拍准'} ${result.matchedCount} / ${targetCount} 次`;q('#jump-combo').textContent=isRope?`最长连跳 ${result.bestCombo}`:result.windmillStopped?'风车安静下来啦':'再跟着悠悠试一次';q('#jump-feedback').textContent=isRope?(result.outcome==='completed'?'完成！':'完成！'):'一起听听这次舒缓的小节奏。';const next=q('#room-listen');next.hidden=false;next.onclick=()=>onComplete(result);return;}
  phase=t<0?'counting':'running';root.dataset.phase=phase;tap.disabled=t<0;status.textContent=t<0?`准备 ${Math.min(4,Math.ceil(-t/run.period))}`:`剩 ${Math.max(0,beats-Math.floor(t/run.period))} 拍`;
  const snap=run.snapshot(Math.max(0,t));if(isRope){while(lastContact+1<run.expected.length&&t>=run.expected[lastContact+1]+run.crossingDelay){lastContact++;const clear=run.isCleared(lastContact);world?.contact({elapsed:run.expected[lastContact]+run.crossingDelay,accepted:clear});host.dataset.lastContact=clear?'clear':'trip';feedback(clear,snap.combo);}}q('#jump-hits').textContent=`${isRope?'跳准':'拍准'} ${snap.matchedCount} / ${targetCount}`;q('#jump-combo').textContent=isRope?`连跳 ${snap.combo}`:'让风车慢下来';
  const beat=Math.max(0,Math.floor(t/run.period));if(beat!==lastBeat){lastBeat=beat;q('.room-beats').classList.remove('pulse');void q('.room-beats').offsetWidth;q('.room-beats').classList.add('pulse');}q('.room-beats').querySelectorAll('span').forEach((n,i)=>{n.classList.toggle('current',i===beat%4);n.style.setProperty('--approach',String(t<0?0:1-((t/run.period)%1+1)%1));});world?.update({phase,position:snap.position??.5,elapsed:t,bpm:run.motionBpm??bpm,beat,onsets:plan?run.expected:null,crossingDelay:run.crossingDelay});frame=requestAnimationFrame(tick);
 }
 function hit(at=audio?.currentTime,source='tap_demo'){if(!['counting','running'].includes(phase)||!Number.isFinite(at)||at<startAt)return;if(inputMode==='microphone_clap'&&source==='tap_demo')roundInputSource='mixed_mic_tap';const t=at-startAt,result=run.ingest(t);if(!result.jump){if(result.reason==='airborne')q('#jump-feedback').textContent='还在空中呢，落地后再跳。';return;}world?.hit({elapsed:t,accepted:result.accepted});host.dataset.lastJump=result.accepted?'hit':'miss';if(result.accepted){q('#jump-feedback').textContent=isRope?'起跳！让绳子从脚下过去…':'拍准啦！风车又慢了一点。';}else{q('#jump-feedback').textContent=isRope?(result.reason==='early'?'跳早啦！下次跟着鼓点跳。':'跳晚啦！下一拍早点准备。'):'等下一拍，慢慢来。';}tap.classList.remove('tapped');void tap.offsetWidth;tap.classList.add('tapped');}
 async function openMic(){
  const generation=++micGeneration;micPending=true;q('#room-clap').disabled=true;
  q('#clap-status').textContent='正在开启麦克风，随后安静 1 秒校准环境…';
  try{
   audio??=new AudioContext({latencyHint:'interactive'});
   const capture=await createClapInput(audio,{onClap:event=>{
    if(disposed||generation!==micGeneration)return;
    const inRound=event.at>=startAt&&event.at<startAt+(run?.duration||0)&&['counting','running'].includes(phase);
    if(inRound){clapCount++;hit(event.at,'microphone_clap');}
    q('#clap-status').textContent=`听到拍手${inRound?` · 本轮 ${clapCount} 次`:''} · 处理与消息延迟 ${Math.round(event.deliveryMs)} ms`;
   },onMeter:meter=>{
    if(disposed||generation!==micGeneration)return;
    root.dataset.micLevel=String(meter.level);root.dataset.micReady=String(meter.ready);
    if(!meter.ready)q('#clap-status').textContent='麦克风已开启 · 请安静 1 秒，正在校准…';
    else if(q('#clap-status').textContent.includes('校准'))q('#clap-status').textContent='拍手已就绪 · 跟着亮点拍手 · 建议戴耳机';
   },onEnded:()=>{mic=null;if(['counting','running'].includes(phase))roundInputSource='mixed_mic_tap';inputMode='tap_demo';q('#room-clap').textContent='重新开启拍手';q('#room-clap').setAttribute('aria-pressed','false');q('#clap-status').textContent='麦克风连接中断，已切回按钮输入。';}});
   if(disposed||generation!==micGeneration){capture.stop();return;}
   mic=capture;inputMode='microphone_clap';q('#room-clap').textContent='关闭拍手';q('#room-clap').setAttribute('aria-pressed','true');
  }catch(error){if(!disposed&&generation===micGeneration){inputMode='tap_demo';q('#clap-status').textContent=error.message;q('#room-clap').textContent='重试拍手';q('#room-clap').setAttribute('aria-pressed','false');}throw error;}
  finally{micPending=false;if(!disposed)q('#room-clap').disabled=false;}
 }
 q('#room-clap').onclick=async()=>{
  if(micPending)return;
  if(['loading','counting','running'].includes(phase)){q('#clap-status').textContent='请在这一轮结束后切换输入方式。';return;}
  if(inputMode==='microphone_clap'){micGeneration++;mic?.stop();mic=null;inputMode='tap_demo';q('#room-clap').textContent='开启拍手';q('#room-clap').setAttribute('aria-pressed','false');q('#clap-status').textContent='麦克风已关闭 · 可用按钮或空格继续。';return;}
  try{await openMic();}catch{}
 };
 const key=e=>{if(e.code==='Space'&&!e.repeat&&phase==='running'&&!['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)){e.preventDefault();hit();}};
 document.addEventListener('keydown',key);tap.onclick=()=>{if(['ready','done'].includes(phase)){begin();return;}hit();};q('#room-exit').onclick=onCancel;q('#room-music').onclick=()=>{muted=!muted;ambience?.setMuted(muted);q('#room-music').textContent=muted?'背景音乐：关':'背景音乐：开';q('#room-music').setAttribute('aria-pressed',String(!muted));};
 return {start(){root.dataset.playing='true';q('#room-dialogue').hidden=true;q('#room-game').hidden=false;q('#rhythm-focus').hidden=false;phase='ready';begin();},begin,dispose(){disposed=true;stop();world?.dispose();document.removeEventListener('keydown',key);}};
}

function createWindmillRun(bpm){const base=createEscapeRun({bpm,movement:'brake',runId:crypto.randomUUID()});return {...base,period:60/bpm,ingest(t){return {...base.ingest(t),jump:true};},finish(t){return {...base.finish(t),gameId:'windmill'};}};}
