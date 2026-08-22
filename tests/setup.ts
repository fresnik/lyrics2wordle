import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// This project doesn't enable Vitest's `globals: true`, so Testing Library's
// built-in auto-cleanup (which checks for a global `afterEach`) never fires.
// Register it explicitly so each test starts with a fresh DOM.
afterEach(() => {
  cleanup();
});
