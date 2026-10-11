import WebSocket from 'ws';
import {randomUUID} from 'node:crypto';
export function qwenConfig(env=process.env) {
  const region=env.DASHSCOPE_REGION||'cn-beijing';
  if(!['cn-beijing','ap-southeast-1'].includes(region))throw Error('不支持的千问地域');
  const workspace=env.DASHSCOPE_WORKSPACE_ID||'';
  if(workspace&&!/^[a-zA-Z0-9_-]+$/.test(workspace))throw Error('业务空间格式不合法');
  return {enabled:!!(env.DASHSCOPE_API_KEY&&workspace),key:env.DASHSCOPE_API_KEY,url:'wss://'+workspace+'.'+region+'.maas.aliyuncs.com/api-ws/v1/realtime?model='+encodeURIComponent(env.QWEN_REALTIME_MODEL||'qwen3.8-omni-flash-realtime')};
}
export function tool(name,description,properties,required=Object.keys(properties)) {
  return {type:'function',function:{name,description,parameters:{type:'object',properties,required,additionalProperties:false}}};
}
function connectionError(status) {
  return Error(status===401?'千问鉴权失败（401）：请检查 API Key 与地域、业务空间是否匹配':'千问连接失败'+(status?'（HTTP '+status+'）':'')+'，请检查网络和配置');
}
export async function checkConnection(config=qwenConfig()) {
  if(!config.enabled)return {ok:false,reason:'千问密钥或业务空间未配置'};
  return new Promise(resolve=>{
    const ws=new WebSocket(config.url,{headers:{Authorization:'Bearer '+config.key},handshakeTimeout:8000});
    let done=false;
    const finish=(ok,reason='')=>{if(done)return;done=true;clearTimeout(timer);ws.close();resolve({ok,reason});};
    const timer=setTimeout(()=>finish(false,'千问连接超时'),9000);
    ws.on('error',()=>finish(false,connectionError().message));
    ws.on('unexpected-response',(_,r)=>{r.resume();finish(false,connectionError(r.statusCode).message);});
    ws.on('message',raw=>{try{const e=JSON.parse(raw);if(e.type==='session.created')finish(true);else if(e.type==='error')finish(false,'千问会话创建失败');}catch{finish(false,'千问协议错误');}});
    ws.on('close',()=>{if(!done)finish(false,'千问连接中断');});
  });
}
// One fresh upstream session per turn: old audio/response context cannot cross scenes.
export function qwenRequest({text,audio,tools=[],instructions='',speech=false,timeoutMs=18000,signal,validateTool},config=qwenConfig()) {
  if(!config.enabled)return Promise.reject(Error('千问密钥或业务空间未配置'));
  return new Promise((resolve,reject)=>{
    const ws=new WebSocket(config.url,{headers:{Authorization:'Bearer '+config.key},handshakeTimeout:8000,maxPayload:4*1024*1024});
    let finished=false,started=false,transcript='',outputText='',audioChunks=[],calls=[];
    const send=x=>ws.send(JSON.stringify({event_id:randomUUID(),...x}));
    const finish=(err,result)=>{if(finished)return;finished=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);ws.close();err?reject(err):resolve(result);};
    const abort=()=>finish(Error('语音轮次已取消'));
    const timer=setTimeout(()=>finish(Error('千问响应超时，使用规则后备')),timeoutMs);
    ws.on('error',()=>finish(Error('千问连接失败，请检查网络和配置')));
    ws.on('unexpected-response',(_,r)=>{r.resume();finish(connectionError(r.statusCode));});
    signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted){abort();return;}
    ws.on('close',()=>{if(!finished)finish(Error('千问连接中断'));});
    ws.on('message',async raw=>{
      let e;try{e=JSON.parse(raw);}catch{return finish(Error('千问协议错误'));}
      if(e.type==='error')return finish(Error('千问拒绝请求，请检查服务端配置'));
      if(e.type==='session.created')send({type:'session.update',session:{modalities:speech?['text','audio']:['text'],turn_detection:null,instructions,tools,
        input_audio_transcription:{model:'qwen3-asr-flash-realtime'},
        audio:{input:{format:{type:'pcm',sample_rate:16000,sample_format:'s16le',channels:1,packing:'interleaved',channel_layout:'mono'}},output:{voice:'longanlingxin',format:{type:'pcm',sample_rate:24000}}}}});
      if(e.type==='session.updated'&&!started){
        started=true;
        if(audio){send({type:'input_audio_buffer.append',audio});send({type:'input_audio_buffer.commit'});}
        else send({type:'conversation.item.create',item:{type:'message',role:'user',content:[{type:'input_text',text}]}});
        send({type:'response.create'});
      }
      if(e.type==='conversation.item.input_audio_transcription.completed')transcript=e.transcript||'';
      if(e.type==='response.function_call_arguments.done')calls.push({name:e.name,callId:e.call_id,arguments:e.arguments});
      if(e.type==='response.text.done')outputText=e.text||'';
      if(e.type==='response.audio_transcript.done')outputText=e.transcript||'';
      if(e.type==='response.audio.delta')audioChunks.push(Buffer.from(e.delta,'base64'));
      if(e.type==='response.done'){
        const toolResults=[];
        try {
          for(const call of calls){
            let result;
            try{result=validateTool?await validateTool(call):{ok:false,error:'工具未授权'};}catch(err){result={ok:false,error:err.message};}
            toolResults.push(result);
            if(ws.readyState===1)send({type:'conversation.item.create',item:{type:'function_call_output',call_id:call.callId,output:JSON.stringify(result)}});
          }
          if(!audio||transcript||calls.length)finish(null,{calls,toolResults,transcript,outputText,audio:Buffer.concat(audioChunks).toString('base64')});
          else setTimeout(()=>finish(null,{calls,toolResults,transcript,outputText,audio:''}),300);
        }catch(err){finish(err);}
      }
    });
  });
}
export async function approvedSpeech(text,signal) {
  try{
    const r=await qwenRequest({text:'请只逐字朗读：'+text,instructions:'只朗读用户指定的中文原文，不添加任何字句，不调用工具。',speech:true,signal});
    const normalize=s=>s.replace(/[\s。，！？、：；“”「」]/g,'');
    return normalize(r.outputText)===normalize(text)?r.audio:'';
  }catch{return '';}
}
