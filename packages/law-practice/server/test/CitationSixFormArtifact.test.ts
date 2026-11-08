import { CourtReporterArtifactVersion } from "@beep/law-practice-domain/values/CourtReporterVocabulary";
import {
  CitationSixFormArtifactDescriptor,
  makeCitationSixFormArtifact,
} from "@beep/law-practice-server/internal/Citation/SixFormArtifact";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as R from "effect/Record";
import * as Str from "effect/String";

const hash = (character: string) => Sha256Hex.make(Str.repeat(64)(character));
const fixture = Effect.gen(function* () {
  const { limits } = yield* defaultCitationEnginePolicy;
  return CitationSixFormArtifactDescriptor.make({
    implementation: hash("a"),
    runtime: { kind: "bun", version: "test-runtime/v1" },
    vocabularyVersion: CourtReporterArtifactVersion.make("crv1:f353e51400a5:fad63b383b92"),
    limits,
  });
});

it.layer(BunCrypto.layerDigest)("six-form installation artifact", (it) => {
  it.effect("is deterministic across descriptor and policy property insertion order", () =>
    Effect.gen(function* () {
      const source = yield* fixture;
      const first = yield* makeCitationSixFormArtifact(source);
      const reordered = {
        limits: R.fromEntries(A.reverse(R.toEntries(source.limits))),
        vocabularyVersion: source.vocabularyVersion,
        runtime: { version: source.runtime.version, kind: source.runtime.kind },
        implementation: source.implementation,
      };
      const replay = yield* makeCitationSixFormArtifact(reordered);
      expect(replay).toBe(first);
      expect(first).toHaveLength(64);
    })
  );
  it.effect("commits implementation, runtime, vocabulary and effective policy changes", () =>
    Effect.gen(function* () {
      const source = yield* fixture;
      const baseline = yield* makeCitationSixFormArtifact(source);
      const variants = [
        { ...source, implementation: hash("b") },
        { ...source, runtime: { ...source.runtime, kind: "node" } },
        { ...source, runtime: { ...source.runtime, version: "test-runtime/v2" } },
        { ...source, vocabularyVersion: CourtReporterArtifactVersion.make("different-reviewed-artifact") },
        { ...source, limits: { ...source.limits, sourceUtf16: source.limits.sourceUtf16 - 1 } },
      ];
      const digests = yield* Effect.forEach(variants, makeCitationSixFormArtifact, { concurrency: 1 });
      expect(A.contains(digests, baseline)).toBe(false);
      expect(A.dedupe(digests)).toHaveLength(variants.length);
    })
  );
  it.effect("refuses malformed installation claims through the existing source-free extraction input error", () =>
    Effect.gen(function* () {
      const source = yield* fixture;
      for (const input of [
        { ...source, implementation: "private-invalid-build" },
        { ...source, runtime: { kind: "node", version: "" } },
        { ...source, runtime: { kind: "unselected", version: "v1" } },
        { ...source, vocabularyVersion: "" },
        { ...source, limits: { sourceUtf16: 1 } },
      ]) {
        const failure = yield* makeCitationSixFormArtifact(input).pipe(Effect.flip);
        expect(failure).toMatchObject({ _tag: "CitationInputError", operation: "extract" });
        expect(failure).not.toHaveProperty("cause");
        expect(failure).not.toHaveProperty("input");
      }
    })
  );
});
