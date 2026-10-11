import {createClapInput} from './clap-input.js';
import {ClapDetector} from './clap-detector.js';
const q=s=>document.querySelector(s);let context=null,mic=null,count=0,disposed=false,pending=false;
function add(text){const row=document.createElement('li');row.textContent=text;q('#events').prepend(row);while(q('#events').children.length>80)q('#events').lastChild.remove();}
function stop(){mic?.stop();mic=null;context?.close();context=null;q('#start').disabled=false;q('#stop').disabled=true;q('#sensitivity').disabled=false;q('#level').value=0;q('#status').textContent='麦克风已停止。';}
q('#start').onclick=async()=>{
 if(pending||mic)return;pending=true;q('#start').disabled=true;q('#status').textContent='正在申请麦克风…';count=0;q('#count').textContent='0';q('#events').replaceChildren();
 try{
  context=new AudioContext({latencyHint:'interactive'});
  const capture=await createClapInput(context,{sensitivity:Number(q('#sensitivity').value),onClap:event=>{count++;q('#count').textContent=String(count);q('#delay').textContent=String(Math.round(event.deliveryMs));q('#status').textContent=`听到第 ${count} 次拍手`;add(`拍手 ${count} · 音频时间 ${event.at.toFixed(3)} 秒 · 处理与消息延迟 ${event.deliveryMs.toFixed(1)} ms`);},onMeter:meter=>{q('#level').value=meter.level;if(!meter.ready)q('#status').textContent='请安静一秒，正在校准环境…';else if(q('#status').textContent.includes('校准'))q('#status').textContent='麦克风已就绪，现在可以拍手。';},onEnded:()=>{stop();q('#status').textContent='麦克风连接已中断，请重新开启。';}});
  if(disposed){capture.stop();return;}mic=capture;q('#stop').disabled=false;q('#sensitivity').disabled=true;
  const settings=mic.settings;q('#settings').textContent=`实际采样率 ${settings.sampleRate||'浏览器未提供'} Hz · 回声消除 ${settings.echoCancellation??'未提供'} · 设备采集延迟 ${settings.latency!==undefined?Math.round(settings.latency*1000)+' ms':'浏览器未提供'}（不含完整系统延迟）`;
 }catch(error){stop();q('#status').textContent=error.message;}finally{pending=false;}
};
q('#stop').onclick=stop;
window.addEventListener('pagehide',()=>{disposed=true;stop();});
async function analyze(bytes,label){
 q('#file-result').textContent='正在本机分析…';q('#backing').disabled=true;
 try{
  const decoder=new OfflineAudioContext(1,1,48000),buffer=await decoder.decodeAudioData(bytes),samples=new Float32Array(buffer.length);
  for(let c=0;c<buffer.numberOfChannels;c++){const channel=buffer.getChannelData(c);for(let i=0;i<samples.length;i++)samples[i]+=channel[i]/buffer.numberOfChannels;}
  const detector=new ClapDetector(buffer.sampleRate,{sensitivity:Number(q('#sensitivity').value),calibrationSec:0}),events=[];
  for(let i=0;i<samples.length;i+=128)events.push(...detector.process(samples.subarray(i,i+128),i));
  q('#file-result').textContent=`${label} · ${buffer.duration.toFixed(2)} 秒 · 检测到 ${events.length} 个疑似拍手${label==='大风车无鼓伴奏'?'（此文件没有拍手，检出均为误触发）':''}`;
  for(const e of events)add(`${label} · ${e.at.toFixed(3)} 秒`);
 }catch{q('#file-result').textContent='音频无法读取，请选择浏览器支持的 WAV / MP3 文件。';}finally{q('#backing').disabled=false;}
}
q('#backing').onclick=async()=>{try{const response=await fetch('/assets/audio/da-feng-che-96bpm.wav');if(!response.ok)throw Error();await analyze(await response.arrayBuffer(),'大风车无鼓伴奏');}catch{q('#file-result').textContent='伴奏加载失败，请重试。';}};
q('#file').onchange=()=>{const file=q('#file').files[0];if(file)file.arrayBuffer().then(bytes=>analyze(bytes,file.name));};
