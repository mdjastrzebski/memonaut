import { buildContent } from '@/data/content';

/** The YAML files next to this one, keyed by path. Tests use `@/test/content` instead. */
export const files = import.meta.glob<string>('./*/**/*.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** The learning content bundled with the app, without the user's own sets (see `@/data/user-sets`). */
export const content = buildContent(files);
