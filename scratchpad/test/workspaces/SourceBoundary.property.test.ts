import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { ReferenceOptions, ScanOptions, BoundaryRule, BoundaryFixture, OffenceRule, Offence, SourceScan, SourceBoundary } from "../../effected/workspaces/SourceBoundary.ts";

import { LexedSource, SourceLiteral } from "../../effected/workspaces/internal/sourceText.ts";

const QuotedString = S.String.pipe(S.fromJsonString);

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const equivalent = S.toEquivalence(schema);
  it.effect.prop(`${name}: encoded values decode successfully to the original value`, [Arbitrary.schema(schema)],
    ([value]) => Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(schema)(value);
      const decoded = yield* S.decodeEffect(schema)(encoded);
      assert.isTrue(equivalent(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
    }), runs);
};

describe("SourceBoundary schema laws", () => {
  roundTrips("ReferenceOptions", ReferenceOptions);
  roundTrips("ScanOptions", ScanOptions);
  roundTrips("SourceLiteral", SourceLiteral);
  roundTrips("LexedSource", LexedSource);
  roundTrips("BoundaryRule", BoundaryRule);
  roundTrips("BoundaryFixture", BoundaryFixture);
  roundTrips("OffenceRule", OffenceRule);
  roundTrips("Offence", Offence);
  roundTrips("SourceScan", SourceScan);
});

it.effect.prop("comment stripping is idempotent and preserves offsets on arbitrary source",
  [Arbitrary.schema(S.String)], ([text]) => Effect.sync(() => {
    const stripped = SourceBoundary.stripComments(text);
    assert.strictEqual(SourceBoundary.stripComments(stripped), stripped);
    assert.strictEqual(stripped.length, text.length);
    assert.deepStrictEqual(SourceBoundary.importSpecifiers(stripped), SourceBoundary.importSpecifiers(text));
  }), runs);
it.effect.prop("import parsing preserves cooked specifiers through stringification and comment stripping",
  [Arbitrary.schema(S.String.pipe(S.Array))], ([specifiers]) => Effect.gen(function* () {
    const quote = S.encodeEffect(QuotedString);
    const quoted = yield* Effect.forEach(specifiers, (value) => quote(value));
    const text = quoted.map((specifier) => `import ${specifier}; /* comment */`).join("\n");
    const parsed = SourceBoundary.importSpecifiers(text);
    assert.deepStrictEqual(parsed, specifiers);
    const requoted = yield* Effect.forEach(parsed, (value) => quote(value));
    const rendered = requoted.map((specifier) => `import ${specifier};`).join("\n");
    assert.deepStrictEqual(SourceBoundary.importSpecifiers(rendered), parsed);
    assert.deepStrictEqual(SourceBoundary.importSpecifiers(SourceBoundary.stripComments(text)), parsed);
  }), runs);
