// @vitest-environment node

import { ANTHROPIC_DEFAULT_MODEL } from "@beep/anthropic";
import { ConfigProvider, Effect, Layer } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import { Command } from "effect/unstable/cli";
import { describe, expect, it } from "vitest";
import { CanaryCommand, CanaryOptions, CanaryStage, StageNotImplemented } from "@/canary/Command";
import { LabConfig, RuntimeLayer } from "@/runtime/Layer";
import { ReportInvalid } from "@/schema/Errors";
import { CanaryC0 } from "@/services/CanaryC0";

const runtimeFromEnv = (env: Record<string, string>) =>
  RuntimeLayer.pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env }))));

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

describe("Semantica runtime layer", () => {
  it("builds with values decoded from a provided environment", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const config = yield* provideScopedLayer(
          runtimeFromEnv({
            SEMANTICA_CORPUS_ROOT: "/fixtures/w1",
            SEMANTICA_OFFLINE: "true",
            SEMANTICA_PROVIDER_CACHE_DIR: "/fixtures/provider-cache",
          })
        )(LabConfig);

        expect(config.corpusRoot).toEqual(O.some("/fixtures/w1"));
        expect(config.extractorModel).toBe(ANTHROPIC_DEFAULT_MODEL);
        expect(config.goldDirectory).toBe("fixtures/gold/v1");
        expect(config.goldModel).toBe("grok-4.6");
        expect(config.ledgerRoot).toBe(".beep/semantica/ledger");
        expect(config.mode).toBe("replay");
        expect(config.offline).toBe(true);
        expect(config.providerCacheDirectory).toBe("/fixtures/provider-cache");
      })
    ));

  it("builds in degraded mode when the corpus root is absent", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const config = yield* provideScopedLayer(runtimeFromEnv({}))(LabConfig);

        expect(config.corpusRoot).toEqual(O.none());
        expect(config.goldModel).toBe("grok-4.6");
        expect(config.mode).toBe("live");
        expect(config.offline).toBe(false);
        expect(config.providerCacheDirectory).toBe(".beep/semantica/provider-cache");
      })
    ));
});

describe("Semantica canary command", () => {
  const runCanary = Command.runWith(CanaryCommand, { renderErrors: false, version: "0.0.0" });

  it.each([CanaryStage.Enum.c1, CanaryStage.Enum.c2])("fails stage %s with StageNotImplemented", (stage) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const error = yield* provideScopedLayer(runtimeFromEnv({}))(runCanary([stage, "--offline"]).pipe(Effect.flip));

        expect(error).toBeInstanceOf(StageNotImplemented);
        expect(error).toMatchObject({
          _tag: "StageNotImplemented",
          message: `Canary stage ${stage} is not implemented.`,
          options: {
            manifest: "fixtures/w1.manifest.json",
            offline: true,
            out: O.none(),
            paper: O.none(),
            selection: "f1+w1",
          },
          stage,
        });
      })
    )
  );

  it("routes c0 through the injected workflow service", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const expected = ReportInvalid.make({ message: "stub-c0-ran" });
        const stub = CanaryC0.of({ run: Effect.fn("CanaryC0.stub")(() => Effect.fail(expected)) });
        const error = yield* provideScopedLayer(runtimeFromEnv({}))(
          runCanary(["c0", "--offline", "--out", ".beep/test-run", "--selection", "f1"]).pipe(
            Effect.provideService(CanaryC0, stub),
            Effect.flip
          )
        );

        expect(error).toEqual(expected);
      })
    ));
});

describe("Semantica canary schemas", () => {
  it("generates values accepted by the source schemas", () => {
    fc.assert(
      fc.property(
        S.toArbitrary(CanaryStage)(fc),
        S.toArbitrary(CanaryOptions)(fc),
        (stage, options) => S.is(CanaryStage)(stage) && S.is(CanaryOptions)(options)
      ),
      { numRuns: 25 }
    );
  });

  it("round-trips CanaryStage", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(CanaryStage)("c1");
        const decoded = yield* S.decodeEffect(CanaryStage)(encoded);

        expect({ decoded, encoded }).toEqual({ decoded: "c1", encoded: "c1" });
      })
    ));

  it("round-trips CanaryOptions", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const options = CanaryOptions.make({
          manifest: "fixture.manifest.json",
          offline: true,
          out: O.some("fixture-output"),
          paper: O.some("paper-001"),
          selection: "f1+w1",
        });
        const encoded = yield* S.encodeEffect(CanaryOptions)(options);
        const decoded = yield* S.decodeEffect(CanaryOptions)(encoded);

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
    ));
});
