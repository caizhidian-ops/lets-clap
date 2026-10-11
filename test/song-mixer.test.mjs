import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {songBeats,mixSong,encodeWav} from '../public/game/song-mixer.js';
const track={sourceBpm:60,expectedCount:8,times:[0,1010,2010,Infinity,-2]};
test('played rhythm follows 96 BPM and repeats to the end of the song',()=>{
 const beats=songBeats(track);assert.deepEqual(beats.slice(0,3).map(e=>e.at),[0,.625,1.25]);
 assert.equal(beats.at(-1).at,26.25);assert.equal(beats.length,18);
 assert.deepEqual(songBeats({...track,times:[]}),[]);
});
test('mix preserves stereo backing, adds drums, avoids clipping and encodes 30 seconds',()=>{
 const rate=1000,backing=[new Float32Array(30000).fill(.5),new Float32Array(30000).fill(-.2)];
 const plain=mixSong(backing,rate,{...track,times:[]}),mixed=mixSong(backing,rate,track);
 assert.equal(mixed.length,2);assert.equal(mixed[0].length,30000);
 assert.ok(mixed[0].some((n,i)=>n!==plain[0][i]));assert.ok(mixed[0].every(n=>Math.abs(n)<=.951));
 assert.equal(backing[0][100],.5);assert.notEqual(mixed[0][500],mixed[1][500]);
 const wav=new DataView(encodeWav(mixed,rate));assert.equal(wav.getUint16(22,true),2);assert.equal(wav.getUint32(24,true),rate);assert.equal(wav.getUint32(40,true),120000);
});
test('provided source WAV is stereo 44.1 kHz and exactly 30 seconds',async()=>{
 const wav=await readFile(new URL('../public/assets/audio/da-feng-che-96bpm.wav',import.meta.url));
 assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.readUInt16LE(22),2);assert.equal(wav.readUInt32LE(24),44100);assert.equal(wav.readUInt32LE(40)/176400,30);
});
