import assert from "node:assert/strict";
import {test} from "node:test";
import {createAppsScriptHarness} from "./helpers/apps-script-harness.js";

function fixture() {
  const h = createAppsScriptHarness();
  h.sheet("Meals", [["key", "householdId", "schemaVersion", "updatedAt", "updatedBy", "status", "json", "notes"],
    ["butler-household", "butler-household", 1, "", "fixture", "draft", JSON.stringify({version: 7, householdId: "butler-household", draft: {weekStart: "2026-10-05", days: [{meal: "Original meal"}]}, approved: {days: [{meal: "Approved meal"}]}}), ""]]);
  h.sheet("Projects", [["id", "name"], ["legacy-fixture", "Unchanged"]]);
  return h;
}
function request(overrides = {}) {
  return {token: "offline-service-token", resource: "meals", operation: "save_draft", actor: "verified-principal", householdId: "butler-household", expectedVersion: 7,
    meals: {draft: {weekStart: "2026-10-05", days: [{meal: "Human draft"}]}}, ...overrides};
}
function meals(h, durable = true) { return JSON.parse(h.rows("Meals", durable)[1][6]); }
function assertLock(h) {
  assert.equal(h.held, false);
  assert.equal(h.events.filter(e => e.type === "acquire").length, h.events.filter(e => e.type === "release").length);
  assert.ok(h.events.filter(e => ["write", "written", "flush"].includes(e.type)).every(e => e.held), "Meals writes and flushes must occur under ScriptLock");
  assert.deepEqual(h.rows("Projects", true), [["id", "name"], ["legacy-fixture", "Unchanged"]]);
}
function queue(h) {
  h.sheet("Agent Operations", [Array(14).fill("header"), ["offline-dot-meals", "butler-household", "dot", "save_meal_draft", "meals", 7,
    JSON.stringify({draft: {weekStart: "2026-10-05", days: [{meal: "Dot draft"}]}}), "PENDING", "", "2026-10-01", "", "", "", ""]]);
}

test("human Meals saves acquire the shared lock before the sheet write and flush before release", () => {
  const h = fixture(); const result = h.post(request());
  assert.equal(result.ok, true); assert.equal(result.meals.version, 8); assert.equal(meals(h).version, 8);
  assert.equal(meals(h).draft.days[0].meal, "Human draft"); assert.equal(meals(h).approved.days[0].meal, "Approved meal");
  const types = h.events.map(e => e.type);
  assert.ok(types.indexOf("acquire") < types.indexOf("write"));
  assert.ok(types.indexOf("written") < types.indexOf("flush"));
  assert.ok(types.indexOf("flush") < types.indexOf("release"));
  assert.equal(h.events.filter(e => e.type === "acquire").length, 1); assertLock(h);
});

test("serialized same-version human saves yield one success and one conflict", () => {
  const h = fixture(); assert.equal(h.post(request()).ok, true);
  const committed = h.rows("Meals", true);
  const second = h.post(request({meals: {draft: {days: [{meal: "Stale second draft"}]}}}));
  assert.equal(second.ok, false); assert.match(second.error, /^CONFLICT:/);
  assert.deepEqual(h.rows("Meals", true), committed); assert.equal(meals(h).version, 8); assertLock(h);
});

test("Dot-first and human-first Meals writes use one lock model without nested acquisition", () => {
  for (const first of ["dot", "human"]) {
    const h = fixture(); queue(h);
    if (first === "dot") {
      h.call("processAgentOperations"); assert.match(h.post(request()).error, /^CONFLICT:/);
      assert.equal(h.rows("Agent Operations", true)[1][7], "SUCCESS"); assert.equal(meals(h).draft.days[0].meal, "Dot draft");
    } else {
      assert.equal(h.post(request()).ok, true); h.call("processAgentOperations");
      assert.equal(h.rows("Agent Operations", true)[1][7], "CONFLICT"); assert.equal(meals(h).draft.days[0].meal, "Human draft");
    }
    assert.equal(meals(h).version, 8);
    assert.equal(h.events.filter(e => e.type === "acquire").length, 2); assertLock(h);
  }
});

test("mutation flush failure returns UNKNOWN even when cleanup persists the write", () => {
  const h = fixture(); h.setFault(e => { if (e.type === "flush" && e.number === 1) throw new Error("injected mutation flush loss"); });
  const result = h.post(request()); assert.equal(result.ok, false); assert.match(result.error, /^UNKNOWN:/);
  assert.equal(meals(h).version, 8); assert.equal(meals(h).draft.days[0].meal, "Human draft"); assertLock(h);
});

test("persistent mutation and cleanup flush failures retain UNKNOWN and release independently", () => {
  const h = fixture(); h.setFault(e => { if (e.type === "flush") throw new Error("injected persistent flush loss"); });
  assert.match(h.post(request()).error, /^UNKNOWN:/);
  assert.equal(meals(h).version, 7); assert.equal(meals(h, false).version, 8);
  assert.equal(h.errors.length, 1); assertLock(h);
});

test("a sheet error after applying cells returns UNKNOWN instead of falsely claiming no write", () => {
  const h = fixture(); h.setFault(e => { if (e.type === "written" && e.sheet === "Meals") throw new Error("injected postwrite response loss"); });
  assert.match(h.post(request()).error, /^UNKNOWN:/); assert.equal(meals(h).version, 8); assertLock(h);
});

test("cleanup-only flush failure preserves the successfully flushed result", () => {
  const h = fixture(); h.setFault(e => { if (e.type === "flush" && e.number === 2) throw new Error("injected cleanup flush loss"); });
  assert.equal(h.post(request()).ok, true); assert.equal(meals(h).version, 8);
  assert.equal(h.errors.length, 1); assertLock(h);
});

test("cleanup failure does not obscure a definitive stale-version conflict", () => {
  const h = fixture(); h.setFault(e => { if (e.type === "flush") throw new Error("injected cleanup loss"); });
  assert.match(h.post(request({expectedVersion: 6})).error, /^CONFLICT:/);
  assert.equal(meals(h).version, 7); assert.equal(meals(h, false).version, 7); assertLock(h);
});

test("lock timeout does not write or release a lock that was never acquired", () => {
  const h = fixture(); const before = h.rows("Meals", true);
  h.setFault(e => { if (e.type === "wait") throw new Error("injected lock timeout"); });
  assert.equal(h.post(request()).ok, false);
  assert.deepEqual(h.rows("Meals", true), before); assert.deepEqual(h.events.map(e => e.type), ["wait"]); assertLock(h);
});

test("existing unversioned compatibility calls are also locked", () => {
  const h = fixture(); assert.equal(h.post(request({expectedVersion: undefined})).ok, true);
  assert.equal(meals(h).version, 8); assertLock(h);
});

test("empty Meals initialization preserves the existing first-version convention under lock", () => {
  const h = fixture(); h.sheet("Meals", [h.rows("Meals")[0]]);
  const result = h.post(request({expectedVersion: undefined}));
  assert.equal(result.ok, true); assert.equal(result.meals.version, 2); assert.equal(meals(h).version, 2); assertLock(h);
});
