# Memonaut

Memonaut is a learning web app for school kids, built on spaced repetition. It helps a learner keep what they learn in school subjects, such as English, German, Polish or Przyroda, by scheduling each piece of knowledge for review just before it would be forgotten.

> **Status:** early prototype. The concepts below are settled. Pick a subject (German or English) and its core set or a unit, then study it: dictation then translation, FSRS scheduling. Each Card's review state is saved in the browser after every answer; the setup screen shows how many words are due today.

## Goals

- **One place per subject.** Each subject is kept separate, with its own content and progress.
- **Follow the school curriculum.** Content is organized into units that match school units of learning.
- **Retain the essentials long-term.** A core set holds key knowledge, such as essential words or verb conjugations, that should stay fresh after the unit is over.
- **Shared progress.** The same concept can appear in a unit and in the core set, and practising it in one place counts in all of them.
- **Varied practice.** Each concept can be practised with several exercise types, not just flip cards.

## Core concepts

A **Deck** includes a number of **Concepts**. Each Concept splits into a number of **Cards**, one per **Exercise Type**, which the user sees as separate exercises. Each Card keeps its own review schedule. A Concept can be in any number of Decks: several unit decks, the core deck, or only the core deck. A review in one Deck counts everywhere.

| Term              | Meaning                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Subject**       | A separate area of study, e.g. English, German or Przyroda. All Decks and Concepts belong to one Subject.                 |
| **Deck**          | A group of Concepts within a Subject. Its kind is either `unit` (a school unit) or `core` (long-term essentials).         |
| **Concept**       | One piece of knowledge, e.g. a word, a verb's conjugation or a fact. It can be in any number of Decks within its Subject. |
| **Exercise Type** | A way to practise a Concept, e.g. flashcard, type the answer, multiple choice or conjugate.                               |
| **Card**          | One Concept practised with one Exercise Type. It's the unit that gets scheduled, and it holds its own review state.       |
| **Review**        | One attempt at a Card, with a rating: `Again`, `Hard`, `Good` or `Easy`.                                                  |

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

Exercise Types are ordered from easiest: a session queues every `dictation` Card (hear the foreign word, type how it's spelled) before any `translation` Card (see the local word, type the foreign one). This also keeps siblings apart.

## Content

Learning content lives in YAML files under `src/data/`, one folder per Subject. Only what to learn is stored there; learning state is kept separately, in the browser's localStorage under one key per Subject (`memonaut:progress:<subject>`), keyed by Concept id and Exercise Type. Each Card's FSRS state is stored compactly. Saving only replaces the Cards that changed, so progress for words no longer in any Deck is kept, and data from a newer app version is never overwritten.

```yaml
# src/data/german/decks/kapitel-0.yaml
id: kapitel-0
name: Kapitel 0
concepts:
  - { id: number-3, local: trzy, foreign: drei, hint: 3, core: true }
```

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

- [memo-bot](https://github.com/mdjastrzebski/memo-bot): an earlier spelling-practice app with a quiz flow and simple spaced repetition.
