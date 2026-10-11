import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyzeRhythm,learningProgress,reportInput} from '../public/rhythm-report.js';
import {createReportController} from '../public/report-controller.js';
import {createJumpRopeRun} from '../public/game/jump-rope-engine.js';
import {rhythmReport,server} from '../server.mjs';
function round(id='run',offset=0){const run=createJumpRopeRun({runId:id});run.expected.forEach(t=>run.ingest(t+offset));return {...run.finish(30),id,date:1000,mood:'开心'};}
test('report uses actual target timing and distinguishes early, late and no input',()=>{
 const good=analyzeRhythm(reportInput(round()));assert.equal(good.metrics.matched,48);assert.equal(good.metrics.meanAbsOffsetMs,0);assert.equal(good.qualified,true);
 const early=round('early',-.1);assert.match(analyzeRhythm(reportInput(early)).nextStep,/先到了/);
 const late=round('late',.1);assert.match(analyzeRhythm(reportInput(late)).nextStep,/晚到了/);
 const empty={...round(),times:[],matchedCount:0};assert.match(analyzeRhythm(reportInput(empty)).nextStep,/没有记录/);assert.equal(analyzeRhythm(reportInput(empty)).metrics.meanAbsOffsetMs,null);
});
test('completion, duplicated inputs, mixed input and inconsistent evidence do not award mastery',()=>{
 const good=round();const partial={...good,times:good.times.slice(0,30),matchedCount:30};assert.equal(analyzeRhythm(reportInput(partial)).qualified,false);
 const extras={...good,times:good.times.flatMap(t=>[t,t+10])};const report=analyzeRhythm(reportInput(extras));assert.equal(report.metrics.extra,48);assert.equal(report.qualified,false);assert.match(report.nextStep,/一次动作/);
 assert.equal(analyzeRhythm(reportInput({...good,inputSource:'mixed_mic_tap'})).qualified,false);
 assert.equal(analyzeRhythm(reportInput({...good,matchedCount:1})).reliable,false);
 assert.equal(analyzeRhythm(reportInput({...good,analysisStatus:'uncertain'})).qualified,false);
 assert.equal(analyzeRhythm(reportInput({...good,planId:'unknown'})).qualified,false);
 const boundary={...good,times:good.times.map((t,i)=>t+(i%4===0?51:50))};assert.equal(analyzeRhythm(reportInput(boundary)).qualified,false);
});
test('growth cards require three unique rounds separately for mic and tap, never upgrade legacy tracks',()=>{
 const a=round('a'),b=round('b'),c=round('c');
 assert.equal(learningProgress([a,a,b])[0].mastered,false);
 assert.equal(learningProgress([a,b,c])[0].mastered,true);
 assert.deepEqual(learningProgress([a,b,c])[0].evidence,['a','b','c']);
 assert.equal(learningProgress([a,b,{...c,inputSource:'microphone_clap'}])[0].mastered,false);
 assert.equal(learningProgress([{id:'legacy',times:[0,625],outcome:'completed'}])[0].count,0);
 assert.equal(learningProgress([a,b,c].map(t=>({...t,inputSource:'microphone_clap'})))[1].mastered,true);
});
test('Mio nonuniform plans preserve rests in coaching and never award the uniform rhythm card',()=>{
 const run=createJumpRopeRun({bpm:72,beats:8,onsets:[0,.416,1.666,3.333,5.416],planId:'mio-plan'});run.expected.forEach(t=>run.ingest(t));const result=run.finish(run.duration),report=analyzeRhythm(reportInput(result));
 assert.equal(report.metrics.matched,5);assert.equal(report.qualified,false);assert.match(report.exercise,/休止/);assert.doesNotMatch(report.nextStep,/间隔一样长/);
 const mic=analyzeRhythm(reportInput({...round('mic',.1),inputSource:'microphone_clap'}));assert.doesNotMatch(mic.nextStep,/晚到了/);assert.match(mic.notice,/设备延迟/);
});
test('report validation rejects nonfinite, excessive or unsorted input',()=>{
 for(const times of [[NaN],[-1],[625,0],Array(513).fill(0)])assert.throws(()=>analyzeRhythm({...reportInput(round()),times}),/INVALID_INPUT/);
 assert.throws(()=>analyzeRhythm({...reportInput(round()),expectedTimes:[0,0]}),/INVALID_INPUT/);
});
test('asynchronous reports keep per-run identity, deduplicate requests, and preserve timing evidence',async()=>{
 const pending=[];const controller=createReportController({request:()=>new Promise(resolve=>pending.push(resolve))});const a=round('a'),b=round('b');
 const first=controller.start(a);assert.equal(a.report.status,'pending');assert.equal(controller.start(a),first);const second=controller.start(b);
 const reply=(track,strength)=>({ok:true,json:async()=>({...analyzeRhythm(reportInput(track)),strength,qualified:false,metrics:{matched:0}})});
 pending[1](reply(b,'B'));await second;pending[0](reply(a,'A'));await first;
 assert.equal(a.report.strength,'A');assert.equal(b.report.strength,'B');assert.equal(a.report.qualified,true);assert.equal(a.report.metrics.matched,48);
});
test('failed analysis can retry; unsupported history does not trigger requests',async()=>{
 let fail=true,calls=0;const controller=createReportController({request:async()=>{calls++;if(fail)throw Error('offline');return {ok:true,json:async()=>analyzeRhythm(reportInput(round()))};}});const track=round();
 await controller.start(track);assert.equal(track.report.status,'failed');assert.equal(track.report.metrics.matched,48);
 fail=false;await controller.start(track,{retry:true});assert.equal(track.report.status,'ready');assert.equal(calls,2);
 const legacy={id:'old',times:[]};await controller.start(legacy);assert.equal(legacy.report.status,'unavailable');assert.equal(calls,2);
});
test('report HTTP uses local rules without credentials and returns a recoverable provider failure',async()=>{
 const a=process.env.QWEN_API_KEY,b=process.env.DASHSCOPE_API_KEY,original=globalThis.fetch;delete process.env.QWEN_API_KEY;delete process.env.DASHSCOPE_API_KEY;
 try{
  const local=await rhythmReport(reportInput(round()));assert.equal(local.source,'local_rules');assert.match(local.notice,/本地/);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
  const response=await fetch(base+'/api/rhythm-report',{method:'POST',body:JSON.stringify(reportInput(round()))});assert.equal(response.status,200);assert.equal((await response.json()).metrics.matched,48);
  assert.equal((await fetch(base+'/api/rhythm-report',{method:'POST',body:'{}'})).status,400);
  assert.equal((await fetch(base+'/report-view.js')).status,200);
  await new Promise(resolve=>server.close(resolve));
  process.env.QWEN_API_KEY='test-only';globalThis.fetch=async()=>({ok:false});await assert.rejects(()=>rhythmReport(reportInput(round())),/PROVIDER_ERROR/);
  globalThis.fetch=async()=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({strength:'继续加油',nextStep:'跟着小鼓',exercise:'先听四拍'})}}]})});assert.equal((await rhythmReport(reportInput(round()))).source,'qwen');
 }finally{globalThis.fetch=original;if(server.listening)await new Promise(resolve=>server.close(resolve));if(a)process.env.QWEN_API_KEY=a;else delete process.env.QWEN_API_KEY;if(b)process.env.DASHSCOPE_API_KEY=b;else delete process.env.DASHSCOPE_API_KEY;}
});
