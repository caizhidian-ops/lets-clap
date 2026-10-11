import {RHYTHM} from './rhythm.js';
import {createAmbience} from './night-music.js';
import {createEscapeRun} from './escape-engine.js';
import {createRescueWorld} from './escape-world.js';

// Shared plush artwork keeps the collectible and rescue companion identical.
export function fluffyPet(i=0){
 const palettes=[['#efb568','#ffe6b8','#b87938'],['#99bed9','#e2eff8','#648da9'],['#a8c58b','#e5efcc','#739253']];
 const [base,light,dark]=palettes[i];
 const ears=[`<circle cx="53" cy="55" r="23" fill="${base}"/><circle cx="147" cy="55" r="23" fill="${base}"/><circle cx="53" cy="55" r="12" fill="${light}"/><circle cx="147" cy="55" r="12" fill="${light}"/>`,`<ellipse cx="62" cy="45" rx="18" ry="32" transform="rotate(-18 62 45)" fill="${base}"/><ellipse cx="138" cy="45" rx="18" ry="32" transform="rotate(18 138 45)" fill="${base}"/><ellipse cx="62" cy="45" rx="8" ry="20" fill="${light}"/><ellipse cx="138" cy="45" rx="8" ry="20" fill="${light}"/>`,`<path d="M38 78Q22 12 72 53M128 53Q178 12 162 78" fill="${base}"/><path d="M43 60L43 39L60 54M140 54L157 39L157 60" fill="${light}"/>`][i];
 const tufts=Array.from({length:44},(_,n)=>{const a=n*Math.PI*2/44;const x=100+68*Math.cos(a),y=111+64*Math.sin(a);return `<path d="M${x.toFixed(1)} ${y.toFixed(1)}l${(8*Math.cos(a-.35)).toFixed(1)} ${(8*Math.sin(a-.35)).toFixed(1)}l${(-4*Math.cos(a+.55)).toFixed(1)} ${(-4*Math.sin(a+.55)).toFixed(1)}"/>`;}).join('');
 const fur=Array.from({length:40},(_,n)=>{const x=48+(n*37%104),y=65+(n*23%83);return `<path d="M${x} ${y}q-2 4-5 5"/>`;}).join('');
 return `<svg class="monster" viewBox="0 0 200 210" role="img" aria-label="${['咚咚','悠悠','蹦蹦'][i]}毛茸茸小伙伴"><ellipse cx="100" cy="190" rx="62" ry="9" fill="#385b43" opacity=".12"/><g class="pet-body">${ears}<ellipse cx="51" cy="136" rx="21" ry="27" fill="${base}" transform="rotate(24 51 136)"/><ellipse cx="149" cy="136" rx="21" ry="27" fill="${base}" transform="rotate(-24 149 136)"/><ellipse cx="74" cy="175" rx="24" ry="16" fill="${dark}"/><ellipse cx="126" cy="175" rx="24" ry="16" fill="${dark}"/><ellipse cx="100" cy="113" rx="69" ry="66" fill="${base}"/><g fill="${base}" stroke="${base}" stroke-width="3" stroke-linejoin="round">${tufts}</g><ellipse cx="100" cy="139" rx="42" ry="30" fill="${light}"/><g fill="none" stroke="${light}" stroke-width="1.8" stroke-linecap="round" opacity=".65">${fur}</g><path d="M86 51l-8-10q16 0 20 9l7-12q8 7 7 17" fill="${base}"/><ellipse cx="74" cy="99" rx="12" ry="15" fill="#fffdf6"/><ellipse cx="126" cy="99" rx="12" ry="15" fill="#fffdf6"/><ellipse cx="77" cy="102" rx="6" ry="8" fill="#293e38"/><ellipse cx="123" cy="102" rx="6" ry="8" fill="#293e38"/><circle cx="79" cy="99" r="2.5" fill="white"/><circle cx="125" cy="99" r="2.5" fill="white"/><ellipse cx="57" cy="118" rx="12" ry="7" fill="#e99889" opacity=".65"/><ellipse cx="143" cy="118" rx="12" ry="7" fill="#e99889" opacity=".65"/><path d="M95 116q5-4 10 0q-5 7-10 0" fill="${dark}"/><path d="M88 126q12 13 24 0" fill="none" stroke="#293e38" stroke-width="3" stroke-linecap="round"/><path d="M68 175l-1 5m9-5v5m48-5v5m9-5 1 5" stroke="${light}" stroke-width="2.5" stroke-linecap="round"/></g></svg>`;
}

export function mountEscapeScene(root,{mood='开心',onComplete,onCancel,bpm=RHYTHM.bpm,onsets,planId}={}){
 const run=createEscapeRun({bpm,onsets,planId,movement:'brake',runId:crypto.randomUUID()});
 root.innerHTML=`<section class="escape"><div class="escape-heading"><div><h1>跟上节拍，让风车停下来！</h1><p>夜风越来越大。沿着长路前进，拍准节奏给风车刹车。</p></div><span class="escape-mood">${['开心','平静','兴奋'].includes(mood)?mood:'开心'}的勇气</span></div>
 <div class="escape-landscape" role="img" aria-label="左侧风车卷起旋风，小怪物沿草地跑向右侧刹车终点">
 <div class="rescue-world" id="rescue-world"></div><div class="storm-hud"><span id="storm-level">微风准备中</span><strong id="escape-time">48 拍救援</strong></div><div class="tap-pop" id="tap-pop" aria-hidden="true"></div>
 <svg viewBox="0 0 1000 440" class="landscape-art" preserveAspectRatio="none" aria-hidden="true"><rect width="1000" height="440" fill="#e3f1ed"/><circle cx="814" cy="82" r="42" fill="#f8d586"/><g fill="#fff9ed"><path d="M340 79q0-25 27-22q20-30 48-4q30-6 37 25Z"/><path d="M650 129q0-25 27-22q20-30 48-4q30-6 37 25Z"/></g><path d="M0 277Q160 167 367 277Q600 189 1000 249V440H0Z" fill="#b6d3b1"/><path d="M0 334Q300 253 600 321Q800 265 1000 309V440H0Z" fill="#8eae80"/><path d="M142 404Q450 300 888 395" fill="none" stroke="#efe2bf" stroke-width="48" stroke-linecap="round"/>
 <g class="windmill"><path d="M125 340L144 152H212L247 340Z" fill="#f5e9cb"/><path d="M130 170L178 109L230 170Z" fill="#b76e4d"/><rect x="160" y="285" width="41" height="55" rx="20" fill="#526c51"/><path d="M176 191v46" stroke="#b79464" stroke-width="8"/><g class="escape-blades"><path d="M180 185L147 69Q175 44 193 71L192 177Z" fill="#f1ba67"/><path d="M180 185L296 152Q321 180 294 198L188 197Z" fill="#de927f"/><path d="M180 185L213 301Q185 326 167 299L168 193Z" fill="#91b6c1"/><path d="M180 185L64 218Q39 190 66 172L172 173Z" fill="#749d80"/></g><circle cx="180" cy="185" r="14" fill="#3b6253"/></g>
 <g class="wind-lines" fill="none" stroke="#fff9ed" stroke-width="5" stroke-linecap="round"><path d="M340 270Q275 229 209 256Q147 280 238 301Q315 314 355 291"/><path d="M440 320Q335 281 260 328Q193 365 359 351"/><path d="M575 247Q462 222 373 255"/><path d="M734 295Q643 265 553 293"/></g>
 <g id="safe-house"><path d="M820 288H955V384H820Z" fill="#f9ebc8"/><path d="M796 293L885 223L980 293Z" fill="#bc775b"/><rect x="858" y="320" width="42" height="64" rx="20" fill="#365e4c"/><rect x="917" y="313" width="25" height="28" rx="5" fill="#f4c76f"/><path d="M878 238v-43h35v64" fill="#986c52"/><circle cx="882" cy="347" r="5" fill="#f3c46d"/></g>
 <g fill="#f6d489"><circle cx="383" cy="397" r="6"/><circle cx="715" cy="378" r="6"/><circle cx="749" cy="404" r="5"/></g></svg>
 <div class="escape-pet" id="escape-pet">${fluffyPet(0)}</div>
 <span class="scene-label wind-label">狂风风车</span><span class="scene-label home-label">刹车终点</span></div>
 <div class="escape-status" id="escape-status" role="status" aria-live="polite">先点「开始救援」，听四拍准备，再跟着亮点拍。</div>
 <div class="escape-score" aria-label="四拍节奏提示">${Array.from({length:RHYTHM.beatsPerBar},(_,i)=>`<span data-beat="${i}">${i+1}</span>`).join('')}</div>
 <div class="escape-controls"><button class="primary" id="escape-start">开始救援</button><button class="clap escape-clap" id="escape-clap">先开始救援</button><button class="secondary" id="escape-exit">返回</button><button class="secondary" id="night-audio" aria-pressed="true">背景音乐：开</button></div>
 <p class="note escape-note">点击体验 · 空格键也能拍 · 12 小节 / 48 拍 · ${bpm} BPM · 30 秒<br>原创夜行节拍练习 · 尚未接入《大风车》伴奏及真实拍手检测。</p></section>`;
 let world=null;try{world=createRescueWorld(root.querySelector('#rescue-world'));root.querySelector('.escape-landscape').classList.add('has-world');}catch{root.querySelector('#rescue-world').remove();}
 let muted=false;let ambience=null;let child=null;let phase='ready',frame=0,clock=null,startAt=0,lastBeat=-10,disposed=false,sources=[];
 const q=s=>root.querySelector(s),pet=q('#escape-pet'),status=q('#escape-status'),clap=q('#escape-clap');
 const nodes=[...root.querySelectorAll('[data-beat]')];
 function cue(at){if(!clock)return;const o=clock.createOscillator(),g=clock.createGain();o.frequency.setValueAtTime(180,at);o.frequency.exponentialRampToValueAtTime(60,at+.1);g.gain.setValueAtTime(.16,at);g.gain.exponentialRampToValueAtTime(.001,at+.16);o.connect(g).connect(clock.destination);o.start(at);o.stop(at+.17);sources.push(o);}
 function elapsed(){return clock.currentTime-startAt;}
 function ingest(atSec){
  if(disposed)return;
  if(phase==='ready'){begin();return;}
  if(phase!=='running'){if(phase==='counting')status.textContent='先听准备拍，倒计时结束再拍！';return;}
  const hit=run.ingest(atSec);clap.classList.remove('tap-feedback');void clap.offsetWidth;clap.classList.add('tap-feedback');
  const pop=q('#tap-pop');pop.classList.remove('show');void pop.offsetWidth;pop.classList.add('show');
  if(hit.accepted){nodes[hit.index%RHYTHM.beatsPerBar].classList.add('hit');pet.classList.remove('jump');void pet.offsetWidth;pet.classList.add('jump');world?.hit();pop.textContent='拍准啦！向前跳！';pop.dataset.kind='hit';status.textContent='拍准啦！小伙伴又往前跑了一步！';}
  else{const next=run.expected.find(t=>t>atSec);pop.textContent=next!==undefined&&next-atSec<.4?'早了一点，等亮点！':'没跟上，下一拍再来！';pop.dataset.kind='miss';status.textContent=pop.textContent;}
  return hit;
 }
 function finish(){ambience?.stop();phase='done';clap.disabled=true;clap.textContent='本轮结束';const result=run.finish(run.duration);const escaped=result.outcome==='escaped';root.querySelector('.escape-landscape').classList.add(escaped?'escaped':'stalled');pet.style.left=`${escaped?87:18+result.position*65}%`;world?.update({position:result.position,phase:escaped?'escaped':'stalled',progress:1});q('#escape-time').textContent='救援结束';q('#storm-level').textContent=escaped?'风车正在停下':'刹车力量还不够';status.textContent=escaped?'成功啦！风车停下来了，夜风安静了。':'风车还在转。跟着亮点，我们再试一次！';q('#escape-start').textContent='再救一次';q('#escape-start').disabled=false;
 const next=document.createElement('button');next.className='primary';next.textContent='试听这次作品';next.onclick=()=>onComplete?.(result);q('.escape-controls').prepend(next);}
 function tick(){if(disposed)return;const t=elapsed(),beat=Math.floor(t*bpm/60);if(t>=run.duration){finish();return;}if(beat!==lastBeat){lastBeat=beat;if(beat<0){status.textContent=`准备，${Math.min(4,Math.ceil(-t*bpm/60))}…`;}else{phase='running';clap.disabled=false;clap.textContent='拍一下';if(beat===0)status.textContent='现在！亮点到达时拍一下！';}}
 nodes.forEach((n,i)=>{const target=run.expected[Math.max(0,Math.floor(t*bpm/60/RHYTHM.beatsPerBar))*RHYTHM.beatsPerBar+i];const active=t>=target-run.window&&t<=target+run.window;n.classList.toggle('current',active);n.style.setProperty('--approach',Math.max(0,Math.min(1,1-(target-t)/(60/bpm))).toString());});
 const snap=run.snapshot(Math.max(0,t)),progress=Math.max(0,t/run.duration);pet.style.left=`${18+snap.position*65}%`;world?.update({position:snap.position,progress,phase});q('#escape-time').textContent=t<0?'准备出发':`还剩 ${Math.max(1,Math.ceil(run.expected.length-t*bpm/60))} 拍`;q('#storm-level').textContent=t<0?'先听准备拍':progress>.6?'狂风越来越大！':'沿着长路，拍手给风车刹车！';root.querySelector('.escape-landscape').classList.toggle('storm-strong',phase==='running'&&progress>.6);frame=requestAnimationFrame(tick);
 }
 async function begin(){if(disposed)return;if(phase==='done'){dispose();child=mountEscapeScene(root,{mood,onComplete,onCancel,bpm,onsets,planId});return;}if(phase!=='ready')return;phase='loading';q('#escape-start').disabled=true;clap.disabled=true;clap.textContent='听准备拍';
 try{clock=new AudioContext();await clock.resume();if(disposed){clock.close();return;}if(clock.state!=='running')throw Error();startAt=clock.currentTime+.15+4*60/bpm;for(let i=-4;i<0;i++)cue(startAt+i*60/bpm);run.expected.forEach(t=>cue(startAt+t));
 ambience=createAmbience(clock,clock.currentTime,startAt+run.duration-clock.currentTime);ambience.setMuted(muted);
 phase='counting';q('#escape-start').textContent='救援进行中';frame=requestAnimationFrame(tick);}catch{phase='ready';status.textContent='声音没有启动，请再点一次开始救援。';q('#escape-start').disabled=false;clap.disabled=false;clap.textContent='重新开始';}}
 function key(e){if(e.code==='Space'&&!e.repeat&&['ready','running'].includes(phase)){e.preventDefault();ingest(clock?elapsed():0);}}
 function dispose(){ambience?.stop();world?.dispose();child?.dispose();disposed=true;cancelAnimationFrame(frame);document.removeEventListener('keydown',key);sources.forEach(s=>{try{s.stop();}catch{}});sources=[];if(clock&&clock.state!=='closed')clock.close();}
 q('#night-audio').onclick=()=>{muted=!muted;ambience?.setMuted(muted);q('#night-audio').textContent=muted?'背景音乐：关':'背景音乐：开';q('#night-audio').setAttribute('aria-pressed',String(!muted));};q('#escape-start').onclick=begin;clap.onclick=()=>ingest(clock?elapsed():0);q('#escape-exit').onclick=()=>{dispose();onCancel?.();};document.addEventListener('keydown',key);
 return {dispose,ingestOnset:t=>child?child.ingestOnset(t):ingest(t)};
}
