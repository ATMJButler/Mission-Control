import test from 'node:test';
import assert from 'node:assert/strict';
import {beginPersonalOAuth,validatePersonalOAuthState,sealPersonalSecret,openPersonalSecret} from './personal-oauth.js';
const config={provider:'google',purpose:'calendar',clientId:'client',redirectUri:'https://mission-control-staging.vercel.app/api/v1/member',actor:'member',householdId:'home',sessionId:'session',encryptionKey:'ab'.repeat(32),now:1000};
test('consent separates calendar/email scopes, uses PKCE and hides callback ownership',()=>{
  for(const provider of ['google','microsoft'])for(const purpose of ['calendar','email']){
    const result=beginPersonalOAuth({...config,provider,purpose});const url=new URL(result.authorizationUrl);
    assert.equal(url.searchParams.get('code_challenge_method'),'S256');
    assert.ok(!url.searchParams.get('scope').toLowerCase().includes('write'));
    assert.ok(!url.searchParams.get('scope').includes(purpose==='calendar'?'Mail.Read':'Calendars.Read'));
    const state=url.searchParams.get('state');assert.ok(!state.includes('member'));
    const opened=validatePersonalOAuthState({...config,state});assert.equal(opened.provider,provider);assert.equal(opened.purpose,purpose);assert.equal(opened.nonce,result.nonce);
  }
});
test('callback rejects altered state, account/session/household changes and expiry',()=>{
  const state=new URL(beginPersonalOAuth(config).authorizationUrl).searchParams.get('state');
  for(const changes of [{actor:'other'},{householdId:'other'},{sessionId:'other'},{redirectUri:'https://evil.example/callback'},{now:601000},{now:-1},{state:state.slice(0,-5)+'AAAAA'}])assert.throws(()=>validatePersonalOAuthState({...config,state,...changes}),/PERSONAL_OAUTH_INVALID/);
});
test('encrypted token envelopes reject other owners, key rotation and tampering',()=>{
  const value=sealPersonalSecret({refreshToken:'secret'},config.encryptionKey,'connection:member:google');
  assert.deepEqual(openPersonalSecret(value,config.encryptionKey,'connection:member:google'),{refreshToken:'secret'});
  assert.throws(()=>openPersonalSecret(value,config.encryptionKey,'connection:other:google'),/PERSONAL_OAUTH_INVALID/);
  assert.throws(()=>openPersonalSecret(value,'cd'.repeat(32),'connection:member:google'),/PERSONAL_OAUTH_INVALID/);
  assert.throws(()=>beginPersonalOAuth({...config,redirectUri:'http://example.com/callback'}),/PERSONAL_OAUTH_INVALID/);
});
