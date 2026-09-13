import { defineConfig, mergeConfig } from "vitest/config";
import base from "/home/elpresidank/YeeBois/projects/beep-effect/packages/tooling/test-kit/test-utils/vitest.config.ts";
export default mergeConfig(
  base,
  defineConfig({
    test: {
      maxWorkers: 1,
      projects: [
        {
          extends: true,
          test: {
            name: "trace-off",
            root: "/home/elpresidank/YeeBois/projects/beep-effect/packages/tooling/test-kit/test-utils/test/fixtures/vitest-instrumentation/.runtime-trace-matrix-BWi2X6/trace-off",
            include: [
              "/home/elpresidank/YeeBois/projects/beep-effect/packages/tooling/test-kit/test-utils/test/fixtures/vitest-instrumentation/.runtime-trace-matrix-BWi2X6/trace-off/runtime.test.ts",
            ],
            isolate: true,
            maxWorkers: 1,
            env: {
              BEEP_INSTRUMENTED_IT_FIXTURE: "trace-success",
              CI: "false",
              BEEP_TEST_TRACE: "0",
              BEEP_TRACE_CASE: "trace-off",
            },
          },
        },
        {
          extends: true,
          test: {
            name: "trace-on",
            root: "/home/elpresidank/YeeBois/projects/beep-effect/packages/tooling/test-kit/test-utils/test/fixtures/vitest-instrumentation/.runtime-trace-matrix-BWi2X6/trace-on",
            include: [
              "/home/elpresidank/YeeBois/projects/beep-effect/packages/tooling/test-kit/test-utils/test/fixtures/vitest-instrumentation/.runtime-trace-matrix-BWi2X6/trace-on/runtime.test.ts",
            ],
            isolate: true,
            maxWorkers: 1,
            env: {
              BEEP_INSTRUMENTED_IT_FIXTURE: "trace-success",
              CI: "false",
              BEEP_TEST_TRACE: "1",
              BEEP_TRACE_CASE: "trace-on",
            },
          },
        },
        {
          extends: true,
          test: {
            name: "trace-ci",
            root: "/home/elpresidank/YeeBois/projects/beep-effect/packages/tooling/test-kit/test-utils/test/fixtures/vitest-instrumentation/.runtime-trace-matrix-BWi2X6/trace-ci",
            include: [
              "/home/elpresidank/YeeBois/projects/beep-effect/packages/tooling/test-kit/test-utils/test/fixtures/vitest-instrumentation/.runtime-trace-matrix-BWi2X6/trace-ci/runtime.test.ts",
            ],
            isolate: true,
            maxWorkers: 1,
            env: {
              BEEP_INSTRUMENTED_IT_FIXTURE: "trace-success",
              CI: "true",
              BEEP_TEST_TRACE: "0",
              BEEP_TRACE_CASE: "trace-ci",
            },
          },
        },
        {
          extends: true,
          test: {
            name: "trace-failure",
            root: "/home/elpresidank/YeeBois/projects/beep-effect/packages/tooling/test-kit/test-utils/test/fixtures/vitest-instrumentation/.runtime-trace-matrix-BWi2X6/trace-failure",
            include: [
              "/home/elpresidank/YeeBois/projects/beep-effect/packages/tooling/test-kit/test-utils/test/fixtures/vitest-instrumentation/.runtime-trace-matrix-BWi2X6/trace-failure/runtime.test.ts",
            ],
            isolate: true,
            maxWorkers: 1,
            env: {
              BEEP_INSTRUMENTED_IT_FIXTURE: "trace-failure",
              CI: "false",
              BEEP_TEST_TRACE: "1",
              BEEP_TRACE_CASE: "trace-failure",
            },
          },
        },
      ],
    },
  })
);
