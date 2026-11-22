import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../../vitest.shared.ts";

/**
 * Vitest configuration for the Box driver package.
 *
 * @category configuration
 * @since 0.0.0
 */
export default mergeConfig(
  shared,
  defineConfig({
    test: {},
  })
);
