export const ROLES = Object.freeze({
  PRINCIPAL: "principal",
  SECONDARY: "secondary",
  EXTENDED: "extended",
  CHILD: "child"
});

const POLICIES = Object.freeze({
  household_requests: Object.freeze({dashboard:["child"],submit:["child"],inbox:["principal","secondary"],decide:["principal","secondary"],settings:["principal"],publish_event:["principal","secondary"],remove_event:["principal","secondary"]}),
  budget_setup: Object.freeze(Object.fromEntries(["read","save","activate","transaction","delete_transaction"].map(op=>[op,["principal"]]))),
  member_meals: Object.freeze({edit: ["principal","secondary"]}),
  member_workspace: Object.freeze({read: ["principal","secondary"]}),
  member_setup: Object.freeze({read: ["principal","secondary"], save: ["principal","secondary"]}),
  diagnostics: Object.freeze({read: ["principal"]}),
  projects: Object.freeze({
    read: ["principal","secondary","extended"],
    update_project: ["principal","secondary"],
    activate_project: ["principal"],
    complete_project: ["principal","secondary"],
    archive_project: ["principal"],
    restore_project: ["principal"],
    soft_delete_project: ["principal"]
  }),
  meals: Object.freeze({
    read: ["principal"],
    save_draft: ["principal"],
    approve: ["principal"]
  }),
  identity: Object.freeze({
    read_self: ["principal","secondary","extended","child"],
    manage_memberships: ["principal"]
  })
});

export function authorize({user, household, membership, resource, operation}) {
  if (!user || user.status !== "active") return deny("USER_INACTIVE_OR_MISSING");
  if (!household || household.status !== "active") return deny("HOUSEHOLD_INACTIVE_OR_MISSING");
  if (!membership || membership.status !== "active") return deny("MEMBERSHIP_INACTIVE_OR_MISSING");
  if (String(membership.userId) !== String(user.userId)) return deny("MEMBERSHIP_USER_MISMATCH");
  if (String(membership.householdId) !== String(household.householdId)) return deny("MEMBERSHIP_HOUSEHOLD_MISMATCH");
  const policy=POLICIES[resource];
  if (!policy) return deny("UNKNOWN_RESOURCE");
  const roles=policy[operation];
  if (!roles) return deny("UNKNOWN_OPERATION");
  if (!roles.includes(membership.role)) return deny("ROLE_NOT_PERMITTED");
  return {ok:true,userId:user.userId,householdId:household.householdId,role:membership.role,resource,operation};
}
function deny(reason){return {ok:false,reason}}
export function policySnapshot(){return POLICIES}
