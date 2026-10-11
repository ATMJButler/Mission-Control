export default function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  if(req.method!=="GET"){res.setHeader("Allow","GET");return res.status(405).json({ok:false,error:"Method not allowed"});}
  const publishableKey=process.env.CLERK_PUBLISHABLE_KEY;
  if(!publishableKey)return res.status(503).json({ok:false,error:"Authentication is not configured."});
  const origins=(process.env.MC_AUTHORIZED_PARTIES||'').split(',').map(value=>value.trim().replace(/\/$/,''));
  const signInOrigin=process.env.VERCEL_ENV==='production'&&publishableKey.startsWith('pk_live_')&&origins.includes('https://app.abovethemarkos.com')?'https://app.abovethemarkos.com':null;
  return res.status(200).json({ok:true,provider:"clerk",publishableKey,...(signInOrigin?{signInOrigin}:{})});
}
