import { fcRuns } from "@beep/fc-runs";
import { $SchemaId } from "@beep/identity/packages";
import * as SchemaUtils from "@beep/schema/SchemaUtils/index";
import { optional } from "@beep/schema/SchemaUtils/optional";
import { optionalKeyWithDefault } from "@beep/schema/SchemaUtils/optionalKeyWithDefaults";
import { pluck } from "@beep/schema/SchemaUtils/pluck";
import { toEquivalence } from "@beep/schema/SchemaUtils/toEquivalence";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertSome, assertTrue } from "@effect/vitest/utils";
import { Effect, pipe } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const isNonEmptyString = S.is(S.NonEmptyString);
const OptionalKeySettings = S.Struct({ retries: optionalKeyWithDefault(S.FiniteFromString, 3) });
const decodeOptionalKeySettings = S.decodeEffect(OptionalKeySettings);
const encodeOptionalKeySettings = S.encodeEffect(OptionalKeySettings);
const encodeUnknownOptionalKeySettings = S.encodeUnknownEffect(OptionalKeySettings);
const OptionalPatch = S.Struct({ file: optional(S.String) });
const decodeOptionalPatch = S.decodeUnknownEffect(OptionalPatch);
const encodeOptionalPatch = S.encodeEffect(OptionalPatch);

describe("optionalKeyWithDefault", () => {
  it.effect(
    "defaults absent keys while decoding present encoded values",
    Effect.fnUntraced(function* () {
      expect(yield* decodeOptionalKeySettings({})).toEqual({ retries: 3 });
      expect(yield* decodeOptionalKeySettings({ retries: "0" })).toEqual({ retries: 0 });
      pipe(yield* Effect.exit(decodeOptionalKeySettings({ retries: "invalid" })), Exit.isFailure, assertTrue);
    })
  );

  it.effect(
    "encodes decoded values and requires the decoded key",
    Effect.fnUntraced(function* () {
      expect(yield* encodeOptionalKeySettings({ retries: 3 })).toEqual({ retries: "3" });
      pipe(yield* Effect.exit(encodeUnknownOptionalKeySettings({})), Exit.isFailure, assertTrue);
    })
  );
});

describe("pluck", () => {
  it.effect(
    "decodes a one-property struct into the selected field value",
    Effect.fnUntraced(function* () {
      const schema = S.Struct({
        column1: S.FiniteFromString,
        column2: S.String,
      }).pipe(pluck("column1"));

      expect(yield* S.decodeEffect(schema)({ column1: "1" })).toBe(1);
    })
  );

  it.effect(
    "encodes the selected field value back into a one-property struct",
    Effect.fnUntraced(function* () {
      const schema = S.Struct({
        column1: S.FiniteFromString,
        column2: S.String,
      }).pipe(pluck("column1"));

      expect(yield* S.encodeEffect(schema)(2)).toEqual({ column1: "2" });
    })
  );
});

describe("toEquivalence", () => {
  const Tags = S.Array(S.String);

  it("is exported from the SchemaUtils barrel", () => {
    expect(SchemaUtils.toEquivalence).toBe(toEquivalence);
  });

  it("compares decoded schema values with the data-first signature", () => {
    const sameTags = toEquivalence(Tags);

    expect(sameTags(["docs", "tests"], ["docs", "tests"])).toBe(true);
    expect(sameTags(["docs", "tests"], ["tests", "docs"])).toBe(false);
  });

  it("compares decoded schema values with the data-last signature", () => {
    const sameTask = SchemaUtils.toEquivalence(
      S.Struct({
        name: S.String,
        tags: Tags,
      })
    );
    const expected = {
      name: "document toEquivalence",
      tags: ["docs", "tests"],
    };
    const sameAsExpected = sameTask(expected);

    expect(pipe({ name: "document toEquivalence", tags: ["docs", "tests"] }, sameAsExpected)).toBe(true);
    expect(pipe({ name: "document toEquivalence", tags: ["tests", "docs"] }, sameAsExpected)).toBe(false);
  });
});

describe("optional", () => {
  it("is exported from the SchemaUtils barrel", () => {
    expect(SchemaUtils.optional).toBe(optional);
  });

  it.effect(
    "decodes omitted optional keys as undefined",
    Effect.fnUntraced(function* () {
      const decoded = yield* decodeOptionalPatch({});

      expect(decoded.file).toBeUndefined();
    })
  );

  it.effect(
    "decodes present optional keys with the inner schema",
    Effect.fnUntraced(function* () {
      const decoded = yield* decodeOptionalPatch({ file: "src/schema.ts" });

      expect(decoded.file).toBe("src/schema.ts");
    })
  );

  it.effect(
    "omits undefined values when encoding",
    Effect.fnUntraced(function* () {
      expect(yield* encodeOptionalPatch({})).toEqual({});
      expect(yield* encodeOptionalPatch({ file: undefined })).toEqual({});
      expect(yield* encodeOptionalPatch({ file: "src/schema.ts" })).toEqual({ file: "src/schema.ts" });
    })
  );
});

describe("withStatics", () => {
  it("preserves statics when identity annotations run later in the pipeline", () => {
    const TenantName = S.String.pipe(
      SchemaUtils.withStatics((schema) => ({
        empty: "" as const,
        isTenantName: S.is(schema),
      })),
      $SchemaId.annoteSchema("TenantName", {
        description: "Tenant name with helper statics.",
      })
    );

    expect(TenantName.empty).toBe("");
    expect(TenantName.isTenantName("tenant")).toBe(true);
  });
});

describe("withCodecStatics", () => {
  const Slug = S.NonEmptyString.pipe(SchemaUtils.withCodecStatics(["decodeUnknownOption", "decodeUnknownSync", "is"]));

  it.effect.prop(
    "attached statics agree with the raw schema codecs over schema-derived samples",
    [Arbitrary.schema(S.NonEmptyString)],
    Effect.fnUntraced(function* ([sampled]) {
      expect(Slug.is(sampled)).toBe(isNonEmptyString(sampled));
      expect(Slug.decodeUnknownSync(sampled)).toBe(sampled);
      pipe(Slug.decodeUnknownOption(sampled), O.isSome, assertTrue);

      return true;
    }),
    { arbitrary: fcRuns(50) }
  );

  it("attaches a working `is` guard", () => {
    expect(Slug.is("post")).toBe(true);
    expect(Slug.is("")).toBe(false);
    expect(Slug.is(42)).toBe(false);
  });

  it("attaches `fromUnknown` (throws on invalid) and `decodeOption` (None on invalid)", () => {
    expect(Slug.decodeUnknownSync("post")).toBe("post");
    expect(() => Slug.decodeUnknownSync("")).toThrow();
    assertSome(Slug.decodeUnknownOption("post"), "post");
    pipe(Slug.decodeUnknownOption(""), O.isNone, assertTrue);
  });

  it("preserves statics when identity annotations run later in the pipeline", () => {
    const Tagged = S.NonEmptyString.pipe(
      SchemaUtils.withCodecStatics(["decodeUnknownOption", "is"]),
      $SchemaId.annoteSchema("TaggedSlug", { description: "Slug with codec statics." })
    );

    expect(Tagged.is("post")).toBe(true);
    pipe(Tagged.decodeUnknownOption(""), O.isNone, assertTrue);
  });
});
