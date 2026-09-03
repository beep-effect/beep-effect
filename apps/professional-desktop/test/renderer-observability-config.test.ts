import { it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { describe, expect } from "vitest";
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
      expect(config.buildCommit).toEqual(O.none());
      expect(config.otlpUrl).toEqual(O.none());
    })
  );

  it.effect("decodes present optional fields to Some", () =>
    Effect.gen(function* () {
      const config = yield* RendererObservabilityConfig.decode({
        ...required,
        buildCommit: "abc123",
        otlpUrl: "http://localhost:4318",
      });
      expect(config.buildCommit).toEqual(O.some("abc123"));
      expect(config.otlpUrl).toEqual(O.some("http://localhost:4318"));
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
