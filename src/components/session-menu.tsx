import { Flag, Menu } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/** Session actions behind a hamburger; finishing early asks first. */
export function SessionMenu({ onEnd }: { onEnd: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="sticker" size="icon-lg" aria-label="Session menu" className="rounded-full">
          <Menu />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-auto min-w-52 rounded-2xl border-2 border-line bg-card p-1.5 text-foreground shadow-sticker ring-0"
      >
        <DropdownMenuItem
          className="gap-3 rounded-xl px-3 py-3 font-display text-lg font-semibold [&_svg:not([class*='size-'])]:size-5"
          onSelect={() => window.confirm('Finish now? Your answers so far are saved.') && onEnd()}
        >
          <Flag /> Finish now
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
