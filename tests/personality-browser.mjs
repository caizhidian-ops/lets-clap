// Synthetic speech through Chromium's fake microphone; not a human microphone certification.
import {createRequire} from 'node:module';
import {writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {approvedSpeech} from '../server/realtimeProxy/qwen.js';
import {wavBlob} from '../src/audio/engine.js';
let fixture='';for(let i=0;i<2&&!fixture;i++)fixture=await approvedSpeech('我希望它安静一点，温柔一点。');assert.ok(fixture,'Synthetic fixture generation failed');
const pcm=Buffer.from(fixture,'base64'),samples=new Float32Array(pcm.length/2);for(let i=0;i<samples.length;i++)samples[i]=pcm.readInt16LE(i*2)/32768;
await mkdir('test-results',{recursive:true});const path=resolve('test-results/personality-synthetic-fixture.wav');await writeFile(path,Buffer.from(await wavBlob(samples,24000).arrayBuffer()));
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--use-file-for-fake-audio-capture='+path,'--autoplay-policy=no-user-gesture-required']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.__streams=[];const acquire=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async(...args)=>{const stream=await acquire(...args);window.__streams.push(stream);return stream;};});
 await page.goto(process.env.BASE_URL||'http://127.0.0.1:5173');
 await page.getByRole('button',{name:'开始语音对话'}).click();
 await page.getByRole('button',{name:'结束说话'}).waitFor();
 await page.waitForTimeout(samples.length/24000*1000+600);
 await page.getByRole('button',{name:'结束说话'}).click();
 await page.getByRole('heading',{name:'跟着灯光， 唤醒小伙伴。'}).waitFor({timeout:65000});
 const state=await page.evaluate(()=>fetch('/api/state').then(r=>r.json()));assert.equal(state.personality,'quiet');
 assert.ok(await page.evaluate(()=>window.__streams.length===1&&window.__streams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))),'Selection microphone stops before hatch');
 await page.waitForFunction(()=>Number(document.querySelector('.hatch-art')?.dataset.hits)>0);
 assert.equal(await page.locator('[data-guide]').count(),4);
 const active=page.locator('[data-guide].active');await active.waitFor();assert.equal(await active.locator('small').textContent(),'拍！');
 await page.screenshot({path:'test-results/personality-voice-hatch.png'});
 await page.getByRole('textbox',{name:'宠物名字'}).waitFor();assert.ok((await page.locator('.plush-pet').getAttribute('src')).endsWith('whale.png'));
 assert.deepEqual(errors,[]);console.log('PASS synthetic microphone → real Qwen quiet choice → hatch guide → whale; microphone stopped before hatch; visible clap cue');
}finally{await browser.close();}
