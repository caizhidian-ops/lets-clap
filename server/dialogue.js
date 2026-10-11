import {tool} from './realtimeProxy/qwen.js';
import {personalityTool} from './personality.js';
export const listeningStates=['HATCH_SELECT','PET_NAMING','PET_HOME','MOOD_SELECT','PLAN_PREVIEW','FEEDBACK','WORK_PREVIEW'];
const allowed=new Set(['enter_adventure','rename','reduce_difficulty','increase_difficulty','slow_preview','replay_preview','confirm_plan','return_home','retry_same']);
export const localCommands=state=>state==='FEEDBACK'?['listen_recording','keep_recording']:state==='WORK_PREVIEW'?['listen_work']:[];
export function dialogueTools(state,actions){
 if(state==='HATCH_SELECT')return [personalityTool];
 if(state==='PET_NAMING')return [tool('set_pet_name','提出孩子说出的名字候选，必须孩子点击确认',{name:{type:'string',maxLength:12}})];
 if(state==='MOOD_SELECT')return [tool('select_mood','根据孩子表达的当前心情，选择开心、平静或兴奋；不明确时不要调用',{mood:{type:'string',enum:['happy','calm','excited']}})];
 const tools=[tool('game_intent','按明确意图选择当前操作：准备好了=confirm_plan；简单一点=reduce_difficulty；难一点=increase_difficulty；慢一点=slow_preview；再听一次=replay_preview；去探险=enter_adventure；再练一次=retry_same；回家=return_home；改名字=rename。不能开始录音或直接保留作品',{action:{type:'string',enum:actions.filter(a=>allowed.has(a))}})];
 const commands=localCommands(state);if(commands.length)tools.push(tool('local_action','试听真实录音或作品；保留作品只显示确认提示，不代替孩子点击',{command:{type:'string',enum:commands}}));
 return tools;
}
export function validateMood(args){if(!args||Object.keys(args).length!==1||!['happy','calm','excited'].includes(args.mood))throw Error('心情选择不合法');return args.mood;}
