import { Button } from '@/components/ui/button';

interface SpecialCharactersProps {
  characters: string[];
  onInsert: (character: string) => void;
}

/** On-screen keys for characters that are hard to type on the learner's keyboard. */
export function SpecialCharacters({ characters, onInsert }: SpecialCharactersProps) {
  return (
    <div
      role="group"
      aria-label="Special characters"
      className="flex flex-wrap justify-center gap-1.5"
    >
      {characters.map((character) => (
        <Button
          key={character}
          type="button"
          variant="outline"
          className="size-10 text-lg"
          // Keep focus (and the caret) in the answer input.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onInsert(character)}
        >
          {character}
        </Button>
      ))}
    </div>
  );
}
