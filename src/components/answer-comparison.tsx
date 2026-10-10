import { Check, X } from 'lucide-react';

import { diffAnswer, type DiffPart } from '@/exercises/answer-diff';
import { cn } from '@/lib/utils';

interface AnswerComparisonProps {
  input: string;
  answer: string;
  /** Shake what the learner typed, for a wrong answer. */
  shake?: boolean;
}

/**
 * Shows what the learner typed above the right answer. When they're close, the letters to fix are
 * highlighted in both and the rest fades back; otherwise the two are shown whole.
 */
export function AnswerComparison({ input, answer, shake }: AnswerComparisonProps) {
  const parts = diffAnswer(answer, input);

  return (
    <dl className="my-1 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5">
      <dt className="text-wrong-ink">
        <X className="size-5" strokeWidth={3} />
        <span className="sr-only">You typed</span>
      </dt>
      <dd
        className={cn(
          'font-display text-2xl font-semibold break-all whitespace-pre-wrap',
          shake && 'animate-shake',
        )}
      >
        {parts ? (
          parts.map((part, index) => <TypedPart key={index} part={part} />)
        ) : (
          <span className="text-wrong-ink line-through decoration-2">{input}</span>
        )}
      </dd>

      <dt className="text-correct-ink">
        <Check className="size-5" strokeWidth={3} />
        <span className="sr-only">Answer</span>
      </dt>
      <dd className="font-display text-2xl font-bold break-all whitespace-pre-wrap">
        {parts ? (
          parts.map((part, index) => <ExpectedPart key={index} part={part} />)
        ) : (
          <span className="text-correct-ink">{answer}</span>
        )}
      </dd>
    </dl>
  );
}

const MARK = 'rounded-md px-0.5 text-foreground';

function TypedPart({ part: { kind, typed } }: { part: DiffPart }) {
  switch (kind) {
    case 'match':
      return <span className="text-foreground/45">{typed}</span>;
    case 'minor':
      return <mark className={cn(MARK, 'bg-almost')}>{typed}</mark>;
    case 'wrong':
      return <mark className={cn(MARK, 'bg-wrong/40 text-wrong-ink')}>{typed}</mark>;
    case 'extra':
      return (
        <mark className={cn(MARK, 'bg-wrong/40 text-wrong-ink line-through decoration-2')}>
          {typed}
        </mark>
      );
    case 'missing':
      // An empty slot where a letter was left out.
      return (
        <span
          aria-hidden
          className="mx-0.5 inline-block h-[0.8em] w-[0.55em] rounded-md border-2 border-dashed border-wrong-ink align-[-0.05em]"
        />
      );
  }
}

function ExpectedPart({ part: { kind, expected } }: { part: DiffPart }) {
  switch (kind) {
    case 'match':
      return <span className="text-foreground/45">{expected}</span>;
    case 'minor':
      return <mark className={cn(MARK, 'bg-almost')}>{expected}</mark>;
    case 'wrong':
    case 'missing':
      return <mark className={cn(MARK, 'bg-correct/50')}>{expected}</mark>;
    case 'extra':
      return null;
  }
}
