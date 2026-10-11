import {plannedRopeAngle} from './rhythm-cues.js';
import {RHYTHM} from './rhythm.js';
import * as T from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {ropeTiming,jumpHeight,ropeAngleAt,ropePoint} from './jump-rope-motion.js';
import {addFinePile} from '../plush-fur.js';
const petURLs=['/assets/plush-v2/penguin.glb'];
function disposeModel(model){model.traverse(o=>{o.geometry?.dispose();for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){for(const v of Object.values(m))if(v?.isTexture)v.dispose();m.dispose();}});}
function setup(host,background){const world=new T.Scene();if(background)world.background=new T.Color(background);const renderer=new T.WebGLRenderer({antialias:true,alpha:!background});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;host.append(renderer.domElement);const camera=new T.PerspectiveCamera(43,1,.1,100);world.add(new T.HemisphereLight('#fff1da','#715c55',2));const light=new T.DirectionalLight('#ffe4b0',3);light.position.set(-4,8,5);light.castShadow=true;light.shadow.mapSize.set(1024,1024);world.add(light);const resize=()=>{const {width,height}=host.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height);camera.aspect=width/height;camera.fov=background?Math.max(48,2*Math.atan(5.7/(10.7*camera.aspect))*180/Math.PI):43;camera.updateProjectionMatrix();};const ro=new ResizeObserver(resize);ro.observe(host);resize();return {world,renderer,camera,dispose(){ro.disconnect();disposeModel(world);renderer.dispose();renderer.domElement.remove();}};}
function loadAsset(urls,parent,size,host,isDisposed){const loader=new GLTFLoader();let i=0;const attempt=()=>loader.load(urls[i],g=>{if(isDisposed()){disposeModel(g.scene);return;}host.dataset.colorMaps=String((()=>{let count=0;g.scene.traverse(o=>{if(o.isMesh)for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(m.map)count++;});return count;})());if(urls[i].includes('plush-v2'))addFinePile(g.scene);const model=g.scene,b=new T.Box3().setFromObject(model),s=b.getSize(new T.Vector3()),c=b.getCenter(new T.Vector3());model.position.sub(c);const wrapper=new T.Group();wrapper.add(model);wrapper.scale.setScalar(size/Math.max(s.x,s.y,s.z));wrapper.position.y=s.y*wrapper.scale.x/2;parent.add(wrapper);host.dataset.asset=urls[i];host.dispatchEvent(new CustomEvent('assetloaded'));},undefined,()=>{if(isDisposed())return;if(++i<urls.length)attempt();else{host.dataset.asset='unavailable';host.dispatchEvent(new CustomEvent('asseterror'));}});attempt();}
export function mountWindmillPreview(host){const s=setup(host,null);let disposed=false,frame;const group=new T.Group();s.world.add(group);s.camera.position.set(4,3.2,6);s.camera.lookAt(0,1.6,0);loadAsset(['/assets/plush-v1/windmill.glb'],group,3.8,host,()=>disposed);function draw(){if(disposed)return;group.rotation.y=-Math.PI/2;s.renderer.render(s.world,s.camera);frame=requestAnimationFrame(draw);}draw();return {dispose(){disposed=true;cancelAnimationFrame(frame);s.dispose();}};}
export function mountInteriorWorld(host,{petId='penguin'}={}){const s=setup(host,'#5d4b40');let disposed=false,frame,phase='dialogue',gameTime=0,lastUpdate=0,bpm=RHYTHM.bpm,lastJump=-Infinity,accepted=true,contactAt=-Infinity,contactHit=true;
 let resolveReady;const ready=new Promise(resolve=>resolveReady=resolve);
 host.addEventListener('assetloaded',async()=>{try{if(!disposed){await s.renderer.compileAsync(s.world,s.camera);if(!disposed)s.renderer.render(s.world,s.camera);}}catch{}finally{resolveReady();}},{once:true});
 host.addEventListener('asseterror',()=>resolveReady(),{once:true});
 const mesh=(g,color,x,y,z,parent=s.world)=>{const m=new T.Mesh(g,new T.MeshStandardMaterial({color,roughness:.85}));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
 const box=new T.BoxGeometry(1,1,1);
 mesh(new T.CylinderGeometry(9,9,.3,64),'#ae7954',0,-.22,0);
 // Open front lets the camera sit inside; curved rear wall defines the tower.
 mesh(new T.CylinderGeometry(9,9,10,64,1,true,Math.PI/2,Math.PI),'#d3b58b',0,4.8,0).material.side=T.DoubleSide;
 for(let i=0;i<21;i++){const angle=Math.PI/2+i*Math.PI/20;mesh(box,'#cba57e',Math.sin(angle)*8.8,4.8,Math.cos(angle)*8.8).scale.set(.12,9.8,.12);}
 for(let i=-5;i<=5;i++){mesh(box,'#89633f',i*1.4,9.5,-3).scale.set(.17,.24,11);mesh(box,'#ba8b62',0,-.04,i*1.4).scale.set(16,.035,.04);}
 const windowGroup=new T.Group();windowGroup.position.set(0,3.7,-8.3);s.world.add(windowGroup);
 const window=mesh(new T.CircleGeometry(1.8,64),'#c2dbe0',0,0,0,windowGroup);window.material=new T.MeshBasicMaterial({color:'#c2dbe0'});
 mesh(new T.TorusGeometry(1.85,.18,12,64),'#72513d',0,0,.04,windowGroup);
 mesh(box,'#72513d',0,0,.12,windowGroup).scale.set(.1,3.6,.15);mesh(box,'#72513d',0,0,.12,windowGroup).scale.set(3.6,.1,.15);
 const rotor=new T.Group();rotor.position.set(0,0,-.05);windowGroup.add(rotor);for(let i=0;i<4;i++){const blade=mesh(box,'#d9e9e3',0,0,0,rotor);blade.rotation.z=i*Math.PI/2;blade.position.set(Math.sin(i*Math.PI/2)*.8,Math.cos(i*Math.PI/2)*.8,0);blade.scale.set(.14,1.7,.04);}
 const gear=new T.Group();gear.position.set(-4,3.4,-5.4);gear.rotation.x=Math.PI/2;s.world.add(gear);mesh(new T.TorusGeometry(1.2,.17,10,40),'#71513b',0,0,0,gear);for(let i=0;i<16;i++){const a=i*Math.PI/8;const tooth=mesh(box,'#71513b',Math.cos(a)*1.3,Math.sin(a)*1.3,0,gear);tooth.rotation.z=a;tooth.scale.set(.32,.2,.28);}
 mesh(new T.CylinderGeometry(.18,.18,9.5,12),'#765941',-4,4.7,-5.4);
 const table=mesh(new T.CylinderGeometry(1.3,1.3,.15,32),'#98714b',4,1.2,-3.5);for(const x of [3.3,4.7])mesh(box,'#846140',x,.5,-3.5).scale.set(.15,1.3,.15);
 mesh(new T.CylinderGeometry(.55,.55,.9,24),'#d7a060',4,1.72,-3.5);mesh(new T.CylinderGeometry(.56,.56,.05,24),'#f2ddb9',4,2.2,-3.5);
 const rug=mesh(new T.CylinderGeometry(5.8,5.8,.04,64),'#658676',0,-.03,1);rug.scale.z=.55;
 const pet=new T.Group();pet.position.set(0,.05,.7);pet.rotation.y=petId==='whale'?-Math.PI/4:-Math.PI/2;s.world.add(pet);host.dataset.asset='loading';loadAsset(petId==='whale'?['/assets/plush-v2/whale.glb']:petId==='dachshund'?['/assets/plush-v2/dachshund.glb']:petURLs,pet,3.8,host,()=>disposed);

 // Actual closed sweep from hands over head and under feet, driven by audio time.
 const segments=48,sides=6,vertices=new Float32Array((segments+1)*sides*3),indices=[];
 for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){const a=i*sides+j,b=i*sides+(j+1)%sides,c=a+sides,d=b+sides;indices.push(a,b,c,b,d,c);}
 const ropeGeometry=new T.BufferGeometry();ropeGeometry.setAttribute('position',new T.BufferAttribute(vertices,3));ropeGeometry.setIndex(indices);
 const rope=new T.Mesh(ropeGeometry,new T.MeshStandardMaterial({color:'#ed905d',roughness:.65,emissive:'#6f3815',emissiveIntensity:.2}));rope.frustumCulled=false;s.world.add(rope);
 const handles=[];for(const x of [-3.65,3.65]){const h=mesh(new T.CylinderGeometry(.065,.065,.42,12),'#eedcb0',x,2.05,.7);h.rotation.x=Math.PI/2;handles.push(h);}
 const villagers=[];
 function limb(from,to,color,r=.11,parent=s.world){const dir=to.clone().sub(from),m=mesh(new T.CylinderGeometry(r,r,dir.length(),12),color,0,0,0,parent);m.position.copy(from).add(to).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),dir.normalize());return m;}
 for(const side of [-1,1]){const x=side*4.75,skin=side<0?'#edc7a2':'#d9aa86',shirt=side<0?'#789e89':'#c8906f';const body=new T.Group();body.position.set(x,0,.7);body.rotation.y=-side*Math.PI/2;s.world.add(body);
  mesh(new T.CapsuleGeometry(.34,.7,6,16),shirt,0,1.4,0,body);mesh(new T.SphereGeometry(.4,20,16),skin,0,2.38,0,body);
  const hair=mesh(new T.SphereGeometry(.415,20,16,0,Math.PI*2,0,Math.PI*.52),'#634631',0,2.4,0,body);hair.rotation.z=side*.12;
  mesh(new T.CylinderGeometry(.43,.43,.15,24),side<0?'#dbc690':'#89a39e',0,2.72,0,body);mesh(new T.CylinderGeometry(.48,.48,.055,24),side<0?'#dbc690':'#89a39e',0,2.64,.045,body);
  for(const eye of [-.13,.13])mesh(new T.SphereGeometry(.045,10,8),'#382b24',eye,2.42,.365,body);
  for(const cheek of [-.23,.23]){const c=mesh(new T.SphereGeometry(.065,12,8),'#df998b',cheek,2.27,.32,body);c.scale.z=.4;}
  const smile=mesh(new T.TorusGeometry(.10,.018,6,16,Math.PI),'#634631',0,2.26,.38,body);smile.rotation.z=Math.PI;
  for(const leg of [-.16,.16]){mesh(new T.CapsuleGeometry(.12,.55,5,12),'#536c7e',leg,.65,0,body);const shoe=mesh(new T.SphereGeometry(.16,12,8),'#725442',leg,.16,.1,body);shoe.scale.set(1,.6,1.5);}
  // One active arm per holder; the other rests beside the torso.
  const shoulder=new T.Vector3(side*.34,1.78,0),elbow=new T.Vector3(side*.30,1.80,.56),grip=new T.Vector3(0,2.05,1.1);
  const upper=limb(shoulder,elbow,shirt,.125,body),forearm=limb(elbow,grip,skin,.09,body);
  const joint=mesh(new T.SphereGeometry(.105,12,10),skin,elbow.x,elbow.y,elbow.z,body);
  const hand=mesh(new T.SphereGeometry(.13,16,12),skin,grip.x,grip.y,grip.z,body);hand.scale.set(.75,.85,1.1);
  limb(new T.Vector3(-side*.36,1.76,0),new T.Vector3(-side*.43,1.02,.04),shirt,.11,body);
  mesh(new T.SphereGeometry(.12,12,10),skin,-side*.43,.96,.04,body);
  mesh(new T.SphereGeometry(.085,12,10),skin,0,2.33,.4,body);
  const collar=mesh(new T.TorusGeometry(.18,.04,8,20),'#f4e5ca',0,1.98,.08,body);collar.rotation.x=Math.PI/2;
  for(const y of [1.65,1.4])mesh(new T.SphereGeometry(.027,8,8),'#d4be92',0,y,.34,body);
  villagers.push({body,side,shoulder,elbow,grip,upper,forearm,joint,hand});
 }
 const landingRing=mesh(new T.TorusGeometry(.65,.035,8,48),'#ffe3a0',0,.065,.7);landingRing.rotation.x=-Math.PI/2;landingRing.visible=false;
 const shadow=mesh(new T.CircleGeometry(.72,40),'#3a5a4a',0,.048,.7);shadow.rotation.x=-Math.PI/2;shadow.material.transparent=true;shadow.material.opacity=.25;
 const particles=[];for(let i=0;i<10;i++){const p=mesh(new T.SphereGeometry(.04,8,6),'#ffdf79',0,.1,.7);p.visible=false;particles.push(p);}
 const center=u=>new T.Vector3(...ropePoint(u,ropeAngle));let ropeAngle=1.3;
 function sweep(angle){ropeAngle=angle;for(let i=0;i<=segments;i++){const u=i/segments*Math.PI,p=center(u),tangent=new T.Vector3(3.65*Math.sin(u),-1.89*Math.cos(u)*Math.cos(angle),1.89*Math.cos(u)*Math.sin(angle)).normalize();const normal=new T.Vector3().crossVectors(tangent,Math.abs(tangent.y)<.9?new T.Vector3(0,1,0):new T.Vector3(0,0,1)).normalize(),side=new T.Vector3().crossVectors(tangent,normal).normalize();for(let j=0;j<sides;j++){const a=j/sides*Math.PI*2,v=p.clone().addScaledVector(normal,Math.cos(a)*.07).addScaledVector(side,Math.sin(a)*.07);const k=(i*sides+j)*3;vertices[k]=v.x;vertices[k+1]=v.y;vertices[k+2]=v.z;}}ropeGeometry.attributes.position.needsUpdate=true;ropeGeometry.computeVertexNormals();}
 const beatLights=[];for(let i=0;i<8;i++){const x=-3.5+i;const ring=mesh(new T.TorusGeometry(.24,.055,8,32),'#dfbd85',x,.04,2.4);ring.rotation.x=-Math.PI/2;beatLights.push(ring);}
 const lantern=new T.PointLight('#ffcb80',20,10);lantern.position.set(4,3,-2);s.world.add(lantern);
 s.camera.position.set(0,3.8,11.4);s.camera.lookAt(0,1.05,-1.5);
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 let plannedOnsets=null,plannedDelay=0,getElapsed=null;
 function angleAt(t){return plannedOnsets?plannedRopeAngle(t,bpm,plannedOnsets):ropeAngleAt(t,bpm);}
 function animate(ms){if(disposed)return;const wall=ms/1000,elapsed=['running','counting'].includes(phase)&&getElapsed?getElapsed():gameTime,age=elapsed-lastJump,impact=elapsed-contactAt;const airborne=jumpHeight(age,bpm),stumble=!contactHit&&impact>=0&&impact<.45;
  pet.position.x=0;pet.position.y=.05+airborne*(stumble?Math.max(0,1-impact/.12):1);pet.rotation.z=!reduced&&stumble?Math.sin(Math.min(1,impact/.45)*Math.PI)*.28:0;
  const takeoff=age>=0&&age<.07,landing=age>=ropeTiming(bpm).jumpDuration&&age<ropeTiming(bpm).jumpDuration+.12;const squash=takeoff?.12*(1-age/.07):landing?.12*(1-(age-ropeTiming(bpm).jumpDuration)/.12):0;pet.scale.set(1+squash*.4,1-squash,1+squash*.4);
  shadow.scale.setScalar(1+airborne*.22);shadow.material.opacity=.25-airborne*.08;
  if(!reduced){gear.rotation.z=wall*.14;rotor.rotation.z=wall*.12;villagers.forEach(v=>{const angle=['running','counting'].includes(phase)?angleAt(elapsed):plannedOnsets?plannedRopeAngle(-10,bpm,plannedOnsets):1.3;
   v.elbow.y=1.80+Math.sin(angle)*.12;v.elbow.z=.56+Math.cos(angle)*.10;
   for(const [bone,from,to] of [[v.upper,v.shoulder,v.elbow],[v.forearm,v.elbow,v.grip]]){const dir=to.clone().sub(from);bone.position.copy(from).add(to).multiplyScalar(.5);bone.scale.y=dir.length()/bone.geometry.parameters.height;bone.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),dir.normalize());}
   v.joint.position.copy(v.elbow);v.hand.rotation.z=angle;});}
  let angle=['running','counting'].includes(phase)?angleAt(elapsed):plannedOnsets?plannedRopeAngle(-10,bpm,plannedOnsets):1.3;sweep(angle);
  if(stumble){const positions=ropeGeometry.attributes.position;for(let i=0;i<positions.count;i++){const x=positions.getX(i);if(Math.abs(x)<1.5)positions.setY(i,Math.max(.16,positions.getY(i))+.14*(1-impact/.45));}positions.needsUpdate=true;ropeGeometry.computeVertexNormals();}
  const flash=impact>=0&&impact<.35;rope.material.color.set(flash?(contactHit?'#e4bb54':'#dc7663'):'#ed905d');rope.material.emissive.set(flash?(contactHit?'#5d470a':'#582015'):'#6f3815');rope.material.emissiveIntensity=flash?.6:.2;
  landingRing.visible=!reduced&&impact>=0&&impact<.5;landingRing.material.color.set(contactHit?'#ffe3a0':'#e8a295');landingRing.scale.setScalar(1+Math.max(0,impact)*2);
  particles.forEach((p,i)=>{p.visible=!reduced&&contactHit&&impact>=0&&impact<.5;if(p.visible){const a=i*Math.PI/5;p.position.set(Math.cos(a)*impact*2.5,.2+Math.sin(Math.PI*impact/.5)*.5,.7+Math.sin(a)*impact*1.2);}});
  host.dataset.ropePhase=angle.toFixed(2);host.dataset.jumpHeight=pet.position.y.toFixed(2);host.dataset.ropeFloor='0.16';host.dataset.ropeMidHeight=ropePoint(Math.PI/2,angle)[1].toFixed(2);host.dataset.contact=flash?(contactHit?'clear':'trip'):'none';s.renderer.render(s.world,s.camera);frame=requestAnimationFrame(animate);
 }
 frame=requestAnimationFrame(animate);
 return {ready,update(next){getElapsed=next.getElapsed??getElapsed;plannedOnsets=next.onsets??plannedOnsets;plannedDelay=next.crossingDelay??plannedDelay;phase=next.phase??phase;gameTime=next.elapsed??gameTime;bpm=next.bpm??bpm;lastUpdate=performance.now();if(next.beat!==undefined)beatLights.forEach((r,i)=>r.material.color.set(i===next.beat%8?(next.clap?'#ffe28b':'#b8c8ce'):'#dfbd85'));},hit(next){lastJump=next.elapsed;accepted=next.accepted;},contact(next){contactAt=next.elapsed;contactHit=next.accepted;},reset(){lastJump=-Infinity;contactAt=-Infinity;accepted=true;phase='ready';gameTime=0;},dispose(){disposed=true;resolveReady();cancelAnimationFrame(frame);s.dispose();}};
}
