// Synthetic offline browser contract: no live Clerk, provider or Sheet requests.
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve(new URL('..',import.meta.url).pathname);
const server=createServer(async(req,res)=>{
 try{const path=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!path.startsWith(root+'/'))throw Error();const bytes=await readFile(path);res.setHeader('Content-Type',extname(path)==='.js'?'text/javascript':extname(path)==='.css'?'text/css':'text/html');res.end(bytes);}catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext();await context.addInitScript(()=>{window.Clerk={isSignedIn:true,user:{id:'synthetic'},session:{id:'session'},listeners:[],addListener(fn){this.listeners.push(fn);fn();}};});
 await context.route('**/auth-ui.js',route=>route.fulfill({contentType:'text/javascript',body:"window.addEventListener('DOMContentLoaded',()=>{document.getElementById('mcAuthGate').style.display='none';window.dispatchEvent(new Event('mc-authenticated'));});"}));
 const calls=[];let version=3,connected=true,selected=[],lost=false,personalReply=null;
 await context.route('**/api/v1/member',async route=>{
  const body=route.request().postDataJSON();calls.push(body);let value;
  const connection=()=>({provider:'google',version,connected,accountLabel:connected?'synthetic@example.com':null,calendars:selected,configured:true});
  if(body.operation==='connections')value={ok:true,connections:[connection(),{provider:'microsoft',version:0,connected:false,accountLabel:null,calendars:[],configured:false}]};
  else if(body.operation==='list_calendars')value={ok:true,connection:connection(),calendars:Array.from({length:6},(_,i)=>({id:'calendar-'+i,label:'Calendar '+i}))};
  else if(body.operation==='select_calendars'){selected=body.calendarIds.map(id=>({id,label:'Calendar '+id.split('-')[1]}));version++;value={ok:true,connection:connection()};}
  else if(body.operation==='disconnect_calendar'){connected=false;selected=[];version++;if(lost){await route.fulfill({status:503,json:{ok:false,code:'PERSONAL_CONNECTIONS_OUTCOME_UNKNOWN'}});return;}value={ok:true,connection:connection()};}
  else if(body.operation==='complete_connection'){connected=true;version++;value={ok:true,connection:connection()};}
  else if(body.operation==='dashboard')value={ok:true,dashboard:{profile:{preferences:{step:6,startView:'schedule',timeZone:'America/Chicago'}},sections:{budget:'missing',meals:'missing',family:'missing'},capabilities:{personalSchedule:true},family:[]}};
  else if(body.operation==='personal_schedule'){if(personalReply)await personalReply;value={ok:true,schedule:[{id:'event',title:'Synthetic pickup',start:'2026-10-06T20:00:00Z',end:'2026-10-06T21:00:00Z',allDay:false,calendarLabel:'Personal'},{id:'day',title:'Synthetic holiday',start:'2026-10-06',end:'2026-10-08',allDay:true,calendarLabel:'Personal'}]};}
  else throw Error('Unexpected browser operation');
  await route.fulfill({json:value});
 });
 const page=await context.newPage();await page.goto(origin+'/personal-connect.html?code=synthetic-code&state=synthetic-state');await page.getByRole('button',{name:'Choose calendars'}).waitFor();assert.equal(new URL(page.url()).search,'');assert.equal(calls.filter(c=>c.operation==='complete_connection').length,1);
 await page.getByRole('button',{name:'Choose calendars'}).click();await page.getByRole('button',{name:'Save calendar choices'}).waitFor();
 for(const input of await page.locator('input[type=checkbox]').all())await input.check();await page.getByRole('button',{name:'Save calendar choices'}).click();await page.getByText('Choose up to five calendars.',{exact:true}).waitFor();assert.equal(calls.filter(c=>c.operation==='select_calendars').length,0);
 await page.locator('input[type=checkbox]').last().uncheck();await page.getByRole('button',{name:'Save calendar choices'}).click();await page.getByRole('button',{name:'Choose calendars'}).waitFor();assert.equal(calls.find(c=>c.operation==='select_calendars').calendarIds.length,5);
 lost=true;await page.getByRole('button',{name:'Disconnect',exact:true}).click();await page.getByText('The last change could not be confirmed. Refresh connections before making another change.').waitFor();assert.equal(await page.getByRole('button',{name:'Disconnect',exact:true}).count(),0);
 await page.getByRole('button',{name:'Refresh connections'}).click();await page.getByText('No account connected.',{exact:true}).first().waitFor();assert.equal(calls.filter(c=>c.operation==='disconnect_calendar').length,1);
 await page.goto(origin+'/member.html');await page.getByText('Synthetic pickup',{exact:true}).waitFor();await page.getByText('2026-10-06 · All day · through 2026-10-07',{exact:true}).waitFor();assert.match(await page.locator('#personalSchedule').innerText(),/3:00 PM/);
 await page.evaluate(()=>{window.Clerk.isSignedIn=false;window.dispatchEvent(new Event('mc-signed-out'));});assert.equal(await page.getByText('Synthetic pickup',{exact:true}).count(),0);
 let release;personalReply=new Promise(resolve=>{release=resolve;});await page.reload();await page.getByText('Reading your selected calendars…',{exact:true}).waitFor();await page.evaluate(()=>{window.Clerk.isSignedIn=false;window.dispatchEvent(new Event('mc-signed-out'));});release();await page.waitForTimeout(100);assert.equal(await page.getByText('Synthetic pickup',{exact:true}).count(),0);
 await context.close();console.log('Offline browser checks passed: callback cleanup, calendar selection, uncertain disconnect, timezone rendering and sign-out response isolation.');
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
