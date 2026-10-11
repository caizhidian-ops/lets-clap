import {petArt} from './art.js';

// Three 2/4 bars of the existing two-beat cell, followed by a short reveal.
export const HATCH_REVEAL_MS=1200;
export function hatchTimeline(cell){
  const cycleSec=1.5,durationSec=4.5;
  const onsets=Array.from({length:3},(_,cycle)=>cell.events.filter(e=>!e.rest).map(e=>cycle*cycleSec+e.atBeat*cycleSec/2)).flat();
  return {cycleSec,durationSec,onsets,bars:3,beatsPerBar:2};
}
export function hatchFrame(t,timeline){
  const count=timeline.onsets.filter(at=>at<=t).length;
  const last=count?timeline.onsets[count-1]:-Infinity;
  return {count,bar:Math.min(timeline.bars,Math.max(1,Math.floor(t/timeline.cycleSec)+1)),progress:Math.max(0,Math.min(1,t/timeline.durationSec)),pulse:Math.max(0,1-(t-last)/(timeline.cycleSec/5)),crack:count?Math.min(4,Math.round((count-1)*3/Math.max(1,timeline.onsets.length-1))+1):0,slot:t>=0?Math.floor((t%timeline.cycleSec)/(timeline.cycleSec/4))+1:0};
}
export function eggArt(personality){
  const shell='M100 18 C53 18 21 93 21 151 C21 206 55 235 100 235 C145 235 179 206 179 151 C179 93 147 18 100 18Z';
  return `<div class="hatch-art" data-crack="0" role="img" aria-label="等待唤醒的蛋"><div class="hatch-halo"></div><div class="hatch-sparks" aria-hidden="true"><i>✦</i><i>✧</i><i>✦</i><i>✧</i></div><div class="hatch-pet">${petArt(personality)}</div><svg class="egg-svg" viewBox="0 0 200 260" aria-hidden="true"><defs><radialGradient id="eggshell" cx="32%" cy="26%" r="80%"><stop stop-color="#fffef5"/><stop offset=".65" stop-color="#f8e8c5"/><stop offset="1" stop-color="#ddbc86"/></radialGradient><clipPath id="shell-top"><path d="M0 0H200V134L168 144 143 132 122 147 101 132 77 146 56 133 32 145 0 134Z"/></clipPath><clipPath id="shell-bottom"><path d="M0 134L32 145 56 133 77 146 101 132 122 147 143 132 168 144 200 134V260H0Z"/></clipPath></defs><ellipse class="egg-shadow" cx="100" cy="247" rx="67" ry="9" fill="#526f4826"/><g class="shell-top" clip-path="url(#shell-top)"><path d="${shell}" fill="url(#eggshell)"/><ellipse cx="69" cy="75" rx="11" ry="27" fill="#ffffff66" transform="rotate(25 69 75)"/><path d="M100 80L105 94 119 99 105 104 100 119 95 104 81 99 95 94Z" fill="#d8a557"/></g><g class="shell-bottom" clip-path="url(#shell-bottom)"><path d="${shell}" fill="url(#eggshell)"/><ellipse cx="71" cy="180" rx="6" ry="8" fill="#d8bc8d55"/><ellipse cx="133" cy="201" rx="4" ry="5" fill="#d8bc8d55"/></g><g class="egg-cracks" fill="none" stroke="#a17d50" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path class="crack c1" pathLength="1" d="M102 82L92 107 106 120 101 132 77 146"/><path class="crack c2" pathLength="1" d="M77 146L56 133 32 145M101 132L122 147 143 132 168 144"/><path class="crack c3" pathLength="1" d="M122 147L113 166 129 183 120 202M56 133L65 111 57 95"/><path class="crack c4" pathLength="1" d="M143 132L138 111 150 91M77 146L81 167 67 185M129 183L146 189"/></g></svg></div>`;
}
