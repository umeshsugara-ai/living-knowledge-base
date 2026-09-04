import "@testing-library/jest-dom/vitest";

// jsdom has no ResizeObserver (BrainPage measures its graph container with one) -- every real
// browser has it, so this is a test-environment gap, not something production code should guard.
// Fires its callback once synchronously with a fixed size (jsdom never lays out real dimensions),
// matching a real ResizeObserver's "fires once on observe()" behavior closely enough to unblock
// components that gate rendering on having measured a size at least once.
class ResizeObserverStub {
  #callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) { this.#callback = callback; }
  observe(target: Element): void {
    this.#callback([{ target, contentRect: { width: 800, height: 520 } } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
