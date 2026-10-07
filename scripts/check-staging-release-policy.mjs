import {pathToFileURL} from 'node:url';
export async function checkStagingReleasePolicy({token,request=fetch}){
 const base='https://api.github.com/repos/ATMJButler/Mission-Control/environments/staging-apps-script';
 const read=async suffix=>{let response;try{response=await request(base+suffix,{headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json'},redirect:'error',signal:AbortSignal.timeout(15000)});}catch{throw Error('Staging Environment protection could not be verified.');}if(!response.ok)throw Error('Create and protect staging-apps-script Environment before supplying its staging-only credential.');return response.json();};
 const environment=await read('');
 if(environment.name!=='staging-apps-script'||!environment.protection_rules?.some(r=>r.type==='required_reviewers'&&r.reviewers?.some(v=>v.type==='User'&&v.reviewer?.id===315165841))||environment.deployment_branch_policy?.custom_branch_policies!==true||environment.deployment_branch_policy?.protected_branches!==false)throw Error('Staging Environment requires owner review and custom main-only branch protection.');
 const policies=await read('/deployment-branch-policies');if(!Array.isArray(policies.branch_policies)||policies.branch_policies.length!==1||policies.branch_policies[0].name!=='main'||policies.branch_policies[0].type!=='branch')throw Error('Staging Environment must allow only the main branch.');
 return{ownerReviewRequired:true,mainOnly:true,writesRequested:0};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{console.log(JSON.stringify(await checkStagingReleasePolicy({token:process.env.GITHUB_TOKEN})));}catch(error){console.error('::error title=Staging release protection required::'+error.message);process.exitCode=1;}}
