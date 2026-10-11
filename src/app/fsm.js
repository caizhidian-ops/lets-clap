export const transitions = {
  HATCH_SELECT:{choose_personality:'HATCH_GUIDE'},
  HATCH_GUIDE:{guided_playback_complete:'HATCH_REVEAL'},
  HATCH_REVEAL:{reveal_complete:'PET_NAMING'},
  PET_NAMING:{confirm_name:'PET_HOME'},
  PET_HOME:{enter_adventure:'ADVENTURE_INTRO',rename:'PET_NAMING'},
  ADVENTURE_INTRO:{intro_complete:'MOOD_SELECT'},
  MOOD_SELECT:{select_mood:'ARRANGEMENT_LOADING',return_home:'PET_HOME'},
  ARRANGEMENT_LOADING:{plan_validated:'PLAN_PREVIEW',plan_fallback:'PLAN_PREVIEW',cancel:'MOOD_SELECT'},
  PLAN_PREVIEW:{reduce_difficulty:'ARRANGEMENT_LOADING',increase_difficulty:'ARRANGEMENT_LOADING',slow_preview:'PLAN_PREVIEW',replay_preview:'PLAN_PREVIEW',confirm_plan:'PLAN_PREVIEW',start_challenge:'RECORD_COUNT_IN',preview_accepted:'WORK_PREVIEW',return_home:'PET_HOME'},
  RECORD_COUNT_IN:{count_in_complete:'RECORDING',cancel:'PLAN_PREVIEW'},
  RECORDING:{capture_complete:'ANALYZING',cancel:'PLAN_PREVIEW'},
  ANALYZING:{analysis_complete:'FEEDBACK',cancel:'PLAN_PREVIEW'},
  FEEDBACK:{retry_same:'PLAN_PREVIEW',reduce_difficulty:'ARRANGEMENT_LOADING',increase_difficulty:'ARRANGEMENT_LOADING',accept_recording:'WORK_PREVIEW',return_home:'PET_HOME'},
  WORK_PREVIEW:{replay:'WORK_PREVIEW',retry_same:'PLAN_PREVIEW',reduce_difficulty:'ARRANGEMENT_LOADING',increase_difficulty:'ARRANGEMENT_LOADING',return_home:'PET_HOME'}
};
export class Game {
  constructor(pet=null) {this.pet=pet;this.state=pet?.hatched?'PET_HOME':'HATCH_SELECT';this.sceneVersion=0;this.seen=new Set();}
  act(action,{sceneVersion=this.sceneVersion,turnId=crypto.randomUUID()}={}) {
    if (sceneVersion!==this.sceneVersion || this.seen.has(turnId)) throw Error('过期或重复事件');
    const next=transitions[this.state]?.[action];
    if (!next || (action==='enter_adventure'&&!this.pet?.hatched)) throw Error('当前状态不允许此操作');
    this.seen.add(turnId); if(this.seen.size>256)this.seen.delete(this.seen.values().next().value);
    this.state=next;this.sceneVersion++;return this.snapshot();
  }
  snapshot(){return {state:this.state,sceneVersion:this.sceneVersion,actions:Object.keys(transitions[this.state]||{})};}
}
export function keywordIntent(text) {
  if(/不要|不想|不去|没准备|还没|不知道|不是/.test(text))return null;
  if (/简单|太难/.test(text)) return 'reduce_difficulty';
  if (/难一点|更难/.test(text)) return 'increase_difficulty';
  if (/慢一点/.test(text)) return 'slow_preview';
  if (/再听|再来一遍|听一遍/.test(text)) return 'replay_preview';
  if (/探险|出发|一起玩音乐/.test(text)) return 'enter_adventure';
  if (/回家|返回首页/.test(text)) return 'return_home';
  if (/再练一次|再试一次/.test(text)) return 'retry_same';
  if (/就这样|准备好了/.test(text)) return 'confirm_plan';
  return null;
}
