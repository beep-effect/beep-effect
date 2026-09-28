// @vitest-environment node

import { ANTHROPIC_DEFAULT_MODEL } from "@beep/anthropic";
import { describe, expect } from "@effect/vitest";
import { ConfigProvider, Effect, Layer } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import { Command } from "effect/cli";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { CanaryCommand, CanaryOptions, CanaryStage } from "@/canary/Command";
import { LabConfig, RuntimeLayer } from "@/runtime/Layer";
import { ProjectionFailed, ReasoningFailed, ReportInvalid } from "@/schema/Errors";
import { CanaryC0 } from "@/services/CanaryC0";
import { CanaryC1 } from "@/services/CanaryC1";

const decodeCanaryOptions = S.decodeEffect(CanaryOptions);
const decodeCanaryStage = S.decodeEffect(CanaryStage);
const encodeCanaryOptions = S.encodeEffect(CanaryOptions);
const encodeCanaryStage = S.encodeEffect(CanaryStage);
const isCanaryOptions = S.is(CanaryOptions);
const isCanaryStage = S.is(CanaryStage);

import { it } from "@beep/test-runner";
import { fcRuns, provideScopedLayer } from "@beep/test-utils";
import { assertFalse, assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import { pipe } from "effect";
import { LabConfigLive } from "@/runtime/Config";
import { CanaryC2 } from "@/services/CanaryC2";

const runtimeFromEnv = (env: Record<string, string>) =>
  RuntimeLayer.pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env }))));
describe("Semantica runtime layer", () => {
  it.effect("builds with values decoded from a provided environment", () =>
    Effect.gen(function* () {
      const config = yield* provideScopedLayer(
        configFromEnv({
          SEMANTICA_CORPUS_ROOT: "/fixtures/w1",
          SEMANTICA_OFFLINE: "true",
          SEMANTICA_PROVIDER_CACHE_DIR: "/fixtures/provider-cache",
        })
      )(LabConfig);

      assertSome(config.corpusRoot, "/fixtures/w1");
      expect(config.extractorModel).toBe(ANTHROPIC_DEFAULT_MODEL);
      expect(config.goldDirectory).toBe("fixtures/gold/v1");
      expect(config.goldModel).toBe("grok-4.6");
      expect(config.ledgerRoot).toBe(".beep/semantica/ledger");
      expect(config.mode).toBe("replay");
      pipe(config.offline, assertTrue);
      expect(config.providerCacheDirectory).toBe("/fixtures/provider-cache");
    })
  );

  it.effect("builds in degraded mode when the corpus root is absent", () =>
    Effect.gen(function* () {
      const config = yield* provideScopedLayer(configFromEnv({}))(LabConfig);

      assertNone(config.corpusRoot);
      expect(config.goldModel).toBe("grok-4.6");
      expect(config.mode).toBe("live");
      pipe(config.offline, assertFalse);
      expect(config.providerCacheDirectory).toBe(".beep/semantica/provider-cache");
    })
  );
});

describe("Semantica canary command", () => {
  const runCanary = Command.runWith(CanaryCommand, { renderErrors: false, version: "0.0.0" });

  it.effect("routes c2 through the injected workflow service", () =>
    Effect.gen(function* () {
      const expected = ReasoningFailed.make({ message: "stub-c2-ran", reason: "event-invalid" });
      const stub = CanaryC2.of({ run: Effect.fn("CanaryC2.stub")(() => Effect.fail(expected)) });
      const error = yield* provideScopedLayer(runtimeFromEnv({}))(
        runCanary(["c2", "--offline", "--out", ".beep/test-run", "--selection", "f1"]).pipe(
          Effect.provideService(CanaryC2, stub),
          Effect.flip
        )
      );

      expect(error).toEqual(expected);
    })
  );

  it.effect("routes c0 through the injected workflow service", () =>
    Effect.gen(function* () {
      const expected = ReportInvalid.make({ message: "stub-c0-ran" });
      const stub = CanaryC0.of({
        run: Effect.fn("CanaryC0.stub")(() => Effect.fail(expected)),
        runWithSnapshot: Effect.fn("CanaryC0.stubWithSnapshot")(() => Effect.fail(expected)),
      });
      const error = yield* provideScopedLayer(runtimeFromEnv({}))(
        runCanary(["c0", "--offline", "--out", ".beep/test-run", "--selection", "f1"]).pipe(
          Effect.provideService(CanaryC0, stub),
          Effect.flip
        )
      );

      expect(error).toEqual(expected);
    })
  );

  it.effect("routes c1 through the injected workflow service", () =>
    Effect.gen(function* () {
      const expected = ProjectionFailed.make({ message: "stub-c1-ran", reason: "vector-failed" });
      const stub = CanaryC1.of({
        run: Effect.fn("CanaryC1.stub")(() => Effect.fail(expected)),
        runWithSnapshot: Effect.fn("CanaryC1.stubWithSnapshot")(() => Effect.fail(expected)),
      });
      const error = yield* provideScopedLayer(runtimeFromEnv({}))(
        runCanary(["c1", "--offline", "--out", ".beep/test-run", "--selection", "f1"]).pipe(
          Effect.provideService(CanaryC1, stub),
          Effect.flip
        )
      );

      expect(error).toEqual(expected);
    })
  );
});

describe("Semantica canary schemas", () => {
  it.prop(
    "generates values accepted by the source schemas",
    [Arbitrary.schema(CanaryStage), Arbitrary.schema(CanaryOptions)],
    ([stage, options]) => assertTrue(isCanaryStage(stage) && isCanaryOptions(options)),
    { arbitrary: fcRuns(25) }
  );

  it.effect("round-trips CanaryStage", () =>
    Effect.gen(function* () {
      const encoded = yield* encodeCanaryStage("c1");
      const decoded = yield* decodeCanaryStage(encoded);

      expect({ decoded, encoded }).toEqual({ decoded: "c1", encoded: "c1" });
    })
  );

  it.effect("round-trips CanaryOptions", () =>
    Effect.gen(function* () {
      const options = CanaryOptions.make({
        manifest: "fixture.manifest.json",
        offline: true,
        out: O.some("fixture-output"),
        paper: O.some("paper-001"),
        selection: "f1+w1",
      });
      const encoded = yield* encodeCanaryOptions(options);
      const decoded = yield* decodeCanaryOptions(encoded);

      expect({ decoded, encoded }).toEqual({
        decoded: options,
        encoded: {
          manifest: "fixture.manifest.json",
          offline: true,
          out: "fixture-output",
          paper: "paper-001",
          selection: "f1+w1",
        },
      });
    })
  );
});

const configFromEnv = (env: Record<string, string>) =>
  LabConfigLive.pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env }))));
it.layer(runtimeFromEnv({}), { timeout: "30 seconds", excludeTestServices: true })((it) => {
  it.effect("constructs and closes the complete runtime with an empty environment", () =>
    Effect.gen(function* () {
      yield* CanaryC0;
      yield* CanaryC1;
      yield* CanaryC2;
    })
  );
});
