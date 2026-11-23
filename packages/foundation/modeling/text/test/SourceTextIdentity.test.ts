import { PosixPath } from "@beep/schema/PosixPath";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import {
  SourceTextDigest,
  SourceTextExtractor,
  SourceTextIdentity,
  SourceTextLocator,
} from "@beep/text/SourceTextIdentity";
import { describe, expect } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const IdentityJson = S.fromJsonString(SourceTextIdentity);
const decodeIdentityJson = S.decodeEffect(IdentityJson);
const encodeIdentityJson = S.encodeEffect(IdentityJson);
const decodeIdentityOption = S.decodeUnknownOption(SourceTextIdentity);
const isIdentity = S.is(SourceTextIdentity);
const encodeIdentity = flow(S.encodeResult(SourceTextIdentity), Result.getOrThrow);

const loneSurrogates = ["\ud800", "\udc00", "\ude00\ud83d"];

const digest = SourceTextDigest.make(`sha256:${Str.repeat(64)("a")}`);

const astral = SourceTextIdentity.make({
  extractor: SourceTextExtractor.make({ name: "utf8 😀", version: "1 𝒳" }),
  locator: PosixPath.make("documents/😀.txt"),
  normalizationVersion: "1 😀",
  scopeRef: "matter:😀",
  sourceDigest: digest,
  sourceRef: "source:𝒳",
  textDigest: digest,
});

const storedAstralJsonInFieldOrderUnescaped = `{"scopeRef":"matter:😀","sourceRef":"source:𝒳","locator":"documents/😀.txt","sourceDigest":"${digest}","textDigest":"${digest}","extractor":{"name":"utf8 😀","version":"1 𝒳"},"normalizationVersion":"1 😀"}`;

const eachTextLeafWithLoneSurrogate = (
  source: typeof SourceTextIdentity.Encoded,
  surrogate: string
): ReadonlyArray<typeof SourceTextIdentity.Encoded> => [
  { ...source, scopeRef: `${source.scopeRef}${surrogate}` },
  { ...source, sourceRef: `${surrogate}${source.sourceRef}` },
  { ...source, locator: `${source.locator}${surrogate}` },
  { ...source, normalizationVersion: `${source.normalizationVersion}${surrogate}` },
  { ...source, extractor: { ...source.extractor, name: `${source.extractor.name}${surrogate}` } },
  { ...source, extractor: { ...source.extractor, version: `${surrogate}${source.extractor.version}` } },
];

describe("@beep/text SourceTextIdentity", () => {
  it.effect(
    "keeps the stored bytes of an identity with astral text",
    Effect.fnUntraced(function* () {
      const written = yield* encodeIdentityJson(astral);
      expect(written).toBe(storedAstralJsonInFieldOrderUnescaped);

      const read = yield* decodeIdentityJson(storedAstralJsonInFieldOrderUnescaped);
      expect(read).toEqual(astral);
    })
  );

  it("refuses a lone surrogate in every text field on decode and on construction", () => {
    const rows = A.flatMap(loneSurrogates, (surrogate) =>
      eachTextLeafWithLoneSurrogate(encodeIdentity(astral), surrogate)
    );
    expect(rows).toHaveLength(18);
    A.forEach(rows, (row) => {
      assertNone(decodeIdentityOption(row));
      expect(isIdentity(row)).toBe(false);
    });
    assertNone(SourceTextExtractor.makeOption({ name: "utf8\ud800", version: "1" }));
    assertNone(SourceTextExtractor.makeOption({ name: "utf8", version: "\udc00" }));
  });

  it.effect(
    "refuses a stored identity that spells a lone surrogate as a JSON escape",
    Effect.fnUntraced(function* () {
      const paired = yield* decodeIdentityJson(
        Str.replace("matter:😀", "matter:\\ud83d\\ude00")(storedAstralJsonInFieldOrderUnescaped)
      );
      expect(paired).toEqual(astral);

      const failure = yield* decodeIdentityJson(
        Str.replace("matter:😀", "matter:\\ud83d")(storedAstralJsonInFieldOrderUnescaped)
      ).pipe(Effect.flip);
      expect(failure.message).toContain("Expected text without lone UTF-16 surrogates.");
    })
  );

  it.effect(
    "refuses a locator by its own check and keeps the path grammar",
    Effect.fnUntraced(function* () {
      const decodeLocator = S.decodeEffect(SourceTextLocator);
      const locator = yield* decodeLocator("documents/😀.txt");
      const path: PosixPath = locator;
      expect(path).toBe("documents/😀.txt");

      const illFormedLocator = yield* decodeLocator("documents/\ud83d.txt").pipe(Effect.flip);
      expect(illFormedLocator.message).toContain("Expected a locator without lone UTF-16 surrogates.");
      expect(S.is(SourceTextLocator)("documents\\action.txt")).toBe(false);
    })
  );

  it.prop(
    "generates well-formed identities, and one lone surrogate in any text field is refused",
    [Arbitrary.schema(SourceTextIdentity), Arbitrary.schema(S.Literals(loneSurrogates))],
    ([source, surrogate]) => {
      const encoded = encodeIdentity(source);
      expect(encodeIdentity(SourceTextIdentity.make(source))).toEqual(encoded);
      expect(A.filter(eachTextLeafWithLoneSurrogate(encoded, surrogate), isIdentity)).toEqual([]);
      return true;
    },
    { arbitrary: fcRuns(300) }
  );
});
