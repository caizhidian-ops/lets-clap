import {AudioEngine} from '../audio/engine.js';
import {analyze} from '../audio/analysis.js';
import {loadPet,savePet,loadWork,saveWork,deleteWork} from '../store/storage.js';
import {petArt,petStyles} from '../scenes/pet/art.js';
import {eggArt,hatchFrame,HATCH_REVEAL_MS} from '../scenes/pet/hatch.js';
import {prompts,promptForState} from './prompts.js';
import {VoiceEndpoint} from '../audio/voice-endpoint.js';
const app=document.querySelector('#app'),audio=new AudioEngine();
let state,config,attempt=null,accepted=null,busy=false,playing=false,voiceActive=false,voicePending=false,ws=null,voiceTurn=null,personality='happy',voiceTimer=null,speechBusy=false,nameCandidate='',toastTimer,voiceReady=null,hatchRevealTimer=null,cueAudio=null,cueResolve=null,hatchRun=0;
let actPending=0,voiceEnabled=false,guidanceSerial=0,spokenKey='',previewedKey='',recordReady=false,pendingLocal=null,devOpen=false,voiceError='';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={happy:'开心',calm:'平静',excited:'兴奋'};
const personalities={happy:'欢快',quiet:'安静',silly:'搞怪'};
function toast(message){document.querySelector('.toast')?.remove();const n=document.createElement('div');n.className='toast';n.role='status';n.textContent=message;document.body.append(n);clearTimeout(toastTimer);toastTimer=setTimeout(()=>n.remove(),5500);}
async function api(path,payload){
  const r=await fetch('/api/'+path,payload?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}:{});
  const data=await r.json();if(!r.ok)throw Error(data.error||'请求失败');return data;
}
async function act(action,payload={}){
  const prev=state?.state;
  actPending++;let next;try{next=await api('action',{action,payload,sceneVersion:state.sceneVersion,turnId:crypto.randomUUID()});}finally{actPending--;}state=next;
  if(action==='confirm_name')try{savePet(state.pet);}catch{toast('本地存储不可用，宠物本次会话可用。');}
  if(action.includes('difficulty')||action==='select_mood')attempt=null;
  if(prev!==state.state){stopVoice();cancelGuidance();}
  if(action.includes('difficulty')||action==='select_mood'){previewedKey='';recordReady=false;}
  render();return state;
}
function button(label,action,kind='',disabled=false){return '<button class="'+kind+'" data-action="'+action+'" '+(disabled?'disabled':'')+'>'+label+'</button>';}
function scene(){return '<div class="scene" aria-hidden="true"><div class="sun"></div><div class="cloud"></div><div class="cloud second"></div><div class="hill"></div><div class="hill two"></div><div class="path"></div><div class="flower">✿</div>'+(isHome()?'':'<div class="windmill"><div class="tower"></div><div class="roof"></div><div class="door"></div><div class="window"></div><div class="blades"><i></i><i></i><i></i><i></i></div></div>')+'</div>';}
function isHome(){return ['HATCH_SELECT','HATCH_GUIDE','HATCH_REVEAL','PET_NAMING','PET_HOME'].includes(state.state);}
function rhythm(){
  const plan=state.plan;if(!plan)return '';
  return '<div class="rhythm" aria-label="两小节节奏">'+Array.from({length:16},(_,i)=>{
    const e=plan.events.find(e=>e.atBeat===i/2);
    const text=e&&!e.rest?'👏':'·';
    return (i%8===0?'<div class="measure-title">第 '+(i/8+1)+' 小节 · 4 拍</div>':'')+'<div class="beat '+(!e||e.rest?'rest':'')+'" data-slot="'+i+'">'+text+'</div>';
  }).join('')+'</div><p class="hint">小手掌亮起来时拍一下，暗下来时等一等。</p>';
}
function meta(){return '<div class="meta"><span class="pill">'+labels[state.plan.mood]+'</span><span class="pill">难度 '+state.plan.difficulty+' / 3</span><span class="pill">4/4 · '+state.plan.bpm+' BPM</span></div><p class="hint">'+(state.plan.source==='ai_validated'?'千问编排 · 已通过知识库校验':'开发模式 / 规则后备编排')+' · 仅前两小节</p>';}
function adjustment(){return button('简单一点','simpler','small',busy||state.plan.difficulty===1)+button('难一点','harder','small',busy||state.plan.difficulty===3);}
function content(){
  const s=state.state;
  if(s==='HATCH_SELECT')return '<div class="eyebrow">HELLO, LITTLE EXPLORER</div><h1>一位音乐伙伴，<br>正在等你。</h1><p class="intro">你希望这个宠物是什么性格？</p><div class="options">'+Object.entries(personalities).map(([p,n],i)=>'<button class="option" data-personality="'+p+'"><div class="icon">'+['☀','☾','✦'][i]+'</div><b>'+n+'</b><span>'+petStyles[p].name+' · '+['喜欢一起蹦蹦跳跳','慢慢发现小惊喜','总有奇妙的小点子'][i]+'</span></button>').join('')+'</div>'+button('听语音提示 ♪','hatch-prompt','small ghost')+'<p class="hint">性格回答语音发送到千问；孵化拍手不录音。</p>';
  if(s==='HATCH_GUIDE')return '<div class="eyebrow">A LITTLE RHYTHM, A LITTLE MAGIC</div><h1>跟着灯光，<br>唤醒小伙伴。</h1><p class="intro">跟着小手掌，一起拍完三小节吧。</p><div class="guide-slots">'+[1,2,3,4].map(n=>'<i data-guide="'+n+'"><span class="clap-hands" aria-hidden="true">👏</span><b>'+n+'</b><small>拍一下</small></i>').join('')+'</div><p class="hint" id="hatch-bars">准备拍 3 个小节</p><div class="hatch-progress" aria-hidden="true"><div></div></div><p class="hint" id="hatch-caption" role="status">先听玩法讲解，随后开始孵化。</p>';
  if(s==='HATCH_REVEAL')return '<div class="eyebrow">NICE TO MEET YOU</div><h1>它醒过来啦！</h1><p>一位'+personalities[personality]+'的小伙伴，想认识你。</p>';
  if(s==='PET_NAMING')return '<div class="eyebrow">YOUR VERY OWN BOBO</div><h1>给小伙伴<br>取个名字吧。</h1><div class="bubble">你想给我取什么名字？</div><form class="name-form"><input aria-label="宠物名字" maxlength="12" placeholder="例如：波波" value="'+escape(nameCandidate||state.pet?.name||'')+'"><button class="primary" type="submit">确认名字</button></form><p class="hint">语音识别的名字也要点确认才会保存。</p>';
  if(s==='PET_HOME')return '<div class="eyebrow">OUR LITTLE MUSIC WORLD</div><h1>你好呀，<br>我是'+escape(state.pet.name)+'。</h1><p class="intro">每一次拍手，都藏着一点音乐魔法。</p><div class="bubble">今天想和我去大风车探险吗？</div><div class="actions">'+button('开始探险 ↗','enter','primary',busy)+button('修改名字','rename','ghost',busy)+'</div>';
  if(s==='ADVENTURE_INTRO')return '<div class="eyebrow">THE WINDMILL ADVENTURE</div><h1>听，风车转起来了。</h1><div class="bubble">哇！前面有一个大风车！看到它，你是什么心情呀？</div>'+button('看看风车','intro','primary',busy);
  if(s==='MOOD_SELECT')return '<div class="eyebrow">A FEELING BECOMES A RHYTHM</div><h1>看到大风车，<br>你是什么心情呀？</h1><p class="intro">把此刻的感觉，变成一段拍手节奏。</p><div class="options">'+Object.entries(labels).map(([m,n],i)=>'<button class="option" data-mood="'+m+'" '+(busy?'disabled':'')+'><div class="icon">'+['☀','≈','✧'][i]+'</div><b>'+n+'</b><span>'+['明亮，轻轻跳跃','舒缓，留点空白','活泼，多点变化'][i]+'</span></button>').join('')+'</div>';
  if(s==='ARRANGEMENT_LOADING')return '<h1>让心情变成节奏…</h1><p>正在准备你的节奏。</p>';
  if(s==='PLAN_PREVIEW')return '<div class="eyebrow">YOUR TWO-BAR RHYTHM</div><h1>让风车，<br>跟着你的节奏转。</h1><div class="panel">'+meta()+rhythm()+'<div class="actions">'+button(playing?'停止试听':'听听看 ♪',playing?'stop':'preview','secondary',busy||speechBusy)+button('开始挑战','challenge','primary',busy||playing||voiceActive||voicePending||speechBusy)+'</div><div class="actions" style="margin-top:14px">'+adjustment()+button('慢一点','slow','small',busy)+(accepted?.plan.planId===state.plan.planId?button('试听已保留版本','saved','small',busy):'')+'</div><p class="hint">试听速度 '+Math.round(state.plan.previewTempoFactor*100)+'%。挑战使用原歌曲速度。</p><p class="hint">挑战时采集拍手并保存在本机，不上传。建议戴耳机；录音时仅显示拍点。</p></div>';
  if(['RECORD_COUNT_IN','RECORDING'].includes(s))return '<div class="eyebrow">YOUR HANDS MAKE THE MUSIC</div><h1>'+ (s==='RECORD_COUNT_IN'?'听四拍，准备好。':'轮到你啦！')+'</h1><div class="panel"><div class="record-status"><i class="dot"></i><span id="record-label">现在跟着原来的歌曲速度拍</span></div>'+rhythm()+'<div class="wave">'+Array.from({length:24},()=>'<i></i>').join('')+'</div><div class="progress"><div></div></div>'+button('停止本次录音','cancel','ghost')+'<p class="hint">中途停止不会覆盖已保留的录音。语音对话已暂停。</p></div>';
  if(s==='ANALYZING')return '<h1>听听你的拍手。</h1><div class="bubble">让我听听你的节奏。</div>';
  if(s==='FEEDBACK')return '<div class="eyebrow">A LITTLE PRACTICE, A LITTLE PROGRESS</div><h1>这是你的节奏。</h1><div class="panel"><p>'+escape(state.feedback?.text||'本次未能准确判断拍点。')+'</p><div class="stats">'+(state.analysis?.status==='reliable'?'检测到 '+state.analysis.detectedCount+' 个声音起始点；目标 '+state.analysis.expectedCount+' 个。<br>未匹配目标：'+state.analysis.matchSummary.missed+'；额外声音：'+state.analysis.matchSummary.extra+'。':'检测不可靠，本次不评价准确性。')+'<br>设备延迟未校准，不给出确定的早晚评价。</div><div class="actions">'+button('保留这次','accept','primary',busy||!attempt)+button('听我的拍手','raw','secondary',busy||!attempt)+button('再练一次','retry','ghost',busy)+'</div><div class="actions" style="margin-top:14px">'+adjustment()+'</div><p class="hint">'+(state.feedback?.source==='ai_evidence_validated'?'千问选择了真实证据支持的反馈':'规则反馈 · 来自本地实际检测')+'</p><details class="details"><summary>本次检测时间点</summary><p>'+escape(attempt?.capture.onsets.map(t=>t.toFixed(3)+'s').join(' · ')||'没有可靠起始点')+'</p></details></div>';
  if(s==='WORK_PREVIEW')return '<div class="eyebrow">MADE BY YOU</div><h1>风车里，<br>有你的拍手声。</h1><div class="panel"><p>我的《大风车》拍手版片段 · 2 小节</p><div class="actions">'+button(playing?'停止试听':'试听我的作品 ♪',playing?'stop':'mix','primary',busy||!accepted)+button('再练一次','retry','ghost',busy)+'</div><label class="volume">真实拍手音量 <input id="clap-volume" type="range" min="0" max="1" step=".05" value=".8"></label><label class="volume">旋律伴奏音量 <input id="backing-volume" type="range" min="0" max="1" step=".05" value=".65"></label><p class="hint">'+(config.backingAsset?'使用配置的两小节伴奏，来源待审核。':'开发模式：按真实曲谱前两小节合成旋律，素材授权与速度待审核。')+'</p><div class="actions" style="margin-top:15px">'+button('删除本地作品','delete','small danger',busy)+adjustment()+'</div></div>';
  return '<p>正在加载…</p>';
}
function render(){
  const home=isHome(),early=['HATCH_SELECT','HATCH_GUIDE','HATCH_REVEAL'].includes(state.state),canVoice=['HATCH_SELECT','PET_NAMING','PET_HOME','MOOD_SELECT','PLAN_PREVIEW','FEEDBACK','WORK_PREVIEW'].includes(state.state);
  app.innerHTML='<div class="shell"><header class="top"><div class="brand"><span class="brand-icon">✦</span>let&#39;s clap<small>一起拍手吧</small></div><div class="top-right">'+(!config.aiEnabled?'<span class="mode">语音暂不可用</span>':'')+(!home&&['MOOD_SELECT','PLAN_PREVIEW','FEEDBACK','WORK_PREVIEW'].includes(state.state)?button('← 宠物','home','small ghost',busy):'')+'</div></header><section class="hero '+(home?'home':'adventure')+' '+(state.plan?.mood||'')+'"><div class="pet-stage '+(state.state==='ADVENTURE_INTRO'?'walking':state.state==='HATCH_REVEAL'?'reveal':'')+'">'+(early?eggArt(personality):petArt(state.pet?.personality||personality))+(early?'':'<span class="pet-tag">'+escape(state.pet?.name||'你的新伙伴')+' · '+personalities[state.pet?.personality||personality]+'</span>')+'</div>'+scene()+'<div class="content">'+content()+(canVoice?'<div class="voice"><button data-action="voice" class="'+(voiceActive?'listening':'')+'" aria-label="'+(voiceActive?'结束说话':'开始语音对话')+'" '+(!config.aiEnabled||busy||playing||speechBusy||voicePending?'disabled':'')+'>'+ (voiceActive?'■':'🎙')+'</button><div><strong>'+ (voiceActive?'我在听，你说吧':voicePending?'让我想一想…':speechBusy?'听小伙伴说一说':voiceEnabled?(recordReady&&state.state==='PLAN_PREVIEW'?'准备好就点开始挑战':nameCandidate&&state.state==='PET_NAMING'?'喜欢名字就点确认':'点麦克风可以继续说'):'开始语音互动')+'</strong><span>'+ (voiceActive?'说完会自动结束，也可以点方块。':!config.aiEnabled?'可以用按钮继续玩。':voiceEnabled?'可以说出你的想法，也可以点选。':'点麦克风开始，之后说完就能继续。')+'</span></div>'+(voiceEnabled?button('暂停语音','pausevoice','small ghost'):'')+'</div>':'')+'</div></section><details class="developer" '+(devOpen?'open':'')+'><summary>开发信息</summary><div class="dev-body"><p>'+escape(config.aiEnabled?'千问已连接':config.aiUnavailableReason||'AI 未连接')+' · '+(config.backingAsset?'已配置伴奏':'开发模式：曲谱合成旋律，素材与速度待审核')+'</p><p>对话语音发送至千问；拍手录音只保存在本机，可删除。</p>'+button('返回孵化','rehatch','small ghost dev-rehatch',busy||['RECORD_COUNT_IN','RECORDING','ANALYZING'].includes(state.state))+(voiceError?'<p>语音诊断：'+escape(voiceError)+'</p>':'')+'<div id="dev-details"></div></div></details></div>';
  tidyInterface();bind();queueMicrotask(()=>driveGuidance().catch(guidanceError));
}
function highlight(elapsed,plan=state.plan){
  const beat=elapsed/(60/plan.bpm/(plan.previewTempoFactor||1)),slot=Math.floor(beat*2);
  document.querySelectorAll('[data-slot]').forEach(n=>n.classList.toggle('active',Number(n.dataset.slot)===slot&&elapsed>=0&&!n.classList.contains('rest')));
}
async function preview(){
  stopVoice();cancelGuidance();
  if(speechBusy||voicePending||voiceActive)return;
  previewedKey=planKey();playing=true;render();await audio.preview(state.plan,t=>highlight(t),()=>{playing=false;render();});
}
function stopCue(){
  cueAudio?.pause();cueAudio=null;cueResolve?.(false);cueResolve=null;
}
async function playCue(id){
  stopCue();
  const player=new Audio('/assets/audio/prompt-'+id+'.wav');cueAudio=player;
  return new Promise(resolve=>{
    const finish=ok=>{if(cueAudio===player){cueAudio=null;cueResolve=null;}player.onended=null;player.onerror=null;resolve(ok);};
    cueResolve=finish;player.onended=()=>finish(true);player.onerror=()=>finish(false);
    player.play().catch(()=>finish(false));
  });
}
async function runGuide(){
  const run=++hatchRun,version=state.sceneVersion;
  const spoken=await playCue('guide');
  if(run!==hatchRun||state.state!=='HATCH_GUIDE'||state.sceneVersion!==version||document.hidden)return;
  if(!spoken)toast('语音讲解未能播放：亮灯时跟着拍一下，随后小伙伴会破壳。');
  const cell=config.kb.items.find(c=>c.legacyPatternId==={happy:'PAT-02',quiet:'PAT-01',silly:'PAT-04'}[personality]);
  await audio.guide(cell,(t,timeline)=>{
    const frame=hatchFrame(t,timeline),egg=document.querySelector('.hatch-art');
    if(!egg)return;
    egg.style.setProperty('--pulse',frame.pulse);
    egg.style.setProperty('--rock',Math.sin((1-frame.pulse)*Math.PI*3)*frame.pulse*5+'deg');
    egg.dataset.crack=frame.crack;
    egg.dataset.hits=frame.count;
    egg.setAttribute('aria-label',['等待唤醒的蛋','蛋壳出现细小裂痕','裂痕正在延伸','小伙伴快出来了','即将破壳的蛋'][frame.crack]);
    document.querySelector('.hatch-progress div').style.width=frame.progress*100+'%';
    document.querySelector('#hatch-bars').textContent='第 '+frame.bar+' / 3 小节';
    egg.dataset.bar=frame.bar;
    document.querySelector('#hatch-caption').textContent=['小伙伴正在听你的节奏…','看，蛋壳上有一点裂痕了。','再一起拍几下，裂痕变长了！','里面的小伙伴动起来了…','就快见面啦！'][frame.crack];
    document.querySelectorAll('[data-guide]').forEach(n=>{
      const hit=Number(n.dataset.guide)===frame.slot&&frame.pulse>0;
      n.classList.toggle('active',hit);n.querySelector('small').textContent=hit?'拍！':'准备';
    });
  },async()=>{
    if(run!==hatchRun||state.state!=='HATCH_GUIDE')return;
    try{
      await act('guided_playback_complete');
      hatchRevealTimer=setTimeout(async()=>{
        if(run===hatchRun&&state.state==='HATCH_REVEAL')try{await act('reveal_complete');spinPet();}catch(e){toast(e.message);}
      },HATCH_REVEAL_MS);
    }catch(e){toast(e.message);}
  });
}
function clearSpin(){
  document.querySelector('.pet-stage')?.classList.remove('spinning');
}
function spinPet(){
  const stage=document.querySelector('.pet-stage'),strip=stage?.querySelector('.pet-turn');
  if(!strip||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  stage.classList.add('spinning');
  strip.addEventListener('animationend',()=>stage.classList.remove('spinning'),{once:true});
}
async function challenge(){
  if(busy||playing||voiceActive||voicePending||speechBusy)return;
  busy=true;render();let stream;
  try{
    stopVoice();cancelGuidance();audio.stopPlayback();
    await playCue('record');
    if(document.hidden)throw Error('请回到页面再开始挑战。');
    stream=await audio.acquire();
    await act('start_challenge');busy=false;render();
    const plan=structuredClone(state.plan);
    let phasePromise=null;
    const capture=await audio.record(plan,stream,(t,level)=>{
      const n=document.querySelector('#record-label');
      if(n)n.textContent=t<0?'准备 '+Math.min(4,Math.ceil(-t/(60/plan.bpm))):'拍手中 · '+Math.min(8,Math.floor(t/(60/plan.bpm))+1)+' / 8 拍';
      highlight(t,{...plan,previewTempoFactor:1});
      const bar=document.querySelector('.progress div');if(bar)bar.style.width=Math.max(0,Math.min(100,t/plan.durationSec*100))+'%';
      document.querySelectorAll('.wave i').forEach((n,i)=>n.style.height=(6+Math.min(32,level*450)*(1+(i%4)/4))+'px');
    },()=>{phasePromise=act('count_in_complete');});
    if(phasePromise)await phasePromise;else if(state.state==='RECORD_COUNT_IN')await act('count_in_complete');
    await act('capture_complete');
    const recordingId=crypto.randomUUID(),analysis=analyze(plan,capture,recordingId);
    attempt={recordingId,plan,blob:capture.blob,capture:{onsets:capture.onsets,qualityFlags:capture.qualityFlags},analysis,createdAt:new Date().toISOString()};
    state=await api('analysis',{analysis});render();
    if(state.feedbackAudio){cancelGuidance();speechBusy=true;render();try{await audio.playSpeech(state.feedbackAudio);}finally{speechBusy=false;render();}}
  }catch(e){
    stream?.getTracks().forEach(t=>t.stop());audio.cancel();
    if(['RECORD_COUNT_IN','RECORDING','ANALYZING'].includes(state.state))try{await act('cancel');}catch{}
    toast(e.message);
  }finally{busy=false;render();}
}
function stopVoice(){
  voiceReady?.reject(Error('语音已取消'));voiceReady=null;
  clearTimeout(voiceTimer);audio.stopVoice();
  if(ws?.readyState===1&&voiceTurn)ws.send(JSON.stringify({type:'cancel',turnId:voiceTurn}));
  voiceActive=false;voicePending=false;voiceTurn=null;pendingLocal=null;
}
async function connectVoice(){
  if(ws?.readyState===1)return;
  ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/voice');
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=()=>reject(Error('语音服务连接失败'));});
  ws.onmessage=async({data})=>{
    const e=JSON.parse(data);
    if(e.type==='ready'&&e.turnId===voiceTurn){voiceReady?.resolve();voiceReady=null;return;}
    if(e.type==='state'){if(e.sceneVersion<state.sceneVersion)return;if(e.sceneVersion!==state.sceneVersion)cancelGuidance();state={...state,...e};personality=e.personality||personality;render();return;}
    if(e.type==='error'){guidanceError(Error(e.message));return;}
    if(e.turnId&&e.turnId!==voiceTurn)return;
    if(e.type==='local_action'){pendingLocal=e.command;return;}
    if(e.type==='name_candidate'){nameCandidate=e.name;render();}
    if(e.type==='intent'){
      if(e.sceneVersion<state.sceneVersion)return;
      state={...state,...e};personality=e.personality||personality;render();
      if(['replay_preview','retry_same','select_mood','reduce_difficulty','increase_difficulty','slow_preview'].includes(e.action)){previewedKey='';recordReady=false;}
      if(e.action==='confirm_plan')recordReady=true;
    }
    if(e.type==='voice_result'){
      if(e.sceneVersion!==state.sceneVersion){stopVoice();render();return;}
      voicePending=false;voiceTurn=null;spokenKey='';speechBusy=!!e.audio;render();
      if(e.audio)try{await audio.playSpeech(e.audio);}catch{toast('语音播放失败，请查看文字提示。');}
      if(e.audio&&state.state==='PET_NAMING'&&nameCandidate)spokenKey=state.sceneVersion+':name_confirm:'+nameCandidate;
      speechBusy=false;render();
      if(state.state==='HATCH_GUIDE'){await runGuide();return;}
      if(pendingLocal){
        const command=pendingLocal;pendingLocal=null;
        if(command==='keep_recording'){spokenKey=state.sceneVersion+':feedback:';speechBusy=true;render();await playCue('keep');speechBusy=false;render();return;}
        await handle(command==='listen_recording'?'raw':'mix');return;
      }
      await driveGuidance();
    }
  };
  ws.onclose=()=>{stopVoice();render();toast('语音连接已断开，仍可使用按钮。');};
}
function submitVoice(){
  if(!voiceActive)return;
  clearTimeout(voiceTimer);audio.stopVoice();voiceActive=false;voicePending=true;
  ws.send(JSON.stringify({type:'commit',turnId:voiceTurn}));render();
}
async function startListening(){
  if(!voiceEnabled||voiceActive||voicePending||speechBusy||playing||busy||document.hidden)return;
  voicePending=true;render();
  await audio.ready();await connectVoice();voiceTurn=crypto.randomUUID();
  const turn=voiceTurn,version=state.sceneVersion,endpoint=new VoiceEndpoint();
  const ready=new Promise((resolve,reject)=>{const timer=setTimeout(()=>{voiceReady=null;reject(Error('语音服务未就绪'));},4000);voiceReady={resolve:()=>{clearTimeout(timer);resolve();},reject:e=>{clearTimeout(timer);reject(e);}};});
  ws.send(JSON.stringify({type:'begin',turnId:turn,sceneVersion:version}));await ready;
  await audio.startVoice((pcm,samples,rate)=>{
    if(ws?.readyState===1&&voiceTurn===turn){
      ws.send(JSON.stringify({type:'audio',turnId:turn,audio:pcm}));
      if(endpoint.update(samples,rate)&&voiceActive)submitVoice();
    }
  });
  if(voiceTurn!==turn||state.sceneVersion!==version||document.hidden){audio.stopVoice();return;}
  voicePending=false;voiceActive=true;render();
  voiceTimer=setTimeout(()=>{
    if(voiceTurn!==turn||!voiceActive)return;
    if(endpoint.heard)submitVoice();else{voiceEnabled=false;stopVoice();render();playCue('no_speech');}
  },19000);
}
async function toggleVoice(){
  if(voiceActive){submitVoice();return;}
  if(voicePending||speechBusy||playing||busy)return;
  voiceEnabled=true;spokenKey='';cancelGuidance();await audio.ready();await driveGuidance();
}
function cancelGuidance(reset=true){guidanceSerial++;stopCue();speechBusy=false;if(reset)spokenKey='';}
function guidanceError(e){voiceError=e.message||'语音暂时不可用';voiceEnabled=false;stopVoice();cancelGuidance();render();toast('语音暂时没接上，可以点选继续玩。');}
function planKey(){return state.plan?state.plan.planId+'@'+state.plan.previewTempoFactor:'';}
function guideStep(){
  if(state.state==='PLAN_PREVIEW')return recordReady?'challenge':previewedKey!==planKey()?'demo':'ready';
  if(state.state==='PET_NAMING'&&nameCandidate)return 'name_confirm';
  return promptForState[state.state];
}
function promptKey(id){return state.sceneVersion+':'+id+':'+(id==='name_confirm'?nameCandidate:'');}
async function driveGuidance(){
  const passive=['ARRANGEMENT_LOADING','ANALYZING'].includes(state?.state);
  if(!state||document.hidden||playing||speechBusy||voiceActive||(!passive&&(voicePending||busy||actPending)))return;
  const id=guideStep();if(!id)return;
  const key=promptKey(id);
  if(key===spokenKey)return;
  spokenKey=key;const run=++guidanceSerial,version=state.sceneVersion;
  speechBusy=true;render();const played=await playCue(id);
  if(run!==guidanceSerial||version!==state.sceneVersion)return;
  speechBusy=false;render();
  if(!played){if(voiceEnabled)toast('语音提示暂未播放，请看当前问题或点选继续。');return;}
  if(id==='intro'){await act('intro_complete');return;}
  if(id==='demo'){await preview();return;}
  if(prompts[id].listen&&voiceEnabled)await startListening();
}
function tidyInterface(){
  document.querySelectorAll('.eyebrow,.footer,[data-action="hatch-prompt"],[data-action="intro"]').forEach(n=>n.remove());
  const dev=document.querySelector('#dev-details');
  document.querySelectorAll('.meta,.stats,.details,.volume,[data-action="delete"]').forEach(n=>dev.append(n));
  document.querySelectorAll('.content .hint').forEach(n=>{
    if(/千问|开发模式|设备|素材|速度|录音|校准|本地|BPM|确认才会保存/.test(n.textContent))dev.append(n);
  });
  document.querySelector('.developer').ontoggle=e=>devOpen=e.currentTarget.open;
  const alternate=document.createElement('details');alternate.className='alternatives';alternate.innerHTML='<summary>也可以点选</summary>';
  document.querySelectorAll('.options').forEach(n=>alternate.append(n));
  document.querySelectorAll('.actions').forEach(n=>{
    if(!n.querySelector('[data-action="challenge"],[data-action="accept"]'))alternate.append(n);
    else n.querySelectorAll('[data-action="preview"],[data-action="stop"],[data-action="raw"],[data-action="retry"]').forEach(b=>alternate.append(b));
  });
  if(alternate.children.length>1)document.querySelector('.content').append(alternate);
  // Keep the two explicit confirmation buttons prominent; technical controls live in the drawer.
  if(state.state==='HATCH_SELECT'&&!voiceEnabled){const note=document.createElement('p');note.className='privacy-note';note.textContent='对话发送到千问，拍手录音只存本机。';document.querySelector('.voice')?.append(note);}
}
async function handle(action){
  if(action==='hatch-prompt'){stopVoice();cancelGuidance();spokenKey='';await driveGuidance();return;}
  if(action==='pausevoice'){voiceEnabled=false;stopVoice();cancelGuidance(false);audio.stopPlayback();playing=false;spokenKey=promptKey(guideStep());render();return;}
  if(action==='cancel'){audio.cancel();return;}
  if(action==='voice'){try{await toggleVoice();}catch(e){guidanceError(e);}return;}
  if(busy)return;
  try{
    cancelGuidance();stopVoice();
    if(action==='challenge')return await challenge();
    if(action==='preview')return await preview();
    if(action==='stop'){audio.stopPlayback();playing=false;render();return;}
    if(action==='raw'){playing=true;render();await audio.playRecording(attempt,()=>{playing=false;spokenKey='';render();});return;}
    if(action==='mix'){if(!accepted||accepted.plan.planId!==state.plan.planId)throw Error('当前计划没有已保留的录音。');playing=true;render();await audio.mix(accepted,config.score,config,.8,()=>{playing=false;spokenKey='';render();});return;}
    busy=true;stopVoice();audio.stopPlayback();playing=false;render();
    if(action==='rehatch'){
      ++hatchRun;stopCue();clearTimeout(hatchRevealTimer);audio.cancel();
      state=await api('init',{pet:null});
      localStorage.removeItem('bobo.pet');personality='happy';nameCandidate='';attempt=null;
      spokenKey='';previewedKey='';recordReady=false;toast('已返回孵化，本地录音作品已保留。');
    }else if(action==='accept'){
      if(attempt?.plan.planId!==state.plan?.planId)throw Error('录音不属于当前节奏。');
      accepted=attempt;
      try{await saveWork(accepted);}catch{toast('不能持久保存，仍可在本次会话试听。');}
      await act('accept_recording');
    }else if(action==='delete'){
      await deleteWork();accepted=null;attempt=null;await act('retry_same');toast('本地作品已删除。');
    }else if(action==='enter'){await act('enter_adventure');}
    else if(action==='intro')await act('intro_complete');
    else if(action==='home')await act('return_home');
    else if(action==='rename'){nameCandidate=state.pet.name;await act('rename');}
    else if(action==='retry'){previewedKey='';recordReady=false;await act('retry_same');}
    else if(action==='saved')await act('preview_accepted');
    else if(action==='simpler')await act('reduce_difficulty');
    else if(action==='harder')await act('increase_difficulty');
    else if(action==='slow')await act('slow_preview');
  }catch(e){playing=false;audio.stopPlayback();toast(e.message);}
  finally{busy=false;render();}
}
function bind(){
  document.querySelectorAll('[data-action]').forEach(n=>n.onclick=()=>handle(n.dataset.action));
  document.querySelectorAll('[data-personality]').forEach(n=>n.onclick=async()=>{
    if(busy)return;busy=true;
    try{stopVoice();cancelGuidance();personality=n.dataset.personality;await audio.ready();await act('choose_personality',{personality});busy=false;render();await runGuide();}catch(e){toast(e.message);}finally{busy=false;}
  });
  document.querySelectorAll('[data-mood]').forEach(n=>n.onclick=async()=>{
    if(busy)return;busy=true;render();
    try{stopVoice();cancelGuidance();await audio.ready();await act('select_mood',{mood:n.dataset.mood});busy=false;render();}catch(e){toast(e.message);}finally{busy=false;}
  });
  const form=document.querySelector('.name-form');
  if(form){form.querySelector('input').oninput=e=>nameCandidate=e.target.value;form.onsubmit=async e=>{e.preventDefault();if(busy)return;stopVoice();cancelGuidance();audio.stopPlayback();playing=false;clearSpin();busy=true;try{await act('confirm_name',{name:form.querySelector('input').value});}catch(e){toast(e.message);}finally{busy=false;render();}};}
  document.querySelector('#clap-volume')?.addEventListener('input',e=>{if(audio.mixGain)audio.mixGain.gain.value=Number(e.target.value);});
  document.querySelector('#backing-volume')?.addEventListener('input',e=>{if(audio.backingGain)audio.backingGain.gain.value=Number(e.target.value);});
}
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){++hatchRun;cancelGuidance();stopVoice();audio.cancel();playing=false;clearSpin();if(state?.state==='PET_NAMING')render();if(['RECORD_COUNT_IN','RECORDING'].includes(state?.state))act('cancel').catch(()=>{});}
  else if(state?.state==='HATCH_GUIDE')runGuide().catch(e=>toast(e.message));
  else if(state?.state==='HATCH_REVEAL'){
    clearTimeout(hatchRevealTimer);
    act('reveal_complete').then(()=>spinPet()).catch(e=>toast(e.message));
  }else if(state){spokenKey='';render();}
});
window.addEventListener('pagehide',()=>{++hatchRun;cancelGuidance();stopVoice();audio.cancel();});
async function boot(){
  try{
    config=await api('config');
    try{accepted=await loadWork();}catch{toast('本地作品存储不可用，可使用本次会话。');}
    state=await api('init',{pet:loadPet(),work:accepted?{plan:accepted.plan}:null});
    personality=state.pet?.personality||'happy';render();
  }catch(e){app.textContent='启动失败：'+e.message;}
}
boot();
