export const id = n => 'RHY-CELL-' + String(n).padStart(3, '0');
// Product difficulty policy, never a claim of official textbook grading.
export function allowedIds(mood, difficulty) {
  if (!['happy','calm','excited'].includes(mood) || ![1,2,3].includes(difficulty)) throw Error('无效情绪或难度');
  if (mood === 'calm') return [1,9].map(id);
  return (difficulty === 1 ? [1,9] : difficulty === 2 ? [1,3,4] : [1,2,3,4]).map(id);
}
export function validateCell(cell) {
  if (!cell || cell.spanBeats !== 2 || cell.meter !== '2/4' || !Array.isArray(cell.events) || !cell.events.length) throw Error('单元必须为两拍');
  let cursor = 0;
  for (const e of cell.events) {
    if (!Number.isFinite(e.atBeat) || !Number.isFinite(e.durationBeats) || e.durationBeats <= 0 || typeof e.rest !== 'boolean' || Math.abs(e.atBeat-cursor)>1e-6) throw Error('节奏重叠、越界或不完整');
    cursor += e.durationBeats;
  }
  if (Math.abs(cursor-2)>1e-6) throw Error('单元时值不等于两拍');
  return cell;
}
export function compilePlan(kb, {mood, difficulty, bpm, cellPatternIds, source='rule_fallback', planId=crypto.randomUUID()}) {
  if (!Number.isFinite(bpm) || bpm<40 || bpm>180 || ![4,8].includes(cellPatternIds?.length)) throw Error('计划必须为八单元（历史方案可为四单元）、合法速度');
  const allowed = allowedIds(mood,difficulty);
  if(difficulty>1&&new Set(cellPatternIds).size<2)throw Error('当前难度至少需要两种单元');
  const events = cellPatternIds.flatMap((key,i)=>{
    if (!allowed.includes(key)) throw Error('不允许的节奏单元');
    return validateCell(kb.items.find(c=>c.id===key)).events.map(e=>({...e,atBeat:e.atBeat+i*2,cellId:key}));
  });
  return {planId,knowledgeBase:{version:'notation-patterns.v1',schemaVersion:kb.schemaVersion,cellPatternIds:[...cellPatternIds]},songId:'pep22_g1b_dafengche',scoreRange:{startMeasure:1,endMeasure:cellPatternIds.length/2},meter:'4/4',bpm,mood,difficulty,previewTempoFactor:1,cellPatternIds,source,events,
    expectedOnsetsSec:events.filter(e=>!e.rest).map(e=>e.atBeat*60/bpm),durationSec:cellPatternIds.length*2*60/bpm};
}
export function rulePlan(kb, options) {
  const {mood,difficulty}=options;
  const choices=mood==='calm'?[9,1,9,9]:difficulty===1?(mood==='excited'?[1,1,1,1]:[1,1,1,9]):difficulty===2?(mood==='excited'?[3,4,3,4]:[1,4,1,3]):mood==='excited'?[2,3,2,4]:[1,4,3,2];
  return compilePlan(kb,{...options,cellPatternIds:[...choices,...choices].map(id),source:'rule_fallback'});
}
