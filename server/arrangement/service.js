import {allowedIds,compilePlan,rulePlan} from '../../src/music/rhythm.js';
import {qwenRequest,qwenConfig,tool} from '../realtimeProxy/qwen.js';
export async function arrange(kb,options,request=qwenRequest,enabled=qwenConfig().enabled) {
  if(enabled){
    const schema=tool('suggest_rhythm_arrangement','选择八个两拍节奏单元，共四小节，动机重复加局部变化。',{cellPatternIds:{type:'array',items:{type:'string',enum:allowedIds(options.mood,options.difficulty)},minItems:8,maxItems:8}});
    let correction='';
    for(let attempt=0;attempt<2;attempt++){
      try{
        const r=await request({text:JSON.stringify({...options,allowedPatternIds:allowedIds(options.mood,options.difficulty),requiredCells:8,correction}),tools:[schema],instructions:'只调用节奏编排工具；所有 ID 必须来自允许列表。情绪与难度独立。',
          validateTool:call=>{if(call.name!=='suggest_rhythm_arrangement')throw Error('工具不允许');if(JSON.parse(call.arguments).cellPatternIds?.length!==8)throw Error('新编排需要八个节奏单元');return {ok:true,plan:compilePlan(kb,{...options,cellPatternIds:JSON.parse(call.arguments).cellPatternIds,source:'ai_validated'})};}});
        const c=r.calls.find(c=>c.name==='suggest_rhythm_arrangement');if(!c)throw Error('没有编排工具调用');if(JSON.parse(c.arguments).cellPatternIds?.length!==8)throw Error('新编排需要八个节奏单元');
        return r.toolResults?.find(x=>x.ok)?.plan||compilePlan(kb,{...options,cellPatternIds:JSON.parse(c.arguments).cellPatternIds,source:'ai_validated'});
      }catch(e){correction=e.message;}
    }
  }
  return rulePlan(kb,options);
}
