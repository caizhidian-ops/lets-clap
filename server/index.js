import http from 'node:http';
import {server as practiceServer} from '../server.mjs';
import {readFile} from 'node:fs/promises';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {WebSocketServer} from 'ws';
import {Game,keywordIntent} from '../src/app/fsm.js';
import {compilePlan} from '../src/music/rhythm.js';
import {validateAnalysis,feedbackOptions} from '../src/audio/analysis.js';
import {arrange} from './arrangement/service.js';
import {qwenRequest,qwenConfig,tool,approvedSpeech,checkConnection} from './realtimeProxy/qwen.js';
import {validatePersonality} from './personality.js';
import {dialogueTools,listeningStates,localCommands,validateMood} from './dialogue.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const kb=JSON.parse(await readFile(resolve(root,'data/notation-patterns.v1.json')));
const score=JSON.parse(await readFile(resolve(root,'data/verified-score.json')));
const bpm=96; // Match the supplied backing track for every new game.
if(!Number.isFinite(bpm)||bpm<40||bpm>180)throw Error('DEMO_BPM 必须在 40–180');
const ai=qwenConfig(),sessions=new Map();
const aiConnection=await checkConnection(ai);
ai.enabled=aiConnection.ok;
const backing=process.env.DEMO_BACKING_ASSET||'';
if(backing&&!/^\/assets\/audio\/[a-zA-Z0-9_.-]+$/.test(backing))throw Error('DEMO_BACKING_ASSET 必须为 /assets/audio/文件名');
const config={bpm,aiEnabled:ai.enabled,aiUnavailableReason:aiConnection.reason,backingAsset:backing,backingMode:backing?'configured_asset':'development_score_synthesis',tempoStatus:'development_unverified'};
function session(req,res){
  const cookie=req.headers.cookie?.match(/(?:^|; )bobo=([a-f0-9-]+)/)?.[1];
  if(cookie&&sessions.has(cookie))return sessions.get(cookie);
  if(sessions.size>=1000){const first=sessions.keys().next().value;sessions.delete(first);}
  const id=randomUUID(),s={game:new Game(),plan:null,analysis:null,feedback:null,busy:false,sockets:new Set()};
  sessions.set(id,s);res?.setHeader('Set-Cookie','bobo='+id+'; HttpOnly; SameSite=Strict; Path=/');return s;
}
function view(s){return {...s.game.snapshot(),personality:s.personality||s.game.pet?.personality,plan:s.plan,pet:s.game.pet,analysis:s.analysis,feedback:s.feedback};}
const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
async function body(req){let data='';for await(const chunk of req){data+=chunk;if(data.length>32000)throw Error('请求过大');}return JSON.parse(data||'{}');}
function broadcast(s){for(const ws of s.sockets)if(ws.readyState===1)ws.send(JSON.stringify({type:'state',...view(s)}));}
function cancelVoice(s){for(const ws of s.sockets)ws.cancelTurn?.();}
async function action(s,p){
  const {action:a,payload={}}=p;
  const prev=s.game.state;
  if(p.sceneVersion!==s.game.sceneVersion)throw Error('过期场景');
  if(a==='choose_personality'){
    if(!['happy','quiet','silly'].includes(payload.personality))throw Error('性格不合法');
    s.personality=payload.personality;
  }
  if(a==='confirm_name'){
    const name=payload.name?.trim();
    if(!name||name.length>12)throw Error('名字请填 1–12 个字');
    s.pendingPet={petId:s.game.pet?.petId||randomUUID(),personality:s.game.pet?.personality||s.personality,name,hatchedAt:s.game.pet?.hatchedAt||new Date().toISOString(),hatched:true};
  }
  if(a==='select_mood'&&!['happy','calm','excited'].includes(payload.mood))throw Error('情绪不合法');
  if(a==='start_challenge'&&!s.plan)throw Error('还没有合法计划');
  if(a==='accept_recording'&&(!s.analysis||s.analysis.planId!==s.plan?.planId))throw Error('没有当前计划的真实录音分析');
  if(a==='preview_accepted'&&s.acceptedPlanId!==s.plan?.planId)throw Error('当前计划没有保留的录音');
  s.game.act(a,p);
  if(a==='accept_recording')s.acceptedPlanId=s.plan.planId;
  if(a==='confirm_name'){s.game.pet=s.pendingPet;delete s.pendingPet;}
  if(a==='return_home')s.resumeState=prev;
  if(a==='intro_complete'&&s.plan&&s.resumeState){s.game.state=['WORK_PREVIEW','FEEDBACK','PLAN_PREVIEW'].includes(s.resumeState)?s.resumeState:'PLAN_PREVIEW';s.game.sceneVersion++;delete s.resumeState;}
  if(a==='slow_preview')s.plan.previewTempoFactor=Math.max(.55,(s.plan.previewTempoFactor||1)*.85);
  if(['select_mood','reduce_difficulty','increase_difficulty'].includes(a)){
    const mood=a==='select_mood'?payload.mood:s.plan.mood;
    const difficulty=a==='select_mood'?1:Math.max(1,Math.min(3,s.plan.difficulty+(a==='reduce_difficulty'?-1:1)));
    s.analysis=null;s.feedback=null;broadcast(s);
    s.plan=await arrange(kb,{mood,difficulty,bpm},qwenRequest,ai.enabled);
    s.game.act(s.plan.source==='ai_validated'?'plan_validated':'plan_fallback');
  }
  cancelVoice(s);broadcast(s);return view(s);
}
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    if(req.headers.origin&&req.headers.origin!==('http://'+req.headers.host)&&req.headers.origin!==('https://'+req.headers.host))return send(res,403,{error:'不允许跨站请求'});
    if(['/api/rhythm-report','/api/feedback'].includes(url.pathname)){practiceServer.emit('request',req,res);return;}
    if(url.pathname.startsWith('/api/')){
      let s=session(req,res);
      if(req.method==='GET'&&url.pathname==='/api/config')return send(res,200,{...config,kb,score});
      if(req.method==='GET'&&url.pathname==='/api/state')return send(res,200,view(s));
      if(req.method!=='POST')return send(res,405,{error:'方法不允许'});
      const p=await body(req);
      if(url.pathname==='/api/init'){
        // A page boot gets a fresh FSM. Never restore a countdown or in-flight capture.
        const key=[...sessions.entries()].find(([,value])=>value===s)?.[0];
        cancelVoice(s);for(const ws of s.sockets)ws.close();
        const pet=p.pet?.hatched&&['happy','quiet','silly'].includes(p.pet.personality)&&typeof p.pet.name==='string'&&p.pet.name.trim()&&p.pet.name.length<=12?p.pet:null;
        s={game:new Game(pet),plan:null,analysis:null,feedback:null,busy:false,sockets:new Set()};if(key)sessions.set(key,s);
        if(p.work?.plan&&pet){s.plan=compilePlan(kb,{...p.work.plan,source:p.work.plan.source==='ai_validated'?'ai_validated':'rule_fallback'});s.acceptedPlanId=s.plan.planId;s.resumeState='WORK_PREVIEW';}
        return send(res,200,view(s));
      }
      if(s.busy)throw Error('上一个操作还没完成');
      s.busy=true;
      try{
        if(url.pathname==='/api/action')return send(res,200,await action(s,p));
        if(url.pathname==='/api/analysis'){
          if(s.game.state!=='ANALYZING')throw Error('当前状态不可分析');
          s.analysis=validateAnalysis(p.analysis,s.plan);
          const options=feedbackOptions(s.analysis);
          s.feedback={...options[0],source:'rule_feedback'};
          if(ai.enabled)try{
            const r=await qwenRequest({text:JSON.stringify({analysis:s.analysis,allowedFeedback:options}),instructions:'根据真实分析，只调用工具选择一个允许的反馈 code，不增加结论。',tools:[tool('choose_feedback','选择证据支持的反馈',{code:{type:'string',enum:options.map(o=>o.code)}})],
              validateTool:call=>{const o=options.find(o=>o.code===JSON.parse(call.arguments).code);if(call.name!=='choose_feedback'||!o)throw Error('反馈没有证据支持');return {ok:true,feedback:o};}});
            const c=r.calls.find(c=>c.name==='choose_feedback'),selected=options.find(o=>o.code===JSON.parse(c?.arguments||'{}').code);
            if(selected)s.feedback={...selected,source:'ai_evidence_validated'};
          }catch{}
          const feedbackAudio=ai.enabled?await approvedSpeech(s.feedback.text):'';
          s.game.act('analysis_complete');broadcast(s);return send(res,200,{...view(s),feedbackAudio});
        }
        return send(res,404,{error:'接口不存在'});
      }finally{s.busy=false;}
    }
    if(req.method!=='GET')return send(res,405,{error:'方法不允许'});
    const path=url.pathname==='/'?resolve(root,'public/index.html'):url.pathname.startsWith('/src/')?resolve(root,'.'+url.pathname):resolve(root,'public','.'+decodeURIComponent(url.pathname));
    const allowed=path.startsWith(resolve(root,'public')+'/')||path.startsWith(resolve(root,'src')+'/');
    if(!allowed)return send(res,403,{error:'不可读取'});
    const data=await readFile(path),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.wav':'audio/wav','.png':'image/png','.webp':'image/webp'}[extname(path)]||'application/octet-stream';
    res.writeHead(200,{'Content-Type':mime,'X-Content-Type-Options':'nosniff','Cache-Control':'no-cache','Content-Security-Policy':"default-src 'self'; connect-src 'self' blob:; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; worker-src 'self'"});res.end(data);
  }catch(e){send(res,e.code==='ENOENT'?404:400,{error:e.code==='ENOENT'?'文件不存在':e.message});}
});
const wss=new WebSocketServer({noServer:true,maxPayload:65536});
server.on('upgrade',(req,socket,head)=>{
  if(req.url!=='/voice'||(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)){socket.destroy();return;}
  const s=session(req);wss.handleUpgrade(req,socket,head,ws=>{ws.session=s;wss.emit('connection',ws);});
});
wss.on('connection',ws=>{
  const s=ws.session;s.sockets.add(ws);
  let turn=null;
  const reply=x=>{if(ws.readyState===1)ws.send(JSON.stringify(x));};
  ws.cancelTurn=()=>{turn?.abort.abort();turn=null;};
  ws.on('close',()=>{ws.cancelTurn();s.sockets.delete(ws);});
  ws.on('message',async raw=>{
    let requestSignal=null;
    try{
      const e=JSON.parse(raw);
      if(!ai.enabled)throw Error('开发模式：'+aiConnection.reason+'，请使用按钮。');
      if(e.type==='begin'){
        if(s.busy||turn)throw Error('请等待上一轮完成');
        if(e.sceneVersion!==s.game.sceneVersion||!listeningStates.includes(s.game.state))throw Error('当前场景不能使用语音');
        turn={id:e.turnId,version:e.sceneVersion,chunks:[],bytes:0,abort:new AbortController()};reply({type:'ready',turnId:turn.id});return;
      }
      if(e.type==='cancel'){ws.cancelTurn();return;}
      if(!turn||e.turnId!==turn.id||turn.version!==s.game.sceneVersion)throw Error('语音轮次已过期');
      if(e.type==='audio'){
        if(typeof e.audio!=='string'||!/^[A-Za-z0-9+/]*={0,2}$/.test(e.audio))throw Error('音频格式错误');
        const chunk=Buffer.from(e.audio,'base64');turn.bytes+=chunk.length;if(turn.bytes>16000*2*20)throw Error('每次说话请在 20 秒以内');turn.chunks.push(chunk);return;
      }
      if(e.type!=='commit')throw Error('事件不允许');
      const t=turn;requestSignal=t.abort.signal;
      if(t.bytes<3200)throw Error('说话时间太短，请再试一次');
      const scene=s.game.state,actions=s.game.snapshot().actions;
      const selecting=scene==='HATCH_SELECT',tools=dialogueTools(scene,actions);
      const allowedActions=tools.find(x=>x.function.name==='game_intent')?.function.parameters.properties.action.enum||[];
      let executed=null,candidate=null,localCommand=null;
      const r=await qwenRequest({audio:Buffer.concat(t.chunks).toString('base64'),tools,instructions:selecting?'你在问孩子希望宠物是什么性格。根据回答的真实含义选择最接近的性格，注意否定和对比。没有明确偏好、相互矛盾或无关回答时不调用工具。只调用允许的工具。':'你是儿童音乐宠物。只调用工具，不评价拍手。只执行孩子明确提出的意图，不能启动录音。',timeoutMs:60000,signal:t.abort.signal,
        validateTool:async call=>{
          if(executed||candidate||localCommand||turn!==t||s.game.sceneVersion!==t.version)throw Error('重复或过期工具调用');
          const args=JSON.parse(call.arguments);
          if(call.name==='choose_personality'&&s.game.state==='HATCH_SELECT'){
            const personality=validatePersonality(args);if(s.busy)throw Error('操作进行中');
            turn=null;s.busy=true;
            try{await action(s,{action:'choose_personality',payload:{personality},sceneVersion:t.version,turnId:t.id});executed='choose_personality';return {ok:true,...view(s)};}finally{s.busy=false;}
          }
          if(call.name==='select_mood'&&s.game.state==='MOOD_SELECT'){
            const mood=validateMood(args);if(s.busy)throw Error('操作进行中');turn=null;s.busy=true;
            try{await action(s,{action:'select_mood',payload:{mood},sceneVersion:t.version,turnId:t.id});executed='select_mood';return {ok:true,...view(s)};}finally{s.busy=false;}
          }
          if(call.name==='local_action'&&Object.keys(args).length===1&&localCommands(s.game.state).includes(args.command)){
            localCommand=args.command;return {ok:true,command:localCommand};
          }
          if(call.name==='set_pet_name'&&s.game.state==='PET_NAMING'&&typeof args.name==='string'&&args.name.trim().length>0&&args.name.length<=12){candidate=args.name;return {ok:true,nameCandidate:candidate,requiresChildConfirmation:true};}
          if(call.name!=='game_intent'||!allowedActions.includes(args.action)||s.busy)throw Error('当前状态不允许该工具');
          turn=null;s.busy=true;
          try{await action(s,{action:args.action,sceneVersion:t.version,turnId:t.id});executed=args.action;return {ok:true,...view(s)};}finally{s.busy=false;}
        }});
      if(!executed&&!localCommand&&(turn!==t||s.game.sceneVersion!==t.version))return;
      const call=r.calls[0];
      let line='我听到了。你也可以点按钮告诉我。';
      if(localCommand){reply({type:'local_action',command:localCommand,turnId:t.id});line='好呀。';}
      else if(executed==='select_mood'){reply({type:'intent',action:executed,turnId:t.id,...view(s)});line='让我们听听你的节奏。';}
      else if(scene==='MOOD_SELECT'){line='看到大风车，你是什么心情呀？';}
      else if(selecting){
        if(executed==='choose_personality'){
          reply({type:'intent',action:executed,turnId:t.id,...view(s)});
          line='选好啦，我们一起唤醒小伙伴吧！';
        }else line='你希望这个宠物是什么性格？可以告诉我：欢快、安静，或者搞怪。';
      }else if(candidate){reply({type:'name_candidate',name:candidate,turnId:t.id});line='你想叫我'+candidate+'吗？喜欢的话，点确认名字吧。';}
      else{
        const intent=executed||(!call?keywordIntent(r.transcript):null);
        if(intent&&allowedActions.includes(intent)){
          // Shared FSM action path; mark consumed before action cancels other pending turns.
          turn=null;
          if(!executed){if(s.busy)throw Error('操作进行中');s.busy=true;try{await action(s,{action:intent,sceneVersion:t.version,turnId:t.id});}finally{s.busy=false;}}
          reply({type:'intent',action:intent,turnId:t.id,...view(s)});
          line=intent==='enter_adventure'?'哇！前面有一个大风车！看到它，你是什么心情呀？':intent==='reduce_difficulty'?'我们把节奏变简单一点，再听听看。':intent==='increase_difficulty'?'我们试试稍难一点的节奏吧。':intent==='slow_preview'?'示范慢一点，挑战还是原来的歌曲速度。':intent==='confirm_plan'?'准备好后，请点开始挑战。':'好呀，我们继续吧。';
        }
      }
      const version=s.game.sceneVersion;
      turn={...t,version};
      const speech=candidate?await approvedSpeech(line,t.abort.signal):'';
      if(turn?.id!==t.id||s.game.sceneVersion!==version)return;
      reply({type:'voice_result',turnId:t.id,sceneVersion:version,text:line,audio:speech,transcript:r.transcript});turn=null;
    }catch(e){if(requestSignal?.aborted)return;reply({type:'error',turnId:turn?.id,message:e.message});ws.cancelTurn();}
  });
});
const host=process.env.HOST||'127.0.0.1';
server.listen(Number(process.env.PORT||5173),host,()=>console.log("let's clap http://"+host+':'+(process.env.PORT||5173)+' | '+(ai.enabled?'千问连接已验证（语音与工具尚需实测）':'开发模式：'+aiConnection.reason)));
