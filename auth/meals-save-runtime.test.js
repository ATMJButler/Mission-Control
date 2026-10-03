import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {test} from "node:test";
import {authorize} from "./authorization.js";
import {requireMissionControlOrigin} from "./origin.js";
import {createAppsScriptHarness} from "./helpers/apps-script-harness.js";

const html = fs.readFileSync(new URL("../app-v5.html", import.meta.url), "utf8");
const browserSource = html.slice(html.indexOf("function durableMealsPayload(){"), html.indexOf("async function planNextWeek(){"));
assert.ok(browserSource.startsWith("function durableMealsPayload(){") && browserSource.includes("async function saveMeals("));
// Execute route logic with injected identity/directory adapters. No Clerk SDK or
// production credentials are needed; this does not test real identity verification.
const routeSource = fs.readFileSync(new URL("../api/meals.js", import.meta.url), "utf8")
  .replace(/^import .*;\r?\n/gm, "")
  .replace("export default async function handler", "globalThis.mealsHandler = async function handler");

function setup(t, {loadedVersion = 7, currentVersion = 7, role = "principal"} = {}) {
  const before = process.env.MC_AUTHORIZED_PARTIES;
  process.env.MC_AUTHORIZED_PARTIES = "https://offline.invalid";
  t.after(() => { if (before === undefined) delete process.env.MC_AUTHORIZED_PARTIES; else process.env.MC_AUTHORIZED_PARTIES = before; });
  const backend = createAppsScriptHarness();
  const approved = {weekStart: "2026-09-28", days: [{meal: "Previously approved"}]};
  const meals = {version: currentVersion, householdId: "butler-household", schemaVersion: 1, draft: {weekStart: "2026-10-05", days: [{meal: "Shared draft"}]}, approved, mealHistory: []};
  backend.sheet("Meals", [["key", "householdId", "schemaVersion", "updatedAt", "updatedBy", "status", "json", "notes"], ["butler-household", "butler-household", 1, "", "", "draft", JSON.stringify(meals), ""]]);
  const upstreamRequests = [], browserRequests = [], messages = [], storage = new Map();
  const status = {textContent: "", style: {}}, button = {disabled: false, textContent: "Save Draft"};
  const user = {userId: "offline-verified-user", status: "active"};
  const household = {householdId: "butler-household", status: "active"};
  const route = vm.createContext({
    process: {env: {MC_SYNC_URL: "https://offline.invalid/exec", MC_SYNC_TOKEN: "offline-service-token"}},
    installClerkIdentityAdapter() {}, installUpstreamDirectoryAdapter() {},
    requireVerifiedIdentity: async () => ({provider: "offline-mock", subject: "offline-subject"}),
    resolveAccessContext: async (identity, householdId) => {
      assert.equal(identity.subject, "offline-subject"); assert.equal(householdId, household.householdId);
      return {user, household, membership: {userId: user.userId, householdId, role, status: "active"}};
    },
    authorize, requireMissionControlOrigin,
    fetch: async (url, options) => {
      assert.equal(url, "https://offline.invalid/exec");
      const body = JSON.parse(options.body); upstreamRequests.push(body);
      const result = backend.post(body);
      // Model end-of-request persistence; real Google buffering is not simulated.
      backend.flush();
      return new Response(JSON.stringify(result));
    }
  });
  vm.runInContext(routeSource, route, {filename: "api/meals.js"});
  async function post(body) {
    let code = 200, result;
    const response = {
      setHeader() { return this; }, status(value) { code = value; return this; },
      json(value) { result = value; return this; }, send(value) { result = JSON.parse(value); return this; }
    };
    await route.mealsHandler({method: "POST", headers: {origin: "https://offline.invalid", "sec-fetch-site": "same-origin"}, body}, response);
    return {ok: code >= 200 && code < 300, status: code, json: async () => result};
  }
  const browser = vm.createContext({
    mealsDurable: {...structuredClone(meals), version: loadedVersion},
    state: {meals: {weekStart: "2026-10-05", days: [{meal: "My local edit"}], groceryList: [], inventory: [], settings: {}, status: "draft"}},
    ensureMealWeek() {}, storageKey: () => "offline-user-meals", LEGACY_KEY: "unused",
    localStorage: {setItem: (key, value) => storage.set(key, value)},
    document: {getElementById: id => id === "saveMealsBtn" ? button : id === "mealSaveStatus" ? status : null},
    toast: message => messages.push(message), setTimeout() {}, renderMeals() {},
    fetch: async (url, options) => { assert.equal(url, "/api/meals"); const body = JSON.parse(options.body); browserRequests.push(body); return post(body); }
  });
  vm.runInContext(browserSource, browser, {filename: "app-v5.html Meals functions"});
  return {backend, browser, post, browserRequests, upstreamRequests, messages, storage, status, button, approved};
}

test("Save Draft carries loaded version through the API and derives actor on the server", async t => {
  const flow = setup(t);
  assert.equal(await flow.browser.saveMeals(), true);
  assert.equal(flow.browserRequests[0].expectedVersion, 7);
  assert.equal("actor" in flow.browserRequests[0], false);
  assert.equal(flow.upstreamRequests[0].expectedVersion, 7);
  assert.equal(flow.upstreamRequests[0].actor, "offline-verified-user");
  assert.equal(flow.browser.mealsDurable.version, 8);
  assert.equal(flow.browser.mealsDurable.draft.days[0].meal, "My local edit");
  assert.deepEqual(JSON.parse(JSON.stringify(flow.browser.mealsDurable.approved)), flow.approved);
  assert.equal(flow.button.disabled, false);
});

test("stale Save Draft preserves newer shared state and keeps local edits without retry", async t => {
  const flow = setup(t, {loadedVersion: 7, currentVersion: 8});
  const before = flow.backend.rows("Meals");
  assert.equal(await flow.browser.saveMeals(), false);
  assert.deepEqual(flow.backend.rows("Meals"), before);
  assert.equal(flow.browserRequests.length, 1); assert.equal(flow.upstreamRequests.length, 1);
  assert.equal(flow.browser.mealsDurable.version, 7);
  assert.equal(JSON.parse(flow.storage.get("offline-user-meals")).meals.days[0].meal, "My local edit");
  assert.match(flow.status.textContent, /Not saved.*CONFLICT:/);
  assert.equal(flow.button.disabled, false);
});

test("approval saves against loaded version then approves against returned version", async t => {
  const flow = setup(t); await flow.browser.approveMeals();
  assert.deepEqual(flow.browserRequests.map(body => [body.operation, body.expectedVersion]), [["save_draft", 7], ["approve", 8]]);
  assert.equal(flow.browser.mealsDurable.version, 9);
  assert.equal(flow.browser.mealsDurable.approved.days[0].meal, "My local edit");
  assert.equal(flow.browser.mealsDurable.approved.approvedBy, "offline-verified-user");
  assert.equal(flow.browser.mealsDurable.mealHistory.length, 1);
});

test("approval stops after stale draft rejection", async t => {
  const flow = setup(t, {loadedVersion: 7, currentVersion: 8});
  const before = flow.backend.rows("Meals"); await flow.browser.approveMeals();
  assert.deepEqual(flow.browserRequests.map(body => body.operation), ["save_draft"]);
  assert.deepEqual(flow.backend.rows("Meals"), before);
  assert.ok(flow.messages.includes("Cannot approve until the shared draft saves"));
});

test("top-level browser actor and household do not replace authorized server context", async t => {
  const flow = setup(t);
  const response = await flow.post({operation: "save_draft", expectedVersion: 7, actor: "smuggled-actor", householdId: "foreign-household", meals: {draft: {days: []}}});
  assert.equal((await response.json()).ok, true);
  assert.equal(flow.upstreamRequests[0].actor, "offline-verified-user");
  assert.equal(flow.upstreamRequests[0].householdId, "butler-household");
});

test("extended role cannot send a Meals draft mutation upstream", async t => {
  const flow = setup(t, {role: "extended"}); const before = flow.backend.rows("Meals");
  assert.equal(await flow.browser.saveMeals(), false); assert.equal(flow.upstreamRequests.length, 0);
  assert.deepEqual(flow.backend.rows("Meals"), before);
});
