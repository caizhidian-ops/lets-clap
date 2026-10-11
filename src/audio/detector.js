// Streaming, 128-frame RMS with high-pass energy, adaptive floor and refractory period.
export class TransientDetector {
  constructor(sampleRate){this.rate=sampleRate;this.floor=.001;this.prev=0;this.filtered=0;this.prevRms=0;this.last=-Infinity;this.onsets=[];this.blocks=0;this.noisy=0;this.clipped=0;this.active=0;}
  process(samples,time){
    let sum=0,raw=0;
    for(const x of samples){this.filtered=.88*(this.filtered+x-this.prev);this.prev=x;sum+=this.filtered*this.filtered;raw+=x*x;if(Math.abs(x)>.98)this.clipped++;}
    const rms=Math.sqrt(sum/samples.length), level=Math.sqrt(raw/samples.length);
    this.blocks++;
    if(level>.025)this.active++;
    if(rms>.025)this.noisy++;
    const threshold=Math.max(.012,this.floor*5);
    if(rms>threshold && rms>this.prevRms*1.5 && time-this.last>.13){this.onsets.push(time);this.last=time;}
    if(rms<threshold)this.floor=.985*this.floor+.015*rms;
    this.prevRms=rms;
    return level;
  }
  result(){return {onsets:this.onsets,qualityFlags:[...(this.noisy/Math.max(1,this.blocks)>.25?['continuous_noise']:[]),...(this.active/Math.max(1,this.blocks)>.45?['sustained_sound']:[]),...(this.clipped>this.blocks*128*.01?['clipping']:[])]};}
}
