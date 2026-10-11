import {recording} from '../recording-store.js';
import {RHYTHM} from './rhythm.js';
export const SONG = {...RHYTHM,bars:12,beats:48,duration:30,id:'da-feng-che',url:'/assets/audio/da-feng-che-96bpm.wav'};

// Repeat the child's played pattern, aligned to eighth notes at the song tempo.
export function songBeats(track){
 const bpm=track.sourceBpm,beats=track.patternBeats??track.expectedCount;
 if(!Number.isFinite(bpm)||bpm<=0||!Number.isInteger(beats)||beats<=0)throw Error('Missing rhythm tempo');
 const pattern=[...new Set((track.times||[]).filter(t=>Number.isFinite(t)&&t>=0).map(t=>Math.round(t/1000*bpm/60*2)/2).filter(b=>b<beats))];
 const events=[];
 for(let bar=0;bar<SONG.duration*SONG.bpm/60;bar+=beats)for(const beat of pattern){const at=(bar+beat)*60/SONG.bpm;if(at<SONG.duration)events.push({at,beat:bar+beat});}
 return events.sort((a,b)=>a.at-b.at);
}

export function mixSong(channels,rate,track){
 const length=Math.round(SONG.duration*rate),output=channels.map(input=>{const out=new Float32Array(length);for(let i=0;i<Math.min(length,input.length);i++)out[i]=input[i]*.8;return out;});
 const drums=new Float32Array(length);
 for(const {at,beat} of songBeats(track)){
  const offset=Math.round(at*rate),snare=Math.round(beat)%4===1||Math.round(beat)%4===3;let seed=12345+offset;
  for(let j=0;j<rate*.24&&offset+j<length;j++){
   const t=j/rate;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/2147483648-1;
   const kick=Math.sin(2*Math.PI*(55*t+2.6*(1-Math.exp(-t*35))))*Math.exp(-t*24);
   drums[offset+j]+=(snare?noise*Math.exp(-t*32)*.28+kick*.12:kick*.42)+noise*Math.exp(-t*95)*.045;
  }
 }
 let peak=0;
 for(const channel of output)for(let i=0;i<length;i++){channel[i]+=drums[i];peak=Math.max(peak,Math.abs(channel[i]));}
 const gain=peak>.95?.95/peak:1;
 for(const channel of output)for(let i=0;i<length;i++)channel[i]*=gain;
 return output;
}

export function encodeWav(channels,rate){
 const length=channels[0].length,count=channels.length,bytes=length*count*2,data=new ArrayBuffer(44+bytes),d=new DataView(data);
 const str=(at,s)=>[...s].forEach((c,i)=>d.setUint8(at+i,c.charCodeAt(0)));
 str(0,'RIFF');d.setUint32(4,36+bytes,true);str(8,'WAVE');str(12,'fmt ');d.setUint32(16,16,true);d.setUint16(20,1,true);d.setUint16(22,count,true);d.setUint32(24,rate,true);d.setUint32(28,rate*count*2,true);d.setUint16(32,count*2,true);d.setUint16(34,16,true);str(36,'data');d.setUint32(40,bytes,true);
 for(let i=0;i<length;i++)for(let c=0;c<count;c++)d.setInt16(44+(i*count+c)*2,Math.round(Math.max(-1,Math.min(1,channels[c][i]))*32767),true);
 return data;
}

let backingPromise;
const renders=new Map();
async function backing(){
 if(!backingPromise)backingPromise=(async()=>{
  const response=await fetch(SONG.url);if(!response.ok)throw Error('伴奏加载失败');
  const context=new OfflineAudioContext(2,1,44100);
  const buffer=await context.decodeAudioData(await response.arrayBuffer());
  if(Math.abs(buffer.duration-SONG.duration)>.1)throw Error('伴奏长度不正确');
  return buffer;
 })().catch(error=>{backingPromise=null;throw error;});
 return backingPromise;
}
export async function renderSong(track){
 const key=JSON.stringify([track.id,track.sourceBpm,track.patternBeats,track.expectedCount,track.times,track.recordingId,track.sourceDurationSec,track.durationSec,track.mixVersion,track.recordingRepeats]);
 if(!renders.has(key))renders.set(key,(async()=>{
  const buffer=await backing();
  const tempo=track.mixVersion!==2&&track.mioPlan?(track.sourceBpm||SONG.bpm)/SONG.bpm:1;
  const channels=Array.from({length:buffer.numberOfChannels},(_,c)=>{const source=buffer.getChannelData(c),length=Math.round((track.durationSec??SONG.duration)*buffer.sampleRate);return Float32Array.from({length},(_,i)=>{const at=i*tempo,k=Math.floor(at),f=at-k;return (source[k]||0)*(1-f)+(source[k+1]||0)*f;});});
  const stored=track.recordingId?await recording(track.recordingId):null;
  let recorded=null;if(stored?.blob){const ctx=new OfflineAudioContext(1,1,buffer.sampleRate);recorded=await ctx.decodeAudioData(await stored.blob.arrayBuffer());}
  // Saved duration is authoritative: older collected works explicitly lasted 30s.
  if(track.mixVersion===2&&(track.sourceBpm!==RHYTHM.bpm||track.sourceDurationSec!==RHYTHM.duration||track.durationSec!==SONG.duration||track.recordingRepeats!==3))throw Error('作品节奏信息不完整，请重新录制。');
  const output=mixRecorded(channels,buffer.sampleRate,recorded?recorded.getChannelData(0):null,recorded?.sampleRate,stored?.offset||0,track.durationSec??track.sourceDurationSec??SONG.duration,track.mixVersion===2?track.sourceDurationSec:0);
  return new Blob([encodeWav(output,buffer.sampleRate)],{type:'audio/wav'});
 })().catch(error=>{renders.delete(key);throw error;}));
 return renders.get(key);
}

export function mixRecorded(channels,rate,pcm,pcmRate,offset=0,duration=SONG.duration,loopDuration=0){
 if(!Number.isFinite(duration)||duration<=0||duration>120)throw Error('Invalid recording duration');
 if(!Number.isFinite(loopDuration)||loopDuration<0||loopDuration>duration)throw Error('Invalid loop duration');
 if(!Number.isFinite(offset)||offset<0||!Number.isFinite(rate)||rate<=0||(pcm&&(!Number.isFinite(pcmRate)||pcmRate<=0)))throw Error('Invalid recording timing');
 const loopLength=Math.round(loopDuration*rate);if(loopDuration>0&&!loopLength)throw Error('Invalid loop duration');
 const length=Math.round(duration*rate),out=channels.map(c=>Float32Array.from({length},(_,i)=>(c[i]||0)*.7));
 if(pcm)for(let i=0;i<Math.min(length,Math.round(duration*rate));i++){const at=Math.floor((offset+(loopLength?i%loopLength:i)/rate)*pcmRate);if(at<pcm.length)for(const c of out)c[i]+=(pcm[at]||0)*.85;}
 let peak=0;for(const c of out)for(const n of c)peak=Math.max(peak,Math.abs(n));if(peak>.95)for(const c of out)for(let i=0;i<c.length;i++)c[i]*=.95/peak;
 return out;
}
