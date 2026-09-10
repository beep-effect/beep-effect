import {
  attachCacheEntrypointReview,
  CacheCensusReport,
  CacheCensusSource,
  CacheEntrypointArtifactFormat,
  CacheEntrypointArtifactReference,
  CacheEntrypointReviewRequest,
} from "@beep/repo-cli/commands/Cache";
import { CacheEvidenceReference } from "@beep/repo-configs/cache";
import { Sha256HexFromBytes } from "@beep/schema";
import { fcRuns, provideScopedLayer } from "@beep/test-utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const testLayer = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer);
const hashBytes = S.decodeEffect(Sha256HexFromBytes);

const encodeJsonObjectJson = S.encodeEffect(S.fromJsonString(S.JsonObject));
const jsonObjectEquivalence = S.toEquivalence(S.JsonObject);

const fixture = Effect.fn("CacheEntrypointsTest.fixture")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "cache-entrypoints-test-" });
  const write = Effect.fn("CacheEntrypointsTest.write")(function* (relative: string, text: string) {
    const bytes = new TextEncoder().encode(text);
    yield* fs.writeFile(path.join(root, relative), bytes);
    return CacheEvidenceReference.make({ path: relative, sha256: yield* hashBytes(bytes) });
  });
  const source = yield* write("entrypoint.ts", "export const command = 'source only';\n");
  const review = yield* write("review.md", "Reviewed source; runtime work is outstanding.\n");
  const artifacts = yield* Effect.forEach(
    CacheEntrypointArtifactFormat.Options,
    Effect.fnUntraced(function* (format, index) {
      const document = {
        schemaVersion: format,
        ownerFields: { steps: [{ command: "touch", args: ["must-not-execute"], env: { EXAMPLE_SEED: "12345" } }] },
      };
      const reference = yield* write(`artifact-${index}.json`, yield* encodeJsonObjectJson(document));
      return CacheEntrypointArtifactReference.make({ format, reference });
    })
  );
  const census = CacheCensusReport.make({
    revision: "fixture",
    turboVersion: "fixture",
    rootScripts: {},
    globalConfiguration: {},
    workspaces: [],
    nodes: [],
    sources: [CacheCensusSource.make(source)],
    entrypointSources: [source.path],
    unresolved: ["Existing interpreter obligation."],
  });
  const request = CacheEntrypointReviewRequest.make({
    sources: [source],
    artifacts,
    reviews: [review],
    unresolved: ["Candidate file reads remain unobserved."],
  });
  return { root, fs, path, write, census, request };
});
const encodeCacheCensusReportJson = S.encodeEffect(S.fromJsonString(CacheCensusReport));

const decodeCacheCensusReportJson = S.decodeEffect(S.fromJsonString(CacheCensusReport));

describe("source-bound census entrypoints", () => {
  it.effect("preserves arbitrary owner-defined JSON fields through verified attachment", () =>
    Arbitrary.checkEffect(
      Arbitrary.schema(S.JsonObject),
      (payload) =>
        Effect.gen(function* () {
          const f = yield* fixture();
          const first = f.request.artifacts[0];
          const document = { ...payload, schemaVersion: first.format };
          const reference = yield* f.write(first.reference.path, yield* encodeJsonObjectJson(document));
          const request = CacheEntrypointReviewRequest.make({
            ...f.request,
            artifacts: [
              CacheEntrypointArtifactReference.make({ ...first, reference }),
              ...A.drop(f.request.artifacts, 1),
            ],
          });
          const result = yield* attachCacheEntrypointReview(f.root, f.census, request);
          expect(jsonObjectEquivalence(O.getOrThrow(result.entrypointReview).artifacts[0].document, document)).toBe(
            true
          );
          return true;
        }).pipe(provideScopedLayer(testLayer)),
      fcRuns(20)
    ).pipe(Effect.map((result) => expect(result._tag).toBe("Passed")))
  );

  it.effect(
    "preserves owner fields when JSON normalizes negative zero",
    Effect.fnUntraced(function* () {
      const f = yield* fixture();
      const first = f.request.artifacts[0];
      const document = {
        schemaVersion: first.format,
        value: -0,
        ownerFields: { values: [-0, 0, 1, -1], label: "retained" },
      };
      const reference = yield* f.write(first.reference.path, yield* encodeJsonObjectJson(document));
      const request = CacheEntrypointReviewRequest.make({
        ...f.request,
        artifacts: [CacheEntrypointArtifactReference.make({ ...first, reference }), ...A.drop(f.request.artifacts, 1)],
      });
      const result = yield* attachCacheEntrypointReview(f.root, f.census, request);
      expect(O.getOrThrow(result.entrypointReview).artifacts[0].document).toEqual({
        schemaVersion: first.format,
        value: 0,
        ownerFields: { values: [0, 0, 1, -1], label: "retained" },
      });
    }, provideScopedLayer(testLayer))
  );

  it.effect(
    "preserves complete owner fields and existing obligations without executing source commands",
    Effect.fnUntraced(function* () {
      const f = yield* fixture();
      const result = yield* attachCacheEntrypointReview(f.root, f.census, f.request);
      const review = O.getOrThrow(result.entrypointReview);
      expect(review.authority).toBe("source-review-only");
      expect(review.schemaVersion).toBe("cache-census-entrypoint-review/v1");
      expect(review.artifacts).toHaveLength(4);
      for (const artifact of review.artifacts) {
        expect(artifact.document.ownerFields).toEqual({
          steps: [{ command: "touch", args: ["must-not-execute"], env: { EXAMPLE_SEED: "12345" } }],
        });
      }
      expect(result.unresolved).toContain("Existing interpreter obligation.");
      expect(result.unresolved).toContain("Candidate file reads remain unobserved.");
      expect(result.nodes).toEqual(f.census.nodes);
      expect(O.isNone(f.census.entrypointReview)).toBe(true);
      expect(yield* f.fs.exists(f.path.join(f.root, "must-not-execute"))).toBe(false);
      const json = yield* encodeCacheCensusReportJson(result);
      const decoded = yield* decodeCacheCensusReportJson(json);
      expect(S.toEquivalence(CacheCensusReport)(result, decoded)).toBe(true);
    }, provideScopedLayer(testLayer))
  );

  it.effect(
    "rejects partial populations, duplicate references and missing document families",
    Effect.fnUntraced(function* () {
      const f = yield* fixture();
      const source = f.request.sources[0];
      const cases = [
        CacheEntrypointReviewRequest.make({ ...f.request, sources: [f.request.reviews[0]] }),
        CacheEntrypointReviewRequest.make({ ...f.request, sources: [source, source] }),
        CacheEntrypointReviewRequest.make({ ...f.request, reviews: [source] }),
        CacheEntrypointReviewRequest.make({ ...f.request, artifacts: [f.request.artifacts[0]] }),
      ];
      for (const request of cases)
        expect(yield* attachCacheEntrypointReview(f.root, f.census, request).pipe(Effect.isFailure)).toBe(true);
    }, provideScopedLayer(testLayer))
  );

  it.effect(
    "rejects changed source, review and artifact bytes after census collection",
    Effect.fnUntraced(function* () {
      for (const kind of ["source", "review", "artifact"] as const) {
        const f = yield* fixture();
        const references = {
          source: f.request.sources[0],
          review: f.request.reviews[0],
          artifact: f.request.artifacts[0].reference,
        };
        yield* f.fs.writeFileString(f.path.join(f.root, references[kind].path), "Changed after review.\n");
        expect(yield* attachCacheEntrypointReview(f.root, f.census, f.request).pipe(Effect.isFailure)).toBe(true);
      }
    }, provideScopedLayer(testLayer))
  );

  it.effect(
    "rejects symlinked evidence even when the referenced content has the expected digest",
    Effect.fnUntraced(function* () {
      const f = yield* fixture();
      const original = f.request.artifacts[0];
      yield* f.fs.symlink(f.path.join(f.root, original.reference.path), f.path.join(f.root, "linked.json"));
      const request = CacheEntrypointReviewRequest.make({
        ...f.request,
        artifacts: [
          CacheEntrypointArtifactReference.make({
            ...original,
            reference: CacheEvidenceReference.make({ ...original.reference, path: "linked.json" }),
          }),
          ...A.drop(f.request.artifacts, 1),
        ],
      });
      expect(yield* attachCacheEntrypointReview(f.root, f.census, request).pipe(Effect.isFailure)).toBe(true);
    }, provideScopedLayer(testLayer))
  );

  it.effect(
    "rejects malformed or wrongly versioned documents even with correctly rebound digests",
    Effect.fnUntraced(function* () {
      for (const text of ["{", "[]", '{"schemaVersion":"cache-command-groups/v1"}']) {
        const f = yield* fixture();
        const first = f.request.artifacts[0];
        const reference = yield* f.write(first.reference.path, text);
        const request = CacheEntrypointReviewRequest.make({
          ...f.request,
          artifacts: [
            CacheEntrypointArtifactReference.make({ ...first, reference }),
            ...A.drop(f.request.artifacts, 1),
          ],
        });
        expect(yield* attachCacheEntrypointReview(f.root, f.census, request).pipe(Effect.isFailure)).toBe(true);
      }
    }, provideScopedLayer(testLayer))
  );

  it.effect(
    "rejects malformed UTF-8 before interpreting an artifact",
    Effect.fnUntraced(function* () {
      const f = yield* fixture();
      const first = f.request.artifacts[0];
      const bytes = new Uint8Array([255]);
      yield* f.fs.writeFile(f.path.join(f.root, first.reference.path), bytes);
      const reference = CacheEvidenceReference.make({
        ...first.reference,
        sha256: yield* hashBytes(bytes),
      });
      const request = CacheEntrypointReviewRequest.make({
        ...f.request,
        artifacts: [CacheEntrypointArtifactReference.make({ ...first, reference }), ...A.drop(f.request.artifacts, 1)],
      });
      expect(yield* attachCacheEntrypointReview(f.root, f.census, request).pipe(Effect.isFailure)).toBe(true);
    }, provideScopedLayer(testLayer))
  );
});
