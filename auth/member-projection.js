// Pure output contract for the future member API. Call only AFTER verified
// membership and backend household checks. Never pass raw snapshots to clients.
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' ? value.slice(0, 500) : '';
const amount = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

export function projectMemberBudget(snapshot) {
  if (!object(snapshot) || !object(snapshot.budget) || !Array.isArray(snapshot.budget.categories)) return null;
  const rows = snapshot.budget.categories;
  if (rows.length > 100) return null;
  const reconciliation = snapshot.budgetReconciliation?.categories;
  const categories = [];
  const names = new Set();
  for (const row of rows) {
    if (!object(row)) return null;
    const name = text(row.name ?? row.b).trim();
    const planned = amount(row.planned ?? row.limit ?? row.t);
    if (!name || names.has(name) || planned === null) return null;
    names.add(name);
    const matches = Array.isArray(reconciliation) ? reconciliation.filter(item => object(item) && item.name === name) : [];
    // Missing reconciliation is unknown spending, never invented zero spending.
    if (matches.length > 1) return null;
    const spent = matches.length === 1 ? amount(matches[0].spent) : null;
    categories.push({name, planned, spent, remaining: spent === null ? null : planned - spent});
  }
  const planned = categories.reduce((sum, row) => sum + row.planned, 0);
  const spent = categories.every(row => row.spent !== null) ? categories.reduce((sum, row) => sum + row.spent, 0) : null;
  if (!Number.isFinite(planned) || (spent !== null && !Number.isFinite(spent))) return null;
  return {asOf: text(snapshot.asOf), categories, planned, spent, remaining: spent === null ? null : planned - spent};
}

export function projectMemberMeals(meals, householdId) {
  if (!householdId || !object(meals) || meals.householdId !== householdId) return null;
  const plan = meals.approved;
  if (!object(plan) || !Array.isArray(plan.days) || plan.days.length > 7) return null;
  return {weekStart: text(plan.weekStart), days: plan.days.filter(object).map(day => ({date: text(day.date), meal: text(day.meal), prep: text(day.prep)})),
    groceryList: Array.isArray(plan.groceryList) ? plan.groceryList.slice(0, 200).filter(object).map(item => ({item: text(item.item), qty: text(item.qty), done: item.done === true})) : []};
}

export function projectMemberFamily(resources, householdId) {
  if (!householdId || !Array.isArray(resources)) return [];
  const scoped = resources.filter(row => object(row) && row.householdId === householdId);
  const ids = new Set();
  // Duplicate target IDs fail closed, including private/shared collisions.
  for (const row of scoped) {
    if (typeof row.id !== 'string' || !row.id || ids.has(row.id)) return [];
    ids.add(row.id);
  }
  return scoped.filter(row => row.scope === 'household:shared' && row.lifecycle === 'active')
    .map(row => ({id: text(row.id), name: text(row.name), lifecycle: 'active'}));
}
