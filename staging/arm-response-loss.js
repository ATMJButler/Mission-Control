// Staging browser fault injection: discards one successful grocery-save response.
// It sends no mutation itself. A human must click Save once in the normal editor.
(async () => {
  if (location.hostname !== 'mission-control-staging.vercel.app') throw new Error('Staging only.');
  const frame=document.getElementById('core');
  const target=frame?.contentWindow || window;
  if(target.location.hostname !== location.hostname || target.location.pathname !== '/member.html')
    throw new Error('Open the staging member dashboard first.');
  if(target.__mcStagingLossCancel)throw new Error('A fault check is already armed.');
  const original=target.fetch;
  const response=await original.call(target,'/api/v1/member',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'dashboard'}),signal:AbortSignal.timeout(20000)});
  const snapshot=await response.json(),dashboard=snapshot.dashboard;
  if(!response.ok||snapshot.ok!==true||dashboard?.capabilities?.mealsEdit!==true||dashboard.meals?.version!==10)
    throw new Error('Verified editable staging fixture at version 10 required. Nothing armed.');
  let timer;
  const cancel=()=>{if(target.fetch===wrapped)target.fetch=original;delete target.__mcStagingLossCancel;clearTimeout(timer);};
  const wrapped=async function(input,options){
    let body;
    try{body=JSON.parse(options?.body);}catch{return original.call(this,input,options);}
    if(new URL(typeof input==='string'?input:input.url,target.location.href).pathname!=='/api/v1/member'||options?.method!=='POST'||body.operation!=='edit_groceries')
      return original.call(this,input,options);
    cancel(); // Restore before send: never intercept readback or a second save.
    if(body.expectedVersion!==10)throw new Error('Staging baseline changed; no fault-test write sent.');
    const saved=await original.call(this,input,options);
    let result;try{result=await saved.clone().json();}catch{return saved;}
    if(!saved.ok||result.ok!==true||result.previousVersion!==10||result.newVersion!==11)return saved;
    console.log('STAGING FAULT: successful grocery response deliberately discarded; expected committed version 11. No automatic retry.');
    throw new TypeError('Simulated staging response loss after successful save.');
  };
  target.fetch=wrapped;target.__mcStagingLossCancel=cancel;
  timer=setTimeout(()=>{cancel();console.log('Staging fault expired without another request being intercepted.');},120000);
  console.log('Armed for one grocery save for 2 minutes. Change TEST apples quantity 5→6, keep bought checked, and Save once. Readback should confirm version 11.');
})();
