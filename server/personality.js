import {tool} from './realtimeProxy/qwen.js';
export const personalityTool=tool('choose_personality','根据孩子明确表达的偏好选择：happy 欢快活泼，quiet 安静温柔，silly 搞怪有趣。没有明确偏好时不要调用。',{personality:{type:'string',enum:['happy','quiet','silly']}});
export function validatePersonality(args){
  if(!args||Object.keys(args).length!==1||!['happy','quiet','silly'].includes(args.personality))throw Error('性格选择不合法');
  return args.personality;
}
