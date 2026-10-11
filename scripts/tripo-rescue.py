import os,json,pathlib,urllib.request,hashlib,sys
base=pathlib.Path(__file__).resolve().parents[1]; jobs=base/'.asset-jobs'; assets=base/'public/assets/rescue'
key=pathlib.Path('/Users/user/Desktop/09_Sideproject/tripo黑客松/History3D-processing/.processing-data/yuezhi-tripo/key').read_text().strip()
opener=urllib.request.build_opener(urllib.request.ProxyHandler({'https':os.environ['TRIPO_PROXY']} if os.environ.get('TRIPO_PROXY') else {}))
def call(method,path,body=None):
 r=urllib.request.Request('https://openapi.tripo3d.ai/v3'+path,data=json.dumps(body).encode() if body else None,method=method,headers={'Authorization':'Bearer '+key,'Content-Type':'application/json'})
 with opener.open(r,timeout=50) as f:d=json.load(f)
 if d.get('code')!=0:raise RuntimeError('Provider rejected request: '+str(d.get('code')))
 return d['data']
prompts={'monster':'A single adorable round golden apricot plush monster for a childrens rhythm rescue game. Two round teddy ears, big shiny friendly eyes, cream belly, short stubby feet and arms, fluffy soft fur, happy brave expression. Standing upright, full body, front facing. Premium handmade collectible toy, pastel colors, matte plush materials, clean sculpted silhouette. No pedestal, scenery, text, hats, other objects.', 'windmill':'One whimsical Dutch windmill building for a childrens fantasy game, premium miniature clay toy. Cream tapered tower, warm coral conical roof, four wooden pastel mint and apricot sails arranged symmetrically, small arched wooden door, rounded blue window, moss trim. Complete freestanding building with all sides detailed. No ground base, landscape, people, text or other buildings. Matte painted wood and clay, warm storybook game asset.'}
command=sys.argv[1]
if command=='create':
 print('balance',json.dumps(call('GET','/account/balance')))
 for name,prompt in prompts.items():
  folder=jobs/name;folder.mkdir(parents=True,exist_ok=True)
  if (folder/'task.json').exists():print(name,'already submitted');continue
  if (folder/'intent').exists():raise RuntimeError('Unknown submission, do not retry')
  body={'prompt':prompt,'model':'v3.1-20260211','texture':True,'pbr':True,'face_limit':20000,'texture_quality':'standard','geometry_quality':'standard'}
  (folder/'request.json').write_text(json.dumps(body));(folder/'intent').write_text('Single submission')
  result=call('POST','/generation/text-to-model',body);(folder/'task.json').write_text(json.dumps(result));print(name,result['task_id'],flush=True)
else:
 for name in prompts:
  folder=jobs/name
  if not (folder/'task.json').exists():continue
  task=json.loads((folder/'task.json').read_text())['task_id'];result=call('GET','/tasks/'+task);(folder/'status.json').write_text(json.dumps(result))
  print(name,result.get('status'),result.get('progress'),result.get('credits_consumed'),flush=True)
  if result.get('status')=='success' and not (assets/(name+'.glb')).exists():
   output=result['output'];url=output.get('model_url') or output.get('pbr_model') or output.get('model')
   with opener.open(url,timeout=90) as f:raw=f.read()
   if raw[:4]!=b'glTF':raise RuntimeError('Not GLB')
   (assets/(name+'.glb')).write_bytes(raw)
   (assets/(name+'.json')).write_text(json.dumps({'provider':'Tripo','taskId':task,'prompt':prompts[name],'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'creditsConsumed':result.get('credits_consumed')},indent=2))
   print(name,'downloaded',len(raw),flush=True)
