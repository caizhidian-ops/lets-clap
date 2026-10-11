export const REPORT_VERSION=1;
export const COURSE_STAGES=[
 {id:'steady-quarter-v1',title:'均匀跟拍',description:'跟着每一拍，一下一下地拍。',available:true},
 {id:'accent',title:'强弱拍',description:'听出第一拍，让轻重有变化。',available:false},
 {id:'duration',title:'长短节奏',description:'认识长音、短音和休止。',available:false},
 {id:'patterns',title:'节奏组合',description:'把学到的节奏连成一段。',available:false}
];
export const MASTERY={rounds:3,accuracy:.85,precision:.85,meanOffsetRatio:.08};
export function reportInput(track){
 return {times:track.times,expectedTimes:track.expectedTimes,toleranceMs:track.toleranceMs,bpm:track.sourceBpm??track.bpm,durationSec:track.sourceDurationSec??track.durationSec,inputSource:track.inputSource,analysisStatus:track.analysisStatus,gameId:track.gameId,planId:track.planId,matchedCount:track.matchedCount};
}
export function analyzeRhythm(data){
 const {times,expectedTimes,bpm,durationSec,toleranceMs}=data??{};
 if(!Array.isArray(times)||times.length>512||!Array.isArray(expectedTimes)||!expectedTimes.length||expectedTimes.length>64||!Number.isFinite(bpm)||bpm<30||bpm>240||!Number.isFinite(durationSec)||durationSec<=0||durationSec>120||!Number.isFinite(toleranceMs)||toleranceMs<=0||toleranceMs>300)throw Error('INVALID_INPUT');
 for(const list of [times,expectedTimes])if(list.some((t,i)=>!Number.isFinite(t)||t<0||(list===expectedTimes?t>=durationSec*1000:t>durationSec*1000)||(i&&t<list[i-1])||(list===expectedTimes&&i&&t===list[i-1])))throw Error('INVALID_INPUT');
 const hits=new Set(),offsets=[];let early=0,late=0,extra=0,combo=0,bestCombo=0,lastIndex=-1;
 for(const time of times){
  let index=-1,distance=Infinity;
  expectedTimes.forEach((at,i)=>{const d=Math.abs(time-at);if(!hits.has(i)&&d<=toleranceMs&&d<distance){index=i;distance=d;}});
  const nearest=expectedTimes.reduce((best,at,i)=>Math.abs(time-at)<Math.abs(time-expectedTimes[best])?i:best,0);
  const offset=time-expectedTimes[index<0?nearest:index];
  if(offset<-30)early++;else if(offset>30)late++;
  if(index<0){extra++;combo=0;continue;}
  hits.add(index);offsets.push(offset);combo=index===lastIndex+1?combo+1:1;lastIndex=index;bestCombo=Math.max(bestCombo,combo);
 }
 const matched=hits.size,missed=expectedTimes.length-matched,period=60000/bpm;
 const meanAbsOffset=offsets.length?offsets.reduce((sum,n)=>sum+Math.abs(n),0)/offsets.length:null;
 const meanAbsOffsetMs=meanAbsOffset===null?null:Math.round(meanAbsOffset*10)/10;
 const metrics={matched,expected:expectedTimes.length,missed,extra,early,late,bestCombo,accuracy:matched/expectedTimes.length,precision:times.length?matched/times.length:0,meanAbsOffsetMs};
 const consistent=data.matchedCount===undefined||data.matchedCount===matched;
 const reliable=consistent&&data.analysisStatus==='reliable'&&['tap_demo','microphone_clap','mixed_mic_tap'].includes(data.inputSource);
 const quarter=Math.abs(bpm-96)<.001&&expectedTimes.every((t,i)=>Math.abs(t-i*period)<=1)&&((expectedTimes.length===48&&Math.abs(durationSec-30)<.001&&['jump-rope-quarter-v1','intro-quarter-v1'].includes(data.planId))||(expectedTimes.length===16&&Math.abs(durationSec-10)<.001&&['jump-rope-quarter-4bars-v2','intro-quarter-4bars-v2'].includes(data.planId)));
 const qualified=reliable&&quarter&&data.inputSource!=='mixed_mic_tap'&&metrics.accuracy>=MASTERY.accuracy&&metrics.precision>=MASTERY.precision&&meanAbsOffset!==null&&meanAbsOffset<=period*MASTERY.meanOffsetRatio;
 let strength=matched?`你有 ${matched} 拍跟上了小鼓${bestCombo>=4?`，最长连续跟上 ${bestCombo} 拍`:''}！`:'你完成了一次尝试，愿意开始就很棒！';
 let nextStep,exercise;
 if(!times.length){nextStep='这次没有记录到拍点。先确认按钮能用，拍手时看看麦克风提示。';exercise='先点一次「跳一下」，再跟着四拍准备，一拍做一个动作。';}
 else if(times.length<4){nextStep='这次拍点还少，我们再听一听、试几拍。';exercise='先听「1、2、3、4」，下一轮跟着小鼓拍四下。';}
 else if(extra>=Math.max(2,missed)){nextStep=quarter?'有些拍点挤在一起。给每一拍留一点空隙，一拍只做一次动作。':'有些声音落在示范拍点以外。跟着亮点做动作，空白时休息一下。';exercise=quarter?'边数「1、2、3、4」边拍，每个数字只拍一下。':'再听一遍示范：每个亮点拍一下，空白时把小手停一停。';}
 else if(data.inputSource==='microphone_clap'||data.inputSource==='mixed_mic_tap'){nextStep=missed?'这次有些示范拍点没有匹配到。设备也可能没听清，我们戴耳机再试一次。':'检测到的拍点跟上啦！先确认听得清，再试着保持这份节奏。';exercise=quarter?'戴上耳机，先听四拍，再一拍拍一下。':'戴上耳机再听一遍示范，亮点时拍，空白时休息。';}
 else if(early>late&&early>=times.length*.25){nextStep='有几下比小鼓先到了。听到鼓点，再做动作，别着急。';exercise=quarter?'先只听四拍，然后轻轻数拍；下一轮和鼓声一起拍。':'先只听一遍示范，下一轮和亮点一起拍，空白时休息。';}
 else if(late>early&&late>=times.length*.25){nextStep='有几下比小鼓晚到了。先听出间隔，手提前准备好。';exercise=quarter?'听四拍后，边数「1、2、3、4」边做动作，让手和鼓声同时到。':'先听一遍示范，留意相邻亮点的间隔，让手和亮点同时到。';}
 else if(missed>0){nextStep='有几拍还没跟上。漏了一拍没关系，听下一拍接回来。';exercise=quarter?'每次先跟四拍，漏了就从下一个「1」重新跟上。':'再听一遍示范，亮点时拍、空白时停，漏了就从下一组接回来。';}
 else{nextStep=quarter?'每一拍都跟上啦！继续让每一下的间隔一样长。':'示范拍点都跟上啦！再听听哪里连着拍、哪里要停一停。';exercise=quarter?'下一轮轻轻数拍，试着把这份稳定再保持一次。':'先听一遍示范，再跟着亮点拍，保持原来的长短和休止。';}
 return {version:REPORT_VERSION,status:'ready',source:'local_rules',generatedAt:Date.now(),stageId:quarter?'steady-quarter-v1':null,inputSource:data.inputSource??'unknown',reliable,qualified,metrics,strength,nextStep,exercise,notice:`根据本次${data.inputSource==='microphone_clap'?'麦克风检测到的':data.inputSource==='mixed_mic_tap'?'拍手与按键混合的':'按键或点击的'}拍点分析；没有分析原始录音。${!consistent?'报告与游戏计数不一致，本次不计入掌握记录。':''}${data.inputSource==='microphone_clap'||data.inputSource==='mixed_mic_tap'?'检测可能漏检或误触发。设备延迟未经校准，记录中的早晚不直接代表孩子的动作时机；可戴耳机后再试。':''}`};
}
export function learningProgress(tracks){
 const unique=new Map(tracks.filter(t=>t?.id).map(t=>[t.id,t]));
 return ['tap_demo','microphone_clap'].map(inputSource=>{
  const rounds=[...unique.values()].filter(t=>{
   try{return t.inputSource===inputSource&&analyzeRhythm(reportInput(t)).qualified;}catch{return false;}
  }).sort((a,b)=>a.date-b.date);
  return {inputSource,count:rounds.length,mastered:rounds.length>=MASTERY.rounds,evidence:rounds.slice(0,MASTERY.rounds).map(t=>t.id),earnedAt:rounds[MASTERY.rounds-1]?.date};
 });
}
