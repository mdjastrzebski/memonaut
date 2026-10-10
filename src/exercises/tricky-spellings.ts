/** A piece of a word, marked if it's a tricky spelling, e.g. "rz" in "burza". */
export interface SpellingPart {
  text: string;
  tricky: boolean;
}

/**
 * Splits a word into pieces, marking every tricky spelling in it, whatever its case. Longer
 * spellings win, so "ch" is one piece rather than "c" and a tricky "h". Tricky spellings next to
 * each other form one piece, e.g. "żó" in "żółw".
 */
export function splitTrickySpellings(word: string, tricky: string[]): SpellingPart[] {
  if (tricky.length === 0) return [{ text: word, tricky: false }];

  const alternatives = [...tricky]
    .sort((a, b) => b.length - a.length)
    .map((spelling) => spelling.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  // With a capturing group, split puts every match at an odd index.
  const pieces = word.split(new RegExp(`(${alternatives.join('|')})`, 'iu'));

  const parts: SpellingPart[] = [];
  pieces.forEach((text, index) => {
    if (text === '') return;
    const isTricky = index % 2 === 1;
    const last = parts.at(-1);
    if (last?.tricky === isTricky) {
      last.text += text;
    } else {
      parts.push({ text, tricky: isTricky });
    }
  });
  return parts;
}
