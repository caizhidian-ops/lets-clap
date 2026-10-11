import {TransientDetector} from '/src/audio/detector.js';
class Capture extends AudioWorkletProcessor {
  constructor(){super();this.start=Infinity;this.end=Infinity;this.done=false;this.voice=false;this.detector=new TransientDetector(sampleRate);
    this.port.onmessage=({data})=>{if(data.type==='arm'){this.start=data.start;this.end=data.end;}if(data.type==='voice')this.voice=true;};
  }
  process(inputs,outputs){
    const input=inputs[0]?.[0];if(!input)return true;
    if(this.voice){this.port.postMessage({type:'voice',samples:input.slice(),sampleRate});return true;}
    const first=Math.max(0,Math.ceil((this.start-currentTime)*sampleRate));
    const last=Math.min(input.length,Math.ceil((this.end-currentTime)*sampleRate));
    if(last>first){const samples=input.slice(first,last),time=currentTime+first/sampleRate-this.start;const level=this.detector.process(samples,time);this.port.postMessage({type:'chunk',samples,time,level});}
    if(!this.done&&currentTime+input.length/sampleRate>=this.end){this.done=true;this.port.postMessage({type:'complete',...this.detector.result()});}
    return !this.done;
  }
}
registerProcessor('capture',Capture);
