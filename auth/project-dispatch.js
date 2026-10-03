const PROJECT_OPERATIONS=Object.freeze({
  activate_project:{role:"principal",required:["resourceId","expectedVersion"],patchAllowed:false},
  update_project:{role:"principal",required:["resourceId","expectedVersion","patch"],patchAllowed:true},
  complete_project:{role:"principal",required:["resourceId","expectedVersion"],patchAllowed:false},
  archive_project:{role:"principal",required:["resourceId","expectedVersion"],patchAllowed:false},
  restore_project:{role:"principal",required:["resourceId","expectedVersion"],patchAllowed:false},
  soft_delete_project:{role:"principal",required:["resourceId","expectedVersion"],patchAllowed:false}
});
const STRING_FIELDS=new Set(["name","area","scope","operatingState","priority","attention","owner","description","outcome","doneDefinition","currentState","nextAction","waitingOn","milestone","notes","dependencyId"]);
const DATE_FIELDS=new Set(["waitingSince","followupDate","deadline","milestoneDate"]);
const PATCH_KEYS=new Set([...STRING_FIELDS,...DATE_FIELDS,"progress","tags"]);
function validatePatchValues(patch){for(const [k,v] of Object.entries(patch)){if(STRING_FIELDS.has(k)){if(typeof v!=="string")return "PATCH_FIELD_TYPE_INVALID:"+k;if(k==="name"&&!v.trim())return "PATCH_NAME_BLANK"}else if(DATE_FIELDS.has(k)){if(typeof v!=="string"||(v&&!/^\\d{4}-\\d{2}-\\d{2}$/.test(v)))return "PATCH_DATE_INVALID:"+k}else if(k==="progress"){if(!Number.isInteger(v)||v<0||v>100)return "PATCH_PROGRESS_INVALID"}else if(k==="tags"){if(!Array.isArray(v)||v.some(x=>typeof x!=="string"||!x.trim()))return "PATCH_TAGS_INVALID"}}return null}
export function validateProjectDispatch({operation,resourceId,expectedVersion,patch}){
  const spec=PROJECT_OPERATIONS[operation];if(!spec)return{ok:false,status:400,reason:"UNKNOWN_PROJECT_OPERATION"};
  if(!resourceId||typeof resourceId!=="string")return{ok:false,status:400,reason:"RESOURCE_ID_REQUIRED"};
  if(!Number.isInteger(expectedVersion)||expectedVersion<1)return{ok:false,status:400,reason:"EXPECTED_VERSION_REQUIRED"};
  if(spec.patchAllowed){
    if(!patch||typeof patch!=="object"||Array.isArray(patch))return{ok:false,status:400,reason:"PATCH_REQUIRED"};
    const keys=Object.keys(patch);if(!keys.length)return{ok:false,status:400,reason:"PATCH_EMPTY"};
    const unknown=keys.filter(k=>!PATCH_KEYS.has(k));if(unknown.length)return{ok:false,status:400,reason:"PATCH_FIELDS_INVALID",fields:unknown};const valueError=validatePatchValues(patch);if(valueError)return{ok:false,status:400,reason:valueError};
  }else if(patch!==undefined)return{ok:false,status:400,reason:"PATCH_NOT_ALLOWED"};
  return{ok:true,operation,resourceId,expectedVersion,patch:patch||null};
}
export function buildProjectAgentOperation({validated,householdId,userId}){
  if(!validated?.ok)throw new Error("validated dispatch required");
  return{householdId,actorId:userId,operation:validated.operation,resourceId:validated.resourceId,expectedVersion:validated.expectedVersion,payload:validated.patch?{patch:validated.patch}:{}};
}
