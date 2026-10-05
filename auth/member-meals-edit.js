const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const text=(value,max,blank=false)=>typeof value==='string'&&value.length<=max&&(blank||value.trim().length>0);
const date=value=>{try{return /^\d{4}-\d{2}-\d{2}$/.test(value)&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}catch{return false;}};
export function validateMemberMealEdit(operation,rows){
 if(!Array.isArray(rows))return false;
 if(operation==='edit_meals')return rows.length>0&&rows.length<=7&&new Set(rows.map(row=>row?.date)).size===rows.length&&rows.every(row=>object(row)&&Object.keys(row).length===3&&Object.keys(row).every(key=>['date','meal','prep'].includes(key))&&text(row.date,10)&&date(row.date)&&text(row.meal,200)&&text(row.prep,500,true));
 if(operation==='edit_groceries')return rows.length<=200&&rows.every(row=>object(row)&&Object.keys(row).length===3&&Object.keys(row).every(key=>['item','qty','done'].includes(key))&&text(row.item,200)&&text(row.qty,100,true)&&typeof row.done==='boolean');
 return false;
}
export async function editMemberMeals({actor,householdId,operation,expectedVersion,rows}){
 const fail=()=>Object.assign(new Error('Unconfirmed Meals edit'),{code:'MEMBER_MEALS_OUTCOME_UNKNOWN',statusCode:503});
 const upstream=process.env.MC_SYNC_URL,token=process.env.MC_SYNC_TOKEN;
 if(!upstream||!token)throw Object.assign(new Error('Meals unavailable'),{code:'MEMBER_MEALS_UNAVAILABLE',statusCode:503});
 let response,body;try{response=await fetch(upstream,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},cache:'no-store',signal:AbortSignal.timeout(15000),body:JSON.stringify({token,resource:'member_meals_edit',actor,householdId,operation,expectedVersion,rows})});body=await response.json();}catch{throw fail();}
 if(!response.ok)throw fail();
 if(body?.ok!==true){const codes={MEMBER_MEALS_DISABLED:503,MEMBER_MEALS_INVALID:400,MEMBER_MEALS_CONFLICT:409,MEMBER_MEALS_FORBIDDEN:403,MEMBER_SETUP_FORBIDDEN:403,MEMBER_MEALS_UNAVAILABLE:503};if(Object.hasOwn(codes,body?.error))throw Object.assign(new Error('Meals edit rejected'),{code:body.error,statusCode:codes[body.error]});throw fail();}
 if(body.previousVersion!==expectedVersion||body.newVersion!==expectedVersion+1)throw fail();
 return{ok:true,previousVersion:body.previousVersion,newVersion:body.newVersion};
}
