// Isolated UI check: no live users, provider requests, or shared Sheet writes.
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve(new URL('..',import.meta.url).pathname);
const server=createServer(async(req,res)=>{try{const path=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!path.startsWith(root+'/'))throw Error();res.setHeader('Content-Type',extname(path)==='.js'?'text/javascript':extname(path)==='.css'?'text/css':'text/html');res.end(await readFile(path));}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.MC_BROWSER_EXECUTABLE?{executablePath:process.env.MC_BROWSER_EXECUTABLE}:{})});
 for(const width of [390,1366]){
  const context=await browser.newContext({viewport:{width,height:844}});
  await context.addInitScript(()=>{window.Clerk={isSignedIn:true,user:{id:'synthetic'},session:{id:'session'},addListener(){}};});
  await context.route('**/auth-ui.js',route=>route.fulfill({contentType:'text/javascript',body:"window.addEventListener('DOMContentLoaded',()=>{document.getElementById('mcAuthGate').style.display='none';window.dispatchEvent(new Event('mc-authenticated'));});"}));
  let denied=false;let version=7;const groceries=Array.from({length:40},(_,i)=>({item:'Synthetic item '+i,qty:'1',done:false}));
  await context.route('**/api/v1/member',async route=>{const request=route.request().postDataJSON();if(request.operation!=='dashboard'){version++;groceries[0].qty='2';await route.fulfill({status:409,json:{ok:false,code:'MEMBER_MEALS_CONFLICT'}});return;}if(denied){await route.fulfill({status:403,json:{ok:false,code:'MEMBERSHIP_INACTIVE_OR_MISSING'}});return;}await route.fulfill({json:{ok:true,dashboard:{profile:{preferences:{step:6,startView:'meals'}},sections:{meals:'available'},capabilities:{mealsEdit:true},meals:{version,weekStart:'2026-10-12',days:[{date:'2026-10-12',meal:'Synthetic dinner',prep:''}],groceryList:groceries},family:[]}}});});
  const page=await context.newPage();await page.goto('http://127.0.0.1:'+server.address().port+'/member.html');
  const edit=page.getByRole('button',{name:'Edit grocery list',exact:true});await edit.waitFor();assert.ok((await edit.boundingBox()).y<(await page.getByRole('heading',{name:'Approved meal plan'}).boundingBox()).y);
  await edit.click();const quantity=page.locator('#mealEditRows input[name=qty]').first();await quantity.fill('9');
  await page.locator('#mealEditRows .card').nth(20).scrollIntoViewIfNeeded();const save=page.getByRole('button',{name:'Save changes',exact:true});let box=await save.boundingBox();assert.ok(box.y>=0&&box.y+box.height<=844,'Save remains on screen midway through a long list');
  const before=await page.evaluate(()=>scrollY);await page.evaluate(()=>document.getElementById('refresh').click());await page.waitForFunction(()=>!document.getElementById('refresh').disabled);assert.equal(await quantity.inputValue(),'9');assert.equal(await page.evaluate(()=>scrollY),before);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await save.click();await page.waitForFunction(()=>document.getElementById('mealEditShared').textContent.includes('Currently shared:'));await page.locator('#mealEditShared').waitFor({state:'visible'});assert.match(await page.locator('#mealEditShared').textContent(),/Synthetic item 0 · 2/);assert.doesNotMatch(await page.locator('#mealEditShared').textContent(),/[{}]|Latest shared version/);assert.equal(await quantity.inputValue(),'9');assert.equal(await save.isDisabled(),true);
  denied=true;await page.evaluate(()=>document.getElementById('refresh').click());await page.waitForFunction(()=>document.getElementById('mealEditor').hidden);assert.equal(await page.locator('#mealEditRows input').count(),0);
  await context.close();console.log('Member editing, refresh, conflict, and denial UI passed at width '+width);
 }
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
