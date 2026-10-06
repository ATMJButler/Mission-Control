import {pathToFileURL} from 'node:url';
import {checkStagingGoogle} from './check-staging-google.mjs';
import {checkStagingClerk} from './check-staging-clerk.mjs';

const sheet='18eft4EyxSy1lCtydd5dwuu20iMiJOBV0AAiHq4gu05Y';
export const testEmail='mc-automation+clerk_test@example.com';
export const testUserId='staging-automation-member';
const membershipId='staging-automation-membership';
const userHeaders=['userId','status','displayName','identityProvider','providerSubject','email','createdAt','updatedAt','notes'];
const memberHeaders=['membershipId','householdId','userId','role','status','createdAt','updatedAt','notes'];
const marker='Mission Control isolated staging automation';

export async function prepareStagingIdentity({googleToken,secretKey,publishableKey,request=fetch}) {
  const baseline=await checkStagingGoogle({token:googleToken,request});
  if(!baseline.pass)throw new Error('Version-13 staging fixture required before provisioning.');
  const clerk=await checkStagingClerk({secretKey,publishableKey,request});
  if(clerk.userCount>1)throw new Error('Dedicated Clerk instance contains unexpected users.');
  const call=async(url,{method='GET',body,google=false}={})=>{
    let r;try{r=await request(url,{method,headers:{Authorization:`Bearer ${google?googleToken:secretKey}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});}
    catch{throw new Error('Provisioning request outcome uncertain; no retry sent. Read back before continuing.');}
    if(!r.ok)throw new Error(`Provisioning request failed (HTTP ${r.status}); no retry sent; contents omitted.`);
    try{return await r.json();}catch{throw new Error('Provisioning response unreadable; no retry sent.');}
  };
  const rows=async(name)=>{
    const result=await call(`https://sheets.googleapis.com/v4/spreadsheets/${sheet}/values/${encodeURIComponent("'"+name+"'!A1:I100")}`,{google:true});
    if(!Array.isArray(result.values)||result.values.length>=100)throw new Error('Staging directory exceeds bounded fixture size.');
    return result.values;
  };
  const beforeUsers=await rows('Users'),beforeMembers=await rows('Household Memberships');
  if(JSON.stringify(beforeUsers[0])!==JSON.stringify(userHeaders)||JSON.stringify(beforeMembers[0])!==JSON.stringify(memberHeaders))throw new Error('Staging directory schema mismatch.');
  const prior=beforeUsers.slice(1).filter(row=>row[0]===testUserId);
  const priorMember=beforeMembers.slice(1).filter(row=>row[0]===membershipId||row[2]===testUserId);
  if(prior.length>1||priorMember.length>1)throw new Error('Automation directory binding ambiguous.');
  const found=await call('https://api.clerk.com/v1/users?'+new URLSearchParams({'email_address[]':testEmail}));
  if(!Array.isArray(found)||found.length>1)throw new Error('Automation Clerk identity ambiguous.');
  if((clerk.userCount!==found.length)||(!found.length&&(prior.length||priorMember.length)))throw new Error('Unexpected existing account or directory binding.');
  let user=found[0];
  if(user&&user.private_metadata?.purpose!==marker)throw new Error('Existing Clerk identity is not the automation fixture.');
  if(!user)user=await call('https://api.clerk.com/v1/users',{method:'POST',body:{email_address:[testEmail],first_name:'Staging',last_name:'Automation',skip_password_requirement:true,private_metadata:{purpose:marker}}});
  if(!/^user_[A-Za-z0-9]+$/.test(user.id))throw new Error('Unexpected Clerk identity response.');
  if(beforeUsers.slice(1).some(row=>row[4]===user.id&&row[0]!==testUserId))throw new Error('Clerk subject already bound to another directory user.');
  if(prior.length&&(prior[0][1]!=='active'||prior[0][3]!=='clerk'||prior[0][4]!==user.id||prior[0][5]!==testEmail||prior[0][8]!==marker))throw new Error('Existing automation directory user mismatch.');
  if(priorMember.length&&(priorMember[0][0]!==membershipId||priorMember[0][1]!=='butler-household'||priorMember[0][3]!=='secondary'||priorMember[0][4]!=='active'||priorMember[0][7]!==marker))throw new Error('Existing automation membership mismatch.');
  const now=new Date().toISOString(),data=[];
  if(!prior.length)data.push({range:`'Users'!A${beforeUsers.length+1}:I${beforeUsers.length+1}`,values:[[testUserId,'active','Staging Automation','clerk',user.id,testEmail,now,now,marker]]});
  if(!priorMember.length)data.push({range:`'Household Memberships'!A${beforeMembers.length+1}:H${beforeMembers.length+1}`,values:[[membershipId,'butler-household',testUserId,'secondary','active',now,now,marker]]});
  if(data.length)await call(`https://sheets.googleapis.com/v4/spreadsheets/${sheet}/values:batchUpdate`,{google:true,method:'POST',body:{valueInputOption:'RAW',data}});
  const afterUsers=await rows('Users'),afterMembers=await rows('Household Memberships');
  if(JSON.stringify(afterUsers.slice(0,beforeUsers.length))!==JSON.stringify(beforeUsers)||JSON.stringify(afterMembers.slice(0,beforeMembers.length))!==JSON.stringify(beforeMembers))throw new Error('Existing directory rows changed; stop for review.');
  const bound=afterUsers.filter(row=>row[0]===testUserId&&row[4]===user.id&&row[1]==='active');
  const member=afterMembers.filter(row=>row[0]===membershipId&&row[2]===testUserId&&row[1]==='butler-household'&&row[3]==='secondary'&&row[4]==='active');
  if(bound.length!==1||member.length!==1)throw new Error('Provisioning readback did not confirm unique secondary binding.');
  const after=await checkStagingGoogle({token:googleToken,request});
  if(!after.pass)throw new Error('Meals fixture changed during provisioning.');
  return {evidenceClass:'github-staging-identity-provisioning-readback',syntheticMemberReady:true,role:'secondary',directoryRowsAdded:data.length,mealsVersion:13,priorDirectoryRowsPreserved:true,julieReady:false};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const report=await prepareStagingIdentity({googleToken:process.env.STAGING_GOOGLE_ACCESS_TOKEN,secretKey:process.env.STAGING_CLERK_SECRET_KEY,publishableKey:process.env.STAGING_CLERK_PUBLISHABLE_KEY});console.log(JSON.stringify(report,null,2));console.log('::notice title=Staging synthetic identity ready::Unique active secondary binding verified; prior directory rows preserved; Meals version 13.');}
 catch(error){console.error(`::error title=Staging identity preparation stopped::${error.message}`);process.exitCode=1;}
}
