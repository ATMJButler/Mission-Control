async function bootMissionControlAuth(){
  const state=document.getElementById("mcAuthState"),mount=document.getElementById("mcClerkMount"),gate=document.getElementById("mcAuthGate");
  try{
    const cfg=await fetch("/api/v1/auth-config",{cache:"no-store"}).then(r=>r.json());
    if(!cfg.ok||!cfg.publishableKey)throw new Error(cfg.error||"Authentication unavailable");
    const script=document.createElement("script");
    script.async=true;script.crossOrigin="anonymous";script.dataset.clerkPublishableKey=cfg.publishableKey;
    script.src="https://cdn.jsdelivr.net/npm/@clerk/clerk-js@latest/dist/clerk.browser.js";
    script.onload=async()=>{await window.Clerk.load();const render=()=>{if(window.Clerk.user){state.textContent="Identity verified. Household authorization is not commissioned yet.";return}mount.innerHTML="";window.Clerk.mountSignIn(mount,{});state.textContent="Authentication is required."};render();window.Clerk.addListener(render)};
    script.onerror=()=>state.textContent="Could not load the sign-in service.";
    document.head.appendChild(script);
  }catch(e){state.textContent=String(e&&e.message||e)}
}
window.addEventListener("DOMContentLoaded",bootMissionControlAuth);
