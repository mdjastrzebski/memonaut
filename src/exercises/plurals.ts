/**
 * How a plural is made from its singular, for the result of the plural Exercise Types, with what
 * the plural adds or changes in square brackets, e.g. "das Buch → die B[ü]ch[er]". Only the last
 * word is compared, so an article that changes, as all German ones do to "die", isn't marked,
 * unless it's all that changes, e.g. "der Computer → [die] Computer".
 */
export function getPluralExplanation(singular: string, plural: string): string {
  const [singularStart, singularWord] = splitLastWord(singular);
  const [pluralStart, pluralWord] = splitLastWord(plural);
  const marked = markAdded(singularWord, pluralWord);
  const start =
    marked === pluralWord && pluralStart.trim() !== '' && pluralStart !== singularStart
      ? `[${pluralStart.trimEnd()}] `
      : pluralStart;
  return `${singular} → ${start}${marked}`;
}

/** The text before the last word, with its space, and the last word. */
function splitLastWord(text: string): [string, string] {
  const index = text.lastIndexOf(' ') + 1;
  return [text.slice(0, index), text.slice(index)];
}

/**
 * The `to` word with the letters that aren't in `from` in square brackets, by their longest common
 * subsequence, matching as early as possible, e.g. "B[ü]ch[er]" from "Buch" to "Bücher".
 */
function markAdded(from: string, to: string): string {
  // common[i][j]: length of the longest common subsequence of from.slice(i) and to.slice(j).
  const common = Array.from({ length: from.length + 1 }, () =>
    new Array<number>(to.length + 1).fill(0),
  );
  for (let i = from.length - 1; i >= 0; i--) {
    for (let j = to.length - 1; j >= 0; j--) {
      common[i][j] =
        from[i] === to[j] ? common[i + 1][j + 1] + 1 : Math.max(common[i + 1][j], common[i][j + 1]);
    }
  }

  let result = '';
  let added = false;
  let i = 0;
  for (let j = 0; j < to.length; j++) {
    while (i < from.length && from[i] !== to[j] && common[i + 1][j] === common[i][j]) i++;
    const kept = i < from.length && from[i] === to[j];
    if (kept !== !added) result += kept ? ']' : '[';
    added = !kept;
    result += to[j];
    if (kept) i++;
  }
  return added ? `${result}]` : result;
}
