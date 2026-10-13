import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { StorageRecordInput } from "../../effected/github/ArtifactMetadata.ts";

const runs = { arbitrary: fcRuns(100) };

it.effect.prop("StorageRecordInput preserves every encoded value", [Arbitrary.schema(StorageRecordInput)], ([value]) =>
  Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(StorageRecordInput)(value);
    const decoded = yield* S.decodeEffect(StorageRecordInput)(encoded);
    assert.isTrue(S.toEquivalence(StorageRecordInput)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(StorageRecordInput)(decoded), encoded);
  }), runs);
