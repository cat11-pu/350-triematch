// trierun.js：按处理预算处理并留账
import { hasWord, longestOf } from "./trie.js";

function codes(spec) {
  spec = spec || {};
  return {
    event: spec.event_error_code || "E_BAD_EVENT",
    word: spec.bad_word_code || "E_BAD_WORD",
    text: spec.bad_text_code || "E_BAD_TEXT",
    dup: spec.dup_code || "E_DUP_WORD",
    nomatch: spec.no_match_code || "E_NO_MATCH"
  };
}

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function keyOf(kind, payload) {
  return kind + " " + payload;
}

function copyState(state) {
  state = state || {};
  return {
    words: (state.words || []).slice(),
    records: (state.records || []).map(function (row) { return [row[0], row[1]]; }),
    ledger: (state.ledger || []).map(function (row) { return [row[0], row[1]]; }),
    applied: (state.applied || []).slice()
  };
}

// 结构、空词、空文本先校验，与预算无关；整条事件不合法报 event 码。
function validate(events, code) {
  return (events || []).map(function (event) {
    if (!event || typeof event !== "object") fail(code.event);
    if (event.kind === "put") {
      if (typeof event.word !== "string") fail(code.event);
      if (event.word === "") fail(code.word);
      return { kind: "put", payload: event.word };
    }
    if (event.kind === "match") {
      if (typeof event.text !== "string") fail(code.event);
      if (event.text === "") fail(code.text);
      return { kind: "match", payload: event.text };
    }
    fail(code.event);
  });
}

// 重复登记与无匹配按当前词表判，处理到那条时才可能撞上。
function applyItem(state, item, code) {
  const key = keyOf(item.kind, item.payload);
  if (state.applied.indexOf(key) !== -1) return false;
  if (item.kind === "put") {
    if (hasWord(state.words, item.payload)) fail(code.dup);
    state.words.push(item.payload);
    state.words.sort();
  } else {
    const hit = longestOf(state.words, item.payload);
    if (hit === "") fail(code.nomatch);
    state.records.push([item.payload, hit]);
  }
  state.applied.push(key);
  return true;
}

export function step(spec) {
  spec = spec || {};
  const code = codes(spec);
  const state = copyState(spec.state);
  const incoming = validate(spec.events, code);
  const queue = state.ledger.map(function (row) {
    return { kind: row[0], payload: row[1] };
  }).concat(incoming);
  let budget = typeof spec.budget === "number" ? spec.budget : 0;
  let served = 0;
  let judged = 0;
  const rest = [];
  queue.forEach(function (item) {
    judged += 1;
    if (budget > 0) {
      const key = keyOf(item.kind, item.payload);
      if (state.applied.indexOf(key) !== -1) return;
      budget -= 1;
      applyItem(state, item, code);
      served += 1;
    } else {
      rest.push([item.kind, item.payload]);
    }
  });
  state.ledger = rest;
  return {
    state: state,
    served: served,
    ledger_before: rest.length,
    ledger: rest.map(function (row) { return [row[0], row[1]]; }),
    judged: judged,
    judged_bound: queue.length
  };
}

export function close(spec) {
  spec = spec || {};
  const code = codes(spec);
  const state = copyState(spec.state);
  let catchup = 0;
  state.ledger.forEach(function (row) {
    if (applyItem(state, { kind: row[0], payload: row[1] }, code)) catchup += 1;
  });
  state.ledger = [];
  return { state: state, catchup: catchup };
}
