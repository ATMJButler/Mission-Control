import {requireMissionControlOrigin} from '../../auth/origin.js';
import {installClerkIdentityAdapter} from '../../auth/clerk-adapter.js';
import {requireVerifiedIdentity} from '../../auth/session.js';
import {installUpstreamDirectoryAdapter} from '../../auth/upstream-directory.js';
import {resolveAccessContext} from '../../auth/directory.js';
import {authorize} from '../../auth/authorization.js';
import {validateBudgetRequest,callBudget} from '../../auth/budget.js';
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');res.setHeader('Vary','Cookie, Authorization, Origin');res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({ok:false,code:'METHOD_NOT_ALLOWED'});}
  try{
    requireMissionControlOrigin(req);installClerkIdentityAdapter();installUpstreamDirectoryAdapter();const identity=await requireVerifiedIdentity(req);
    let body;try{body=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{}
    if(!validateBudgetRequest(body))return res.status(400).json({ok:false,code:'BUDGET_INVALID'});
    const ctx=await resolveAccessContext(identity,body.householdId||process.env.MC_DEFAULT_HOUSEHOLD_ID||'butler-household');
    const auth=authorize({...ctx,resource:'budget_setup',operation:body.operation});if(!auth.ok)return res.status(403).json({ok:false,code:'BUDGET_FORBIDDEN'});
    return res.status(200).json(await callBudget({...body,householdId:auth.householdId,actor:auth.userId}));
  }catch(e){const allowed=['UNAUTHENTICATED','ORIGIN_FORBIDDEN','CROSS_SITE_FORBIDDEN','BUDGET_INVALID','BUDGET_FORBIDDEN','BUDGET_CONFLICT','BUDGET_SCHEMA_INVALID','BUDGET_OUTCOME_UNKNOWN'];return res.status([400,401,403,409,503].includes(e?.statusCode)?e.statusCode:503).json({ok:false,code:e?.statusCode===403?'BUDGET_FORBIDDEN':e?.statusCode===401?'UNAUTHENTICATED':allowed.includes(e?.code)?e.code:'BUDGET_UNAVAILABLE'});}
}
