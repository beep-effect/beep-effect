import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../../../vitest.shared.ts";

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      // The codec round-trip property tests do real encode/decode work over
      // arbitrary editor states; under hosted coverage they can exceed 30s
      // when import and instrumentation load is high. Give focused headroom.
      testTimeout: 60_000,
    },
  })
);
