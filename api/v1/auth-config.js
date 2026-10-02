export default function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  if(req.method!=="GET"){res.setHeader("Allow","GET");return res.status(405).json({ok:false,error:"Method not allowed"});}
  const publishableKey=process.env.CLERK_PUBLISHABLE_KEY;
  if(!publishableKey)return res.status(503).json({ok:false,error:"Authentication is not configured."});
  return res.status(200).json({ok:true,provider:"clerk",publishableKey});
}
