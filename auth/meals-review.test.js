import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {test} from "node:test";

const html = fs.readFileSync(new URL("../app-v5.html", import.meta.url), "utf8");
const source = html.slice(html.indexOf("async function loadMeals(){"), html.indexOf("async function planNextWeek(){"));
const escapeSource = html.split("\n").find(line => line.startsWith("function esc("));
assert.ok(escapeSource);
const clone = value => JSON.parse(JSON.stringify(value));
function shared(version = 8) {
  return {version, householdId: "butler-household", status: "draft", draft: {weekStart: "2026-10-05", days: [{date: "2026-10-05", meal: "Shared dinner", recipe: {ingredients: ["Rice"], instructions: "Cook rice"}}], groceryList: [{item: "Rice"}], inventory: [], settings: {primaryStore: "Shared store"}}, approved: {days: [{meal: "Approved dinner"}]}, mealHistory: [{meals: ["Previous meal"]}]};
}
function fixture() {
  const ids = ["mealReviewBtn", "mealRestoreDraftBtn", "mealReviewPanel", "mealReviewTitle", "mealReviewStatus", "mealReviewComparison", "mealUseSharedBtn", "mealSaveReviewedBtn", "saveMealsBtn", "mealSaveStatus"];
  const elements = Object.fromEntries(ids.map(id => [id, {hidden: true, disabled: false, textContent: "", innerHTML: "", style: {}, focus() { this.focused = true; }}]));
  const requests = [], storage = new Map(), messages = [];
  let fetchImpl = async () => ({ok: true, json: async () => ({ok: true, meals: shared()})});
  let confirmed = true;
  const context = vm.createContext({
    mealsDurable: shared(7),
    state: {meals: {weekStart: "2026-10-05", days: [{date: "2026-10-05", meal: "Local dinner"}], groceryList: [{item: "Local groceries"}], inventory: [{item: "Local pantry"}], settings: {primaryStore: "Local store"}, status: "draft"}},
    document: {getElementById: id => elements[id] ?? null},
    ensureMealWeek() {}, renderMeals() {}, storageKey: () => "offline-user", LEGACY_KEY: "unused",
    localStorage: {setItem: (key, value) => storage.set(key, value)},
    toast: message => messages.push(message), setTimeout() {}, confirm: () => confirmed,
    fetch: async (url, options) => { requests.push({url, options}); return fetchImpl(url, options); }
  });
  vm.runInContext(escapeSource + "\n" + source, context);
  return {context, elements, requests, storage, messages, setFetch: fn => { fetchImpl = fn; }, setConfirmation: value => { confirmed = value; }};
}

test("review fetches and renders both plans without changing local edits or the write baseline", async () => {
  const f = fixture(), local = clone(f.context.state), baseline = clone(f.context.mealsDurable);
  assert.equal(await f.context.reviewSharedMeals(), true);
  assert.deepEqual(clone(f.context.state), local); assert.deepEqual(clone(f.context.mealsDurable), baseline);
  assert.equal(f.requests[0].options.method, undefined); assert.equal(f.requests.length, 1);
  assert.match(f.elements.mealReviewComparison.innerHTML, /Local dinner/); assert.match(f.elements.mealReviewComparison.innerHTML, /Shared dinner/);
  assert.match(f.elements.mealReviewComparison.innerHTML, /Local groceries/); assert.match(f.elements.mealReviewComparison.innerHTML, /Rice/);
  assert.equal(f.elements.mealUseSharedBtn.disabled, false); assert.equal(f.elements.mealReviewTitle.focused, true);
});

test("failed readback disables replacement/save and leaves draft and baseline unchanged", async () => {
  const f = fixture(), before = clone(f.context.state), baseline = clone(f.context.mealsDurable);
  f.setFetch(async () => { throw new Error("offline"); });
  assert.equal(await f.context.reviewSharedMeals(), false);
  assert.equal(f.elements.mealUseSharedBtn.disabled, true); assert.equal(f.elements.mealSaveReviewedBtn.disabled, true);
  assert.equal(await f.context.saveReviewedMealDraft(), false); assert.equal(f.context.useReviewedSharedMeals(), false);
  assert.deepEqual(clone(f.context.state), before); assert.deepEqual(clone(f.context.mealsDurable), baseline);
});

test("comparison renders untrusted meal, recipe and settings text as escaped text", async () => {
  const f = fixture(), malicious = shared(); malicious.draft.days[0].meal = '<img src=x onerror="alert(1)">';
  malicious.draft.days[0].recipe.instructions = "<script>alert(1)</script>";
  malicious.draft.settings = {primaryStore: "<svg onload=alert(1)>"};
  f.setFetch(async () => ({ok: true, json: async () => ({ok: true, meals: malicious})}));
  await f.context.reviewSharedMeals();
  const rendered = f.elements.mealReviewComparison.innerHTML;
  assert.ok(!rendered.includes("<img") && !rendered.includes("<script") && !rendered.includes("<svg"));
  assert.match(rendered, /&lt;img/); assert.match(rendered, /&lt;script/);
});

test("using shared plan requires confirmation, keeps a local recovery draft, and never posts", async () => {
  const f = fixture(), original = clone(f.context.state.meals); await f.context.reviewSharedMeals();
  f.setConfirmation(false); assert.equal(f.context.useReviewedSharedMeals(), false); assert.deepEqual(clone(f.context.state.meals), original);
  f.setConfirmation(true); assert.equal(f.context.useReviewedSharedMeals(), true);
  assert.equal(f.context.state.meals.days[0].meal, "Shared dinner"); assert.equal(f.context.mealsDurable.version, 8);
  assert.deepEqual(clone(f.context.state.mealsRecovery.draft), original);
  assert.equal(f.requests.length, 1); assert.equal(f.elements.mealReviewPanel.hidden, true);
  assert.equal(f.context.restoreLocalMealDraft(), true); assert.deepEqual(clone(f.context.state.meals), original);
  assert.equal(f.context.state.mealsNeedsReview, true); assert.equal(await f.context.saveMeals(), false); assert.equal(f.requests.length, 1);
  assert.deepEqual(JSON.parse(f.storage.get("offline-user")).meals, original);
});

test("explicit reviewed save uses the readback version and keeps latest shared metadata", async () => {
  const f = fixture(); f.context.state.mealsNeedsReview = true; await f.context.reviewSharedMeals();
  f.setFetch(async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.expectedVersion, 8); assert.equal(body.operation, "save_draft"); assert.equal(body.meals.draft.days[0].meal, "Local dinner");
    assert.equal(body.meals.approved.days[0].meal, "Approved dinner"); assert.equal(body.meals.mealHistory[0].meals[0], "Previous meal");
    return {ok: true, json: async () => ({ok: true, meals: {...body.meals, version: 9}})};
  });
  assert.equal(await f.context.saveReviewedMealDraft(), true);
  assert.equal(f.context.mealsDurable.version, 9); assert.equal(f.context.state.mealsNeedsReview, undefined);
  assert.equal(f.elements.mealReviewPanel.hidden, true); assert.equal(f.requests.length, 2);
});

test("a newer shared change during review conflicts and requires a fresh readback without retry", async () => {
  const f = fixture(); await f.context.reviewSharedMeals();
  const baseline = clone(f.context.mealsDurable);
  f.setFetch(async () => ({ok: true, json: async () => ({ok: false, error: "CONFLICT: expected Meals version 8 but current version is 9"})}));
  assert.equal(await f.context.saveReviewedMealDraft(), false);
  assert.equal(await f.context.saveReviewedMealDraft(), false); assert.equal(await f.context.saveMeals(), false);
  assert.deepEqual(clone(f.context.mealsDurable), baseline); assert.equal(f.context.state.meals.days[0].meal, "Local dinner");
  assert.equal(f.requests.length, 2); assert.equal(f.elements.mealSaveReviewedBtn.disabled, true);
});

test("edits made after comparison are shown again before an explicit reviewed save", async () => {
  const f = fixture(); await f.context.reviewSharedMeals(); f.context.state.meals.days[0].meal = "New local edit";
  assert.equal(await f.context.saveReviewedMealDraft(), false); assert.equal(f.requests.length, 1);
  assert.match(f.elements.mealReviewComparison.innerHTML, /New local edit/); assert.match(f.elements.mealReviewStatus.textContent, /draft changed/);
});

test("closing review ignores late readback and leaves actions disabled", async () => {
  const f = fixture(); let resolve;
  f.setFetch(() => new Promise(done => { resolve = done; }));
  const pending = f.context.reviewSharedMeals(); f.context.closeMealReview();
  resolve({ok: true, json: async () => ({ok: true, meals: shared()})});
  assert.equal(await pending, false); assert.equal(f.elements.mealReviewPanel.hidden, true); assert.equal(f.elements.mealUseSharedBtn.disabled, true);
});

test("a pending local review survives reload logic without loading over unsaved edits", async () => {
  const f = fixture(); f.context.state.mealsNeedsReview = true;
  const before = clone(f.context.state.meals);
  assert.equal(await f.context.loadMeals(), false); assert.equal(f.requests.length, 0);
  assert.deepEqual(clone(f.context.state.meals), before); assert.equal(f.elements.mealReviewBtn.hidden, false);
});

test("a superseded comparison response cannot replace a newer reviewed snapshot", async () => {
  const f = fixture(); let oldResponse;
  f.setFetch(() => new Promise(resolve => { oldResponse = resolve; }));
  const oldRequest = f.context.reviewSharedMeals();
  f.setFetch(async () => ({ok: true, json: async () => ({ok: true, meals: shared(9)})}));
  assert.equal(await f.context.reviewSharedMeals(), true);
  oldResponse({ok: true, json: async () => ({ok: true, meals: shared(8)})});
  assert.equal(await oldRequest, false);
  f.context.useReviewedSharedMeals(); assert.equal(f.context.mealsDurable.version, 9);
});

test("late initial load cannot overwrite a draft flagged for review while the read was in flight", async () => {
  const f = fixture(); let response;
  f.setFetch(() => new Promise(resolve => { response = resolve; }));
  const loading = f.context.loadMeals();
  f.context.showMealReviewAction(new Error("CONFLICT: shared changed"));
  const before = clone(f.context.state.meals);
  response({ok: true, json: async () => ({ok: true, meals: shared(9)})});
  assert.equal(await loading, false); assert.deepEqual(clone(f.context.state.meals), before);
});

test("lost save responses require readback, retain local edits, and block blind resend", async () => {
  for (const failure of ["transport", "body", "invalid-result", "server-error"]) {
    const f = fixture();
    f.setFetch(async () => {
      if (failure === "transport") throw new Error("injected response loss");
      if (failure === "body") return {ok: true, json: async () => { throw new Error("injected body loss"); }};
      if (failure === "server-error") return {ok: false, status: 502, json: async () => ({ok: false, error: "Upstream failed"})};
      return {ok: true, json: async () => ({ok: true, meals: shared(20)})};
    });
    assert.equal(await f.context.saveMeals(), false);
    assert.equal(f.context.state.mealsNeedsReview, true); assert.equal(f.elements.mealReviewBtn.hidden, false);
    assert.equal(f.context.state.meals.days[0].meal, "Local dinner"); assert.equal(f.context.mealsDurable.version, 7);
    assert.equal(await f.context.saveMeals(), false); assert.equal(f.requests.length, 1);
  }
});
