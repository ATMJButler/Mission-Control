export function personalConnectionError(code,statusCode=503){return Object.assign(new Error('Personal connection unavailable'),{code,statusCode});}
export async function callPersonalStore({actor,householdId,provider,purpose,operation='read',...payload},{request=fetch}={}){
  if(!process.env.MC_SYNC_URL||!process.env.MC_SYNC_TOKEN)throw personalConnectionError('PERSONAL_CONNECTIONS_UNAVAILABLE');
  const uncertain=operation!=='read';let response,body;
  try{
    response=await request(process.env.MC_SYNC_URL,{method:'POST',cache:'no-store',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({resource:'personal_connections',token:process.env.MC_SYNC_TOKEN,actor,householdId,provider,purpose,operation,...payload})});
    body=await response.json();
  }catch{throw personalConnectionError(uncertain?'PERSONAL_CONNECTIONS_OUTCOME_UNKNOWN':'PERSONAL_CONNECTIONS_UNAVAILABLE');}
  if(response.ok&&body?.ok!==true){
    const codes={PERSONAL_CONNECTIONS_DISABLED:503,PERSONAL_CONNECTIONS_INVALID:400,PERSONAL_CONNECTIONS_CONFLICT:409,PERSONAL_CONNECTIONS_SCHEMA_INVALID:503,PERSONAL_CONNECTIONS_CONSENT_EXPIRED:409,MEMBER_SETUP_FORBIDDEN:403};
    if(Object.hasOwn(codes,body?.error))throw personalConnectionError(body.error==='MEMBER_SETUP_FORBIDDEN'?'PERSONAL_CONNECTIONS_FORBIDDEN':body.error,codes[body.error]);
  }
  const record=body?.record;
  if(!response.ok||body?.ok!==true||!record||!Number.isSafeInteger(record.version)||record.version<0||typeof record.ciphertext!=='string'||record.ciphertext.length>40000||typeof record.nonce!=='string'||(record.nonce!==''&&!/^[A-Za-z0-9_-]{43}$/.test(record.nonce))||!Number.isSafeInteger(record.expiresAt)||record.expiresAt<0||(record.nonce===''&&record.expiresAt!==0)||
    (operation==='save'&&(record.version!==payload.expectedVersion+1||record.ciphertext!==payload.ciphertext||record.nonce!==payload.nonce||record.expiresAt!==payload.expiresAt))||
    (operation==='consume'&&(record.nonce!==''||record.expiresAt!==0)))throw personalConnectionError(uncertain?'PERSONAL_CONNECTIONS_OUTCOME_UNKNOWN':'PERSONAL_CONNECTIONS_UNAVAILABLE');
  return record;
}
