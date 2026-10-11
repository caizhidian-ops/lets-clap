export async function createClapInput(context,{onClap,onMeter,onEnded,sensitivity=1}={}){
 if(!navigator.mediaDevices?.getUserMedia||!context.audioWorklet)throw Error('这个浏览器不支持本地拍手识别，请使用新版 Chrome 或 Safari。');
 let stream,source,node,sink,stopped=false,permissionTimer,expired=false;
 function stop(){if(stopped)return;stopped=true;if(node)node.port.onmessage=null;source?.disconnect();node?.disconnect();sink?.disconnect();stream?.getTracks().forEach(t=>t.stop());}
 try{
  const permission=navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:false,autoGainControl:false,latency:{ideal:.01}},video:false}).then(value=>{if(expired){value.getTracks().forEach(t=>t.stop());throw Error('授权已超时');}return value;});
  stream=await Promise.race([permission,new Promise((_,reject)=>{permissionTimer=setTimeout(()=>{expired=true;reject(Error('麦克风授权等待超时，请在浏览器允许麦克风后重试。'));},20000);})]);
  clearTimeout(permissionTimer);
  if(context.state==='closed')throw Error('页面已离开，请重新开启拍手。');
  await context.resume();await context.audioWorklet.addModule('/game/clap-worklet.js');
  source=context.createMediaStreamSource(stream);node=new AudioWorkletNode(context,'clap-detector',{processorOptions:{sensitivity},channelCount:1,channelCountMode:'explicit'});sink=context.createGain();sink.gain.value=0;
  source.connect(node).connect(sink).connect(context.destination);
  node.port.onmessage=({data})=>{if(stopped)return;if(data.type==='clap')onClap?.({...data,deliveryMs:Math.max(0,(context.currentTime-data.at)*1000)});else onMeter?.(data);};
  const track=stream.getAudioTracks()[0];track.onended=()=>{if(!stopped){stop();onEnded?.();}};
  node.onprocessorerror=()=>{if(!stopped){stop();onEnded?.();}};
  return {stop,settings:track.getSettings()};
 }catch(error){clearTimeout(permissionTimer);stop();if(error.name==='NotAllowedError')throw Error('麦克风权限未打开，请允许后重试；也可以继续用按钮。');if(error.name==='NotFoundError')throw Error('没有找到麦克风，请连接后重试。');throw error;}
}
