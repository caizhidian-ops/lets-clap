// Scoped browser regression: real prompt WAVs and capture Worklet, fixture API/WS and silent microphone.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:5173';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--autoplay-policy=no-user-gesture-required']});
async function open(initial='HATCH_SELECT'){
  const page=await browser.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let state={state:initial,sceneVersion:1,pet:{name:'波波',personality:'happy'}};
  await page.route('**/api/config',async route=>{
    const response=await route.fetch(),config=await response.json();
    await route.fulfill({json:{...config,aiEnabled:true}});
  });
  await page.route('**/api/init',route=>route.fulfill({json:state}));
  await page.route('**/api/action',route=>{
    const {action,payload}=route.request().postDataJSON();
    const next={rename:'PET_NAMING',confirm_name:'PET_HOME',choose_personality:'HATCH_GUIDE'}[action];
    assert.ok(next,'Unexpected action: '+action);
    state={...state,state:next,sceneVersion:state.sceneVersion+1};
    if(action==='confirm_name')state.pet={...state.pet,name:payload.name};
    return route.fulfill({json:state});
  });
  await page.addInitScript(()=>{
    window.__plays=[];window.__ends=[];window.__mic=0;
    const play=HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play=function(){
      window.__plays.push(this.src);this.playbackRate=8;
      this.addEventListener('ended',()=>window.__ends.push(this.src),{once:true});
      return play.call(this);
    };
    navigator.mediaDevices.getUserMedia=async()=>{
      window.__mic++;
      const ctx=new AudioContext(),destination=ctx.createMediaStreamDestination();
      window.__micContext=ctx;return destination.stream;
    };
    window.WebSocket=class{
      constructor(){this.readyState=1;window.__ws=this;setTimeout(()=>this.onopen?.({}),0);}
      send(data){const e=JSON.parse(data);if(e.type==='begin')setTimeout(()=>this.onmessage?.({data:JSON.stringify({type:'ready',turnId:e.turnId})}),0);}
    };
  });
  await page.goto(base);await page.locator('.voice').waitFor();
  await page.waitForTimeout(200);
  assert.deepEqual(await page.evaluate(()=>[window.__plays.length,window.__mic]),[0,0]);
  return {page,errors};
}
const counts=page=>page.evaluate(()=>[window.__plays.length,window.__mic]);
const finished=page=>page.waitForFunction(()=>window.__ends.length===window.__plays.length&&window.__plays.length>0);
const rerender=async page=>{
  await page.evaluate(()=>window.__ws.onmessage({data:JSON.stringify({type:'state',sceneVersion:1})}));
  await page.waitForTimeout(150);
};
try{
  {
    const {page,errors}=await open();
    await page.locator('h1').click();await finished(page);
    await page.locator('h1').click();assert.deepEqual(await counts(page),[1,0]);
    await page.getByRole('button',{name:'开始语音对话'}).click();
    await page.getByRole('button',{name:'结束说话'}).waitFor();
    assert.deepEqual(await counts(page),[1,1]);
    await rerender(page);assert.deepEqual(await counts(page),[1,1]);
    assert.deepEqual(errors,[]);await page.close();
  }
  {
    const {page,errors}=await open('PET_NAMING');
    await page.getByRole('button',{name:'开始语音对话'}).click();
    await page.getByRole('button',{name:'结束说话'}).waitFor();
    await page.locator('h1').click();assert.deepEqual(await counts(page),[0,1]);
    await page.getByRole('textbox').fill('小蓝');
    await page.getByRole('button',{name:'确认名字'}).click();await finished(page);
    await page.getByRole('button',{name:'结束说话'}).waitFor();
    assert.deepEqual(await counts(page),[1,2]);
    assert.ok((await page.evaluate(()=>window.__plays[0])).includes('prompt-home'));
    assert.deepEqual(errors,[]);await page.close();
  }
  {
    const {page,errors}=await open('PET_NAMING');
    await page.getByRole('textbox').click();await page.getByRole('textbox').fill('小蓝');
    assert.deepEqual(await counts(page),[0,0]);
    await page.getByRole('button',{name:'确认名字'}).click();await finished(page);
    assert.deepEqual(await counts(page),[1,0]);
    assert.ok((await page.evaluate(()=>window.__plays[0])).includes('prompt-home'));
    assert.deepEqual(errors,[]);await page.close();
  }
  {
    const {page,errors}=await open();
    await page.locator('.alternatives summary').click();assert.deepEqual(await counts(page),[0,0]);
    await page.getByRole('button',{name:/欢快/}).click();await finished(page);
    assert.ok((await page.evaluate(()=>window.__plays)).every(src=>src.includes('prompt-guide')));
    assert.deepEqual(await counts(page),[1,0]);
    assert.deepEqual(errors,[]);await page.close();
  }
  {
    const {page,errors}=await open();
    await page.locator('h1').click();
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
    await page.waitForFunction(()=>window.__plays.length===2);await finishedAfterInterruption(page);
    await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForTimeout(150);assert.deepEqual(await counts(page),[2,0]);
    assert.deepEqual(errors,[]);await page.close();
  }
  console.log('PASS: silent boot; background prompt once; microphone only; step guidance and automatic listening; controls skip old prompt; rerenders preserve completed prompts; interrupted prompt retries.');
}finally{await browser.close();}
async function finishedAfterInterruption(page){await page.waitForFunction(()=>window.__ends.length===1);}
