/* Shared budget rules. The marked body also runs in Apps Script; keep both identical. */
// BEGIN BUDGET MODEL
var MCBudget = (() => {
  const frequencies={weekly:52,biweekly:26,twice_monthly:24,monthly:12,quarterly:4,yearly:1};
  const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
  const keys=(x,list)=>object(x)&&Object.keys(x).every(k=>list.includes(k))&&list.every(k=>Object.hasOwn(x,k));
  const text=x=>typeof x==='string'&&x.trim().length>0&&x.length<=100;
  const cents=x=>Number.isSafeInteger(x)&&x>=0&&x<=1000000000;
  const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&new Date(x+'T12:00:00Z').toISOString().slice(0,10)===x;
  function defaults(){return{method:'manual',step:0,income:[],bills:[],categories:[],savings:[]};}
  function validate(plan){
    if(!keys(plan,['method','step','income','bills','categories','savings'])||plan.method!=='manual'||!Number.isInteger(plan.step)||plan.step<0||plan.step>5)return false;
    const names=new Set();
    for(const group of ['income','bills','categories','savings']){
      if(!Array.isArray(plan[group])||plan[group].length>50)return false;
      for(const row of plan[group]){
        const fields=group==='bills'?['name','amountCents','frequency','dueDay']:group==='income'?['name','amountCents','frequency']:['name','amountCents'];
        if(!keys(row,fields)||!text(row.name)||row.name!==row.name.trim()||!cents(row.amountCents))return false;
        if(['income','bills'].includes(group)&&!Object.hasOwn(frequencies,row.frequency))return false;
        if(group==='bills'&&(!Number.isInteger(row.dueDay)||row.dueDay<1||row.dueDay>31))return false;
        const name=(group==='income'?'income:':'allocation:')+row.name.toLowerCase();if(names.has(name)||(group!=='income'&&row.name.toLowerCase()==='unassigned'))return false;names.add(name);
      }
    }return plan.bills.length+plan.categories.length+plan.savings.length<=100;
  }
  function monthly(row){return Math.round(row.amountCents*(frequencies[row.frequency]||12)/12);}
  function allocations(plan){return [...plan.bills.map(r=>({name:r.name,plannedCents:monthly(r),kind:'bill'})),...plan.categories.map(r=>({name:r.name,plannedCents:r.amountCents,kind:'spending'})),...plan.savings.map(r=>({name:r.name,plannedCents:r.amountCents,kind:'saving'}))];}
  function validateTransaction(t){
    try{return keys(t,['id','date','description','amountCents','flow','category','sourceId'])&&typeof t.id==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(t.id)&&date(t.date)&&text(t.description)&&cents(t.amountCents)&&t.amountCents>0&&['spend','refund','income','transfer'].includes(t.flow)&&typeof t.category==='string'&&t.category.length<=100&&typeof t.sourceId==='string'&&t.sourceId.length<=200;}catch{return false;}
  }
  function summary(plan,transactions,month){
    const categories=allocations(plan).map(r=>({...r,spentCents:0}));let incomeActualCents=0,unassignedCents=0;
    for(const t of transactions.filter(t=>t.date.slice(0,7)===month)){
      if(t.flow==='income'){incomeActualCents+=t.amountCents;continue;}if(t.flow==='transfer')continue;
      const amount=t.flow==='refund'?-t.amountCents:t.amountCents,category=categories.find(r=>r.name===t.category);
      if(category)category.spentCents+=amount;else unassignedCents+=amount;
    }
    const incomeCents=plan.income.reduce((a,r)=>a+monthly(r),0),allocatedCents=categories.reduce((a,r)=>a+r.plannedCents,0),spentCents=categories.reduce((a,r)=>a+r.spentCents,unassignedCents);
    if(unassignedCents)categories.push({name:'Unassigned',plannedCents:0,spentCents:unassignedCents,kind:'unassigned'});
    return{incomeCents,allocatedCents,unallocatedCents:incomeCents-allocatedCents,spentCents,incomeActualCents,unassignedCents,categories};
  }
  function moneyInput(value){if(!/^\d+(\.\d{1,2})?$/.test(String(value)))throw Error('Enter a positive amount with up to two decimal places.');const [d,p='']=String(value).split('.'),v=Number(d)*100+Number(p.padEnd(2,'0'));if(!cents(v))throw Error('That amount is too large.');return v;}
  return{defaults,validate,monthly,allocations,validateTransaction,summary,moneyInput};
})();
if(typeof globalThis!=='undefined')globalThis.MCBudget=MCBudget;
// END BUDGET MODEL
