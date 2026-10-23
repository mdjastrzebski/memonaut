# Memonaut

Memonaut is a spaced-repetition learning web app for school kids. See [README.md](README.md) for the domain model (Subject, Deck, Concept, Card, Review) and scheduling.

## Essentials

- Package manager: `pnpm`
- Stack: Vite, React 19, TypeScript, Tailwind CSS v4, shadcn/ui (Radix)
- Dev server: `pnpm dev`
- Build: `pnpm build`
- Validate before finishing code changes: `pnpm validate` (typecheck, lint, test, format check)
- Auto-fix formatting and lint: `pnpm validate:fix`

## Code Layout

- `src/domain/`: core types (Subject, Deck, Concept, Card, Review)
- `src/srs/`: wrapper around `ts-fsrs` (scheduling, previews, retrievability)
- `src/exercises/`: answer checking per Exercise Type
- `src/session/`: pure study-session logic (queue, reviews)
- `src/progress/`: learning progress saved in localStorage
- `src/data/`: learning content as YAML (`<subject>/subject.yaml`, `<subject>/decks/*.yaml`), validated by `content.ts` and loaded by `bundled-content.ts`; the user's own Subjects and Decks are stored and added by `user-sets.ts`
- `src/components/`: React screens; `ui/` holds shadcn/ui components
- `src/components/exercises/`: one component per Exercise Type, built on shared typed and multiple-choice bodies

## Conventions

- Import from `src` with the `@/` alias, e.g. `@/lib/utils`.
- Add shadcn/ui components with `pnpm dlx shadcn@latest add <component>`; they land in `src/components/ui/`.
- Put tests next to the code as `*.test.ts(x)`, using Vitest and Testing Library.
- Tests never depend on the bundled word sets: use `testContent` from `@/test/content`, which also stands in for `@/data/bundled-content`, or build small content inline with `buildContent`.

## Git

- Work on a branch named by its kind, like Conventional Commits: `feat/*`, `fix/*`, `chore/*`, `docs/*`, `refactor/*`, `test/*` or `data/*`, e.g. `feat/improve-article-de`.
- Commit messages and PR titles are short Conventional Commits, e.g. `feat: German article choice for possessives`.
- PR descriptions are minimal: only 2–5 short bullets of what changed, one line each. No headings, summary, rationale, test plan or screenshots; the diff and README say the rest.
- No Claude or AI credit in commit messages or PR descriptions: no `Co-Authored-By`, `Claude-Session` or "Generated with" lines.

## Writing Decks

A Deck without `shuffleNew: true` introduces new Concepts in file order, so order its Concepts from easy to hard, so that earlier ones help with later ones:

- Building blocks first: words before the phrases and sentences that use them, pronouns and infinitives before conjugated forms, singulars before plurals, a question before its answer.
- Familiar words first: short words and words like Polish or English ones, then longer or new ones.
- Regular before irregular, e.g. `lernen` before `haben`; within a rule, the simplest form first, e.g. plurals with `-s` before those with an umlaut.
- Keep like words together in short sections, each with a comment saying what it teaches.

A shuffled Deck, like the Polish spelling sets, doesn't need this.

Write German nouns with their article, e.g. `das Buch`, so they're practised with German article choice, and mark plurals with `plural: true`, e.g. `die Bücher`, as their article tells no gender. To practise a noun's plural, give it on the singular instead, with `foreignPlural: die Bücher` and `localPlural: książki`, rather than adding the plural as a word of its own.

Write a cloze sentence as its own item, with the gap in square brackets and its meaning as `hint`, e.g. `{ id: cloze-das-ist-der-rucksack-von-julian, cloze: 'das ist der Rucksack [von Julian]', hint: to jest plecak Juliana }`. Its id is `cloze-` followed by the whole sentence in lowercase with dashes, umlauts written out (`ä` → `ae`, `ß` → `ss`); for another gap in the same sentence, add `-1`, `-2` and so on to the id.
