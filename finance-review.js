(()=>{
const QUEUE_OPEN='[[FINANCE_REVIEW_QUEUE]]',QUEUE_CLOSE='[[/FINANCE_REVIEW_QUEUE]]';
const frame=document.getElementById('core');
function d(){return frame&&frame.contentDocument}function w(){return frame&&frame.contentWindow}
function esc(v=''){return String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function key(x){return [x.date||'',String(x.description||'').trim().toLowerCase(),Number(x.amount||0).toFixed(2)].join('|')}
function getQueue(){try{return w().eval(`(()=>{const p=state.projects.find(x=>x.id==='family');if(!p)return[];const n=String(p.notes||'');const a=n.indexOf(${JSON.stringify(QUEUE_OPEN)}),b=n.indexOf(${JSON.stringify(QUEUE_CLOSE)});if(a<0||b<a)return[];try{return JSON.parse(n.slice(a+${QUEUE_OPEN.length},b))||[]}catch(e){return[]}})()`)}catch(e){return[]}}
function installApi(){const doc=d();if(!doc||w().__mcSaveFinanceExplanation)return;const s=doc.createElement('script');s.textContent=`
window.__mcSaveFinanceExplanation=async function(payload){
  try{
    const OPEN=${JSON.stringify(QUEUE_OPEN)},CLOSE=${JSON.stringify(QUEUE_CLOSE)};
    const p=state.projects.find(x=>x.id==='family');if(!p)throw new Error('Family project missing');
    let notes=String(p.notes||''),queue=[];const a=notes.indexOf(OPEN),b=notes.indexOf(CLOSE);
    if(a>=0&&b>a){try{queue=JSON.parse(notes.slice(a+OPEN.length,b))||[]}catch(e){queue=[]};notes=(notes.slice(0,a)+notes.slice(b+CLOSE.length)).trim()}
    const k=[payload.date||'',String(payload.description||'').trim().toLowerCase(),Number(payload.amount||0).toFixed(2)].join('|');
    const item={date:payload.date||'',description:payload.description||'',amount:Number(payload.amount||0),category:payload.category||'',reason:payload.reason||'',explanation:String(payload.explanation||'').trim(),submittedAt:new Date().toISOString(),key:k};
    const ix=queue.findIndex(x=>x.key===k);if(ix>=0)queue[ix]=item;else queue.push(item);
    p.notes=(notes?notes+'\\n\\n':'')+OPEN+JSON.stringify(queue)+CLOSE;
    p.lastUpdate=today();p.lastUpdatedAt=new Date().toISOString();p.lastUpdatedBy='Mission Control Finance Review';
    localStorage.setItem(KEY,JSON.stringify(state));renderAll();
    setSyncStatus('Syncing…','Saving transaction explanation to private Mission Control data.');
    const ok=await pushProjects(false);if(ok){setSyncStatus('Connected','Transaction explanation saved for budget curation.');return true}
    return false
  }catch(e){return false}
};`;
doc.body.appendChild(s)}
function installUi(){const doc=d();if(!doc||!doc.getElementById('page-finances'))return false;installApi();
if(!doc.getElementById('finReviewInteractiveStyle')){const st=doc.createElement('style');st.id='finReviewInteractiveStyle';st.textContent=`
.fin-review.fin-click{cursor:pointer;transition:.15s ease;position:relative}.fin-review.fin-click:hover{border-color:#5e82a8;transform:translateY(-1px)}.fin-review.fin-click:after{content:'Explain';position:absolute;right:9px;top:7px;font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#7fc8ff}.fin-review.fin-saved{border-color:#34654b;background:#10261b}.fin-review.fin-saved:after{content:'Saved';color:#62d89a}.fin-review-note{grid-column:1/-1;color:#9ce1b8;font-size:10px;margin-top:2px}.fin-review-modal .txn{background:#091525;border:1px solid #203550;border-radius:11px;padding:11px;margin-bottom:12px}.fin-review-modal .txn b{display:block;font-size:15px}.fin-review-modal .txn span{display:block;color:var(--muted);font-size:11px;margin-top:3px}.fin-review-modal textarea{min-height:130px}.fin-review-help{font-size:11px;color:var(--muted);line-height:1.5;margin:8px 0 0}.fin-review-saved-banner{background:#13291f;border:1px solid #34654b;color:#9ce1b8;border-radius:10px;padding:9px;font-size:11px;margin-bottom:10px}
`;doc.head.appendChild(st)}
if(!doc.getElementById('finReviewModal')){const wrap=doc.createElement('div');wrap.innerHTML=`<div class="modal-backdrop" id="finReviewModal"><div class="modal fin-review-modal"><h2>Explain Transaction</h2><div class="sub">Tell Mission Control what this transaction actually was. Plain English is fine.</div><div id="finReviewSavedBanner"></div><div class="txn" id="finReviewTxn"></div><label class="label">Your explanation</label><textarea class="field" id="finReviewExplanation" placeholder="Example: This was cash for Caleb's tournament fees, so treat it as Family & Kids. Or: This transfer was moving money to savings, not spending."></textarea><div class="fin-review-help">Your explanation is saved into the private Mission Control sync. The morning budget curation will use it as user-confirmed evidence to resolve the transaction, update its notes/category when appropriate, and remove it from the review queue.</div><div class="modal-actions"><button class="btn" id="finReviewCancel">Cancel</button><button class="btn primary" id="finReviewSave">Save Explanation</button></div></div></div>`;doc.body.appendChild(wrap.firstElementChild)}
const modal=doc.getElementById('finReviewModal');doc.getElementById('finReviewCancel').onclick=()=>modal.classList.remove('show');modal.onclick=e=>{if(e.target===modal)modal.classList.remove('show')};return true}
function bindReviews(){if(!installUi())return;const doc=d(),snap=w().__mcFinanceSnapshot?w().__mcFinanceSnapshot():null;if(!snap)return;const queue=getQueue(),map=new Map(queue.map(x=>[x.key||key(x),x]));const container=doc.getElementById('finReview');if(!container)return;const rows=[...container.querySelectorAll('.fin-review')],items=snap.reviewItems||[];
rows.forEach((row,i)=>{const item=items[i];if(!item)return;const saved=map.get(key(item));row.classList.add('fin-click');row.classList.toggle('fin-saved',!!saved);if(saved&&!row.querySelector('.fin-review-note'))row.insertAdjacentHTML('beforeend',`<div class="fin-review-note">Explanation saved: ${esc(saved.explanation)} • waiting for curation</div>`);row.onclick=()=>open(item,saved)});
}
function open(item,saved){const doc=d(),modal=doc.getElementById('finReviewModal');doc.getElementById('finReviewTxn').innerHTML=`<b>${esc(item.description)}</b><span>${esc(item.date)} • ${new Intl.NumberFormat(undefined,{style:'currency',currency:'USD'}).format(Number(item.amount||0))} • ${esc(item.category||'')}</span><span>Why flagged: ${esc(item.reason||'Needs review')}</span>`;doc.getElementById('finReviewExplanation').value=saved?saved.explanation:'';doc.getElementById('finReviewSavedBanner').innerHTML=saved?'<div class="fin-review-saved-banner">You already explained this one. Saving again will replace the prior explanation.</div>':'';modal.dataset.item=JSON.stringify(item);modal.classList.add('show');setTimeout(()=>doc.getElementById('finReviewExplanation').focus(),50)}
async function save(){const doc=d(),modal=doc.getElementById('finReviewModal'),btn=doc.getElementById('finReviewSave'),ex=doc.getElementById('finReviewExplanation').value.trim();if(!ex){doc.getElementById('finReviewExplanation').focus();return}let item;try{item=JSON.parse(modal.dataset.item||'{}')}catch(e){return}btn.disabled=true;btn.textContent='Saving…';const ok=await w().__mcSaveFinanceExplanation({...item,explanation:ex});btn.disabled=false;btn.textContent='Save Explanation';if(ok){modal.classList.remove('show');setTimeout(()=>{if(typeof window.renderFinance==='function')window.renderFinance();bindReviews();if(w().toast)w().toast('Explanation saved for curation')},300)}else{doc.getElementById('finReviewSavedBanner').innerHTML='<div class="fin-review-saved-banner" style="background:#351a24;border-color:#5a2a39;color:#ffdce4">Saved locally, but private sync did not complete. Check Data & Sync, then try again.</div>'}}
function hook(){if(!installUi())return false;const doc=d();const btn=doc.getElementById('finReviewSave');if(btn&&!btn.dataset.bound){btn.dataset.bound='1';btn.onclick=save}bindReviews();return true}
frame.addEventListener('load',()=>{let n=0;const t=setInterval(()=>{n++;if(hook()){clearInterval(t);setTimeout(bindReviews,1500);setTimeout(bindReviews,4000);setInterval(bindReviews,3000)}else if(n>50)clearInterval(t)},150)});
if(frame.contentDocument&&frame.contentDocument.readyState==='complete')setTimeout(hook,250);
})();

(()=>{
const frame=document.getElementById('core');
function d(){return frame&&frame.contentDocument}function w(){return frame&&frame.contentWindow}
function esc(v=''){return String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function money(v){if(v===null||v===undefined||Number.isNaN(Number(v)))return '—';return new Intl.NumberFormat(undefined,{style:'currency',currency:'USD',maximumFractionDigits:2}).format(Number(v))}
function dateLabel(v){if(!v)return 'Unknown';return new Date(v+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}
const CSS=`
.bud-hero{background:linear-gradient(180deg,rgba(31,45,70,.98),rgba(12,27,46,.98));border-color:#3c587b}.bud-actions{display:flex;gap:8px;flex-wrap:wrap}.bud-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:14px}.bud-stat{background:#091525;border:1px solid #29425f;border-radius:14px;padding:12px}.bud-stat .n{font-size:28px;font-weight:900;letter-spacing:-.035em}.bud-stat .l{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-top:3px}.bud-stat .d{font-size:11px;color:#c7d3e1;margin-top:3px}.bud-stat.good .n{color:var(--good)}.bud-stat.warn .n{color:var(--warn)}.bud-stat.bad .n{color:var(--bad)}
.bud-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}.bud-cat{background:#0d1a2c;border:1px solid var(--line);border-radius:14px;padding:12px}.bud-cat.over{border-color:#744040;background:#201417}.bud-cat.watch{border-color:#725c2b}.bud-cat.inactive{opacity:.7}.bud-cat-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.bud-cat h4{margin:0;font-size:14px}.bud-amt{font-size:12px;color:#dbe6f0;margin-top:3px}.bud-rem{text-align:right;font-size:11px;color:var(--muted)}.bud-status{font-weight:850;margin-top:3px}.bud-status.good{color:var(--good)}.bud-status.warn{color:var(--warn)}.bud-status.bad{color:var(--bad)}.bud-status.muted{color:var(--muted)}.bud-track{height:8px;border-radius:999px;background:#07111e;border:1px solid #1c314b;margin-top:10px;overflow:hidden}.bud-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,#62d89a,#7fc8ff)}.bud-cat.watch .bud-fill{background:var(--warn)}.bud-cat.over .bud-fill{background:var(--bad)}
.bud-cash{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:10px}.bud-cash-card{background:#091525;border:1px solid #29425f;border-radius:12px;padding:11px}.bud-cash-card b{display:block;font-size:22px}.bud-cash-card span{font-size:10px;color:var(--muted)}.bud-outside{display:flex;flex-direction:column;gap:8px;margin-top:9px}.bud-outside-row{background:#211a10;border:1px solid #6b5730;border-radius:11px;padding:10px}.bud-outside-row b{display:block}.bud-outside-row span{font-size:11px;color:#e6d4aa}.bud-privacy{font-size:10px;color:var(--muted);line-height:1.5}
@media(max-width:1100px){.bud-summary{grid-template-columns:repeat(2,1fr)}}
@media(max-width:760px){.bud-grid{grid-template-columns:1fr}.bud-cash{grid-template-columns:1fr 1fr}.bud-summary{grid-template-columns:1fr 1fr}}
@media(max-width:430px){.bud-cash{grid-template-columns:1fr}.bud-stat .n{font-size:23px}.bud-cat-top{gap:8px}}
`;
const HTML=`
<section class="page" id="page-budget">
  <div class="hero bud-hero">
    <div class="hero-top"><div><h2>Monthly Budget</h2><div class="hero-sub">What we planned, what we have spent, and what is still safe to use.</div></div><div class="bud-actions"><button class="btn" id="budRefresh">Refresh</button></div></div>
    <div class="hint" id="budAsOf" style="margin-top:8px">Waiting for private Mission Control sync…</div>
    <div class="bud-summary" id="budSummary"></div>
  </div>
  <div class="two-col" style="margin-top:12px">
    <div class="panel"><h3>Weekly cash plan</h3><div class="hint">Pull the same amount every Friday and let unused cash roll forward.</div><div class="bud-cash" id="budCash"></div></div>
    <div class="panel"><h3>Budget pace</h3><div id="budPace" style="margin-top:9px"></div></div>
  </div>
  <div class="section-title"><h3>Category spending vs plan</h3><div class="hint">Spent this month / full-month plan</div></div>
  <div class="bud-grid" id="budGrid"></div>
  <div class="panel" id="budOutsidePanel" style="margin-top:12px"><h3>Outside the balanced plan</h3><div class="hint">Spending that posted this month but does not have a planned bucket in the balanced budget.</div><div class="bud-outside" id="budOutside"></div></div>
  <div class="panel" style="margin-top:12px"><div class="bud-privacy" id="budPrivacy"></div></div>
</section>`;
function snapshot(){try{return w().__mcFinanceSnapshot?w().__mcFinanceSnapshot():null}catch(e){return null}}
function install(){const doc=d();if(!doc||!doc.querySelector('.nav')||!doc.getElementById('page-finances'))return false;
  if(!doc.getElementById('budgetInjectedStyle')){const st=doc.createElement('style');st.id='budgetInjectedStyle';st.textContent=CSS;doc.head.appendChild(st)}
  const pressure=doc.getElementById('finPressure');if(pressure&&pressure.closest('.panel'))pressure.closest('.panel').style.display='none';
  if(!doc.getElementById('page-budget')){const dataPage=doc.getElementById('page-data');dataPage.insertAdjacentHTML('beforebegin',HTML)}
  if(!doc.querySelector('.nav [data-page="budget"]')){const b=doc.createElement('button');b.dataset.page='budget';b.textContent='Budget';const dataBtn=doc.querySelector('.nav [data-page="data"]');dataBtn.parentNode.insertBefore(b,dataBtn);b.onclick=()=>{w().switchPage('budget');render()}}
  const refresh=doc.getElementById('budRefresh');if(refresh&&!refresh.dataset.bound){refresh.dataset.bound='1';refresh.onclick=async()=>{refresh.textContent='Refreshing…';if(w().__mcFinancePull)await w().__mcFinancePull();setTimeout(()=>{if(typeof window.renderFinance==='function')window.renderFinance();render(true);refresh.textContent='Refresh'},350)}}
  return true
}
function status(spent,planned,pace){if(planned<=0)return spent>0?{label:'Unplanned',cls:'bad',card:'over'}:{label:'Inactive',cls:'muted',card:'inactive'};const ratio=spent/planned;if(ratio>1)return{label:`${Math.round(ratio*100)}% used`,cls:'bad',card:'over'};if(ratio>Math.min(1,pace+.12))return{label:`${Math.round(ratio*100)}% used`,cls:'warn',card:'watch'};return{label:`${Math.round(ratio*100)}% used`,cls:'good',card:''}}
function render(showToast=false){if(!install())return;const doc=d(),snap=snapshot(),b=snap&&snap.budget;if(!snap||!b){doc.getElementById('budAsOf').textContent='Private budget data has not reached this device yet. Use Data & Sync to confirm the device is connected, then press Refresh.';doc.getElementById('budSummary').innerHTML='<div class="fin-lock">Budget details stay behind your private Mission Control sync. Nothing personal is embedded in the public site code.</div>';doc.getElementById('budGrid').innerHTML='';return}
  const planned=Number(b.plannedTotal||0),spent=Number((snap.currentMonth||{}).spending||0),remaining=planned-spent;
  const asOf=snap.asOf?new Date(snap.asOf+'T12:00:00'):new Date(),daysInMonth=new Date(asOf.getFullYear(),asOf.getMonth()+1,0).getDate(),elapsed=Math.min(daysInMonth,asOf.getDate()),pace=elapsed/daysInMonth,used=planned>0?spent/planned:0;
  doc.getElementById('budAsOf').textContent=`${(snap.currentMonth||{}).label||'Current month'} • Private budget snapshot through ${dateLabel(snap.asOf)}`;
  const paceDiff=used-pace,overall=remaining<0?'bad':paceDiff>.12?'warn':'good';
  doc.getElementById('budSummary').innerHTML=`<div class="bud-stat"><div class="n">${money(planned)}</div><div class="l">Planned budget</div><div class="d">Balanced to conservative monthly income</div></div><div class="bud-stat"><div class="n">${money(spent)}</div><div class="l">Spent this month</div><div class="d">${Math.round(used*100)}% of the monthly plan used</div></div><div class="bud-stat ${remaining<0?'bad':'good'}"><div class="n">${money(remaining)}</div><div class="l">Remaining</div><div class="d">Still available in the plan</div></div><div class="bud-stat ${overall}"><div class="n">${Math.round(used*100)}% / ${Math.round(pace*100)}%</div><div class="l">Budget use / month elapsed</div><div class="d">${paceDiff<=0?'Spending is behind the calendar pace':paceDiff<=.12?'Close to calendar pace':'Spending is running ahead of calendar pace'}</div></div>`;
  const cash=b.weeklyCashPlan||{};doc.getElementById('budCash').innerHTML=`<div class="bud-cash-card"><b>${money(cash.total)}</b><span>Total cash every ${esc(cash.cadence||'Friday')}</span></div><div class="bud-cash-card"><b>${money(cash.flexibleHousehold)}</b><span>Flexible household spending</span></div><div class="bud-cash-card"><b>${money(cash.girlsAllowance)}</b><span>Girls' allowance total</span></div>`;
  const paceStatus=paceDiff<=0?['On track','var(--good)']:paceDiff<=.12?['Watch','var(--warn)']:['Running high','var(--bad)'];doc.getElementById('budPace').innerHTML=`<div class="item"><b style="color:${paceStatus[1]}">${paceStatus[0]}</b><span>${Math.round(used*100)}% of the budget has been used while ${Math.round(pace*100)}% of the month has elapsed.</span></div><div class="progress" style="margin-top:10px"><div style="width:${Math.min(100,used*100)}%;background:${paceStatus[1]}"></div></div>`;
  doc.getElementById('budGrid').innerHTML=(b.categories||[]).map(c=>{const p=Number(c.planned||0),s=Number(c.spent||0),rem=p-s,st=status(s,p,pace),width=p>0?Math.min(100,s/p*100):0;return `<div class="bud-cat ${st.card}"><div class="bud-cat-top"><div><h4>${esc(c.name)}</h4><div class="bud-amt">${money(s)} spent of ${money(p)}</div></div><div class="bud-rem">${p>0?(rem>=0?money(rem)+' left':money(Math.abs(rem))+' over'):'No planned amount'}<div class="bud-status ${st.cls}">${st.label}</div></div></div><div class="bud-track"><div class="bud-fill" style="width:${width}%"></div></div></div>`}).join('');
  const outside=b.outsidePlan||[],panel=doc.getElementById('budOutsidePanel');panel.style.display=outside.length?'block':'none';doc.getElementById('budOutside').innerHTML=outside.map(x=>`<div class="bud-outside-row"><b>${esc(x.name)} • ${money(x.spent)}</b><span>${esc(x.note||'Not assigned to a planned category.')}</span></div>`).join('');
  doc.getElementById('budPrivacy').innerHTML='<b>Privacy:</b> This tab reads the private finance snapshot carried through Mission Control sync. Household budget amounts and category spending are not stored in the public GitHub Pages code.';
  if(showToast&&w().toast)w().toast('Budget refreshed')
}
function hook(){if(!install())return false;render();return true}
frame.addEventListener('load',()=>{let n=0;const t=setInterval(()=>{n++;if(hook()){clearInterval(t);setTimeout(render,1500);setTimeout(render,4000);setInterval(()=>{const doc=d();if(doc&&doc.getElementById('page-budget')&&doc.getElementById('page-budget').classList.contains('active'))render()},5000)}else if(n>60)clearInterval(t)},150)});
if(frame.contentDocument&&frame.contentDocument.readyState==='complete')setTimeout(hook,350);
})();