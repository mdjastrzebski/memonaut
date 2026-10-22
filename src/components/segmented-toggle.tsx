import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

interface SegmentedToggleProps<T extends string> {
  /** Names the group for screen readers. */
  label: string;
  /** With an icon, a narrow screen shows only it, the label on hover. */
  options: [value: T, label: string, Icon?: LucideIcon][];
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
        'flex flex-wrap rounded-full border-2 border-line bg-background p-0.5 text-xs font-bold',
        className,
      )}
    >
      {options.map(([option, optionLabel, Icon]) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          aria-label={Icon ? optionLabel : undefined}
          title={Icon ? optionLabel : undefined}
          onClick={() => onChange(option)}
          className={cn(
            'flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
            value === option
              ? 'bg-foreground text-background'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {Icon && <Icon aria-hidden className="size-3.5 shrink-0" />}
          <span className={cn(Icon && 'max-sm:sr-only')}>{optionLabel}</span>
        </button>
      ))}
    </div>
  );
}
