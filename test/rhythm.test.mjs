import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RHYTHM} from '../public/game/rhythm.js';
import {SONG,songBeats} from '../public/game/song-mixer.js';
import {gameForMood,moodStyles} from '../public/flow-model.js';
import {createJumpRopeRun} from '../public/game/jump-rope-engine.js';
import {createEscapeRun} from '../public/game/escape-engine.js';
import {jumpHeight,ropeAngleAt,ropePoint} from '../public/game/jump-rope-motion.js';
test('all game defaults match the 96 BPM, twelve-bar backing through the last beat',()=>{
 assert.equal(RHYTHM.bars*RHYTHM.beatsPerBar,48);
 assert.equal(RHYTHM.beats*60/RHYTHM.bpm,30);
 assert.equal(SONG.bpm,RHYTHM.bpm);assert.equal(SONG.duration,RHYTHM.duration);
 for(const mood of ['开心','平静'])assert.equal(gameForMood(mood).bpm,96);
 for(const style of Object.values(moodStyles))assert.equal(style.bpm,96);
 for(const create of [createJumpRopeRun,createEscapeRun]){
  const run=create();assert.equal(run.period??60/RHYTHM.bpm,.625);
  assert.equal(run.duration,30);assert.equal(run.expected.length,48);assert.equal(run.expected.at(-1),29.375);
  assert.throws(()=>run.finish(29.99),/not ended/);
  run.expected.forEach(at=>assert.equal(run.ingest(at).accepted,true));
  const result=run.finish(30);assert.equal(result.matchedCount,48);assert.equal(result.missedCount,0);assert.equal(result.durationSec,30);
  const mixed=songBeats({...result,sourceBpm:96});assert.equal(mixed.length,48);assert.equal(mixed.at(-1).at,29.375);
 }
 const rope=createJumpRopeRun(),contact=rope.expected.at(-1)+rope.crossingDelay;
 assert.ok(contact<30);
 assert.ok(.05+jumpHeight(rope.crossingDelay,96)>ropePoint(Math.PI/2,ropeAngleAt(contact,96))[1]+.07);
});
