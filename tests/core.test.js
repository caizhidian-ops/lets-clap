import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compilePlan,rulePlan,validateCell,allowedIds,id} from '../src/music/rhythm.js';
import {Game,keywordIntent,transitions} from '../src/app/fsm.js';
import {analyze,matchOnsets,feedbackOptions,validateAnalysis} from '../src/audio/analysis.js';
import {TransientDetector} from '../src/audio/detector.js';
import {wavBlob} from '../src/audio/engine.js';
import {arrange} from '../server/arrangement/service.js';
import {qwenConfig,tool} from '../server/realtimeProxy/qwen.js';
const kb=JSON.parse(readFileSync(new URL('../data/notation-patterns.v1.json',import.meta.url)));
const score=JSON.parse(readFileSync(new URL('../data/verified-score.json',import.meta.url)));
const plan=()=>rulePlan(kb,{mood:'happy',difficulty:2,bpm:72});
test('真实知识库 57 个单元，曲谱 4/4 前两小节覆盖八拍',()=>{
  assert.equal(kb.items.length,57);assert.equal(score.meter.beats,4);
  assert.equal(score.measures.length,12);
  for(const m of score.measures.slice(0,2))assert.equal(m.notes.reduce((n,e)=>n+e.duration,0),4);
});
for(const mood of ['happy','calm','excited'])for(const difficulty of [1,2,3])test(mood+' difficulty '+difficulty+' uses real two-beat cells and eight beats',()=>{
  const p=rulePlan(kb,{mood,difficulty,bpm:72});
  assert.equal(p.cellPatternIds.length,4);assert.equal(p.events.reduce((n,e)=>n+e.durationBeats,0),8);
  assert.equal(p.durationSec,8*60/72);assert.equal(p.source,'rule_fallback');
  assert.ok(p.cellPatternIds.every(x=>allowedIds(mood,difficulty).includes(x)));
  assert.ok(new Set(p.cellPatternIds).size>1||difficulty===1);
});
test('三种情绪默认密度可区分；降难度不会增加拍手密度',()=>{
  const count=(m,d)=>rulePlan(kb,{mood:m,difficulty:d,bpm:72}).expectedOnsetsSec.length;
  assert.ok(count('calm',2)<count('happy',2));assert.ok(count('happy',2)<count('excited',2));
  for(const m of ['happy','calm','excited'])assert.ok(count(m,1)<=count(m,2)&&count(m,2)<=count(m,3));
});
test('拒绝模型发明 ID、跨难度 ID、错误速度和数量',()=>{
  for(const ids of [[id(999),id(1),id(1),id(1)],[id(2),id(1),id(1),id(1)],[id(1)]])assert.throws(()=>compilePlan(kb,{mood:'happy',difficulty:1,bpm:72,cellPatternIds:ids}));
  assert.throws(()=>compilePlan(kb,{mood:'happy',difficulty:2,bpm:NaN,cellPatternIds:Array(4).fill(id(1))}));
});
test('休止不生成拍手；新计划拥有不同 ID',()=>{
  const p=rulePlan(kb,{mood:'calm',difficulty:2,bpm:72});
  assert.equal(p.expectedOnsetsSec.length,5);assert.ok(!p.expectedOnsetsSec.includes(0));
  assert.notEqual(p.planId,rulePlan(kb,{mood:'calm',difficulty:2,bpm:72}).planId);
});
test('单元重叠、空隙、负时值、非布尔休止和三拍都拒绝',()=>{
  const base=kb.items[0];
  for(const changes of [{spanBeats:3},{events:[{atBeat:0,durationBeats:-1,rest:false}]},{events:[{atBeat:0,durationBeats:1,rest:false},{atBeat:.5,durationBeats:1,rest:false}]},{events:[{atBeat:0,durationBeats:2,rest:'false'}]}])assert.throws(()=>validateCell({...base,...changes}));
});
test('AI 编排最多修正一次，失败明确规则后备',async()=>{
  let calls=0;const request=async()=>{calls++;return {calls:[{name:'suggest_rhythm_arrangement',arguments:'{"cellPatternIds":["invented"]}'}]};};
  const p=await arrange(kb,{mood:'happy',difficulty:2,bpm:72},request,true);
  assert.equal(calls,2);assert.equal(p.source,'rule_fallback');
});
test('合法 AI 工具结果经校验；模型不能覆盖情绪、难度和 BPM',async()=>{
  const p=await arrange(kb,{mood:'happy',difficulty:2,bpm:72},async()=>({calls:[{name:'suggest_rhythm_arrangement',arguments:JSON.stringify({cellPatternIds:[id(1),id(4),id(1),id(3)],bpm:300,mood:'calm',difficulty:3})}]}),true);
  assert.equal(p.source,'ai_validated');assert.equal(p.bpm,72);assert.equal(p.mood,'happy');assert.equal(p.difficulty,2);
});
test('FSM 首次孵化、已孵化首页、状态守卫、幂等和旧轮次拒绝',()=>{
  const game=new Game();assert.equal(game.state,'HATCH_SELECT');assert.throws(()=>game.act('enter_adventure'));
  for(const a of ['choose_personality','guided_playback_complete','reveal_complete','confirm_name'])game.act(a);
  game.pet={hatched:true};game.act('enter_adventure',{turnId:'turn1'});
  assert.throws(()=>game.act('intro_complete',{turnId:'turn1'}));
  assert.throws(()=>game.act('intro_complete',{sceneVersion:0}));game.act('intro_complete');
  assert.equal(new Game({hatched:true}).state,'PET_HOME');
});
test('录音期间调难度、AI 启动录音被拒绝；取消返回预览',()=>{
  const g=new Game({hatched:true});for(const a of ['enter_adventure','intro_complete','select_mood','plan_fallback','start_challenge','count_in_complete'])g.act(a);
  assert.equal(g.state,'RECORDING');assert.throws(()=>g.act('reduce_difficulty'));assert.throws(()=>g.act('confirm_plan'));g.act('cancel');assert.equal(g.state,'PLAN_PREVIEW');
});
test('所有状态有确定的操作表；关键词后备只报告意图',()=>{
  assert.ok(transitions.RECORDING.cancel && transitions.WORK_PREVIEW.return_home);
  assert.equal(keywordIntent('我们去探险吧'),'enter_adventure');assert.equal(keywordIntent('太难了简单一点'),'reduce_difficulty');assert.equal(keywordIntent('已经拍得很准确'),null);
});
test('一对一单调匹配准确、漏拍、多拍、早晚；不重复匹配',()=>{
  const r=matchOnsets([0,1,2,3],[.02,.9,2.1,2.5]);
  assert.equal(r.filter(x=>x.type==='onTime').length,1);assert.equal(r.filter(x=>x.type==='early').length,1);assert.equal(r.filter(x=>x.type==='late').length,1);assert.equal(r.filter(x=>x.type==='missed').length,1);assert.equal(r.filter(x=>x.type==='extra').length,1);
  assert.equal(new Set(r.filter(x=>x.detectedIndex!==undefined).map(x=>x.detectedIndex)).size,4);
});
test('全局匹配优先保留最大匹配数',()=>{
  const r=matchOnsets([0,.2],[.11,.3],.18);assert.equal(r.filter(x=>!['missed','extra'].includes(x.type)).length,2);
});
test('可靠摘要来自实际传入起始点，未经校准不反馈早晚',()=>{
  const p=plan(),a=analyze(p,{onsets:p.expectedOnsetsSec.map(t=>t+.09),qualityFlags:[]},'rec');
  assert.equal(a.matchSummary.late,p.expectedOnsetsSec.length);assert.equal(a.status,'reliable');
  assert.ok(feedbackOptions(a).every(x=>!['early','late'].some(t=>x.code.startsWith(t))));
  assert.equal(validateAnalysis(a,p),a);
});
test('静音和持续噪声不给可靠评分',()=>{
  const p=plan();for(const capture of [{onsets:[],qualityFlags:[]},{onsets:[0],qualityFlags:['continuous_noise']}]){const a=analyze(p,capture,'rec');assert.equal(a.status,'unreliable');assert.equal(feedbackOptions(a)[0].code,'uncertain');}
});
test('拒绝错 plan、假计数和越界反馈',()=>{
  const p=plan(),a=analyze(p,{onsets:p.expectedOnsetsSec,qualityFlags:[]},'rec');
  assert.throws(()=>validateAnalysis({...a,planId:'wrong'},p));assert.throws(()=>validateAnalysis({...a,detectedCount:99},p));
  assert.throws(()=>validateAnalysis({...a,notableEvents:[{type:'early',expectedIndex:999,errorMs:-80}]},p));
});
test('合成测试夹具：三个脉冲检测、双峰抑制、持续噪声不可靠',()=>{
  const rate=48000,d=new TransientDetector(rate),total=rate*2;
  let seed=2;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296*2-1;};
  for(let offset=0;offset<total;offset+=128){const b=new Float32Array(128);for(let j=0;j<128;j++){const t=(offset+j)/rate;for(const at of [.2,.7,1.2])if(t>=at&&t<at+.055)b[j]=random()*.5*Math.exp(-(t-at)/.008);}d.process(b,offset/rate);}
  assert.equal(d.result().onsets.length,3);assert.deepEqual(d.result().qualityFlags,[]);
  const noisy=new TransientDetector(rate);for(let i=0;i<500;i++)noisy.process(Float32Array.from({length:128},random),i*128/rate);assert.ok(noisy.result().qualityFlags.includes('continuous_noise'));
});
test('WAV 是真实 PCM 帧，精确长度且不是 MediaRecorder 到达时间',async()=>{
  const input=new Float32Array([0,.5,-.5,1]),blob=wavBlob(input,48000),b=await blob.arrayBuffer(),v=new DataView(b);
  assert.equal(b.byteLength,52);assert.equal(v.getUint32(24,true),48000);assert.equal(v.getUint32(40,true),8);assert.equal(v.getInt16(46,true),16383);
});
test('千问 URL、服务端密钥配置与正式 Function Calling schema',()=>{
  const c=qwenConfig({DASHSCOPE_API_KEY:'secret',DASHSCOPE_WORKSPACE_ID:'workspace',DASHSCOPE_REGION:'cn-beijing'});
  assert.ok(c.enabled);assert.ok(c.url.includes('workspace.cn-beijing.maas.aliyuncs.com'));assert.ok(c.url.endsWith('model=qwen3.8-omni-flash-realtime'));
  assert.throws(()=>qwenConfig({DASHSCOPE_REGION:'wrong'}));assert.equal(tool('x','x',{}).function.parameters.type,'object');
});
