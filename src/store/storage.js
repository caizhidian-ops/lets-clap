export function loadPet(){try{const p=JSON.parse(localStorage.getItem('bobo.pet'));return p?.hatched&&['happy','quiet','silly'].includes(p.personality)&&typeof p.name==='string'?p:null;}catch{return null;}}
export function savePet(p){localStorage.setItem('bobo.pet',JSON.stringify(p));}
function db(){return new Promise((resolve,reject)=>{const r=indexedDB.open('bobo-local',1);r.onupgradeneeded=()=>r.result.createObjectStore('works');r.onerror=()=>reject(r.error);r.onsuccess=()=>resolve(r.result);});}
async function transaction(mode,run){const d=await db();return new Promise((resolve,reject)=>{const t=d.transaction('works',mode),r=run(t.objectStore('works'));t.oncomplete=()=>{d.close();resolve(r.result);};t.onerror=()=>{d.close();reject(t.error);};t.onabort=t.onerror;});}
export const loadWork=()=>transaction('readonly',s=>s.get('accepted'));
export const saveWork=work=>transaction('readwrite',s=>s.put(work,'accepted'));
export const deleteWork=()=>transaction('readwrite',s=>s.delete('accepted'));
