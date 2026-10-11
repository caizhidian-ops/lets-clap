import test from 'node:test';
import assert from 'node:assert/strict';
const base=process.env.BASE_URL||'http://127.0.0.1:5173';
test('本地服务状态、服务端守卫、私密文件和跨站请求',async t=>{
  if(!process.env.BOBO_INTEGRATION){t.skip('需启动服务并设置 BOBO_INTEGRATION=1');return;}
  const r=await fetch(base+'/api/state'),cookie=r.headers.get('set-cookie').split(';')[0],state=await r.json();
  assert.equal(state.state,'HATCH_SELECT');
  const config=await fetch(base+'/api/config',{headers:{cookie}}).then(r=>r.json());
  const page=await fetch(base+'/');assert.match(page.headers.get('content-security-policy'),/img-src[^;]*blob:/);assert.match(page.headers.get('content-security-policy'),/connect-src[^;]*blob:/);
  assert.equal(config.kb.items.length,57);assert.ok(!JSON.stringify(config).includes('DASHSCOPE_API_KEY'));
  assert.equal((await fetch(base+'/.env')).status,404);
  assert.equal((await fetch(base+'/server/index.js')).status,404);
  const illegal=await fetch(base+'/api/action',{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify({action:'start_challenge',sceneVersion:0,turnId:'x'})});
  assert.equal(illegal.status,400);
  const cross=await fetch(base+'/api/action',{method:'POST',headers:{cookie,Origin:'https://unrelated.example','Content-Type':'application/json'},body:'{}'});
  assert.equal(cross.status,403);
});
