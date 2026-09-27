// trie.js：词表判定与最长前缀
export function hasWord(words, word) {
  return (words || []).indexOf(word) !== -1;
}

export function longestOf(words, text) {
  let best = "";
  (words || []).forEach(function (word) {
    if (word.length > best.length && text.slice(0, word.length) === word) {
      best = word;
    }
  });
  return best;
}
