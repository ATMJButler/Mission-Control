import {personalConnectionError as failure} from './personal-connections-store.js';
import {projectPersonalSchedule} from './personal-schedule.js';
const roots={google:'https://www.googleapis.com',microsoft:'https://graph.microsoft.com'};
const tokens={google:'https://oauth2.googleapis.com/token',microsoft:'https://login.microsoftonline.com/common/oauth2/v2.0/token'};
const settings=provider=>provider==='google'?{clientId:process.env.MC_GOOGLE_CLIENT_ID,clientSecret:process.env.MC_GOOGLE_CLIENT_SECRET}:{clientId:process.env.MC_MICROSOFT_CLIENT_ID,clientSecret:process.env.MC_MICROSOFT_CLIENT_SECRET};
export function personalProviderConfiguration(provider){
 if(!Object.hasOwn(roots,provider))throw failure('PERSONAL_CONNECTIONS_INVALID',400);
 const config=settings(provider);if(!config.clientId||!config.clientSecret)throw failure('PERSONAL_PROVIDER_NOT_CONFIGURED');return config;
}
async function jsonRequest(url,options,request){
 let response,body;try{response=await request(url,{...options,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});body=await response.json();}catch{throw failure('PERSONAL_PROVIDER_UNAVAILABLE');}
 if(!response.ok)throw failure(response.status===401||response.status===403?'PERSONAL_RECONNECT_REQUIRED':'PERSONAL_PROVIDER_UNAVAILABLE');
 return body;
}
export async function exchangePersonalToken({provider,code,verifier,redirectUri,refreshToken},{request=fetch,now=Date.now()}={}){
 const {clientId,clientSecret}=personalProviderConfiguration(provider);
 const params=new URLSearchParams({client_id:clientId,client_secret:clientSecret,...(refreshToken?{grant_type:'refresh_token',refresh_token:refreshToken}:{grant_type:'authorization_code',code,code_verifier:verifier,redirect_uri:redirectUri})});
 const body=await jsonRequest(tokens[provider],{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:params},request);
 if(typeof body?.access_token!=='string'||!body.access_token||body.access_token.length>12000||!Number.isSafeInteger(body.expires_in)||body.expires_in<=0||body.expires_in>86400||(body.refresh_token!==undefined&&(typeof body.refresh_token!=='string'||body.refresh_token.length>12000)))throw failure('PERSONAL_PROVIDER_UNAVAILABLE');
 const refresh=body.refresh_token||refreshToken;if(!refresh)throw failure('PERSONAL_RECONNECT_REQUIRED');
 return {accessToken:body.access_token,refreshToken:refresh,expiresAt:now+body.expires_in*1000};
}
async function get(provider,path,accessToken,request,headers={}){
 if(!Object.hasOwn(roots,provider)||typeof accessToken!=='string'||!accessToken)throw failure('PERSONAL_RECONNECT_REQUIRED');
 return jsonRequest(roots[provider]+path,{method:'GET',headers:{Authorization:'Bearer '+accessToken,...headers}},request);
}
export async function readPersonalAccount({provider,accessToken},{request=fetch}={}){
 const raw=provider==='google'?await jsonRequest('https://openidconnect.googleapis.com/v1/userinfo',{method:'GET',headers:{Authorization:'Bearer '+accessToken}},request):await get(provider,'/v1.0/me?$select=id,mail,userPrincipalName',accessToken,request);
 const accountId=provider==='google'?raw.sub:raw.id,label=provider==='google'?raw.email:raw.mail||raw.userPrincipalName;
 if(typeof accountId!=='string'||!accountId||accountId.length>1024||typeof label!=='string'||!label||label.length>200)throw failure('PERSONAL_PROVIDER_UNAVAILABLE');
 return {accountId,label};
}
async function pages(provider,path,accessToken,request,headers={}){
 const result=[];let token=null;const seen=new Set();
 for(let page=0;page<10;page++){
  const raw=await get(provider,path,accessToken,request,headers);const rows=provider==='google'?raw.items:raw.value;
  if(!Array.isArray(rows)||rows.length>2000||result.length+rows.length>2000)throw failure('PERSONAL_PROVIDER_UNAVAILABLE');result.push(...rows);
  token=provider==='google'?raw.nextPageToken:raw['@odata.nextLink'];if(!token)return result;
  if(typeof token!=='string'||token.length>10000||seen.has(token))throw failure('PERSONAL_PROVIDER_UNAVAILABLE');seen.add(token);
  if(provider==='google'){const url=new URL(roots.google+path);url.searchParams.set('pageToken',token);path=url.pathname+url.search;}
  else {let next;try{next=new URL(token);}catch{throw failure('PERSONAL_PROVIDER_UNAVAILABLE');}const current=new URL(roots.microsoft+path);if(next.origin!==roots.microsoft||next.pathname!==current.pathname||next.username||next.password||next.hash)throw failure('PERSONAL_PROVIDER_UNAVAILABLE');path=next.pathname+next.search;}
 }
 throw failure('PERSONAL_PROVIDER_LIMIT');
}
export async function listPersonalCalendars({provider,accessToken},{request=fetch}={}){
 const raw=await pages(provider,provider==='google'?'/calendar/v3/users/me/calendarList?maxResults=250':'/v1.0/me/calendars?$select=id,name&$top=100',accessToken,request);
 if(raw.some(row=>!row||typeof row!=='object'||Array.isArray(row)))throw failure('PERSONAL_PROVIDER_UNAVAILABLE');
 const seen=new Set();return raw.filter(row=>row.deleted!==true).map(row=>{
  const id=row.id,label=(provider==='google'?row.summaryOverride||row.summary:row.name)||'Calendar';
  if(typeof id!=='string'||!id||id.length>1024||seen.has(id)||typeof label!=='string'||label.length>200)throw failure('PERSONAL_PROVIDER_UNAVAILABLE');seen.add(id);
  return{id,label};
 });
}
export async function readPersonalCalendar({provider,accessToken,calendar,start,end},{request=fetch}={}){
 if(typeof calendar?.id!=='string'||!calendar.id||calendar.id.length>1024||!Number.isFinite(Date.parse(start))||!Number.isFinite(Date.parse(end))||Date.parse(end)<=Date.parse(start)||Date.parse(end)-Date.parse(start)>32*86400000)throw failure('PERSONAL_CONNECTIONS_INVALID',400);
 const id=encodeURIComponent(calendar.id);
 if(provider==='google'){
  const params=new URLSearchParams({timeMin:start,timeMax:end,singleEvents:'true',orderBy:'startTime',maxResults:'250'});
  const raw=await pages(provider,`/calendar/v3/calendars/${id}/events?${params}`,accessToken,request);return projectPersonalSchedule({provider,calendarId:calendar.id,calendarLabel:calendar.label,events:raw});
 }
 // Get timed events in UTC, then retrieve all-day events in their original
 // calendar timezone so their floating dates remain correct across DST.
 const params=new URLSearchParams({startDateTime:start,endDateTime:end,'$top':'100','$select':'id,subject,start,end,isAllDay,isCancelled,originalStartTimeZone'});
 const path=`/v1.0/me/calendars/${id}/calendarView?${params}`;
 const raw=await pages(provider,path,accessToken,request,{Prefer:'outlook.timezone="UTC"'});
 const projected=[];
 let allDayReads=0;
 for(const event of raw){
  let local=event;
  if(event.isAllDay===true&&!event.isCancelled){
   if(++allDayReads>50)throw failure('PERSONAL_PROVIDER_LIMIT');
   const zone=event.originalStartTimeZone;
   if(typeof zone!=='string'||!/^[A-Za-z0-9_ /+:-]{1,100}$/.test(zone))throw failure('PERSONAL_PROVIDER_UNAVAILABLE');
   local=await get(provider,`/v1.0/me/calendars/${id}/events/${encodeURIComponent(event.id)}?$select=id,subject,start,end,isAllDay,isCancelled`,accessToken,request,{Prefer:`outlook.timezone="${zone}"`});
   if(local.id!==event.id||local.isAllDay!==true)throw failure('PERSONAL_PROVIDER_UNAVAILABLE');
  }
  projected.push(local);
 }
 return projectPersonalSchedule({provider,calendarId:calendar.id,calendarLabel:calendar.label,events:projected});
}
