import { Plus, Trash2, Upload } from 'lucide-react';
import { useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { files } from '@/data/bundled-content';
import type { Content } from '@/data/content';
import {
  addSubject,
  importDeck,
  readDeckHeader,
  removeBroken,
  removeDeck,
  removeSubject,
  type BrokenSet,
} from '@/data/user-sets';
import type { SubjectKind } from '@/domain/types';
import { cn } from '@/lib/utils';

/** Languages a new subject can be read aloud in, with the letters offered for typing them. */
const LANGUAGES: { tag: string; name: string; specialCharacters?: string[] }[] = [
  { tag: 'en-GB', name: 'English (UK)' },
  { tag: 'en-US', name: 'English (US)' },
  { tag: 'de-DE', name: 'German', specialCharacters: ['ä', 'ö', 'ü', 'ß', 'Ä', 'Ö', 'Ü'] },
  {
    tag: 'pl-PL',
    name: 'Polish',
    specialCharacters: ['ą', 'ć', 'ę', 'ł', 'ń', 'ó', 'ś', 'ź', 'ż'],
  },
  {
    tag: 'fr-FR',
    name: 'French',
    specialCharacters: ['é', 'è', 'ê', 'ë', 'à', 'â', 'ç', 'î', 'ï', 'ô', 'ù', 'û', 'œ'],
  },
  {
    tag: 'es-ES',
    name: 'Spanish',
    specialCharacters: ['á', 'é', 'í', 'ó', 'ú', 'ñ', 'ü', '¿', '¡'],
  },
  { tag: 'it-IT', name: 'Italian', specialCharacters: ['à', 'è', 'é', 'ì', 'ò', 'ù'] },
  {
    tag: 'pt-PT',
    name: 'Portuguese',
    specialCharacters: ['á', 'â', 'ã', 'à', 'ç', 'é', 'ê', 'í', 'ó', 'ô', 'õ', 'ú'],
  },
  { tag: 'nl-NL', name: 'Dutch' },
  { tag: 'sv-SE', name: 'Swedish', specialCharacters: ['å', 'ä', 'ö'] },
  { tag: 'nb-NO', name: 'Norwegian', specialCharacters: ['æ', 'ø', 'å'] },
  { tag: 'da-DK', name: 'Danish', specialCharacters: ['æ', 'ø', 'å'] },
  { tag: 'fi-FI', name: 'Finnish', specialCharacters: ['ä', 'ö'] },
  {
    tag: 'cs-CZ',
    name: 'Czech',
    specialCharacters: ['á', 'č', 'ď', 'é', 'ě', 'í', 'ň', 'ó', 'ř', 'š', 'ť', 'ú', 'ů', 'ý', 'ž'],
  },
  { tag: 'uk-UA', name: 'Ukrainian' },
  { tag: 'ru-RU', name: 'Russian' },
  { tag: 'tr-TR', name: 'Turkish', specialCharacters: ['ç', 'ğ', 'ı', 'İ', 'ö', 'ş', 'ü'] },
  { tag: 'ja-JP', name: 'Japanese' },
  { tag: 'zh-CN', name: 'Chinese' },
];

const FIELD_CLASS = 'h-11 rounded-xl border-2 border-line bg-card px-3 text-base';

type Message = { kind: 'done' | 'error'; text: string };

/**
 * The user's own sets: importing a set's YAML into a subject, or a new version of one, creating
 * subjects of their own, and removing either. They're kept on this device, apart from progress.
 */
export function SetsDialog({
  open,
  onOpenChange,
  content,
  broken,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: Content;
  broken: BrokenSet[];
  /** Called after the sets changed, to load them again. */
  onChange: () => void;
}) {
  const [subjectId, setSubjectId] = useState(content.subjects[0].id);
  const [message, setMessage] = useState<Message | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const subjectSelectId = useId();
  const subject =
    content.subjects.find((subject) => subject.id === subjectId) ?? content.subjects[0];
  const customDecks = content.decks.filter((deck) => deck.custom);
  const customSubjects = content.subjects.filter((subject) => subject.custom);
  const getSubject = (id: string) => content.subjects.find((subject) => subject.id === id)!;

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const yaml = await file.text();
    const header = readDeckHeader(yaml);
    const replaced =
      header &&
      content.decks.find((deck) => deck.custom && deck.id === `${subject.id}/${header.id}`);
    if (
      replaced &&
      !window.confirm(
        `Replace ${replaced.name} in ${subject.name} with this version? What was learned is kept.`,
      )
    )
      return;
    const result = importDeck(files, subject.id, yaml);
    if (!result.ok) {
      setMessage({ kind: 'error', text: result.error });
      return;
    }
    setMessage({
      kind: 'done',
      text: `${replaced ? 'Updated' : 'Added'} ${result.value.name} in ${subject.name}.`,
    });
    onChange();
  };

  const remove = (name: string, removeIt: () => boolean, confirmText: string) => {
    if (!window.confirm(confirmText)) return;
    setMessage(
      removeIt()
        ? { kind: 'done', text: `Removed ${name}.` }
        : { kind: 'error', text: `Could not remove ${name} from this device.` },
    );
    onChange();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        setMessage(null);
        onOpenChange(open);
      }}
    >
      <DialogContent className="max-h-[90svh] gap-6 overflow-y-auto rounded-2xl border-2 border-line bg-card p-6 shadow-sticker ring-0 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-bold">My sets</DialogTitle>
          <DialogDescription>
            Add your own sets of words or questions, written in Memonaut's YAML, to a subject. They
            stay on this device, apart from your progress, and Export progress saves them too. To
            update a set, import its new version: what was learned is kept.
          </DialogDescription>
        </DialogHeader>

        <section className="grid gap-2">
          <label htmlFor={subjectSelectId} className="font-semibold">
            Subject
          </label>
          <div className="flex gap-2">
            <select
              id={subjectSelectId}
              value={subject.id}
              onChange={(event) => setSubjectId(event.target.value)}
              className={cn(FIELD_CLASS, 'min-w-0 flex-1')}
            >
              {content.subjects.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.emoji ? `${option.emoji} ${option.name}` : option.name}
                </option>
              ))}
            </select>
            <Button
              variant="cta"
              size="lg"
              className="h-11 rounded-xl px-4"
              onClick={() => fileInput.current?.click()}
            >
              <Upload /> Import set
            </Button>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept=".yaml,.yml,application/yaml,text/yaml"
            aria-label="Set file"
            className="hidden"
            onChange={importFile}
          />
          {message && (
            <p
              role={message.kind === 'error' ? 'alert' : 'status'}
              className={cn(
                'rounded-xl border-2 border-line px-4 py-3 font-medium whitespace-pre-wrap break-words',
                message.kind === 'done' ? 'bg-correct/25' : 'bg-almost/40',
              )}
            >
              {message.text}
            </p>
          )}
        </section>

        {(customDecks.length > 0 || broken.length > 0) && (
          <section className="grid gap-2">
            <h3 className="font-display text-lg font-bold">Imported sets</h3>
            <ul className="grid gap-2">
              {customDecks.map((deck) => {
                const deckSubject = getSubject(deck.subjectId);
                return (
                  <Row
                    key={deck.id}
                    title={deck.name}
                    detail={`${deckSubject.emoji ?? ''} ${deckSubject.name} · ${deck.conceptIds.length} ${deckSubject.kind === 'knowledge' ? 'questions' : 'words'}`}
                    removeLabel={`Remove ${deck.name}`}
                    onRemove={() =>
                      remove(
                        deck.name,
                        () => removeDeck(deck.subjectId, deck.id.slice(deck.subjectId.length + 1)),
                        `Remove ${deck.name}? What was learned is kept, in case you import it again.`,
                      )
                    }
                  />
                );
              })}
              {broken.map((set) => (
                <Row
                  key={set.key}
                  title={set.name}
                  detail={`Can't be loaded: ${set.error}`}
                  removeLabel={`Remove ${set.name}`}
                  onRemove={() =>
                    remove(
                      set.name,
                      () => removeBroken(set.key),
                      `Remove ${set.name}, which can't be loaded?`,
                    )
                  }
                />
              ))}
            </ul>
          </section>
        )}

        <section className="grid gap-2">
          <h3 className="font-display text-lg font-bold">My subjects</h3>
          {customSubjects.length > 0 && (
            <ul className="grid gap-2">
              {customSubjects.map((option) => (
                <Row
                  key={option.id}
                  title={option.emoji ? `${option.emoji} ${option.name}` : option.name}
                  detail={
                    option.kind === 'language'
                      ? `Words, read aloud in ${getLanguageName(option.foreignLanguage)}`
                      : 'Questions'
                  }
                  removeLabel={`Remove ${option.name}`}
                  onRemove={() =>
                    remove(
                      option.name,
                      () => removeSubject(option.id),
                      `Remove ${option.name} with its sets? What was learned is kept, in case you add it again.`,
                    )
                  }
                />
              ))}
            </ul>
          )}
          <NewSubjectForm
            onAdded={(name, id) => {
              setSubjectId(id);
              setMessage({
                kind: 'done',
                text: `Added ${name}. Import a set into it, and it shows up among the subjects.`,
              });
              onChange();
            }}
            onError={(text) => setMessage({ kind: 'error', text })}
          />
        </section>
      </DialogContent>
    </Dialog>
  );
}

function getLanguageName(tag: string): string {
  return LANGUAGES.find((language) => language.tag === tag)?.name ?? tag;
}

function Row({
  title,
  detail,
  removeLabel,
  onRemove,
}: {
  title: string;
  detail: string;
  removeLabel: string;
  onRemove: () => void;
}) {
  return (
    <li className="flex items-center gap-3 rounded-xl border-2 border-line px-4 py-2">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        <p className="text-sm break-words text-muted-foreground">{detail}</p>
      </div>
      <Button variant="ghost" size="icon-lg" aria-label={removeLabel} onClick={onRemove}>
        <Trash2 />
      </Button>
    </li>
  );
}

/** A subject of the user's: its name, optional emoji, kind and, for words, their language. */
function NewSubjectForm({
  onAdded,
  onError,
}: {
  onAdded: (name: string, id: string) => void;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [kind, setKind] = useState<SubjectKind>('language');
  const [language, setLanguage] = useState(LANGUAGES[0].tag);
  const id = useId();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = addSubject(files, {
      name,
      emoji,
      kind,
      foreignLanguage: language,
      specialCharacters: LANGUAGES.find((option) => option.tag === language)?.specialCharacters,
    });
    if (!result.ok) {
      onError(result.error);
      return;
    }
    setName('');
    setEmoji('');
    onAdded(result.value.name, result.value.id);
  };

  return (
    <form
      onSubmit={submit}
      className="grid gap-3 rounded-xl border-2 border-dashed border-line p-4"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_5rem] gap-2">
        <label htmlFor={`${id}-name`} className="font-semibold">
          New subject
        </label>
        <label htmlFor={`${id}-emoji`} className="font-semibold">
          Emoji
        </label>
        <Input
          id={`${id}-name`}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. French"
          className={FIELD_CLASS}
        />
        <Input
          id={`${id}-emoji`}
          value={emoji}
          onChange={(event) => setEmoji(event.target.value)}
          placeholder="🇫🇷"
          className={FIELD_CLASS}
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-2 font-semibold">
          Kind
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as SubjectKind)}
            className={cn(FIELD_CLASS, 'font-normal')}
          >
            <option value="language">Words of a language</option>
            <option value="knowledge">Questions with answers</option>
          </select>
        </label>
        {kind === 'language' && (
          <label className="grid gap-2 font-semibold">
            Read aloud in
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              className={cn(FIELD_CLASS, 'font-normal')}
            >
              {LANGUAGES.map((option) => (
                <option key={option.tag} value={option.tag}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <Button
        type="submit"
        variant="sticker"
        size="lg"
        className="justify-self-start rounded-xl px-4"
        disabled={!name.trim()}
      >
        <Plus /> Add subject
      </Button>
    </form>
  );
}
