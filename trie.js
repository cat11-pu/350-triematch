// trie.js：词表判定与最长前缀匹配
export function hasWord(words, word) {
  return words.indexOf(word) !== -1;
}

export function longestOf(words, text) {
  let best = "";
  for (const word of words) {
    if (text.startsWith(word) && word.length > best.length) {
      best = word;
    }
  }
  return best;
}
