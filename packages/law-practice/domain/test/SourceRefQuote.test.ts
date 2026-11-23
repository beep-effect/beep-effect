import {
  isCurrentReviewItem,
  isLegacyReviewItemImported,
  LegacyQuoteUnresolved,
  LegacyReviewItemImported,
  LegacySourceLocator,
  ReviewItem,
  SourceRef,
  StoredReviewItem,
} from "@beep/law-practice-domain/values";
import { it } from "@beep/test-runner";
import { QuoteSelector } from "@beep/text/Selector";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const unresolved = LegacyQuoteUnresolved.make({
  reason: "empty-legacy-quote",
  itemId: "kg-answer:1",
  fieldPath: "facts[0].sourceRefs[1].quote",
  exact: "",
  prefix: O.some(""),
  suffix: O.none(),
  locator: LegacySourceLocator.make({ boxFileId: "1234567890", page: O.some(2), crop: O.none() }),
});

const imported = LegacyReviewItemImported.make({
  itemId: "kg-answer:1",
  kind: "kg-answer",
  text: "Synthetic answer",
  raw: { kind: "kg-answer", itemId: "kg-answer:1", text: "Synthetic answer", sourceRefs: [] },
  unresolved: [unresolved],
});

const current = ReviewItem.cases["kg-answer"].make({ itemId: "kg-answer:2", text: "Current answer", sourceRefs: [] });

describe("review-source quotes on the shared selector", () => {
  it.effect.prop(
    "preserves generated selector text and optional context through the SourceRef codec",
    [QuoteSelector],
    ([quote]) =>
      Effect.gen(function* () {
        const ref = SourceRef.make({ boxFileId: "1234567890", quote });
        const encoded = yield* S.encodeEffect(SourceRef)(ref);
        const decoded = yield* S.decodeEffect(SourceRef)(encoded);
        expect(S.toEquivalence(SourceRef)(decoded, ref)).toBe(true);
        expect(encoded.quote._tag).toBe("Quote");
      })
  );

  it.effect("encodes the tagged selector and keeps prefix and suffix omission exactly", () =>
    Effect.gen(function* () {
      const wire = {
        boxFileId: "1234567890",
        page: 3,
        quote: { _tag: "Quote" as const, exact: "claim language", prefix: "before " },
      };
      const ref = yield* S.decodeEffect(SourceRef)(wire);
      const encoded = yield* S.encodeEffect(SourceRef)(ref);
      expect(encoded).toEqual(wire);
      assertSome(ref.quote.prefix, "before ");
      assertNone(ref.quote.suffix);
      assertNone(ref.crop);
    })
  );

  it.effect("refuses an untagged or empty quote at the current boundary", () =>
    Effect.gen(function* () {
      const untagged = yield* Effect.flip(
        S.decodeUnknownEffect(SourceRef)({ boxFileId: "1234567890", quote: { exact: "claim language" } })
      );
      const empty = yield* Effect.flip(
        S.decodeEffect(SourceRef)({ boxFileId: "1234567890", quote: { _tag: "Quote", exact: "" } })
      );
      expect(untagged._tag).toBe("SchemaError");
      expect(empty._tag).toBe("SchemaError");
    })
  );
});

describe("legacy review item imports", () => {
  it.effect("round-trips an unresolved quote with its raw context and locator", () =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(LegacyQuoteUnresolved)(unresolved);
      expect(encoded).toStrictEqual({
        _tag: "LegacyQuoteUnresolved",
        reason: "empty-legacy-quote",
        itemId: "kg-answer:1",
        fieldPath: "facts[0].sourceRefs[1].quote",
        exact: "",
        prefix: "",
        locator: { boxFileId: "1234567890", page: 2 },
      });
      const decoded = yield* S.decodeEffect(LegacyQuoteUnresolved)(encoded);
      expect(S.toEquivalence(LegacyQuoteUnresolved)(decoded, unresolved)).toBe(true);
    })
  );

  it.effect("reads both stored cases and tells them apart", () =>
    Effect.gen(function* () {
      const decodeStored = S.decodeUnknownEffect(StoredReviewItem);
      const encodeStored = S.encodeEffect(StoredReviewItem);
      const importedWire = yield* encodeStored(imported);
      const currentWire = yield* encodeStored(current);
      const importedBack = yield* decodeStored(importedWire);
      const currentBack = yield* decodeStored(currentWire);
      assertTrue(isLegacyReviewItemImported(importedBack));
      assertTrue(isCurrentReviewItem(currentBack));
      expect(isCurrentReviewItem(importedBack)).toBe(false);
      expect(isLegacyReviewItemImported(currentBack)).toBe(false);
    })
  );

  it.effect("refuses an imported item without an unresolved quote", () =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(LegacyReviewItemImported)(imported);
      const error = yield* Effect.flip(S.decodeUnknownEffect(LegacyReviewItemImported)({ ...encoded, unresolved: [] }));
      expect(error._tag).toBe("SchemaError");
    })
  );
});
