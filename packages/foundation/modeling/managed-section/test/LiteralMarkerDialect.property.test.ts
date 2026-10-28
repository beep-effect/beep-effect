import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { CommentStyle } from "@beep/managed-section/CommentStyle";
import { Section, SectionId } from "@beep/managed-section/Section";
import { Eol, LiteralMarkerDialect, SectionDialect, SectionMarkers } from "@beep/managed-section/SectionDialect";
import { SectionDocument } from "@beep/managed-section/SectionDocument";
import { describe, it } from "@effect/vitest";
import { assertFalse, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const runs = { arbitrary: fcRuns(100) };

const dialect = LiteralMarkerDialect.make({
  phrase: "MANAGED SECTION",
  styles: [CommentStyle.html, CommentStyle.hash],
  markers: [SectionMarkers.make({ key: "status", begin: "BEGIN GENERATED: STATUS", end: "END GENERATED: STATUS" })],
});
const status = SectionId.make({ key: "status", commentStyle: CommentStyle.html });
const BEGIN = "<!-- BEGIN GENERATED: STATUS -->";

const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const equivalent = S.toEquivalence(schema);
  it.effect.prop(
    `${name} decodes its encoded values without failure`,
    [Arbitrary.schema(schema)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(schema)(value);
        const decoded = yield* S.decodeEffect(schema)(encoded);
        assertTrue(equivalent(decoded, value));
      }),
    runs
  );
};

describe("SectionMarkers", () => {
  it("accepts a trimmed single-line spelling with distinct ends", () => {
    assertTrue(S.is(SectionMarkers)({ key: "a", begin: "BEGIN A", end: "END A" }));
  });

  it("refuses spellings the scanner could not read back verbatim", () => {
    const refused = [
      { key: "a", begin: "SAME", end: "SAME" },
      { key: "a", begin: "SAME  TEXT", end: "SAME TEXT" },
      { key: "a", begin: "--- BEGIN A", end: "END A" },
      { key: "a", begin: " BEGIN A", end: "END A" },
      { key: "a", begin: "BEGIN A ", end: "END A" },
      { key: "a", begin: "BEGIN\nA", end: "END A" },
      { key: "a", begin: "BEGIN A", end: "END A" },
      { key: "a", begin: "", end: "END A" },
      { key: "a b", begin: "BEGIN A", end: "END A" },
    ];
    for (const input of refused) assertFalse(S.is(SectionMarkers)(input), JSON.stringify(input));
  });
});

describe("LiteralMarkerDialect construction", () => {
  const accepts = (markers: ReadonlyArray<{ readonly key: string; readonly begin: string; readonly end: string }>) =>
    S.decodeUnknownResult(LiteralMarkerDialect)({ phrase: "MANAGED SECTION", styles: [{ prefix: "#" }], markers }).pipe(
      Result.isSuccess
    );

  it("refuses an empty spelling list, a key spelled twice and a reused marker text", () => {
    assertFalse(accepts([]));
    assertFalse(
      accepts([
        { key: "a", begin: "BEGIN A", end: "END A" },
        { key: "a", begin: "BEGIN B", end: "END B" },
      ])
    );
    assertFalse(
      accepts([
        { key: "a", begin: "BEGIN A", end: "END A" },
        { key: "b", begin: "END A", end: "END B" },
      ])
    );
    assertFalse(
      accepts([
        { key: "a", begin: "BEGIN A", end: "END A" },
        { key: "b", begin: "BEGIN  A", end: "END B" },
      ])
    );
    assertTrue(accepts([{ key: "a", begin: "BEGIN A", end: "END A" }]));
  });

  it.effect("is a SectionDialect whose spellings enter the wire form", () =>
    Effect.gen(function* () {
      assertTrue(S.is(SectionDialect)(dialect));
      const encoded = yield* S.encodeEffect(LiteralMarkerDialect)(dialect);
      deepStrictEqual(encoded.markers, [
        { key: "status", begin: "BEGIN GENERATED: STATUS", end: "END GENERATED: STATUS" },
      ]);
      const decoded = yield* S.decodeEffect(LiteralMarkerDialect)(encoded);
      strictEqual(decoded.beginMarker(status), BEGIN);
    })
  );

  it("memoizes its literal scanners and lists its spellings", () => {
    assertTrue(dialect.literalMatchers() === dialect.literalMatchers());
    strictEqual(dialect.literalMatchers().length, 2);
    deepStrictEqual(
      A.map(dialect.spellings(), (entry) => entry.key),
      ["status"]
    );
    strictEqual(SectionDialect.default.literalMatchers().length, 0);
    strictEqual(SectionDialect.default.spellings().length, 0);
  });
});

describe("LiteralMarkerDialect schema properties", () => {
  roundTrips("SectionMarkers", SectionMarkers);
  roundTrips("LiteralMarkerDialect", LiteralMarkerDialect);
});

const StyleIndex = S.Literals([0, 1, 2, 3, 4, 5]);
const styles = [
  CommentStyle.hash,
  CommentStyle.slash,
  CommentStyle.semicolon,
  CommentStyle.dash,
  CommentStyle.html,
  CommentStyle.block,
] as const;

// Content lines are prefixed so arbitrary text cannot become a marker line.
it.effect.prop(
  "literal render/parse preserves content and reaches a fixed point",
  [Arbitrary.schema(SectionMarkers), Arbitrary.schema(S.String), Arbitrary.schema(Eol), Arbitrary.schema(StyleIndex)],
  ([markers, value, eol, index]) =>
    Effect.gen(function* () {
      const dialect = LiteralMarkerDialect.make({ phrase: "MANAGED SECTION", styles, markers: [markers] });
      const id = SectionId.make({ key: markers.key, commentStyle: styles[index] });
      const content = `data:${Str.replace(/\n/g, "\ndata:")(Str.replace(/\r/g, "")(value))}`;
      const section = id.section(content);
      const rendered = yield* Effect.fromResult(dialect.render(section, eol));
      strictEqual(Str.split(eol)(rendered)[0], styles[index].comment(markers.begin));
      const parsed = yield* SectionDocument.parse(rendered, dialect);
      const recovered = yield* Effect.fromOption(parsed.read(id));
      assertTrue(S.toEquivalence(Section)(recovered, section));
      const repeated = yield* Effect.fromResult(parsed.reconcile([section]));
      strictEqual(repeated.text, rendered);
      assertFalse(repeated.changed);
    }),
  runs
);
