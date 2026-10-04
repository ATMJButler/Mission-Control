const fail = () => { throw Object.assign(new Error("Diagnostics backend unavailable or incompatible"), {statusCode: 502, code: "DIAGNOSTICS_UPSTREAM_UNAVAILABLE"}); };
const object = value => value && typeof value === "object" && !Array.isArray(value);
function boolean(value) { if (typeof value !== "boolean") fail(); return value; }
function count(value) { if (value !== null && (!Number.isSafeInteger(value) || value < 0)) fail(); return value; }
function choice(value, options) { if (!options.includes(value)) fail(); return value; }
function digest(value) { if (value !== null && !/^[0-9a-f]{64}$/.test(value)) fail(); return value; }
function summary(value) {
  if (!object(value)) fail();
  return {present: boolean(value.present), headersValid: boolean(value.headersValid),
    recordCount: count(value.recordCount), fingerprint: digest(value.fingerprint)};
}

// Reconstruct every response field. Never forward arbitrary backend objects,
// error text, records, request authority, credentials or identity attributes.
export function sanitizeDiagnostics(value) {
  if (!object(value) || value.schemaVersion !== 1 || value.readOnly !== true ||
      !/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(value.checkedAt) ||
      ![value.source, value.gates, value.snapshot, value.sheets, value.fixture, value.identity].every(object)) fail();
  const {source, sheets, fixture, identity} = value;
  if (!(source.gitSha === "unversioned" || /^[0-9a-f]{40}$/.test(source.gitSha)) ||
      !(source.canonicalSha256 === "unversioned" || /^[0-9a-f]{64}$/.test(source.canonicalSha256)) ||
      typeof source.legacyBuildId !== "string" || !/^[a-zA-Z0-9._-]{1,80}$/.test(source.legacyBuildId) ||
      source.immutableVersion !== null) fail();
  let flags = null;
  if (fixture.flags !== null) {
    if (!object(fixture.flags)) fail();
    flags = {completed: boolean(fixture.flags.completed), archived: boolean(fixture.flags.archived),
      deleted: boolean(fixture.flags.deleted), deletedAtPresent: boolean(fixture.flags.deletedAtPresent),
      reviewStatus: choice(fixture.flags.reviewStatus, [null, "pending", "approved", "rejected"])};
  }
  if (!Array.isArray(value.recentFixtureOperations) || value.recentFixtureOperations.length > 10) fail();
  const recentFixtureOperations = value.recentFixtureOperations.map(row => {
    if (!object(row) || (row.operationId !== null && !/^ui_[0-9a-f-]{36}$/i.test(row.operationId))) fail();
    return {operationId: row.operationId, status: choice(row.status, [null, "PENDING", "SUCCESS", "FAILED", "UNKNOWN"]),
      expectedVersion: count(row.expectedVersion), previousVersion: count(row.previousVersion), newVersion: count(row.newVersion)};
  });
  return {schemaVersion: 1, readOnly: true, checkedAt: value.checkedAt,
    source: {gitSha: source.gitSha, canonicalSha256: source.canonicalSha256, legacyBuildId: source.legacyBuildId, immutableVersion: null},
    gates: {projectV1TrustedDispatch: boolean(value.gates.projectV1TrustedDispatch)},
    snapshot: {coordination: choice(value.snapshot.coordination, ["shared-script-lock"]), legacyWritesSerialized: choice(value.snapshot.legacyWritesSerialized, [false])},
    sheets: {
      legacyProjects: {...summary(sheets.legacyProjects), applicable: boolean(sheets.legacyProjects.applicable)},
      projectResources: {...summary(sheets.projectResources), v1OnlyCount: count(sheets.projectResources.v1OnlyCount), duplicateIdCount: count(sheets.projectResources.duplicateIdCount)},
      projectOperationAudit: summary(sheets.projectOperationAudit)
    },
    fixture: {present: boolean(fixture.present), unique: boolean(fixture.unique), version: count(fixture.version),
      lifecycle: choice(fixture.lifecycle, [null, "draft", "active", "completed", "archived", "deleted"]),
      legacyLinked: choice(fixture.legacyLinked, [null, true, false]), flags,
      lifecycleCoherent: choice(fixture.lifecycleCoherent, [null, true, false])},
    recentFixtureOperations,
    identity: {activeUsers: count(identity.activeUsers), activeMemberships: count(identity.activeMemberships),
      invitationsPresent: boolean(identity.invitationsPresent), invitationsHeadersValid: boolean(identity.invitationsHeadersValid), invitationCount: count(identity.invitationCount),
      authAuditPresent: boolean(identity.authAuditPresent), authAuditHeadersValid: boolean(identity.authAuditHeadersValid), authAuditCount: count(identity.authAuditCount)}
  };
}

export async function readUpstreamDiagnostics({householdId, userId}) {
  const upstream = process.env.MC_SYNC_URL, token = process.env.MC_SYNC_TOKEN;
  if (!upstream || !token) throw Object.assign(new Error("Private diagnostics upstream unavailable"), {statusCode: 503, code: "DIAGNOSTICS_UPSTREAM_UNAVAILABLE"});
  try {
    const response = await fetch(upstream, {method: "POST", headers: {"Content-Type": "text/plain;charset=utf-8"},
      body: JSON.stringify({token, resource: "system_diagnostics", operation: "read", householdId, actor: userId}),
      cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(15000)});
    if (!response.ok) fail();
    const text = await response.text();
    if (text.length > 256000) fail();
    const body = JSON.parse(text);
    if (!object(body) || body.ok !== true) {
      if (body?.error === "DIAGNOSTICS_PRINCIPAL_REQUIRED") throw Object.assign(new Error("Principal access required"), {statusCode: 403, code: "PRINCIPAL_REQUIRED"});
      fail();
    }
    return sanitizeDiagnostics(body.diagnostics);
  } catch (error) {
    if (error?.code === "PRINCIPAL_REQUIRED") throw error;
    fail();
  }
}

export function deploymentDiagnostics(env = process.env) {
  const keyMode = (value, test, live) => value?.startsWith(test) ? "development" : value?.startsWith(live) ? "production" : "unverified";
  return {
    gitSha: /^[0-9a-f]{40}$/.test(env.VERCEL_GIT_COMMIT_SHA || "") ? env.VERCEL_GIT_COMMIT_SHA : null,
    environment: ["production", "preview", "development"].includes(env.VERCEL_ENV) ? env.VERCEL_ENV : "unverified",
    projectV1Dispatch: env.MC_PROJECT_V1_DISPATCH === "enabled",
    clerkPublishableKeyMode: keyMode(env.CLERK_PUBLISHABLE_KEY, "pk_test_", "pk_live_"),
    clerkSecretKeyMode: keyMode(env.CLERK_SECRET_KEY, "sk_test_", "sk_live_")
  };
}
