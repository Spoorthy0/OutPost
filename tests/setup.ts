// Browser APIs tldraw expects that jsdom doesn't provide. Only what a headless Editor touches.

if (typeof window !== "undefined") {
  // Reports reduced motion, so the agent draws instantly instead of animating step by step.
  window.matchMedia ??= ((query: string) => ({
    matches: query.includes("prefers-reduced-motion: reduce"),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;

  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
