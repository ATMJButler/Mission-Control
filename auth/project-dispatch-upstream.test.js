import {projectDispatchEnabled,enqueueProjectOperation} from "./project-dispatch-upstream.js";
const before=process.env.MC_PROJECT_V1_DISPATCH,beforeUrl=process.env.MC_SYNC_URL,beforeToken=process.env.MC_SYNC_TOKEN,beforeFetch=globalThis.fetch;
function restore(){if(before===undefined)delete process.env.MC_PROJECT_V1_DISPATCH;else process.env.MC_PROJECT_V1_DISPATCH=before;if(beforeUrl===undefined)delete process.env.MC_SYNC_URL;else process.env.MC_SYNC_URL=beforeUrl;if(beforeToken===undefined)delete process.env.MC_SYNC_TOKEN;else process.env.MC_SYNC_TOKEN=beforeToken;globalThis.fetch=beforeFetch}
async function capture(validated,fetchImpl,operationId="ui_00000000-0000-4000-8000-000000000001"){
 globalThis.fetch=fetchImpl;let e;try{await enqueueProjectOperation({validated,householdId:"h1",userId:"u1",operationId})}catch(err){e=err}return e
}
try{
 delete process.env.MC_PROJECT_V1_DISPATCH;if(projectDispatchEnabled())throw new Error("dispatcher defaulted on");
 process.env.MC_PROJECT_V1_DISPATCH="enabled";if(!projectDispatchEnabled())throw new Error("dispatcher flag ignored");
 process.env.MC_SYNC_URL="https://private.invalid/exec";process.env.MC_SYNC_TOKEN="test-token";
 const validated={ok:true,operation:"update_project",resourceId:"p1",expectedVersion:2,patch:{name:"Renamed"}};
 async function expectError(result,status,code){const e=await capture(validated,async()=>({ok:true,status:200,text:async()=>JSON.stringify(result)}));if(!e||e.statusCode!==status||e.code!==code||!e.operationId)throw new Error("mapping failed "+JSON.stringify({status:e?.statusCode,code:e?.code,operationId:e?.operationId}))}
 await expectError({ok:false,error:"CONFLICT: stale version"},409,"CONFLICT");
 await expectError({ok:false,error:"INVALID: bad patch"},400,"INVALID");
 await expectError({ok:false,error:"FORBIDDEN: household mismatch"},403,"FORBIDDEN");
 await expectError({ok:false,error:"UNKNOWN: committed but audit failed"},502,"PROJECT_OUTCOME_UNKNOWN");
 let e=await capture(validated,async()=>({ok:true,status:200,text:async()=>{throw new Error("stream failed")}}));if(e?.code!=="PROJECT_OUTCOME_UNKNOWN"||!e.operationId)throw new Error("body read failure lost unknown outcome identity");
 e=await capture(validated,async()=>({ok:false,status:502,text:async()=>JSON.stringify({ok:false,error:"upstream failed"})}));if(e?.code!=="PROJECT_OUTCOME_UNKNOWN"||!e.operationId)throw new Error("non-2xx did not preserve unknown outcome identity");
 e=await capture(validated,async()=>({ok:true,status:200,text:async()=>"null"}));if(e?.code!=="PROJECT_RESPONSE_INVALID")throw new Error("JSON null response accepted");
 e=await capture(validated,async()=>({ok:true,status:200,text:async()=>JSON.stringify({ok:"true",previousVersion:2,newVersion:3,project:{id:"p1",version:3}})}));if(!e||e.code==="undefined")throw new Error("truthy nonboolean ok accepted");
 globalThis.fetch=async()=>({ok:true,status:200,text:async()=>JSON.stringify({ok:true,previousVersion:2,newVersion:3,project:{id:"other",version:3}})});
 let mismatch;try{await enqueueProjectOperation({validated,householdId:"h1",userId:"u1",operationId:"ui_00000000-0000-4000-8000-000000000002"})}catch(err){mismatch=err}if(mismatch?.code!=="PROJECT_RESPONSE_INVALID")throw new Error("identity mismatch accepted");
 globalThis.fetch=async()=>({ok:true,status:200,text:async()=>JSON.stringify({ok:true,previousVersion:2,newVersion:4,project:{id:"p1",version:4}})});
 mismatch=null;try{await enqueueProjectOperation({validated,householdId:"h1",userId:"u1",operationId:"ui_00000000-0000-4000-8000-000000000003"})}catch(err){mismatch=err}if(mismatch?.code!=="PROJECT_RESPONSE_INVALID")throw new Error("version mismatch accepted");
 console.log(JSON.stringify({ok:true,defaultOff:true,errorMapping:true,responseValidation:true,unknownOutcome:true}));
}finally{restore()}
