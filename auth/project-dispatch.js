const PROJECT_OPERATIONS=Object.freeze({
  activate_project:{role:"principal",required:["resourceId","expectedVersion"],patchAllowed:false},
  update_project:{role:"principal",required:["resourceId","expectedVersion","patch"],patchAllowed:true},
  complete_project:{role:"principal",required:["resourceId","expectedVersion"],patchAllowed:false},
  archive_project:{role:"principal",required:["resourceId","expectedVersion"],patchAllowed:false},
  restore_project:{role:"principal",required:["resourceId","expectedVersion"],patchAllowed:false},
  soft_delete_project:{role:"principal",required:["resourceId","expectedVersion"],patchAllowed:false}
});
const PATCH_KEYS=new Set(["name","area","scope","operatingState","priority","attention","owner","description","outcome","doneDefinition","currentState","nextAction","waitingOn","waitingSince","followupDate","deadline","milestone","milestoneDate","progress","tags","notes","dependencyId","financeData","agendaData"]);
export function validateProjectDispatch({operation,resourceId,expectedVersion,patch}){
  const spec=PROJECT_OPERATIONS[operation];if(!spec)return{ok:false,status:400,reason:"UNKNOWN_PROJECT_OPERATION"};
  if(!resourceId||typeof resourceId!=="string")return{ok:false,status:400,reason:"RESOURCE_ID_REQUIRED"};
  if(!Number.isInteger(expectedVersion)||expectedVersion<1)return{ok:false,status:400,reason:"EXPECTED_VERSION_REQUIRED"};
  if(spec.patchAllowed){
    if(!patch||typeof patch!=="object"||Array.isArray(patch))return{ok:false,status:400,reason:"PATCH_REQUIRED"};
    const keys=Object.keys(patch);if(!keys.length)return{ok:false,status:400,reason:"PATCH_EMPTY"};
    const unknown=keys.filter(k=>!PATCH_KEYS.has(k));if(unknown.length)return{ok:false,status:400,reason:"PATCH_FIELDS_INVALID",fields:unknown};
  }else if(patch!==undefined)return{ok:false,status:400,reason:"PATCH_NOT_ALLOWED"};
  return{ok:true,operation,resourceId,expectedVersion,patch:patch||null};
}
export function buildProjectAgentOperation({validated,householdId,userId}){
  if(!validated?.ok)throw new Error("validated dispatch required");
  return{householdId,actorId:userId,operation:validated.operation,resourceId:validated.resourceId,expectedVersion:validated.expectedVersion,payload:validated.patch?{patch:validated.patch}:{}};
}
