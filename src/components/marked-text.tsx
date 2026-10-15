import { splitMarked } from '@/lib/split-marked';
import { cn } from '@/lib/utils';

/** Text with its parts in square brackets highlighted, e.g. a plural's ending: "die Kuli[s]". */
export function MarkedText({ text, className }: { text: string; className?: string }) {
  return (
    <span className={cn('whitespace-pre-wrap', className)}>
      {splitMarked(text).map(({ text, marked }, index) =>
        marked ? (
          <mark key={index} className="rounded-md bg-highlight px-0.5 text-foreground">
            {text}
          </mark>
        ) : (
          <span key={index}>{text}</span>
        ),
      )}
    </span>
  );
}
