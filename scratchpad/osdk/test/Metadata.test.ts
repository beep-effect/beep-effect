import { fcRuns } from "@beep/test-utils";
import { describe, it } from "@effect/vitest";
import { assertFalse, assertInclude, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { BlueprintIcon, Icon, ReleaseStatus, TypeClass, Visibility } from "../src/Metadata/index.ts";

// -----------------------------------------------------------------------------
// Law and fixture helpers
// -----------------------------------------------------------------------------

/** Laws every named schema obeys: generated values are valid, and the wire form loses nothing. */
const lawsOf = <A, I>(name: string, schema: S.Codec<A, I>) => {
  const arbitrary = Arbitrary.schema(schema);
  const isValid = S.is(schema);
  const isEquivalent = S.toEquivalence(schema);
  const encode = S.encodeEffect(schema);
  const decode = S.decodeEffect(schema);
  describe(`${name} laws`, () => {
    it.prop("generated values satisfy the guard", [arbitrary], ([value]) => isValid(value), {
      arbitrary: fcRuns(50),
    });
    it.effect.prop(
      "encoding then decoding gives an equivalent value",
      [arbitrary],
      Effect.fnUntraced(function* ([value]) {
        const encoded = yield* encode(value);
        const decoded = yield* decode(encoded);
        assertTrue(isEquivalent(decoded, value));
      }),
      { arbitrary: fcRuns(50) }
    );
  });
};

/** Decodes an exact wire value to the expected domain value and encodes it back to the same wire value. */
const wireFixture = <A, I>(name: string, schema: S.Codec<A, I>, wire: NoInfer<I>, expected: NoInfer<A>) =>
  it.effect(
    name,
    Effect.fnUntraced(function* () {
      const decoded = yield* S.decodeEffect(schema)(wire);
      deepStrictEqual(decoded, expected);
      assertTrue(S.toEquivalence(schema)(decoded, expected));
      const encoded = yield* S.encodeEffect(schema)(decoded);
      deepStrictEqual(encoded, wire);
    })
  );

/** Pins both sides of a mapped literal domain and checks the codec follows the table in both directions. */
const literalDomain = <A extends string, I extends string>(
  name: string,
  kit: S.Codec<A, I> & { readonly Pairs: ReadonlyArray<readonly [I, A]> },
  pairs: ReadonlyArray<readonly [NoInfer<I>, NoInfer<A>]>
) =>
  it.effect(
    `${name} maps every wire literal to its domain literal and back`,
    Effect.fnUntraced(function* () {
      const decode = S.decodeEffect(kit);
      const encode = S.encodeEffect(kit);
      const wireLiterals = A.map(pairs, ([wire]) => wire);
      const domainLiterals = A.map(pairs, ([, domain]) => domain);
      deepStrictEqual(A.fromIterable(kit.Pairs), A.fromIterable(pairs));
      const decoded = yield* Effect.forEach(wireLiterals, (wire) => decode(wire));
      deepStrictEqual(decoded, domainLiterals);
      const encoded = yield* Effect.forEach(domainLiterals, (domain) => encode(domain));
      deepStrictEqual(encoded, wireLiterals);
    })
  );

/** Asserts that decoding fails and that the failure names the violated rule. */
const assertRejects = <A, I>(schema: S.Codec<A, I>, input: unknown, fragment: string) =>
  assertInclude(
    pipe(
      S.decodeUnknownResult(schema)(input),
      Result.getFailure,
      O.map((error) => error.message),
      O.getOrUndefined
    ),
    fragment
  );

// -----------------------------------------------------------------------------
// Laws
// -----------------------------------------------------------------------------

lawsOf("ReleaseStatus", ReleaseStatus);
lawsOf("Visibility", Visibility);
lawsOf("BlueprintIcon", BlueprintIcon);
lawsOf("Icon", Icon);
lawsOf("TypeClass", TypeClass);

// -----------------------------------------------------------------------------
// Literal domains
// -----------------------------------------------------------------------------

describe("Metadata literal domains", () => {
  literalDomain("ReleaseStatus", ReleaseStatus, [
    ["ACTIVE", "active"],
    ["ENDORSED", "endorsed"],
    ["EXPERIMENTAL", "experimental"],
    ["DEPRECATED", "deprecated"],
  ]);

  literalDomain("Visibility", Visibility, [
    ["NORMAL", "normal"],
    ["PROMINENT", "prominent"],
    ["HIDDEN", "hidden"],
  ]);

  it("matches release statuses exhaustively by their domain literal", () => {
    const isSafeToAdopt = ReleaseStatus.To.match({
      active: () => true,
      endorsed: () => true,
      experimental: () => false,
      deprecated: () => false,
    });
    deepStrictEqual(
      A.map(ReleaseStatus.Pairs, ([, status]) => isSafeToAdopt(status)),
      [true, true, false, false]
    );
  });

  it("matches visibilities exhaustively by their domain literal", () => {
    const rank = Visibility.To.match({ prominent: () => 0, normal: () => 1, hidden: () => 2 });
    deepStrictEqual(
      A.map(Visibility.Pairs, ([, visibility]) => rank(visibility)),
      [1, 0, 2]
    );
  });

  it("exposes both directions of the lookup table", () => {
    strictEqual(ReleaseStatus.Enum.ENDORSED, "endorsed");
    strictEqual(ReleaseStatus.To.Enum.endorsed, "ENDORSED");
    strictEqual(Visibility.Enum.HIDDEN, "hidden");
    strictEqual(Visibility.To.Enum.hidden, "HIDDEN");
  });

  it("guards the domain literal, not the wire literal", () => {
    assertTrue(S.is(ReleaseStatus)("deprecated"));
    assertFalse(S.is(ReleaseStatus)("DEPRECATED"));
    assertTrue(S.is(Visibility)("prominent"));
    assertFalse(S.is(Visibility)("PROMINENT"));
  });

  it("rejects literals outside the domain", () => {
    assertRejects(ReleaseStatus, "RETIRED", "ReleaseStatus");
    assertRejects(ReleaseStatus, "active", "ReleaseStatus");
    assertRejects(Visibility, "INVISIBLE", "Visibility");
    assertRejects(Visibility, "hidden", "Visibility");
  });
});

// -----------------------------------------------------------------------------
// Icon
// -----------------------------------------------------------------------------

describe("Icon", () => {
  wireFixture(
    "decodes and re-encodes a blueprint icon",
    Icon,
    { type: "blueprint", color: "#2D72D2", name: "cube" },
    Icon.cases.blueprint.make({ color: "#2D72D2", name: "cube" })
  );

  wireFixture(
    "decodes and re-encodes the member record on its own",
    BlueprintIcon,
    { type: "blueprint", color: "#4C90F0", name: "layout-hierarchy" },
    BlueprintIcon.make({ color: "#4C90F0", name: "layout-hierarchy" })
  );

  it("is a union of exactly the wire's one case", () => {
    deepStrictEqual(R.keys(Icon.cases), ["blueprint"]);
    strictEqual(Icon.members.length, 1);
  });

  it("constructs the case, guards it and matches exhaustively", () => {
    const icon = Icon.cases.blueprint.make({ color: "#2D72D2", name: "cube" });
    strictEqual(icon.type, "blueprint");
    assertTrue(Icon.guards.blueprint(icon));
    assertTrue(Icon.isAnyOf(["blueprint"])(icon));
    strictEqual(Icon.match(icon, { blueprint: ({ color, name }) => `${name} in ${color}` }), "cube in #2D72D2");
  });

  it("rejects an unknown icon source", () => {
    assertRejects(Icon, { type: "svg", color: "#2D72D2", name: "cube" }, "Icon");
  });

  it("rejects an icon without a name", () => {
    assertRejects(Icon, { type: "blueprint", color: "#2D72D2", name: "" }, "length of at least 1");
    assertRejects(Icon, { type: "blueprint", color: "#2D72D2" }, "Missing key");
  });
});

// -----------------------------------------------------------------------------
// TypeClass
// -----------------------------------------------------------------------------

describe("TypeClass", () => {
  wireFixture(
    "decodes and re-encodes a render hint",
    TypeClass,
    { kind: "render_hint", name: "SELECTABLE" },
    TypeClass.make({ kind: "render_hint", name: "SELECTABLE" })
  );

  it.effect(
    "decodes a list of type classes as the platform sends them",
    Effect.fnUntraced(function* () {
      const decoded = yield* S.decodeEffect(S.Array(TypeClass))([
        { kind: "render_hint", name: "SELECTABLE" },
        { kind: "render_hint", name: "SORTABLE" },
      ]);
      deepStrictEqual(
        A.map(decoded, (typeClass) => typeClass.name),
        ["SELECTABLE", "SORTABLE"]
      );
    })
  );

  it("rejects a type class missing either part", () => {
    assertRejects(TypeClass, { kind: "render_hint" }, "Missing key");
    assertRejects(TypeClass, { name: "SORTABLE" }, "Missing key");
  });
});
