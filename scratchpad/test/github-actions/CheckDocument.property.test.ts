import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { CheckReport, CheckDocumentSnapshot, CheckDocumentError, CheckDocumentStamp } from "../../effected/github-actions/CheckDocument.ts";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const encode = S.encodeEffect(schema);
  const decode = S.decodeEffect(schema);
  const equivalent = S.toEquivalence(schema);
  it.effect.prop(
    `${name}: decoding an encoded value succeeds and preserves its value`,
    [Arbitrary.schema(schema)],
    ([value]) => Effect.gen(function* () {
      const encoded = yield* encode(value);
      const decoded = yield* decode(encoded);
      assert.isTrue(equivalent(decoded, value));
      assert.deepStrictEqual(yield* encode(decoded), encoded);
    }),
    runs
  );
};
describe("CheckDocument property floor", () => {
  roundTrips("CheckReport", CheckReport);
  roundTrips("CheckDocumentSnapshot", CheckDocumentSnapshot);
  roundTrips("CheckDocumentError", CheckDocumentError);
  roundTrips("CheckDocumentStamp", CheckDocumentStamp);
});

import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import { CheckDocument } from "../../effected/github-actions/CheckDocument.ts";

it.effect.prop(
  "the same run and report reproduce identical document bytes and suppress the second write",
  [Arbitrary.schema(CheckReport)],
  ([report]) => Effect.gen(function* () {
    const writes = yield* Ref.make<ReadonlyArray<string>>([]);
    const layer = CheckDocument.layer({
      namespace: "properties", key: "check",
      stamp: CheckDocumentStamp.make({ at: "2026-01-01T00:00:00Z", runId: "1" }),
      render: () => [["report", report.state]],
      sink: (text) => Ref.update(writes, (all) => [...all, text]),
    });
    yield* Effect.scopedWith((scope) => Effect.gen(function* () {
      const context = yield* Layer.buildWithScope(layer, scope);
      yield* Effect.gen(function* () {
        const document = yield* CheckDocument;
        yield* document.report("check", report);
        assert.strictEqual(yield* document.flush, "written");
        const first = yield* Ref.get(writes);
        yield* document.report("check", report);
        assert.strictEqual(yield* document.flush, "unchanged");
        assert.deepStrictEqual(yield* Ref.get(writes), first);
      }).pipe(Effect.provideContext(context));
    }));
    assert.strictEqual((yield* Ref.get(writes)).length, 1);
  }),
  runs
);
