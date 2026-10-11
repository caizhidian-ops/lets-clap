import {hatchTimeline} from '../scenes/pet/hatch.js';
export function wavBlob(samples,rate) {
  const b=new ArrayBuffer(44+samples.length*2),v=new DataView(b);
  const str=(at,s)=>{for(let i=0;i<s.length;i++)v.setUint8(at+i,s.charCodeAt(i));};
  str(0,'RIFF');v.setUint32(4,36+samples.length*2,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,samples.length*2,true);
  for(let i=0;i<samples.length;i++)v.setInt16(44+i*2,Math.max(-1,Math.min(1,samples[i]))*(samples[i]<0?32768:32767),true);
  return new Blob([b],{type:'audio/wav'});
}
export class AudioEngine {
  constructor(){this.nodes=[];this.generation=0;this.capture=null;this.voice=null;}
  async ready(){
    this.ctx??=new AudioContext();
    if(this.ctx.state!=='running')await this.ctx.resume();
    this.workletReady??=this.ctx.audioWorklet.addModule('/capture-worklet.js');
    await this.workletReady;return this.ctx;
  }
  stopPlayback(){
    this.speechResolve?.();this.speechResolve=null;
    this.generation++;cancelAnimationFrame(this.raf);
    for(const n of this.nodes){try{n.stop();}catch{}}
    this.nodes=[];
  }
  tone(when,freq=650,duration=.09,volume=.08){
    const c=this.ctx,o=c.createOscillator(),g=c.createGain();
    o.type='triangle';o.frequency.value=freq;g.gain.setValueAtTime(0,when);g.gain.linearRampToValueAtTime(volume,when+.006);g.gain.exponentialRampToValueAtTime(.0001,when+duration);
    o.connect(g).connect(c.destination);o.start(when);o.stop(when+duration+.01);this.nodes.push(o);
  }
  clap(when){
    const c=this.ctx,b=c.createBuffer(1,Math.ceil(c.sampleRate*.08),c.sampleRate),d=b.getChannelData(0);
    for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.exp(-i/(c.sampleRate*.014));
    const s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=b;f.type='highpass';f.frequency.value=950;g.gain.value=.18;
    s.connect(f).connect(g).connect(c.destination);s.start(when);this.nodes.push(s);
  }
  animate(start,duration,onFrame,onDone=()=>{}){
    const token=this.generation;
    const tick=()=>{if(token!==this.generation)return;const elapsed=this.ctx.currentTime-start;onFrame(elapsed);if(elapsed>=duration){onDone();return;}this.raf=requestAnimationFrame(tick);};tick();
  }
  async preview(plan,onFrame,onDone){
    await this.ready();this.stopPlayback();const start=this.ctx.currentTime+.12,factor=plan.previewTempoFactor||1,duration=plan.durationSec/factor;
    plan.expectedOnsetsSec.forEach(t=>this.clap(start+t/factor));
    this.animate(start,duration,onFrame,onDone);
  }
  async guide(cell,onFrame,onDone){
    await this.ready();this.stopPlayback();const start=this.ctx.currentTime+.1;
    const timeline=hatchTimeline(cell);
    timeline.onsets.forEach(t=>this.clap(start+t));
    this.animate(start,timeline.durationSec,t=>onFrame(t,timeline),onDone);
  }
  async acquire(){
    if(!navigator.mediaDevices?.getUserMedia||!window.AudioWorkletNode||!window.MediaRecorder)throw Error('当前浏览器不支持真实录音，请使用 localhost 或 HTTPS。');
    await this.ready();
    return navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
  }
  async record(plan,stream,onFrame,onPhase){
    this.stopPlayback();const c=this.ctx,start=c.currentTime+.15+4*60/plan.bpm,end=start+plan.durationSec;
    const source=c.createMediaStreamSource(stream),node=new AudioWorkletNode(c,'capture'),mute=c.createGain();mute.gain.value=0;source.connect(node).connect(mute).connect(c.destination);
    const chunks=[],encoded=[];const recorder=new MediaRecorder(stream);recorder.ondataavailable=e=>{if(e.data.size)encoded.push(e.data);};recorder.start();
    let resolve,reject;const result=new Promise((a,b)=>{resolve=a;reject=b;});
    const cleanup=()=>{source.disconnect();node.disconnect();mute.disconnect();stream.getTracks().forEach(t=>t.stop());this.capture=null;};
    const cancel=()=>{if(!this.capture)return;this.stopPlayback();recorder.onstop=()=>{};if(recorder.state!=='inactive')recorder.stop();cleanup();reject(Error('录音已中止，保留的版本未改变。'));};
    this.capture={cancel};stream.getAudioTracks().forEach(t=>t.onended=cancel);
    node.port.onmessage=({data})=>{
      if(data.type==='chunk'){chunks.push(data);this.level=data.level;}
      if(data.type==='complete'){
        recorder.onstop=()=>{
          const pcm=new Float32Array(Math.round(plan.durationSec*c.sampleRate));
          for(const x of chunks){const offset=Math.round(x.time*c.sampleRate);if(offset>=0&&offset<pcm.length)pcm.set(x.samples.subarray(0,pcm.length-offset),offset);}
          const flags=[...data.qualityFlags];
          const frames=chunks.reduce((n,x)=>n+x.samples.length,0);
          if(Math.abs(frames-pcm.length)>256)flags.push('capture_gap');
          cleanup();resolve({blob:wavBlob(pcm,c.sampleRate),rawBlob:new Blob(encoded,{type:recorder.mimeType}),onsets:data.onsets,qualityFlags:flags,sampleRate:c.sampleRate,durationSec:plan.durationSec});
        };
        if(recorder.state!=='inactive')recorder.stop();else cancel();
      }
    };
    node.port.postMessage({type:'arm',start,end});
    for(let i=0;i<4;i++)this.tone(start-(4-i)*60/plan.bpm,i===0?880:660);
    let entered=false;
    this.animate(start,plan.durationSec,elapsed=>{
      if(elapsed>=0&&!entered){entered=true;onPhase();}
      onFrame(elapsed,this.level||0);
    });
    return result;
  }
  cancel(){this.capture?.cancel();this.stopPlayback();}
  async buffer(blob){await this.ready();return this.ctx.decodeAudioData(await blob.arrayBuffer());}
  playBuffer(buffer,when,gain=1){
    const s=this.ctx.createBufferSource(),g=this.ctx.createGain();s.buffer=buffer;g.gain.value=gain;s.connect(g).connect(this.ctx.destination);s.start(when);this.nodes.push(s);return g;
  }
  async playRecording(record,onDone=()=>{}){
    const b=await this.buffer(record.blob);this.stopPlayback();const at=this.ctx.currentTime+.1;this.playBuffer(b,at,.8);this.animate(at,b.duration,()=>{},onDone);
  }
  async mix(record,score,config,clapVolume,onDone){
    const b=await this.buffer(record.blob);let backing=null;
    if(config.backingAsset){const res=await fetch(config.backingAsset);if(!res.ok)throw Error('伴奏文件缺失，无法混音试听。');backing=await this.ctx.decodeAudioData(await res.arrayBuffer());if(Math.abs(backing.duration-record.plan.durationSec)>.15)throw Error('伴奏长度与两小节不一致，请审核素材。');}
    this.stopPlayback();const at=this.ctx.currentTime+.15;
    this.mixGain=this.playBuffer(b,at,clapVolume);
    if(backing)this.backingGain=this.playBuffer(backing,at,.35);
    else{
      this.backingGain=this.ctx.createGain();this.backingGain.gain.value=.65;this.backingGain.connect(this.ctx.destination);
      for(const note of score.measures.slice(0,2).flatMap(m=>m.notes).filter(n=>!n.rest)){
        const when=at+note.startBeat*60/record.plan.bpm,d=Math.min(note.duration*60/record.plan.bpm,record.plan.durationSec-(when-at));
        const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type='triangle';o.frequency.value=note.frequency;g.gain.setValueAtTime(0,when);g.gain.linearRampToValueAtTime(.13,when+.012);g.gain.exponentialRampToValueAtTime(.0001,when+Math.max(.02,d-.02));o.connect(g).connect(this.backingGain);o.start(when);o.stop(when+d);this.nodes.push(o);
      }
    }
    this.animate(at,record.plan.durationSec,()=>{},onDone);
  }
  async playSpeech(base64){
    await this.ready();this.stopPlayback();const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0)),v=new DataView(bytes.buffer),b=this.ctx.createBuffer(1,bytes.length/2,24000);
    for(let i=0;i<b.length;i++)b.getChannelData(0)[i]=v.getInt16(i*2,true)/32768;
    const at=this.ctx.currentTime+.05;this.playBuffer(b,at,.7);
    return new Promise(resolve=>{this.speechResolve=resolve;this.animate(at,b.duration,()=>{},()=>{this.speechResolve=null;resolve();});});
  }
  async startVoice(onPcm){
    const stream=await this.acquire(),c=this.ctx,source=c.createMediaStreamSource(stream),node=new AudioWorkletNode(c,'capture'),mute=c.createGain();mute.gain.value=0;
    source.connect(node).connect(mute).connect(c.destination);
    let pending=[],position=0;
    node.port.onmessage=({data})=>{
      if(data.type!=='voice')return;
      pending.push(...data.samples);const ratio=data.sampleRate/16000,out=[];
      while(position+ratio<pending.length){const i=Math.floor(position);out.push(pending[i]);position+=ratio;}
      const used=Math.floor(position);pending=pending.slice(used);position-=used;
      if(!out.length)return;
      const bytes=new Uint8Array(out.length*2),v=new DataView(bytes.buffer);
      out.forEach((x,i)=>v.setInt16(i*2,Math.max(-1,Math.min(1,x))*(x<0?32768:32767),true));
      onPcm(btoa(String.fromCharCode(...bytes)),data.samples,data.sampleRate);
    };
    node.port.postMessage({type:'voice'});
    this.voice={stream,source,node,mute};
  }
  stopVoice(){const v=this.voice;if(!v)return;v.node.port.onmessage=null;v.source.disconnect();v.node.disconnect();v.mute.disconnect();v.stream.getTracks().forEach(t=>t.stop());this.voice=null;}
}
