import {pathToFileURL} from 'node:url';

export async function checkStagingClerk({secretKey,publishableKey,request=fetch}) {
  if (!secretKey?.startsWith('sk_test_') || !publishableKey?.startsWith('pk_test_'))
    throw new Error('Both staging Clerk development keys are required.');
  const host=Buffer.from(publishableKey.slice(8),'base64').toString('utf8').replace(/\$$/,'');
  if (!/^[a-z0-9-]+\.clerk\.accounts\.dev$/.test(host))
    throw new Error('Expected a Clerk development frontend domain.');
  const read=async(url,authenticated=false)=>{
    let response;
    try { response=await request(url,{method:'GET',headers:authenticated?{Authorization:`Bearer ${secretKey}`}:{},signal:AbortSignal.timeout(20000)}); }
    catch { throw new Error('Clerk connectivity failed; transport details omitted.'); }
    if (!response.ok) throw new Error(`Clerk read failed (HTTP ${response.status}); response contents omitted.`);
    try { return await response.json(); }
    catch { throw new Error('Clerk returned an unreadable response; contents omitted.'); }
  };
  const backend=await read('https://api.clerk.com/v1/jwks',true);
  const frontend=await read(`https://${host}/.well-known/jwks.json`);
  const keysMatch=Array.isArray(backend.keys)&&Array.isArray(frontend.keys)&&backend.keys.length>0&&backend.keys.every(key=>frontend.keys.some(other=>key.kid===other.kid&&key.kty===other.kty&&key.n===other.n&&key.e===other.e));
  if (!keysMatch) throw new Error('Clerk publishable and secret keys do not identify the same signing keys.');
  const users=await read('https://api.clerk.com/v1/users/count',true);
  if (!Number.isSafeInteger(users.total_count)||users.total_count<0)
    throw new Error('Clerk user-count response is invalid.');
  return {evidenceClass:'github-staging-clerk-read-only-key-check',developmentKeys:true,keysMatch:true,userCount:users.total_count,emptyInstance:users.total_count===0,writesRequested:0,julieReady:false};
}

if (process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {
    const report=await checkStagingClerk({secretKey:process.env.STAGING_CLERK_SECRET_KEY,publishableKey:process.env.STAGING_CLERK_PUBLISHABLE_KEY});
    console.log(JSON.stringify(report,null,2));
    console.log(`::notice title=Staging Clerk keys verified::Development keys match; user count ${report.userCount}; writes requested 0.`);
  } catch(error) {
    console.error(`::error title=Staging Clerk check failed::${error.message}`);
    process.exitCode=1;
  }
}
