import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--autoplay-policy=document-user-activation-required']});
try{
 const page=await browser.newPage();
 await page.addInitScript(()=>{window.__plays=[];window.__players=[];const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){window.__players.push(this);const entry={src:this.src,result:'pending'};window.__plays.push(entry);const promise=play.call(this);promise.then(()=>entry.result='played',()=>entry.result='blocked');return promise;};});
 await page.goto(process.env.BASE_URL||'http://127.0.0.1:5173');
 await page.waitForFunction(()=>window.__plays.some(e=>e.result==='blocked'));
 await page.getByRole('button',{name:'开始语音对话'}).click();
 await page.waitForFunction(()=>window.__plays.some(e=>e.src.includes('prompt-select')&&e.result==='played'));
 await page.locator('.alternatives').evaluate(n=>n.open=true);
 await page.getByRole('button',{name:/欢快/}).click();
 await page.waitForFunction(()=>window.__plays.some(e=>e.src.includes('prompt-guide')&&e.result==='played'));
 assert.equal(await page.locator('.hatch-art').getAttribute('data-crack'),'0');
 await page.locator('.developer').evaluate(n=>n.open=true);
 await page.getByRole('button',{name:'返回孵化'}).click();
 await page.getByRole('heading',{name:'一位音乐伙伴， 正在等你。'}).waitFor();
 await page.locator('.alternatives').evaluate(n=>n.open=true);
 await page.getByRole('button',{name:/欢快/}).waitFor();
 assert.ok(await page.evaluate(()=>window.__players.filter(n=>n.src.includes('prompt-guide')).every(n=>n.paused)));
 await page.route('**/prompt-guide.wav',r=>r.abort());
 await page.locator('.alternatives').evaluate(n=>n.open=true);
 await page.getByRole('button',{name:/欢快/}).click();
 await page.getByText(/语音讲解未能播放/).waitFor();
 await page.getByRole('textbox',{name:'宠物名字'}).waitFor();
 console.log('PASS autoplay blocked -> tap to listen; cancel during explanation; missing speech explicitly labelled and hatch remains usable');
}finally{await browser.close();}
