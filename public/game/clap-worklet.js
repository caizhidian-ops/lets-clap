import {ClapDetector} from './clap-detector.js';
class ClapProcessor extends AudioWorkletProcessor {
 constructor(options){super();this.detector=new ClapDetector(sampleRate,options.processorOptions);this.nextMeter=0;}
 process(inputs){
  const samples=inputs[0]?.[0];if(!samples)return true;
  for(const event of this.detector.process(samples,currentFrame))this.port.postMessage({type:'clap',...event,processedAt:currentTime+samples.length/sampleRate});
  if(currentTime>=this.nextMeter){this.nextMeter=currentTime+.1;this.port.postMessage({type:'meter',level:this.detector.level||0,ready:!!this.detector.ready,noise:this.detector.noise});}
  // Output remains silent. Never monitor the microphone through speakers.
  return true;
 }
}
registerProcessor('clap-detector',ClapProcessor);
