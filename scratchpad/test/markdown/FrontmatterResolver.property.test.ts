import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { SchemaDeclarationByUrl, SchemaDeclarationByPath, SchemaDeclarationInline, SchemaDeclarationByName, SchemaDeclaration, SchemaDeclarationInvalidError, SchemaDeclarationMissingError, SchemaNameUnknownError, SchemaVersionUnresolvableError, SchemaResolver } from "../../effected/markdown/FrontmatterResolver.ts";

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

describe("FrontmatterResolver schema property floor", () => {
  roundTrips("SchemaDeclarationByUrl", SchemaDeclarationByUrl);
  roundTrips("SchemaDeclarationByPath", SchemaDeclarationByPath);
  roundTrips("SchemaDeclarationInline", SchemaDeclarationInline);
  roundTrips("SchemaDeclarationByName", SchemaDeclarationByName);
  roundTrips("SchemaDeclaration", SchemaDeclaration);
  roundTrips("SchemaDeclarationInvalidError", SchemaDeclarationInvalidError);
  roundTrips("SchemaDeclarationMissingError", SchemaDeclarationMissingError);
  roundTrips("SchemaNameUnknownError", SchemaNameUnknownError);
  roundTrips("SchemaVersionUnresolvableError", SchemaVersionUnresolvableError);
});

import { assertSuccess } from "@effect/vitest/utils";
const DeclarationSample = S.Struct({
  name: S.String.check(S.isPattern(/^[a-z]{1,12}$/)),
  scoped: S.Boolean,
  segments: S.Array(S.Int.check(S.isBetween({ minimum: 0, maximum: 10000 }))).check(S.isMinLength(1), S.isMaxLength(3)),
  versioned: S.Boolean,
});
it.effect.prop("classifying and reprinting a name declaration is faithful and idempotent, including scoped names and zero padding", [Arbitrary.schema(DeclarationSample)], ([sample]) => Effect.sync(() => {
  const name = sample.scoped ? `@scope/${sample.name}` : sample.name;
  const version = sample.segments.map((segment) => `00${segment}`).join(".");
  const source = sample.versioned ? `${name}@${version}` : name;
  const expected = sample.versioned ? SchemaDeclarationByName.make({ name, version }) : SchemaDeclarationByName.make({ name });
  assertSuccess(SchemaResolver.classify(source), expected);
  assertSuccess(SchemaResolver.declarationOf({ $schema: source }), expected);
  const printed = expected.version === undefined ? expected.name : `${expected.name}@${expected.version}`;
  assert.strictEqual(printed, source);
  assertSuccess(SchemaResolver.classify(printed), expected);
}), runs);
it.effect.prop("URL, path and inline declarations retain the original declaration value on reclassification", [Arbitrary.schema(S.String), Arbitrary.schema(S.Record(S.String, S.Json))], ([suffix, document]) => Effect.sync(() => {
  for (const source of [`https://example.test/${suffix}`, `./${suffix}`, `../${suffix}`, `/${suffix}`]) {
    const expected = source.includes("://") ? SchemaDeclarationByUrl.make({ url: source }) : SchemaDeclarationByPath.make({ path: source });
    assertSuccess(SchemaResolver.classify(source), expected);
    assertSuccess(SchemaResolver.declarationOf({ $schema: source }), expected);
  }
  const expected = SchemaDeclarationInline.make({ document });
  assertSuccess(SchemaResolver.classify(document), expected);
  assertSuccess(SchemaResolver.classify(expected.document), expected);
}), runs);
