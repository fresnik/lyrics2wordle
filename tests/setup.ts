import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// This project doesn't enable Vitest's `globals: true`, so Testing Library's
// built-in auto-cleanup (which checks for a global `afterEach`) never fires.
// Register it explicitly so each test starts with a fresh DOM.
afterEach(() => {
  cleanup();
});

// Node 22+ ships an experimental global `localStorage` that is undefined
// unless --localstorage-file is passed, and it shadows jsdom's version.
// Provide an in-memory Storage so components using localStorage are testable.
const store = new Map<string, string>();
const localStorageStub: Storage = {
  get length() {
    return store.size;
  },
  clear: () => store.clear(),
  getItem: (key) => store.get(key) ?? null,
  key: (index) => [...store.keys()][index] ?? null,
  removeItem: (key) => {
    store.delete(key);
  },
  setItem: (key, value) => {
    store.set(key, String(value));
  },
};
Object.defineProperty(globalThis, "localStorage", {
  value: localStorageStub,
  configurable: true,
});
// Some test files opt into the node environment, where there is no window.
if (typeof window !== "undefined") {
  Object.defineProperty(window, "localStorage", {
    value: localStorageStub,
    configurable: true,
  });
}

afterEach(() => {
  store.clear();
});
