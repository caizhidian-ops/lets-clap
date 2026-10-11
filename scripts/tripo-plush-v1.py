import os,json,pathlib,urllib.request,hashlib,sys,struct,time
base=pathlib.Path(__file__).resolve().parents[1];jobs=base/'.asset-jobs/plush-v1';assets=base/'public/assets/plush-v1';jobs.mkdir(parents=True,exist_ok=True)
key=pathlib.Path('/Users/user/.config/history3d/tripo.key').read_text().strip()
opener=urllib.request.build_opener(urllib.request.ProxyHandler({'https':os.environ['TRIPO_PROXY']} if os.environ.get('TRIPO_PROXY') else {}))
prompts={
'dongdong': 'One original fantasy rhythm creature, a very chubby apricot dumpling-shaped plush with a wide pear body, tiny arms held apart and two oversized oval feet. No animal ears: three soft rounded drumstick-shaped tufts rise from its head. Cream oval belly with three terracotta embroidered rhythm dots. Two small glossy black eyes far apart, rosy cheeks, tiny curved smile. Dense soft short-pile faux fur, subtle stitched seams, matte velvety fabric. Standing upright, neutral full body, front facing, all sides finished, game collectible. Simple clean silhouette, no ground, background, pedestal, letters, accessories. An invented music creature, not an animal or existing branded toy.',
'youyou': 'One original fantasy cloud rhythm creature, plump lavender-blue plush, body shaped like a rounded three-lobed cloud with a low wide silhouette. A short thick curled spiral tail visible on its right side, two tiny rounded feet, two mitten hands held slightly apart. No ears, no fins, no beak. Cream crescent-shaped chest patch, two small glossy dark eyes, blush cheeks and a relaxed little smile. Dense fluffy short-pile faux fur with soft fiber surface detail and handmade seams. Full body standing upright, front facing, finished on all sides, cozy game collectible with matte fabric. No ground, pedestal, scenery, text or clothing. Invented cloud creature, not a whale, penguin, dog or existing branded toy.',
'bengbeng': 'One original fantasy wind-sprout creature, a very fat pistachio green plush pebble body, almost spherical, two stubby peach feet, short mitten arms held apart. Two broad soft leaf-shaped antennae bend outward from its top, no animal ears. A small coral spiral embroidery at the center of a pale cream belly. Two small glossy black eyes, blush cheeks, open tiny happy smile. Soft dense short-pile fur, velvety stuffed fabric, subtle seam stitching, warm handmade collectible game character. Full body neutral upright front pose with all sides complete. No ground, base, scenery, text, hat or other objects. Distinct invented plant-music creature, not a recognizable branded toy.'}
names={'dongdong':'咚咚 · 鼓点团子','youyou':'悠悠 · 卷尾云团','bengbeng':'蹦蹦 · 风芽球'}
def api(method,path,body=None):
 r=urllib.request.Request('https://openapi.tripo3d.ai/v3'+path,data=json.dumps(body).encode() if body else None,method=method,headers={'Authorization':'Bearer '+key,'Content-Type':'application/json'})
 with opener.open(r,timeout=60) as f:d=json.load(f)
 if d.get('code')!=0:raise RuntimeError('Provider rejected code '+str(d.get('code')))
 return d['data']
def save(p,d):p.write_text(json.dumps(d,ensure_ascii=False,indent=2))
command=sys.argv[1]
if command=='balance':print(json.dumps(api('GET','/account/balance')))
if command=='create':
 balance=api('GET','/account/balance');save(jobs/'balance-before.json',balance);print('balance',json.dumps(balance),flush=True)
 available=balance.get('balance',balance.get('available_balance'))
 if available is None or float(available)<60:raise RuntimeError('Unverified or insufficient balance')
 for name,prompt in prompts.items():
  folder=jobs/name;folder.mkdir(exist_ok=True)
  if (folder/'task.json').exists():print(name,'already submitted');continue
  if (folder/'intent').exists():raise RuntimeError('Unknown submission; do not retry')
  body={'prompt':prompt,'negative_prompt':'brand logo, letters, whale, penguin, dachshund, teddy bear ears, sharp teeth, scary, long thin limbs, pedestal','model':'v3.1-20260211','texture':True,'pbr':True,'face_limit':30000,'texture_quality':'standard','geometry_quality':'standard'}
  assert len(prompt)<=1024
  save(folder/'request.json',body);(folder/'intent').write_text('Single submission '+str(time.time()))
  data=api('POST','/generation/text-to-model',body);save(folder/'task.json',data);print(name,data['task_id'],flush=True)
if command=='poll':
 for name in prompts:
  folder=jobs/name
  if not (folder/'task.json').exists():continue
  task=json.loads((folder/'task.json').read_text())['task_id'];data=api('GET','/tasks/'+task);save(folder/'status.json',data);print(name,data.get('status'),data.get('progress'),data.get('credits_consumed'),flush=True)
  if data.get('status')=='success' and not (assets/(name+'.glb')).exists():
   url=data['output'].get('model_url') or data['output'].get('pbr_model') or data['output'].get('model')
   with opener.open(url,timeout=90) as f:raw=f.read()
   if raw[:4]!=b'glTF' or struct.unpack_from('<I',raw,8)[0]!=len(raw):raise RuntimeError('Invalid GLB')
   (assets/(name+'.glb')).write_bytes(raw)
   gltf=json.loads(raw[20:20+struct.unpack_from('<I',raw,12)[0]])
   save(assets/(name+'.json'),{'provider':'Tripo','taskId':task,'name':names[name],'prompt':prompts[name],'source':'original text-to-model; reference photos not uploaded','sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'creditsConsumed':data.get('credits_consumed'),'meshes':len(gltf.get('meshes',[])),'materials':len(gltf.get('materials',[])),'images':len(gltf.get('images',[]))})
   print(name,'downloaded',len(raw),flush=True)
