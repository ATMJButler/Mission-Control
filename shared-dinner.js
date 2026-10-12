// Shared display logic only: dinner comes from a confirmed household plan.
(function(root){
 function dateKey(now=new Date(),timeZone='America/Chicago'){
  let parts;try{parts=new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);}catch{parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);}
  const value=type=>parts.find(part=>part.type===type).value;return value('year')+'-'+value('month')+'-'+value('day');
 }
 function forDate(meals,date){
  if(!meals)return null;
  for(const plan of [meals.draft,meals.approved,meals]){const day=plan?.days?.find(day=>day?.date===date);if(day)return{date,meal:typeof day.meal==='string'?day.meal:'',prep:typeof day.prep==='string'?day.prep:''};}
  return null;
 }
 root.MCSharedDinner={dateKey,forDate};
})(globalThis);
