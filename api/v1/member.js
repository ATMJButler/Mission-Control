import {requireMissionControlOrigin} from '../../auth/origin.js';
import {installClerkIdentityAdapter} from '../../auth/clerk-adapter.js';
import {requireVerifiedIdentity} from '../../auth/session.js';
import {installUpstreamDirectoryAdapter} from '../../auth/upstream-directory.js';
import {resolveAccessContext} from '../../auth/directory.js';
import {authorize} from '../../auth/authorization.js';
import {validateSetupPreferences,callMemberSetup} from '../../auth/member-setup.js';
import {validateMemberMealEdit,editMemberMeals} from '../../auth/member-meals-edit.js';
import {readMemberDashboard} from '../../auth/member-dashboard.js';
import {validatePersonalRequest,handlePersonalConnection} from '../../auth/personal-connections.js';

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');res.setHeader('Vary','Cookie, Authorization, Origin');res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({ok:false,code:'METHOD_NOT_ALLOWED'});}
  try{
    requireMissionControlOrigin(req);installClerkIdentityAdapter();installUpstreamDirectoryAdapter();
    const identity=await requireVerifiedIdentity(req);
    let body;try{body=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{body=null;}
    if(['connections','connect_calendar','complete_connection','list_calendars','select_calendars','personal_schedule','disconnect_calendar'].includes(body?.operation)){
      if(!validatePersonalRequest(body)||(body.householdId!==undefined&&(typeof body.householdId!=='string'||!body.householdId.trim()||body.householdId.length>120)))return res.status(400).json({ok:false,code:'PERSONAL_CONNECTIONS_INVALID'});
      const ctx=await resolveAccessContext(identity,body.householdId||process.env.MC_DEFAULT_HOUSEHOLD_ID||'butler-household');
      const auth=authorize({...ctx,resource:'member_workspace',operation:'read'});
      if(!auth.ok)return res.status(403).json({ok:false,code:'PERSONAL_CONNECTIONS_FORBIDDEN'});
      const result=await handlePersonalConnection(body,{actor:auth.userId,householdId:auth.householdId,sessionId:identity.sessionId});
      return res.status(200).json(result);
    }
    const saving=body?.operation==='save',editing=['edit_meals','edit_groceries'].includes(body?.operation);
    const fields=editing?['operation','householdId','expectedVersion','rows']:saving?['operation','householdId','expectedVersion','preferences']:['operation','householdId'];
    if(!body||typeof body!=='object'||Array.isArray(body)||!['read','save','dashboard','edit_meals','edit_groceries'].includes(body.operation)||Object.keys(body).some(key=>!fields.includes(key))||
      (body.householdId!==undefined&&(typeof body.householdId!=='string'||!body.householdId.trim()||body.householdId.length>120))||
      (editing&&(!Number.isSafeInteger(body.expectedVersion)||body.expectedVersion<1||body.expectedVersion>=Number.MAX_SAFE_INTEGER||!validateMemberMealEdit(body.operation,body.rows)))||
      (saving&&(!Number.isSafeInteger(body.expectedVersion)||body.expectedVersion<0||body.expectedVersion>=Number.MAX_SAFE_INTEGER||!validateSetupPreferences(body.preferences))))return res.status(400).json({ok:false,code:'MEMBER_SETUP_INVALID'});
    const ctx=await resolveAccessContext(identity,body.householdId||process.env.MC_DEFAULT_HOUSEHOLD_ID||'butler-household');
    const dashboard=body.operation==='dashboard';
    const auth=authorize({...ctx,resource:editing?'member_meals':dashboard?'member_workspace':'member_setup',operation:editing?'edit':dashboard?'read':body.operation});
    if(!auth.ok)return res.status(403).json({ok:false,code:'MEMBER_SETUP_FORBIDDEN'});
    if(editing){
      if(process.env.MC_MEMBER_MEALS_EDIT!=='enabled'||process.env.MC_MEMBER_DASHBOARD!=='enabled')return res.status(503).json({ok:false,code:'MEMBER_MEALS_DISABLED'});
      return res.status(200).json(await editMemberMeals({actor:auth.userId,householdId:auth.householdId,operation:body.operation,expectedVersion:body.expectedVersion,rows:body.rows}));
    }
    if(dashboard){
      if(process.env.MC_MEMBER_DASHBOARD!=='enabled')return res.status(503).json({ok:false,code:'MEMBER_DASHBOARD_DISABLED'});
      return res.status(200).json(await readMemberDashboard({actor:auth.userId,householdId:auth.householdId}));
    }
    if(process.env.MC_MEMBER_SETUP!=='enabled')return res.status(503).json({ok:false,code:'MEMBER_SETUP_DISABLED'});
    const result=await callMemberSetup({operation:body.operation,householdId:auth.householdId,actor:auth.userId,...(saving?{expectedVersion:body.expectedVersion,preferences:body.preferences}:{})});
    return res.status(200).json(result);
  }catch(error){
    const allowed=new Set(['UNAUTHENTICATED','USER_NOT_PROVISIONED','IDENTITY_BINDING_NOT_UNIQUE','HOUSEHOLD_INACTIVE_OR_MISSING','MEMBERSHIP_INACTIVE_OR_MISSING','MEMBERSHIP_NOT_UNIQUE','ORIGIN_FORBIDDEN','CROSS_SITE_FORBIDDEN','MEMBER_SETUP_DISABLED','MEMBER_SETUP_FORBIDDEN','MEMBER_SETUP_INVALID','MEMBER_SETUP_CONFLICT','MEMBER_SETUP_SCHEMA_INVALID','MEMBER_SETUP_OUTCOME_UNKNOWN','MEMBER_DASHBOARD_DISABLED','MEMBER_DASHBOARD_FORBIDDEN','MEMBER_MEALS_DISABLED','MEMBER_MEALS_INVALID','MEMBER_MEALS_CONFLICT','MEMBER_MEALS_FORBIDDEN','MEMBER_MEALS_OUTCOME_UNKNOWN','MEMBER_MEALS_UNAVAILABLE']);
    for(const code of ['PERSONAL_CONNECTIONS_INVALID','PERSONAL_CONNECTIONS_DISABLED','PERSONAL_CONNECTIONS_UNAVAILABLE','PERSONAL_CONNECTIONS_FORBIDDEN','PERSONAL_CONNECTIONS_CONFLICT','PERSONAL_CONNECTIONS_SCHEMA_INVALID','PERSONAL_CONNECTIONS_CONSENT_EXPIRED','PERSONAL_CONNECTIONS_OUTCOME_UNKNOWN','PERSONAL_PROVIDER_NOT_CONFIGURED','PERSONAL_PROVIDER_UNAVAILABLE','PERSONAL_PROVIDER_LIMIT','PERSONAL_RECONNECT_REQUIRED'])allowed.add(code);
    return res.status([400,401,403,409,503].includes(error?.statusCode)?error.statusCode:503).json({ok:false,code:allowed.has(error?.code)?error.code:'MEMBER_SETUP_UNAVAILABLE'});
  }
}
