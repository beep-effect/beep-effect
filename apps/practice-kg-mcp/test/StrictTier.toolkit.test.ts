import { PracticeKgFailureReasonKey, PracticeKgToolFailureReason, PracticeKgToolkit } from "@beep/law-practice-server";
import { effectiveTier, StrictDesktop, TelemetryTier } from "@beep/observability/catalog";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { layerShapeOnlyStderr, PracticeKgStrictGateConfig, shapeOnlyLogLine } from "../src/runtime/Telemetry.ts";
import {
  PracticeKgFailureReasonAttribute,
  PracticeKgTelemetryInstruments,
  PracticeKgToolId,
  PracticeKgToolKey,
} from "../src/telemetry/PracticeKgTelemetry.instruments.ts";

const sorted = (values: ReadonlyArray<string>) => A.sort(values, Order.String);

describe("practice KG strict tier pins", () => {
  it.effect("names exactly the toolkit's tools", () =>
    Effect.sync(() => {
      expect(sorted(PracticeKgToolId.literals)).toEqual(sorted(R.keys(PracticeKgToolkit.tools)));
      expect(PracticeKgStrictGateConfig.toolIds).toEqual(PracticeKgToolId.literals);
    })
  );

  it.effect("declares the handler's failure reason key with exactly its literal reasons", () =>
    Effect.sync(() => {
      expect(PracticeKgFailureReasonAttribute).toBe(PracticeKgFailureReasonKey);
      const declared = A.findFirst(
        PracticeKgTelemetryInstruments.attributes,
        (attribute) => attribute.key === PracticeKgFailureReasonAttribute
      );
      assertSome(
        O.map(
          O.flatMap(declared, (attribute) => attribute.values),
          sorted
        ),
        sorted(PracticeKgToolFailureReason.literals)
      );
      expect(PracticeKgStrictGateConfig.toolKey).toBe(PracticeKgToolKey);
    })
  );

  it.effect("fails closed: a strict desktop never resolves above shape-only", () =>
    Effect.sync(() => {
      for (const identitySource of ["vouched", "self-claimed"] as const) {
        for (const requested of TelemetryTier.literals) {
          expect(effectiveTier(StrictDesktop.make({ identitySource }), requested)).toBe("shape-only");
        }
      }
    })
  );
});

describe("practice KG shape-only stderr", () => {
  // The shape-only logger's context is provided inside the test effect, not
  // through `it.layer`: under CI the test runner merges its own pretty trace
  // logger around each test, and only the innermost loggers replace it the way
  // the production host's do.
  it.effect("writes one shape-only stderr line per log, naming the tool and never the message", () =>
    Effect.gen(function* () {
      const message = A.join(["Message", "Qz", "Canary", "8301"], "");
      yield* Effect.logError(message).pipe(Effect.withSpan("PracticeKgTools.kg_find"));
      yield* Effect.logWarning(message);
      const lines = yield* TestConsole.errorLines;
      expect(lines).toEqual([shapeOnlyLogLine("Error", O.some("kg_find")), shapeOnlyLogLine("Warn", O.none())]);
      expect(A.some(A.filter(lines, P.isString), Str.includes(message))).toBe(false);
      const logLines1 = yield* TestConsole.logLines;
      expect(logLines1).toEqual([]);
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make), (self) =>
      Layer.build(layerShapeOnlyStderr).pipe(Effect.flatMap((context) => Effect.provideContext(self, context)))
    )
  );
});
