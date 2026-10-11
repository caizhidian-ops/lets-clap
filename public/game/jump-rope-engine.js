import {RHYTHM} from './rhythm.js';
import {ropeTiming} from './jump-rope-motion.js';
// Rope contact follows the cue; scoring and animation use the same timing.
export function createJumpRopeRun({bpm=RHYTHM.bpm,beats=RHYTHM.beats,runId,onsets,planId='jump-rope-quarter-v1'}={}){
 if(!Number.isFinite(bpm)||bpm<40||bpm>180||!Number.isInteger(beats)||beats<4||beats>64)throw Error('Invalid jump-rope tempo');
 const period=60/bpm,expected=onsets??Array.from({length:beats},(_,i)=>i*period),duration=beats*period;
 if(!expected.length||expected.some((t,i)=>!Number.isFinite(t)||t<0||t>=duration||(i&&t<=expected[i-1])))throw Error('Invalid timeline');
 const gap=expected.length>1?Math.min(period,...expected.slice(1).map((t,i)=>t-expected[i])):period;
 const motionBpm=60/gap,{crossingDelay,jumpDuration,window}=ropeTiming(motionBpm),targetCount=expected.length;
 const hits=new Set(),times=[];let lastInput=-Infinity,extras=0,combo=0,bestCombo=0,settled=0,ended=false;
 function snapshot(elapsed){while(settled<targetCount&&elapsed>expected[settled]+crossingDelay){if(!hits.has(settled))combo=0;settled++;}return {matchedCount:hits.size,expectedCount:targetCount,missedCount:Math.max(0,settled-[...hits].filter(i=>i<settled).length),settledCount:settled,combo,bestCombo};}
 return {period,expected,duration,window,crossingDelay,motionBpm,isCleared:index=>hits.has(index),
  ingest(at){if(ended||!Number.isFinite(at)||at<0||at>=duration)return {accepted:false,reason:'inactive'};
   snapshot(at);if(at-lastInput<jumpDuration)return {accepted:false,reason:'airborne'};lastInput=at;times.push(Math.round(at*1000));
   let index=0;expected.forEach((t,i)=>{if(Math.abs(t-at)<Math.abs(expected[index]-at))index=i;});const offset=at-expected[index];
   if(index<0||index>=targetCount||Math.abs(offset)>window||hits.has(index)){extras++;combo=0;return {accepted:false,reason:offset<0?'early':'late',jump:true};}
   hits.add(index);combo++;bestCombo=Math.max(bestCombo,combo);return {accepted:true,index,offset,jump:true};
  },snapshot,
  finish(elapsed){if(elapsed<duration)throw Error('Jump-rope round has not ended');ended=true;snapshot(duration);return {runId,planId,gameId:'jump-rope',inputSource:'tap_demo',analysisStatus:'reliable',bpm,expectedTimes:expected.map(t=>t*1000),toleranceMs:window*1000,outcome:hits.size>=Math.ceil(targetCount*.6)?'completed':'keep_practicing',matchedCount:hits.size,expectedCount:targetCount,missedCount:targetCount-hits.size,extraCount:extras,bestCombo,durationSec:duration,times:[...times]};}
 };
}
