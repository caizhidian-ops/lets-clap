// Integration fixture: synthesized speech and timed noise pulses enter real Worklets and Qwen.
// This verifies the flow, not a human microphone or calibrated clap timing.
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {approvedSpeech} from '../server/realtimeProxy/qwen.js';
import {wavBlob} from '../src/audio/engine.js';
const phrases={select:'我希望它安静一点，温柔一点。',name:'我想叫它小蓝。',home:'我们去探险吧。',mood:'我现在很开心。',simpler:'太难了，简单一点。',ready:'我准备好了。',keep:'保留这次。',work:'听听我的作品。'};
let fixtures={};try{fixtures=JSON.parse(await readFile('test-results/voice-first-fixtures.json','utf8'));}catch{}await mkdir('test-results',{recursive:true});
for(const [id,text] of Object.entries(phrases)){
 if(fixtures[id])continue;let pcm='';for(let i=0;i<2&&!pcm;i++)pcm=await approvedSpeech(text);assert.ok(pcm,'Synthetic speech failed: '+id);
 const b=Buffer.from(pcm,'base64'),samples=new Float32Array(b.length/2);for(let i=0;i<samples.length;i++)samples[i]=b.readInt16LE(i*2)/32768;
 const wav=Buffer.from(await wavBlob(samples,24000).arrayBuffer());fixtures[id]=wav.toString('base64');
}
await writeFile('test-results/voice-first-fixtures.json',JSON.stringify(fixtures));
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--autoplay-policy=no-user-gesture-required']});
let page;try{
 page=await browser.newPage({viewport:{width:1280,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('websocket',ws=>ws.on('framereceived',({payload})=>{try{const e=JSON.parse(payload);if(['voice_result','error','name_candidate'].includes(e.type))console.log('VOICE',JSON.stringify({type:e.type,text:e.text,transcript:e.transcript,name:e.name,message:e.message}));}catch{}}));
 page.on('response',r=>{if(r.status()>=400)console.log('HTTP',r.status(),r.url());});
 page.on('console',m=>{if(m.type()==='error')console.log('BROWSER',m.text());});
 await page.addInitScript(({fixtures})=>{
  window.__streams=[];window.__requests=[];window.__cues=[];window.__players=[];const originalPlay=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){window.__players.push(this);window.__cues.push({src:this.src,time:performance.now(),event:'play'});this.addEventListener('ended',()=>window.__cues.push({src:this.src,time:performance.now(),event:'ended'}),{once:true});return originalPlay.call(this);};let planTurns=0;
  navigator.mediaDevices.getUserMedia=async()=>{
   const state=await fetch('/api/state').then(r=>r.json()),scene=state.state;
   let id={HATCH_SELECT:'select',PET_NAMING:'name',PET_HOME:'home',MOOD_SELECT:'mood',FEEDBACK:'keep',WORK_PREVIEW:'work'}[scene];
   if(scene==='PLAN_PREVIEW')id=['simpler','ready','claps'][planTurns++];
   window.__requests.push({scene,id,time:performance.now()});
   const ctx=new AudioContext(),destination=ctx.createMediaStreamDestination(),source=ctx.createBufferSource();
   if(id==='claps'){
    const plan=state.plan,offset=4*60/plan.bpm+.3,buffer=ctx.createBuffer(1,Math.ceil((offset+plan.durationSec+1)*ctx.sampleRate),ctx.sampleRate),data=buffer.getChannelData(0);
    for(const t of plan.expectedOnsetsSec)for(let i=0;i<ctx.sampleRate*.04;i++)data[Math.round((offset+t)*ctx.sampleRate)+i]=Math.sin(i*1.73)*.7*Math.exp(-i/(ctx.sampleRate*.01));
    source.buffer=buffer;source.connect(destination);source.start();
   }else if(fixtures[id]){
    source.buffer=await ctx.decodeAudioData(Uint8Array.from(atob(fixtures[id]),c=>c.charCodeAt(0)).buffer);source.connect(destination);source.start(ctx.currentTime+.35);
   }else{source.buffer=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);source.connect(destination);source.start();}
   source.onended=()=>setTimeout(()=>ctx.close(),3000);window.__streams.push(destination.stream);return destination.stream;
  };
 },{fixtures});
 await page.goto(process.env.BASE_URL||'http://127.0.0.1:5173');
 assert.equal(await page.title(),"let's clap · 一起拍手吧");assert.equal(await page.locator('.developer').getAttribute('open'),null);
 await page.screenshot({path:'test-results/voice-first-select.png'});
 await page.getByRole('button',{name:'开始语音对话'}).click();
 await page.getByRole('heading',{name:'跟着灯光， 唤醒小伙伴。'}).waitFor({timeout:65000});
 const state=()=>page.evaluate(()=>fetch('/api/state').then(r=>r.json()));assert.equal((await state()).personality,'quiet');
 await page.waitForFunction(()=>Boolean(document.querySelector('.name-form input')?.value),null,{timeout:65000});
 assert.equal((await state()).state,'PET_NAMING');assert.equal(await page.evaluate(()=>localStorage.getItem('bobo.pet')),null);
 await page.screenshot({path:'test-results/voice-first-name.png'});
 await page.getByRole('button',{name:'确认名字'}).click();
 await page.getByRole('button',{name:'开始挑战',exact:true}).waitFor({timeout:65000});
 await page.waitForFunction(async()=>{const s=await fetch('/api/state').then(r=>r.json());return s.plan?.difficulty===1;},null,{timeout:65000});
 await page.waitForFunction(()=>window.__requests.filter(r=>r.scene==='PLAN_PREVIEW').length===2,null,{timeout:65000});
 await page.waitForFunction(()=>!document.querySelector('[data-action="challenge"]').disabled&&document.querySelector('.voice strong')?.textContent==='准备好就点开始挑战',null,{timeout:65000});
 assert.equal((await state()).plan.difficulty,1);assert.equal((await state()).state,'PLAN_PREVIEW');
 await page.screenshot({path:'test-results/voice-first-challenge.png'});
 await page.getByRole('button',{name:'开始挑战',exact:true}).click();
 await page.getByRole('button',{name:'保留这次',exact:true}).waitFor({timeout:65000});
 await page.waitForFunction(()=>window.__requests.some(r=>r.scene==='FEEDBACK'),null,{timeout:65000});
 await page.waitForFunction(()=>document.querySelector('.voice strong')?.textContent==='点麦克风可以继续说',null,{timeout:65000});
 assert.equal((await state()).state,'FEEDBACK');
 const workBefore=await page.evaluate(async()=>{const s=await import('/src/store/storage.js');return !!await s.loadWork();});assert.equal(workBefore,false,'Voice keep request only asks for explicit confirmation');
 const analysis=(await state()).analysis;assert.ok(analysis.detectedCount>0,'Timed synthetic PCM is actually analyzed');
 await page.getByRole('button',{name:'保留这次',exact:true}).click();
 await page.waitForFunction(()=>window.__requests.some(r=>r.scene==='WORK_PREVIEW'),null,{timeout:65000});
 await page.getByRole('button',{name:'停止试听',exact:true}).waitFor({timeout:65000});
 await page.getByRole('button',{name:'暂停语音'}).click();
 assert.equal((await state()).state,'WORK_PREVIEW');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/voice-first-work-mobile.png',fullPage:true});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>window.__streams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))));
 console.log('PASS real Qwen synthetic speech: personality → name candidate → explicit name confirmation → adventure → mood → legal arrangement → automatic demo → reduce difficulty → record confirmation → PCM analysis → keep confirmation → voice mix; no page errors/overflow; all streams released');
 console.log(JSON.stringify({analysis,requests:await page.evaluate(()=>window.__requests.map(({scene,id})=>({scene,id}))) }));
}catch(e){console.log('FAIL STATE',await page?.evaluate(async()=>({state:await fetch('/api/state').then(r=>r.json()),requests:window.__requests,cues:window.__cues,players:window.__players.map(p=>({src:p.src,currentTime:p.currentTime,duration:p.duration,paused:p.paused,ended:p.ended})),voice:document.querySelector('.voice')?.textContent,toast:document.querySelector('.toast')?.textContent})));await page?.screenshot({path:'test-results/voice-first-failure.png',fullPage:true});throw e;}finally{await browser.close();}
