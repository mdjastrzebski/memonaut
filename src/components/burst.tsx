import type { CSSProperties } from 'react';

import { cn } from '@/lib/utils';

/** Confetti dots flying out of the feedback icon. */
export function Burst() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
      {Array.from({ length: 8 }, (_, index) => (
        <span
          key={index}
          className={cn(
            'absolute size-2 animate-burst rounded-full',
            index % 2 ? 'bg-rocket' : 'bg-almost',
          )}
          style={{ '--angle': `${index * 45}deg` } as CSSProperties}
        />
      ))}
    </span>
  );
}
