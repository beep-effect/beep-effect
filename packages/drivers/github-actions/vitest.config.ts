import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../../vitest.shared.ts";

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      // The ported suites share process-wide state: `Action.main` writes through the global
      // console, the logger properties read one TestConsole transcript, and the DetachedProcess
      // suites spawn and reap real children. They were written for the
      // lab's sequential runner; the shared config runs tests concurrently, which interleaves
      // those runs, so this suite keeps its sequential order.
      sequence: { concurrent: false },
    },
  })
);
