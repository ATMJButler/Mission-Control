import {setupDefaults,validateSetupPreferences} from './auth/member-setup.js';
const get=id=>document.getElementById(id);
const sessionKey=()=>window.Clerk?.isSignedIn&&window.Clerk.user?.id&&window.Clerk.session?.id?window.Clerk.user.id+':'+window.Clerk.session.id:null;
let generation=0,key=null,profile=null,preferences=setupDefaults(),step=0,pending=false,uncertain=null,listening=false;
function buttons({next=false,back=false,retry=false}={}){get('next').hidden=!next;get('back').hidden=!back;get('retry').hidden=!retry;for(const id of ['next','back','retry'])get(id).disabled=pending;}
function erase(message='Sign in to continue.') {generation++;key=null;profile=null;uncertain=null;preferences=setupDefaults();step=0;pending=false;get('content').replaceChildren();get('heading').textContent=message;get('message').textContent='';get('progress').textContent='Your household setup';buttons();}
async function request(body){const response=await fetch('/api/v1/member',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});let result;try{result=await response.json();}catch{throw new Error('UNVERIFIED_RESPONSE');}if(!response.ok||result.ok!==true)throw new Error(result.code||'UNVERIFIED_RESPONSE');if(!result.profile||!Number.isSafeInteger(result.profile.version)||result.profile.version<0||!validateSetupPreferences(result.profile.preferences))throw new Error('UNVERIFIED_RESPONSE');return result.profile;}
function readControls(){
  if(step===1||step===2){const field=step===1?'calendarProviders':'emailProviders';preferences[field]=[...get('content').querySelectorAll('input:checked')].map(input=>input.value);}
  if(step===3)preferences.sharingDefault=get('sharing').value;
  if(step===4){preferences.startView=get('start').value;preferences.timeZone=get('zone').value;}
}
const providerLabel=value=>value==='google'?'Google':'Microsoft / Outlook';
function render(){
  buttons({next:step<6,back:step>0&&step<6});get('progress').textContent=step===6?'Preferences saved':`Step ${step+1} of 6`;get('message').textContent='';
  const titles=['Welcome to your Mission Control','Choose your calendars','Choose your email accounts','Choose your sharing preference','Make it feel like your day','Review your choices','Your preferences are saved'];
  get('heading').textContent=titles[step];get('next').textContent=step===5?'Save my setup':step===1||step===2?'Save choices and continue':'Continue';
  const content=get('content');content.replaceChildren();const paragraph=text=>{const p=document.createElement('p');p.textContent=text;content.append(p);return p;};
  if(step===0){paragraph('Your household membership is verified. We’ll take this one step at a time and save your progress as you continue.');paragraph('Your workspace will include your schedule, Budget, Meals and shared family items. Your personal connections remain yours.');}
  if(step===1||step===2){const field=step===1?'calendarProviders':'emailProviders';paragraph(step===1?'Which services would you like to use for your schedule?':'Which email services would you like Mission Control to use for scheduling suggestions?');
    const note=paragraph('Account connections are not available yet. These choices record what you want to add; they do not grant access or connect an account. You can leave both unchecked and continue.');note.className='note';
    for(const value of ['google','microsoft']){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.value=value;input.checked=preferences[field].includes(value);label.append(input,document.createTextNode(providerLabel(value)));content.append(label);}
  }
  if(step===3){paragraph('Keep personal events private, or prefer a Busy block when you explicitly share an event. Busy hides the title and calendar name.');content.innerHTML+='<label for="sharing">Preferred sharing mode<select id="sharing"><option value="private">Keep private</option><option value="busy">Share only “Busy” when I choose</option></select></label>';get('sharing').value=preferences.sharingDefault;paragraph('This preference does not publish any events. Sharing details always needs an explicit choice. Email suggestions need confirmation before appearing on the Family Calendar.');}
  if(step===4){content.innerHTML='<label for="start">Preferred starting screen<select id="start"><option value="schedule">My schedule</option><option value="budget">Budget</option><option value="meals">Meals</option><option value="family">Family Calendar</option></select></label><label for="zone">Your timezone<select id="zone"><option value="America/Chicago">Central</option><option value="America/New_York">Eastern</option><option value="America/Denver">Mountain</option><option value="America/Los_Angeles">Pacific</option><option value="America/Phoenix">Arizona</option><option value="Pacific/Honolulu">Hawaii</option><option value="America/Anchorage">Alaska</option><option value="UTC">UTC</option></select></label>';get('start').value=preferences.startView;get('zone').value=preferences.timeZone;}
  if(step===5){const list=document.createElement('ul');content.append(list);for(const text of [`Calendars to add: ${preferences.calendarProviders.map(providerLabel).join(', ')||'Skipped for now'}`,`Email to add: ${preferences.emailProviders.map(providerLabel).join(', ')||'Skipped for now'}`,`Sharing preference: ${preferences.sharingDefault==='private'?'Private':'Busy only when you choose'}`,`Starting screen: ${preferences.startView}`,`Timezone: ${preferences.timeZone}`]){const li=document.createElement('li');li.textContent=text;list.append(li);}paragraph('No accounts are connected by this setup. You can go back and change any choice before saving.');}
  if(step===6){paragraph('Your choices are saved to your own profile. You can return here to revise them.');paragraph('Calendar/email sign-in and your member dashboard still need to be activated. No accounts have been connected and no events have been shared.');const edit=document.createElement('button');edit.type='button';edit.textContent='Revise my choices';edit.onclick=()=>{step=0;render();};content.append(edit);}
  get('heading').focus();
}
async function load(){
  const currentKey=sessionKey();if(!currentKey){erase();return;}if(pending)return;
  if(key!==currentKey){erase('Checking your household access…');key=currentKey;}
  const current=++generation;pending=true;buttons({retry:true});get('message').textContent='Checking saved progress…';
  try{const found=await request({operation:'read'});if(current!==generation||sessionKey()!==currentKey)return;
    profile=found;
    if(uncertain){const committed=found.version===uncertain.expectedVersion+1&&JSON.stringify(found.preferences)===JSON.stringify(uncertain.preferences);uncertain=null;preferences=structuredClone(found.preferences);step=preferences.step;render();get('message').textContent=committed?'Your previous save is confirmed.':'Shared progress has been read back. Review these choices before continuing.';}
    else{preferences=structuredClone(found.preferences);step=preferences.step;render();}
  }catch(error){if(current!==generation||sessionKey()!==currentKey)return;profile=null;get('content').replaceChildren();get('heading').textContent='Setup needs a little attention';get('message').textContent=error.message==='USER_NOT_PROVISIONED'?'First accept your household invitation at the Join Household page.':error.message==='MEMBER_SETUP_DISABLED'?'Member setup is not activated yet. Your household principal can finish the release steps.':'Saved progress could not be verified. Check again; no save will be sent automatically.';if(error.message==='USER_NOT_PROVISIONED'){const link=document.createElement('a');link.href='/join.html';link.textContent='Join household';get('content').append(link);}buttons({retry:true});}
  finally{if(current===generation){pending=false;for(const id of ['next','back','retry'])get(id).disabled=false;}}
}
async function save(){
  if(pending||uncertain||!profile)return;const currentKey=sessionKey();if(!currentKey||currentKey!==key){erase();load();return;}
  readControls();const submitted={...structuredClone(preferences),step:step+1};const expectedVersion=profile.version,current=++generation;pending=true;buttons({next:true,back:step>0});get('message').textContent='Saving your progress…';
  try{const found=await request({operation:'save',expectedVersion,preferences:submitted});if(current!==generation||sessionKey()!==currentKey)return;
    if(found.version!==expectedVersion+1||JSON.stringify(found.preferences)!==JSON.stringify(submitted))throw new Error('UNVERIFIED_RESPONSE');
    profile=found;preferences=structuredClone(found.preferences);step=preferences.step;render();
  }catch(error){if(current!==generation||sessionKey()!==currentKey)return;
    if(['MEMBER_SETUP_CONFLICT','MEMBER_SETUP_FORBIDDEN','MEMBER_SETUP_DISABLED','MEMBER_SETUP_INVALID'].includes(error.message)){profile=null;get('message').textContent=error.message==='MEMBER_SETUP_CONFLICT'?'Your setup changed elsewhere. Check saved progress before continuing.':'This save was not accepted. Check household access before continuing.';buttons({retry:true});}
    else{uncertain={expectedVersion,preferences:submitted};get('message').textContent='We could not confirm the save. Check saved progress before continuing; we will not resend it automatically.';buttons({retry:true});}
  }finally{if(current===generation){pending=false;for(const id of ['next','back','retry'])get(id).disabled=false;}}
}
get('next').onclick=save;get('back').onclick=()=>{if(pending||uncertain)return;readControls();step=Math.max(0,step-1);render();};get('retry').onclick=load;
window.addEventListener('mc-signed-out',()=>erase());
window.addEventListener('mc-authenticated',()=>{if(!listening){listening=true;window.Clerk.addListener(()=>{if(sessionKey()!==key){erase('Checking your household access…');load();}});}if(sessionKey()!==key)load();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&sessionKey()!==key){erase();load();}});

async function checkAccess(){
  if(pending||!profile)return;
  const currentKey=sessionKey(),current=generation;
  if(!currentKey||currentKey!==key){erase();load();return;}
  try{await request({operation:'read'});}catch{
    if(current===generation&&sessionKey()===currentKey){erase('Household access needs to be checked again.');get('message').textContent='No further saves will be sent until access is verified.';buttons({retry:true});}
  }
}
setInterval(()=>{if(!document.hidden)checkAccess();},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkAccess();});
