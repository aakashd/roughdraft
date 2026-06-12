// Thin logging seam so every diagnostic the app emits carries a consistent,
// greppable `[roughdraft]` tag. This is a local-only tool, so it wraps the
// console directly rather than shipping to any remote sink — the value is
// uniformity: filter the DevTools console for "[roughdraft]" to see everything
// the app reports, at any level, in one place.
const PREFIX = "[roughdraft]";

export const log = {
  info: (...args: unknown[]): void => console.info(PREFIX, ...args),
  warn: (...args: unknown[]): void => console.warn(PREFIX, ...args),
  error: (...args: unknown[]): void => console.error(PREFIX, ...args),
};
