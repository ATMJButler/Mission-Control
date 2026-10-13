function shellOwnsSignOut(){
  try{return window.frameElement?.id==='core'&&Boolean(window.parent.document.getElementById('mcSignOut'));}
  catch{return false;}
}
async function clearMissionControlPrivateCache({userId=null,keepUserId=null}={}){
  // Capture names before removal: localStorage indices shift when a key is deleted.
  try{
    const keys=[];for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key?.startsWith('missionControl.v4.')&&key!=='missionControl.v4.'+keepUserId&&(!userId||key==='missionControl.v4.'+userId))keys.push(key);}
    if(userId)keys.push('missionControl.v4.'+userId);
    keys.push('johnMissionControl.v3','missionControlV3Sync');
    for(const key of keys)localStorage.removeItem(key);
  }catch{}
  if('caches' in window){try{for(const name of await caches.keys())if(name.startsWith('mission-control'))await caches.delete(name);}catch{}}
}
function loadScript(src,attrs={}){
  return new Promise((resolve,reject)=>{
    const s=document.createElement("script");s.src=src;s.async=true;s.crossOrigin="anonymous";
    for(const [k,v] of Object.entries(attrs))s.setAttribute(k,v);
    s.onload=resolve;s.onerror=()=>reject(new Error("Failed to load authentication script"));
    document.head.appendChild(s);
  });
}
async function bootMissionControlAuth(){
  const state=document.getElementById("mcAuthState"),mount=document.getElementById("mcClerkMount");
  try{
    const cfg=await fetch("/api/v1/auth-config",{cache:"no-store"}).then(r=>r.json());
    if(!cfg.ok||!cfg.publishableKey)throw new Error(cfg.error||"Authentication unavailable");
    // Production Clerk uses the custom domain. A second public alias may serve
    // the app shell without being able to render its sign-in component.
    if(cfg.signInOrigin==='https://app.abovethemarkos.com'&&window.location?.hostname==='mission-control-lime-tau.vercel.app'){
      const link=document.createElement('a');link.textContent='Continue to Mission Control';
      const path=window.location.pathname;
      link.href=cfg.signInOrigin+(['/', '/index.html', '/diagnostics.html', '/member.html', '/member-setup.html', '/join.html', '/invite.html', '/budget.html', '/kid.html', '/household-requests.html'].includes(path)?path:'/');
      link.className='mc-auth-retry';mount.replaceChildren(link);
      state.textContent='Sign in on the main Mission Control website.';
      return;
    }
    const parts=cfg.publishableKey.split("_");
    if(parts.length<3)throw new Error("Invalid authentication configuration");
    const clerkDomain=atob(parts[2]).slice(0,-1);
    await loadScript("https://"+clerkDomain+"/npm/@clerk/ui@1/dist/ui.browser.js");
    await loadScript("https://"+clerkDomain+"/npm/@clerk/clerk-js@6/dist/clerk.browser.js",{"data-clerk-publishable-key":cfg.publishableKey});
    await window.Clerk.load({ui:{ClerkUI:window.__internal_ClerkUICtor}});
    let previousUserId=null,observedIdentity=false;
    window.mcClearPrivateCache=()=>{window.mcPrivateSessionEnded=true;const core=document.getElementById('core');try{if(core)core.contentWindow.mcPrivateSessionEnded=true;}catch{}return clearMissionControlPrivateCache({userId:previousUserId});};
    window.mcReauthenticate=async()=>{
      try{await window.mcClearPrivateCache();await window.Clerk.signOut();location.reload();}
      catch{state.textContent='Sign-in could not be reset. Reload this page to try again.';const gate=document.getElementById('mcAuthGate');if(gate)gate.style.display='flex';}
    };
    let signInMounted=false;
    const render=()=>{
      const nextUserId=window.Clerk.isSignedIn?window.Clerk.user?.id||null:null;
      if(!observedIdentity||nextUserId!==previousUserId){
        if(observedIdentity)window.mcPrivateSessionEnded=true;
        const core=document.getElementById('core');if(core){try{core.contentWindow.mcPrivateSessionEnded=true;}catch{}core.src='about:blank';}
        void clearMissionControlPrivateCache(previousUserId?{userId:previousUserId}:{keepUserId:nextUserId});
        previousUserId=nextUserId;observedIdentity=true;
      }
      if(window.Clerk.isSignedIn){
        if(signInMounted){window.Clerk.unmountSignIn(mount);signInMounted=false;}
        mount.innerHTML="";
        state.textContent="Identity verified.";
        const gate=document.getElementById("mcAuthGate");if(gate)gate.style.display="none";window.dispatchEvent(new CustomEvent("mc-authenticated"));
        if(!shellOwnsSignOut()&&!document.getElementById("mcSignOut")){const b=document.createElement("button");b.id="mcSignOut";b.type="button";b.textContent="Sign out";b.style.cssText="position:fixed;right:14px;bottom:14px;z-index:9999;padding:8px 12px;border-radius:10px;border:1px solid #315174;background:#0d1a2c;color:#edf4fa;cursor:pointer";b.onclick=async()=>{b.disabled=true;try{await window.mcClearPrivateCache();}finally{await window.Clerk.signOut();location.reload()}};document.body.appendChild(b)}
        return;
      }
      const gate=document.getElementById("mcAuthGate");if(gate)gate.style.display="flex";
      const core=document.getElementById("core");if(core)core.src="about:blank";
      window.dispatchEvent(new CustomEvent("mc-signed-out"));
      const signOut=document.getElementById("mcSignOut");if(signOut)signOut.remove();
      if(!signInMounted){
        window.Clerk.mountSignIn(mount,{});
        signInMounted=true;
      }
      state.textContent="Authentication is required.";
    };
    render();window.Clerk.addListener(render);
  }catch(e){
    console.error("Mission Control auth init failed",e);
    state.textContent="Sign-in initialization failed. "+String(e&&e.message||e);
  }
}
window.addEventListener("DOMContentLoaded",bootMissionControlAuth);
