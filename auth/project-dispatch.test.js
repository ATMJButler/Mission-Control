import {validateProjectDispatch,buildProjectAgentOperation} from "./project-dispatch.js";
const good=validateProjectDispatch({operation:"activate_project",resourceId:"p1",expectedVersion:2});if(!good.ok)throw new Error("valid activate denied");
const built=buildProjectAgentOperation({validated:good,householdId:"h1",userId:"u1"});if(built.actorId!=="u1"||built.householdId!=="h1"||built.expectedVersion!==2)throw new Error("server context not preserved");
const dated=validateProjectDispatch({operation:"update_project",resourceId:"p1",expectedVersion:2,patch:{deadline:"2026-10-08",waitingSince:"",progress:50,tags:["alpha","beta"]}});if(!dated.ok)throw new Error("valid typed patch denied "+JSON.stringify(dated));
for(const bad of [
 {operation:"activate_project",resourceId:"p1"},
 {operation:"activate_project",resourceId:"p1",expectedVersion:2,patch:{name:"x"}},
 {operation:"update_project",resourceId:"p1",expectedVersion:2,patch:{}},
 {operation:"update_project",resourceId:"p1",expectedVersion:2,patch:{role:"principal"}},
 {operation:"invent_project",resourceId:"p1",expectedVersion:2},
 {operation:"update_project",resourceId:"p1",expectedVersion:2,patch:{progress:101}},
 {operation:"update_project",resourceId:"p1",expectedVersion:2,patch:{progress:"50"}},
 {operation:"update_project",resourceId:"p1",expectedVersion:2,patch:{deadline:"10/2/2026"}},
 {operation:"update_project",resourceId:"p1",expectedVersion:2,patch:{deadline:"2026-02-30"}},
 {operation:"update_project",resourceId:"p1",expectedVersion:2,patch:{deadline:"2026-13-01"}},
 {operation:"update_project",resourceId:"p1",expectedVersion:2,patch:{tags:["ok",""]}},
 {operation:"update_project",resourceId:"p1",expectedVersion:2,patch:{name:""}}
])if(validateProjectDispatch(bad).ok)throw new Error("invalid dispatch accepted "+JSON.stringify(bad));
console.log(JSON.stringify({ok:true}));
