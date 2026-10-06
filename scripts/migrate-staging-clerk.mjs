import {pathToFileURL} from 'node:url';
import {checkStagingVercel,stagingProjectId} from './check-staging-vercel.mjs';
import {checkStagingClerk} from './check-staging-clerk.mjs';

export async function migrateStagingClerk({token,secretKey,publishableKey,sha,request=fetch,pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))}) {
  if(!/^[a-f0-9]{40}$/.test(sha||''))throw new Error('Immutable main source SHA required.');
  const scope=await checkStagingVercel({token,request});
  const clerk=await checkStagingClerk({secretKey,publishableKey,request});
  if(clerk.userCount!==1)throw new Error('Prepared isolated Clerk identity required.');
  const call=async(path,{method='GET',body}={})=>{
    let r;try{r=await request('https://api.vercel.com'+path+(path.includes('?')?'&':'?')+'teamId='+scope.teamId,{method,headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});}
    catch{throw new Error('Vercel operation outcome uncertain; no automatic resend.');}
    if(!r.ok)throw new Error(`Vercel operation failed (HTTP ${r.status}); response omitted.`);
    if(r.status===204)return {};
    try{return await r.json();}catch{throw new Error('Vercel response unreadable; no automatic resend.');}
  };
  const base=`/v9/projects/${stagingProjectId}/env`;
  const listing=await call(`/v10/projects/${stagingProjectId}/env`);
  if(!Array.isArray(listing.envs))throw new Error('Vercel environment listing invalid.');
  const production=listing.envs.filter(e=>Array.isArray(e.target)&&e.target.includes('production'));
  const selected=[];
  for(const key of ['CLERK_SECRET_KEY','CLERK_PUBLISHABLE_KEY','MC_MEMBER_DASHBOARD','MC_MEMBER_MEALS_EDIT','MC_MEMBER_SETUP','MC_PROJECT_V1_DISPATCH']){
    const matches=production.filter(e=>e.key===key);
    if(matches.length>1)throw new Error('Ambiguous staging environment binding.');
    if(!matches.length){if(key==='MC_MEMBER_SETUP'||key==='MC_PROJECT_V1_DISPATCH')continue;throw new Error('Required staging environment binding missing.');}
    const env=matches[0];
    if(env.target.length!==1||env.target[0]!=='production'||!/^[A-Za-z0-9_-]{6,}$/.test(env.id))throw new Error('Expected staging-only Production environment bindings.');
    const snapshot=await call(`/v1/projects/${stagingProjectId}/env/${env.id}`);
    if(snapshot.key!==key)throw new Error('Staging environment identity mismatch.');
    selected.push({...env,value:snapshot.value});
  }
  const value=key=>selected.find(e=>e.key===key)?.value;
  if((typeof value('MC_MEMBER_DASHBOARD')==='string'&&value('MC_MEMBER_DASHBOARD')!=='enabled')||value('MC_MEMBER_MEALS_EDIT')==='enabled'||value('MC_MEMBER_SETUP')==='enabled'||value('MC_PROJECT_V1_DISPATCH')==='enabled')throw new Error('Read-only staging gate policy required before migration.');
  const replacements={CLERK_SECRET_KEY:secretKey,CLERK_PUBLISHABLE_KEY:publishableKey,MC_MEMBER_DASHBOARD:'enabled',MC_MEMBER_MEALS_EDIT:'disabled',MC_MEMBER_SETUP:'disabled',MC_PROJECT_V1_DISPATCH:'disabled'};
  const changed=[],backedUp=[];
  const list=async()=>{const r=await call(`/v10/projects/${stagingProjectId}/env`);if(!Array.isArray(r.envs))throw new Error('Environment readback invalid.');return r.envs;};
  const marker='Mission Control isolated staging Clerk migration';
  try {
    for(const env of selected.filter(e=>Object.hasOwn(replacements,e.key))){
      if(env.value===replacements[env.key])continue;
      const backupKey='MC_STAGING_PRIOR_'+env.key;
      if(production.some(e=>e.key===backupKey))throw new Error('Existing migration backup requires review before another change.');
      if(typeof env.value==='string'){
        changed.push(env);
        await call(`${base}/${env.id}`,{method:'PATCH',body:{value:replacements[env.key]}});
        const verified=await call(`/v1/projects/${stagingProjectId}/env/${env.id}`);
        if(verified.value!==replacements[env.key])throw new Error('Staging key update readback mismatch.');
      }else{
        backedUp.push({...env,backupKey});
        await call(`${base}/${env.id}`,{method:'PATCH',body:{key:backupKey}});
        const renamed=(await list()).find(e=>e.id===env.id);
        if(renamed?.key!==backupKey)throw new Error('Server-side key backup readback mismatch.');
        await call(`/v10/projects/${stagingProjectId}/env`,{method:'POST',body:{key:env.key,value:replacements[env.key],target:['production'],type:'encrypted',comment:marker}});
        const created=(await list()).filter(e=>e.key===env.key&&e.target?.includes('production'));
        if(created.length!==1||created[0].comment!==marker)throw new Error('Replacement key binding ambiguous.');
        const verified=await call(`/v1/projects/${stagingProjectId}/env/${created[0].id}`);
        if(verified.value!==replacements[env.key])throw new Error('Replacement key readback mismatch.');
      }
    }
  } catch(error) {
    let restored=true;
    for(const env of changed){try{await call(`${base}/${env.id}`,{method:'PATCH',body:{value:env.value}});const verify=await call(`/v1/projects/${stagingProjectId}/env/${env.id}`);if(verify.value!==env.value)restored=false;}catch{restored=false;}}
    for(const env of backedUp){try{
      const current=await list(),original=current.find(e=>e.id===env.id);
      if(original?.key===env.key)continue;
      if(original?.key!==env.backupKey)throw new Error();
      const created=current.filter(e=>e.key===env.key&&e.target?.includes('production'));
      if(created.length>1)throw new Error();
      if(created.length){
        if(created[0].comment!==marker)throw new Error();
        const verify=await call(`/v1/projects/${stagingProjectId}/env/${created[0].id}`);
        if(verify.value!==replacements[env.key])throw new Error();
        await call(`${base}/${created[0].id}`,{method:'DELETE'});
      }
      await call(`${base}/${env.id}`,{method:'PATCH',body:{key:env.key}});
      if((await list()).find(e=>e.id===env.id)?.key!==env.key)throw new Error();
    }catch{restored=false;}}
    throw new Error(restored?'Staging key update stopped; prior environment values restored. No deployment requested.':'Staging key update stopped; restoration requires review. No deployment requested.');
  }
  const deployment=await call('/v13/deployments',{method:'POST',body:{name:'mission-control-staging',project:stagingProjectId,target:'production',gitSource:{type:'github',repoId:1335188517,ref:'main',sha}}});
  if(!/^dpl_[A-Za-z0-9]+$/.test(deployment.id))throw new Error('Unexpected staging deployment response; do not resend.');
  let state=deployment;
  for(let attempt=0;attempt<100&&state.readyState!=='READY';attempt++){
    if(['ERROR','CANCELED'].includes(state.readyState))throw new Error('Staging deployment failed; previous live deployment remains the recovery reference.');
    await pause(3000);state=await call(`/v13/deployments/${deployment.id}`);
    if(state.projectId&&state.projectId!==stagingProjectId)throw new Error('Deployment project readback mismatch.');
  }
  if(state.readyState!=='READY')throw new Error('Staging deployment readiness not confirmed; do not resend.');
  let cfg;
  try{const r=await request('https://mission-control-staging.vercel.app/api/v1/auth-config',{method:'GET',cache:'no-store',signal:AbortSignal.timeout(20000)});if(r.ok)cfg=await r.json();}catch{}
  if(cfg?.ok!==true||cfg.publishableKey!==publishableKey)throw new Error('Staging alias has not confirmed the new Clerk key; stop for readback.');
  return {evidenceClass:'github-staging-clerk-migration-readback',projectId:stagingProjectId,deploymentId:deployment.id,ready:true,clerkKeyVerified:true,mealsEditingEnabled:false,julieReady:false};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const report=await migrateStagingClerk({token:process.env.STAGING_VERCEL_TOKEN,secretKey:process.env.STAGING_CLERK_SECRET_KEY,publishableKey:process.env.STAGING_CLERK_PUBLISHABLE_KEY,sha:process.env.GITHUB_SHA});console.log(JSON.stringify(report,null,2));console.log('::notice title=Staging Clerk migration verified::Ready deployment and staging alias use isolated Clerk keys; editing remains disabled.');}
 catch(error){console.error(`::error title=Staging Clerk migration stopped::${error.message}`);process.exitCode=1;}
}
