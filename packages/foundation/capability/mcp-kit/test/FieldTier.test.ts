import {
  ColumnarEnvelope,
  defineFieldTiers,
  estimateJsonSize,
  FetchableHandle,
  FieldProjectionOutcome,
  projectFieldTier,
  projectWithinBudget,
  toColumnarEnvelope,
} from "@beep/mcp-kit";
import { NonNegativeInt } from "@beep/schema";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { assert, describe } from "@effect/vitest";
import { Effect } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as S from "effect/Schema";

const documentTiers = defineFieldTiers({
  balanced: S.Struct({ abstractText: S.String, documentId: S.String, title: S.String }),
  complete: S.Struct({
    abstractText: S.String,
    documentBag: S.Array(S.String),
    documentId: S.String,
    title: S.String,
  }),
  minimal: S.Struct({ documentId: S.String, title: S.String }),
});

const documentBagFixture = Array.from({ length: 500 }, (_, index) => `document-page-content-${index}`.repeat(20));

const largeDocumentBagPayload: Record<string, unknown> = {
  abstractText: "A".repeat(2000),
  documentBag: documentBagFixture,
  documentId: "US-12345678-A1",
  title: "Fixture Patent Title",
};

const assertSchemaRoundTrip = Effect.fnUntraced(function* <Schema extends S.Codec<unknown, unknown, never, never>>(
  schema: Schema,
  value: Schema["Type"]
) {
  const encoded = yield* S.encodeEffect(schema)(value);
  const decoded = yield* S.decodeUnknownEffect(schema)(encoded);
  assert.isTrue(S.toEquivalence(schema)(decoded, value));
});

const mintFetchableHandle = (oversized: { readonly sizeBytes: number }): FetchableHandle =>
  FetchableHandle.make({
    handleId: "5b1d6a3e-8f3e-4a1a-9c1e-2e6b7a2f9c10",
    expiresAt: "2026-07-01T01:00:00.000Z",
    sizeBytes: NonNegativeInt.make(oversized.sizeBytes),
    tier: "minimal",
  });

describe("field-tier projector", () => {
  it("names minimal/balanced/complete as actual Schema.Struct variants", () => {
    assert.deepStrictEqual(Object.keys(documentTiers.minimal.fields).sort(), ["documentId", "title"]);
    assert.isTrue(S.isSchema(documentTiers.minimal));
    assert.isTrue(S.isSchema(documentTiers.balanced));
    assert.isTrue(S.isSchema(documentTiers.complete));
  });

  it("reduces a large documentBag-shaped fixture payload below a configured size budget", () => {
    const budgetBytes = NonNegativeInt.make(500);
    const fullSize = estimateJsonSize(largeDocumentBagPayload);

    assert.isAbove(fullSize, budgetBytes);

    const projected = projectWithinBudget(largeDocumentBagPayload, {
      tiers: documentTiers,
      budgetBytes,
      mintFetchableHandle,
    });

    assert.strictEqual(projected._tag, "Inline");
    if (projected._tag === "Inline") {
      assert.strictEqual(projected.tier, "minimal");
      assert.isAtMost(estimateJsonSize(projected.value), budgetBytes);
      assert.notProperty(projected.value, "documentBag");
      assert.deepStrictEqual(projected.value, {
        documentId: largeDocumentBagPayload.documentId,
        title: largeDocumentBagPayload.title,
      });
    }
  });

  it("projects a single named tier's field set", () => {
    const projected = projectFieldTier(largeDocumentBagPayload, "balanced", documentTiers);

    assert.deepStrictEqual(Object.keys(projected).sort(), ["abstractText", "documentId", "title"]);
    assert.deepStrictEqual(projected, {
      abstractText: largeDocumentBagPayload.abstractText,
      documentId: largeDocumentBagPayload.documentId,
      title: largeDocumentBagPayload.title,
    });
  });

  it("never returns an oversized payload inline when even the minimal tier exceeds the budget", () => {
    const minimalProjectedSize = estimateJsonSize(projectFieldTier(largeDocumentBagPayload, "minimal", documentTiers));
    const impossibleBudgetBytes = NonNegativeInt.make(1);

    assert.isAbove(minimalProjectedSize, impossibleBudgetBytes);

    const projected = projectWithinBudget(largeDocumentBagPayload, {
      tiers: documentTiers,
      budgetBytes: impossibleBudgetBytes,
      mintFetchableHandle,
    });

    assert.strictEqual(projected._tag, "Fetchable");
    if (projected._tag === "Fetchable") {
      assert.isTrue(FetchableHandle.is(projected.handle));
      assert.strictEqual(projected.handle.tier, "minimal");
    }
    assert.notProperty(projected, "value");
  });

  it.effect.prop(
    "round-trips FetchableHandle through its encoded shape",
    [Arbitrary.schema(FetchableHandle)],
    Effect.fnUntraced(function* ([value]) {
      yield* assertSchemaRoundTrip(FetchableHandle, value);
    }),
    { arbitrary: fcRuns(50) }
  );

  it.effect.prop(
    "round-trips FieldProjectionOutcome through its encoded shape",
    [Arbitrary.schema(FieldProjectionOutcome)],
    Effect.fnUntraced(function* ([value]) {
      yield* assertSchemaRoundTrip(FieldProjectionOutcome, value);
    }),
    { arbitrary: fcRuns(50) }
  );
});

describe("toColumnarEnvelope", () => {
  it("unions column keys across all rows and never drops sparse fields", () => {
    const envelope = toColumnarEnvelope([{ title: "A" }, { id: "2", title: "B" }]);

    assert.deepStrictEqual(envelope.columns, ["title", "id"]);
    assert.deepStrictEqual(envelope.rows, [
      ["A", null],
      ["B", "2"],
    ]);
    assert.deepStrictEqual(ColumnarEnvelope.fromRows([{ title: "A" }, { id: "2", title: "B" }]), envelope);
  });

  it.effect.prop(
    "round-trips the columnar envelope schema",
    [Arbitrary.schema(ColumnarEnvelope)],
    Effect.fnUntraced(function* ([value]) {
      yield* assertSchemaRoundTrip(ColumnarEnvelope, value);
    }),
    { arbitrary: fcRuns(50) }
  );
});
