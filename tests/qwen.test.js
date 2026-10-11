// Local protocol double. No fake output is used in the application.
import test from 'node:test';
import assert from 'node:assert/strict';
import {WebSocketServer} from 'ws';
import http from 'node:http';
import {qwenRequest,checkConnection} from '../server/realtimeProxy/qwen.js';
import {Game} from '../src/app/fsm.js';
test('模拟千问协议：tool → 服务端 FSM → 工具结果回传',async t=>{
  if(!process.env.BOBO_INTEGRATION){t.skip('需允许本地测试端口并设置 BOBO_INTEGRATION=1');return;}
  const server=new WebSocketServer({port:0,host:'127.0.0.1'});await new Promise(r=>server.once('listening',r));
  const game=new Game({hatched:true});let outputResolve;
  const returned=new Promise(r=>outputResolve=r);
  server.on('connection',ws=>{
    const send=e=>ws.send(JSON.stringify(e));send({type:'session.created'});
    ws.on('message',raw=>{
      const e=JSON.parse(raw);
      if(e.type==='session.update'){assert.equal(e.session.turn_detection,null);assert.equal(e.session.audio.input.format.sample_rate,16000);send({type:'session.updated'});}
      if(e.type==='response.create'){
        send({type:'response.function_call_arguments.done',call_id:'fixture-call',name:'game_intent',arguments:'{"action":"enter_adventure"}'});
        send({type:'response.done'});
      }
      if(e.type==='conversation.item.create'&&e.item.type==='function_call_output')outputResolve(JSON.parse(e.item.output));
    });
  });
  try{
    const r=await qwenRequest({text:'我们去探险吧',tools:[],validateTool:call=>{const args=JSON.parse(call.arguments);return {ok:true,...game.act(args.action,{turnId:call.callId})};}},{enabled:true,key:'TEST_FIXTURE_KEY',url:'ws://127.0.0.1:'+server.address().port});
    assert.equal(game.state,'ADVENTURE_INTRO');assert.equal(r.toolResults[0].state,'ADVENTURE_INTRO');
    assert.equal((await returned).state,'ADVENTURE_INTRO');
  }finally{await new Promise(r=>server.close(r));}
});
test('启动连接检查：401 明确失败，真实会话事件才判连接成功',async t=>{
  if(!process.env.BOBO_INTEGRATION){t.skip('需本地测试端口');return;}
  const denied=http.createServer();denied.on('upgrade',(_,socket)=>socket.end('HTTP/1.1 401 Unauthorized\r\nContent-Length: 0\r\n\r\n'));
  await new Promise(r=>denied.listen(0,'127.0.0.1',r));
  try{
    const result=await checkConnection({enabled:true,key:'TEST',url:'ws://127.0.0.1:'+denied.address().port});
    assert.equal(result.ok,false);assert.match(result.reason,/401/);
  }finally{await new Promise(r=>denied.close(r));}
  const accepted=new WebSocketServer({port:0,host:'127.0.0.1'});await new Promise(r=>accepted.once('listening',r));
  accepted.on('connection',ws=>ws.send(JSON.stringify({type:'session.created'})));
  try{assert.equal((await checkConnection({enabled:true,key:'TEST',url:'ws://127.0.0.1:'+accepted.address().port})).ok,true);}
  finally{await new Promise(r=>accepted.close(r));}
});
test('模拟千问协议：超时和取消可回退',async t=>{
  if(!process.env.BOBO_INTEGRATION){t.skip('需本地测试端口');return;}
  const server=new WebSocketServer({port:0,host:'127.0.0.1'});await new Promise(r=>server.once('listening',r));
  try{
    const config={enabled:true,key:'TEST',url:'ws://127.0.0.1:'+server.address().port};
    await assert.rejects(qwenRequest({text:'timeout',timeoutMs:50},config),/超时/);
    const controller=new AbortController(),request=qwenRequest({text:'cancel',signal:controller.signal},config);
    setTimeout(()=>controller.abort(),20);await assert.rejects(request,/取消/);
  }finally{for(const s of server.clients)s.terminate();await new Promise(r=>server.close(r));}
});
