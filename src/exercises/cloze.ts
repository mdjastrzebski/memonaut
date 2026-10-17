/** A sentence split at its gap: "das ist der Rucksack [von Julian]" → "das ist der Rucksack ", "von Julian", "". */
export interface ClozeParts {
  before: string;
  gap: string;
  after: string;
}

/** Splits a cloze at its one gap in square brackets, or returns undefined without exactly one. */
export function splitCloze(cloze: string): ClozeParts | undefined {
  const match = /^([^[\]]*)\[([^[\]]*\S[^[\]]*)\]([^[\]]*)$/.exec(cloze);
  if (!match) return undefined;
  const [, before, gap, after] = match;
  return { before, gap, after };
}

/** The sentence of a valid cloze, its gap filled in. */
export function getClozeText(cloze: string): string {
  return fillCloze(splitCloze(cloze)!);
}

/** The cloze with its gap filled in: "das ist der Rucksack [von Julian]" → "das ist der Rucksack von Julian". */
export function fillCloze({ before, gap, after }: ClozeParts): string {
  return before + gap + after;
}
