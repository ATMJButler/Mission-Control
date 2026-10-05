// Staging-only companion: never copied into the production release workflow.
function initializeStagingTestData() {
  const sheetId = '18eft4EyxSy1lCtydd5dwuu20iMiJOBV0AAiHq4gu05Y';
  const scriptId = '1dxTX6HWorvrR76H6idiNH2Q4BNsRo-U2YjtADfSjoXsPwd3OrfZLzDcV';
  if (ScriptApp.getScriptId() !== scriptId) throw new Error('STAGING_SCRIPT_MISMATCH');
  const ss = SpreadsheetApp.getActive();
  if (!ss || ss.getId() !== sheetId) throw new Error('STAGING_SHEET_MISMATCH');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const props = PropertiesService.getScriptProperties();
    if (props.getProperty('STAGING_INITIALIZED')) throw new Error('STAGING_ALREADY_INITIALIZED');
    const names = ['Users','Households','Household Memberships','Household Invitations','Auth Audit','Projects','Project Resources','Meals'];
    if (names.some(name => ss.getSheetByName(name)) || ss.getSheets().some(sh => sh.getLastRow() > 0))
      throw new Error('STAGING_SHEET_NOT_EMPTY');
    // All write gates start off. Never import production secrets or identity data.
    ['MEMBER_SETUP','MEMBER_DASHBOARD','MEMBER_MEALS_EDIT','PROJECT_V1_TRUSTED_DISPATCH'].forEach(name => props.setProperty(name,'disabled'));
    if (!props.getProperty('SYNC_TOKEN')) props.setProperty('SYNC_TOKEN',Utilities.getUuid()+Utilities.getUuid());
    const make = (name, headers, rows) => {
      const sh = ss.insertSheet(name);
      sh.getRange(1,1,1,headers.length).setValues([headers]);
      if (rows.length) sh.getRange(2,1,rows.length,headers.length).setValues(rows);
      sh.setFrozenRows(1);
    };
    make('Users',['userId','status','displayName','identityProvider','providerSubject','email','createdAt','updatedAt','notes'],[]);
    make('Households',['householdId','status','name','createdAt','updatedAt','notes'],[['butler-household','active','STAGING ONLY — synthetic household','','','No production data']]);
    make('Household Memberships',['membershipId','householdId','userId','role','status','createdAt','updatedAt','notes'],[]);
    make('Household Invitations',invitationHeaders_(),[]);
    make('Auth Audit',['eventId','timestamp','eventType','userId','householdId','role','resource','operation','result','notes'],[]);
    make('Projects',HEADERS,[]);
    make('Project Resources',['id','householdId','schemaVersion','version','lifecycle','operatingState','name','area','scope','createdAt','createdBy','updatedAt','updatedBy','legacyProjectId','resourceJson','notes'],[]);
    const days = Array.from({length:7},(_,i)=>({date:'2026-10-'+String(5+i).padStart(2,'0'),meal:'TEST meal '+(i+1),prep:'TEST prep',recipe:{instructions:'TEST recipe'}}));
    const fixture = {householdId:'butler-household',version:7,approved:{weekStart:'2026-10-05',days,groceryList:[{item:'TEST apples',qty:'2',done:false}]},draft:{weekStart:'2026-10-12',days:[],sentinel:'KEEP DRAFT'},mealHistory:['KEEP HISTORY'],rules:{sentinel:'KEEP RULES'}};
    make('Meals',['key','householdId','schemaVersion','updatedAt','updatedBy','status','json','notes'],[
      ['staging-neighbor','staging-neighbor',1,'','','approved',JSON.stringify({householdId:'staging-neighbor',version:9}),'KEEP NEIGHBOR'],
      ['','','','','','','',''],
      ['butler-household','butler-household',1,'','','approved',JSON.stringify(fixture),'KEEP FIXTURE NOTES']
    ]);
    SpreadsheetApp.flush();
    props.setProperty('STAGING_INITIALIZED','true');
    return 'Synthetic staging fixture ready. No identity provisioned; all write gates disabled.';
  } finally { lock.releaseLock(); }
}
