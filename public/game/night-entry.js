import {mountEscapeScene} from './escape-scene.js';
let active;const root=document.querySelector('#app');
function mount(){active?.dispose();active=mountEscapeScene(root,{bpm:90,onCancel:()=>location.assign('/'),onComplete:r=>{document.querySelector('#announcement').textContent=`本次命中 ${r.matchedCount}/${r.expectedCount} 拍。点「重新挑战」再试一次。`;}});}
document.querySelector('#night-replay').onclick=mount;mount();
