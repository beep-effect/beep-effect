import { ReviewItem, ReviewItemKind } from "@beep/law-practice-domain/values/ReviewItem";
import { SourceRef } from "@beep/law-practice-domain/values/SourceRef";
import { VerdictRow } from "@beep/law-practice-domain/values/VerdictRow";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const decodeItem = S.decodeUnknownEffect(ReviewItem);
const encodeItem = S.encodeEffect(ReviewItem);
const decodeRef = S.decodeUnknownEffect(SourceRef);
const encodeRef = S.encodeEffect(SourceRef);
const decodeRow = S.decodeUnknownEffect(VerdictRow);
const encodeRow = S.encodeEffect(VerdictRow);

const minimalRef = { boxFileId: "1234567890", quote: { exact: "a hinge coupling the lid to the base" } };

const fullRef = {
  boxFileId: "1234567890",
  page: 3,
  quote: { exact: "a hinge", prefix: "comprising ", suffix: " coupling the lid" },
  crop: { page: 3, mimeType: "image/png", width: 640, height: 120, data: "iVBORw0KGgo=" },
};

const questionOptions = [
  { optionId: "keep-date", label: "Keep the current date" },
  { optionId: "move-date", label: "Move the date" },
];

const encodedItem = (kind: string) => ({
  kind,
  itemId: `${kind}:1`,
  text: "Claim 1 element (b) is disclosed by the cited reference.",
  sourceRefs: [minimalRef],
  ...(kind === "claim-finding" ? { claimId: 7 } : {}),
  ...(kind === "question" ? { facts: [], options: questionOptions } : {}),
});

const cropOfLength = (length: number) => ({ ...fullRef, crop: { ...fullRef.crop, data: Str.repeat(length)("A") } });

describe("@beep/law-practice-domain ReviewItem", () => {
  it.effect(
    "decodes every review item kind and round-trips it",
    Effect.fnUntraced(function* () {
      expect(ReviewItemKind.literals).toHaveLength(7);

      for (const kind of ReviewItemKind.literals) {
        const input = encodedItem(kind);
        const item = yield* decodeItem(input);

        expect(item.kind).toBe(kind);
        assertTrue(ReviewItem.guards[kind](item));
        assertNone(item.label);
        const encodedItem1 = yield* encodeItem(item);
        expect(encodedItem1).toStrictEqual(input);
      }
    })
  );

  it.effect(
    "keeps the claim id on a claim finding",
    Effect.fnUntraced(function* () {
      const item = yield* decodeItem(encodedItem("claim-finding"));

      assertTrue(ReviewItem.guards["claim-finding"](item));
      if (ReviewItem.guards["claim-finding"](item)) {
        expect(item.claimId).toBe(7);
      }
    })
  );

  it.effect(
    "rejects an unknown kind",
    Effect.fnUntraced(function* () {
      const error = yield* Effect.flip(decodeItem(encodedItem("memo")));

      expect(error._tag).toBe("SchemaError");
    })
  );

  it.effect(
    "rejects a claim finding without a claim id",
    Effect.fnUntraced(function* () {
      const error = yield* Effect.flip(decodeItem({ ...encodedItem("oa-analysis"), kind: "claim-finding" }));

      expect(error._tag).toBe("SchemaError");
    })
  );
});

describe("@beep/law-practice-domain SourceRef", () => {
  it.effect(
    "round-trips without page, prefix, suffix or crop",
    Effect.fnUntraced(function* () {
      const ref = yield* decodeRef(minimalRef);

      assertNone(ref.page);
      assertNone(ref.quote.prefix);
      assertNone(ref.quote.suffix);
      assertNone(ref.crop);
      const encodedRef = yield* encodeRef(ref);
      expect(encodedRef).toStrictEqual(minimalRef);
    })
  );

  it.effect(
    "round-trips with page, prefix, suffix and crop",
    Effect.fnUntraced(function* () {
      const ref = yield* decodeRef(fullRef);

      assertSome(ref.page, 3);
      assertSome(ref.quote.prefix, "comprising ");
      assertSome(ref.quote.suffix, " coupling the lid");
      expect(ref.crop._tag).toBe("Some");
      const encodedRef2 = yield* encodeRef(ref);
      expect(encodedRef2).toStrictEqual(fullRef);
    })
  );

  it.effect(
    "accepts crop data at the 120,000-character cap and rejects one character group more",
    Effect.fnUntraced(function* () {
      const atCap = yield* decodeRef(cropOfLength(120_000));
      const overCap = yield* Effect.flip(decodeRef(cropOfLength(120_004)));

      expect(atCap.crop._tag).toBe("Some");
      expect(overCap._tag).toBe("SchemaError");
    })
  );

  it.effect(
    "rejects a crop with an unsupported image format or non-base64 data",
    Effect.fnUntraced(function* () {
      const gif = yield* Effect.flip(decodeRef({ ...fullRef, crop: { ...fullRef.crop, mimeType: "image/gif" } }));
      const notBase64 = yield* Effect.flip(decodeRef({ ...fullRef, crop: { ...fullRef.crop, data: "not base64!" } }));

      expect(gif._tag).toBe("SchemaError");
      expect(notBase64._tag).toBe("SchemaError");
    })
  );

  it.effect(
    "accepts a crop from the referenced page and rejects a crop from another page",
    Effect.fnUntraced(function* () {
      const matching = yield* decodeRef(fullRef);
      const mismatched = yield* Effect.flip(decodeRef({ ...fullRef, crop: { ...fullRef.crop, page: 4 } }));
      const cropWithoutPage = yield* decodeRef({ ...minimalRef, crop: { ...fullRef.crop, page: 4 } });

      assertSome(matching.page, 3);
      expect(mismatched._tag).toBe("SchemaError");
      expect(mismatched.message).toContain("Expected the crop page to equal the source reference page");
      assertNone(cropWithoutPage.page);
      expect(cropWithoutPage.crop._tag).toBe("Some");
    })
  );

  it.effect(
    "rejects a non-numeric Box file id",
    Effect.fnUntraced(function* () {
      const error = yield* Effect.flip(decodeRef({ ...minimalRef, boxFileId: "file-abc" }));

      expect(error._tag).toBe("SchemaError");
    })
  );
});

describe("@beep/law-practice-domain VerdictRow", () => {
  const encodedRow = {
    itemId: "claim-finding:1",
    batchId: "sitting-2026-10-14",
    verdict: "wrong",
    note: "The reference shows a latch, not a hinge.",
    revision: 1,
    recordedAt: 1_760_400_000_000,
  };

  it.effect(
    "round-trips a row with and without the optional fields",
    Effect.fnUntraced(function* () {
      const row = yield* decodeRow(encodedRow);
      const locked = yield* decodeRow({ ...encodedRow, verdict: "right", revision: 2, lockedAt: 1_760_400_060_000 });
      const { note: _note, ...withoutNote } = encodedRow;
      const bare = yield* decodeRow(withoutNote);

      assertSome(row.note, "The reference shows a latch, not a hinge.");
      expect(row.batchId).toBe("sitting-2026-10-14");
      assertNone(row.lockedAt);
      expect(DateTime.toEpochMillis(row.recordedAt)).toBe(1_760_400_000_000);
      expect(A.map([row, locked, bare], (r) => r.verdict)).toStrictEqual(["wrong", "right", "wrong"]);
      assertNone(bare.note);
      const encodedRow3 = yield* encodeRow(row);
      expect(encodedRow3).toStrictEqual(encodedRow);
      const encodedRow4 = yield* encodeRow(locked);
      expect(encodedRow4).toStrictEqual({
        ...encodedRow,
        verdict: "right",
        revision: 2,
        lockedAt: 1_760_400_060_000,
      });
      const encodedRow5 = yield* encodeRow(bare);
      expect(encodedRow5).toStrictEqual(withoutNote);
    })
  );

  it.effect(
    "rejects a row without a batch id, or with an empty or padded one",
    Effect.fnUntraced(function* () {
      const { batchId: _batchId, ...withoutBatch } = encodedRow;
      const missing = yield* Effect.flip(decodeRow(withoutBatch));
      const empty = yield* Effect.flip(decodeRow({ ...encodedRow, batchId: "" }));
      const padded = yield* Effect.flip(decodeRow({ ...encodedRow, batchId: " sitting-2026-10-14 " }));

      expect(A.map([missing, empty, padded], (error) => error._tag)).toStrictEqual([
        "SchemaError",
        "SchemaError",
        "SchemaError",
      ]);
    })
  );

  it.effect(
    "rejects a verdict outside right, wrong, partly and withdrawn",
    Effect.fnUntraced(function* () {
      const error = yield* Effect.flip(decodeRow({ ...encodedRow, verdict: "maybe" }));

      expect(error._tag).toBe("SchemaError");
    })
  );

  it.effect(
    "rejects a revision below one",
    Effect.fnUntraced(function* () {
      const error = yield* Effect.flip(decodeRow({ ...encodedRow, revision: 0 }));

      expect(error._tag).toBe("SchemaError");
    })
  );
});

describe("@beep/law-practice-domain review envelope properties", () => {
  it.effect.prop(
    "round-trips schema-derived review items",
    { item: Arbitrary.schema(ReviewItem) },
    ({ item }) =>
      Effect.gen(function* () {
        const argument = S.decodeEffect(ReviewItem);
        const encodedItem2 = yield* encodeItem(item);
        const decoded = yield* argument(encodedItem2);

        expect(S.toEquivalence(ReviewItem)(decoded, item)).toBe(true);
      }),
    { arbitrary: fcRuns(25) }
  );

  it.effect.prop(
    "round-trips schema-derived verdict rows",
    { row: Arbitrary.schema(VerdictRow) },
    ({ row }) =>
      Effect.gen(function* () {
        const argument1 = S.decodeEffect(VerdictRow);
        const encodedRow6 = yield* encodeRow(row);
        const decoded = yield* argument1(encodedRow6);

        expect(S.toEquivalence(VerdictRow)(decoded, row)).toBe(true);
      }),
    { arbitrary: fcRuns(50) }
  );
});
