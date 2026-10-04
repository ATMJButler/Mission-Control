import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {test} from "node:test";

const html=fs.readFileSync(new URL("../index.html",import.meta.url),"utf8");
const helpers=html.slice(html.indexOf("function esc("),html.indexOf("function doc("));
const renderStart=html.indexOf("function renderBars(");
const rendering=html.slice(renderStart,html.indexOf("frame.addEventListener('load'",renderStart));
assert.ok(rendering.includes("function renderFinance(") && rendering.includes("async function refreshFinance("));
function setup(snapshot={}) {
  const ids=["finAsOf","finKpis","finSpend","finIncome","finMargin","finPressure","finDebt","finAccounts","finReview","finSource","finRefresh"];
  const elements=Object.fromEntries(ids.map(id=>[id,{innerHTML:"",textContent:"",disabled:false}]));
  let current=snapshot,pull=async()=>false;
  const messages=[];
  const context=vm.createContext({Intl,Date,Number,Array,doc:()=>({getElementById:id=>elements[id]||null}),installBridge:()=>true,lastFinanceStamp:"",
    win:()=>({__mcFinanceSnapshot:()=>current,__mcPrivatePull:()=>pull(),toast:message=>messages.push(message)})});
  vm.runInContext(helpers+rendering,context);
  return {context,elements,messages,setSnapshot:s=>{current=s},setPull:p=>{pull=p},render:()=>context.renderFinance()};
}
const snapshot=accounts=>({asOf:"2026-10-04",currentMonth:{},yearToDate:{},categories:[],monthly:[],debt:{accounts:[]},accounts});

test("empty or malformed accounts does not hide populated accountBalances",()=>{
  for(const accounts of [[],null,{},[null,"bad",17]]){
    const f=setup({...snapshot(accounts),accountBalances:[{name:"Offline checking",available:125}]});f.render();
    assert.match(f.elements.finAccounts.innerHTML,/Offline checking/);assert.match(f.elements.finAccounts.innerHTML,/\$125\.00/);
  }
});
test("primary accounts takes precedence without merging duplicate representations",()=>{
  const f=setup({...snapshot([{name:"Primary",available:1}]),accountBalances:[{name:"Legacy duplicate",available:99}]});f.render();
  assert.match(f.elements.finAccounts.innerHTML,/Primary/);assert.doesNotMatch(f.elements.finAccounts.innerHTML,/Legacy duplicate/);
});
test("zero available balance is retained and current balance is explicitly labeled",()=>{
  const f=setup(snapshot([{name:"Zero",availableBalance:0,currentBalance:900},{accountName:"Current only",current:42}]));f.render();
  assert.match(f.elements.finAccounts.innerHTML,/\$0\.00/);assert.doesNotMatch(f.elements.finAccounts.innerHTML,/\$900\.00/);
  assert.match(f.elements.finAccounts.innerHTML,/Current balance/);assert.match(f.elements.finAccounts.innerHTML,/\$42\.00/);
});
test("blank, nonfinite and nonnumeric balances remain unknown rather than zero",()=>{
  for(const value of [null,undefined,"", " ",false,"not a number",Infinity]){
    const f=setup(snapshot([{name:"Offline unknown",availableBalance:value,currentBalance:value}]));f.render();
    assert.match(f.elements.finAccounts.innerHTML,/Unknown/);assert.doesNotMatch(f.elements.finAccounts.innerHTML,/\$0\.00/);
  }
});
test("bad rows are skipped; private account labels and masks are escaped",()=>{
  const f=setup(snapshot([null,[],"bad",{name:'<script>attack</script>',institution:'<img src=x>',mask:'<svg>',available:"12.50"}]));f.render();
  assert.match(f.elements.finAccounts.innerHTML,/&lt;script&gt;/);assert.doesNotMatch(f.elements.finAccounts.innerHTML,/<script>|<img|<svg/);
  assert.match(f.elements.finAccounts.innerHTML,/\$12\.50/);
});
test("compact snapshot normalization preserves account data",()=>{
  const f=setup({asOf:"2026-10-04",ytd:{},debt:[],accountBalances:[{name:"Compact checking",balance:33}]});f.render();
  assert.match(f.elements.finAccounts.innerHTML,/Compact checking/);
});
test("missing shared finance snapshot clears prior account and chart data",()=>{
  const f=setup(snapshot([{name:"Prior private account",balance:33}]));f.render();f.setSnapshot(null);f.render();
  assert.doesNotMatch(f.elements.finAccounts.innerHTML,/Prior private account/);assert.match(f.elements.finAccounts.innerHTML,/Account data unavailable/);
  assert.equal(f.elements.finDebt.innerHTML,"");assert.equal(f.elements.finReview.innerHTML,"");
});
test("failed refresh is visible and does not claim a successful refresh",async()=>{
  const f=setup(snapshot([{name:"Existing snapshot",balance:33}]));f.render();await f.context.refreshFinance();
  assert.match(f.elements.finAsOf.textContent,/Refresh failed/);assert.ok(!f.messages.includes("Finances refreshed"));
  assert.equal(f.elements.finRefresh.disabled,false);
});
test("successful read-only refresh renders the new account snapshot",async()=>{
  const f=setup(snapshot([]));f.setPull(async()=>{f.setSnapshot(snapshot([{name:"Newly read account",available:77}]));return true;});
  await f.context.refreshFinance();assert.match(f.elements.finAccounts.innerHTML,/Newly read account/);
  assert.deepEqual(f.messages,["Finances refreshed"]);assert.equal(f.elements.finRefresh.disabled,false);
});
