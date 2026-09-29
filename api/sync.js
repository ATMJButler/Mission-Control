export default async function handler(req,res){
  const upstream=process.env.MC_SYNC_URL;
  const token=process.env.MC_SYNC_TOKEN;
  if(!upstream||!token)return res.status(503).json({ok:false,error:"Mission Control private sync is not configured."});
  try{
    if(req.method==="GET"){
      const sep=upstream.includes("?")?"&":"?";
      const r=await fetch(upstream+sep+"token="+encodeURIComponent(token),{cache:"no-store"});
      const body=await r.text();
      res.status(r.status).setHeader("Content-Type","application/json; charset=utf-8").send(body);
      return;
    }
    if(req.method==="POST"){
      const payload=typeof req.body==="string"?JSON.parse(req.body||"{}"):(req.body||{});
      payload.token=token;
      const r=await fetch(upstream,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(payload),cache:"no-store"});
      const body=await r.text();
      res.status(r.status).setHeader("Content-Type","application/json; charset=utf-8").send(body);
      return;
    }
    res.setHeader("Allow","GET, POST");res.status(405).json({ok:false,error:"Method not allowed"});
  }catch(e){res.status(502).json({ok:false,error:String(e&&e.message||e)})}
}