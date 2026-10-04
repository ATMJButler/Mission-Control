import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import vm from "node:vm";

const canonicalSource = fs.readFileSync(new URL("../../google_apps_script_Code.gs", import.meta.url), "utf8");
const copy = value => structuredClone(value);

// Executes the whole canonical source; only Google platform services are replaced.
// Writes are buffered until flush, so tests can distinguish visible and durable state.
// This synchronous model cannot establish real ScriptLock concurrency or Google durability.
export function createAppsScriptHarness({source = canonicalSource} = {}) {
  const sheets = new Map(), events = [], errors = [];
  const properties = new Map([["SYNC_TOKEN", "offline-service-token"], ["PROJECT_V1_TRUSTED_DISPATCH", "enabled"]]);
  let held = false, flushCount = 0, fault = () => {};

  function event(type, details = {}) {
    const entry = {type, held, ...details};
    events.push(entry);
    fault(entry);
  }

  function sheet(name, rows = []) {
    const state = {rows: copy(rows), durable: copy(rows)};
    const api = {
      getName: () => name,
      getLastRow: () => state.rows.findLastIndex(row => row.some(v => v !== "")) + 1,
      getLastColumn: () => Math.max(0, ...state.rows.map(row => row.length)),
      setFrozenRows() {},
      getRange(row, col, height = 1, width = 1) {
        assert.ok([row, col, height, width].every(n => Number.isInteger(n) && n > 0));
        return {
          getValues: () => Array.from({length: height}, (_, y) => Array.from({length: width}, (_, x) => state.rows[row + y - 1]?.[col + x - 1] ?? "")),
          getDisplayValues() { return this.getValues().map(row => row.map(String)); },
          getValue() { return this.getValues()[0][0]; },
          setValues(values) {
            assert.equal(values.length, height);
            values.forEach(value => assert.equal(value.length, width));
            event("write", {sheet: name, row, col, height, width});
            for (let y = 0; y < height; y++) {
              state.rows[row + y - 1] ??= [];
              for (let x = 0; x < width; x++) state.rows[row + y - 1][col + x - 1] = copy(values[y][x]);
            }
            event("written", {sheet: name, row, col, height, width});
            return this;
          },
          setValue(value) { return this.setValues([[value]]); },
          clearContent() { return this.setValues(Array.from({length: height}, () => Array(width).fill(""))); }
        };
      },
      getDataRange() { return this.getRange(1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); },
      appendRow(values) {
        event("append", {sheet: name});
        this.getRange(this.getLastRow() + 1, 1, 1, values.length).setValues([values]);
      }
    };
    sheets.set(name, {state, api});
    return api;
  }

  const spreadsheet = {
    getSheetByName: name => sheets.get(name)?.api ?? null,
    insertSheet(name) { assert.ok(!sheets.has(name)); event("insert", {sheet: name}); return sheet(name); }
  };
  const lock = {
    waitLock(timeout) { assert.equal(timeout, 30000); assert.equal(held, false); event("wait", {timeout}); held = true; event("acquire"); },
    releaseLock() { assert.equal(held, true); event("release"); held = false; }
  };
  const context = vm.createContext({
    console: {error: (...args) => errors.push(args.map(String))},
    SpreadsheetApp: {
      getActive: () => spreadsheet,
      flush() {
        event("flush", {number: ++flushCount});
        for (const {state} of sheets.values()) state.durable = copy(state.rows);
      }
    },
    LockService: {getScriptLock: () => lock},
    PropertiesService: {getScriptProperties: () => ({getProperty: name => properties.get(name) ?? null, setProperty: (name, value) => properties.set(name, value)})},
    Utilities: {
      DigestAlgorithm: {SHA_256: "sha256"}, Charset: {UTF_8: "utf8"},
      computeDigest: (algorithm, value, encoding) => Array.from(crypto.createHash(algorithm).update(value, encoding).digest()),
      formatDate: date => date.toISOString().slice(0, 10)
    },
    Session: {getScriptTimeZone: () => "UTC"},
    ContentService: {MimeType: {JSON: "json"}, createTextOutput: text => ({setMimeType: () => ({text})})}
  });
  vm.runInContext(source, context, {filename: "google_apps_script_Code.gs", timeout: 1000});
  return {
    events, errors, properties, sheet,
    setFault: callback => { fault = callback; },
    flush: () => context.SpreadsheetApp.flush(),
    get held() { return held; },
    rows: (name, durable = false) => copy(sheets.get(name)?.state[durable ? "durable" : "rows"] ?? []),
    call(name, ...args) {
      assert.equal(typeof context[name], "function", `Unknown Apps Script function: ${name}`);
      context.__args = args;
      try { return vm.runInContext(`${name}(...__args)`, context, {timeout: 1000}); }
      finally { delete context.__args; }
    },
    post(body) { return JSON.parse(this.call("doPost", {postData: {contents: JSON.stringify(body)}}).text); }
  };
}

export const projectHeaders = ["id", "householdId", "schemaVersion", "version", "lifecycle", "operatingState", "name", "area", "scope", "createdAt", "createdBy", "updatedAt", "updatedBy", "legacyProjectId", "resourceJson", "notes"];
export function projectRow({id = "fixture", householdId = "butler-household", version = 7, lifecycle = "active", raw = {}} = {}) {
  return [id, householdId, 1, version, lifecycle, "Active", "Offline fixture", "Home", "private:john", "2026-01-01T00:00:00.000Z", "fixture-author", "2026-01-01T00:00:00.000Z", "fixture-author", "", JSON.stringify({id, name: "Offline fixture", lifecycle, notes: "preserve me", reviewStatus: "pending", ...raw}), "Fixture"];
}
