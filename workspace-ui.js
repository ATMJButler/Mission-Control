(() => {
  let generation=0,sessionKey=null,pending=false,lastCheck=0,cacheReady=false,listening=false;
  const element=id=>document.getElementById(id);
  const key=()=>window.Clerk?.isSignedIn&&window.Clerk.user?.id&&window.Clerk.session?.id
    ?window.Clerk.user.id+":"+window.Clerk.session.id:null;
  function hold(message,{retry=false,join=false}={}){
    const frame=element("core");if(frame&&frame.getAttribute("src")!=="about:blank")frame.src="about:blank";
    element("mcWorkspaceGate").style.display="flex";element("mcWorkspaceStatus").textContent=message;
    element("mcWorkspaceRetry").hidden=!retry;element("mcWorkspaceJoin").hidden=!join;
    const preview=element("mcJuliePreview");if(preview)preview.hidden=true;
    const modal=element("mcOnboard");if(modal){modal.classList.remove("show");modal.setAttribute("aria-hidden","true");}
  }
  function signedOut(){generation++;sessionKey=null;pending=false;cacheReady=false;lastCheck=0;hold("Sign in to continue.");}
  async function verify(force=false){
    const currentKey=key();if(!currentKey){signedOut();return;}
    if(currentKey!==sessionKey){generation++;sessionKey=currentKey;pending=false;cacheReady=false;lastCheck=0;hold("Checking household access…");}
    if(pending||(!force&&lastCheck&&Date.now()-lastCheck<60000))return;
    const current=++generation;pending=true;element("mcWorkspaceRetry").disabled=true;
    try{
      // Remove older service-worker API caches before opening any workspace.
      // No cached routing decision or principal snapshot is a permission grant.
      if(!cacheReady&&"caches"in window){for(const name of await caches.keys())await caches.delete(name);}
      if(current!==generation||key()!==currentKey)return;
      cacheReady=true;
      const response=await fetch("/api/v1/workspace",{method:"POST",credentials:"same-origin",cache:"no-store",
        headers:{"Content-Type":"application/json"},body:"{}"});
      const body=await response.json();
      if(current!==generation||key()!==currentKey)return;
      lastCheck=Date.now();
      if(!response.ok||body.ok!==true){
        hold(body.code==="USER_NOT_PROVISIONED"?"Your account is signed in but has not joined a household. Use the invitation code you received.":
          response.status===401?"Your session needs a fresh sign-in.":"Household access could not be confirmed. Try again or contact your household principal.",
          {retry:true,join:body.code==="USER_NOT_PROVISIONED"});return;
      }
      const workspace=body.workspace;
      if(workspace?.role==="principal"&&workspace.principalWorkspace===true){
        element("mcWorkspaceGate").style.display="none";element("mcWorkspaceJoin").hidden=true;
        const frame=element("core");if(frame.getAttribute("src")==="about:blank")frame.src=frame.dataset.src;
        const preview=element("mcJuliePreview");if(preview)preview.hidden=false;
      }else if(["secondary","extended"].includes(workspace?.role)&&workspace.principalWorkspace===false){
        hold("Your household membership is verified. Member setup is still being prepared; this account cannot open the principal workspace.",{retry:true});
      }else hold("Workspace response could not be verified. Try again.",{retry:true});
    }catch{
      if(current===generation&&key()===currentKey)hold("Household access is temporarily unavailable. Try again.",{retry:true});
    }finally{
      if(current===generation){pending=false;element("mcWorkspaceRetry").disabled=false;}
    }
  }
  window.addEventListener("mc-authenticated",()=>{if(!listening){listening=true;window.Clerk.addListener(()=>verify());}verify();});
  window.addEventListener("mc-signed-out",signedOut);
  window.addEventListener("DOMContentLoaded",()=>{
    element("mcWorkspaceRetry").addEventListener("click",()=>verify(true));
    setInterval(()=>{if(!document.hidden)verify();},60000);
    document.addEventListener("visibilitychange",()=>{if(!document.hidden)verify(true);});
  });
})();
