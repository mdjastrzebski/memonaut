import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

import { testContent } from '@/test/content';

// Tests use their own words, so they don't pass or fail when the bundled word sets change.
vi.mock('@/data/bundled-content', () => ({ content: testContent }));

// jsdom lacks ResizeObserver, which Radix uses to position popovers and tooltips.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// jsdom can't play media and logs an error for each attempt.
HTMLMediaElement.prototype.play = () => Promise.resolve();

afterEach(() => {
  cleanup();
  localStorage.clear();
});
