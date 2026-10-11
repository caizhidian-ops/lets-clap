// Local broadband transient detector, not speech recognition or a learned model.
export class ClapDetector {
 constructor(rate,{calibrationSec=.8,sensitivity=1}={}){
  this.rate=rate;this.size=Math.round(rate*.005);this.calibration=Math.round(rate*calibrationSec);
  this.alpha=Math.exp(-2*Math.PI*1800/rate);this.sensitivity=sensitivity;
  this.count=0;this.total=0;this.energy=0;this.highEnergy=0;this.peak=0;this.previous=0;this.high=0;
  this.noise=.001;this.previousRms=.001;this.last=-Infinity;this.armed=true;this.windowStart=0;
 }
 process(samples,startFrame){
  const events=[];
  for(let i=0;i<samples.length;i++){
   if(!this.count)this.windowStart=startFrame+i;
   const x=samples[i];this.high=this.alpha*(this.high+x-this.previous);this.previous=x;
   this.energy+=x*x;this.highEnergy+=this.high*this.high;this.peak=Math.max(this.peak,Math.abs(x));this.count++;this.total++;
   if(this.count<this.size)continue;
   const rms=Math.sqrt(this.energy/this.count),highRms=Math.sqrt(this.highEnergy/this.count),at=this.windowStart/this.rate;
   const threshold=Math.max(.008/this.sensitivity,this.noise*5);
   const candidate=highRms>threshold&&rms>.012/this.sensitivity&&this.peak>.045/this.sensitivity&&highRms/Math.max(rms,.00001)>.38&&highRms>this.previousRms*2.2;
   const ready=this.total>=this.calibration;
   if(highRms<threshold*.65)this.armed=true;
   if(ready&&this.armed&&candidate&&at-this.last>.18){events.push({at,peak:this.peak,rms,highRms});this.last=at;this.armed=false;}
   // Learn background only; transient tails must not raise the noise floor.
   if(!candidate&&at-this.last>.25)this.noise+=(!ready?.08:.003)*(Math.min(highRms,.03)-this.noise);
   this.previousRms=highRms;this.level=rms;this.ready=ready;this.threshold=threshold;
   this.count=0;this.energy=0;this.highEnergy=0;this.peak=0;
  }
  return events;
 }
}
