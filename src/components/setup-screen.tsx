import { Check, ChevronDown, Rocket, Star } from 'lucide-react';
import { useId, useState, type CSSProperties, type ReactNode } from 'react';

import { EXERCISES } from '@/components/exercise-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Content } from '@/data/content';
import { getDeckStats, getSubjectDecks } from '@/data/decks';
import type { Deck, Subject } from '@/domain/types';
import { cn } from '@/lib/utils';
import { EXERCISE_TYPES } from '@/session/session';

interface SetupScreenProps {
  content: Content;
  /** The selected Deck; its Subject is the selected Subject. */
  deck: Deck;
  onSelectDeck: (deck: Deck) => void;
  onStart: () => void;
}

/** Choose a Subject, then its core set or one of its units, and start a session. */
export function SetupScreen({ content, deck, onSelectDeck, onStart }: SetupScreenProps) {
  const subject = content.subjects.find((subject) => subject.id === deck.subjectId)!;
  const subjects = content.subjects.filter((option) =>
    content.decks.some((deck) => deck.subjectId === option.id),
  );
  const decks = getSubjectDecks(content.decks, subject.id);
  const coreDecks = decks.filter((deck) => deck.kind === 'core');
  const unitDecks = decks.filter((deck) => deck.kind === 'unit');

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
      <div className="flex flex-col gap-8">
        <div className="flex animate-rise flex-col gap-3">
          <p className="inline-block -rotate-2 self-start rounded-full border-2 border-foreground bg-almost px-3 py-0.5 text-xs font-bold tracking-wider uppercase">
            Mission control
          </p>
          <h2 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
            What are we practising?
          </h2>
        </div>

        <ChoiceGroup legend="Subject">
          <div className="grid gap-3 sm:grid-cols-2">
            {subjects.map((option, index) => (
              <SubjectTile
                key={option.id}
                subject={option}
                content={content}
                checked={option.id === subject.id}
                onSelect={() => onSelectDeck(getSubjectDecks(content.decks, option.id)[0])}
                style={{ animationDelay: `${index * 60}ms` }}
              />
            ))}
          </div>
        </ChoiceGroup>

        <ChoiceGroup legend="Set">
          <div className="flex flex-col gap-3">
            {coreDecks.map((option) => (
              <DeckTile
                key={option.id}
                deck={option}
                checked={option.id === deck.id}
                onSelect={() => onSelectDeck(option)}
              />
            ))}
            {unitDecks.length > 0 && (
              <>
                <h3 className="mt-2 font-display text-lg font-bold">Units</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {unitDecks.map((option) => (
                    <DeckTile
                      key={option.id}
                      deck={option}
                      checked={option.id === deck.id}
                      onSelect={() => onSelectDeck(option)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </ChoiceGroup>
      </div>

      <DeckOverview content={content} subject={subject} deck={deck} onStart={onStart} />
    </div>
  );
}

function ChoiceGroup({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-xs font-bold tracking-wider text-muted-foreground uppercase">
        {legend}
      </legend>
      {children}
    </fieldset>
  );
}

interface ChoiceTileProps {
  name: string;
  /** Radio group the tile belongs to. */
  group: string;
  checked: boolean;
  onSelect: () => void;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/** A radio button drawn as a sticker card, with a check mark when selected. */
function ChoiceTile({
  name,
  group,
  checked,
  onSelect,
  className,
  style,
  children,
}: ChoiceTileProps) {
  const detailsId = useId();
  return (
    <label
      style={style}
      className={cn(
        'group relative flex animate-rise cursor-pointer items-center gap-4 rounded-2xl border-2 border-foreground bg-card p-4 shadow-sticker-sm transition-all hover:-translate-y-px hover:shadow-sticker has-checked:bg-almost/45 has-checked:shadow-sticker has-focus-visible:ring-3 has-focus-visible:ring-ring/50',
        className,
      )}
    >
      <input
        type="radio"
        name={group}
        aria-label={name}
        aria-describedby={detailsId}
        checked={checked}
        onChange={onSelect}
        className="sr-only"
      />
      <div id={detailsId} className="contents">
        {children}
      </div>
      <span
        aria-hidden
        className="absolute -top-2.5 -right-2.5 grid size-7 scale-50 place-items-center rounded-full border-2 border-foreground bg-correct opacity-0 transition-all group-has-checked:scale-100 group-has-checked:opacity-100"
      >
        <Check className="size-4" strokeWidth={3} />
      </span>
    </label>
  );
}

interface SubjectTileProps {
  subject: Subject;
  content: Content;
  checked: boolean;
  onSelect: () => void;
  style: CSSProperties;
}

function SubjectTile({ subject, content, checked, onSelect, style }: SubjectTileProps) {
  const setCount = content.decks.filter((deck) => deck.subjectId === subject.id).length;
  const wordCount = content.concepts.filter((concept) => concept.subjectId === subject.id).length;

  return (
    <ChoiceTile
      name={subject.name}
      group="subject"
      checked={checked}
      onSelect={onSelect}
      style={style}
    >
      <span aria-hidden className="text-4xl leading-none">
        {subject.emoji}
      </span>
      <span className="flex flex-col">
        <span aria-hidden className="font-display text-2xl font-bold">
          {subject.name}
        </span>
        <span className="text-sm text-muted-foreground">
          {plural(setCount, 'set')} · {plural(wordCount, 'word')}
        </span>
      </span>
    </ChoiceTile>
  );
}

interface DeckTileProps {
  deck: Deck;
  checked: boolean;
  onSelect: () => void;
}

function DeckTile({ deck, checked, onSelect }: DeckTileProps) {
  const core = deck.kind === 'core';
  const words = plural(deck.conceptIds.length, 'word');

  return (
    <ChoiceTile
      name={deck.name}
      group="deck"
      checked={checked}
      onSelect={onSelect}
      className={cn(core && 'has-checked:bg-rocket/35')}
    >
      {core && (
        <span className="grid size-12 shrink-0 place-items-center rounded-full border-2 border-foreground bg-rocket">
          <Star className="size-6 fill-almost" />
        </span>
      )}
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2">
          <span aria-hidden className="font-display text-lg font-bold">
            {deck.name}
          </span>
          {core && <Badge>Core set</Badge>}
        </span>
        <span className="text-sm text-muted-foreground">
          {core ? `Key words to keep fresh all year · ${words}` : words}
        </span>
      </span>
    </ChoiceTile>
  );
}

interface DeckOverviewProps {
  content: Content;
  subject: Subject;
  deck: Deck;
  onStart: () => void;
}

/** What's in the selected Deck, how it overlaps with the others, and the start button. */
function DeckOverview({ content, subject, deck, onStart }: DeckOverviewProps) {
  const [showWords, setShowWords] = useState(false);
  const wordsId = useId();
  const stats = getDeckStats(deck, content.decks);
  const concepts = content.concepts.filter((concept) => deck.conceptIds.includes(concept.id));
  const overlaps = [
    ...stats.overlaps.map(({ deck, count }) => ({
      label: deck.name,
      core: deck.kind === 'core',
      count,
    })),
    { label: 'Only in this set', core: false, count: stats.exclusiveCount },
  ].filter((overlap) => overlap.count > 0);

  return (
    <section
      aria-label="Selected set"
      className="flex animate-card-in flex-col gap-6 rounded-[2rem] border-2 border-foreground bg-card p-6 shadow-sticker-lg lg:sticky lg:top-6"
    >
      <div className="flex flex-col gap-1">
        <p className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
          {subject.emoji} {subject.name} · {deck.kind === 'core' ? 'Core set' : 'Unit'}
        </p>
        <h2 className="font-display text-3xl font-extrabold tracking-tight">{deck.name}</h2>
      </div>

      <dl className="grid grid-cols-2 gap-3">
        <StatTile label="Words" value={stats.conceptCount} />
        <StatTile
          label="Exercises"
          value={stats.conceptCount * EXERCISE_TYPES.length}
          note={
            <span className="flex flex-wrap gap-x-2">
              {EXERCISE_TYPES.map((type) => {
                const { label, Icon } = EXERCISES[type];
                return (
                  <span key={type} className="flex items-center gap-1">
                    <Icon aria-hidden className="size-3" />
                    {label}
                  </span>
                );
              })}
            </span>
          }
        />
      </dl>

      {stats.overlaps.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <h3 className="font-display font-bold">Shared with other sets</h3>
          <ul className="flex flex-col gap-2.5 text-sm">
            {overlaps.map(({ label, core, count }) => (
              <li key={label} className="flex flex-col gap-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="flex items-center gap-1.5">
                    {core && <Star aria-hidden className="size-3.5 fill-almost" />}
                    {label}
                  </span>
                  <span className="font-semibold tabular-nums">{count}</span>
                </span>
                <span
                  aria-hidden
                  className="h-2.5 overflow-hidden rounded-full border-2 border-foreground bg-muted"
                >
                  <span
                    className={cn(
                      'block h-full origin-left animate-grow',
                      core ? 'bg-rocket' : 'bg-correct',
                    )}
                    style={{ width: `${(count / stats.conceptCount) * 100}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Practising a word here counts in every set it's in.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          aria-expanded={showWords}
          aria-controls={wordsId}
          onClick={() => setShowWords((show) => !show)}
          className="flex items-center gap-1.5 self-start rounded-full px-2 py-1 -ml-2 text-sm font-semibold hover:bg-muted"
        >
          <ChevronDown className={cn('size-4 transition-transform', !showWords && '-rotate-90')} />
          {showWords ? 'Hide words' : `Show ${plural(concepts.length, 'word')}`}
        </button>
        {showWords && (
          <ul
            id={wordsId}
            aria-label="Words in set"
            className="flex max-h-72 animate-rise flex-col overflow-y-auto rounded-2xl border-2 border-foreground/15 bg-background px-4 py-2 text-sm"
          >
            {concepts.map((concept) => (
              <li
                key={concept.id}
                className="flex items-baseline justify-between gap-3 border-b border-foreground/10 py-1.5 last:border-b-0"
              >
                <span className="font-semibold">{concept.foreign}</span>
                <span className="text-right text-muted-foreground">{concept.local}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Button variant="cta" className="h-14 rounded-2xl text-lg" onClick={onStart}>
        <Rocket className="size-5" /> Start session
      </Button>
    </section>
  );
}

function StatTile({ label, value, note }: { label: string; value: number; note?: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl border-2 border-foreground bg-background p-3 shadow-sticker-sm">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="font-display text-3xl font-bold tabular-nums">{value}</dd>
      {note && <dd className="text-xs text-muted-foreground">{note}</dd>}
    </div>
  );
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}
