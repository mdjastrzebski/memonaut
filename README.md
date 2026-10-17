# Memonaut

Memonaut is a learning web app for school kids, built on spaced repetition. It helps a learner keep what they learn in school subjects, such as English, German, Polish or Przyroda, by scheduling each piece of knowledge for review just before it would be forgotten.

> **Status:** early prototype. The concepts below are settled. Pick a subject (German, English or Polish spelling) and its core set or a unit, then study it: multiple choice, dictation and translation, FSRS scheduling. Each Card's review state is saved in the browser after every answer; the setup screen shows how many words are due today.

## Goals

- **One place per subject.** Each subject is kept separate, with its own content and progress.
- **Follow the school curriculum.** Content is organized into units that match school units of learning.
- **Retain the essentials long-term.** A core set holds key knowledge, such as essential words or verb conjugations, that should stay fresh after the unit is over.
- **Shared progress.** The same concept can appear in a unit and in the core set, and practising it in one place counts in all of them.
- **Varied practice.** Each concept can be practised with several exercise types, not just flip cards.

## Core concepts

A **Deck** includes a number of **Concepts**. Each Concept splits into a number of **Cards**, one per **Exercise Type**, which the user sees as separate exercises. Each Card keeps its own review schedule. A Concept can be in any number of Decks: several unit decks, the core deck, or only the core deck. A review in one Deck counts everywhere.

| Term              | Meaning                                                                                                                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Subject**       | A separate area of study, e.g. English, German or Przyroda. All Decks and Concepts belong to one Subject. Its kind is `language` (words of a language) or `knowledge` (questions with an answer, e.g. math). |
| **Deck**          | A group of Concepts within a Subject. Its kind is either `unit` (a school unit) or `core` (long-term essentials).                                                                                            |
| **Concept**       | One piece of knowledge, e.g. a word, a verb's conjugation or a fact. It can be in any number of Decks within its Subject.                                                                                    |
| **Exercise Type** | A way to practise a Concept, e.g. flashcard, type the answer, multiple choice or conjugate.                                                                                                                  |
| **Card**          | One Concept practised with one Exercise Type. It's the unit that gets scheduled, and it holds its own review state.                                                                                          |
| **Review**        | One attempt at a Card, with a rating: `Again`, `Hard`, `Good` or `Easy`.                                                                                                                                     |

```
Subject
├── Decks (unit, core)  ──includes──▶  Concepts (many-to-many)
└── Concepts
    └── Cards (one per Exercise Type)
        └── Reviews
```

## Scheduling

Memonaut uses the [FSRS](https://github.com/open-spaced-repetition/fsrs4anki) algorithm through [`ts-fsrs`](https://github.com/open-spaced-repetition/ts-fsrs). Memonaut's terms match the library's: a `Card` holds the FSRS memory state (stability, difficulty, due date), and a `Review` corresponds to FSRS's `ReviewLog`.

Because review state lives on Cards rather than on Decks, studying a unit deck also moves the same Cards forward in the core deck, and the other way round.

Cards of the same Concept are siblings. A study session should avoid showing two siblings close together, so that one exercise doesn't give away the answer to another.

Exercise Types are ordered from easiest, and a session queues every Card of one type before any Card of the next. This also keeps siblings apart:

1. `recognition-choice`: see and hear the foreign word, pick its meaning from a few local words
2. `dictation`: hear the foreign word, type how it's spelled
3. `translation-choice`: see the local word, pick the foreign one from a few options
4. `article-choice-de`: German only: see a noun without its article, e.g. _Buch_ (książka), pick _der_, _die_ or _das_, each in its gender's color (blue, red, green) and always in the same order, also with keys 1–3. It's for words that are an article followed by one capitalized word, e.g. `das Buch`; phrases and plurals marked `plural: true` skip it, as a plural is always _die_. A noun with _dieser_ instead, e.g. `dieses Buch`, is practised the same way with _dieser_, _diese_ or _dieses_. One with _ein_, _kein_ or a possessive, e.g. `meine Tasche`, with its two forms: _mein_ for der and das nouns, _meine_ for die ones; likewise _ein_, _kein_, _dein_, _sein_, _ihr_, _unser_, _euer_/_eure_ and the polite _Ihr_. The word is read aloud only once picked, as hearing it would give the article away. The result tells what gives the article away: the word's `explanation`, or else its ending, e.g. _na -ung → zawsze die_, _na -e → zwykle die_, or that it's an exception, as for _der Name_; and for a compound, the noun of the Subject its last part is, e.g. _der Fuß**ball** jak der Ball_; after another word, also the same noun with its article, e.g. _mein Freund jak der Freund_.
5. `translation`: see the local word, type the foreign one
6. `plural-form`: see the foreign word, e.g. _das Buch_, type its plural, _die Bücher_. Only for words with a `foreignPlural`. The result shows how the plural is made, with what it adds or changes highlighted, e.g. _das Buch → die B**ü**ch**er**_, or the article when nothing else changes, e.g. _der Computer → **die** Computer_.
7. `plural-translation`: see the local plural, e.g. _książki_, type the foreign one, _die Bücher_. Only for words with both a `localPlural` and a `foreignPlural`; its result is shown like plural form's.

In multiple choice, the wrong options are other words of the Deck, or of the Subject when the Deck has too few. A word with a `group` gets the others of its group first, from the Deck or the Subject, so _Monday_ comes with other days rather than _dog_, then those of the wider group, e.g. other numbers for one in `number/large`. A word that would be right too, e.g. "large" for _duży_ when the answer is "big", is never offered. A right pick is rated Good, or Easy when made within 3 seconds, and a wrong one Again. Options can be picked with keys 1–4.

A Concept unlocks Exercise Types one at a time, in its Deck's order: a new Concept starts with the first one, and the next one unlocks once the previous Card graduates to Review. Cards already started stay in play. A Concept practises one Exercise Type per study day where it can: once one of its Cards was reviewed today, its other Cards wait. A study day starts at 4 AM local time, like Anki's, so late-evening study counts as one day.

A session takes about a chosen number of minutes (5, 10, 15 or 20). Each Card is worth **effort points** for how long it's expected to take, so a session holds fewer typed exercises than multiple choice ones:

- one answer is worth 1 point in `recognition-choice`, `translation-choice` and `article-choice-de`, 1.5 in `question-choice`, 2 in `dictation` and `plural-form` and 2.5 in `translation`, `plural-translation` and `question-type`
- times the Card's difficulty: from 0.8 for the easiest (FSRS difficulty 1) to 1.25 for the hardest (10); a new Card counts as average
- times how often it's expected to be answered in the session: twice for a new Card (its learning step), 1.5 times for one still learning, and for a due one once, plus once more if it's forgotten

The minutes become points at the learner's pace in the Subject, 4.2 points a minute to start with, as sessions planned at 8 took a child about 1.9 times as long as picked. Cards are picked in the order below while their points fit, but at least one: the points decide only how many Cards a session holds, never which come first, and nothing changes once it started. When a session is over, finished or left early, the points of the answers given per active minute move the pace toward what was measured, halfway for a session of 10 minutes or more and less for a shorter one, so the next session's estimate fits better. Sessions under a minute don't count. The setup screen shows how many exercises fit and about how long they take; the results compare the time taken with the time planned.

To tune the points, each session's plan and answers are logged in the browser (`memonaut:effort-log`, the latest 100 sessions). With `?dev=1` in the URL, the setup screen shows an **Effort stats** panel: the time each answer took per point by Exercise Type and by difficulty, with suggested points that would even them out; how often Cards were answered against what was expected; and each session's planned time against the time it took. The log can be downloaded as JSON or cleared there. Below the session length, it also offers which of the set's Exercise Types a session uses, at least one, e.g. only `article-choice-de` to try it out: new words then start with the first one picked. The choice is kept until the page is reloaded.

A session's Cards are picked in this order:

1. due Cards, most overdue first; of a Concept's due Cards, the one most likely forgotten, the easier type on a tie
2. the next unlocked Exercise Type of a started Concept, easiest type first, then in Deck order
3. new Concepts, with their first Exercise Type, in Deck order; with `shuffleNew: true` (also settable in `core.yaml`) in random order instead
4. Cards held back for today: due ones, then unlocked ones
5. Cards not yet due, reviewed ahead, soonest due first

"Due today" on the setup screen counts the words with a Card from steps 1 and 2 before the next study day starts.

A `knowledge` Subject, e.g. math, asks questions one way only, with its own Exercise Types, easiest first:

1. `question-choice`: see the question, pick its answer from it and the question's own wrong `choices`; only questions with `choices` get this exercise
2. `question-type`: see the question, type its answer

Its words on screen are "questions" rather than "words".

A Subject can practise only some Exercise Types, and a Deck only some of its Subject's. Polish spelling (ortografia) uses only `dictation`: its words have nothing to translate. The English and German core sets leave out multiple choice, which is for meeting words in units. In dictation, words that sound the same, such as _morze_ and _może_, are told apart by a spoken hint read aloud after the word, e.g. "zbiornik słonej wody".

Words are read aloud by the browser's voice, which varies a lot by device. Optionally, a parent can add their own ElevenLabs API key under "TTS" in the menu. The key is kept in this browser only (`memonaut:elevenlabs-key`). Audio is cached for the page's lifetime and turned up to the loudness of browser voices, any failure falls back to the browser's voice, and a rejected key or running out of credits pauses ElevenLabs until a key is saved again.

## Content

Learning content lives in YAML files under `src/data/`, one folder per Subject. Only what to learn is stored there; learning state is kept separately, in the browser's localStorage under one key per Subject (`memonaut:progress:<subject>`), keyed by Concept id and Exercise Type. The learner's pace in each Subject is kept under `memonaut:pace`. Each Card's FSRS state is stored compactly. Saving only replaces the Cards that changed, so progress for words no longer in any Deck is kept, and data from a newer app version is never overwritten.

```yaml
# src/data/german/decks/kapitel-0.yaml
id: kapitel-0
name: Kapitel 0
concepts:
  - { id: number-3, local: trzy, foreign: drei, hint: 3, group: number/small, core: true }
```

```yaml
# src/data/polish/subject.yaml
id: polish
name: Polish
kind: language
foreignLanguage: pl-PL
exerciseTypes: [dictation] # every Exercise Type of its kind if left out; a Deck or core.yaml can list fewer

# src/data/polish/decks/trudne-slowka.yaml
id: trudne-slowka
name: Trudne słówka
strictSpelling: true
shuffleNew: true
concepts:
  - { id: morze, foreign: morze, spokenHint: zbiornik słonej wody }
```

```yaml
# src/data/math/subject.yaml
id: math
name: Matematyka
kind: knowledge

# src/data/math/decks/reszta-kwadraty-szesciany.yaml
id: reszta-kwadraty-szesciany
name: Dzielenie z resztą, kwadraty i sześciany
concepts:
  - { id: square-3, question: '3² =', answer: '9', explanation: '3² = 9' }
  - { id: twice-square-3, question: '2 · 3² =', answer: '18', choices: [36, 12, 11] }
```

A `language` Subject needs a `foreignLanguage`, and its words have `local`, `foreign` and the optional fields below. A `knowledge` Subject's Concepts have a `question`, an `answer`, an optional `explanation`, shown with the result, e.g. `29 : 6 = 4 r 5` for "Reszta z dzielenia 29 przez 6", and optional `choices`: wrong answers to pick from, best common mistakes, e.g. `36` for `2 · 3² =`. `explanation` is shown with the result in every exercise, below the meaning, with parts in square brackets highlighted, e.g. `'das Buch → die B[ü]ch[er]'` for how a plural is made; quote it in YAML, as brackets start a list. `alternatives` lists other right answers in translation, e.g. `[einhundert]` for `hundert`; a mistake is compared with the closest one, and only `foreign` is read aloud, asked in dictation and offered in multiple choice. `hint` is shown on screen in translation and translation choice only, since it could give the meaning away in the others; `spokenHint` is read aloud in dictation and must be in the language being learned. `local` may be left out only in a Subject with only `dictation`. `foreignPlural` gives a word's plural, e.g. `die Bücher` for `das Buch`, for `plural-form`, and `localPlural` the local one, e.g. `książki`, also for `plural-translation`; `localPlural` needs `foreignPlural`. A Deck practises only the Exercise Types some of its words can be practised with, so one without plurals has no plural exercises. `plural: true` marks a German plural noun, e.g. `die Bücher`, so it skips German article choice; a German Subject, by its `foreignLanguage`, practises its nouns with it. `group` names a set of like words within the Subject, e.g. `weekday`, for the wrong options in multiple choice; a slash puts it within a wider one, e.g. `number/small` within `number`. Leave out near-synonyms, which would be right too.

Answers are rated automatically. By default an almost-correct answer (wrong capitalization, a missing umlaut or one letter off) is rated Hard. A number, e.g. `49`, must be exact in any Deck: one digit off is a wrong result, not a typo. A Deck with `strictSpelling: true`, like the Polish spelling sets, forgives only wrong capitalization, so _zolw_ for _żółw_ or _może_ for _morze_ is wrong. For the core Deck, set it in `core.yaml`. A Subject's `trickySpellings`, e.g. `[ó, u, rz, ż, ch, h]` for Polish, are marked in a right answer, to remind which spellings it got right.

Each file under `decks/` is a unit Deck. A Concept can appear in several units of the same Subject, but must be defined the same way in each. The Subject's core Deck is built from the Concepts in an optional `core.yaml` next to `subject.yaml` (a `concepts:` list, without `core:` flags; it is not a unit, so it isn't offered on its own), followed by every Concept marked `core: true` in at least one unit, each listed once, in the order they first appear. A unit with `disabled: true` is hidden, and its Concepts are left out of the core Deck unless another unit marks them `core: true`; it is still checked, so it can be enabled again later. Ids must stay the same once learners have progress, since learning state is keyed by them. Every value is read as a string, so `null` or `0` need no quotes.

## Open questions

- Can a Concept exist in no Deck at all, e.g. after its unit is removed, while keeping its review history?
- Should progress also sync through a backend, so it survives clearing the browser and moves between devices?

## Development

Requires Node.js and [pnpm](https://pnpm.io).

```sh
pnpm install
pnpm dev        # start the dev server
pnpm validate   # typecheck, lint, test and format check
```

Tests use their own small word sets, in `src/test/content.ts`, so changing the bundled ones never makes them pass or fail; the bundled ones are only checked to load.

## Related

- [memo-bot](https://github.com/mdjastrzebski/memo-bot): an earlier spelling-practice app with a quiz flow and simple spaced repetition. The Polish spelling word lists come from it.
