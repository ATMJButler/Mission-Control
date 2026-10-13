import {createMemberMealsEditor} from './member-meals-editor.js';
import {renderMemberDashboard} from './member-dashboard-view.js';
import {createPersonalSchedule} from './personal-schedule-ui.js';
const get=id=>document.getElementById(id);
const sessionKey=()=>window.Clerk?.isSignedIn&&window.Clerk.user?.id&&window.Clerk.session?.id?window.Clerk.user.id+':'+window.Clerk.session.id:null;
const editor=createMemberMealsEditor({refresh:()=>load(),status:message=>{get('status').textContent=message;},changed:()=>{const controls=get('panel').querySelector('.meal-actions');if(controls&&dashboard){controls.replaceChildren();editor.actions(controls,dashboard,mealPlan||'approved');}}});
const personalSchedule=createPersonalSchedule();
let generation=0,key=null,pending=false,dashboard=null,tab='schedule',listening=false,lastLoadStarted=0,scheduleView=null,mealPlan=null,scheduleDate=null;
function clear(message){scheduleView=null;personalSchedule.reset();editor.reset();generation++;key=null;pending=false;dashboard=null;tab='schedule';mealPlan=null;const requests=get('householdRequestsLink');if(requests)requests.hidden=true;get('panel').replaceChildren();get('tabs').hidden=true;get('status').textContent=message;get('refresh').disabled=!sessionKey();}
function dinnerDate(){return globalThis.MCSharedDinner?.dateKey(new Date(),dashboard?.profile?.preferences?.timeZone||'America/Chicago')||null;}
function render(){if(!dashboard)return;get('tabs').hidden=false;for(const button of get('tabs').querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.tab===tab));if(tab==='schedule'&&scheduleView&&scheduleDate===dinnerDate()){get('panel').replaceChildren(...scheduleView);return;}if(tab==='schedule')scheduleDate=dinnerDate();renderMemberDashboard(get('panel'),dashboard,tab,{mealPlan:mealPlan||'approved',mealActions:root=>editor.actions(root,dashboard,mealPlan||'approved'),selectMealPlan:value=>{if(editor.changePlan()){mealPlan=value;render();}}});if(tab==='schedule'&&dashboard.capabilities?.personalSchedule){personalSchedule.mount(get('personalSchedule'),dashboard.profile?.preferences?.timeZone||'America/Chicago');scheduleView=Array.from(get('panel').childNodes);}}
async function load({background=false}={}){
 const currentKey=sessionKey();if(!currentKey){clear('Sign in to continue.');return;}
 if(currentKey!==key){clear('Checking household access…');key=currentKey;}if(pending)return;
 const preserve=dashboard!==null;const scroll={x:window.scrollX,y:window.scrollY};
 lastLoadStarted=Date.now();const current=++generation;pending=true;get('refresh').disabled=true;
 if(!preserve){scheduleView=null;get('status').textContent='Reading your shared workspace…';personalSchedule.reset();get('panel').replaceChildren();get('tabs').hidden=true;}
 try{
  const response=await fetch('/api/v1/member',{method:'POST',credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(30000),headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'dashboard'})});const body=await response.json().catch(()=>({ok:false}));
  if(current!==generation||sessionKey()!==currentKey)return;
  if(!response.ok||body.ok!==true||!body.dashboard){const error=new Error('Workspace rejected');error.code=body.code;error.accessDenied=response.status===401||response.status===403;throw error;}
  const firstLoad=dashboard===null,unchanged=preserve&&(background||tab!=='schedule'||!body.dashboard.capabilities?.personalSchedule)&&(tab!=='schedule'||scheduleDate===dinnerDate())&&JSON.stringify(dashboard)===JSON.stringify(body.dashboard);dashboard=body.dashboard;const requests=get('householdRequestsLink');if(requests)requests.hidden=dashboard.capabilities?.householdRequests!==true;
  if(mealPlan===null)mealPlan=dashboard.meals?.draft?'draft':'approved';
  if(mealPlan==='draft'&&!dashboard.meals?.draft)mealPlan='approved';
  if(firstLoad&&dashboard.profile?.preferences?.step===6&&['schedule','budget','meals','family'].includes(dashboard.profile.preferences.startView))tab=dashboard.profile.preferences.startView;
  get('status').textContent=dashboard.capabilities?.personalSchedule?'Your workspace is ready. Personal calendars stay private.':'Shared data loaded. Personal account connections are still pending.';editor.readback(dashboard);if(!unchanged){scheduleView=null;personalSchedule.reset();render();if(preserve)window.scrollTo?.(scroll.x,scroll.y);}
 }catch(error){if(current!==generation||sessionKey()!==currentKey)return;if(preserve&&!error.accessDenied&&!['MEMBER_DASHBOARD_FORBIDDEN','UNAUTHENTICATED','MEMBER_DASHBOARD_DISABLED','USER_NOT_PROVISIONED'].includes(error.code)){editor.pause?.();get('status').textContent='Connection interrupted. Your screen and edits are kept. Updates will retry in the background.';return;}scheduleView=null;personalSchedule.reset();dashboard=null;if(error.accessDenied||['MEMBER_DASHBOARD_FORBIDDEN','UNAUTHENTICATED'].includes(error.code))editor.reset();get('panel').replaceChildren();get('tabs').hidden=true;get('status').textContent=error.code==='MEMBER_DASHBOARD_DISABLED'?'Your member workspace has not been activated yet.':error.code==='USER_NOT_PROVISIONED'?'Accept your household invitation before opening this workspace.':'Shared data could not be verified. Try refreshing or check household access.';}
 finally{if(current===generation){pending=false;get('refresh').disabled=false;}}
}
get('refresh').onclick=load;for(const button of get('tabs').querySelectorAll('button'))button.onclick=()=>{if(tab===button.dataset.tab)return;tab=button.dataset.tab;render();};
window.addEventListener('mc-signed-out',()=>clear('Sign in to continue.'));
window.addEventListener('mc-authenticated',()=>{if(!listening){listening=true;window.Clerk.addListener(()=>{if(sessionKey()!==key){clear('Checking household access…');load();}});}if(sessionKey()!==key)load();});
setInterval(()=>{if(!document.hidden)load({background:true});},60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-lastLoadStarted>=60000)load({background:true});});
