// Short fine pile for the live preview. GLBs retain their portable baked textures.
import * as T from './game/vendor/three.module.js';
export function addFinePile(root){
 root.updateMatrixWorld(true);
 const originals=[];root.traverse(o=>{if(o.isMesh&&o.geometry.attributes.normal&&o.geometry.attributes.uv)originals.push(o)});
 for(const mesh of originals){
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  // Reduce oily highlights and oversized texture bumps on the textile body.
  for(const material of materials){material.roughness=Math.max(material.roughness,.9);material.metalness=0;material.normalScale?.set(.15,.15)}
  mesh.geometry.computeBoundingBox();const extent=mesh.geometry.boundingBox.getSize(new T.Vector3());const nap=Math.max(extent.x,extent.y,extent.z)*.009;
  for(let layer=1;layer<=12;layer++){
   const fraction=layer/12;
   const shells=materials.map(source=>{const material=source.clone();material.onBeforeCompile=shader=>{
    shader.uniforms.pileOffset={value:nap*fraction};shader.uniforms.pileLayer={value:fraction};
    shader.vertexShader='uniform float pileOffset; varying vec2 pileUv;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n transformed += normal * pileOffset; pileUv = uv;');
    shader.fragmentShader='uniform float pileLayer; varying vec2 pileUv;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
     vec2 fiberCell = floor(pileUv * 950.0);
     float strand = fract(sin(dot(fiberCell,vec2(127.1,311.7)))*43758.5453);
     vec2 fiberLocal = fract(pileUv * 950.0)-.5;
     if(strand < .58 || strand < pileLayer*.95 || dot(fiberLocal,fiberLocal) > .13*(1.0-pileLayer*.6)) discard;
     diffuseColor.rgb *= .95 + .05*pileLayer;`);
   };material.customProgramCacheKey=()=>`fine-pile-${layer}`;return material});
   const shell=new T.Mesh(mesh.geometry,Array.isArray(mesh.material)?shells:shells[0]);shell.position.copy(mesh.position);shell.quaternion.copy(mesh.quaternion);shell.scale.copy(mesh.scale);shell.renderOrder=layer;mesh.parent.add(shell);
  }
 }
}
