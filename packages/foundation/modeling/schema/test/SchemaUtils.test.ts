import { fcRuns } from "@beep/fc-runs";
import { $SchemaId } from "@beep/identity/packages";
import * as Encoders from "@beep/schema/SchemaUtils/encoders";
import * as SchemaUtils from "@beep/schema/SchemaUtils/index";
import { optional } from "@beep/schema/SchemaUtils/optional";
import { optionalKeyWithDefault } from "@beep/schema/SchemaUtils/optionalKeyWithDefaults";
import { pluck } from "@beep/schema/SchemaUtils/pluck";
import { split } from "@beep/schema/SchemaUtils/split";
import { toEquivalence } from "@beep/schema/SchemaUtils/toEquivalence";
import { it } from "@beep/test-runner";
import { A } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import { assertExitSuccess, assertSome, assertSuccess, assertTrue } from "@effect/vitest/utils";
import { Effect, pipe } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const isNonEmptyString = S.is(S.NonEmptyString);
const OptionalKeySettings = S.Struct({ retries: optionalKeyWithDefault(S.FiniteFromString, 3) });
const decodeOptionalKeySettings = S.decodeEffect(OptionalKeySettings);
const encodeOptionalKeySettings = S.encodeEffect(OptionalKeySettings);
const encodeUnknownOptionalKeySettings = S.encodeUnknownEffect(OptionalKeySettings);
const OptionalPatch = S.Struct({ file: optional(S.String) });
const decodeOptionalPatch = S.decodeUnknownEffect(OptionalPatch);
const encodeOptionalPatch = S.encodeEffect(OptionalPatch);
const EmptyArraySettings = S.Struct({
  tags: S.String.pipe(S.Array, SchemaUtils.withEmptyArrayDefaults<string>()),
});
const decodeEmptyArraySettingsEffect = S.decodeEffect(EmptyArraySettings);
const DataFirstEmptyArrayTags = SchemaUtils.withEmptyArrayDefaults(S.String.pipe(S.Array));
const DataFirstEmptyArraySettings = S.Struct({ tags: DataFirstEmptyArrayTags });
const decodeDataFirstEmptyArraySettingsEffect = S.decodeEffect(DataFirstEmptyArraySettings);
const OptionalLabelNode = S.Struct({
  label: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
});
const decodeOptionalLabelNodeEffect = S.decodeEffect(OptionalLabelNode);
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
const decodeRequiredVersionNodeEffect = S.decodeEffect(RequiredVersionNode);
const decodeUnknownRequiredVersionNodeEffect = S.decodeUnknownEffect(RequiredVersionNode);

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
    assertExitSuccess(Encoders.encodeExit(NumberFromString)(42), "42");
    assertExitSuccess(Encoders.encodeUnknownExit(NumberFromString)(42), "42");
    assertSome(Encoders.encodeOption(NumberFromString)(42), "42");
    assertSome(Encoders.encodeUnknownOption(NumberFromString)(42), "42");
    assertSuccess(Encoders.encodeResult(NumberFromString)(42), "42");
    assertSuccess(Encoders.encodeUnknownResult(NumberFromString)(42), "42");
    const encoded = Encoders.encodeResult(NumberFromString)(42);
    pipe(encoded, Result.isSuccess, assertTrue);
    if (Result.isSuccess(encoded)) {
      expect(encoded.success).toBe("42");
    }
    const encodedUnknown = Encoders.encodeUnknownResult(NumberFromString)(42);
    pipe(encodedUnknown, Result.isSuccess, assertTrue);
    if (Result.isSuccess(encodedUnknown)) {
      expect(encodedUnknown.success).toBe("42");
    }
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
    assertExitSuccess(Encoders.encodeExit(Struct, creationOptions)(inputWithExcessProperty, applicationOptions), {
      value: "ok",
    });
    assertExitSuccess(
      Encoders.encodeUnknownExit(Struct, creationOptions)(inputWithExcessProperty, applicationOptions),
      { value: "ok" }
    );
    assertSome(Encoders.encodeOption(Struct, creationOptions)(inputWithExcessProperty, applicationOptions), {
      value: "ok",
    });
    assertSome(Encoders.encodeUnknownOption(Struct, creationOptions)(inputWithExcessProperty, applicationOptions), {
      value: "ok",
    });
    assertSuccess(Encoders.encodeResult(Struct, creationOptions)(inputWithExcessProperty, applicationOptions), {
      value: "ok",
    });
    assertSuccess(Encoders.encodeUnknownResult(Struct, creationOptions)(inputWithExcessProperty, applicationOptions), {
      value: "ok",
    });
    const encoded = Encoders.encodeResult(Struct, creationOptions)(inputWithExcessProperty, applicationOptions);
    pipe(encoded, Result.isSuccess, assertTrue);
    if (Result.isSuccess(encoded)) {
      expect(encoded.success).toEqual({
        value: "ok",
      });
    }
    const encodedUnknown = Encoders.encodeUnknownResult(Struct, creationOptions)(
      inputWithExcessProperty,
      applicationOptions
    );
    pipe(encodedUnknown, Result.isSuccess, assertTrue);
    if (Result.isSuccess(encodedUnknown)) {
      expect(encodedUnknown.success).toEqual({
        value: "ok",
      });
    }
  });

  it("exports the encoding adapters from the SchemaUtils barrel", () => {
    expect(SchemaUtils.encodeEffect).toBe(Encoders.encodeEffect);
    expect(SchemaUtils.encodeResult).toBe(Encoders.encodeResult);
  });
});

describe("split", () => {
  it.effect(
    "decodes delimited strings into readonly string arrays",
    Effect.fnUntraced(function* () {
      const schema = split(",");

      expect(yield* S.decodeEffect(schema)("red,green,blue")).toEqual(["red", "green", "blue"]);
    })
  );

  it.effect(
    "encodes readonly string arrays back into delimited strings",
    Effect.fnUntraced(function* () {
      const schema = split(",");

      expect(yield* S.encodeEffect(schema)(["red", "green", "blue"])).toBe("red,green,blue");
    })
  );

  it.effect(
    "preserves empty segments instead of normalizing them away",
    Effect.fnUntraced(function* () {
      const schema = split(",");

      expect(yield* S.decodeEffect(schema)("red,,blue")).toEqual(["red", "", "blue"]);
      expect(yield* S.encodeEffect(schema)(["red", "", "blue"])).toBe("red,,blue");
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

describe("withEmptyArrayDefaults", () => {
  it.effect(
    "defaults missing array fields to an empty readonly array",
    Effect.fnUntraced(function* () {
      expect(A.isReadonlyArrayEmpty((yield* decodeEmptyArraySettingsEffect({})).tags)).toBe(true);
    })
  );

  it.effect(
    "supports the data-first call style",
    Effect.fnUntraced(function* () {
      expect(A.isReadonlyArrayEmpty((yield* decodeDataFirstEmptyArraySettingsEffect({ tags: undefined })).tags)).toBe(
        true
      );
    })
  );
});

describe("withNoneDefault", () => {
  it("defaults an omitted optional-key Option field to None at construction time", () => {
    pipe(OptionalLabelNode.make({}).label, O.isNone, assertTrue);
    assertSome(OptionalLabelNode.make({ label: O.some("x") }).label, "x");
  });

  it("defaults an omitted nullable Option field to None at construction time", () => {
    pipe(NullableDirectionNode.make({}).direction, O.isNone, assertTrue);
  });

  it.effect(
    "leaves the decode contract intact (missing optional key still decodes to None)",
    Effect.fnUntraced(function* () {
      pipe((yield* decodeOptionalLabelNodeEffect({})).label, O.isNone, assertTrue);
      assertSome((yield* decodeOptionalLabelNodeEffect({ label: "x" })).label, "x");
    })
  );
});

describe("withConstantDefault", () => {
  it("defaults an omitted field to the constant at construction time", () => {
    const made = ConstantDefaultsNode.make({});

    expect(made.version).toBe(1);
    expect(made.format).toBe("");
  });

  it.effect(
    "leaves the encoded contract required (the key is still mandatory on decode)",
    Effect.fnUntraced(function* () {
      const failure1 = yield* Effect.exit(decodeUnknownRequiredVersionNodeEffect({}));
      pipe(failure1, Exit.hasFails, assertTrue);
      expect((yield* decodeRequiredVersionNodeEffect({ version: 1 })).version).toBe(1);
    })
  );
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
