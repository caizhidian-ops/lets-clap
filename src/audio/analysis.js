// Monotonic dynamic programming: maximize matches, then minimize total timing error.
export function matchOnsets(expected, detected, windowSec=.18) {
  const n=expected.length,m=detected.length;
  const dp=Array.from({length:n+1},()=>Array(m+1).fill(null));
  dp[0][0]={cost:0,path:[]};
  const put=(i,j,cost,path)=>{if(!dp[i][j]||cost<dp[i][j].cost)dp[i][j]={cost,path};};
  for(let i=0;i<=n;i++)for(let j=0;j<=m;j++){
    const x=dp[i][j];if(!x)continue;
    if(i<n)put(i+1,j,x.cost+1,[...x.path,{type:'missed',expectedIndex:i,errorMs:null}]);
    if(j<m)put(i,j+1,x.cost+1,[...x.path,{type:'extra',detectedIndex:j,errorMs:null}]);
    if(i<n&&j<m&&Math.abs(detected[j]-expected[i])<=windowSec){
      const err=detected[j]-expected[i];
      put(i+1,j+1,x.cost+Math.abs(err)/windowSec*.1,[...x.path,{type:Math.abs(err)<=.065?'onTime':err<0?'early':'late',expectedIndex:i,detectedIndex:j,errorMs:Math.round(err*1000)}]);
    }
  }
  return dp[n][m].path;
}
export function analyze(plan, capture, recordingId, calibrationStatus='unverified') {
  const flags=[...(capture.qualityFlags||[])];
  if(!capture.onsets.length)flags.push('no_clear_transients');
  if(capture.onsets.length>plan.expectedOnsetsSec.length*2+4)flags.push('too_many_transients');
  const status=flags.length?'unreliable':'reliable';
  const events=matchOnsets(plan.expectedOnsetsSec,capture.onsets);
  const matchSummary={onTime:0,early:0,late:0,missed:0,extra:0};
  for(const e of events)matchSummary[e.type]++;
  return {planId:plan.planId,recordingId,status,expectedCount:plan.expectedOnsetsSec.length,detectedCount:capture.onsets.length,matchSummary,notableEvents:events.filter(e=>e.type!=='onTime'),calibrationStatus,qualityFlags:flags};
}
export function feedbackOptions(a) {
  if(a.status!=='reliable')return [{code:'uncertain',text:'这次没有听清每一下拍手。我们再试一次吧。'}];
  const options=[];
  if(a.matchSummary.missed)options.push({code:'missed',text:'有些位置没听到拍手。看着亮起来的节奏块，再试一次吧。'});
  if(a.matchSummary.extra)options.push({code:'extra',text:'有些位置多听到了一下。我们先听示范，再试一次吧。'});
  if(a.calibrationStatus==='verified')for(const e of a.notableEvents.filter(e=>['early','late'].includes(e.type)).slice(0,2))options.push({code:e.type+'_'+e.expectedIndex,text:'第'+(e.expectedIndex+1)+'下有点'+(e.type==='early'?'早':'晚')+'。先听示范，再试一次吧。'});
  if(!options.length)options.push({code:'listen',text:a.calibrationStatus==='verified'?'这段跟得很稳！来听听自己的演奏吧。':'拍手录好了！先听听自己的演奏吧。'});
  return options;
}
export function validateAnalysis(a,plan) {
  if(!a||a.planId!==plan.planId||typeof a.recordingId!=='string'||!['reliable','unreliable'].includes(a.status)||a.expectedCount!==plan.expectedOnsetsSec.length||!Number.isInteger(a.detectedCount)||a.detectedCount<0||a.detectedCount>200)throw Error('分析摘要不合法');
  const s=a.matchSummary;
  if(!s||Object.keys(s).length!==5||Object.values(s).some(v=>!Number.isInteger(v)||v<0)||s.onTime+s.early+s.late+s.missed!==a.expectedCount||s.onTime+s.early+s.late+s.extra!==a.detectedCount)throw Error('分析计数不一致');
  if(!['verified','unverified'].includes(a.calibrationStatus)||!Array.isArray(a.qualityFlags)||!Array.isArray(a.notableEvents))throw Error('分析字段不合法');
  for(const e of a.notableEvents)if(!['early','late','missed','extra'].includes(e.type)||(['early','late','missed'].includes(e.type)&&(!Number.isInteger(e.expectedIndex)||e.expectedIndex<0||e.expectedIndex>=a.expectedCount))||(['early','late'].includes(e.type)&&(!Number.isFinite(e.errorMs)||Math.abs(e.errorMs)>180)))throw Error('分析事件不合法');
  return a;
}
