import {
  Check,
  ChevronDown,
  ChevronsUpDown,
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
import { getProgress, getWordProgress, PROGRESS_LABELS, type Progress } from '@/components/grades';
import { SESSION_SIZES, type SessionSize } from '@/components/setup-choice';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Content } from '@/data/content';
import { getSubjectDecks } from '@/data/decks';
import type { Card, Concept, Deck, ExerciseType, Subject } from '@/domain/types';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import { countDueToday, getCardId } from '@/session/session';
import { State, type FsrsCard } from '@/srs/scheduler';

interface SetupScreenProps {
  content: Content;
  /** Cards practised so far, keyed by id, to show how well each word is known. */
  cards: Record<string, Card>;
  /** The selected Deck; its Subject is the selected Subject. */
  deck: Deck;
  /** The unit last picked in each Subject, shown in the unit picker while the core set is selected. */
  lastUnitIds: Record<string, string>;
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
  lastUnitIds,
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
  const selectedUnit = unitDecks.find((option) => option.id === deck.id);
  const tileUnit =
    selectedUnit ??
    unitDecks.find((option) => option.id === lastUnitIds[subject.id]) ??
    unitDecks[0];

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
      <div className="flex flex-col gap-8">
        <ChoiceGroup legend="Subject" hideLegend>
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

        <ChoiceGroup legend="Unit">
          <div className="grid gap-3 sm:grid-cols-2">
            {coreDecks.map((option) => (
              <CoreTile
                key={option.id}
                deck={option}
                cards={cards}
                now={now}
                checked={option.id === deck.id}
                onSelect={() => onSelectDeck(option)}
              />
            ))}
            {tileUnit && (
              <UnitTile
                units={unitDecks}
                cards={cards}
                now={now}
                unit={tileUnit}
                checked={tileUnit === selectedUnit}
                onSelect={onSelectDeck}
              />
            )}
          </div>
        </ChoiceGroup>

        <SessionSizePicker
          value={sessionSize}
          onChange={onSessionSizeChange}
          wordCount={deck.conceptIds.length}
          exerciseCount={deck.exerciseTypes.length}
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

interface ChoiceGroupProps {
  legend: string;
  /** Keeps the legend for screen readers only. */
  hideLegend?: boolean;
  children: ReactNode;
}

function ChoiceGroup({ legend, hideLegend, children }: ChoiceGroupProps) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend
        className={cn(
          'mb-3 text-xs font-bold tracking-wider text-muted-foreground uppercase',
          hideLegend && 'sr-only',
        )}
      >
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
        'group relative flex animate-rise cursor-pointer items-center gap-4 rounded-2xl border-2 border-line bg-card p-4 shadow-sticker-sm transition-all hover:-translate-y-px hover:shadow-sticker has-checked:bg-highlight/45 has-checked:shadow-sticker has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/50',
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
        className="absolute -top-2.5 -right-2.5 grid size-7 scale-50 place-items-center rounded-full border-2 border-line bg-correct opacity-0 transition-all group-has-checked:scale-100 group-has-checked:opacity-100"
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

interface CoreTileProps {
  deck: Deck;
  cards: Record<string, Card>;
  now: Date;
  checked: boolean;
  onSelect: () => void;
}

function CoreTile({ deck, cards, now, checked, onSelect }: CoreTileProps) {
  return (
    <ChoiceTile
      name={deck.name}
      group="deck"
      checked={checked}
      onSelect={onSelect}
      className="has-checked:bg-rocket/35"
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-full border-2 border-line bg-rocket">
        <Star className="size-6 fill-almost" />
      </span>
      {/* Rows match the unit tile's, so the two tiles line up side by side. */}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span aria-hidden className="flex h-11 items-center font-display text-lg font-bold">
          {deck.name}
        </span>
        <DeckStats deck={deck} cards={cards} now={now} />
      </span>
    </ChoiceTile>
  );
}

interface UnitTileProps {
  units: Deck[];
  cards: Record<string, Card>;
  now: Date;
  /** The unit on the tile: the selected one, or else the one last picked. */
  unit: Deck;
  checked: boolean;
  onSelect: (deck: Deck) => void;
}

/** A unit as a tile to select, with a select box to switch to another unit. */
function UnitTile({ units, cards, now, unit, checked, onSelect }: UnitTileProps) {
  return (
    <ChoiceTile name={unit.name} group="deck" checked={checked} onSelect={() => onSelect(unit)}>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <DropdownMenu>
          {/* Clicking the select box opens the menu; clicking elsewhere on the tile selects it. */}
          <DropdownMenuTrigger
            aria-label="Change unit"
            className="flex h-11 items-center gap-2 rounded-xl border-2 border-line bg-background px-3 text-left shadow-sticker-sm transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=open]:bg-muted"
          >
            <span aria-hidden className="min-w-0 flex-1 truncate font-display text-lg font-bold">
              {unit.name}
            </span>
            <ChevronsUpDown aria-hidden className="size-5 shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            sideOffset={8}
            className="rounded-2xl border-2 border-line bg-card p-1.5 text-foreground shadow-sticker ring-0"
          >
            <DropdownMenuRadioGroup
              value={checked ? unit.id : ''}
              onValueChange={(id) => onSelect(units.find((option) => option.id === id)!)}
            >
              {units.map((option) => {
                const due = countDueToday(option.conceptIds, cards, now, option.exerciseTypes);
                return (
                  <DropdownMenuRadioItem
                    key={option.id}
                    value={option.id}
                    className="flex-col items-start gap-0 rounded-xl px-3 py-2"
                  >
                    <span className="font-display font-bold">{option.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {plural(option.conceptIds.length, 'word')}
                      {due > 0 && ` · ${due} due today`}
                    </span>
                  </DropdownMenuRadioItem>
                );
              })}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <DeckStats deck={unit} cards={cards} now={now} />
      </span>
    </ChoiceTile>
  );
}

interface DeckStatsProps {
  deck: Deck;
  cards: Record<string, Card>;
  now: Date;
}

/** A deck tile's rows below its name: words due today, word count and progress. */
function DeckStats({ deck, cards, now }: DeckStatsProps) {
  return (
    <>
      <DueToday count={countDueToday(deck.conceptIds, cards, now, deck.exerciseTypes)} />
      <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm text-muted-foreground">
        {plural(deck.conceptIds.length, 'word')}
        <ProgressCounts
          progress={deck.conceptIds.map(
            (conceptId) => getConceptStatus(conceptId, cards, deck.exerciseTypes).progress,
          )}
        />
      </span>
    </>
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
  const { exerciseTypes } = deck;
  const words = concepts.map((concept) => ({
    concept,
    ...getConceptStatus(concept.id, cards, exerciseTypes),
  }));
  const [showWords, setShowWords] = useState(false);
  const wordListId = useId();

  return (
    <section
      aria-label="Selected set"
      className="flex animate-card-in flex-col gap-6 rounded-[2rem] border-2 border-line bg-card p-6 shadow-sticker-lg lg:sticky lg:top-6"
    >
      <div className="flex flex-col gap-1">
        <p className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
          {subject.emoji} {subject.name} · {deck.kind === 'core' ? 'Core set' : 'Unit'}
        </p>
        <h2 className="font-display text-3xl font-extrabold tracking-tight">{deck.name}</h2>
      </div>

      <dl className="grid grid-cols-2 gap-3">
        <StatTile
          label="Words"
          value={concepts.length}
          note={`Exercises: ${concepts.length * exerciseTypes.length}`}
        />
        <StatTile
          label="Due today"
          value={countDueToday(deck.conceptIds, cards, now, exerciseTypes)}
          note="Words to practise again"
        />
      </dl>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <h3 className="font-display font-bold">
            <button
              type="button"
              aria-expanded={showWords}
              aria-controls={wordListId}
              onClick={() => setShowWords(!showWords)}
              className="flex cursor-pointer items-center gap-1 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Words
              <ChevronDown
                aria-hidden
                className={cn('size-4 transition-transform', showWords && 'rotate-180')}
              />
            </button>
          </h3>
          <ProgressCounts progress={words.map((word) => word.progress)} />
        </div>
        {showWords && (
          <ul
            id={wordListId}
            aria-label="Words in set"
            className="flex max-h-72 flex-col overflow-y-auto rounded-2xl border-2 border-foreground/15 bg-background px-3 py-1 text-sm"
          >
            {words.map((word) => (
              <WordRow key={word.concept.id} word={word} now={now} />
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

const WORD_STATUS: Record<Progress, { Icon: LucideIcon; className: string }> = {
  learned: { Icon: CircleCheck, className: 'text-correct-ink' },
  learning: { Icon: CircleDotDashed, className: 'text-almost-ink' },
  new: { Icon: Circle, className: 'text-muted-foreground' },
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

function getConceptStatus(
  conceptId: string,
  cards: Record<string, Card>,
  exerciseTypes: ExerciseType[],
): ConceptStatus {
  const exercises = exerciseTypes.map((type) => ({
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
        const { Icon, className } = WORD_STATUS[status];
        const label = PROGRESS_LABELS[status];
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
  const { Icon, className } = WORD_STATUS[progress];
  const label = PROGRESS_LABELS[progress];

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
      {concept.local && <span className="text-right text-muted-foreground">{concept.local}</span>}
    </li>
  );
}

/** One exercise's status in words, e.g. "learned, back in 3d". */
function describeCard(srs: FsrsCard | undefined, now: Date): string {
  if (!srs || srs.state === State.New) return 'not practised yet';
  const progress = PROGRESS_LABELS[getProgress(srs.state)].toLowerCase();
  return `${progress}, back ${formatRelative(srs.due, now)}`;
}

interface SessionSizePickerProps {
  value: SessionSize;
  onChange: (size: SessionSize) => void;
  /** Words in the selected set. */
  wordCount: number;
  /** Exercises per word. */
  exerciseCount: number;
}

/** Segmented buttons for the most words to practise in one session. */
function SessionSizePicker({ value, onChange, wordCount, exerciseCount }: SessionSizePickerProps) {
  const words = Math.min(value ?? Infinity, wordCount);
  return (
    <ChoiceGroup legend="Words per session">
      <div className="grid max-w-md grid-cols-4 gap-1 rounded-2xl border-2 border-line bg-card p-1 shadow-sticker-sm">
        {SESSION_SIZES.map((size) => (
          <label
            key={size ?? 'all'}
            className="cursor-pointer rounded-xl py-2.5 text-center font-display font-bold transition-colors hover:bg-muted has-checked:bg-highlight has-checked:hover:bg-highlight has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
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
        {plural(words, 'word')} · {words * exerciseCount} exercises
      </p>
    </ChoiceGroup>
  );
}

interface StatTileProps {
  label: string;
  value: number;
  note?: ReactNode;
}

function StatTile({ label, value, note }: StatTileProps) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl border-2 border-line bg-background p-3 shadow-sticker-sm">
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
