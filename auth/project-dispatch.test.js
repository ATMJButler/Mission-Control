import {validateProjectDispatch,buildProjectAgentOperation} from "./project-dispatch.js";
const good=validateProjectDispatch({operation:"activate_project",resourceId:"p1",expectedVersion:2});if(!good.ok)throw new Error("valid activate denied");
const built=buildProjectAgentOperation({validated:good,householdId:"h1",userId:"u1"});if(built.actorId!=="u1"||built.householdId!=="h1"||built.expectedVersion!==2)throw new Error("server context not preserved");
for(const bad of [
 {operation:"activate_project",resourceId:"p1"},
 {operation:"activate_project",resourceId:"p1",expectedVersion:2,patch:{name:"x"}},
 {operation:"update_project",resourceId:"p1",expectedVersion:2,patch:{}},
 {operation:"update_project",resourceId:"p1",expectedVersion:2,patch:{role:"principal"}},
 {operation:"invent_project",resourceId:"p1",expectedVersion:2}
])if(validateProjectDispatch(bad).ok)throw new Error("invalid dispatch accepted "+JSON.stringify(bad));
console.log(JSON.stringify({ok:true}));
