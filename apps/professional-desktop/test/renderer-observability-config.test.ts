import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { RendererObservabilityConfig } from "@/runtime/RendererObservabilityConfig";

describe("RendererObservabilityConfig", () => {
  const required = {
    deploymentEnvironment: "development",
    launchId: "launch-1",
    logLevel: "Info",
    qaSessionId: "qa-1",
  };

  it.effect("decodes a payload omitting buildCommit and otlpUrl to None", () =>
    Effect.gen(function* () {
      const config = yield* RendererObservabilityConfig.decode(required);
      assertNone(config.buildCommit);
      assertNone(config.otlpUrl);
    })
  );

  it.effect("decodes present optional fields to Some", () =>
    Effect.gen(function* () {
      const config = yield* RendererObservabilityConfig.decode({
        ...required,
        buildCommit: "abc123",
        otlpUrl: "http://localhost:4318",
      });
      assertSome<string>(config.buildCommit, "abc123");
      assertSome<string>(config.otlpUrl, "http://localhost:4318");
    })
  );

  it.effect("rejects an empty required string", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(RendererObservabilityConfig.decode({ ...required, logLevel: "" }));
      expect(exit._tag).toBe("Failure");
    })
  );

  it.effect("rejects a log level outside the canonical domain", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(RendererObservabilityConfig.decode({ ...required, logLevel: "Verbose" }));
      expect(exit._tag).toBe("Failure");
    })
  );

  it.effect("rejects an empty optional string instead of silently skipping it", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(RendererObservabilityConfig.decode({ ...required, otlpUrl: "" }));
      expect(exit._tag).toBe("Failure");
    })
  );
});
