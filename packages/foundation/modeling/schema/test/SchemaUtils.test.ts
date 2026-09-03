import { fcRuns } from "@beep/fc-runs";
import { $SchemaId } from "@beep/identity/packages";
import * as Encoders from "@beep/schema/SchemaUtils/encoders";
import * as SchemaUtils from "@beep/schema/SchemaUtils/index";
import { optional } from "@beep/schema/SchemaUtils/optional";
import { pluck } from "@beep/schema/SchemaUtils/pluck";
import { split } from "@beep/schema/SchemaUtils/split";
import { toEquivalence } from "@beep/schema/SchemaUtils/toEquivalence";
import { A } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, pipe } from "effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const isNonEmptyString = S.is(S.NonEmptyString);
const OptionalPatch = S.Struct({ file: optional(S.String) });
const decodeOptionalPatch = S.decodeUnknownEffect(OptionalPatch);
const encodeOptionalPatch = S.encodeEffect(OptionalPatch);
const EmptyArraySettings = S.Struct({
  tags: S.String.pipe(S.Array, SchemaUtils.withEmptyArrayDefaults<string>()),
});
const decodeEmptyArraySettingsSync = S.decodeSync(EmptyArraySettings);
const DataFirstEmptyArrayTags = SchemaUtils.withEmptyArrayDefaults(S.String.pipe(S.Array));
const DataFirstEmptyArraySettings = S.Struct({ tags: DataFirstEmptyArrayTags });
const decodeDataFirstEmptyArraySettingsSync = S.decodeSync(DataFirstEmptyArraySettings);
const OptionalLabelNode = S.Struct({
  label: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
});
const decodeOptionalLabelNodeSync = S.decodeSync(OptionalLabelNode);
const NullableDirectionNode = S.Struct({
  direction: S.OptionFromNullOr(S.String).pipe(SchemaUtils.withNoneDefault),
});
const ConstantDefaultsNode = S.Struct({
  version: S.Literal(1).pipe(SchemaUtils.withConstantDefault(1)),
  format: S.Literals(["", "left", "center"]).pipe(SchemaUtils.withConstantDefault<"" | "left" | "center">("")),
});
const RequiredVersionNode = S.Struct({
  version: S.Literal(1).pipe(SchemaUtils.withConstantDefault(1)),
});
const decodeRequiredVersionNodeSync = S.decodeSync(RequiredVersionNode);
const decodeUnknownRequiredVersionNodeSync = S.decodeUnknownSync(RequiredVersionNode);

describe("pluck", () => {
  it("decodes a one-property struct into the selected field value", () => {
    const schema = S.Struct({
      column1: S.FiniteFromString,
      column2: S.String,
    }).pipe(pluck("column1"));

    expect(S.decodeSync(schema)({ column1: "1" })).toBe(1);
  });

  it("encodes the selected field value back into a one-property struct", () => {
    const schema = S.Struct({
      column1: S.FiniteFromString,
      column2: S.String,
    }).pipe(pluck("column1"));

    expect(S.encodeSync(schema)(2)).toEqual({ column1: "2" });
  });
});

describe("encoding adapters", () => {
  const NumberFromString = S.FiniteFromString;
  const Struct = S.Struct({ value: S.String });
  const inputWithExcessProperty = { value: "ok", extra: true };
  const creationOptions = { onExcessProperty: "error" } as const;
  const applicationOptions = { onExcessProperty: "ignore" } as const;

  it.effect(
    "encodes through Effect and Promise adapters",
    Effect.fnUntraced(function* () {
      expect(yield* Encoders.encodeEffect(NumberFromString)(42)).toBe("42");
      expect(yield* Encoders.encodeUnknownEffect(NumberFromString)(42)).toBe("42");
      expect(yield* Effect.tryPromise(() => Encoders.encodePromise(NumberFromString)(42))).toBe("42");
      expect(yield* Effect.tryPromise(() => Encoders.encodeUnknownPromise(NumberFromString)(42))).toBe("42");
    })
  );

  it("encodes through Exit, Option, Result, and synchronous adapters", () => {
    expect(Exit.isSuccess(Encoders.encodeExit(NumberFromString)(42))).toBe(true);
    expect(Exit.isSuccess(Encoders.encodeUnknownExit(NumberFromString)(42))).toBe(true);
    expect(O.isSome(Encoders.encodeOption(NumberFromString)(42))).toBe(true);
    expect(O.isSome(Encoders.encodeUnknownOption(NumberFromString)(42))).toBe(true);
    expect(Result.isSuccess(Encoders.encodeResult(NumberFromString)(42))).toBe(true);
    expect(Result.isSuccess(Encoders.encodeUnknownResult(NumberFromString)(42))).toBe(true);
    expect(Encoders.encodeSync(NumberFromString)(42)).toBe("42");
    expect(Encoders.encodeUnknownSync(NumberFromString)(42)).toBe("42");
  });

  it.effect(
    "forwards application options through Effect and Promise adapters",
    Effect.fnUntraced(function* () {
      expect(
        yield* Encoders.encodeEffect(Struct, creationOptions)(inputWithExcessProperty, applicationOptions)
      ).toEqual({
        value: "ok",
      });
      expect(
        yield* Encoders.encodeUnknownEffect(Struct, creationOptions)(inputWithExcessProperty, applicationOptions)
      ).toEqual({ value: "ok" });
      expect(
        yield* Effect.tryPromise(() =>
          Encoders.encodePromise(Struct, creationOptions)(inputWithExcessProperty, applicationOptions)
        )
      ).toEqual({ value: "ok" });
      expect(
        yield* Effect.tryPromise(() =>
          Encoders.encodeUnknownPromise(Struct, creationOptions)(inputWithExcessProperty, applicationOptions)
        )
      ).toEqual({ value: "ok" });
    })
  );

  it("forwards application options through synchronous adapters", () => {
    expect(
      Exit.isSuccess(Encoders.encodeExit(Struct, creationOptions)(inputWithExcessProperty, applicationOptions))
    ).toBe(true);
    expect(
      Exit.isSuccess(Encoders.encodeUnknownExit(Struct, creationOptions)(inputWithExcessProperty, applicationOptions))
    ).toBe(true);
    expect(O.isSome(Encoders.encodeOption(Struct, creationOptions)(inputWithExcessProperty, applicationOptions))).toBe(
      true
    );
    expect(
      O.isSome(Encoders.encodeUnknownOption(Struct, creationOptions)(inputWithExcessProperty, applicationOptions))
    ).toBe(true);
    expect(
      Result.isSuccess(Encoders.encodeResult(Struct, creationOptions)(inputWithExcessProperty, applicationOptions))
    ).toBe(true);
    expect(
      Result.isSuccess(
        Encoders.encodeUnknownResult(Struct, creationOptions)(inputWithExcessProperty, applicationOptions)
      )
    ).toBe(true);
    expect(Encoders.encodeSync(Struct, creationOptions)(inputWithExcessProperty, applicationOptions)).toEqual({
      value: "ok",
    });
    expect(Encoders.encodeUnknownSync(Struct, creationOptions)(inputWithExcessProperty, applicationOptions)).toEqual({
      value: "ok",
    });
  });

  it("exports the encoding adapters from the SchemaUtils barrel", () => {
    expect(SchemaUtils.encodeEffect).toBe(Encoders.encodeEffect);
    expect(SchemaUtils.encodeSync).toBe(Encoders.encodeSync);
  });
});

describe("split", () => {
  it("decodes delimited strings into readonly string arrays", () => {
    const schema = split(",");

    expect(S.decodeSync(schema)("red,green,blue")).toEqual(["red", "green", "blue"]);
  });

  it("encodes readonly string arrays back into delimited strings", () => {
    const schema = split(",");

    expect(S.encodeSync(schema)(["red", "green", "blue"])).toBe("red,green,blue");
  });

  it("preserves empty segments instead of normalizing them away", () => {
    const schema = split(",");

    expect(S.decodeSync(schema)("red,,blue")).toEqual(["red", "", "blue"]);
    expect(S.encodeSync(schema)(["red", "", "blue"])).toBe("red,,blue");
  });
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

describe("withEmptyArrayDefaults", () => {
  it("defaults missing array fields to an empty readonly array", () => {
    expect(A.isReadonlyArrayEmpty(decodeEmptyArraySettingsSync({}).tags)).toBe(true);
  });

  it("supports the data-first call style", () => {
    expect(A.isReadonlyArrayEmpty(decodeDataFirstEmptyArraySettingsSync({ tags: undefined }).tags)).toBe(true);
  });
});

describe("withNoneDefault", () => {
  it("defaults an omitted optional-key Option field to None at construction time", () => {
    expect(O.isNone(OptionalLabelNode.make({}).label)).toBe(true);
    expect(OptionalLabelNode.make({ label: O.some("x") }).label).toStrictEqual(O.some("x"));
  });

  it("defaults an omitted nullable Option field to None at construction time", () => {
    expect(O.isNone(NullableDirectionNode.make({}).direction)).toBe(true);
  });

  it("leaves the decode contract intact (missing optional key still decodes to None)", () => {
    expect(O.isNone(decodeOptionalLabelNodeSync({}).label)).toBe(true);
    expect(decodeOptionalLabelNodeSync({ label: "x" }).label).toStrictEqual(O.some("x"));
  });
});

describe("withConstantDefault", () => {
  it("defaults an omitted field to the constant at construction time", () => {
    const made = ConstantDefaultsNode.make({});

    expect(made.version).toBe(1);
    expect(made.format).toBe("");
  });

  it("leaves the encoded contract required (the key is still mandatory on decode)", () => {
    expect(() => decodeUnknownRequiredVersionNodeSync({})).toThrow();
    expect(decodeRequiredVersionNodeSync({ version: 1 }).version).toBe(1);
  });
});

describe("withCodecStatics", () => {
  const Slug = S.NonEmptyString.pipe(SchemaUtils.withCodecStatics(["decodeUnknownOption", "decodeUnknownSync", "is"]));

  it("attached statics agree with the raw schema codecs over schema-derived samples", () => {
    fc.assert(
      fc.property(S.toArbitrary(S.NonEmptyString)(fc), (sampled) => {
        expect(Slug.is(sampled)).toBe(isNonEmptyString(sampled));
        expect(Slug.decodeUnknownSync(sampled)).toBe(sampled);
        expect(O.isSome(Slug.decodeUnknownOption(sampled))).toBe(true);
      }),
      fcRuns(50)
    );
  });

  it("attaches a working `is` guard", () => {
    expect(Slug.is("post")).toBe(true);
    expect(Slug.is("")).toBe(false);
    expect(Slug.is(42)).toBe(false);
  });

  it("attaches `fromUnknown` (throws on invalid) and `decodeOption` (None on invalid)", () => {
    expect(Slug.decodeUnknownSync("post")).toBe("post");
    expect(() => Slug.decodeUnknownSync("")).toThrow();
    expect(Slug.decodeUnknownOption("post")).toStrictEqual(O.some("post"));
    expect(O.isNone(Slug.decodeUnknownOption(""))).toBe(true);
  });

  it("preserves statics when identity annotations run later in the pipeline", () => {
    const Tagged = S.NonEmptyString.pipe(
      SchemaUtils.withCodecStatics(["decodeUnknownOption", "is"]),
      $SchemaId.annoteSchema("TaggedSlug", { description: "Slug with codec statics." })
    );

    expect(Tagged.is("post")).toBe(true);
    expect(O.isNone(Tagged.decodeUnknownOption(""))).toBe(true);
  });
});
