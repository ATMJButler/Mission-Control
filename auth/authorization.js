export const ROLES = Object.freeze({
  PRINCIPAL: "principal",
  SECONDARY: "secondary",
  EXTENDED: "extended"
});

const POLICIES = Object.freeze({
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
    read: ["principal","secondary","extended"],
    save_draft: ["principal","secondary"],
    approve: ["principal","secondary"]
  }),
  identity: Object.freeze({
    read_self: ["principal","secondary","extended"],
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
