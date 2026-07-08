import { fcRuns } from "@beep/fc-runs";
import { $SchemaId } from "@beep/identity/packages";
import * as SchemaUtils from "@beep/schema/SchemaUtils/index";
import { optional } from "@beep/schema/SchemaUtils/optional";
import { pluck } from "@beep/schema/SchemaUtils/pluck";
import { split } from "@beep/schema/SchemaUtils/split";
import { toEquivalence } from "@beep/schema/SchemaUtils/toEquivalence";
import { A } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

describe("pluck", () => {
  it("decodes a one-property struct into the selected field value", () => {
    const schema = S.Struct({
      column1: S.FiniteFromString,
      column2: S.String,
    }).pipe(pluck("column1"));

    expect(S.decodeUnknownSync(schema)({ column1: "1" })).toBe(1);
  });

  it("encodes the selected field value back into a one-property struct", () => {
    const schema = S.Struct({
      column1: S.FiniteFromString,
      column2: S.String,
    }).pipe(pluck("column1"));

    expect(S.encodeSync(schema)(2)).toEqual({ column1: "2" });
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
  const Patch = S.Struct({
    file: optional(S.String),
  });
  const decode = S.decodeUnknownEffect(Patch);
  const encode = S.encodeEffect(Patch);

  it("is exported from the SchemaUtils barrel", () => {
    expect(SchemaUtils.optional).toBe(optional);
  });

  it.effect(
    "decodes omitted optional keys as undefined",
    Effect.fnUntraced(function* () {
      const decoded = yield* decode({});

      expect(decoded.file).toBeUndefined();
    })
  );

  it.effect(
    "decodes present optional keys with the inner schema",
    Effect.fnUntraced(function* () {
      const decoded = yield* decode({ file: "src/schema.ts" });

      expect(decoded.file).toBe("src/schema.ts");
    })
  );

  it.effect(
    "omits undefined values when encoding",
    Effect.fnUntraced(function* () {
      expect(yield* encode({})).toEqual({});
      expect(yield* encode({ file: undefined })).toEqual({});
      expect(yield* encode({ file: "src/schema.ts" })).toEqual({ file: "src/schema.ts" });
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
    const Settings = S.Struct({
      tags: S.String.pipe(S.Array, SchemaUtils.withEmptyArrayDefaults<string>()),
    });

    expect(A.isReadonlyArrayEmpty(S.decodeUnknownSync(Settings)({}).tags)).toBe(true);
  });

  it("supports the data-first call style", () => {
    const Tags = SchemaUtils.withEmptyArrayDefaults(S.String.pipe(S.Array));
    const Settings = S.Struct({ tags: Tags });

    expect(A.isReadonlyArrayEmpty(S.decodeUnknownSync(Settings)({ tags: undefined }).tags)).toBe(true);
  });
});

describe("withNoneDefault", () => {
  it("defaults an omitted optional-key Option field to None at construction time", () => {
    const Node = S.Struct({
      label: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    });

    expect(O.isNone(Node.make({}).label)).toBe(true);
    expect(Node.make({ label: O.some("x") }).label).toStrictEqual(O.some("x"));
  });

  it("defaults an omitted nullable Option field to None at construction time", () => {
    const Node = S.Struct({
      direction: S.OptionFromNullOr(S.String).pipe(SchemaUtils.withNoneDefault),
    });

    expect(O.isNone(Node.make({}).direction)).toBe(true);
  });

  it("leaves the decode contract intact (missing optional key still decodes to None)", () => {
    const Node = S.Struct({
      label: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    });

    expect(O.isNone(S.decodeUnknownSync(Node)({}).label)).toBe(true);
    expect(S.decodeUnknownSync(Node)({ label: "x" }).label).toStrictEqual(O.some("x"));
  });
});

describe("withConstantDefault", () => {
  it("defaults an omitted field to the constant at construction time", () => {
    const Node = S.Struct({
      version: S.Literal(1).pipe(SchemaUtils.withConstantDefault(1)),
      // Union-typed field: annotate the make-input so the default is not inferred
      // narrower than the field's literal union (mirrors branded-field usage).
      format: S.Literals(["", "left", "center"]).pipe(SchemaUtils.withConstantDefault<"" | "left" | "center">("")),
    });

    const made = Node.make({});

    expect(made.version).toBe(1);
    expect(made.format).toBe("");
  });

  it("leaves the encoded contract required (the key is still mandatory on decode)", () => {
    const Node = S.Struct({
      version: S.Literal(1).pipe(SchemaUtils.withConstantDefault(1)),
    });

    expect(() => S.decodeUnknownSync(Node)({})).toThrow();
    expect(S.decodeUnknownSync(Node)({ version: 1 }).version).toBe(1);
  });
});

describe("withCodecStatics", () => {
  const Slug = S.NonEmptyString.pipe(SchemaUtils.withCodecStatics);

  it("attached statics agree with the raw schema codecs over schema-derived samples", () => {
    fc.assert(
      fc.property(S.toArbitrary(S.NonEmptyString), (sampled) => {
        expect(Slug.is(sampled)).toBe(S.is(S.NonEmptyString)(sampled));
        expect(Slug.fromUnknown(sampled)).toBe(sampled);
        expect(O.isSome(Slug.decodeOption(sampled))).toBe(true);
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
    expect(Slug.fromUnknown("post")).toBe("post");
    expect(() => Slug.fromUnknown("")).toThrow();
    expect(Slug.decodeOption("post")).toStrictEqual(O.some("post"));
    expect(O.isNone(Slug.decodeOption(""))).toBe(true);
  });

  it("preserves statics when identity annotations run later in the pipeline", () => {
    const Tagged = S.NonEmptyString.pipe(
      SchemaUtils.withCodecStatics,
      $SchemaId.annoteSchema("TaggedSlug", { description: "Slug with codec statics." })
    );

    expect(Tagged.is("post")).toBe(true);
    expect(O.isNone(Tagged.decodeOption(""))).toBe(true);
  });
});
