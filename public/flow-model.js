export const moodStyles={开心:{name:'轻快',bpm:90},平静:{name:'舒缓',bpm:60},兴奋:{name:'活力',bpm:108}};
export function readMood(text){
 if(/平静|沉静|安静|舒缓|放松/.test(text))return '平静';
 if(/兴奋|激动|活力/.test(text))return '兴奋';
 if(/开心|快乐|高兴|轻快/.test(text))return '开心';
 return null;
}
export function trackTitle(track){return track.title||`${track.mood||'我的心情'}的小节奏`;}
export function renameTrack(tracks,id,title){
 const name=title.trim();
 if(!name||name.length>24)return {ok:false,error:'给作品起一个 1～24 字的名字吧。'};
 const track=tracks.find(t=>t.id===id);
 if(!track)return {ok:false,error:'没有找到这首作品，请重新打开专辑。'};
 track.title=name;return {ok:true};
}
// User-defined mapping; excitement has no assigned game yet.
export const moodGames={平静:{gameId:'jump-rope',petId:'whale',petName:'悠悠',title:'室内慢节奏',bpm:60},开心:{gameId:'jump-rope',petId:'penguin',petName:'蹦蹦',title:'跳绳',bpm:90}};
export function gameForMood(mood){return moodGames[mood]||null;}
