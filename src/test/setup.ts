import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

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
