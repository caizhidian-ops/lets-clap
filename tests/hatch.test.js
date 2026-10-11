import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {hatchTimeline,hatchFrame} from '../src/scenes/pet/hatch.js';
const kb=JSON.parse(readFileSync(new URL('../data/notation-patterns.v1.json',import.meta.url)));
for(const id of ['PAT-01','PAT-02','PAT-04'])test(`hatch ${id}: sound and visuals share the legal cell timeline`,()=>{
  const cell=kb.items.find(c=>c.legacyPatternId===id),timeline=hatchTimeline(cell);
  assert.equal(timeline.durationSec,4.5);
  assert.equal(timeline.onsets.length,cell.events.filter(e=>!e.rest).length*3);
  assert.equal(timeline.bars,3);assert.equal(timeline.beatsPerBar,2);
  for(let bar=0;bar<3;bar++){assert.equal(hatchFrame(bar*timeline.cycleSec+.01,timeline).bar,bar+1);}
  assert.equal(hatchFrame(-.1,timeline).pulse,0);
  for(const t of timeline.onsets)assert.equal(hatchFrame(t,timeline).pulse,1);
  let previous=0;
  for(let t=0;t<timeline.durationSec;t+=.01){const f=hatchFrame(t,timeline);assert.ok(f.crack>=previous);previous=f.crack;}
  assert.equal(hatchFrame(timeline.durationSec,timeline).crack,4);
  assert.equal(hatchFrame(timeline.durationSec,timeline).progress,1);
  assert.equal(hatchFrame(timeline.durationSec,timeline).pulse,0);
});
