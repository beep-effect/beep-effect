import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { AttestationListEntry, AttestationRecord } from "@beep/github/Attestation";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };

it.effect.prop(
  "AttestationRecord preserves every encoded value",
  [Arbitrary.schema(AttestationRecord)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(AttestationRecord)(value);
      const decoded = yield* S.decodeEffect(AttestationRecord)(encoded);
      assert.isTrue(S.toEquivalence(AttestationRecord)(decoded, value));
      const value1 = yield* S.encodeEffect(AttestationRecord)(decoded);
      assert.deepStrictEqual(value1, encoded);
    }),
  runs
);

it.effect.prop(
  "AttestationListEntry preserves every encoded value",
  [Arbitrary.schema(AttestationListEntry)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(AttestationListEntry)(value);
      const decoded = yield* S.decodeEffect(AttestationListEntry)(encoded);
      assert.isTrue(S.toEquivalence(AttestationListEntry)(decoded, value));
      const value2 = yield* S.encodeEffect(AttestationListEntry)(decoded);
      assert.deepStrictEqual(value2, encoded);
    }),
  runs
);
