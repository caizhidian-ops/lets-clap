import {RHYTHM} from './rhythm.js';
// Pure rules: callers supply timestamps relative to the start of the musical round.
export function createEscapeRun({bpm=RHYTHM.bpm, beats=RHYTHM.beats, onsets, runId, planId='intro-quarter-4bars-v2', inputSource='tap_demo',movement='escape'}={}) {
 if(!Number.isFinite(bpm)||bpm<30||bpm>240)throw Error('Invalid BPM');
 if(!Number.isInteger(beats)||beats<4||beats>64)throw Error('Invalid beat count');
 const duration=beats*60/bpm;
 const expected=onsets??Array.from({length:beats},(_,i)=>i*60/bpm);
 if(!expected.length||expected.some((t,i)=>!Number.isFinite(t)||t<0||t>=duration||(i&&t<=expected[i-1])))throw Error('Invalid timeline');
 const gap=expected.length>1?Math.min(...expected.slice(1).map((t,i)=>t-expected[i])):duration;
 const window=Math.min(.18,gap*.45), hits=new Set(), times=[];
 let finished=false, extras=0;
 const snapshot=elapsed=>({position:Math.max(0,Math.min(1,(movement==='brake'?.08-.08*Math.max(0,Math.min(elapsed,duration))/duration+hits.size/expected.length:.5-.3*Math.max(0,Math.min(elapsed,duration))/duration+.8*hits.size/expected.length))),matchedCount:hits.size,expectedCount:expected.length});
 return {
  duration, expected:[...expected], window,
  ingest(atSec){
   if(finished||!Number.isFinite(atSec)||atSec<0||atSec>=duration)return {accepted:false};
   times.push(Math.round(atSec*1000));
   let index=-1, distance=Infinity;
   expected.forEach((t,i)=>{const d=Math.abs(t-atSec);if(!hits.has(i)&&d<=window&&d<distance){index=i;distance=d;}});
   if(index<0){extras++;return {accepted:false};}hits.add(index);return {accepted:true,index};
  },
  snapshot,
  finish(elapsed){
   if(elapsed<duration)throw Error('Run has not ended');
   finished=true;return {runId,planId,inputSource,analysisStatus:'reliable',bpm,expectedTimes:expected.map(t=>t*1000),toleranceMs:window*1000,outcome:hits.size>=Math.ceil(.6*expected.length)?'escaped':'retry_needed',windmillStopped:hits.size>=Math.ceil(.6*expected.length),...snapshot(duration),missedCount:expected.length-hits.size,extraCount:extras,durationSec:duration,times:[...times]};
  }
 };
}
