// Retargets upstream packages/sdk/__test__/RunReportFile.test.ts (vitest-agent
// 1cf1ab94): the gate-report/v1 envelope and its ISO instant.

import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { GateRecord, GateRecordFromJson } from "@beep/gate-report/GateRecord";
import { IsoInstant } from "@beep/gate-report/Scalars";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { decodes, makeReport } from "./support/builders.ts";

const record = GateRecord.make({ generatedAt: DateTime.makeUnsafe(1_763_546_757_308), report: makeReport() });

const instant = (text: string): boolean => O.isSome(decodes(IsoInstant)(text));

describe("GateRecord", () => {
  it.effect("round-trips through its JSON text", () =>
    Effect.gen(function* () {
      const text = yield* S.encodeEffect(GateRecordFromJson)(record);
      const decoded = yield* S.decodeEffect(GateRecordFromJson)(text);
      assert.isTrue(S.toEquivalence(GateRecord)(decoded, record));
      assert.include(text, '"version":"gate-report/v1"');
    })
  );

  it.effect.prop(
    "rejects any valid record once its version alone changes",
    [Arbitrary.schema(GateRecord)],
    ([generated]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(GateRecord)(generated);
        assertNone(decodes(GateRecord)({ ...encoded, version: "gate-report/v2" }));
      }),
    { arbitrary: fcRuns(50) }
  );

  it("constructs with the version filled in", () => {
    assert.strictEqual(record.version, "gate-report/v1");
  });

  it.effect("rejects a valid record whose only change is its version", () =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(GateRecord)(record);
      assertSome(decodes(GateRecord)(encoded), record);
      assertNone(decodes(GateRecord)({ ...encoded, version: "gate-report/v2" }));
    })
  );

  it("rejects a non-ISO instant and a locale date string the date parser would accept", () => {
    assert.isFalse(instant("yesterday"));
    assert.isFalse(instant("Mon Jan 01 2026 10:00:00 GMT+0000"));
  });

  it("rejects an ISO-shaped stamp with impossible components", () => {
    assert.isFalse(instant("2026-13-45T99:99:99Z"));
  });

  it("accepts an offset instant, not only a Z instant, and the exact stamp toISOString writes", () => {
    assert.isTrue(instant("2026-09-07T23:45:57+02:00"));
    assert.isTrue(instant("2026-09-07T23:45:57.308Z"));
  });

  it("rejects an instant before 1970", () => {
    assert.isFalse(instant("1969-12-31T23:59:59.999Z"));
  });
});
