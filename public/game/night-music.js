// Original ambient score; synthesized locally, no provider or microphone.
export function createAmbience(context,start,duration,mood='night'){
 const master=context.createGain();master.gain.value=.35;master.connect(context.destination);
 const sources=[],filters=[];let stopped=false;
 const chords=mood==='night'?[[220,261.63,329.63],[174.61,220,261.63],[164.81,196,246.94],[220,261.63,329.63]]:[[261.63,329.63,392],[220,261.63,329.63],[174.61,220,261.63],[196,246.94,293.66]];
 const segment=duration/4;
 chords.forEach((chord,i)=>chord.forEach((frequency,j)=>{
  const at=start+i*segment,o=context.createOscillator(),g=context.createGain(),f=context.createBiquadFilter();o.type='triangle';o.frequency.value=frequency;o.detune.value=j%2?5:-5;f.type='lowpass';f.frequency.value=650;
  g.gain.setValueAtTime(.001,at);g.gain.linearRampToValueAtTime(.065,at+.22);g.gain.setValueAtTime(.065,at+Math.max(.23,segment-.25));g.gain.linearRampToValueAtTime(.001,at+segment);
  o.connect(f).connect(g).connect(master);o.start(at);o.stop(at+segment+.02);sources.push(o);filters.push(f,g);
 }));
 const notes=mood==='night'?[659.25,587.33,523.25,493.88,440,392,415.3,440]:mood==='calm'?[392,440,523.25,440,392,329.63,293.66,261.63]:[523.25,659.25,783.99,659.25,587.33,659.25,783.99,523.25];
 notes.forEach((frequency,i)=>{const at=start+i*duration/8,o=context.createOscillator(),g=context.createGain();o.type='sine';o.frequency.value=frequency;g.gain.setValueAtTime(.001,at);g.gain.linearRampToValueAtTime(.025,at+.03);g.gain.exponentialRampToValueAtTime(.001,at+Math.min(.6,duration/8));o.connect(g).connect(master);o.start(at);o.stop(at+Math.min(.65,duration/8));sources.push(o);filters.push(g);});
 const buffer=context.createBuffer(1,context.sampleRate*2,context.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
 const wind=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();wind.buffer=buffer;wind.loop=true;filter.type='lowpass';filter.frequency.value=380;gain.gain.setValueAtTime(.006,start);gain.gain.linearRampToValueAtTime(.018,start+duration*.8);gain.gain.linearRampToValueAtTime(.001,start+duration);wind.connect(filter).connect(gain).connect(master);wind.start(start);wind.stop(start+duration);sources.push(wind);filters.push(filter,gain);
 return {setMuted(muted){master.gain.setTargetAtTime(muted?0:.35,context.currentTime,.05);},stop(){if(stopped)return;stopped=true;if(context.state==='closed')return;master.gain.cancelScheduledValues(context.currentTime);master.gain.setTargetAtTime(0,context.currentTime,.06);sources.forEach(s=>{try{s.stop(context.currentTime+.3);}catch{}});setTimeout(()=>{master.disconnect();filters.forEach(f=>f.disconnect());},350);}};
}
