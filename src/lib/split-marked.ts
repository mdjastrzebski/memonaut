/** Splits text at its marked parts, in square brackets: "die B[ü]ch[er]" → "die B", "ü", "ch", "er". */
export function splitMarked(text: string): { text: string; marked: boolean }[] {
  return text
    .split(/\[([^\]]*)\]/)
    .map((part, index) => ({ text: part, marked: index % 2 === 1 }))
    .filter((part) => part.text !== '');
}
