const get=id=>document.getElementById(id);
const sessionKey=()=>window.Clerk?.isSignedIn&&window.Clerk.user?.id&&window.Clerk.session?.id?`${window.Clerk.user.id}:${window.Clerk.session.id}`:null;
let generation=0,key=null,pending=false,listening=false,blocked=false;
let callback=window.__mcPersonalCallback;delete window.__mcPersonalCallback;
const messages={PERSONAL_CONNECTIONS_DISABLED:'Calendar connections have not been activated yet.',PERSONAL_PROVIDER_NOT_CONFIGURED:'Calendar connections need provider configuration before they can be used.',PERSONAL_CONNECTIONS_CONFLICT:'Your connection changed. Refresh before continuing.',PERSONAL_RECONNECT_REQUIRED:'Reconnect this account to restore calendar access.',PERSONAL_CONNECTIONS_CONSENT_EXPIRED:'This consent attempt expired or was already used. Connect again.',PERSONAL_CONNECTIONS_OUTCOME_UNKNOWN:'The last change could not be confirmed. Refresh connections before making another change.'};
function clear(message){generation++;pending=false;key=null;get('connections').replaceChildren();get('connectionStatus').textContent=message;}
async function api(body){const response=await fetch('/api/v1/member',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});let value;try{value=await response.json();}catch{throw Error('Unavailable');}if(!response.ok||value.ok!==true)throw Object.assign(Error('Unavailable'),{code:value.code,accessDenied:response.status===401||response.status===403});return value;}
function node(parent,tag,text){const item=document.createElement(tag);item.textContent=text;parent.append(item);return item;}
function button(parent,label,action){const b=node(parent,'button',label);b.type='button';b.onclick=action;return b;}
function show(connections){
 get('connections').replaceChildren();for(const connection of connections){
  const card=node(get('connections'),'article','');card.className='card';node(card,'h2',connection.provider==='google'?'Google Calendar':'Microsoft / Outlook');
  node(card,'p',connection.connected?`Connected: ${connection.accountLabel}`:'No account connected.');
  if(connection.connected){node(card,'p',connection.calendars.length?`Selected: ${connection.calendars.map(c=>c.label).join(', ')}`:'No calendars selected. Choose calendars to load your schedule.');button(card,'Choose calendars',()=>choose(connection));button(card,'Disconnect',()=>change(()=>api({operation:'disconnect_calendar',provider:connection.provider,expectedVersion:connection.version})));node(card,'p','Disconnect removes the saved connection and stops future reads. You can also revoke app permission in your Google or Microsoft account settings.');}
  if(connection.configured)button(card,connection.connected?'Reconnect account':'Connect account',()=>change(async()=>{const value=await api({operation:'connect_calendar',provider:connection.provider});const url=new URL(value.authorizationUrl);if(url.protocol!=='https:'||!['accounts.google.com','login.microsoftonline.com'].includes(url.hostname))throw Error('Unavailable');return{navigate:url.href};}));
  else node(card,'p','This provider is not configured yet.');
 }
}
async function change(action){
 if(pending||blocked||!sessionKey())return;const mine=++generation,current=sessionKey();pending=true;get('connectionStatus').textContent='Updating your connection…';get('connections').replaceChildren();
 try{const result=await action();if(mine!==generation||sessionKey()!==current)return;if(result?.navigate){location.assign(result.navigate);return;}pending=false;await load();}
 catch(error){if(mine!==generation||sessionKey()!==current)return;blocked=true;get('connections').replaceChildren();get('connectionStatus').textContent=messages[error.code]||'The change could not be verified. Refresh connections before continuing.';}
 finally{if(mine===generation)pending=false;}
}
async function choose(connection){
 if(pending||blocked)return;const mine=++generation,current=sessionKey();pending=true;get('connections').replaceChildren();get('connectionStatus').textContent='Reading your calendars…';
 try{const value=await api({operation:'list_calendars',provider:connection.provider});if(mine!==generation||sessionKey()!==current)return;
  const card=node(get('connections'),'article','');card.className='card';node(card,'h2','Choose up to five calendars');const inputs=[];
  for(const calendar of value.calendars){const label=node(card,'label','');const input=document.createElement('input');input.type='checkbox';input.checked=value.connection.calendars.some(c=>c.id===calendar.id);label.append(input);node(label,'span',calendar.label);inputs.push({input,id:calendar.id});}
  button(card,'Save calendar choices',()=>{const ids=inputs.filter(c=>c.input.checked).map(c=>c.id);if(ids.length>5){get('connectionStatus').textContent='Choose up to five calendars.';return;}change(()=>api({operation:'select_calendars',provider:connection.provider,expectedVersion:value.connection.version,calendarIds:ids}));});button(card,'Back',load);get('connectionStatus').textContent='Only these calendars will appear in your private schedule.';
 }catch(error){if(mine!==generation||sessionKey()!==current)return;get('connections').replaceChildren();get('connectionStatus').textContent=messages[error.code]||'Calendars could not be verified. Refresh to try again.';}
 finally{if(mine===generation)pending=false;}
}
async function load(){
 const current=sessionKey();if(!current){clear('Sign in to manage your calendars.');return;}if(pending)return;
 if(key&&key!==current)callback=null;key=current;const mine=++generation;pending=true;get('connections').replaceChildren();get('connectionStatus').textContent='Checking your connections…';
 try{
  if(callback){const saved=callback;callback=null;if(saved.cancelled)get('connectionStatus').textContent='Calendar consent was cancelled.';else await api({operation:'complete_connection',code:saved.code,state:saved.state});}
  const value=await api({operation:'connections'});if(mine!==generation||sessionKey()!==current)return;show(value.connections);blocked=false;get('connectionStatus').textContent='Your calendar connections are private. Email access is separate.';
 }catch(error){if(mine!==generation||sessionKey()!==current)return;get('connections').replaceChildren();blocked=true;get('connectionStatus').textContent=messages[error.code]||'Connections could not be verified. Refresh or check your household access.';}
 finally{if(mine===generation)pending=false;}
}
get('connectionRefresh').onclick=load;
window.addEventListener('mc-signed-out',()=>{callback=null;blocked=true;clear('Sign in to manage your calendars.');});
window.addEventListener('mc-authenticated',()=>{if(!listening){listening=true;window.Clerk.addListener(()=>{if(key!==null&&sessionKey()!==key){callback=null;clear('Checking account access…');load();}});}if(sessionKey()!==key)load();});
setInterval(()=>{if(!document.hidden)load();},60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
