import {authorize} from "./authorization.js";
const base={user:{userId:"u1",status:"active"},household:{householdId:"h1",status:"active"},membership:{userId:"u1",householdId:"h1",role:"principal",status:"active"}};
const cases=[
 ["principal update",true,{...base,resource:"projects",operation:"update_project"}],
 ["secondary update",true,{...base,membership:{...base.membership,role:"secondary"},resource:"projects",operation:"update_project"}],
 ["secondary archive",false,{...base,membership:{...base.membership,role:"secondary"},resource:"projects",operation:"archive_project"}],
 ["extended update",false,{...base,membership:{...base.membership,role:"extended"},resource:"projects",operation:"update_project"}],
 ["wrong household",false,{...base,membership:{...base.membership,householdId:"h2"},resource:"projects",operation:"read"}],
 ["revoked membership",false,{...base,membership:{...base.membership,status:"revoked"},resource:"projects",operation:"read"}],
 ["disabled user",false,{...base,user:{...base.user,status:"disabled"},resource:"projects",operation:"read"}],
 ["unknown operation",false,{...base,resource:"projects",operation:"nuclear_project"}]
];
for(const [name,want,input] of cases){const got=authorize(input);if(got.ok!==want)throw new Error(name+" expected "+want+" got "+JSON.stringify(got))}
console.log(JSON.stringify({ok:true,cases:cases.length}));
