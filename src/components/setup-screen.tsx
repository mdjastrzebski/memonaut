import {
  Check,
  Circle,
  CircleCheck,
  CircleDotDashed,
  Rocket,
  Sunrise,
  Star,
  type LucideIcon,
} from 'lucide-react';
import { useId, useState, type CSSProperties, type ReactNode } from 'react';

import { EXERCISES } from '@/components/exercise-types';
import { getProgress, getWordProgress, type Progress } from '@/components/grades';
import { SESSION_SIZES, type SessionSize } from '@/components/setup-choice';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Content } from '@/data/content';
import { getSubjectDecks } from '@/data/decks';
import type { Card, Concept, Deck, ExerciseType, Subject } from '@/domain/types';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import { countDueToday, EXERCISE_TYPES, getCardId } from '@/session/session';
import { State, type FsrsCard } from '@/srs/scheduler';

interface SetupScreenProps {
  content: Content;
  /** Cards practised so far, keyed by id, to show how well each word is known. */
  cards: Record<string, Card>;
  /** The selected Deck; its Subject is the selected Subject. */
  deck: Deck;
  onSelectDeck: (deck: Deck) => void;
  sessionSize: SessionSize;
  onSessionSizeChange: (size: SessionSize) => void;
  onStart: () => void;
}

/** Choose a Subject, then its core set or one of its units, and start a session. */
export function SetupScreen({
  content,
  cards,
  deck,
  onSelectDeck,
  sessionSize,
  onSessionSizeChange,
  onStart,
}: SetupScreenProps) {
  const [now] = useState(() => new Date());
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
                dueToday={countDueToday(
                  content.concepts
                    .filter((concept) => concept.subjectId === option.id)
                    .map((concept) => concept.id),
                  cards,
                  now,
                )}
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
                cards={cards}
                now={now}
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
                      cards={cards}
                      now={now}
                      checked={option.id === deck.id}
                      onSelect={() => onSelectDeck(option)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </ChoiceGroup>

        <SessionSizePicker
          value={sessionSize}
          onChange={onSessionSizeChange}
          wordCount={deck.conceptIds.length}
        />
      </div>

      <DeckOverview
        content={content}
        cards={cards}
        subject={subject}
        deck={deck}
        now={now}
        onStart={onStart}
      />
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
  /** Words of the Subject that need practice today. */
  dueToday: number;
  checked: boolean;
  onSelect: () => void;
  style: CSSProperties;
}

function SubjectTile({ subject, content, dueToday, checked, onSelect, style }: SubjectTileProps) {
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
        <DueToday count={dueToday} />
      </span>
    </ChoiceTile>
  );
}

interface DeckTileProps {
  deck: Deck;
  cards: Record<string, Card>;
  now: Date;
  checked: boolean;
  onSelect: () => void;
}

function DeckTile({ deck, cards, now, checked, onSelect }: DeckTileProps) {
  const core = deck.kind === 'core';
  const words = plural(deck.conceptIds.length, 'word');
  const progress = deck.conceptIds.map((conceptId) => getConceptStatus(conceptId, cards).progress);

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
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2">
          <span aria-hidden className="font-display text-lg font-bold">
            {deck.name}
          </span>
          {core && <Badge>Core set</Badge>}
        </span>
        <DueToday count={countDueToday(deck.conceptIds, cards, now)} />
        <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {core ? `Key words to keep fresh all year · ${words}` : words}
          <ProgressCounts progress={progress} />
        </span>
      </span>
    </ChoiceTile>
  );
}

interface DeckOverviewProps {
  content: Content;
  cards: Record<string, Card>;
  subject: Subject;
  deck: Deck;
  now: Date;
  onStart: () => void;
}

/** What's in the selected Deck, how well each word is known, and the start button. */
function DeckOverview({ content, cards, subject, deck, now, onStart }: DeckOverviewProps) {
  const concepts = content.concepts.filter((concept) => deck.conceptIds.includes(concept.id));
  const words = concepts.map((concept) => ({ concept, ...getConceptStatus(concept.id, cards) }));

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
        <StatTile label="Words" value={concepts.length} />
        <StatTile
          label="Due today"
          value={countDueToday(deck.conceptIds, cards, now)}
          note="Words to practise again"
        />
        <StatTile
          className="col-span-2"
          label="Exercises"
          value={concepts.length * EXERCISE_TYPES.length}
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

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <h3 className="font-display font-bold">Words</h3>
          <ProgressCounts progress={words.map((word) => word.progress)} />
        </div>
        <ul
          aria-label="Words in set"
          className="flex max-h-80 flex-col overflow-y-auto rounded-2xl border-2 border-foreground/15 bg-background px-3 py-1 text-sm"
        >
          {words.map((word) => (
            <WordRow key={word.concept.id} word={word} now={now} />
          ))}
        </ul>
      </div>

      <Button variant="cta" className="h-14 rounded-2xl text-lg" onClick={onStart}>
        <Rocket className="size-5" /> Start session
      </Button>
    </section>
  );
}

const WORD_STATUS: Record<Progress, { label: string; Icon: LucideIcon; className: string }> = {
  learned: { label: 'Learned', Icon: CircleCheck, className: 'text-correct-ink' },
  learning: { label: 'Learning', Icon: CircleDotDashed, className: 'text-almost-ink' },
  new: { label: 'New', Icon: Circle, className: 'text-muted-foreground' },
};

const PROGRESS_ORDER: Progress[] = ['learned', 'learning', 'new'];

interface ConceptStatus {
  /** The Concept's Card for each Exercise Type; no review state yet if it's never been practised. */
  exercises: { type: ExerciseType; srs?: FsrsCard }[];
  progress: Progress;
}

interface Word extends ConceptStatus {
  concept: Concept;
}

function getConceptStatus(conceptId: string, cards: Record<string, Card>): ConceptStatus {
  const exercises = EXERCISE_TYPES.map((type) => ({
    type,
    srs: cards[getCardId(conceptId, type)]?.srs,
  }));
  const states = exercises.map(({ srs }) => srs?.state ?? State.New);
  return { exercises, progress: getWordProgress(states) };
}

/** How many words are learned, learning and new, as symbols; hovering one names it. */
function ProgressCounts({ progress }: { progress: Progress[] }) {
  return (
    <span className="flex gap-3 text-xs text-muted-foreground">
      {PROGRESS_ORDER.map((status) => {
        const { label, Icon, className } = WORD_STATUS[status];
        const count = progress.filter((value) => value === status).length;
        return (
          <Tooltip key={status}>
            <TooltipTrigger asChild>
              <span className="flex cursor-help items-center gap-1">
                <Icon aria-hidden className={cn('size-3.5', className)} />
                <span className="sr-only">{label}</span>
                <span className="font-semibold text-foreground tabular-nums">{count}</span>
              </span>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        );
      })}
    </span>
  );
}

/** A word with its status as a symbol; hovering it tells how each exercise is going. */
function WordRow({ word, now }: { word: Word; now: Date }) {
  const { concept, exercises, progress } = word;
  const { label, Icon, className } = WORD_STATUS[progress];

  return (
    <li className="flex items-center gap-2.5 border-b border-foreground/10 py-1.5 last:border-b-0">
      <Tooltip>
        <TooltipTrigger
          aria-label={label}
          className="grid size-6 shrink-0 cursor-help place-items-center rounded-full"
        >
          <Icon className={cn('size-4', className)} />
        </TooltipTrigger>
        <TooltipContent side="left" className="flex flex-col gap-1">
          <p className="font-semibold">{label}</p>
          {exercises.map(({ type, srs }) => (
            <p key={type}>
              {EXERCISES[type].label}: {describeCard(srs, now)}
            </p>
          ))}
        </TooltipContent>
      </Tooltip>
      <span className="min-w-0 flex-1 font-semibold break-words">{concept.foreign}</span>
      <span className="text-right text-muted-foreground">{concept.local}</span>
    </li>
  );
}

/** One exercise's status in words, e.g. "learned, back in 3d". */
function describeCard(srs: FsrsCard | undefined, now: Date): string {
  if (!srs || srs.state === State.New) return 'not practised yet';
  const progress = WORD_STATUS[getProgress(srs.state)].label.toLowerCase();
  return `${progress}, back ${formatRelative(srs.due, now)}`;
}

interface SessionSizePickerProps {
  value: SessionSize;
  onChange: (size: SessionSize) => void;
  /** Words in the selected set. */
  wordCount: number;
}

/** Segmented buttons for the most words to practise in one session. */
function SessionSizePicker({ value, onChange, wordCount }: SessionSizePickerProps) {
  const words = Math.min(value ?? Infinity, wordCount);
  return (
    <ChoiceGroup legend="Words per session">
      <div className="grid max-w-md grid-cols-4 gap-1 rounded-2xl border-2 border-foreground bg-card p-1 shadow-sticker-sm">
        {SESSION_SIZES.map((size) => (
          <label
            key={size ?? 'all'}
            className="cursor-pointer rounded-xl py-2.5 text-center font-display font-bold transition-colors hover:bg-muted has-checked:bg-almost has-checked:hover:bg-almost has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
          >
            <input
              type="radio"
              name="session-size"
              checked={value === size}
              onChange={() => onChange(size)}
              className="sr-only"
            />
            {size ?? 'No limit'}
          </label>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        {plural(words, 'word')} · {words * EXERCISE_TYPES.length} exercises. Words due for practice
        come first, then new ones.
      </p>
    </ChoiceGroup>
  );
}

interface StatTileProps {
  label: string;
  value: number;
  note?: ReactNode;
  className?: string;
}

function StatTile({ label, value, note, className }: StatTileProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-0.5 rounded-2xl border-2 border-foreground bg-background p-3 shadow-sticker-sm',
        className,
      )}
    >
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="font-display text-3xl font-bold tabular-nums">{value}</dd>
      {note && <dd className="text-xs text-muted-foreground">{note}</dd>}
    </div>
  );
}

/** How many words need practice today, or that none do. */
function DueToday({ count }: { count: number }) {
  return (
    <span
      className={cn(
        'flex items-center gap-1 text-sm',
        count > 0 ? 'font-semibold text-foreground' : 'text-muted-foreground',
      )}
    >
      <Sunrise aria-hidden className="size-3.5" />
      {count > 0 ? `${plural(count, 'word')} due today` : 'Nothing due today'}
    </span>
  );
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}
