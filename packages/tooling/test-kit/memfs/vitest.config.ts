import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../../../vitest.shared.ts";

// decision: errno-parity-expectation-shapes
const tmpfsTempDirectory = "/tmp";

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      env: { TMPDIR: tmpfsTempDirectory },
    },
  })
);
