// Paste once into the signed-in staging Console. No tokens or identities printed.
(async () => {
  if (location.hostname !== 'mission-control-staging.vercel.app') throw new Error('Staging only.');
  const call = async body => {
    const response = await fetch('/api/v1/member', {method:'POST',credentials:'same-origin',cache:'no-store',
      headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
    return {status:response.status,body:await response.json()};
  };
  const read = async () => {
    const result = await call({operation:'dashboard'});
    if (result.status !== 200 || result.body.ok !== true || !Number.isSafeInteger(result.body.dashboard?.meals?.version))
      throw new Error('Verified Meals read required. No rejection tests sent.');
    return result.body.dashboard;
  };
  const baseline = await read(), fingerprint = JSON.stringify(baseline.meals), version = baseline.meals.version;
  const base = {operation:'edit_groceries',expectedVersion:version,rows:[{item:'TEST apples',qty:'5',done:true}]};
  const cases = [
    ['blank grocery name',{...base,rows:[{item:'',qty:'5',done:true}]}],
    ['numeric quantity',{...base,rows:[{item:'TEST apples',qty:5,done:true}]}],
    ['string bought flag',{...base,rows:[{item:'TEST apples',qty:'5',done:'true'}]}],
    ['extra row authority',{...base,rows:[{item:'TEST apples',qty:'5',done:true,role:'principal'}]}],
    ['top-level actor authority',{...base,actor:'TEST forbidden actor'}],
    ['impossible calendar date',{operation:'edit_meals',expectedVersion:version,rows:[{date:'2026-02-30',meal:'TEST invalid',prep:''}]}]
  ];
  const results = [];
  for (const [test,body] of cases) {
    const response = await call(body);
    // Always reconcile before deciding whether another test may be sent.
    const after = await read(), unchanged = JSON.stringify(after.meals) === fingerprint;
    results.push({test,status:response.status,code:response.body.code,version:after.meals.version,unchanged});
    if (response.status !== 400 || response.body.code !== 'MEMBER_SETUP_INVALID' || !unchanged) {
      console.table(results);throw new Error('Unexpected outcome: stopped. Do not retry.');
    }
  }
  console.table(results);
  console.log('Six invalid requests rejected; projected Meals unchanged after each. Physical-sheet comparison remains required.');
  return results;
})();
