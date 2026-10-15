import { buildContent } from '@/data/content';

/** `count` made-up words, e.g. "wort 1" for "słowo 1", for decks that need many. */
function madeUpWords(count: number): string {
  return Array.from(
    { length: count },
    (_, index) =>
      `  - { id: wort-${index + 1}, local: słowo ${index + 1}, foreign: wort ${index + 1} }`,
  ).join('\n');
}

/**
 * Content for tests, standing in for the bundled word sets (see `setup.ts`), so tests don't pass or
 * fail when those change. Its Subjects and Decks are named like the bundled ones.
 */
export const testContent = buildContent({
  './english/subject.yaml': `
id: english
name: English
kind: language
emoji: 🇬🇧
foreignLanguage: en-GB
`,
  './english/core.yaml': `
exerciseTypes: [dictation, translation]
concepts:
  - { id: red, local: czerwony, foreign: red, group: color }
  - { id: blue, local: niebieski, foreign: blue, group: color }
`,
  './english/decks/days-months-seasons.yaml': `
id: days-months-seasons
name: Days, months and seasons
concepts:
  - { id: monday, local: poniedziałek, foreign: Monday, group: weekday }
  - { id: tuesday, local: wtorek, foreign: Tuesday, group: weekday }
  - { id: wednesday, local: środa, foreign: Wednesday, group: weekday }
  - { id: thursday, local: czwartek, foreign: Thursday, group: weekday }
`,

  './german/subject.yaml': `
id: german
name: German
kind: language
emoji: 🇩🇪
foreignLanguage: de-DE
specialCharacters: [ä, ö, ü, ß]
`,
  // More words than a 5-minute session of translation fits.
  './german/core.yaml': `
exerciseTypes: [dictation, translation]
concepts:
  - { id: number-0, local: zero, foreign: null, hint: 0 }
  - { id: number-1, local: jeden, foreign: eins, hint: 1 }
  - { id: number-2, local: dwa, foreign: zwei, hint: 2 }
  - { id: number-3, local: trzy, foreign: drei, hint: 3 }
  - { id: number-4, local: cztery, foreign: vier, hint: 4 }
  - { id: number-5, local: pięć, foreign: fünf, hint: 5 }
  - { id: number-6, local: sześć, foreign: sechs, hint: 6 }
  - { id: number-7, local: siedem, foreign: sieben, hint: 7 }
  - { id: number-8, local: osiem, foreign: acht, hint: 8 }
  - { id: number-9, local: dziewięć, foreign: neun, hint: 9 }
  - { id: ja, local: tak, foreign: ja }
  - { id: nein, local: nie, foreign: nein }
`,
  // More words than a 10-minute session of multiple choice fits.
  './german/decks/kapitel-0.yaml': `
id: kapitel-0
name: Kapitel 0
concepts:
${madeUpWords(45)}
`,
  './german/decks/kapitel-1.yaml': `
id: kapitel-1
name: Kapitel 1
concepts:
  - { id: der-ball, local: piłka, foreign: der Ball }
  - { id: der-fussball, local: piłka nożna, foreign: der Fußball }
  - { id: das-buch, local: książka, foreign: das Buch }
  - { id: das-maeppchen, local: piórnik, foreign: das Mäppchen }
  - { id: die-buecher, local: książki, foreign: die Bücher, plural: true }
  - { id: number-100, local: sto, foreign: hundert, alternatives: [einhundert], hint: 100 }
`,

  './math/subject.yaml': `
id: math
name: Matematyka
emoji: 🔢
kind: knowledge
`,
  './math/decks/powers.yaml': `
id: powers
name: Potęgi
concepts:
  - { id: square-3, question: '3² =', answer: '9', explanation: '3² = 9' }
  - { id: square-7, question: '7² =', answer: '49', explanation: '7² = 49' }
  - {
      id: mixed-2-times-3sq,
      question: '2 · 3² =',
      answer: '18',
      explanation: '2 · 3² = 18',
      choices: [36, 12, 11],
    }
`,

  './polish/subject.yaml': `
id: polish
name: Polish
kind: language
emoji: 🇵🇱
foreignLanguage: pl-PL
specialCharacters: [ą, ć, ę, ł, ń, ó, ś, ź, ż]
trickySpellings: [ó, u, rz, ż, ch, h]
exerciseTypes: [dictation]
`,
  // More words than a 5-minute session of dictation fits.
  './polish/decks/trudne-slowka.yaml': `
id: trudne-slowka
name: Trudne słówka
strictSpelling: true
shuffleNew: true
concepts:
  - { id: morze, foreign: morze, spokenHint: zbiornik słonej wody }
  - { id: zolw, foreign: żółw }
  - { id: gora, foreign: góra }
  - { id: rzeka, foreign: rzeka }
  - { id: chmura, foreign: chmura }
  - { id: herbata, foreign: herbata }
  - { id: ogorek, foreign: ogórek }
  - { id: zaba, foreign: żaba }
  - { id: kura, foreign: kura }
  - { id: brzoza, foreign: brzoza }
  - { id: duch, foreign: duch }
  - { id: hak, foreign: hak }
`,
});
