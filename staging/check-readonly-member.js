// Read-only authenticated checkpoint. Paste once into the staging Console.
(async () => {
  if (location.hostname !== 'mission-control-staging.vercel.app') throw new Error('Staging only.');
  const call = async (url,body) => {
    const response = await fetch(url,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',
      ...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
    return {status:response.status,body:await response.json()};
  };
  const results=[];
  const workspace=await call('/api/v1/workspace',{});
  const role=workspace.body.workspace?.role;
  results.push({check:'Secondary workspace',status:workspace.status,pass:workspace.status===200&&workspace.body.ok===true&&role==='secondary'&&workspace.body.workspace.principalWorkspace===false&&workspace.body.workspace.memberDashboardReady===true});
  if(!results[0].pass){console.table(results);throw new Error('Secondary staging context required. Stopped.');}
  const dashboard=await call('/api/v1/member',{operation:'dashboard'});
  const meals=dashboard.body.dashboard?.meals;
  results.push({check:'Read-only member Meals',status:dashboard.status,pass:dashboard.status===200&&dashboard.body.ok===true&&Number.isSafeInteger(meals?.version)&&meals.version>0&&dashboard.body.dashboard.capabilities?.mealsEdit===false});
  if(!results[1].pass){console.table(results);throw new Error('Read-only Meals required. Stopped.');}
  const diagnostics=await call('/api/v1/diagnostics',{householdId:'butler-household'});
  results.push({check:'Principal diagnostics denied',status:diagnostics.status,pass:diagnostics.status===403&&diagnostics.body.ok===false&&diagnostics.body.code==='DIAGNOSTICS_FORBIDDEN'});
  const legacy=await call('/api/sync');
  results.push({check:'Legacy principal data denied',status:legacy.status,pass:legacy.status===403&&legacy.body.ok===false&&legacy.body.code==='LEGACY_PRINCIPAL_REQUIRED'});
  const report={evidenceClass:'authenticated-staging-read-only-checkpoint',checkedAt:new Date().toISOString(),mealsVersion:meals.version,results,
    commissioningComplete:false,julieReady:false};
  console.table(results);console.log(JSON.stringify(report,null,2));
  if(results.some(row=>!row.pass))throw new Error('A boundary check failed. No mutations were requested; stop for review.');
  return report;
})();
