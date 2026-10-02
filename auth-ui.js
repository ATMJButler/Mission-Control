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
    const parts=cfg.publishableKey.split("_");
    if(parts.length<3)throw new Error("Invalid authentication configuration");
    const clerkDomain=atob(parts[2]).slice(0,-1);
    await loadScript("https://"+clerkDomain+"/npm/@clerk/ui@1/dist/ui.browser.js");
    await loadScript("https://"+clerkDomain+"/npm/@clerk/clerk-js@6/dist/clerk.browser.js",{"data-clerk-publishable-key":cfg.publishableKey});
    await window.Clerk.load({ui:{ClerkUI:window.__internal_ClerkUICtor}});
    const render=()=>{
      if(window.Clerk.isSignedIn){
        mount.innerHTML="";
        state.textContent="Identity verified.";
        const gate=document.getElementById("mcAuthGate");if(gate)gate.style.display="none";
        return;
      }
      mount.innerHTML="";
      window.Clerk.mountSignIn(mount,{});
      state.textContent="Authentication is required.";
    };
    render();window.Clerk.addListener(render);
  }catch(e){
    console.error("Mission Control auth init failed",e);
    state.textContent="Sign-in initialization failed. "+String(e&&e.message||e);
  }
}
window.addEventListener("DOMContentLoaded",bootMissionControlAuth);
