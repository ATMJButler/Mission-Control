/**
 * Mission Control V5 — conflict-safe Google Sheets shared project source
 * IMPORTANT: Keep your existing SYNC_TOKEN value when you paste this into Apps Script.
 */
const SHEET_NAME = 'Projects';
const SYNC_TOKEN = 'CHANGE-ME-TO-A-LONG-PRIVATE-TOKEN';
const HEADERS = [
'id','name','area','status','priority','attention','owner','description','outcome',
'doneDefinition','currentState','nextAction','waitingOn','waitingSince','followupDate',
'deadline','milestone','milestoneDate','progress','tags','notes','dependencyId','lastUpdate',
'lastUpdatedAt','lastUpdatedBy'
];

function setupSheet(){const ss=SpreadsheetApp.getActive();let sh=ss.getSheetByName(SHEET_NAME);if(!sh)sh=ss.insertSheet(SHEET_NAME);ensureHeaders_(sh);sh.setFrozenRows(1);sh.autoResizeColumns(1,HEADERS.length)}

function doGet(e){try{authorize_(e&&e.parameter&&e.parameter.token);return json_({ok:true,projects:readProjects_()})}catch(err){return json_({ok:false,error:String(err.message||err)})}}

function doPost(e){try{
  const body=JSON.parse((e&&e.postData&&e.postData.contents)||'{}');
  authorize_(body.token);if(!Array.isArray(body.projects))throw new Error('projects array required');
  const merged=mergeProjects_(readProjects_(),body.projects);writeProjects_(merged);
  return json_({ok:true,count:merged.length,projects:merged,updatedAt:new Date().toISOString()});
}catch(err){return json_({ok:false,error:String(err.message||err)})}}

function onEdit(e){try{
  if(!e||!e.range)return;const sh=e.range.getSheet();if(sh.getName()!==SHEET_NAME||e.range.getRow()<2)return;
  ensureHeaders_(sh);const map=headerMap_(sh),now=new Date();
  for(let r=e.range.getRow();r<=e.range.getLastRow();r++){
    if(map.lastUpdate)sh.getRange(r,map.lastUpdate).setValue(Utilities.formatDate(now,Session.getScriptTimeZone(),'yyyy-MM-dd'));
    if(map.lastUpdatedAt)sh.getRange(r,map.lastUpdatedAt).setValue(now.toISOString());
    if(map.lastUpdatedBy)sh.getRange(r,map.lastUpdatedBy).setValue('Google Sheet');
  }
}catch(err){console.error(err)}}

function authorize_(token){if(!SYNC_TOKEN||SYNC_TOKEN==='CHANGE-ME-TO-A-LONG-PRIVATE-TOKEN')throw new Error('Set SYNC_TOKEN first.');if(token!==SYNC_TOKEN)throw new Error('Unauthorized')}

function readProjects_(){const sh=getSheet_();ensureHeaders_(sh);const values=sh.getDataRange().getValues();if(values.length<2)return[];
  const headers=values[0].map(String);
  return values.slice(1).filter(r=>r.some(v=>v!=='')).map(row=>{const p={};headers.forEach((h,i)=>{let v=row[i];
    if(v instanceof Date)v=h==='lastUpdatedAt'?v.toISOString():Utilities.formatDate(v,Session.getScriptTimeZone(),'yyyy-MM-dd');
    if(h==='progress')v=Number(v||0);if(h==='tags')v=String(v||'').split(',').map(s=>s.trim()).filter(Boolean);
    p[h]=(v===null||v===undefined)?'':v});
    if(!p.lastUpdatedAt)p.lastUpdatedAt=(p.lastUpdate||'1970-01-01')+'T12:00:00.000Z';
    if(!p.lastUpdatedBy)p.lastUpdatedBy='Previous data';return p})}

function mergeProjects_(serverProjects,incomingProjects){const server=new Map(serverProjects.map(p=>[String(p.id),p])),incoming=new Map(incomingProjects.map(p=>[String(p.id),p])),ids=new Set([...server.keys(),...incoming.keys()]),merged=[];
  ids.forEach(id=>{const s=server.get(id),i=incoming.get(id);if(!s){merged.push(normalizeProject_(i));return}if(!i){merged.push(normalizeProject_(s));return}
    const st=Date.parse(s.lastUpdatedAt||((s.lastUpdate||'1970-01-01')+'T12:00:00.000Z'))||0;
    const it=Date.parse(i.lastUpdatedAt||((i.lastUpdate||'1970-01-01')+'T12:00:00.000Z'))||0;
    merged.push(normalizeProject_(it>=st?i:s))});return merged}

function normalizeProject_(p){const out=Object.assign({},p||{});if(!out.lastUpdate)out.lastUpdate=Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd');if(!out.lastUpdatedAt)out.lastUpdatedAt=new Date().toISOString();if(!out.lastUpdatedBy)out.lastUpdatedBy='Unknown source';return out}

function writeProjects_(projects){const sh=getSheet_();ensureHeaders_(sh);const rows=projects.map(p=>HEADERS.map(h=>{const v=p[h];if(h==='tags')return Array.isArray(v)?v.join(', '):(v||'');return(v===null||v===undefined)?'':v}));
  const currentRows=Math.max(sh.getLastRow()-1,0);if(currentRows)sh.getRange(2,1,currentRows,HEADERS.length).clearContent();if(rows.length)sh.getRange(2,1,rows.length,HEADERS.length).setValues(rows);sh.setFrozenRows(1)}

function ensureHeaders_(sh){const current=sh.getRange(1,1,1,Math.max(sh.getLastColumn(),1)).getValues()[0].map(String);HEADERS.forEach((h,idx)=>{if(current[idx]!==h)sh.getRange(1,idx+1).setValue(h)})}
function headerMap_(sh){const headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String),map={};headers.forEach((h,i)=>map[h]=i+1);return map}
function getSheet_(){const sh=SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);if(!sh)throw new Error('Projects sheet missing.');return sh}
function json_(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)}
