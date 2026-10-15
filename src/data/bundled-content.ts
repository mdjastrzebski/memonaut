import { buildContent } from '@/data/content';

/** The learning content in the YAML files next to this one. Tests use `@/test/content` instead. */
export const content = buildContent(
  import.meta.glob<string>('./*/**/*.yaml', { query: '?raw', import: 'default', eager: true }),
);
