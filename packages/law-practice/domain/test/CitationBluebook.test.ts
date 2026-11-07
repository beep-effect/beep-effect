import {
  BluebookCitation,
  BluebookFromFullCitation,
  BluebookText,
  BluebookTextFromBluebookCitation,
  FullCitation,
} from "@beep/law-practice-domain/values";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, expectTypeOf } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import layout from "./fixtures/bluebook-layout.json" with { type: "json" };
import type { BluebookTypeContract } from "./dtslint/CitationBluebook.test-d.ts";

expectTypeOf<BluebookTypeContract>().not.toBeAny();

const version = "crv1:f353e51400a5:fad63b383b92";
const source = {
  type: "case",
  components: { volume: "550", reporter: "U.S.", page: "544" },
  publication: {
    vocabularyVersion: version,
    editions: [
      {
        edition: "351eca5a0f8b133ce2d21530fd349f3567079fff849effe0a976efa3fdc16718",
        reporterId: "reporter:67d371c6acffe6c7502566ad",
      },
    ],
    selectedEdition: "351eca5a0f8b133ce2d21530fd349f3567079fff849effe0a976efa3fdc16718",
  },
  metadata: {
    plaintiff: "Bell Atl. Corp.",
    defendant: "Twombly",
    year: "2007",
    pinCite: "570",
    court: { status: "known", id: "scotus", vocabularyVersion: version },
    month: null,
    day: null,
    parenthetical: null,
    additionalText: null,
    antecedentGuess: null,
    shortCaseName: null,
    caseName: null,
  },
};
const LayoutEvidence = S.Struct({
  schemaVersion: S.tag("bluebook-layout-reference/v1"),
  source: S.Struct({ commit: S.tag("34133d03143ea65861f48a5ed0eb32c931581666"), license: S.tag("MIT") }),
  identity: S.Struct({
    edition: S.String,
    reporterId: S.String,
    vocabularyVersion: S.String,
    courtId: S.String,
  }),
  cases: S.Array(S.Struct({ view: S.toEncoded(BluebookCitation), expectedText: S.String })).check(
    S.isBetweenLength(3, 3)
  ),
});
const sameFull = S.toEquivalence(FullCitation);
const sameView = S.toEquivalence(BluebookCitation);

describe("lawful supported Bluebook transforms", () => {
  it.effect("matches every sealed conditional donor layout and mapped identity", () =>
    Effect.gen(function* () {
      const report = yield* S.decodeUnknownEffect(LayoutEvidence)(layout);
      for (const row of report.cases) {
        const view = yield* S.decodeEffect(BluebookCitation)(row.view);
        const text = yield* S.decodeEffect(BluebookTextFromBluebookCitation)(view);
        expect(text).toBe(row.expectedText);
        const full = yield* S.encodeEffect(BluebookFromFullCitation)(view);
        if (full.type !== "case") return yield* Effect.die("supported profile must produce a case");
        const edition = full.publication.editions[0];
        expect(edition?.edition).toBe(report.identity.edition);
        expect(edition?.reporterId).toBe(report.identity.reporterId);
        expect(full.publication.vocabularyVersion).toBe(report.identity.vocabularyVersion);
        expect(O.getOrThrow(full.metadata.court)).toMatchObject({
          status: "known",
          id: report.identity.courtId,
          vocabularyVersion: report.identity.vocabularyVersion,
        });
      }
    })
  );

  it.effect("preserves independent full-citation semantics and the pinned formatter layout", () =>
    Effect.gen(function* () {
      const citation = yield* S.decodeUnknownEffect(FullCitation)(source);
      const view = yield* S.decodeEffect(BluebookFromFullCitation)(citation);
      const text = yield* S.decodeEffect(BluebookTextFromBluebookCitation)(view);
      expect(text).toBe("Bell Atl. Corp. v. Twombly, 550 U.S. 544, 570 (2007)");
      const parsed = yield* S.encodeEffect(BluebookTextFromBluebookCitation)(text);
      expect(sameView(parsed, view)).toBe(true);
      const restored = yield* S.encodeEffect(BluebookFromFullCitation)(parsed);
      expect(sameFull(restored, citation)).toBe(true);
    })
  );

  it.effect("rejects fields or identities whose omission would lose semantic information", () =>
    Effect.gen(function* () {
      const changes = [
        { ...source, components: { ...source.components, extra: "retained" } },
        { ...source, components: { ...source.components, extra: null } },
        {
          ...source,
          publication: {
            ...source.publication,
            editions: [...source.publication.editions, ...source.publication.editions],
          },
        },
        { ...source, metadata: { ...source.metadata, parenthetical: "retained" } },
        { ...source, metadata: { ...source.metadata, caseName: "retained" } },
        { ...source, metadata: { ...source.metadata, court: null } },
        { ...source, publication: { ...source.publication, selectedEdition: null } },
        { ...source, publication: { ...source.publication, vocabularyVersion: "different-version" } },
        { ...source, components: { ...source.components, reporter: "U. S." } },
        { ...source, metadata: { ...source.metadata, defendant: "Bar v. Baz" } },
      ];
      for (const input of changes) {
        const citation = yield* S.decodeUnknownEffect(FullCitation)(input);
        const failure = yield* S.decodeEffect(BluebookFromFullCitation)(citation).pipe(Effect.flip);
        expect(failure._tag).toBe("SchemaError");
      }
    })
  );

  it.effect("refuses unsupported full law and journal forms without fabricating a case", () =>
    Effect.gen(function* () {
      const publication = { editions: [], selectedEdition: null };
      const metadata = { year: "2000", month: null, day: null, pinCite: null, parenthetical: null };
      const law = yield* S.decodeEffect(FullCitation)({
        type: "law",
        components: { chapter: "35", reporter: "U.S.C.", section: "101" },
        publication,
        metadata: { ...metadata, publisher: null },
      });
      const journal = yield* S.decodeEffect(FullCitation)({
        type: "journal",
        components: { volume: "1", reporter: "Harv. L. Rev.", page: "1" },
        publication,
        metadata,
      });
      for (const citation of [law, journal]) {
        const failure = yield* S.decodeEffect(BluebookFromFullCitation)(citation).pipe(Effect.flip);
        expect(failure._tag).toBe("SchemaError");
      }
    })
  );

  it.effect("renders the largest supported fields and keeps returned identity objects independent", () =>
    Effect.gen(function* () {
      const value = BluebookCitation.make({
        plaintiff: Str.repeat(256)("A"),
        defendant: Str.repeat(256)("B"),
        volume: "999999999",
        page: "999999999",
        pinCite: O.some("999999999"),
        year: "2000",
      });
      const text = yield* S.decodeEffect(BluebookTextFromBluebookCitation)(value);
      const parsed = yield* S.encodeEffect(BluebookTextFromBluebookCitation)(text);
      expect(sameView(value, parsed)).toBe(true);
      const first = yield* S.encodeEffect(BluebookFromFullCitation)(value);
      const second = yield* S.encodeEffect(BluebookFromFullCitation)(value);
      expect(first.publication).not.toBe(second.publication);
      expect(first.metadata).not.toBe(second.metadata);
    })
  );

  it.effect("parses the Unicode no-pin grammar and fails unsupported or ambiguous text", () =>
    Effect.gen(function* () {
      const text = BluebookText.make("Élodie 😀 v. Bar, 1 U.S. 1 (2000)");
      const view = yield* S.encodeEffect(BluebookTextFromBluebookCitation)(text);
      expect(view.plaintiff).toBe("Élodie 😀");
      assertNone(view.pinCite);
      const rendered = yield* S.decodeEffect(BluebookTextFromBluebookCitation)(view);
      expect(rendered).toBe(text);
      for (const input of [
        "Id. at 2.",
        "A v. B v. C, 1 U.S. 1 (2000)",
        "A v. B, 01 U.S. 1 (2000)",
        "A v. B, 1 F.2d 1 (2000)",
        "A v. B, 1 U.S. 1 (20)",
        " A v. B, 1 U.S. 1 (2000)",
      ]) {
        const failure = yield* S.encodeEffect(BluebookTextFromBluebookCitation)(BluebookText.make(input)).pipe(
          Effect.flip
        );
        expect(failure._tag).toBe("SchemaError");
      }
    })
  );

  it.effect.prop(
    "total encode and supported decode preserve semantic equality",
    { value: Arbitrary.schema(BluebookCitation) },
    ({ value }) =>
      Effect.gen(function* () {
        const full = yield* S.encodeEffect(BluebookFromFullCitation)(value);
        const decoded = yield* S.decodeEffect(BluebookFromFullCitation)(full);
        expect(sameView(decoded, value)).toBe(true);
        const restored = yield* S.encodeEffect(BluebookFromFullCitation)(decoded);
        expect(sameFull(restored, full)).toBe(true);
      }),
    { arbitrary: fcRuns(100) }
  );

  it.effect.prop(
    "total render and supported text parsing converge without dropped fields",
    { value: Arbitrary.schema(BluebookCitation) },
    ({ value }) =>
      Effect.gen(function* () {
        const text = yield* S.decodeEffect(BluebookTextFromBluebookCitation)(value);
        const parsed = yield* S.encodeEffect(BluebookTextFromBluebookCitation)(text);
        expect(sameView(parsed, value)).toBe(true);
        const rendered = yield* S.decodeEffect(BluebookTextFromBluebookCitation)(parsed);
        expect(rendered).toBe(text);
      }),
    { arbitrary: fcRuns(100) }
  );
});
