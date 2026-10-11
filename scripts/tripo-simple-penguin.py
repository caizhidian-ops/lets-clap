"""One explicitly authorized Tripo penguin experiment, with durable submission guard."""
import hashlib
import json
import os
import pathlib
import struct
import sys
import time
import urllib.request

BASE = pathlib.Path(__file__).resolve().parents[1]
JOBS = BASE / '.asset-jobs/simple-penguin'
ASSETS = BASE / 'public/assets/simple-penguin'
JOBS.mkdir(parents=True, exist_ok=True)
ASSETS.mkdir(parents=True, exist_ok=True)
KEY = pathlib.Path('/Users/user/.config/history3d/tripo.key').read_text().strip()
OPENER = urllib.request.build_opener(urllib.request.ProxyHandler(
    {'https': os.environ['TRIPO_PROXY']} if os.environ.get('TRIPO_PROXY') else {}))
PROMPT = ('An adorable simple stylized cartoon baby penguin for a cheerful rhythm game. '
          'Strong recognizable penguin silhouette: one plump rounded egg-shaped body with a small rounded head, '
          'charcoal black back and crown, a clean large white face patch and white belly, tiny glossy black eyes, '
          'small bright orange triangular beak, and two short rounded orange feet. '
          'Two tiny stubby flippers held gently away from the body. Large friendly face, chubby proportions, '
          'soft rounded contours, charming calm happy expression. Smooth matte clay-like surfaces, '
          'flat clean color blocks, minimal detail, no fur and no feathers. '
          'Upright neutral standing pose, full body, complete on all sides. '
          'Original generic penguin character, no clothing, props, text, logo, background, ground, or pedestal.')


def save(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2))


def api(method, path, body=None):
    endpoint = os.environ.get('TRIPO_API_BASE', 'https://openapi.tripo3d.ai/v3') + path
    if method == 'GET' and path.startswith('/tasks/') and os.environ.get('TRIPO_LEGACY_QUERY') == '1':
        endpoint = 'https://api.tripo3d.ai/v2/openapi/task/' + path.split('/')[-1]
    request = urllib.request.Request(endpoint, data=json.dumps(body).encode() if body else None,
        method=method, headers={'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json'})
    with OPENER.open(request, timeout=60) as response:
        result = json.load(response)
    if result.get('code') != 0:
        raise RuntimeError('Provider rejected code ' + str(result.get('code')))
    return result['data']


command = sys.argv[1]
if command == 'create':
    if (JOBS / 'task.json').exists():
        print('Already submitted; poll existing task')
        sys.exit(0)
    if (JOBS / 'intent').exists():
        raise RuntimeError('Unknown submission outcome; never retry create')
    balance = api('GET', '/account/balance')
    save(JOBS / 'balance-before.json', balance)
    available = balance.get('balance', balance.get('available_balance'))
    print('balance', json.dumps(balance), flush=True)
    if available is None or float(available) < 20:
        raise RuntimeError('Unverified or insufficient balance')
    body = {'prompt': PROMPT, 'negative_prompt': 'realistic, photorealistic, fur, plush fibers, feathers, scales, wrinkles, spiky geometry, skinny body, humanoid, clothing, accessories, text, logo, pedestal',
            'model': 'v3.1-20260211', 'texture': True, 'pbr': True, 'face_limit': 15000,
            'texture_quality': 'standard', 'geometry_quality': 'standard'}
    assert len(PROMPT) <= 1024
    save(JOBS / 'request.json', body)
    (JOBS / 'intent').write_text('Single authorized submission ' + str(time.time()))
    task = api('POST', '/generation/text-to-model', body)
    save(JOBS / 'task.json', task)
    print('task', task['task_id'], flush=True)
elif command == 'poll':
    task_id = json.loads((JOBS / 'task.json').read_text())['task_id']
    data = api('GET', '/tasks/' + task_id)
    save(JOBS / 'status.json', data)
    print(data.get('status'), data.get('progress'), 'credits', data.get('credits_consumed', data.get('consumed_credit')), flush=True)
    if data.get('status') == 'success':
        output = data['output']
        model_path = ASSETS / 'penguin.glb'
        if not model_path.exists():
            url = output.get('model_url') or output.get('pbr_model') or output.get('model')
            with OPENER.open(url, timeout=90) as response:
                raw = response.read()
            if raw[:4] != b'glTF' or struct.unpack_from('<I', raw, 8)[0] != len(raw):
                raise RuntimeError('Invalid GLB')
            model_path.write_bytes(raw)
        raw = model_path.read_bytes()
        gltf = json.loads(raw[20:20 + struct.unpack_from('<I', raw, 12)[0]])
        save(ASSETS / 'penguin.json', {'provider': 'Tripo', 'taskId': task_id, 'prompt': PROMPT,
             'source': 'original text-to-model; no reference uploaded', 'sha256': hashlib.sha256(raw).hexdigest(),
             'bytes': len(raw), 'creditsConsumed': data.get('credits_consumed', data.get('consumed_credit')),
             'meshes': len(gltf.get('meshes', [])), 'materials': len(gltf.get('materials', [])),
             'images': len(gltf.get('images', [])), 'animations': len(gltf.get('animations', []))})
        save(JOBS / 'balance-after.json', api('GET', '/account/balance'))
        print('downloaded', len(raw), 'sha256', hashlib.sha256(raw).hexdigest(), flush=True)
