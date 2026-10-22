import { cn } from '@/lib/utils';

interface SegmentedToggleProps<T extends string> {
  /** Names the group for screen readers. */
  label: string;
  options: [value: T, label: string][];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/** A row of pill buttons, one of them pressed. */
export function SegmentedToggle<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: SegmentedToggleProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'flex flex-wrap rounded-[1.25rem] border-2 border-line bg-background p-0.5 text-xs font-bold',
        className,
      )}
    >
      {options.map(([option, optionLabel]) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={cn(
            'cursor-pointer rounded-full px-3 py-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
            value === option
              ? 'bg-foreground text-background'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {optionLabel}
        </button>
      ))}
    </div>
  );
}
