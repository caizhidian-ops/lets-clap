import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createClapInput} from '../public/game/clap-input.js';
test('native input is silent, uses audio timestamps and releases microphone exactly once',async()=>{
 const originalNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator'),originalNode=globalThis.AudioWorkletNode;
 let stops=0,calls=0,lastNode,requested;
 const track={stop(){stops++;},getSettings:()=>({sampleRate:48000,echoCancellation:true})};
 const stream={getTracks:()=>[track],getAudioTracks:()=>[track]};
 const source={connect(node){return node;},disconnect(){}};
 globalThis.AudioWorkletNode=class{constructor(){this.port={onmessage:null};lastNode=this;}connect(node){return node;}disconnect(){}};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{async getUserMedia(options){requested=options;return stream;}}}});
 const sink={gain:{value:1},connect(){},disconnect(){}};
 const context={state:'running',currentTime:1.02,async resume(){},audioWorklet:{async addModule(){}},createMediaStreamSource:()=>source,createGain:()=>sink,destination:{}};
 try{
  const input=await createClapInput(context,{onClap:event=>{calls++;assert.equal(event.at,1);assert.ok(Math.abs(event.deliveryMs-20)<.001);}});
  assert.equal(sink.gain.value,0);assert.equal(requested.video,false);assert.equal(requested.audio.autoGainControl,false);
  lastNode.port.onmessage({data:{type:'clap',at:1}});assert.equal(calls,1);
  input.stop();input.stop();assert.equal(stops,1);assert.equal(lastNode.port.onmessage,null);
  context.audioWorklet.addModule=async()=>{throw Error('Worklet failed');};
  await assert.rejects(createClapInput(context),/Worklet failed/);assert.equal(stops,2);
 }finally{Object.defineProperty(globalThis,'navigator',originalNavigator);if(originalNode)globalThis.AudioWorkletNode=originalNode;else delete globalThis.AudioWorkletNode;}
});
test('permission denial gives a retry message without a model fallback',async()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'navigator');Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:async()=>{const e=new Error();e.name='NotAllowedError';throw e;}}}});
 try{await assert.rejects(createClapInput({audioWorklet:{}}),/麦克风权限未打开/);}finally{Object.defineProperty(globalThis,'navigator',original);}
});
