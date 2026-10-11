export const HANDOFF_KEY='lets-clap-mio-handoff-v1';
export function validateHandoff(value){
 const {plan,pet}=value||{};
 if(!pet?.hatched||!['happy','quiet','silly'].includes(pet.personality)||typeof pet.name!=='string'||!pet.name.trim()||pet.name.length>12)throw Error('请先孵化并确认宠物名字。');
 if(!plan||typeof plan.planId!=='string'||!['happy','calm','excited'].includes(plan.mood)||!Number.isFinite(plan.bpm)||plan.bpm<40||plan.bpm>180||!Number.isFinite(plan.durationSec)||Math.abs(plan.durationSec-8*60/plan.bpm)>.001||!Array.isArray(plan.expectedOnsetsSec)||!plan.expectedOnsetsSec.length||plan.expectedOnsetsSec.length>16||plan.expectedOnsetsSec.some((t,i)=>!Number.isFinite(t)||t<0||t>=plan.durationSec||(i&&t<=plan.expectedOnsetsSec[i-1])))throw Error('节奏方案无效，请返回伙伴重新编排。');
 return {plan,pet,mood:{happy:'开心',calm:'平静',excited:'兴奋'}[plan.mood],petId:{happy:'penguin',quiet:'whale',silly:'dachshund'}[pet.personality]};
}
export function saveHandoff(storage,value){storage.setItem(HANDOFF_KEY,JSON.stringify(validateHandoff(value)));}
export function loadHandoff(storage){const raw=storage.getItem(HANDOFF_KEY);return raw?validateHandoff(JSON.parse(raw)):null;}
