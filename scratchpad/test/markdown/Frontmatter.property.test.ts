import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { FrontmatterFormatMismatchError, FrontmatterDecodeError, FrontmatterEncodeError, FrontmatterMissingReason, FrontmatterMissingError, FrontmatterValidationError, MarkdownFrontmatter } from "../../effected/markdown/Frontmatter.ts";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(name + ": decoding an encoding succeeds and preserves the value", [Arbitrary.schema(schema)], ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(schema)(value);
      const decoded = yield* S.decodeEffect(schema)(encoded);
      assert.isTrue(S.toEquivalence(schema)(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
    }), runs);
};

describe("Frontmatter schema property floor", () => {
  roundTrips("FrontmatterFormatMismatchError", FrontmatterFormatMismatchError);
  roundTrips("FrontmatterDecodeError", FrontmatterDecodeError);
  roundTrips("FrontmatterEncodeError", FrontmatterEncodeError);
  roundTrips("FrontmatterMissingReason", FrontmatterMissingReason);
  roundTrips("FrontmatterMissingError", FrontmatterMissingError);
  roundTrips("FrontmatterValidationError", FrontmatterValidationError);
});

import { JsonFrontmatter } from "../../effected/markdown/JsonFrontmatter.ts";
import { MarkdownDocument } from "../../effected/markdown/MarkdownDocument.ts";
import { MarkdownParseOptions } from "../../effected/markdown/Markdown.ts";
const Meta = S.Struct({ title: S.String, count: S.BigIntFromString });
it.effect.prop("the composed schema codec writes, reads and rewrites typed metadata without touching body bytes", [Arbitrary.schema(Meta), Arbitrary.schema(S.String)], ([value, body]) => Effect.gen(function* () {
  const document = yield* MarkdownDocument.parse(body);
  const write = MarkdownFrontmatter.setToString(Meta, JsonFrontmatter);
  const source = yield* write(document, value);
  assert.isTrue(source.endsWith(body));
  const captured = yield* MarkdownDocument.parse(source, MarkdownParseOptions.make({ frontmatter: true }));
  const decoded = yield* MarkdownFrontmatter.schema(Meta, JsonFrontmatter)(captured);
  assert.isTrue(S.toEquivalence(Meta)(decoded, value));
  assert.strictEqual(yield* write(captured, decoded), source);
}), runs);
