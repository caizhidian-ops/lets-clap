import os,json,pathlib,urllib.request,hashlib,sys,struct,time
base=pathlib.Path(__file__).resolve().parents[1];jobs=base/'.asset-jobs/plush-v2';assets=base/'public/assets/plush-v2';jobs.mkdir(parents=True,exist_ok=True)
key=pathlib.Path('/Users/user/.config/history3d/tripo.key').read_text().strip()
opener=urllib.request.build_opener(urllib.request.ProxyHandler({'https':os.environ['TRIPO_PROXY']} if os.environ.get('TRIPO_PROXY') else {}))
prompts={
'whale': 'A recognizable baby whale stuffed toy, plump horizontal oval body, rounded forehead, tiny lateral flippers and a short broad two-lobed tail pointing upward. Dusty periwinkle blue back, warm ivory lower belly. Two little black bead eyes and a small stitched smile. Keep natural whale anatomy, no legs, no arms, no horns. Soft dense fine velour fabric, uniform 2mm short pile lying in one direction, silky microfibers, subtle cloth seams, gently padded contours, a clean continuous smooth silhouette. Surface looks like brushed velvet NOT sculpted clumps; fine fur is in texture and shading, no bumpy wool geometry. Full body in a relaxed resting pose, finished all sides. A generic animal plush character with its own palette and proportions, no brand logo, text, accessory, ground or pedestal.',
'penguin': 'A recognizable baby penguin stuffed toy, very plump oval body and small round head, two short flippers gently spread sideways, tiny rounded dark feet and a small soft triangular orange beak. Warm charcoal gray crown and back, ivory face and broad ivory belly, tiny dark bead eyes, cheerful gentle expression. Natural penguin silhouette, no antennae, hats or fantasy parts. Dense fine brushed short-pile velour fabric, silky soft 2mm fibers, smooth padded rounded surface and delicate seams. Continuous clean silhouette, fine directional fur represented in texture NOT thick wool lumps, scales, feathers or sculpted spikes. Upright full body, finished all sides. Generic animal plush with distinct rounded face patch and muted palette, no logo, text, accessories, background, ground or pedestal.',
'dachshund': 'A recognizable dachshund puppy stuffed toy, long chubby sausage body, four very short rounded paws, floppy oval ears, gently rounded muzzle and short raised tail. Warm cinnamon brown body with oat-cream muzzle, belly and paws, small dark bead eyes and tiny chocolate nose. Cute calm friendly face, natural dog anatomy. Sideways standing pose with head slightly turned, full body and all four legs visible, finished on all sides. Dense soft fine velour short-pile plush cloth, silky uniform 2mm nap brushed smoothly, softly padded continuous contours and subtle seams. Fur is fine texture NOT sculpted curly lumps, scales or spikes. Generic dachshund animal toy with its own color pattern and plump proportions. No clothing, collar, brand logo, text, scene, base or pedestal.'}
names={'whale':'悠悠 · 小鲸鱼','penguin':'蹦蹦 · 小企鹅','dachshund':'咚咚 · 腊肠狗'}
def api(method,path,body=None):
 endpoint=os.environ.get('TRIPO_API_BASE','https://openapi.tripo3d.ai/v3')+path
 if method=='GET' and path.startswith('/tasks/') and os.environ.get('TRIPO_LEGACY_QUERY')=='1':endpoint='https://api.tripo3d.ai/v2/openapi/task/'+path.split('/')[-1]
 r=urllib.request.Request(endpoint,data=json.dumps(body).encode() if body else None,method=method,headers={'Authorization':'Bearer '+key,'Content-Type':'application/json'})
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
  body={'prompt':prompt,'negative_prompt':'brand logo, letters, fantasy creature, antennae, horns, sculpted fur clumps, curly wool, broccoli texture, rock texture, scales, spikes, plastic, shiny body, pedestal','model':'v3.1-20260211','texture':True,'pbr':True,'face_limit':30000,'texture_quality':'standard','geometry_quality':'standard'}
  assert len(prompt)<=1024
  save(folder/'request.json',body);(folder/'intent').write_text('Single submission '+str(time.time()))
  data=api('POST','/generation/text-to-model',body);save(folder/'task.json',data);print(name,data['task_id'],flush=True)
if command=='poll':
 for name in prompts:
  folder=jobs/name
  if not (folder/'task.json').exists():continue
  task=json.loads((folder/'task.json').read_text())['task_id'];data=api('GET','/tasks/'+task);save(folder/'status.json',data);print(name,data.get('status'),data.get('progress'),data.get('credits_consumed',data.get('consumed_credit')),flush=True)
  if data.get('status')=='success' and not (assets/(name+'.glb')).exists():
   url=data['output'].get('model_url') or data['output'].get('pbr_model') or data['output'].get('model')
   with opener.open(url,timeout=90) as f:raw=f.read()
   if raw[:4]!=b'glTF' or struct.unpack_from('<I',raw,8)[0]!=len(raw):raise RuntimeError('Invalid GLB')
   (assets/(name+'.glb')).write_bytes(raw)
   gltf=json.loads(raw[20:20+struct.unpack_from('<I',raw,12)[0]])
   save(assets/(name+'.json'),{'provider':'Tripo','taskId':task,'name':names[name],'prompt':prompts[name],'source':'original text-to-model; reference photos not uploaded','sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'creditsConsumed':data.get('credits_consumed',data.get('consumed_credit')),'meshes':len(gltf.get('meshes',[])),'materials':len(gltf.get('materials',[])),'images':len(gltf.get('images',[]))})
   print(name,'downloaded',len(raw),flush=True)
