import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertDefined, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { SbomMetadataSource, SbomMetadataOptions, ComponentInput, CopyrightYears } from "../../effected/sbom/SbomMetadataSource.ts";

const runs = { arbitrary: fcRuns(100) };

const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const encode = S.encodeEffect(schema);
  const decode = S.decodeEffect(schema);
  const equivalent = S.toEquivalence(schema);
  it.effect.prop(
    `${name}: decoding an encoded value succeeds and preserves the value`,
    [Arbitrary.schema(schema)],
    ([value]) => Effect.gen(function* () {
      const encoded = yield* encode(value);
      const decoded = yield* decode(encoded);
      assertTrue(equivalent(decoded, value));
      assert.deepStrictEqual(yield* encode(decoded), encoded);
    }),
    runs,
  );
};

describe("SbomMetadataSource property floor", () => {
  roundTrips("SbomMetadataOptions", SbomMetadataOptions);
  roundTrips("ComponentInput", ComponentInput);
  roundTrips("CopyrightYears", CopyrightYears);
});

const PackageCoordinate = S.Struct({ name: S.String, version: S.optionalKey(S.String) });
const wellFormedCoordinate = Arbitrary.schema(PackageCoordinate).pipe(Arbitrary.filter((input) => input.name.isWellFormed()));

it.effect.prop("npm purl rendering preserves namespace/name and version and is stable after parsing", [wellFormedCoordinate], ([input]) => Effect.sync(() => {
  const rendered = SbomMetadataSource.npmPurl(input.name, input.version);
  const match = /^pkg:npm\/([^@]*)(?:@([\s\S]*))?$/u.exec(rendered);
  assertTrue(P.isNotNull(match));
  const path = match[1];
  assertDefined(path);
  const parsedName = A.join(A.map(Str.split("/")(path), decodeURIComponent), "/");
  const parsedVersion = match[2];
  assert.strictEqual(parsedName, input.name);
  assert.strictEqual(parsedVersion, input.version);
  assert.strictEqual(SbomMetadataSource.npmPurl(parsedName, parsedVersion), rendered);
}), runs);

// Copyright text has an unambiguous inverse for nonnegative calendar years;
// the exported CopyrightYears codec separately covers its whole finite domain.
const CopyrightSample = S.Struct({
  holder: S.String,
  year: S.Int.check(S.isBetween({ minimum: 0, maximum: 9999 })),
  startYear: S.optionalKey(S.Int.check(S.isBetween({ minimum: 0, maximum: 9999 }))),
});

it.effect.prop("copyright rendering is faithful and idempotent after parsing", [Arbitrary.schema(CopyrightSample)], ([input]) => Effect.gen(function* () {
  const rendered = SbomMetadataSource.formatCopyright(input.holder, input);
  const match = /^Copyright (\d+)(?:-(\d+))? ([\s\S]*)$/u.exec(rendered);
  assertTrue(P.isNotNull(match));
  const first = match[1];
  const holder = match[3];
  assertDefined(first);
  assertDefined(holder);
  const year = yield* S.decodeEffect(S.FiniteFromString)(match[2] ?? first);
  const startYear = match[2] === undefined ? undefined : yield* S.decodeEffect(S.FiniteFromString)(first);
  assert.strictEqual(holder, input.holder);
  assert.strictEqual(year, input.year);
  assert.strictEqual(startYear, input.startYear === input.year ? undefined : input.startYear);
  const parsed = { year, startYear };
  assert.strictEqual(SbomMetadataSource.formatCopyright(holder, parsed), rendered);
  assert.strictEqual(SbomMetadataSource.formatCopyright(input.holder, input), rendered);
}), runs);
