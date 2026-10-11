import {ropeTiming} from './jump-rope-motion.js';
// Rope contact follows the cue; scoring and animation use the same timing.
export function createJumpRopeRun({bpm=90,beats=16,runId}={}){
 if(!Number.isFinite(bpm)||bpm<40||bpm>150||!Number.isInteger(beats)||beats<4||beats>64)throw Error('Invalid jump-rope tempo');
 const {period,crossingDelay,jumpDuration,window}=ropeTiming(bpm);const expected=Array.from({length:beats},(_,i)=>i*period),duration=beats*period+crossingDelay+.02;
 const hits=new Set(),times=[];let lastInput=-Infinity,extras=0,combo=0,bestCombo=0,settled=0,ended=false;
 function snapshot(elapsed){while(settled<beats&&elapsed>expected[settled]+crossingDelay){if(!hits.has(settled))combo=0;settled++;}return {matchedCount:hits.size,expectedCount:beats,missedCount:Math.max(0,settled-[...hits].filter(i=>i<settled).length),settledCount:settled,combo,bestCombo};}
 return {period,expected,duration,window,crossingDelay,isCleared:index=>hits.has(index),
  ingest(at){if(ended||!Number.isFinite(at)||at<0||at>=duration)return {accepted:false,reason:'inactive'};
   snapshot(at);if(at-lastInput<jumpDuration)return {accepted:false,reason:'airborne'};lastInput=at;times.push(Math.round(at*1000));
   const index=Math.round(at/period),offset=at-(expected[index]??Infinity);
   if(index<0||index>=beats||Math.abs(offset)>window||hits.has(index)){extras++;combo=0;return {accepted:false,reason:offset<0?'early':'late',jump:true};}
   hits.add(index);combo++;bestCombo=Math.max(bestCombo,combo);return {accepted:true,index,offset,jump:true};
  },snapshot,
  finish(elapsed){if(elapsed<duration)throw Error('Jump-rope round has not ended');ended=true;snapshot(duration);return {runId,planId:'jump-rope-quarter-v1',gameId:'jump-rope',inputSource:'tap_demo',analysisStatus:'reliable',outcome:hits.size>=Math.ceil(beats*.6)?'completed':'keep_practicing',matchedCount:hits.size,expectedCount:beats,missedCount:beats-hits.size,extraCount:extras,bestCombo,durationSec:duration,times:[...times]};}
 };
}
