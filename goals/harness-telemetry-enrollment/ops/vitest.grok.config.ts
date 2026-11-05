import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../../vitest.shared.ts";

export default mergeConfig(
  shared,
  defineConfig({ test: { include: ["goals/harness-telemetry-enrollment/ops/test-grok-*.ts"], testTimeout: 30000 } })
);
