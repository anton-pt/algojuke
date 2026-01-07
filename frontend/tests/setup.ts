import "@testing-library/jest-dom";

// Mock ResizeObserver for jsdom (required by some components)
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
