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
4. `translation`: see the local word, type the foreign one

In multiple choice, the wrong options are other words of the Deck, or of the Subject when the Deck has too few. A word with a `group` gets the others of its group first, from the Deck or the Subject, so _Monday_ comes with other days rather than _dog_, then those of the wider group, e.g. other numbers for one in `number/large`. A word that would be right too, e.g. "large" for _duży_ when the answer is "big", is never offered. A right pick is rated Good, or Easy when made within 3 seconds, and a wrong one Again. Options can be picked with keys 1–4.

A Concept unlocks Exercise Types one at a time, in its Deck's order: a new Concept starts with the first one, and the next one unlocks once the previous Card graduates to Review. Cards already started stay in play. A Concept practises one Exercise Type per study day where it can: once one of its Cards was reviewed today, its other Cards wait. A study day starts at 4 AM local time, like Anki's, so late-evening study counts as one day.

A session holds up to a chosen number of Cards (10, 20, 50 or 100), filled in this order:

1. due Cards, most overdue first; of a Concept's due Cards, the one most likely forgotten, the easier type on a tie
2. the next unlocked Exercise Type of a started Concept, easiest type first, then in Deck order
3. new Concepts, with their first Exercise Type, in Deck order; with `shuffleNew: true` (also settable in `core.yaml`) in random order instead
4. Cards held back for today: due ones, then unlocked ones
5. Cards not yet due, reviewed ahead, soonest due first

"Due today" on the setup screen counts the words with a Card from steps 1 and 2 before the next study day starts.

A `knowledge` Subject, e.g. math, asks questions one way only, with the `question` Exercise Type: see the question, type its answer. Its words on screen are "questions" rather than "words". Other ways to answer questions, e.g. multiple choice, may follow.

A Subject can practise only some Exercise Types, and a Deck only some of its Subject's. Polish spelling (ortografia) uses only `dictation`: its words have nothing to translate. The English and German core sets leave out multiple choice, which is for meeting words in units. In dictation, words that sound the same, such as _morze_ and _może_, are told apart by a spoken hint read aloud after the word, e.g. "zbiornik słonej wody".

Words are read aloud by the browser's voice, which varies a lot by device. Optionally, a parent can add their own ElevenLabs API key under "TTS" in the menu. The key is kept in this browser only (`memonaut:elevenlabs-key`). Audio is cached for the page's lifetime and turned up to the loudness of browser voices, any failure falls back to the browser's voice, and a rejected key or running out of credits pauses ElevenLabs until a key is saved again.

## Content

Learning content lives in YAML files under `src/data/`, one folder per Subject. Only what to learn is stored there; learning state is kept separately, in the browser's localStorage under one key per Subject (`memonaut:progress:<subject>`), keyed by Concept id and Exercise Type. Each Card's FSRS state is stored compactly. Saving only replaces the Cards that changed, so progress for words no longer in any Deck is kept, and data from a newer app version is never overwritten.

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
```

A `language` Subject needs a `foreignLanguage`, and its words have `local`, `foreign` and the optional fields below. A `knowledge` Subject's Concepts have a `question`, an `answer` and an optional `explanation`, shown with the result, e.g. `29 : 6 = 4 r 5` for "Reszta z dzielenia 29 przez 6". `hint` is shown on screen in translation and translation choice only, since it could give the meaning away in the others; `spokenHint` is read aloud in dictation and must be in the language being learned. `local` may be left out only in a Subject with only `dictation`. `group` names a set of like words within the Subject, e.g. `weekday`, for the wrong options in multiple choice; a slash puts it within a wider one, e.g. `number/small` within `number`. Leave out near-synonyms, which would be right too.

Answers are rated automatically. By default an almost-correct answer (wrong capitalization, a missing umlaut or one letter off) is rated Hard. A number, e.g. `49`, must be exact in any Deck: one digit off is a wrong result, not a typo. A Deck with `strictSpelling: true`, like the Polish spelling sets, forgives only wrong capitalization, so _zolw_ for _żółw_ or _może_ for _morze_ is wrong. For the core Deck, set it in `core.yaml`. A Subject's `trickySpellings`, e.g. `[ó, u, rz, ż, ch, h]` for Polish, are marked in a right answer, to remind which spellings it got right.

Each file under `decks/` is a unit Deck. A Concept can appear in several units of the same Subject, but must be defined the same way in each. The Subject's core Deck is built from the Concepts in an optional `core.yaml` next to `subject.yaml` (a `concepts:` list, without `core:` flags; it is not a unit, so it isn't offered on its own), followed by every Concept marked `core: true` in at least one unit, each listed once, in the order they first appear. Ids must stay the same once learners have progress, since learning state is keyed by them. Every value is read as a string, so `null` or `0` need no quotes.

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

## Related

- [memo-bot](https://github.com/mdjastrzebski/memo-bot): an earlier spelling-practice app with a quiz flow and simple spaced repetition. The Polish spelling word lists come from it.
