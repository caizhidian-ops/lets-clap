import {writeFile,access} from 'node:fs/promises';
import {prompts} from '../src/app/prompts.js';
import {approvedSpeech} from '../server/realtimeProxy/qwen.js';
import {wavBlob} from '../src/audio/engine.js';
const entries=Object.entries(prompts).filter(([id])=>!process.env.PROMPT_ID||id===process.env.PROMPT_ID);
let index=0;
async function worker(){while(index<entries.length){const [id,prompt]=entries[index++],file=new URL('../public/assets/audio/prompt-'+id+'.wav',import.meta.url);
 if(!process.env.REGENERATE){try{await access(file);continue;}catch{}}
 let raw='';for(let i=0;i<2&&!raw;i++)raw=await approvedSpeech(prompt.text);
 if(!raw)throw Error(id+': 固定口播未通过原文校验');
 const bytes=Buffer.from(raw,'base64'),samples=new Float32Array(bytes.length/2);for(let i=0;i<samples.length;i++)samples[i]=bytes.readInt16LE(i*2)/32768;
 await writeFile(file,Buffer.from(await wavBlob(samples,24000).arrayBuffer()));console.log(id+': validated '+(samples.length/24000).toFixed(2)+'s');
}}
await Promise.all([worker(),worker()]);
