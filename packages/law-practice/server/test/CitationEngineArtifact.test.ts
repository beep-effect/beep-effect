import {
  CitationEngineArtifactDescriptor,
  makeCitationEngineArtifact,
} from "@beep/law-practice-server/internal/Citation/EngineArtifact";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as R from "effect/Record";
import * as Str from "effect/String";
import { citationFixtureEngineBuild } from "./CitationEngineArtifact.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

const hash = (character: string) => Sha256Hex.make(Str.repeat(64)(character));
const fixture = Effect.gen(function* () {
  const { limits } = yield* defaultCitationEnginePolicy;
  return CitationEngineArtifactDescriptor.make({
    build: citationFixtureEngineBuild("bun"),
    assets: { parserCatalog: hash("d"), helpers: hash("e"), vocabulary: hash("f") },
    highestValidYear: 2027,
    limits,
  });
});
it.layer(citationTokenizerTestLayer)("versioned engine artifact", (it) => {
  it.effect("retains the independently calculated protocol vector and ignores property insertion order", () =>
    Effect.gen(function* () {
      const source = yield* fixture;
      const first = yield* makeCitationEngineArtifact(source);
      expect(first).toBe("ea2281e1e3ade99638c47458d11eca2ee41a397886dd1d834e42b7d2922be94e");
      const reordered = {
        limits: R.fromEntries(A.reverse(R.toEntries(source.limits))),
        highestValidYear: source.highestValidYear,
        assets: {
          vocabulary: source.assets.vocabulary,
          helpers: source.assets.helpers,
          parserCatalog: source.assets.parserCatalog,
        },
        build: {
          tokenizer: source.build.tokenizer,
          cleaner: source.build.cleaner,
          runtime: { version: source.build.runtime.version, kind: source.build.runtime.kind },
          implementation: source.build.implementation,
        },
      };
      const replay = yield* makeCitationEngineArtifact(reordered);
      expect(replay).toBe(first);
    })
  );
  it.effect("changes when any build, runtime, port, data, calendar or policy input changes", () =>
    Effect.gen(function* () {
      const source = yield* fixture;
      const baseline = yield* makeCitationEngineArtifact(source);
      const build = source.build;
      const variants = [
        { ...source, build: { ...build, implementation: hash("0") } },
        { ...source, build: { ...build, runtime: { ...build.runtime, version: "test-runtime/v2" } } },
        { ...source, build: { ...build, runtime: { ...build.runtime, kind: "node" } } },
        { ...source, build: { ...build, cleaner: hash("0") } },
        { ...source, build: { ...build, tokenizer: hash("0") } },
        { ...source, assets: { ...source.assets, parserCatalog: hash("0") } },
        { ...source, assets: { ...source.assets, helpers: hash("0") } },
        { ...source, assets: { ...source.assets, vocabulary: hash("0") } },
        { ...source, highestValidYear: 2028 },
        { ...source, limits: { ...source.limits, sourceUtf16: source.limits.sourceUtf16 - 1 } },
      ];
      const digests = yield* Effect.forEach(variants, makeCitationEngineArtifact, { concurrency: 1 });
      expect(A.contains(digests, baseline)).toBe(false);
      expect(A.dedupe(digests)).toHaveLength(variants.length);
    })
  );
  it.effect("refuses malformed metadata and incomplete policies through a closed error", () =>
    Effect.gen(function* () {
      const source = yield* fixture;
      const variants = [
        { ...source, build: { ...source.build, implementation: "unknown" } },
        { ...source, build: { ...source.build, runtime: { kind: "unselected", version: "v1" } } },
        { ...source, build: { ...source.build, tokenizer: undefined } },
        { ...source, assets: {} },
        { ...source, highestValidYear: 10001 },
        { ...source, limits: { sourceUtf16: 1 } },
      ];
      for (const input of variants) {
        const failure = yield* makeCitationEngineArtifact(input).pipe(Effect.flip);
        expect(failure._tag).toBe("CitationEngineArtifactFailure");
      }
    })
  );
});
