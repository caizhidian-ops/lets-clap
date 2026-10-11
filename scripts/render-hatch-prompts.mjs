import {writeFile} from 'node:fs/promises';
import {approvedSpeech} from '../server/realtimeProxy/qwen.js';
import {wavBlob} from '../src/audio/engine.js';
export const prompts={
 select:'你希望这个宠物是什么性格？可以告诉我：欢快、安静，或者搞怪。',
 guide:'听到拍手声，看到灯光亮起时，就跟着拍一下。准备好，我们一起唤醒小伙伴吧！'
};
for(const [id,text] of Object.entries(prompts)){
 if(process.env.PROMPT_ID&&process.env.PROMPT_ID!==id)continue;
 const raw=await approvedSpeech(text);if(!raw)throw Error(id+': 千问未返回通过原文校验的语音');
 const bytes=Buffer.from(raw,'base64'),samples=new Float32Array(bytes.length/2);
 for(let i=0;i<samples.length;i++)samples[i]=bytes.readInt16LE(i*2)/32768;
 const wav=wavBlob(samples,24000);await writeFile(new URL('../public/assets/audio/hatch-'+id+'.wav',import.meta.url),Buffer.from(await wav.arrayBuffer()));
 console.log(id+': validated Qwen speech '+(samples.length/24000).toFixed(2)+'s');
}
