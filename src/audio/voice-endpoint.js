// Deterministic end-of-turn detection. This is not speech recognition or clap analysis.
export class VoiceEndpoint{
 constructor(){this.speechSec=0;this.silenceSec=0;this.noise=.003;this.heard=false;}
 update(samples,rate){
  const duration=samples.length/rate,rms=Math.sqrt(samples.reduce((sum,x)=>sum+x*x,0)/Math.max(1,samples.length));
  const threshold=Math.max(.012,Math.min(.04,this.noise*3));
  if(rms>threshold){this.speechSec+=duration;this.silenceSec=0;this.heard=this.speechSec>=.18;}
  else{this.noise=this.noise*.98+rms*.02;if(this.heard)this.silenceSec+=duration;}
  return this.heard&&this.silenceSec>=1.2;
 }
}
