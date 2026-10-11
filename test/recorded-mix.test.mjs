import test from 'node:test';import assert from 'node:assert/strict';import {mixRecorded,encodeWav} from '../public/game/song-mixer.js';
test('recording mixes with backing, trims preparation and never synthesizes drums',()=>{const backing=[Float32Array.from([.1,.2,.3,.4])];const output=mixRecorded(backing,4,Float32Array.from([.9,.9,.2,-.2]),4,.5,1)[0];assert.equal(output.length,4);assert.ok(Math.abs(output[0]-(.07+.17))<1e-6);assert.ok(Math.abs(output[1]-(.14-.17))<1e-6);assert.ok(Math.abs(output[2]-.21)<1e-6);const silent=mixRecorded(backing,4,null,null)[0];assert.equal(silent.length,120);assert.equal(silent[8],0);assert.ok(Math.abs(silent[0]-.07)<1e-6);});
test('WAV length follows the full game duration without extending to 30 seconds',()=>{const rate=1000,duration=8*60/72;const out=mixRecorded([new Float32Array(30000).fill(.1)],rate,new Float32Array(12000).fill(.2),rate,1,duration);assert.equal(out[0].length,Math.round(duration*rate));assert.equal(new DataView(encodeWav(out,rate)).getUint32(40,true),out[0].length*2);assert.ok(Math.abs(out[0].at(-1)-.24)<1e-6);});
test('historical duration fallback remains 30 seconds and invalid duration is rejected',()=>{assert.equal(mixRecorded([new Float32Array(4)],4,null,null)[0].length,120);for(const value of [0,-1,NaN,Infinity,121])assert.throws(()=>mixRecorded([new Float32Array(4)],4,null,null,0,value));});

test('exact trimmed ten-second capture repeats three times over the full stereo backing',()=>{
 const rate=1000,offset=2.7,pcm=new Float32Array(14000).fill(.9),pattern=Float32Array.from({length:10000},(_,i)=>i%625===0?.3:0);pcm.set(pattern,2700);
 const backing=[Float32Array.from({length:30000},(_,i)=>i/300000),new Float32Array(30000).fill(-.1)];
 const out=mixRecorded(backing,rate,pcm,rate,offset,30,10);
 assert.equal(out.length,2);assert.equal(out[0].length,30000);
 for(let i=0;i<30000;i++){assert.ok(Math.abs(out[0][i]-(backing[0][i]*.7+pattern[i%10000]*.85))<1e-6,`sample ${i}`);assert.ok(Math.abs(out[1][i]-(-.07+pattern[i%10000]*.85))<1e-6);}
 const wav=new DataView(encodeWav(out,rate));assert.equal(wav.getUint32(40,true),120000);
});
test('loop uses declared musical length with silence for a truncated capture, and supports other capture sample rates',()=>{
 const out=mixRecorded([new Float32Array(300)],10,new Float32Array(55).fill(.2),5,2,30,10)[0];
 for(let i=0;i<100;i++){assert.equal(out[i],out[i+100]);assert.equal(out[i],out[i+200]);}
 assert.ok(Math.abs(out[0]-.17)<1e-6);assert.equal(out[99],0);
 for(const loop of [-1,NaN,31])assert.throws(()=>mixRecorded([new Float32Array(300)],10,null,null,0,30,loop));
});
