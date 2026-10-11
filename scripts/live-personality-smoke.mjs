// Explicit synthetic speech fixture, not a human recording or clap analysis.
import WebSocket from 'ws';
import assert from 'node:assert/strict';
import {approvedSpeech} from '../server/realtimeProxy/qwen.js';
const base=process.env.BASE_URL||'http://127.0.0.1:5173';
const first=await fetch(base+'/api/state'),cookie=first.headers.get('set-cookie').split(';')[0];
const post=async(path,payload)=>{
  const r=await fetch(base+'/api/'+path,{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const data=await r.json();if(!r.ok)throw Error(data.error);return data;
};
let state=await post('init',{pet:{hatched:true,petId:'live-test-fixture',name:'测试伙伴',personality:'happy',hatchedAt:new Date().toISOString()}});
async function voice(phrase,intent){
  let fixture='';
  for(let attempt=0;attempt<2&&!fixture;attempt++)fixture=await approvedSpeech(phrase);
  const pcm24=Buffer.from(fixture,'base64');assert.ok(pcm24.length>0,'测试台词语音生成未通过');
  const pcm16=Buffer.alloc(Math.floor(pcm24.length/2*2/3)*2);
  for(let i=0;i<pcm16.length/2;i++)pcm16.writeInt16LE(pcm24.readInt16LE(Math.floor(i*1.5)*2),i*2);
  return new Promise((resolve,reject)=>{
    const ws=new WebSocket(base.replace('http','ws')+'/voice',{headers:{Cookie:cookie}});
    const turnId=crypto.randomUUID();let receivedIntent=false;
    const timer=setTimeout(()=>{ws.close();reject(Error('代理语音测试超时'));},60000);
    const finish=(error)=>{clearTimeout(timer);ws.close();error?reject(error):resolve();};
    ws.on('open',()=>ws.send(JSON.stringify({type:'begin',turnId,sceneVersion:state.sceneVersion})));
    ws.on('error',finish);
    ws.on('message',raw=>{
      const e=JSON.parse(raw);
      if(e.type==='error')return finish(Error(e.message));
      if(e.type==='state')state={...state,...e};
      if(e.type==='ready'){
        for(let i=0;i<pcm16.length;i+=3200)ws.send(JSON.stringify({type:'audio',turnId,audio:pcm16.subarray(i,i+3200).toString('base64')}));
        ws.send(JSON.stringify({type:'commit',turnId}));
      }
      if(e.type==='intent'){receivedIntent=e.action===intent;state={...state,...e};}
      if(e.type==='voice_result'){
        try{if(intent)assert.ok(receivedIntent,'未收到期望意图');else assert.ok(!receivedIntent,'不明确回答不能选性格');console.log(JSON.stringify({fixture:'synthetic speech',intent,state:state.state,transcript:e.transcript,outputPcmBytes:Buffer.from(e.audio,'base64').length,textFallback:!e.audio}));finish();}
        catch(error){finish(error);}
      }
    });
  });
}
for(const [phrase,expected] of [
 ['我想要一只活泼爱蹦蹦跳跳的小伙伴。','happy'],
 ['我希望它安静一点，温柔一点。','quiet'],
 ['我喜欢有趣搞怪，会逗我笑的小伙伴。','silly'],
 ['我不知道。',null]
]){
 state=await post('init',{pet:null});
 await voice(phrase,expected?'choose_personality':null);
 assert.equal(state.state,expected?'HATCH_GUIDE':'HATCH_SELECT');
 if(expected)assert.equal(state.personality,expected);
 console.log('PASS real Qwen personality:',expected||'clarify without guessing');
}
