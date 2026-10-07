import test from 'node:test';
import assert from 'node:assert/strict';
import {listPersonalCalendars,readPersonalCalendar,exchangePersonalToken} from './personal-provider.js';
const response=body=>new Response(JSON.stringify(body));
test('Google calendar paging minimizes data and follows only its fixed provider endpoint',async()=>{
 const calls=[];const request=async(url,options)=>{calls.push({url,options});return response(calls.length===1?{items:[{id:'one',summary:'Home',description:'SECRET'}],nextPageToken:'next'}:{items:[{id:'two',summary:'Work'}]});};
 assert.deepEqual(await listPersonalCalendars({provider:'google',accessToken:'TOKEN'},{request}),[{id:'one',label:'Home'},{id:'two',label:'Work'}]);assert.equal(calls.length,2);assert.ok(calls.every(c=>c.url.startsWith('https://www.googleapis.com/calendar/v3/users/me/calendarList?')&&c.options.redirect==='error'));assert.equal(new URL(calls[1].url).searchParams.get('pageToken'),'next');
});
test('Graph paging rejects foreign origins, changed paths and repeated cursors before token disclosure',async()=>{
 for(const next of ['https://evil.example/steal','https://graph.microsoft.com/v1.0/users/other/calendars','https://user@graph.microsoft.com/v1.0/me/calendars']){let count=0;await assert.rejects(listPersonalCalendars({provider:'microsoft',accessToken:'TOKEN'},{request:async()=>{count++;return response({value:[], '@odata.nextLink':next});}}),e=>e.code==='PERSONAL_PROVIDER_UNAVAILABLE');assert.equal(count,1);}
 let calls=0;await assert.rejects(listPersonalCalendars({provider:'google',accessToken:'TOKEN'},{request:async()=>{calls++;return response({items:[],nextPageToken:'same'});}}),e=>e.code==='PERSONAL_PROVIDER_UNAVAILABLE');assert.equal(calls,2);
});
test('Google recurrence instances normalize offsets; cancelled items and private fields are excluded',async()=>{
 const result=await readPersonalCalendar({provider:'google',accessToken:'TOKEN',calendar:{id:'chosen@example.com',label:'Home'},start:'2026-10-05T00:00:00Z',end:'2026-10-20T00:00:00Z'},{request:async url=>{assert.equal(new URL(url).searchParams.get('singleEvents'),'true');return response({items:[{id:'instance',summary:'Pickup',description:'SECRET',start:{dateTime:'2026-10-05T15:00:00-05:00'},end:{dateTime:'2026-10-05T16:00:00-05:00'}},{id:'cancelled',status:'cancelled'}]});}});
 assert.equal(result.length,1);assert.equal(result[0].start,'2026-10-05T20:00:00.000Z');assert.ok(!JSON.stringify(result).includes('SECRET'));
});
test('Graph retrieves all-day dates in original timezone rather than moving them by UTC offset',async()=>{
 const calls=[];const result=await readPersonalCalendar({provider:'microsoft',accessToken:'TOKEN',calendar:{id:'chosen',label:'Home'},start:'2026-10-05T00:00:00Z',end:'2026-10-20T00:00:00Z'},{request:async(url,options)=>{calls.push({url,options});return calls.length===1?response({value:[{id:'day',subject:'Holiday',isAllDay:true,originalStartTimeZone:'Central Standard Time',start:{dateTime:'2026-10-05T05:00:00',timeZone:'UTC'},end:{dateTime:'2026-10-06T05:00:00',timeZone:'UTC'}}]}):response({id:'day',subject:'Holiday',isAllDay:true,start:{dateTime:'2026-10-05T00:00:00',timeZone:'Central Standard Time'},end:{dateTime:'2026-10-06T00:00:00',timeZone:'Central Standard Time'}});}});
 assert.equal(result[0].start,'2026-10-05');assert.equal(calls[0].options.headers.Prefer,'outlook.timezone="UTC"');assert.equal(calls[1].options.headers.Prefer,'outlook.timezone="Central Standard Time"');
});
test('provider denial, missing pages and oversized periods cannot appear as an empty schedule',async()=>{
 await assert.rejects(listPersonalCalendars({provider:'google',accessToken:'TOKEN'},{request:async()=>new Response('{}',{status:401})}),e=>e.code==='PERSONAL_RECONNECT_REQUIRED');
 await assert.rejects(listPersonalCalendars({provider:'google',accessToken:'TOKEN'},{request:async()=>response({})}),e=>e.code==='PERSONAL_PROVIDER_UNAVAILABLE');
 await assert.rejects(readPersonalCalendar({provider:'google',calendar:{id:'one'},start:'2026-01-01',end:'2026-12-31'}),e=>e.code==='PERSONAL_CONNECTIONS_INVALID');
});
test('token exchange uses fixed endpoint, PKCE and requires durable refresh access',async t=>{
 const names=['MC_GOOGLE_CLIENT_ID','MC_GOOGLE_CLIENT_SECRET'];const old=Object.fromEntries(names.map(n=>[n,process.env[n]]));process.env.MC_GOOGLE_CLIENT_ID='client';process.env.MC_GOOGLE_CLIENT_SECRET='secret';t.after(()=>{for(const n of names){if(old[n]===undefined)delete process.env[n];else process.env[n]=old[n];}});
 const request=async(url,options)=>{assert.equal(url,'https://oauth2.googleapis.com/token');assert.equal(options.body.get('code_verifier'),'verifier');assert.equal(options.redirect,'error');return response({access_token:'access',refresh_token:'refresh',expires_in:3600});};
 assert.deepEqual(await exchangePersonalToken({provider:'google',code:'code',verifier:'verifier',redirectUri:'https://offline.invalid/callback'},{request,now:1000}),{accessToken:'access',refreshToken:'refresh',expiresAt:3601000});
 await assert.rejects(exchangePersonalToken({provider:'google',code:'code'},{request:async()=>response({access_token:'access',expires_in:3600})}),e=>e.code==='PERSONAL_RECONNECT_REQUIRED');
});

test('invalid_grant and revoked consent request reconnect without exposing provider detail',async t=>{
 const keys=['MC_GOOGLE_CLIENT_ID','MC_GOOGLE_CLIENT_SECRET'];const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));process.env.MC_GOOGLE_CLIENT_ID='client';process.env.MC_GOOGLE_CLIENT_SECRET='secret';t.after(()=>{for(const k of keys){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}});
 await assert.rejects(exchangePersonalToken({provider:'google',refreshToken:'refresh'},{request:async()=>new Response(JSON.stringify({error:'invalid_grant',error_description:'PRIVATE_DETAIL'}),{status:400})}),e=>e.code==='PERSONAL_RECONNECT_REQUIRED'&&!e.message.includes('PRIVATE_DETAIL'));
});
