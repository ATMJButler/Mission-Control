/**
 * Mission Control V4 — Google Sheets shared project source
 * Setup: create a Google Sheet, paste this into Extensions > Apps Script,
 * change SYNC_TOKEN, run setupSheet(), then deploy as a Web App.
 */
const SHEET_NAME = 'Projects';
const SYNC_TOKEN = 'CHANGE-ME-TO-A-LONG-PRIVATE-TOKEN';
const HEADERS = ['id','name','area','status','priority','attention','owner','description','outcome','doneDefinition','currentState','nextAction','waitingOn','waitingSince','followupDate','deadline','milestone','milestoneDate','progress','tags','notes','dependencyId','lastUpdate'];

function setupSheet() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  sh.clear();
  sh.getRange(1,1,1,HEADERS.length).setValues([HEADERS]);
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, HEADERS.length);
}
function doGet(e) {
  try { authorize_(e && e.parameter && e.parameter.token); return json_({ok:true,projects:readProjects_()}); }
  catch(err){ return json_({ok:false,error:String(err.message||err)}); }
}
function doPost(e) {
  try {
    const body=JSON.parse((e&&e.postData&&e.postData.contents)||'{}');
    authorize_(body.token);
    if(!Array.isArray(body.projects)) throw new Error('projects array required');
    writeProjects_(body.projects);
    return json_({ok:true,count:body.projects.length,updatedAt:new Date().toISOString()});
  } catch(err){ return json_({ok:false,error:String(err.message||err)}); }
}
function authorize_(token){
  if(!SYNC_TOKEN||SYNC_TOKEN==='CHANGE-ME-TO-A-LONG-PRIVATE-TOKEN') throw new Error('Set SYNC_TOKEN first.');
  if(token!==SYNC_TOKEN) throw new Error('Unauthorized');
}
function readProjects_(){
  const sh=getSheet_(),values=sh.getDataRange().getValues();
  if(values.length<2) return [];
  const headers=values[0].map(String);
  return values.slice(1).filter(r=>r.some(v=>v!=='')).map(row=>{
    const p={};
    headers.forEach((h,i)=>{
      let v=row[i];
      if(v instanceof Date) v=Utilities.formatDate(v,Session.getScriptTimeZone(),'yyyy-MM-dd');
      if(h==='progress') v=Number(v||0);
      if(h==='tags') v=String(v||'').split(',').map(s=>s.trim()).filter(Boolean);
      p[h]=(v===null||v===undefined)?'':v;
    });
    return p;
  });
}
function writeProjects_(projects){
  const sh=getSheet_();
  const rows=projects.map(p=>HEADERS.map(h=>h==='tags'?(Array.isArray(p[h])?p[h].join(', '):(p[h]||'')):((p[h]===null||p[h]===undefined)?'':p[h])));
  sh.clearContents();
  sh.getRange(1,1,1,HEADERS.length).setValues([HEADERS]);
  if(rows.length) sh.getRange(2,1,rows.length,HEADERS.length).setValues(rows);
  sh.setFrozenRows(1);
}
function getSheet_(){
  const sh=SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  if(!sh) throw new Error('Projects sheet missing. Run setupSheet() first.');
  return sh;
}
function json_(obj){ return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
