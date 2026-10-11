import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ClapDetector} from '../public/game/clap-detector.js';
import {createJumpRopeRun} from '../public/game/jump-rope-engine.js';
function detect(samples,rate,options){const detector=new ClapDetector(rate,options),events=[];for(let i=0;i<samples.length;i+=128)events.push(...detector.process(samples.subarray(i,i+128),i));return events;}
function fixture(rate,onsets){const s=new Float32Array(rate*4);let seed=13;for(const at of onsets)for(let i=0;i<rate*.035;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;s[Math.round(at*rate)+i]=(seed/2147483648-1)*.5*Math.exp(-i/rate*110);}return s;}
for(const rate of [44100,48000])test(`synthetic transients: one event per burst, onset error under 5 ms at ${rate} Hz`,()=>{const onsets=[1,1.65,2.3,3],events=detect(fixture(rate,onsets),rate);assert.equal(events.length,onsets.length);events.forEach((e,i)=>assert.ok(Math.abs(e.at-onsets[i])<=.005));});
test('calibration and refractory period reject start noise and repeated bursts',()=>{assert.equal(detect(fixture(48000,[.2,1,1.08,2]),48000).length,2);});
test('silence, sustained background noise and low-frequency beat cues are not claps',()=>{
 const rate=48000,s=new Float32Array(rate*4);assert.equal(detect(s,rate).length,0);
 for(let i=0;i<s.length;i++)s[i]=.1*Math.sin(2*Math.PI*180*i/rate);assert.equal(detect(s,rate).length,0);
 let seed=123;for(let i=0;i<s.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;s[i]=(seed/2147483648-1)*.01;}assert.equal(detect(s,rate).length,0);
});
test('actual supplied no-drum backing produces no false events',async()=>{
 const b=await readFile(new URL('../public/assets/audio/da-feng-che-96bpm.wav',import.meta.url)),samples=new Float32Array((b.length-44)/4);
 for(let i=0;i<samples.length;i++)samples[i]=(b.readInt16LE(44+i*4)+b.readInt16LE(46+i*4))/65536;
 assert.equal(detect(samples,44100,{calibrationSec:0}).length,0);
});
test('microphone onset timestamps and keyboard inputs share the jump scoring timeline',()=>{
 const rate=48000,startAt=1,onsets=[1,1.625,2.25,2.875],events=detect(fixture(rate,onsets),rate);
 const run=createJumpRopeRun({bpm:96,beats:4,runId:'audio-fixture'});
 assert.equal(events.length,4);
 // Use keyboard for beat 2 and captured audio timestamps for the other beats.
 events.forEach((event,i)=>assert.equal(run.ingest(i===1?.625:event.at-startAt).accepted,true));
 const result=run.finish(run.duration);assert.equal(result.matchedCount,4);assert.equal(result.outcome,'completed');
 assert.deepEqual(result.times,[0,625,1250,1875]);
});
