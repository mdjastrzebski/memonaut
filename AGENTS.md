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
- `src/data/`: learning content as YAML (`<subject>/subject.yaml`, `<subject>/decks/*.yaml`), loaded and validated by `content.ts`
- `src/components/`: React screens; `ui/` holds shadcn/ui components
- `src/components/exercises/`: one component per Exercise Type, built on shared typed and multiple-choice bodies

## Conventions

- Import from `src` with the `@/` alias, e.g. `@/lib/utils`.
- Add shadcn/ui components with `pnpm dlx shadcn@latest add <component>`; they land in `src/components/ui/`.
- Put tests next to the code as `*.test.ts(x)`, using Vitest and Testing Library.
