import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import {
  CheckDocumentError,
  CheckDocumentSnapshot,
  CheckDocumentStamp,
  CheckReport,
} from "@beep/github-reporting/CheckDocument";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const encode = S.encodeEffect(schema);
  const decode = S.decodeEffect(schema);
  const equivalent = S.toEquivalence(schema);
  it.effect.prop(
    `${name}: decoding an encoded value succeeds and preserves its value`,
    [Arbitrary.schema(schema)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* encode(value);
        const decoded = yield* decode(encoded);
        assert.isTrue(equivalent(decoded, value));
        const encoded1 = yield* encode(decoded);
        assert.deepStrictEqual(encoded1, encoded);
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

import { CheckDocument } from "@beep/github-reporting/CheckDocument";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";

it.effect.prop(
  "the same run and report reproduce identical document bytes and suppress the second write",
  [Arbitrary.schema(CheckReport)],
  ([report]) =>
    Effect.gen(function* () {
      const writes = yield* Ref.make<ReadonlyArray<string>>([]);
      const layer = CheckDocument.layer({
        namespace: "properties",
        key: "check",
        stamp: CheckDocumentStamp.make({ at: "2026-01-01T00:00:00Z", runId: "1" }),
        render: () => [["report", report.state]],
        sink: (text) => Ref.update(writes, (all) => [...all, text]),
      });
      yield* Effect.scopedWith((scope) =>
        Effect.gen(function* () {
          const context = yield* Layer.buildWithScope(layer, scope);
          yield* Effect.gen(function* () {
            const document = yield* CheckDocument;
            yield* document.report("check", report);
            const flush2 = yield* document.flush;
            assert.strictEqual(flush2, "written");
            const first = yield* Ref.get(writes);
            yield* document.report("check", report);
            const flush3 = yield* document.flush;
            assert.strictEqual(flush3, "unchanged");
            const got = yield* Ref.get(writes);
            assert.deepStrictEqual(got, first);
          }).pipe(Effect.provideContext(context));
        })
      );
      assert.strictEqual((yield* Ref.get(writes)).length, 1);
    }),
  runs
);
