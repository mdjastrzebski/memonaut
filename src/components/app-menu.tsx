import { AudioLines, Check, Flag, Menu } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  removeElevenLabsKey,
  saveElevenLabsKey,
  useVoiceStatus,
  type VoiceStatus,
} from '@/lib/speech';
import { cn } from '@/lib/utils';

const ITEM_CLASS =
  "gap-3 rounded-xl px-3 py-3 font-display text-lg font-semibold [&_svg:not([class*='size-'])]:size-5";

/** App actions behind a hamburger: voice settings, and during a session finishing early. */
export function AppMenu({ onEnd }: { onEnd?: () => void }) {
  const [voiceOpen, setVoiceOpen] = useState(false);
  const voiceStatus = useVoiceStatus();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="sticker"
            size="icon-lg"
            aria-label="Menu"
            className="relative rounded-full"
          >
            <Menu />
            {voiceStatus === 'paused' && (
              <span className="absolute -top-1 -right-1 size-3 rounded-full border-2 border-line bg-almost" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={8}
          className="w-auto min-w-52 rounded-2xl border-2 border-line bg-card p-1.5 text-foreground shadow-sticker ring-0"
        >
          <DropdownMenuItem className={ITEM_CLASS} onSelect={() => setVoiceOpen(true)}>
            <AudioLines /> TTS: {voiceStatus === 'off' ? 'Browser' : 'ElevenLabs'}
            {voiceStatus === 'on' && (
              // The same badge as a picked subject: the better voice is working.
              <span
                aria-hidden
                className="ml-auto grid shrink-0 size-6 place-items-center rounded-full border-2 border-line bg-correct"
              >
                <Check className="size-3.5" strokeWidth={3} />
              </span>
            )}
            {voiceStatus === 'paused' && (
              <span className="ml-auto pl-3 font-sans text-sm font-medium text-almost-ink">
                Paused
              </span>
            )}
          </DropdownMenuItem>
          {onEnd && (
            <DropdownMenuItem
              className={ITEM_CLASS}
              onSelect={() =>
                window.confirm('Finish now? Your answers so far are saved.') && onEnd()
              }
            >
              <Flag /> Finish now
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <VoiceDialog open={voiceOpen} onOpenChange={setVoiceOpen} />
    </>
  );
}

const VOICE_STATUS_TEXTS: Record<VoiceStatus, string> = {
  off: "Off: your browser's voice reads words aloud.",
  on: 'On: ElevenLabs reads words aloud.',
  paused:
    "Paused: ElevenLabs rejected the key or ran out of credits, so your browser's voice reads words aloud. Save a key to try again.",
};

/** Optional ElevenLabs voice, set up with a parent's API key. */
function VoiceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const status = useVoiceStatus();
  const [key, setKey] = useState('');
  const inputId = useId();

  const close = () => {
    setKey('');
    onOpenChange(false);
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!key.trim()) return;
    if (saveElevenLabsKey(key)) close();
    else window.alert('Could not save the key on this device.');
  };

  const remove = () => {
    if (removeElevenLabsKey()) close();
    else window.alert('Could not remove the key from this device.');
  };

  return (
    <Dialog open={open} onOpenChange={(open) => (open ? onOpenChange(true) : close())}>
      <DialogContent className="gap-5 rounded-2xl border-2 border-line bg-card p-6 shadow-sticker ring-0 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-bold">Text-to-speech</DialogTitle>
          <DialogDescription>
            Browser voices vary a lot by device and can mispronounce words. With an{' '}
            <a
              href="https://elevenlabs.io/app/settings/api-keys"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              ElevenLabs API key
            </a>
            , a natural voice reads words instead. Optional: the key stays on this device and each
            new word uses some of its credits.
          </DialogDescription>
        </DialogHeader>
        <p
          className={cn(
            'rounded-xl border-2 border-line px-4 py-3 font-medium',
            status === 'on' && 'bg-correct/25',
            status === 'paused' && 'bg-almost/40',
          )}
        >
          {VOICE_STATUS_TEXTS[status]}
        </p>
        <form id={`${inputId}-form`} onSubmit={save} className="grid gap-2">
          <label htmlFor={inputId} className="font-semibold">
            {status === 'off' ? 'API key' : 'New API key'}
          </label>
          {/* The saved key is never shown back. */}
          <Input
            id={inputId}
            type="password"
            autoComplete="off"
            value={key}
            onChange={(event) => setKey(event.target.value)}
            placeholder="Paste the ElevenLabs API key"
            className="h-11 rounded-xl border-2 border-line px-3 text-base"
          />
        </form>
        <DialogFooter className="sm:justify-between">
          {status !== 'off' ? (
            <Button variant="ghost" size="lg" onClick={remove}>
              Remove key
            </Button>
          ) : (
            <span />
          )}
          <Button
            type="submit"
            form={`${inputId}-form`}
            variant="cta"
            size="lg"
            className="rounded-xl px-4"
            disabled={!key.trim()}
          >
            Save key
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
