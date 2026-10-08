const get=id=>document.getElementById(id);
const sessionKey=()=>window.Clerk?.isSignedIn&&window.Clerk.user?.id&&window.Clerk.session?.id?`${window.Clerk.user.id}:${window.Clerk.session.id}`:null;
let generation=0,key=null,pending=false,listening=false,blocked=false,chooser=null,connectionSnapshot=null;
let callback=window.__mcPersonalCallback;delete window.__mcPersonalCallback;
const messages={PERSONAL_CONNECTIONS_DISABLED:'Calendar connections have not been activated yet.',PERSONAL_PROVIDER_NOT_CONFIGURED:'Calendar connections need provider configuration before they can be used.',PERSONAL_CONNECTIONS_CONFLICT:'Your connection changed. Refresh before continuing.',PERSONAL_RECONNECT_REQUIRED:'Reconnect this account to restore calendar access.',PERSONAL_CONNECTIONS_CONSENT_EXPIRED:'This consent attempt expired or was already used. Connect again.',PERSONAL_CONNECTIONS_OUTCOME_UNKNOWN:'The last change could not be confirmed. Refresh connections before making another change.'};
function clear(message){connectionSnapshot=null;chooser=null;generation++;pending=false;key=null;get('connections').replaceChildren();get('connectionStatus').textContent=message;}
async function api(body){const response=await fetch('/api/v1/member',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});let value;try{value=await response.json();}catch{throw Error('Unavailable');}if(!response.ok||value.ok!==true)throw Object.assign(Error('Unavailable'),{code:value.code,accessDenied:response.status===401||response.status===403});return value;}
function node(parent,tag,text){const item=document.createElement(tag);item.textContent=text;parent.append(item);return item;}
function button(parent,label,action){const b=node(parent,'button',label);b.type='button';b.onclick=action;return b;}
function show(connections){
 get('connections').replaceChildren();for(const connection of connections){
  const card=node(get('connections'),'article','');card.className='card';node(card,'h2',connection.provider==='google'?'Google Calendar':'Microsoft / Outlook');
  if(connection.requiresReconnect)node(card,'p','This saved connection needs recovery. Refresh to check it, reconnect, or disconnect.');
  node(card,'p',connection.connected?`Saved account: ${connection.accountLabel}`:'No account connected.');
  if(connection.configured)button(card,connection.connected?'Reconnect account':'Connect account',()=>change(async()=>{const value=await api({operation:'connect_calendar',provider:connection.provider});const url=new URL(value.authorizationUrl);if(url.protocol!=='https:'||!['accounts.google.com','login.microsoftonline.com'].includes(url.hostname))throw Error('Unavailable');return{navigate:url.href};}));
  else node(card,'p','This provider is not configured yet.');
  if(connection.connected){node(card,'p',connection.calendars.length?`Selected: ${connection.calendars.map(c=>c.label).join(', ')}`:'No calendars selected. Choose calendars to load your schedule.');if(!connection.requiresReconnect)button(card,'Choose calendars',()=>choose(connection));button(card,'Disconnect',()=>change(()=>api({operation:'disconnect_calendar',provider:connection.provider,expectedVersion:connection.version})));node(card,'p','Disconnect removes the saved connection and stops future reads. You can also revoke app permission in your Google or Microsoft account settings.');}

 }
}
async function change(action,{successMessage,provider}={}){
 if(pending||blocked||!sessionKey())return;chooser=null;const mine=++generation,current=sessionKey();pending=true;get('connectionStatus').textContent='Updating your connection…';get('connections').replaceChildren();
 try{const result=await action();if(mine!==generation||sessionKey()!==current)return;if(result?.navigate){location.assign(result.navigate);return;}pending=false;await load();if(successMessage&&!blocked&&sessionKey()===current)get('connectionStatus').textContent=successMessage;}
 catch(error){if(mine!==generation||sessionKey()!==current)return;if(error.code==='PERSONAL_RECONNECT_REQUIRED'&&provider){await restoreReconnect(current,provider);}else{blocked=true;get('connections').replaceChildren();get('connectionStatus').textContent=messages[error.code]||'The change could not be verified. Refresh connections before continuing.';}}
 finally{if(mine===generation)pending=false;}
}
async function restoreReconnect(current,provider){
 pending=false;await load();
 if(sessionKey()!==current||blocked||!connectionSnapshot)return;
 show(JSON.parse(connectionSnapshot).map(item=>item.provider===provider?{...item,requiresReconnect:true}:item));
 get('connectionStatus').textContent=messages.PERSONAL_RECONNECT_REQUIRED;
}
async function choose(connection){
 if(pending||blocked)return;const mine=++generation,current=sessionKey();pending=true;get('connections').replaceChildren();get('connectionStatus').textContent='Reading your calendars…';
 try{const value=await api({operation:'list_calendars',provider:connection.provider});if(mine!==generation||sessionKey()!==current)return;
  chooser={provider:connection.provider,version:value.connection.version};
  const card=node(get('connections'),'article','');card.className='card';const heading=node(card,'h2','Choose up to five calendars');heading.tabIndex=-1;heading.focus();const inputs=[];
  for(const calendar of value.calendars){const label=node(card,'label','');const input=document.createElement('input');input.type='checkbox';input.checked=value.connection.calendars.some(c=>c.id===calendar.id);label.append(input);node(label,'span',calendar.label);inputs.push({input,id:calendar.id});}
  const feedback=node(card,'p','');feedback.id='calendarSelectionFeedback';feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
  const save=button(card,'Save calendar choices',()=>{const ids=inputs.filter(c=>c.input.checked).map(c=>c.id);if(ids.length>5){updateSelection();return;}change(()=>api({operation:'select_calendars',provider:connection.provider,expectedVersion:value.connection.version,calendarIds:ids}),{provider:connection.provider,successMessage:'Calendar choices saved. Open Your workspace to see your schedule.'});});save.setAttribute('aria-describedby',feedback.id);
  function updateSelection(){const count=inputs.filter(c=>c.input.checked).length;save.disabled=count>5;feedback.textContent=count>5?`${count} calendars selected. Uncheck ${count-5} to save; the limit is five.`:`${count} of 5 calendars selected. You can save these choices.`;}
  for(const {input}of inputs)input.addEventListener('change',updateSelection);updateSelection();
  button(card,'Back',load);get('connectionStatus').textContent='Only these calendars will appear in your private schedule.';
 }catch(error){if(mine!==generation||sessionKey()!==current)return;
  if(error.code==='PERSONAL_RECONNECT_REQUIRED'){
   await restoreReconnect(current,connection.provider);
  }else{get('connections').replaceChildren();get('connectionStatus').textContent=messages[error.code]||'Calendars could not be verified. Refresh to try again.';}
 }
 finally{if(mine===generation)pending=false;}
}
async function load({background=false,force=false}={}){
 const current=sessionKey();if(!current){clear('Sign in to manage your calendars.');return;}if(pending)return;
 if(background&&chooser){
  const draft=chooser,mine=++generation;pending=true;get('connectionStatus').textContent='Rechecking household access…';
  try{const value=await api({operation:'connections'});if(mine!==generation||sessionKey()!==current)return;const connection=value.connections.find(c=>c.provider===draft.provider);blocked=!connection?.connected||connection.requiresReconnect===true||connection.version!==draft.version;get('connectionStatus').textContent=blocked?'The connection changed. Use Back to reload before saving your choices.':'Your unsaved calendar choices are still here.';}
  catch(error){if(mine!==generation||sessionKey()!==current)return;blocked=true;if(error.accessDenied){clear('Household access could not be verified.');}else get('connectionStatus').textContent='Access could not be revalidated. Your unsaved choices are kept; refresh before saving.';}
  finally{if(mine===generation)pending=false;}return;
 }
 const preserve=background&&!force&&connectionSnapshot!==null&&key===current&&!callback;
 chooser=null;
 if(key&&key!==current)callback=null;key=current;const mine=++generation;pending=true;if(!preserve){get('connections').replaceChildren();get('connectionStatus').textContent='Checking your connections…';}
 try{
  if(callback){const saved=callback;callback=null;if(saved.cancelled)get('connectionStatus').textContent='Calendar consent was cancelled.';else await api({operation:'complete_connection',code:saved.code,state:saved.state});}
  const value=await api({operation:'connections'});if(mine!==generation||sessionKey()!==current)return;const next=JSON.stringify(value.connections);if(!preserve||next!==connectionSnapshot){show(value.connections);get('connectionStatus').textContent='Your saved calendar choices are private. Google or Microsoft access is checked when calendars are read.';}connectionSnapshot=next;blocked=false;
 }catch(error){if(mine!==generation||sessionKey()!==current)return;connectionSnapshot=null;get('connections').replaceChildren();blocked=true;get('connectionStatus').textContent=messages[error.code]||'Connections could not be verified. Refresh or check your household access.';}
 finally{if(mine===generation)pending=false;}
}
get('connectionRefresh').onclick=()=>load({background:true,force:true});
window.addEventListener('mc-signed-out',()=>{callback=null;blocked=true;clear('Sign in to manage your calendars.');});
window.addEventListener('mc-authenticated',()=>{if(!listening){listening=true;window.Clerk.addListener(()=>{if(key!==null&&sessionKey()!==key){callback=null;clear('Checking account access…');load();}});}if(sessionKey()!==key)load();});
setInterval(()=>{if(!document.hidden)load({background:true});},60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)load({background:true});});
