import assert from "node:assert";
import { hasWord, longestOf } from "../trie.js";
import { step, close } from "../trierun.js";
import { render } from "../app.js";

const base = {
  budget: 1,
  state: { words: [], records: [], ledger: [], applied: [] },
  events: [{ id: 1, kind: "put", word: "ab" }],
  bad_word_code: "E_BAD_WORD", bad_text_code: "E_BAD_TEXT",
  dup_code: "E_DUP_WORD", no_match_code: "E_NO_MATCH",
  event_error_code: "E_BAD_EVENT"
};

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok " + name); } catch (e) { failed += 1; console.log("FAIL " + name + " :: " + e.message); }
}

check("hasWord returns a boolean", () => {
  assert.strictEqual(typeof hasWord(["ab"], "ab"), "boolean");
});

check("longestOf returns text", () => {
  assert.strictEqual(typeof longestOf(["ab"], "abc"), "string");
});

check("step returns a state", () => {
  assert.strictEqual(typeof step(base).state, "object");
});

check("close returns a state", () => {
  assert.strictEqual(typeof close(base).state, "object");
});

check("render counts events", () => {
  assert.strictEqual(typeof render(base).count_events, "number");
});

console.log("5 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
