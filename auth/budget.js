import '../budget-model.js';
export const budgetModel=globalThis.MCBudget;
export function validateBudgetRequest(body){
  if(!body||typeof body!=='object'||Array.isArray(body)||!['read','save','activate','transaction','delete_transaction'].includes(body.operation))return false;
  const fields=['operation','householdId',...(body.operation==='read'?[]:['expectedVersion','requestId']),...(body.operation==='save'?['plan']:body.operation==='transaction'?['transaction']:body.operation==='delete_transaction'?['transactionId']:[])];
  if(Object.keys(body).some(k=>!fields.includes(k))||(body.householdId!==undefined&&(typeof body.householdId!=='string'||!body.householdId.trim()||body.householdId.length>120)))return false;
  if(body.operation==='read')return true;
  if(!Number.isSafeInteger(body.expectedVersion)||body.expectedVersion<0||body.expectedVersion>=Number.MAX_SAFE_INTEGER||typeof body.requestId!=='string'||!/^[-\w]{1,100}$/.test(body.requestId))return false;
  return body.operation==='save'?budgetModel.validate(body.plan):body.operation==='transaction'?budgetModel.validateTransaction(body.transaction)&&body.transaction.sourceId==='':body.operation==='delete_transaction'?typeof body.transactionId==='string'&&/^[-\w]{1,100}$/.test(body.transactionId):true;
}
export async function callBudget(payload){
  const writing=payload.operation!=='read',fail=()=>Object.assign(Error('Budget unavailable'),{statusCode:503,code:writing?'BUDGET_OUTCOME_UNKNOWN':'BUDGET_UNAVAILABLE'});
  if(!process.env.MC_SYNC_URL||!process.env.MC_SYNC_TOKEN)throw fail();
  let response,body;try{response=await fetch(process.env.MC_SYNC_URL,{method:'POST',cache:'no-store',signal:AbortSignal.timeout(30000),headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({...payload,resource:'budget_setup',token:process.env.MC_SYNC_TOKEN})});body=await response.json();}catch{throw fail();}
  if(!response.ok)throw fail();
  if(body?.ok!==true){const codes={BUDGET_INVALID:400,BUDGET_FORBIDDEN:403,BUDGET_CONFLICT:409,BUDGET_SCHEMA_INVALID:503};if(codes[body?.error])throw Object.assign(Error('Budget request rejected'),{code:body.error,statusCode:codes[body.error]});throw fail();}

  const r=body.record;if(!r||!Number.isSafeInteger(r.version)||r.version<0||!budgetModel.validate(r.draft)||(r.active!==null&&!budgetModel.validate(r.active))||!Array.isArray(r.transactions)||r.transactions.length>500||r.transactions.some(t=>!budgetModel.validateTransaction(t)))throw fail();
  if(writing&&(r.lastRequestId!==payload.requestId||r.version!==payload.expectedVersion+1))throw fail();
  return{ok:true,record:r};
}
