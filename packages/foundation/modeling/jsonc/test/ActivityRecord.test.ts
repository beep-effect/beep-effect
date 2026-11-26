import { IRI } from "@beep/identity/Iri";
import { ActivityRecord, ActivityRecordInvalid, verifyActivityRecord } from "@beep/jsonc/ActivityRecord";
import { ActivityPin, ActivityStart, mintActivityId } from "@beep/jsonc/ActivityStart";
import { ContentHash } from "@beep/schema/ContentHash";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const decodeRecord = S.decodeUnknownEffect(ActivityRecord);

const encodeRecord = S.encodeEffect(ActivityRecord);

const entity = ContentHash.make(`sha256:${Str.repeat(64)("a")}`);

const startAt = (started: number, operation = "https://example.org/ops/extract") =>
  ActivityStart.make({
    operation: IRI.make(operation),
    pin: ActivityPin.cases.Engine.make({ engine: "langextract", edition: "1.0.0" }),
    promptDigest: O.none(),
    used: HashSet.make(entity),
    started: DateTime.makeUnsafe(started),
  });

const recordFor = Effect.fnUntraced(function* (start: ActivityStart, ended: number) {
  const id = yield* mintActivityId(start);
  return ActivityRecord.make({
    id,
    start,
    generated: HashSet.empty(),
    ended: DateTime.makeUnsafe(ended),
    outcome: "completed",
  });
});

describe("ActivityRecord", () => {
  it.layer(Digest.layerWebCrypto)("verification", (it) => {
    it.effect("verifies a record whose id re-mints from its start and round-trips it", () =>
      Effect.gen(function* () {
        const record = yield* recordFor(startAt(10), 20);
        const verified = yield* verifyActivityRecord(record);
        const encoded = yield* encodeRecord(record);
        const decoded = yield* decodeRecord(encoded);
        expect(verified).toBe(record);
        expect(decoded.id).toBe(record.id);
        expect(DateTime.toEpochMillis(decoded.ended)).toBe(20);
      })
    );

    it.effect("refuses a record whose start was tampered after the id was minted", () =>
      Effect.gen(function* () {
        const record = yield* recordFor(startAt(10), 20);
        const tampered = ActivityRecord.make({ ...record, start: startAt(10, "https://example.org/ops/other") });
        const refusal = yield* Effect.flip(verifyActivityRecord(tampered));
        expect(refusal).toEqual(ActivityRecordInvalid.make({ reason: "id-mismatch" }));
      })
    );

    it.effect("refuses a record that ends before it starts", () =>
      Effect.gen(function* () {
        const record = yield* recordFor(startAt(10), 20);
        const encoded = yield* encodeRecord(record);
        const refused = yield* Effect.exit(decodeRecord({ ...encoded, ended: 5 }));
        expect(refused._tag).toBe("Failure");
      })
    );

    it.effect("refuses a failed record that generated an entity", () =>
      Effect.gen(function* () {
        const record = yield* recordFor(startAt(10), 20);
        const encoded = yield* encodeRecord(record);
        const failedWithOutput = yield* Effect.exit(
          decodeRecord({ ...encoded, outcome: "failed", generated: [entity] })
        );
        const failedEmpty = yield* decodeRecord({ ...encoded, outcome: "failed" });
        expect(failedWithOutput._tag).toBe("Failure");
        expect(failedEmpty.outcome).toBe("failed");
      })
    );
  });
});
