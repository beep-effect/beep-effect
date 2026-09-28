import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../../vitest.shared.ts";

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      // The SHACL construction-count regression mocks a schema module. Keep its
      // import graph isolated even when coverage shares workers across files.
      isolate: true,
    },
  })
);
