import {pathToFileURL} from 'node:url';

export const stagingProjectId='prj_ZHEWWlU4WHHQRrvhHAXg4rGKcglf';

export async function checkStagingVercel({token,publishableKey,request=fetch}) {
  if (!token) throw new Error('STAGING_VERCEL_TOKEN is missing from GitHub secrets.');
  const read=async path=>{
    let response;
    try { response=await request('https://api.vercel.com'+path,{method:'GET',headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(20000)}); }
    catch { throw new Error('Vercel connectivity failed; transport details omitted.'); }
    if (!response.ok) return {status:response.status};
    try { return {status:response.status,body:await response.json()}; }
    catch { throw new Error('Vercel returned an unreadable response; contents omitted.'); }
  };
  let project=await read(`/v9/projects/${stagingProjectId}`);
  if ([403,404].includes(project.status)) {
    const teams=await read('/v2/teams?limit=100');
    if (!teams.body || !Array.isArray(teams.body.teams)) throw new Error(`Cannot discover Vercel token team scope (HTTP ${teams.status}).`);
    for (const team of teams.body.teams) {
      if (!/^team_[a-zA-Z0-9]+$/.test(team.id)) continue;
      const scoped=await read(`/v9/projects/${stagingProjectId}?teamId=${encodeURIComponent(team.id)}`);
      if (scoped.body) { project=scoped;break; }
      if (![403,404].includes(scoped.status)) throw new Error(`Staging Vercel project read failed (HTTP ${scoped.status}).`);
    }
  }
  if (!project.body) throw new Error(`Staging Vercel project read failed (HTTP ${project.status}); token contents omitted.`);
  if (project.body.id!==stagingProjectId || project.body.name!=='mission-control-staging')
    throw new Error('Vercel project identity does not match the staging allowlist. Stopped.');
  const teamId=project.body.accountId;
  if (!/^team_[a-zA-Z0-9]+$/.test(teamId)) throw new Error('Expected a team-owned staging project.');
  let clerkAliasMatchesPreparedInstance;
  if(publishableKey){try{const r=await request('https://mission-control-staging.vercel.app/api/v1/auth-config',{method:'GET',cache:'no-store',signal:AbortSignal.timeout(20000)});const cfg=r.ok?await r.json():null;clerkAliasMatchesPreparedInstance=cfg?.ok===true&&cfg.publishableKey===publishableKey;}catch{clerkAliasMatchesPreparedInstance=false;}}
  return {clerkAliasMatchesPreparedInstance,evidenceClass:'github-staging-vercel-read-only-preflight',projectId:stagingProjectId,projectName:'mission-control-staging',teamId,writesRequested:0,julieReady:false};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {
    const report=await checkStagingVercel({token:process.env.STAGING_VERCEL_TOKEN,publishableKey:process.env.STAGING_CLERK_PUBLISHABLE_KEY});
    console.log(JSON.stringify(report,null,2));
    console.log(`::notice title=Staging Vercel project verified::Project ${report.projectId}; team ${report.teamId}; isolated Clerk alias ${report.clerkAliasMatchesPreparedInstance}; writes requested 0.`);
  } catch(error) {
    console.error(`::error title=Staging Vercel check failed::${error.message}`);
    process.exitCode=1;
  }
}
