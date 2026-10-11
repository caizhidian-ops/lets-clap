import {analyzeRhythm,reportInput} from './rhythm-report.js';
// Jobs retain their own track reference even when the child starts another round.
export function createReportController({request=fetch,onChange=()=>{}}={}){
 const jobs=new Map();
 function start(track,{retry=false}={}){
  if(jobs.has(track.id))return jobs.get(track.id);
  if(!retry&&track.report?.status==='ready')return Promise.resolve(track.report);
  try{track.report={...analyzeRhythm(reportInput(track)),status:'pending'};}
  catch{track.report={status:'unavailable',notice:'这首历史作品缺少原始节奏时间轴，暂时无法生成跟拍报告。再玩一次就能记录。'};onChange(track);return Promise.resolve(track.report);}
  onChange(track);
  const job=(async()=>{
   try{
    const response=await request('/api/rhythm-report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(reportInput(track)),signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw Error('REPORT_ERROR');
    const report=await response.json();
    if(report.version!==1||report.status!=='ready'||!['local_rules','qwen'].includes(report.source)||!['strength','nextStep','exercise','notice'].every(key=>typeof report[key]==='string'))throw Error('INVALID_REPORT');
    // The local timing evidence determines progress, never model-provided numbers.
    track.report={...track.report,status:'ready',source:report.source,strength:report.strength,nextStep:report.nextStep,exercise:report.exercise,notice:report.notice,generatedAt:report.generatedAt};
   }catch{track.report={...track.report,status:'failed',error:'反馈服务暂时没连上，下面先看本地拍点建议。可以重试，作品仍可试听和收藏。'};}
   finally{jobs.delete(track.id);onChange(track);}
   return track.report;
  })();
  jobs.set(track.id,job);return job;
 }
 return {start};
}
