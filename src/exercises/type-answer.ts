const TRANSLITERATIONS: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };

/** Lowercases, trims, collapses whitespace and spells out umlauts, so "Fuenf" matches "fünf". */
export function normalizeAnswer(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[äöüß]/g, (char) => TRANSLITERATIONS[char]);
}

export function checkAnswer(expected: string, input: string): boolean {
  return normalizeAnswer(expected) === normalizeAnswer(input);
}
