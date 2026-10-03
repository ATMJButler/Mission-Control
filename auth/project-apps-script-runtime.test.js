import assert from "node:assert/strict";
import {test} from "node:test";
import {createAppsScriptHarness, projectHeaders, projectRow} from "./helpers/apps-script-harness.js";
import {validateProjectDispatch} from "./project-dispatch.js";
import {enqueueProjectOperation} from "./project-dispatch-upstream.js";

const legacyHeaders = ["id", "name", "area", "status", "priority", "attention", "owner", "description", "outcome", "doneDefinition", "currentState", "nextAction", "waitingOn", "waitingSince", "followupDate", "deadline", "milestone", "milestoneDate", "progress", "tags", "notes", "dependencyId", "lastUpdate", "lastUpdatedAt", "lastUpdatedBy", "financeData", "agendaData"];
function fixture(rows = [projectRow()]) {
  const h = createAppsScriptHarness();
  h.sheet("Project Resources", [projectHeaders, ...rows]);
  h.sheet("Projects", [legacyHeaders, ["legacy-production", "Unchanged"]]);
  return h;
}
function request(overrides = {}) {
  return {token: "offline-service-token", resource: "project_trusted_operation", operationId: "ui_00000000-0000-4000-8000-000000000001", householdId: "butler-household", actor: "verified-principal", operation: "update_project", projectId: "fixture", expectedVersion: 7, patch: {name: "Updated fixture"}, ...overrides};
}
function resource(h, row = 1, durable = true) { return h.rows("Project Resources", durable)[row]; }
function audit(h) { return h.rows("Project Operation Audit", true).slice(1); }
function assertReleased(h) {
  assert.equal(h.held, false);
  assert.equal(h.events.filter(e => e.type === "acquire").length, h.events.filter(e => e.type === "release").length);
  assert.ok(h.events.filter(e => ["write", "append", "flush"].includes(e.type)).every(e => e.held), "Project writes and flushes must happen under ScriptLock");
}
function assertLegacyUnchanged(h) { assert.deepEqual(h.rows("Projects", true), [legacyHeaders, ["legacy-production", "Unchanged"]]); }

test("trusted update targets the physical row after an interior blank and preserves neighbors", () => {
  const neighbor = projectRow({id: "neighbor"});
  const h = fixture([neighbor, Array(16).fill(""), projectRow()]);
  const result = h.post(request({patch: {name: "Updated fixture", progress: 50, tags: ["alpha"], deadline: "2028-02-29"}}));
  assert.equal(result.ok, true);
  assert.equal(result.previousVersion, 7); assert.equal(result.newVersion, 8);
  assert.deepEqual(resource(h), neighbor);
  assert.deepEqual(resource(h, 2), Array(16).fill(""));
  assert.equal(resource(h, 3)[6], "Updated fixture");
  const raw = JSON.parse(resource(h, 3)[14]);
  assert.equal(raw.notes, "preserve me"); assert.equal(raw.progress, 50); assert.deepEqual(raw.tags, ["alpha"]);
  assert.equal(audit(h)[0][9], "SUCCESS"); assertReleased(h); assertLegacyUnchanged(h);
});

test("service token and private gate reject before any sheet access or lock", () => {
  for (const mode of ["bad-token", "disabled-gate"]) {
    const h = fixture(); const before = h.rows("Project Resources", true);
    if (mode === "disabled-gate") h.properties.delete("PROJECT_V1_TRUSTED_DISPATCH");
    const result = h.post(request(mode === "bad-token" ? {token: "invalid"} : {}));
    assert.equal(result.ok, false);
    assert.match(result.error, mode === "bad-token" ? /Unauthorized/ : /PROJECT_V1_TRUSTED_DISPATCH_DISABLED/);
    assert.deepEqual(h.rows("Project Resources", true), before); assert.deepEqual(h.events, []);
  }
});

test("same-version requests produce one commit and one conflict in the serialized model", () => {
  const h = fixture();
  assert.equal(h.post(request()).ok, true);
  const conflict = h.post(request({operationId: "second-operation"}));
  assert.match(conflict.error, /^CONFLICT:/); assert.equal(resource(h)[3], 8);
  assert.deepEqual(audit(h).map(row => row[9]), ["SUCCESS", "FAILED"]);
  assertReleased(h); assertLegacyUnchanged(h);
});

test("foreign actual target household and duplicate physical target IDs fail without resource writes", () => {
  for (const rows of [[projectRow({householdId: "foreign-household"})], [projectRow(), projectRow()]]) {
    const h = fixture(rows); const before = h.rows("Project Resources", true);
    const result = h.post(request());
    assert.equal(result.ok, false); assert.match(result.error, /FORBIDDEN: Project household mismatch|INVALID: duplicate Project Resource id/);
    assert.deepEqual(h.rows("Project Resources", true), before);
    assert.equal(h.events.some(e => e.type === "write" && e.sheet === "Project Resources"), false);
    assertReleased(h); assertLegacyUnchanged(h);
  }
});

test("calendar and typed patch acceptance agrees across Vercel validation and executable backend", () => {
  const valid = [{name: "Valid name"}, {progress: 0}, {progress: 100}, {tags: ["alpha", "beta"]}, {deadline: "2028-02-29"}, {deadline: "2026-02-28"}, {waitingSince: "", followupDate: "2026-10-03", milestoneDate: "2026-12-31"}];
  const invalid = [{deadline: "2026-02-29"}, {deadline: "2026-02-30"}, {deadline: "2026-13-01"}, {deadline: "10/03/2026"}, {deadline: 123}, {progress: "50"}, {progress: -1}, {progress: 101}, {progress: 0.5}, {tags: [""]}, {tags: "alpha"}, {name: " "}, {name: null}, {role: "principal"}, {}];
  for (const [expected, patches] of [[true, valid], [false, invalid]]) for (const patch of patches) {
    const h = fixture(); const before = h.rows("Project Resources", true);
    const validation = validateProjectDispatch({operation: "update_project", resourceId: "fixture", expectedVersion: 7, patch});
    const result = h.post(request({patch}));
    assert.equal(validation.ok, expected, JSON.stringify(patch)); assert.equal(result.ok, expected, JSON.stringify(result));
    if (!expected) { assert.match(result.error, /^INVALID:/); assert.deepEqual(h.rows("Project Resources", true), before); }
    assertReleased(h); assertLegacyUnchanged(h);
  }
});

test("lifecycle sequence keeps flags, deletion timestamp, review status and unrelated fields coherent", () => {
  const h = fixture([projectRow({lifecycle: "draft"})]);
  const sequence = [["activate_project", "active"], ["complete_project", "completed"], ["archive_project", "archived"], ["soft_delete_project", "deleted"], ["restore_project", "archived"], ["restore_project", "active"]];
  let version = 7;
  for (const [operation, lifecycle] of sequence) {
    const result = h.post(request({operation, patch: undefined, operationId: `lifecycle-${version}`, expectedVersion: version}));
    assert.equal(result.ok, true, JSON.stringify(result)); assert.equal(resource(h)[3], ++version); assert.equal(resource(h)[4], lifecycle);
    const raw = JSON.parse(resource(h)[14]);
    assert.equal(raw.lifecycle, lifecycle); assert.equal(raw.completed, lifecycle === "completed");
    assert.equal(raw.archived, lifecycle === "archived"); assert.equal(raw.deleted, lifecycle === "deleted");
    assert.equal(typeof raw.deletedAt === "string", lifecycle === "deleted"); assert.equal(raw.reviewStatus, "approved"); assert.equal(raw.notes, "preserve me");
  }
  assertReleased(h); assertLegacyUnchanged(h);
});

test("deleted updates and invalid lifecycle transitions reject with no version increment", () => {
  for (const [lifecycle, overrides] of [["deleted", {}], ["draft", {operation: "complete_project", patch: undefined}]]) {
    const h = fixture([projectRow({lifecycle})]); const before = h.rows("Project Resources", true);
    assert.equal(h.post(request(overrides)).ok, false); assert.deepEqual(h.rows("Project Resources", true), before);
    assertReleased(h);
  }
});

test("exact operation replay returns saved success; changed fingerprint conflicts without second mutation", () => {
  const h = fixture(); const body = request(); const first = h.post(body);
  const after = h.rows("Project Resources", true);
  const replay = h.post(body); assert.deepEqual(replay, {...first, replayed: true});
  const changed = h.post({...body, patch: {name: "Different"}}); assert.match(changed.error, /^CONFLICT:/);
  assert.deepEqual(h.rows("Project Resources", true), after); assert.equal(audit(h).length, 1);
  assertReleased(h); assertLegacyUnchanged(h);
});

test("precommit rejection can be audited FAILED and replayed without resource mutation", () => {
  const h = fixture(); const body = request({expectedVersion: 6}); const before = resource(h);
  const first = h.post(body); assert.match(first.error, /^CONFLICT:/);
  assert.equal(h.post(body).error, first.error); assert.equal(audit(h).length, 1); assert.equal(audit(h)[0][9], "FAILED");
  assert.deepEqual(resource(h), before); assertReleased(h);
});

test("postcommit SUCCESS audit append failure yields UNKNOWN, durable readback, and no false FAILED", () => {
  const h = fixture();
  h.setFault(e => { if (e.type === "append" && e.sheet === "Project Operation Audit") throw new Error("injected audit append failure"); });
  const result = h.post(request()); assert.equal(result.ok, false); assert.match(result.error, /^UNKNOWN: Project mutation committed/);
  assert.equal(resource(h)[3], 8); assert.equal(resource(h)[6], "Updated fixture"); assert.deepEqual(audit(h), []);
  assertReleased(h); assertLegacyUnchanged(h);
});

test("mutation flush plus cleanup flush failures retain UNKNOWN and still release the lock", () => {
  const h = fixture(); h.setFault(e => { if (e.type === "flush") throw new Error("injected flush failure"); });
  const result = h.post(request()); assert.match(result.error, /^UNKNOWN: Project mutation outcome uncertain/);
  assert.equal(resource(h, 1, false)[3], 8); assert.equal(resource(h)[3], 7); assert.deepEqual(audit(h), []);
  assert.equal(h.errors.length, 1); assertReleased(h); assertLegacyUnchanged(h);
});

test("SUCCESS audit flush loss returns UNKNOWN and retains a reconcilable success when cleanup persists it", () => {
  const h = fixture(); h.setFault(e => { if (e.type === "flush" && e.number === 2) throw new Error("injected success audit flush failure"); });
  const body = request(); assert.match(h.post(body).error, /^UNKNOWN: Project mutation committed/);
  assert.equal(resource(h)[3], 8); assert.deepEqual(audit(h).map(row => row[9]), ["SUCCESS"]);
  const replay = h.post(body); assert.equal(replay.ok, true); assert.equal(replay.replayed, true); assert.equal(resource(h)[3], 8);
  assertReleased(h);
});

test("cleanup-only flush failure does not replace a successfully persisted outcome", () => {
  const h = fixture(); h.setFault(e => { if (e.type === "flush" && e.number === 3) throw new Error("injected cleanup failure"); });
  assert.equal(h.post(request()).ok, true); assert.equal(resource(h)[3], 8); assert.equal(audit(h)[0][9], "SUCCESS");
  assert.equal(h.errors.length, 1); assertReleased(h);
});

test("audit and cleanup flush loss leaves UNKNOWN with committed resource and no durable false failure", () => {
  const h = fixture(); h.setFault(e => { if (e.type === "flush" && e.number >= 2) throw new Error("injected persistent audit flush loss"); });
  const result = h.post(request()); assert.match(result.error, /^UNKNOWN: Project mutation committed/);
  assert.equal(resource(h)[3], 8); assert.deepEqual(audit(h), []);
  assert.equal(h.rows("Project Operation Audit", false)[1][9], "SUCCESS");
  assertReleased(h); assertLegacyUnchanged(h);
});

test("duplicate operation audit IDs fail closed without touching the resource", () => {
  const h = fixture(); const body = request(); assert.equal(h.post(body).ok, true);
  const rows = h.rows("Project Operation Audit", true);
  h.sheet("Project Operation Audit", [...rows, rows[1]]);
  const before = resource(h);
  assert.match(h.post(body).error, /^INVALID: duplicate Project operationId/);
  assert.deepEqual(resource(h), before); assertReleased(h);
});

test("resource refresh preserves versioned and v1-only rows and leaves legacy data unchanged", () => {
  const imported = projectRow({id: "legacy-production", raw: {name: "Keep versioned edit"}});
  imported[13] = "legacy-production";
  const h = fixture([imported, projectRow()]);
  const before = h.rows("Project Resources", true).slice(1);
  const legacy = h.rows("Projects", true);
  const result = h.call("bootstrapProjectResources");
  assert.equal(result.ok, true); assert.equal(result.count, 2); assert.equal(result.preservedV1Only, 1);
  assert.deepEqual(h.rows("Project Resources", true).slice(1), before);
  assert.deepEqual(h.rows("Projects", true), legacy); assertReleased(h);
});

test("Dot draft update and trusted update share the lock model and stale-version conflict", () => {
  const h = fixture([projectRow({lifecycle: "draft"})]);
  h.sheet("Agent Operations", [Array(14).fill("header"), ["dot-offline", "butler-household", "dot", "update_project_draft", "projects", 7, JSON.stringify({projectId: "fixture", patch: {name: "Dot draft edit"}}), "PENDING", "", "2026-01-01", "", "", "", ""]]);
  h.call("processAgentOperations");
  assert.equal(resource(h)[3], 8); assert.equal(resource(h)[6], "Dot draft edit");
  assert.equal(h.rows("Agent Operations", true)[1][7], "SUCCESS");
  assert.match(h.post(request()).error, /^CONFLICT:/); assert.equal(resource(h)[3], 8);
  assertReleased(h); assertLegacyUnchanged(h);
});

test("refresh and Dot cleanup exceptions still release their shared lock", () => {
  for (const path of ["bootstrapProjectResources", "processAgentOperations"]) {
    const h = fixture();
    if (path === "processAgentOperations") h.sheet("Agent Operations", [Array(14).fill("header")]);
    h.events.length = 0;
    h.setFault(e => { if (e.type === "flush") throw new Error("injected flush failure"); });
    if (path === "bootstrapProjectResources") assert.throws(() => h.call(path), /injected flush failure/);
    else h.call(path); // Empty queue returns; the guarded cleanup failure is logged.
    assert.equal(h.errors.length, 1); assertReleased(h);
  }
});

test("real upstream adapter executes backend and reconciles a lost response through exact replay", async () => {
  const h = fixture(), originalFetch = globalThis.fetch;
  const names = ["MC_PROJECT_V1_DISPATCH", "MC_SYNC_URL", "MC_SYNC_TOKEN"];
  const saved = names.map(name => process.env[name]);
  Object.assign(process.env, {MC_PROJECT_V1_DISPATCH: "enabled", MC_SYNC_URL: "https://offline.invalid/exec", MC_SYNC_TOKEN: "offline-service-token"});
  let loseResponse = true;
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body); assert.equal(body.resource, "project_trusted_operation");
    const response = h.post(body);
    return {ok: true, status: 200, text: async () => { if (loseResponse) throw new Error("injected body stream loss"); return JSON.stringify(response); }};
  };
  const input = {validated: validateProjectDispatch({operation: "update_project", resourceId: "fixture", expectedVersion: 7, patch: {name: "Updated fixture"}}), householdId: "butler-household", userId: "verified-principal", operationId: request().operationId};
  try {
    await assert.rejects(enqueueProjectOperation(input), e => e.code === "PROJECT_OUTCOME_UNKNOWN" && e.operationId === input.operationId);
    // Readback precedes replay: one durable version increment and correlated SUCCESS audit.
    assert.equal(resource(h)[3], 8); assert.equal(audit(h)[0][0], input.operationId); assert.equal(audit(h)[0][9], "SUCCESS");
    loseResponse = false;
    const recovered = await enqueueProjectOperation(input); assert.equal(recovered.replayed, true); assert.equal(recovered.operationId, input.operationId);
    assert.equal(resource(h)[3], 8); assert.equal(audit(h).length, 1); assertReleased(h); assertLegacyUnchanged(h);
  } finally {
    globalThis.fetch = originalFetch;
    names.forEach((name, i) => { if (saved[i] === undefined) delete process.env[name]; else process.env[name] = saved[i]; });
  }
});
