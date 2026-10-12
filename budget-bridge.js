/* Principal Budget reads the active manual plan; Money retains the original finance source. */
(() => {
 const model=globalThis.MCBudget;let key=null,stamp='',generation=0;
 const session=()=>window.Clerk?.isSignedIn?window.Clerk.user?.id+':'+window.Clerk.session?.id:null;
 const clear=()=>{generation++;key=null;stamp='';window.mcBudgetSnapshot=null;};
 window.mcReadBudget=async()=>{
  const core=document.getElementById('core');if(!core?.getAttribute('src')?.includes('app-v5.html')){clear();return false;}const s=session();if(!s){clear();return false;}if(key!==s){clear();key=s;}const g=++generation;
  try{const r=await fetch('/api/v1/member',{method:'POST',cache:'no-store',signal:AbortSignal.timeout(30000),headers:{'Content-Type':'application/json'},body:JSON.stringify({resource:'budget_setup',operation:'read'})});
   if(g!==generation||s!==session()||!core.getAttribute('src')?.includes('app-v5.html'))return false;
   if(r.status===401||r.status===403){clear();void window.mcClearPrivateCache?.();const frame=document.getElementById('core');if(frame)frame.src='about:blank';const gate=document.getElementById('mcWorkspaceGate');if(gate){gate.style.display='flex';document.getElementById('mcWorkspaceStatus').textContent='Budget access needs a fresh check. Reload or sign in again.';document.getElementById('mcWorkspaceRetry').hidden=false;}return false;}if(!r.ok)return false;
   const body=await r.json(),record=body.record;if(g!==generation||s!==session()||!record||!model.validate(record.draft)||(record.active&&!model.validate(record.active)))return false;
   if(!record.active){if(window.mcBudgetSnapshot){window.mcBudgetSnapshot=null;window.dispatchEvent(new Event('mc-budget-updated'));}return true;}
   const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit'}).formatToParts(new Date()),month=parts.find(p=>p.type==='year').value+'-'+parts.find(p=>p.type==='month').value;
   const next=record.version+':'+month;if(stamp===next)return true;stamp=next;
   const summary=model.summary(record.active,record.transactions,month);
   window.mcBudgetSnapshot={asOf:new Date().toISOString().slice(0,10),currentMonth:{label:'Manual budget · '+month},manualBudget:true,budget:{workingBudget:summary.allocatedCents/100,regularIncome:summary.incomeCents/100,categories:summary.categories.map(c=>({name:c.name,planned:c.plannedCents/100,spent:c.spentCents/100})),outsidePlan:[]},budgetReconciliation:{totalBudgetSpending:summary.spentCents/100,categories:summary.categories.map(c=>({name:c.name,spent:c.spentCents/100}))},currentMonthTransactions:record.transactions.filter(t=>t.date.slice(0,7)===month&&['spend','refund'].includes(t.flow)).map(t=>({date:t.date,description:t.description,amount:(t.flow==='refund'?-1:1)*t.amountCents/100,flow:t.flow,bucket:t.category||'Unassigned',transactionId:t.id}))};
   window.dispatchEvent(new Event('mc-budget-updated'));return true;
  }catch{return false;}
 };
 window.addEventListener('mc-authenticated',()=>window.mcReadBudget());window.addEventListener('mc-signed-out',clear);window.addEventListener('focus',()=>window.mcReadBudget());
 document.getElementById('core')?.addEventListener('load',()=>window.mcReadBudget());window.addEventListener('mc-private-sync-ready',()=>window.mcReadBudget());if(session())window.mcReadBudget();
})();
