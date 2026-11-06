import * as Root from "@beep/law-practice-use-cases";
import * as Public from "@beep/law-practice-use-cases/public";
import {
  CitationBuiltinCleanerName,
  CitationCleanerContainerKind,
  CitationEngineExtractionOptions,
  CitationEngineSourceInput,
  CitationEngineSourcePairInput,
  CitationSourceRole,
} from "@beep/law-practice-use-cases/server";
import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { VerifiedSourceText } from "@beep/provenance/VerifiedTextAnchor";
import { PosixPath } from "@beep/schema";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";

it.effect("preserves None/empty-list defaults and rejects callback-valued named steps", () =>
  Effect.gen(function* () {
    const defaults = yield* S.decodeEffect(CitationEngineExtractionOptions)({});
    expect(defaults).toEqual({ cleanSteps: null, container: "list", removeAmbiguous: false });
    const empty = yield* S.decodeEffect(CitationEngineExtractionOptions)({ cleanSteps: [] });
    expect(empty.cleanSteps).toEqual([]);
    const callable = yield* S.decodeUnknownEffect(CitationEngineExtractionOptions)({ cleanSteps: [() => "html"] }).pipe(
      Effect.flip
    );
    expect(callable._tag).toBe("SchemaError");
    expect(CitationBuiltinCleanerName.literals).toEqual([
      "html",
      "inline_whitespace",
      "all_whitespace",
      "underscores",
      "xml",
    ]);
    expect(CitationCleanerContainerKind.literals).toEqual(["list", "tuple", "generator"]);
    expect(CitationSourceRole.literals).toEqual(["plain", "markup"]);
  })
);
it.effect("retains exact raw Unicode and identity without granting a verified capability", () =>
  Effect.gen(function* () {
    const digest = SourceTextDigest.make(`sha256:${Str.repeat(64)("0")}`);
    const identity = SourceTextIdentity.make({
      scopeRef: "test:scope",
      sourceRef: "test:source",
      locator: PosixPath.make("source.txt"),
      sourceDigest: digest,
      textDigest: digest,
      extractor: SourceTextExtractor.make({ name: "test", version: "1" }),
      normalizationVersion: "1",
    });
    const source = yield* S.decodeEffect(CitationEngineSourceInput)({ source: identity, sourceText: " A😀\n" });
    expect(source.sourceText).toBe(" A😀\n");
    expect(source.source).toEqual(identity);
    expect(source.role).toBe("plain");
    expect(S.is(VerifiedSourceText)(source)).toBe(false);
    const pair = yield* S.decodeEffect(CitationEngineSourcePairInput)({
      plain: { source: identity, sourceText: "" },
      markup: { source: identity, sourceText: " A😀\n" },
      cleanSteps: [],
    });
    expect(pair.plain?.sourceText).toBe("");
    expect(pair.markup?.sourceText).toBe(" A😀\n");
    expect(pair.cleanSteps).toEqual([]);
    expect(S.is(VerifiedSourceText)(pair.plain)).toBe(false);
  })
);
it.effect("keeps raw source and mode contracts out of root and client surfaces", () =>
  Effect.sync(() => {
    for (const name of [
      "CitationEngineSourceInput",
      "CitationEngineSourcePairInput",
      "CitationEngineExtractionOptions",
      "CitationBuiltinCleanerName",
      "CitationCleanerContainerKind",
      "CitationSourceRole",
    ]) {
      expect(name in Root).toBe(false);
      expect(name in Public).toBe(false);
    }
  })
);
