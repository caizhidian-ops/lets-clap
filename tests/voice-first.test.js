import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {keywordIntent} from '../src/app/fsm.js';
import {VoiceEndpoint} from '../src/audio/voice-endpoint.js';
import {dialogueTools,validateMood,localCommands} from '../server/dialogue.js';
import {prompts,promptForState} from '../src/app/prompts.js';
const frame=amplitude=>Float32Array.from({length:3200},(_,i)=>Math.sin(i*.1)*amplitude);
test('静音不提交，短促响声不当作完整回答；真实 PCM 持续发声后停顿才提交',()=>{
 const endpoint=new VoiceEndpoint();for(let i=0;i<20;i++)assert.equal(endpoint.update(frame(0),16000),false);
 const click=new VoiceEndpoint();assert.equal(click.update(new Float32Array(800).fill(.2),16000),false);for(let i=0;i<10;i++)assert.equal(click.update(frame(0),16000),false);
 const speech=new VoiceEndpoint();for(let i=0;i<8;i++)assert.equal(speech.update(frame(.1),16000),false);assert.equal(speech.heard,true);
 for(let i=0;i<5;i++)assert.equal(speech.update(frame(0),16000),false);assert.equal(speech.update(frame(0),16000),true);
});
test('语音工具按场景限制，不能确认名字、启动录音或保存作品',()=>{
 const actions=['start_challenge','accept_recording','confirm_name','reduce_difficulty','confirm_plan','retry_same'];
 for(const state of ['PLAN_PREVIEW','FEEDBACK','WORK_PREVIEW']){
  const tools=dialogueTools(state,actions),intent=tools.find(t=>t.function.name==='game_intent');
  assert.deepEqual(intent.function.parameters.properties.action.enum,['reduce_difficulty','confirm_plan','retry_same']);
 }
 assert.deepEqual(localCommands('FEEDBACK'),['listen_recording','keep_recording']);assert.deepEqual(localCommands('WORK_PREVIEW'),['listen_work']);
 assert.equal(dialogueTools('PET_NAMING',actions)[0].function.name,'set_pet_name');
 assert.equal(validateMood({mood:'calm'}),'calm');assert.throws(()=>validateMood({mood:'calm',action:'start_challenge'}));assert.throws(()=>validateMood({mood:'quiet'}));
});
test('每步固定口播有真实 WAV，等待和确认步骤不会打开对话麦克风',()=>{
 for(const [id,prompt] of Object.entries(prompts)){
  assert.ok(prompt.text);const wav=readFileSync(new URL('../public/assets/audio/prompt-'+id+'.wav',import.meta.url));assert.equal(wav.toString('ascii',0,4),'RIFF');assert.ok(wav.length>48000);
 }
 for(const id of ['guide','demo','challenge','record','analyzing','arranging','keep','name_confirm'])assert.ok(!prompts[id].listen);
 for(const state of ['HATCH_SELECT','PET_NAMING','PET_HOME','MOOD_SELECT','FEEDBACK','WORK_PREVIEW'])assert.ok(prompts[promptForState[state]].listen);
});

test('准备好了只触发提示，否定和未准备回答不推进；再练一次可回到示范',()=>{assert.equal(keywordIntent('我准备好了。'),'confirm_plan');assert.equal(keywordIntent('我还没准备好。'),null);assert.equal(keywordIntent('不要去探险。'),null);assert.equal(keywordIntent('再练一次。'),'retry_same');});
