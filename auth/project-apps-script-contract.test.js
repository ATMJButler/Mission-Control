import fs from "node:fs";
const s=fs.readFileSync(new URL("../google_apps_script_Code.gs",import.meta.url),"utf8");
function must(re,msg){if(!re.test(s))throw new Error(msg)}
must(/function readProjectResourceRecords_\(\).*sheetRow:i\+2/s,"physical Project Resource row identity missing");
must(/if\(rec\)sh\.getRange\(rec\.sheetRow,1,1,16\)/,"Project Resource writer is not using physical sheet row");
must(/current&&requiredHouseholdId&&current\.householdId!==requiredHouseholdId/,"target Project household check missing");
must(/resource==="project_trusted_operation"[\s\S]*?LockService\.getScriptLock\(\)/,"trusted Project operation lacks ScriptLock");
must(/function processAgentOperations\(\)\{const lock=LockService\.getScriptLock\(\)/,"Dot Project operations lack common ScriptLock");
must(/function bootstrapProjectResources\(\)\{const lock=LockService\.getScriptLock\(\)/,"Project Resource refresh lacks common ScriptLock");
must(/targetLifecycle==="active"\)[\s\S]*?raw\.completed=false;raw\.archived=false;raw\.deleted=false/,"active lifecycle metadata incoherent");
must(/targetLifecycle==="archived"\)[\s\S]*?raw\.completed=false;raw\.archived=true;raw\.deleted=false/,"archived lifecycle metadata incoherent");
must(/targetLifecycle==="deleted"\)[\s\S]*?raw\.completed=false;raw\.deleted=true;raw\.archived=false/,"deleted lifecycle metadata incoherent");
must(/targetLifecycle==="completed"\)[\s\S]*?raw\.completed=true;raw\.archived=false;raw\.deleted=false/,"completed lifecycle metadata incoherent");
must(/projectOperationFingerprintMatches_\(prior,body\)/,"operationId fingerprint dedupe missing");
must(/status==="SUCCESS"\)return json_\(Object\.assign\(\{\},saved,\{replayed:true\}\)\)/,"successful operation replay behavior missing");
console.log(JSON.stringify({ok:true,projectAppsScriptContracts:true}));
