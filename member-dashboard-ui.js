import {createMemberMealsEditor} from './member-meals-editor.js';
import {renderMemberDashboard} from './member-dashboard-view.js';
const get=id=>document.getElementById(id);
const sessionKey=()=>window.Clerk?.isSignedIn&&window.Clerk.user?.id&&window.Clerk.session?.id?window.Clerk.user.id+':'+window.Clerk.session.id:null;
const editor=createMemberMealsEditor({refresh:()=>load(),status:message=>{get('status').textContent=message;}});
let generation=0,key=null,pending=false,dashboard=null,tab='schedule',listening=false;
function clear(message){editor.reset();generation++;key=null;pending=false;dashboard=null;tab='schedule';get('panel').replaceChildren();get('tabs').hidden=true;get('status').textContent=message;get('refresh').disabled=!sessionKey();}
function render(){if(!dashboard)return;get('tabs').hidden=false;for(const button of get('tabs').querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.tab===tab));renderMemberDashboard(get('panel'),dashboard,tab);if(tab==='meals')editor.actions(get('panel'),dashboard);}
async function load(){
 const currentKey=sessionKey();if(!currentKey){clear('Sign in to continue.');return;}
 if(currentKey!==key){clear('Checking household access…');key=currentKey;}if(pending)return;
 const current=++generation;pending=true;get('refresh').disabled=true;get('status').textContent='Reading your shared workspace…';
 // Clear prior data before refresh: revoked access cannot leave a stale panel.
 get('panel').replaceChildren();get('tabs').hidden=true;
 try{
  const response=await fetch('/api/v1/member',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'dashboard'})});const body=await response.json();
  if(current!==generation||sessionKey()!==currentKey)return;
  if(!response.ok||body.ok!==true||!body.dashboard){const error=new Error('Workspace rejected');error.code=body.code;error.accessDenied=response.status===401||response.status===403;throw error;}
  const firstLoad=dashboard===null;dashboard=body.dashboard;
  if(firstLoad&&dashboard.profile?.preferences?.step===6&&['schedule','budget','meals','family'].includes(dashboard.profile.preferences.startView))tab=dashboard.profile.preferences.startView;
  get('status').textContent='Shared data loaded. Personal account connections are still pending.';editor.readback(dashboard);render();
 }catch(error){if(current!==generation||sessionKey()!==currentKey)return;dashboard=null;if(error.accessDenied||['MEMBER_DASHBOARD_FORBIDDEN','UNAUTHENTICATED'].includes(error.code))editor.reset();get('panel').replaceChildren();get('tabs').hidden=true;get('status').textContent=error.code==='MEMBER_DASHBOARD_DISABLED'?'Your member workspace has not been activated yet.':error.code==='USER_NOT_PROVISIONED'?'Accept your household invitation before opening this workspace.':'Shared data could not be verified. Try refreshing or check household access.';}
 finally{if(current===generation){pending=false;get('refresh').disabled=false;}}
}
get('refresh').onclick=load;for(const button of get('tabs').querySelectorAll('button'))button.onclick=()=>{tab=button.dataset.tab;render();};
window.addEventListener('mc-signed-out',()=>clear('Sign in to continue.'));
window.addEventListener('mc-authenticated',()=>{if(!listening){listening=true;window.Clerk.addListener(()=>{if(sessionKey()!==key){clear('Checking household access…');load();}});}if(sessionKey()!==key)load();});
setInterval(()=>{if(!document.hidden)load();},60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
