import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compilePlan,rulePlan} from '../src/music/rhythm.js';
import {createJumpRopeRun} from '../public/game/jump-rope-engine.js';
import {analyzeRhythm} from '../public/rhythm-report.js';
import {validateHandoff,saveHandoff,loadHandoff} from '../public/integration-handoff.js';
import {songBeats} from '../public/game/song-mixer.js';
const kb=JSON.parse(await readFile(new URL('../data/notation-patterns.v1.json',import.meta.url)));
test('Mio sparse and eighth-note plans drive the same game and report targets',()=>{
 for(const mood of ['happy','calm'])for(const difficulty of [1,2,3])for(const bpm of [40,72,96,180]){
  const plan=rulePlan(kb,{mood,difficulty,bpm});
  const run=createJumpRopeRun({bpm,beats:8,onsets:plan.expectedOnsetsSec,planId:plan.planId,runId:'test'});
  for(const t of plan.expectedOnsetsSec)assert.equal(run.ingest(t).accepted,true,`${mood} ${difficulty} ${bpm} ${t}`);
  const result=run.finish(plan.durationSec);
  assert.equal(result.matchedCount,plan.expectedOnsetsSec.length);assert.equal(result.planId,plan.planId);
  const report=analyzeRhythm(result);assert.equal(report.metrics.missed,0);assert.equal(report.reliable,true);assert.equal(report.qualified,false);
 }
});
test('handoff preserves named pet and rejects malformed plans without touching albums',()=>{
 const plan=compilePlan(kb,{mood:'happy',difficulty:1,bpm:72,cellPatternIds:Array(4).fill('RHY-CELL-001')});
 const value={plan,pet:{hatched:true,personality:'silly',name:'小米'}};
 const map=new Map([['lets-clap-v1','old-album']]),storage={setItem:(k,v)=>map.set(k,v),getItem:k=>map.get(k)};
 saveHandoff(storage,value);assert.equal(loadHandoff(storage).petId,'dachshund');assert.equal(map.get('lets-clap-v1'),'old-album');
 assert.throws(()=>validateHandoff({...value,plan:{...plan,expectedOnsetsSec:[1,0]}}));
 assert.throws(()=>validateHandoff({...value,pet:{...value.pet,hatched:false}}));
});
test('sparse eight-beat pattern repeats by musical length rather than target count',()=>{
 const events=songBeats({sourceBpm:96,patternBeats:8,expectedCount:3,times:[0,1250,3750]});
 assert.deepEqual(events.slice(0,6).map(e=>e.beat),[0,2,6,8,10,14]);
});
