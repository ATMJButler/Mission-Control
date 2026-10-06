import {chromium} from 'playwright';
import {checkStagingClerk} from './check-staging-clerk.mjs';
import {testEmail} from './prepare-staging-identity.mjs';

const origin='https://mission-control-staging.vercel.app';
let browser,phase='Clerk preflight';
try {
  const secretKey=process.env.STAGING_CLERK_SECRET_KEY,publishableKey=process.env.STAGING_CLERK_PUBLISHABLE_KEY;
  const verified=await checkStagingClerk({secretKey,publishableKey});
  if(verified.userCount!==1)throw new Error('Isolated single-user Clerk fixture required.');
  const clerk=async(path,body)=>{
    const r=await fetch('https://api.clerk.com/v1'+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${secretKey}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
    if(!r.ok)throw new Error(`Browser credential preparation failed (HTTP ${r.status}); contents omitted.`);
    try{return await r.json();}catch{throw new Error('Browser credential response unreadable.');}
  };
  const users=await clerk('/users?'+new URLSearchParams({'email_address[]':testEmail}));
  if(!Array.isArray(users)||users.length!==1||users[0].private_metadata?.purpose!=='Mission Control isolated staging automation')throw new Error('Marked synthetic Clerk user required.');
  phase='short-lived ticket creation';
  const ticket=await clerk('/sign_in_tokens',{user_id:users[0].id,expires_in_seconds:60});
  if(typeof ticket.token!=='string')throw new Error('Short-lived sign-in ticket missing.');
  console.log(`::add-mask::${ticket.token}`);
  phase='browser startup';
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext();
  const page=await context.newPage();
  phase='staging page and Clerk loading';
  await page.goto(origin,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.Clerk?.loaded===true,{},{timeout:45000});
  phase='isolated staging sign-in';
  await page.evaluate(async({ticket,key})=>{
    const cfg=await fetch('/api/v1/auth-config',{cache:'no-store'}).then(r=>r.json());
    if(cfg.publishableKey!==key)throw new Error('Wrong staging Clerk configuration.');
    const signed=await window.Clerk.client.signIn.create({strategy:'ticket',ticket});
    if(signed.status!=='complete'||!signed.createdSessionId)throw new Error('Synthetic browser sign-in incomplete.');
    await window.Clerk.setActive({session:signed.createdSessionId});
  },{ticket:ticket.token,key:publishableKey});
  phase='secondary workspace routing';
  await page.waitForFunction(()=>document.getElementById('core')?.getAttribute('src')==='/member.html',{},{timeout:45000});
  phase='authenticated boundary reads';
  const result=await page.evaluate(async()=>{
    const read=async(url,body)=>{const r=await fetch(url,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()};};
    const workspace=await read('/api/v1/workspace',{}),dashboard=await read('/api/v1/member',{operation:'dashboard'}),diagnostics=await read('/api/v1/diagnostics',{householdId:'butler-household'}),legacy=await read('/api/sync');
    const meals=dashboard.body.dashboard?.meals;
    return {workspace:workspace.status===200&&workspace.body.workspace?.role==='secondary'&&workspace.body.workspace.principalWorkspace===false,readOnlyMeals:dashboard.status===200&&dashboard.body.dashboard?.capabilities?.mealsEdit===false&&meals?.version===13,diagnosticsDenied:diagnostics.status===403&&diagnostics.body.code==='DIAGNOSTICS_FORBIDDEN',legacyDenied:legacy.status===403&&legacy.body.code==='LEGACY_PRINCIPAL_REQUIRED'};
  });
  phase='Meals UI verification';
  const frame=page.frameLocator('#core');
  await frame.getByRole('button',{name:'Meals',exact:true}).click();
  await frame.getByText('TEST apples · 6',{exact:false}).waitFor({timeout:20000});
  result.readOnlyUI=await frame.getByRole('button',{name:'Edit grocery list',exact:true}).count()===0;
  if(!Object.values(result).every(Boolean))throw new Error('Authenticated staging browser boundary check failed.');
  console.log(JSON.stringify({evidenceClass:'automated-authenticated-staging-browser-read-only',checks:result,mealsVersion:13,julieReady:false},null,2));
  console.log('::notice title=Staging browser checkpoint passed::Synthetic secondary signed in; version 13 read-only UI verified; principal diagnostics and legacy data denied.');
} catch(error) {
  // Browser exceptions may contain credentials or page data: do not print them.
  console.error(`::error title=Staging browser checkpoint stopped::Phase ${phase}; browser authentication or boundary verification failed; no Meals mutation was requested.`);
  process.exitCode=1;
} finally {if(browser)await browser.close();}
