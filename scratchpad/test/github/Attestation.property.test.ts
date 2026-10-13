import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { AttestationRecord, AttestationListEntry } from "../../effected/github/Attestation.ts";

const runs = { arbitrary: fcRuns(100) };

it.effect.prop("AttestationRecord preserves every encoded value", [Arbitrary.schema(AttestationRecord)], ([value]) =>
  Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(AttestationRecord)(value);
    const decoded = yield* S.decodeEffect(AttestationRecord)(encoded);
    assert.isTrue(S.toEquivalence(AttestationRecord)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(AttestationRecord)(decoded), encoded);
  }), runs);

it.effect.prop("AttestationListEntry preserves every encoded value", [Arbitrary.schema(AttestationListEntry)], ([value]) =>
  Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(AttestationListEntry)(value);
    const decoded = yield* S.decodeEffect(AttestationListEntry)(encoded);
    assert.isTrue(S.toEquivalence(AttestationListEntry)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(AttestationListEntry)(decoded), encoded);
  }), runs);
