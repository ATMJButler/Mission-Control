export function requireMissionControlOrigin(req){
  const allowed=(process.env.MC_AUTHORIZED_PARTIES||"").split(",").map(x=>x.trim().replace(/\/$/,"")).filter(Boolean);
  if(!allowed.length)throw Object.assign(new Error("Authorized origins are not configured."),{statusCode:503,code:"ORIGIN_NOT_CONFIGURED"});
  const origin=String(req.headers.origin||"").replace(/\/$/,"");
  const fetchSite=String(req.headers["sec-fetch-site"]||"");
  if(!origin||!allowed.includes(origin))throw Object.assign(new Error("Request origin not permitted."),{statusCode:403,code:"ORIGIN_FORBIDDEN"});
  if(fetchSite&&fetchSite!=="same-origin"&&fetchSite!=="same-site")throw Object.assign(new Error("Cross-site request denied."),{statusCode:403,code:"CROSS_SITE_FORBIDDEN"});
  return {ok:true,origin};
}
