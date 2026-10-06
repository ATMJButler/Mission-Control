import {createCipheriv,createDecipheriv,createHash,randomBytes,timingSafeEqual} from 'node:crypto';

// Encrypted callback state is bound to the initiating verified member/session.
// A durable one-use nonce record is additionally required before token exchange.
const providers=Object.freeze({
  google:{authorization:'https://accounts.google.com/o/oauth2/v2/auth',scopes:{calendar:'https://www.googleapis.com/auth/calendar.readonly',email:'https://www.googleapis.com/auth/gmail.readonly'}},
  microsoft:{authorization:'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',scopes:{calendar:'Calendars.Read',email:'Mail.Read'}}
});
const invalid=()=>new Error('PERSONAL_OAUTH_INVALID');
const bounded=value=>typeof value==='string'&&value.length>0&&value.length<=1024;
function key(value){if(typeof value!=='string'||!/^[0-9a-f]{64}$/i.test(value))throw invalid();return Buffer.from(value,'hex');}
export function sealPersonalSecret(value,encryptionKey,context){
  if(!bounded(context))throw invalid();
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(encryptionKey),iv);
  cipher.setAAD(Buffer.from(context));
  const encrypted=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
  return Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64url');
}
export function openPersonalSecret(value,encryptionKey,context){
  try{
    if(!bounded(context)||typeof value!=='string'||value.length>16384||!/^[A-Za-z0-9_-]+$/.test(value))throw invalid();
    const bytes=Buffer.from(value,'base64url');if(bytes.length<29)throw invalid();
    const cipher=createDecipheriv('aes-256-gcm',key(encryptionKey),bytes.subarray(0,12));
    cipher.setAAD(Buffer.from(context));cipher.setAuthTag(bytes.subarray(12,28));
    return JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)),cipher.final()]).toString('utf8'));
  }catch{throw invalid();}
}
export function beginPersonalOAuth({provider,purpose,clientId,redirectUri,actor,householdId,sessionId,encryptionKey,now=Date.now()}){
  const spec=Object.hasOwn(providers,provider)?providers[provider]:null;
  if(!spec||!['calendar','email'].includes(purpose)||![clientId,actor,householdId,sessionId].every(bounded)||!Number.isSafeInteger(now))throw invalid();
  let callback;try{callback=new URL(redirectUri);}catch{throw invalid();}
  if(callback.protocol!=='https:'||callback.username||callback.password||callback.hash||callback.search)throw invalid();
  const nonce=randomBytes(32).toString('base64url'),verifier=randomBytes(32).toString('base64url');
  const payload={provider,purpose,actor,householdId,sessionId,redirectUri:callback.href,nonce,verifier,expiresAt:now+600000};
  const state=sealPersonalSecret(payload,encryptionKey,'personal-oauth-state-v1');
  const url=new URL(spec.authorization);
  url.searchParams.set('client_id',clientId);url.searchParams.set('redirect_uri',callback.href);
  url.searchParams.set('response_type','code');url.searchParams.set('state',state);
  url.searchParams.set('scope',provider==='microsoft'?'offline_access '+spec.scopes[purpose]:spec.scopes[purpose]);
  url.searchParams.set('code_challenge_method','S256');url.searchParams.set('code_challenge',createHash('sha256').update(verifier).digest('base64url'));
  if(provider==='google'){url.searchParams.set('access_type','offline');url.searchParams.set('prompt','consent');}
  return {authorizationUrl:url.href,nonce,expiresAt:payload.expiresAt};
}
export function validatePersonalOAuthState({state,encryptionKey,actor,householdId,sessionId,redirectUri,now=Date.now()}){
  const payload=openPersonalSecret(state,encryptionKey,'personal-oauth-state-v1');
  const equal=(a,b)=>bounded(a)&&bounded(b)&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
  if(!payload||!Object.hasOwn(providers,payload.provider)||!['calendar','email'].includes(payload.purpose)||!equal(payload.actor,actor)||!equal(payload.householdId,householdId)||!equal(payload.sessionId,sessionId)||!equal(payload.redirectUri,redirectUri)||!Number.isSafeInteger(now)||!Number.isSafeInteger(payload.expiresAt)||payload.expiresAt<=now||payload.expiresAt>now+600000||!/^[A-Za-z0-9_-]{43}$/.test(payload.nonce)||!/^[A-Za-z0-9_-]{43}$/.test(payload.verifier))throw invalid();
  return payload;
}
