import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {analyzeRhythm} from './public/rhythm-report.js';
const root=fileURLToPath(new URL('./public/',import.meta.url));
export async function feedback(data){
 if(!Array.isArray(data.intervals)||data.intervals.length>16||data.intervals.some(n=>!Number.isFinite(n)||n<0||n>60000)||!['开心','平静','兴奋'].includes(data.mood)) throw new Error('INVALID_INPUT');
 const key=process.env.QWEN_API_KEY||process.env.DASHSCOPE_API_KEY;
 if(!key){
  const mean=data.intervals.reduce((a,b)=>a+b,0)/(data.intervals.length||1);
  const variation=Math.sqrt(data.intervals.reduce((sum,n)=>sum+(n-mean)**2,0)/(data.intervals.length||1))/(mean||1);
  const message=data.intervals.length<3?'你已经勇敢地开始啦！下次跟着小鼓，多拍几下吧。':mean<150?'你的小手好快呀！试试听着小鼓，慢一点，一下一下地拍。':variation<.2?'你的每一拍间隔很接近，节奏稳稳的！下次试着和小鼓一起拍。':'有的拍点近，有的拍点远。试着跟着小鼓，让每一拍间隔一样长。';
  return {source:'demo',message,notice:'演示反馈 · 本地拍点规则，尚未配置千问密钥'};
 }
 const res=await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.QWEN_MODEL||'qwen-plus',messages:[{role:'system',content:'你是儿童音乐伙伴。根据拍手间隔毫秒数据给一句温暖、具体的中文节奏反馈，最多60字。不诊断、不评分羞辱。数据不足请说明。你只分析时间数据，没有听到音频。'},{role:'user',content:JSON.stringify(data)}],max_tokens:180}),signal:AbortSignal.timeout(15000)});
 if(!res.ok)throw new Error('PROVIDER_ERROR');
 const result=await res.json();const message=result.choices?.[0]?.message?.content;
 if(typeof message!=='string'||!message.trim())throw new Error('EMPTY_RESPONSE');
 return {source:'qwen',message,notice:'千问反馈 · 根据点击时间分析，未分析录音'};
}
export async function rhythmReport(data){
 const report=analyzeRhythm(data),key=process.env.QWEN_API_KEY||process.env.DASHSCOPE_API_KEY;
 if(!key)return {...report,notice:'本地拍点规则反馈 · '+report.notice};
 const response=await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.QWEN_MODEL||'qwen-plus',messages:[{role:'system',content:'你是儿童节奏教学伙伴。依据给定拍点统计，将三条建议改写得温暖、具体、适合孩子执行。只返回 JSON 对象，字段 strength、nextStep、exercise，每条不超过80字。不得更改数字，不得断言已掌握或颁发资格，不诊断、不羞辱。没有听到原始音频，不能评价音色或身体动作。麦克风与混合输入设备延迟未校准，不作确定的早晚评价。数据不足要说明。'},{role:'user',content:JSON.stringify({metrics:report.metrics,inputSource:report.inputSource,strength:report.strength,nextStep:report.nextStep,exercise:report.exercise})}],max_tokens:500}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('PROVIDER_ERROR');
 const result=await response.json();let narrative;
 try{narrative=JSON.parse(result.choices?.[0]?.message?.content);}catch{throw Error('INVALID_REPORT');}
 if(!['strength','nextStep','exercise'].every(k=>typeof narrative?.[k]==='string'&&narrative[k].trim()&&narrative[k].length<=160))throw Error('INVALID_REPORT');
 return {...report,strength:narrative.strength,nextStep:narrative.nextStep,exercise:narrative.exercise,source:'qwen',notice:'千问教学建议 · '+report.notice};
}
export const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.url==='/api/rhythm-report'&&req.method==='POST'){
  try{let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>32768){res.writeHead(413);res.end();return;}}const result=await rhythmReport(JSON.parse(body));res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(result));}
  catch(e){res.writeHead(e.message==='INVALID_INPUT'||e instanceof SyntaxError?400:502,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'报告暂时没有生成，请重试。作品仍可试听和收藏。'}));}return;
 }
 if(req.url==='/api/feedback'&&req.method==='POST'){
  try{let body='';for await(const chunk of req){body+=chunk;if(body.length>4096){res.writeHead(413);res.end();return;}}const result=await feedback(JSON.parse(body));res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(result));}
  catch(e){res.writeHead(e.message==='INVALID_INPUT'||e instanceof SyntaxError?400:502,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'反馈暂时没连上，请重试。你的作品还在。'}));}return;
 }
 const files={'/flow.js':'flow.js','/flow-model.js':'flow-model.js','/flow.css':'flow.css','/':'index.html','/practice.html':'practice.html','/integration-handoff.js':'integration-handoff.js','/app.js':'app.js','/style.css':'style.css','/game/escape-scene.js':'game/escape-scene.js','/game/escape-engine.js':'game/escape-engine.js','/game/escape.css':'game/escape.css'};

 for(const name of ['escape-world.js','night-music.js','vendor/three.module.js','vendor/three.core.js','vendor/GLTFLoader.js','vendor/BufferGeometryUtils.js'])files['/game/'+name]='game/'+name;
 for(const name of ['monster.glb','windmill.glb'])files['/assets/rescue/'+name]='assets/rescue/'+name;
 for(const name of ['rhythm.js','interior-world.js','interior-session.js','jump-rope-engine.js','jump-rope-motion.js'])files['/game/'+name]='game/'+name;
 for(const name of ['clap-detector.js','clap-worklet.js','clap-input.js','clap-lab.js'])files['/game/'+name]='game/'+name;
 files['/clap-test.html']='clap-test.html';
 files['/game/song-mixer.js']='game/song-mixer.js';
 files['/assets/audio/da-feng-che-96bpm.wav']='assets/audio/da-feng-che-96bpm.wav';
 files['/flow-medals.js']='flow-medals.js';
 files['/practice.html']='practice.html';
 for(const name of ['rhythm-report.js','report-controller.js','report-view.js'])files['/'+name]=name;
 files['/plush-fur.js']='plush-fur.js';
 for(const version of ['plush-v1','plush-v2'])for(const name of ['dongdong','youyou','bengbeng','windmill','whale','penguin','dachshund'])files['/assets/'+version+'/'+name+'.glb']='assets/'+version+'/'+name+'.glb';
 files['/night-rescue.html']='night-rescue.html';files['/game/night-entry.js']='game/night-entry.js';
 const file=files[req.url?.split('?')[0]];if(!file){res.writeHead(404);res.end('Not found');return;}
 try{res.setHeader('Content-Type',file.endsWith('.wav')?'audio/wav':file.endsWith('.glb')?'model/gltf-binary':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await readFile(root+file));}catch(e){res.writeHead(e.code==='ENOENT'?404:500);res.end('Unavailable');}
});
if(process.argv[1]===fileURLToPath(import.meta.url))server.listen(Number(process.env.PORT)||5173,'127.0.0.1',()=>console.log('Let’s Clap: http://127.0.0.1:5173'));
