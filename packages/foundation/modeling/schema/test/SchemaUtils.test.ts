import { fcRuns } from "@beep/fc-runs";
import { $SchemaId } from "@beep/identity/packages";
import * as SchemaUtils from "@beep/schema/SchemaUtils/index";
import { alwaysEquivalent, toEquivalence } from "@beep/schema/SchemaUtils/toEquivalence";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import { Effect, pipe } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const isNonEmptyString = S.is(S.NonEmptyString);
const BoolKeySettings = S.Struct({
  visible: SchemaUtils.BoolKeyDefaultFalse,
  enabled: SchemaUtils.BoolKeyDefaultTrue,
});
const decodeBoolKeySettingsEffect = S.decodeUnknownEffect(BoolKeySettings);
const encodeBoolKeySettingsEffect = S.encodeEffect(BoolKeySettings);

describe("BoolKeyDefaultFalse and BoolKeyDefaultTrue", () => {
  it("default omitted constructor input", () => {
    expect(BoolKeySettings.make({})).toEqual({ visible: false, enabled: true });
    expect(BoolKeySettings.make({ visible: true, enabled: false })).toEqual({ visible: true, enabled: false });
  });

  it.effect(
    "default missing keys on decode and encode the decoded booleans",
    Effect.fnUntraced(function* () {
      expect(yield* decodeBoolKeySettingsEffect({})).toEqual({ visible: false, enabled: true });
      expect(yield* decodeBoolKeySettingsEffect({ visible: true })).toEqual({ visible: true, enabled: true });
      expect(yield* encodeBoolKeySettingsEffect({ visible: false, enabled: true })).toEqual({
        visible: false,
        enabled: true,
      });
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

describe("alwaysEquivalent", () => {
  const Failure = S.Struct({
    url: S.String,
    cause: S.Defect({ includeStack: true }).pipe(S.overrideToEquivalence(SchemaUtils.alwaysEquivalent)),
    payload: S.Unknown.pipe(S.overrideToEquivalence(alwaysEquivalent)),
  });
  const sameFailure = S.toEquivalence(Failure);

  it("is exported from the SchemaUtils barrel", () => {
    expect(SchemaUtils.alwaysEquivalent).toBe(alwaysEquivalent);
  });

  it("leaves opaque fields out of the owning schema's identity", () => {
    expect(
      sameFailure(
        { url: "https://example.com", cause: new Error("first"), payload: { id: 1 } },
        { url: "https://example.com", cause: new Error("second"), payload: "other" }
      )
    ).toBe(true);
  });

  it("keeps the declared fields in the owning schema's identity", () => {
    expect(
      sameFailure(
        { url: "https://example.com", cause: new Error("same"), payload: 1 },
        { url: "https://example.org", cause: new Error("same"), payload: 1 }
      )
    ).toBe(false);
  });
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
    pipe(Slug.decodeUnknownOption(""), assertNone);
  });

  it("preserves statics when identity annotations run later in the pipeline", () => {
    const Tagged = S.NonEmptyString.pipe(
      SchemaUtils.withCodecStatics(["decodeUnknownOption", "is"]),
      $SchemaId.annoteSchema("TaggedSlug", { description: "Slug with codec statics." })
    );

    expect(Tagged.is("post")).toBe(true);
    pipe(Tagged.decodeUnknownOption(""), assertNone);
  });
});
