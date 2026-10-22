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
2. `translation-choice`: see the local word, pick the foreign one from a few options
3. `article-choice-de`: German only: see a noun without its article, e.g. _Buch_ (książka), pick _der_, _die_ or _das_, each in its gender's color (blue, red, green) and always in the same order, also with keys 1–3. It's for words that are an article followed by one capitalized word, e.g. `das Buch`; phrases and plurals marked `plural: true` skip it, as a plural is always _die_. A noun with _dieser_ instead, e.g. `dieses Buch`, is practised the same way with _dieser_, _diese_ or _dieses_. One with _ein_, _kein_ or a possessive, e.g. `meine Tasche`, with its two forms: _mein_ for der and das nouns, _meine_ for die ones; likewise _ein_, _kein_, _dein_, _sein_, _ihr_, _unser_, _euer_/_eure_ and the polite _Ihr_. The word is read aloud only once picked, as hearing it would give the article away. The result tells what gives the article away: the word's `explanation`, or else its ending, e.g. _na -ung → zawsze die_, _na -e → zwykle die_, or that it's an exception, as for _der Name_; and for a compound, the noun of the Subject its last part is, e.g. _der Fuß**ball** jak der Ball_; after another word, also the same noun with its article, e.g. _mein Freund jak der Freund_.
4. `dictation`: hear the foreign word, type how it's spelled
5. `cloze`: see a cloze sentence with a gap and its hint, e.g. _das ist der Rucksack \_\_\__ (to jest plecak Juliana), type what's missing, _von Julian_. Only for cloze sentences, which get no other exercise, and never offered as wrong options in multiple choice. A one-word gap, e.g. _der_, forgives only wrong capitalization, as one letter off, e.g. _den_, is another word. The result shows the sentence with the gap filled in and highlighted, and it's read aloud.
6. `translation`: see the local word, type the foreign one
7. `plural-form`: see the foreign word, e.g. _das Buch_, type its plural, _die Bücher_. Only for words with a `foreignPlural`. The result shows how the plural is made, with what it adds or changes highlighted, e.g. _das Buch → die B**ü**ch**er**_, or the article when nothing else changes, e.g. _der Computer → **die** Computer_.
8. `translation-plural`: see the local plural, e.g. _książki_, type the foreign one, _die Bücher_. Only for words with both a `localPlural` and a `foreignPlural`; its result is shown like plural form's.

In multiple choice, the wrong options are other words of the Deck, or of the Subject when the Deck has too few. A word with a `group` gets the others of its group first, from the Deck or the Subject, so _Monday_ comes with other days rather than _dog_, then those of the wider group, e.g. other numbers for one in `number/large`. A word that would be right too, e.g. "large" for _duży_ when the answer is "big", is never offered. A right pick is rated Good, or Easy when made within 3 seconds, and a wrong one Again. Options can be picked with keys 1–4.

A Concept unlocks Exercise Types one at a time, in its Deck's order: a new Concept starts with the first one, and the next one unlocks once the previous Card graduates to Review. Cards already started stay in play. A Concept practises one Exercise Type per study day where it can: once one of its Cards was reviewed today, its other Cards wait. A due Card still well remembered, at least 85% likely, gives its Concept's day to the next unlocked Exercise Type, so learned words go deeper rather than repeat the easier ones. A right answer, on the first try in a session, also reviews the Concept's learned Cards it shows are remembered, if not yet reviewed that day, rated Good, so they come back later; FSRS moves a Card that's still likely remembered only a little. `translation` reviews `recognition-choice`, `translation-choice` and `article-choice-de`, as the foreign word is typed with its article; `translation-plural` reviews `plural-form`; and `question-type` reviews `question-choice`. `dictation` shows no meaning, so it reviews nothing else. The final Exercise Types, `dictation`, `translation` and `translation-plural`, are skills of their own: a due one never gives its day to another one. A study day starts at 4 AM local time, like Anki's, so late-evening study counts as one day.

A new word isn't first met in a guess: before its first exercise, it's introduced on its own screen, with its meaning (or, in Polish spelling, its spoken hint), hint and explanation, and read aloud. Its first exercise then comes a couple of exercises later, often after other words' intros, so it asks to recall the word rather than echo it. An intro isn't a Card: nothing is rated or saved, and FSRS starts with the first exercise. A word whose session ends before that exercise is still new, so it's introduced again next time. Its answers in that session count as Good at most until it graduates to Review, as a fast pick moments after seeing the word doesn't show it's easy to remember. A question of a `knowledge` Subject is introduced the same way, with its answer and explanation, but not read aloud. A Deck with `showIntro: false` (also settable in `core.yaml`) shows no intros, e.g. math, whose questions are worked out rather than remembered, so an intro would only give the answer away.

In a Deck that shows intros, a tricky word, one that keeps being forgotten or missed, like Anki's leeches but sooner, is still asked first, as an intro would give the answer away. Once it's missed in a session, it's introduced again, as a **Tricky word**, before it comes back in that session, a couple of exercises later; while it's still relearning there, an answer counts as Good at most. A word is tricky once one of its Cards was forgotten twice after it was learned (2 FSRS lapses) or reached an FSRS difficulty of 9, e.g. after three misses in a row. A question is tricky the same way, shown as a **Tricky question**.

A Card due again within 20 minutes, e.g. one still learning or just missed, comes back later in the same session, but not again and again: once it's answered almost right, it's left for the next session, which asks it first, as it's still due, and once it's missed twice in a session, it waits at least 3 hours, so a session started right after doesn't begin with it again, and is then asked first. A miss on its last try says so. After a wrong or almost-right typed answer, the right one is typed before moving on: when it was close, by fixing the marked letters of the answer given, with the first one to fix selected, or else by copying the answer, shown faded.

A session takes about a chosen number of minutes (5, 10, 15 or 20). Each Card is worth **effort points** for how long it's expected to take, so a session holds fewer typed exercises than multiple choice ones:

- one answer is worth 1 point in `recognition-choice`, `translation-choice` and `article-choice-de`, 1.5 in `question-choice` and `cloze`, 2 in `dictation` and `plural-form` and 2.5 in `translation`, `translation-plural` and `question-type`
- times the Card's difficulty: from 0.8 for the easiest (FSRS difficulty 1) to 1.25 for the hardest (10); a new Card counts as average
- times how often it's expected to be answered in the session: twice for a new Card (its learning step), 1.5 times for one still learning, and for a due one once, plus once more if it's forgotten
- plus half a point for a new word's intro

The minutes become points at the learner's pace in the Subject, 4.2 points a minute to start with, as sessions planned at 8 took a child about 1.9 times as long as picked. Cards are picked in the order below while their points fit, but at least one: the points decide only how many Cards a session holds, never which come first, and nothing changes once it started. The one exception: while a set still has new Cards, a session always starts at least 3 for every 5 minutes picked, e.g. 6 in 10 minutes, so reviews never crowd out learning. They're split between new Concepts, going wider, and the next unlocked Exercise Types of started ones, even those held back for today, going deeper. Wider comes first, but at least a third go deeper, rounded down, e.g. 2 of 6, and more as more of the set is started: with half of it started, half of them. Cards that fit anyway count towards each share, and when one kind runs short, the other makes up for it, so practising the easier types never blocks the harder ones. Those that don't fit are added on top. When a session is over, finished or left early, the points of the answers given per active minute move the pace toward what was measured, halfway for a session of 10 minutes or more and less for a shorter one, so the next session's estimate fits better. Sessions under a minute don't count. The setup screen shows how many exercises fit and about how long they take; the results compare the time taken with the time planned.

To tune the points, each session's plan and answers are logged in the browser (`memonaut:effort-log`, the latest 100 sessions). With `?dev=1` in the URL, the setup screen shows an **Effort stats** panel: the time each answer took per point by Exercise Type and by difficulty, with suggested points that would even them out; how often Cards were answered against what was expected; and each session's planned time against the time it took. The log can be downloaded as JSON or cleared there. Below the session length, it also offers which of the set's Exercise Types a session uses, at least one, e.g. only `article-choice-de` to try it out: new words then start with the first one picked. The choice is kept until the page is reloaded.

Each right answer earns **XP**: its Exercise Type's effort points, e.g. 1 in multiple choice or 2.5 in translation, and twice as many for a fast one, rated Easy. An almost-right or missed answer earns none. A fast answer right after a word's intro earns double too, though it's scheduled as Good, so the word still comes back. XP adds up across sessions and Subjects. Each right answer shows the XP it earns, cheered with a chime, or for a fast one that earns double, a game-coin like two-step with a sparkle; the header shows the session's XP next to the progress bar, with the total below it on wider screens, and the results show both. Every session with an answer is kept under `memonaut:sessions`, saved after every answer, with its start time, Subject, Deck, active time and XP, for the progress screen; the total XP is their sum.

The **Progress** button in the header opens how the learner is doing, from the effort log, the saved sessions and the Cards' FSRS state, over the last 7 study days, today included: XP or minutes per day, switched above the chart; XP earned, with the total; time, against the 7 days before; days practised and streak of days in a row; new words, against the 7 days before; right answers; the most practised sets; and for each Subject, how many words are learned overall and per set, each set's minutes per day, and its hardest words: those whose hardest Card has an FSRS difficulty of 5 or more, or was forgotten, with how often they were missed and forgotten. Below each set's exercises, its words open as a table, one column per Exercise Type, each cell showing its Card's next review, recall, difficulty, reviews or times forgotten, tinted by how well it's known; clicking a column sorts the words by it, the most worth a look first, e.g. the hardest or most overdue. As the log keeps the latest 100 sessions, time counts only those.

A session's Cards are picked in this order:

1. due Cards, most overdue first; of a Concept's due Cards, the one most likely forgotten, the easier type on a tie, unless it's still well remembered, not final, and the next Exercise Type is unlocked
2. the next unlocked Exercise Type of a started Concept, easiest type first, then in Deck order
3. new Concepts, with their first Exercise Type after the word's intro, in Deck order; with `shuffleNew: true` (also settable in `core.yaml`) in random order instead, those marked `priority: true` first, e.g. words the class is learning now; an ordered Deck lists those first instead
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

Learning content lives in YAML files under `src/data/`, one folder per Subject. Only what to learn is stored there; learning state is kept separately, in the browser's localStorage under one key per Subject (`memonaut:progress:<subject>`), keyed by Concept id and Exercise Type. The learner's pace in each Subject is kept under `memonaut:pace`. Each Card's FSRS state is stored compactly. Saving only replaces the Cards that changed, so progress for words no longer in any Deck is kept, and data from a newer app version is never overwritten. The menu's **Export progress** saves all of it, except the ElevenLabs key and the theme, to a JSON file, and **Import progress** (outside a session) merges a file's into it, e.g. to move progress between devices: each word's Exercise Type keeps its later repetition, sessions from both are kept, and the pace and setup choice stay as they are.

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

A `language` Subject needs a `foreignLanguage`, and its words have `local`, `foreign` and the optional fields below. A `knowledge` Subject's Concepts have a `question`, an `answer`, an optional `explanation`, shown with the result, e.g. `29 : 6 = 4 r 5` for "Reszta z dzielenia 29 przez 6", and optional `choices`: wrong answers to pick from, best common mistakes, e.g. `36` for `2 · 3² =`. `explanation` is shown with the result in every exercise, below the meaning, with parts in square brackets highlighted, e.g. `'das Buch → die B[ü]ch[er]'` for how a plural is made; quote it in YAML, as brackets start a list. `alternatives` lists other right answers in translation, e.g. `[einhundert]` for `hundert`; a mistake is compared with the closest one, and only `foreign` is read aloud, asked in dictation and offered in multiple choice. `hint` is shown on screen in translation and translation choice only, since it could give the meaning away in the others; `spokenHint` is read aloud in dictation and must be in the language being learned. `local` may be left out only in a Subject with only `dictation`. `foreignPlural` gives a word's plural, e.g. `die Bücher` for `das Buch`, for `plural-form`, and `localPlural` the local one, e.g. `książki`, also for `translation-plural`; `localPlural` needs `foreignPlural`. A Deck practises only the Exercise Types some of its words can be practised with, so one without plurals has no plural exercises. `plural: true` marks a German plural noun, e.g. `die Bücher`, so it skips German article choice; a German Subject, by its `foreignLanguage`, practises its nouns with it. `group` names a set of like words within the Subject, e.g. `weekday`, for the wrong options in multiple choice; a slash puts it within a wider one, e.g. `number/small` within `number`. Leave out near-synonyms, which would be right too.

A `language` Subject can also hold cloze sentences, practised only with `cloze`: instead of `local` and `foreign`, one has a `cloze`, the sentence with one gap in square brackets, quoted in YAML, an optional `hint` shown with it, e.g. its meaning, and an optional `explanation`. Its id starts with `cloze-`, e.g. `cloze-das-ist-der-rucksack-von-julian`, with `-1`, `-2` and so on for several gaps in the same sentence. Its intro shows the sentence with the gap filled in and highlighted.

```yaml
- {
    id: cloze-das-ist-der-rucksack-von-julian,
    cloze: 'das ist der Rucksack [von Julian]',
    hint: to jest plecak Juliana,
  }
```

Answers are rated automatically. An exact typed answer is rated Easy when it's typed within 4 seconds plus 1 per letter, and 2.5 more per special character, e.g. _ü_, as the fast bar shows, or else Good. By default an almost-correct answer (wrong capitalization, a missing umlaut or one letter off) is rated Hard. A number, e.g. `49`, must be exact in any Deck: one digit off is a wrong result, not a typo. A Deck with `strictSpelling: true`, like the Polish spelling sets, forgives only wrong capitalization, so _zolw_ for _żółw_ or _może_ for _morze_ is wrong. For the core Deck, set it in `core.yaml`. A Subject's `trickySpellings`, e.g. `[ó, u, rz, ż, ch, h]` for Polish, are marked in a right answer, to remind which spellings it got right.

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
