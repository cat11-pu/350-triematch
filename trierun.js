// trierun.js：按处理预算处理事件，用尽的连着压账，收尾不限预算补齐
import { hasWord, longestOf } from "./trie.js";

const DEFAULT_CODES = {
  bad_word_code: "E_BAD_WORD",
  bad_text_code: "E_BAD_TEXT",
  dup_code: "E_DUP_WORD",
  no_match_code: "E_NO_MATCH",
  event_error_code: "E_BAD_EVENT"
};

function code(spec, name) {
  return spec[name] || DEFAULT_CODES[name];
}

function fail(codeValue, message) {
  const error = new Error(message || codeValue);
  error.code = codeValue;
  throw error;
}

function kindOf(event) {
  return event && typeof event === "object" && !Array.isArray(event) ? event.kind : undefined;
}

function payloadOf(event) {
  return kindOf(event) === "put" ? event.word : event.text;
}

// 结构与空值校验：与预算无关，整批先校验
function validate(event, spec) {
  const kind = kindOf(event);
  if (kind !== "put" && kind !== "match") {
    fail(code(spec, "event_error_code"));
  }
  const payload = payloadOf(event);
  if (typeof payload !== "string") {
    fail(code(spec, "event_error_code"));
  }
  if (payload === "") {
    fail(code(spec, kind === "put" ? "bad_word_code" : "bad_text_code"));
  }
  return payload;
}

function eventKey(event, kind, payload) {
  if (event.id !== undefined && event.id !== null) {
    return "id:" + String(event.id);
  }
  return "ev:" + kind + "\u0000" + payload;
}

// 账面条目序列化为 [kind, payload]；key 挂成不可枚举属性，JSON 不可见
function toLedgerPair(kind, payload, key) {
  const pair = [kind, payload];
  Object.defineProperty(pair, "key", { value: key, enumerable: false, configurable: true });
  return pair;
}

function pairKey(pair, index) {
  if (pair && typeof pair.key === "string") return pair.key;
  return "ev:" + pair[0] + "\u0000" + pair[1] + "#" + index;
}

function cloneState(state) {
  const source = state || {};
  return {
    words: Array.isArray(source.words) ? source.words.slice() : [],
    records: Array.isArray(source.records) ? source.records.map(function (row) { return [row[0], row[1]]; }) : [],
    ledger: Array.isArray(source.ledger) ? source.ledger.slice() : [],
    applied: Array.isArray(source.applied) ? source.applied.slice() : []
  };
}

function applyOne(next, kind, payload, spec) {
  if (kind === "put") {
    if (hasWord(next.words, payload)) {
      fail(code(spec, "dup_code"));
    }
    next.words.push(payload);
    next.words.sort();
  } else {
    const matched = longestOf(next.words, payload);
    if (matched === "") {
      fail(code(spec, "no_match_code"));
    }
    next.records.push([payload, matched]);
  }
}

export function step(spec) {
  const input = spec || {};
  const events = Array.isArray(input.events) ? input.events : [];
  const budget = Number.isFinite(input.budget) ? Math.max(0, Math.trunc(input.budget)) : 0;
  const next = cloneState(input.state);

  // 先整批校验，与预算无关
  events.forEach(function (event) { validate(event, spec); });

  const appliedSet = new Set(next.applied);
  const incoming = next.ledger.length;

  // 先处理上轮压账，再处理本轮事件
  const queue = [];
  next.ledger.forEach(function (pair, index) {
    queue.push({ kind: pair[0], payload: pair[1], key: pairKey(pair, index) });
  });
  events.forEach(function (event) {
    const kind = kindOf(event);
    queue.push({ kind: kind, payload: payloadOf(event), key: eventKey(event, kind, payloadOf(event)) });
  });

  next.ledger = [];
  let served = 0;
  queue.forEach(function (item) {
    if (appliedSet.has(item.key)) return;
    if (served >= budget) {
      next.ledger.push(toLedgerPair(item.kind, item.payload, item.key));
      return;
    }
    applyOne(next, item.kind, item.payload, spec);
    appliedSet.add(item.key);
    served += 1;
  });
  next.applied = Array.from(appliedSet);

  return {
    state: next,
    served: served,
    ledger_before: next.ledger.length,
    ledger: next.ledger,
    judged: served,
    judged_bound: events.length + incoming
  };
}

export function close(spec) {
  const input = spec || {};
  const next = cloneState(input.state);
  const appliedSet = new Set(next.applied);
  let catchup = 0;

  // 收尾只处理账，不限预算
  const pending = next.ledger;
  next.ledger = [];
  pending.forEach(function (pair, index) {
    const key = pairKey(pair, index);
    if (appliedSet.has(key)) return;
    applyOne(next, pair[0], pair[1], spec);
    appliedSet.add(key);
    catchup += 1;
  });
  next.applied = Array.from(appliedSet);

  return { state: next, catchup: catchup };
}
