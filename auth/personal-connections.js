import {beginPersonalOAuth,validatePersonalOAuthState,sealPersonalSecret,openPersonalSecret} from './personal-oauth.js';
import {callPersonalStore,personalConnectionError as failure} from './personal-connections-store.js';
import {personalProviderConfiguration,exchangePersonalToken,readPersonalAccount,listPersonalCalendars,readPersonalCalendar} from './personal-provider.js';
const providers=['google','microsoft'];
export const personalOperations=['connections','connect_calendar','complete_connection','list_calendars','select_calendars','personal_schedule','disconnect_calendar'];
const fields={connections:[],connect_calendar:['provider'],complete_connection:['code','state'],list_calendars:['provider'],select_calendars:['provider','calendarIds','expectedVersion'],personal_schedule:[],disconnect_calendar:['provider','expectedVersion']};
export function validatePersonalRequest(body){
 if(!body||!Object.hasOwn(fields,body.operation)||Object.keys(body).some(k=>!['operation','householdId',...fields[body.operation]].includes(k)))return false;
 if(fields[body.operation].includes('provider')&&!providers.includes(body.provider))return false;
 if(fields[body.operation].includes('expectedVersion')&&(!Number.isSafeInteger(body.expectedVersion)||body.expectedVersion<0||body.expectedVersion>=Number.MAX_SAFE_INTEGER))return false;
 if(body.operation==='select_calendars'&&(!Array.isArray(body.calendarIds)||body.calendarIds.length>5||body.calendarIds.some(id=>typeof id!=='string'||!id||id.length>1024)||new Set(body.calendarIds).size!==body.calendarIds.length))return false;
 if(body.operation==='complete_connection'&&[body.code,body.state].some(v=>typeof v!=='string'||!v||v.length>16000))return false;
 return true;
}
function runtime({requireKey=true,requireCallback=true}={}){
 if(process.env.MC_PERSONAL_CONNECTIONS!=='enabled')throw failure('PERSONAL_CONNECTIONS_DISABLED');
 const key=process.env.MC_PERSONAL_ENCRYPTION_KEY;if(requireKey&&!/^[0-9a-f]{64}$/i.test(key||''))throw failure('PERSONAL_PROVIDER_NOT_CONFIGURED');
 if(!requireCallback)return{key};
 let origin;try{origin=new URL(process.env.MC_PERSONAL_CALLBACK_ORIGIN);}catch{throw failure('PERSONAL_PROVIDER_NOT_CONFIGURED');}
 if(origin.protocol!=='https:'||origin.pathname!=='/'||origin.search||origin.hash||origin.username||origin.password||!(process.env.MC_AUTHORIZED_PARTIES||'').split(',').map(s=>s.trim().replace(/\/$/,'')).includes(origin.origin))throw failure('PERSONAL_PROVIDER_NOT_CONFIGURED');
 return{key,redirectUri:origin.origin+'/personal-connect.html'};
}
export async function handlePersonalConnection(body,{actor,householdId,sessionId},{store=callPersonalStore,exchange=exchangePersonalToken,account=readPersonalAccount,calendars=listPersonalCalendars,events=readPersonalCalendar,now=Date.now()}={}){
 if(!validatePersonalRequest(body))throw failure('PERSONAL_CONNECTIONS_INVALID',400);
 const {key,redirectUri}=runtime({requireKey:!['connections','disconnect_calendar'].includes(body.operation),requireCallback:!['connections','disconnect_calendar'].includes(body.operation)});
 const owner=provider=>({actor,householdId,provider,purpose:'calendar'});
 const context=provider=>JSON.stringify(['personal-connection-v1',actor,householdId,provider,'calendar']);
 const load=async (provider,{allowRecovery=false}={})=>{
  const record=await store(owner(provider));let data=null;
  if(record.ciphertext){try{data=openPersonalSecret(record.ciphertext,key,context(provider));}catch{if(allowRecovery)return{record,data:{label:'Saved connection needs recovery',calendars:[],recoveryRequired:true}};throw failure('PERSONAL_CONNECTIONS_UNAVAILABLE');}
   if(!data||(data.refreshPending!==undefined&&typeof data.refreshPending!=='boolean')||typeof data.accountId!=='string'||!data.accountId||typeof data.label!=='string'||data.label.length>200||typeof data.accessToken!=='string'||typeof data.refreshToken!=='string'||!Number.isSafeInteger(data.expiresAt)||!Array.isArray(data.calendars)||data.calendars.length>5||data.calendars.some(c=>typeof c?.id!=='string'||!c.id||c.id.length>1024||typeof c.label!=='string'||c.label.length>200)||new Set(data.calendars.map(c=>c.id)).size!==data.calendars.length)throw failure('PERSONAL_CONNECTIONS_UNAVAILABLE');
  }
  return{record,data};
 };
 const save=async(provider,record,data,nonce='',expiresAt=0)=>store({...owner(provider),operation:'save',expectedVersion:record.version,ciphertext:data?sealPersonalSecret(data,key,context(provider)):'',nonce:expiresAt>Date.now()?nonce:'',expiresAt:expiresAt>Date.now()?expiresAt:0});
 const recheck=async(provider,record)=>{const fresh=await store(owner(provider));if(fresh.version!==record.version)throw failure('PERSONAL_CONNECTIONS_CONFLICT',409);};
 const ready=async (provider,snapshot)=>{
  let {record,data}=snapshot||await load(provider);if(!data)throw failure('PERSONAL_RECONNECT_REQUIRED');
  if(data.refreshPending===true)throw failure('PERSONAL_RECONNECT_REQUIRED');
  if(data.expiresAt<=now+60000){
   // Durable CAS claim before external refresh. Never reuse the old token after
   // a crash, uncertain claim or exchange; reconnect is the recovery path.
   record=await save(provider,record,{...data,refreshPending:true},record.nonce,record.expiresAt);
   const token=await exchange({provider,refreshToken:data.refreshToken});
   // Recheck the provider's immutable account after refresh, never switch owners.
   const refreshedAccount=await account({provider,accessToken:token.accessToken});if(refreshedAccount.accountId!==data.accountId)throw failure('PERSONAL_RECONNECT_REQUIRED');
   data={...data,...token,refreshPending:false};record=await save(provider,record,data,record.nonce,record.expiresAt);
  }
  return{record,data};
 };
 const view=(provider,record,data)=>({provider,version:record.version,connected:!!data,requiresReconnect:data?.refreshPending===true||data?.recoveryRequired===true,accountLabel:data?.label||null,calendars:data?.calendars||[]});
 if(body.operation==='connections'){
  const connections=[];for(const provider of providers){const {record,data}=await load(provider,{allowRecovery:true});let configured=true;try{personalProviderConfiguration(provider);}catch{configured=false;}connections.push({...view(provider,record,data),configured});}
  return{ok:true,connections,emailSuggestionsAvailable:false};
 }
 if(body.operation==='connect_calendar'){
  if(typeof sessionId!=='string'||!sessionId)throw failure('PERSONAL_CONNECTIONS_FORBIDDEN',403);
  const config=personalProviderConfiguration(body.provider),record=await store(owner(body.provider));
  const consent=beginPersonalOAuth({provider:body.provider,purpose:'calendar',clientId:config.clientId,redirectUri,actor,householdId,sessionId,encryptionKey:key,now});
  await store({...owner(body.provider),operation:'save',expectedVersion:record.version,ciphertext:record.ciphertext,nonce:consent.nonce,expiresAt:consent.expiresAt});
  return{ok:true,authorizationUrl:consent.authorizationUrl};
 }
 if(body.operation==='complete_connection'){
  let state;try{state=validatePersonalOAuthState({state:body.state,encryptionKey:key,actor,householdId,sessionId,redirectUri,now});}catch{throw failure('PERSONAL_CONNECTIONS_CONSENT_EXPIRED',409);}
  if(state.purpose!=='calendar')throw failure('PERSONAL_CONNECTIONS_INVALID',400);
  // An uncertain nonce write stops here; never exchange on a guessed outcome.
  const record=await store({...owner(state.provider),operation:'consume',nonce:state.nonce});
  const token=await exchange({provider:state.provider,code:body.code,verifier:state.verifier,redirectUri});
  const info=await account({provider:state.provider,accessToken:token.accessToken});
  await calendars({provider:state.provider,accessToken:token.accessToken});
  const data={...info,...token,calendars:[]};const saved=await save(state.provider,record,data);
  return{ok:true,connection:view(state.provider,saved,data)};
 }
 if(body.operation==='disconnect_calendar'){
  const record=await store(owner(body.provider));if(record.version!==body.expectedVersion)throw failure('PERSONAL_CONNECTIONS_CONFLICT',409);
  const saved=await save(body.provider,record,null);return{ok:true,connection:view(body.provider,saved,null)};
 }
 if(body.operation==='list_calendars'){
  const {record,data}=await ready(body.provider);const available=await calendars({provider:body.provider,accessToken:data.accessToken});
  await recheck(body.provider,record);return{ok:true,connection:view(body.provider,record,data),calendars:available};
 }
 if(body.operation==='select_calendars'){
  const initial=await load(body.provider);if(initial.record.version!==body.expectedVersion)throw failure('PERSONAL_CONNECTIONS_CONFLICT',409);
  const {record,data}=await ready(body.provider,initial),available=await calendars({provider:body.provider,accessToken:data.accessToken});
  const selected=body.calendarIds.map(id=>available.find(c=>c.id===id));if(selected.some(c=>!c))throw failure('PERSONAL_CONNECTIONS_INVALID',400);
  const next={...data,calendars:selected};const saved=await save(body.provider,record,next,record.nonce,record.expiresAt);return{ok:true,connection:view(body.provider,saved,next)};
 }
 const start=new Date(now-86400000).toISOString(),end=new Date(now+14*86400000).toISOString(),schedule=[],connections=[];
 for(const provider of providers){
  const initial=await load(provider);if(!initial.data||!initial.data.calendars.length){connections.push(view(provider,initial.record,initial.data));continue;}
  const {record,data}=await ready(provider,initial);connections.push(view(provider,record,data));
  const calendarEvents=await Promise.all(data.calendars.map(calendar=>events({provider,accessToken:data.accessToken,calendar,start,end})));
  for(let index=0;index<data.calendars.length;index++){const calendar=data.calendars[index];for(const event of calendarEvents[index])schedule.push({...event,id:JSON.stringify([provider,calendar.id,event.id]),provider});if(schedule.length>2000)throw failure('PERSONAL_PROVIDER_LIMIT');}
 }
 for(const connection of connections)await recheck(connection.provider,{version:connection.version});
 schedule.sort((a,b)=>a.start.localeCompare(b.start)||a.id.localeCompare(b.id));
 return{ok:true,schedule,connections,range:{start,end},emailSuggestionsAvailable:false};
}
