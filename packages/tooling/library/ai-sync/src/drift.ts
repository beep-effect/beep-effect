/**
 * Local and strict drift checks for generated AI sync artifacts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect, FileSystem, Path, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { GENERATED_TIER_ONE_SOURCE_METADATA } from "./_generated/source-metadata.gen.ts";
import {
  fetchSourceText,
  GENERATED_SCHEMAS_PATH,
  GENERATED_SOURCE_METADATA_PATH,
  hashSourceText,
  renderGeneratedSchemas,
  renderGeneratedSourceMetadata,
} from "./generator.ts";
import { AiSyncDriftFinding, AiSyncDriftReport, AiSyncError, AiSyncSourceMetadata } from "./models.ts";
import { TIER_ONE_SOURCES } from "./source-map.ts";

const packageRoot = Effect.fn("AiSync.driftPackageRoot")(function* () {
  const path = yield* Path.Path;
  return path.resolve(import.meta.dirname, "..");
});

const readPackageFile = Effect.fn("AiSync.readPackageFile")(function* (relativePath: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* packageRoot();
  return yield* fs.readFileString(path.join(root, relativePath));
});

/**
 * Decode committed generated source metadata.
 *
 * **Example** (Decode committed source metadata)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { getGeneratedSourceMetadata } from "@beep/ai-sync"
 *
 * Effect.runPromise(getGeneratedSourceMetadata()).then((sources) =>
 *   console.log(sources.length)
 * )
 * ```
 *
 * @effects Decodes committed generated metadata in memory and fails with
 * `AiSyncError` if the generated constants no longer match the metadata schema.
 * @category constants
 * @since 0.0.0
 */
export const getGeneratedSourceMetadata = Effect.fn("AiSync.getGeneratedSourceMetadata")(function* () {
  return yield* AiSyncSourceMetadata.decodeArrayEffect(GENERATED_TIER_ONE_SOURCE_METADATA).pipe(
    Effect.mapError((cause) =>
      AiSyncError.make({
        message: "Generated source metadata failed schema validation.",
        cause: O.some(cause),
      })
    )
  );
});

/**
 * Offline generated artifact freshness check.
 *
 * **Example** (Check artifact freshness offline)
 *
 * ```ts
 * import * as NodeServices from "@effect/platform-node/NodeServices"
 * import { Effect } from "effect"
 * import { checkGeneratedArtifacts } from "@beep/ai-sync"
 *
 * const program = checkGeneratedArtifacts().pipe(
 *   Effect.map((report) => report.mode),
 *   Effect.provide(NodeServices.layer)
 * )
 *
 * Effect.runPromise(program).then(console.log)
 * ```
 *
 * @effects Reads committed generated schema and source-metadata files from the
 * package root, decodes generated source metadata, and fails with
 * `AiSyncError` when the generated artifacts are missing or stale.
 * @category validation
 * @since 0.0.0
 */
export const checkGeneratedArtifacts = Effect.fn("AiSync.checkGeneratedArtifacts")(function* () {
  const schemaText = yield* readPackageFile(GENERATED_SCHEMAS_PATH).pipe(
    Effect.mapError((cause) =>
      AiSyncError.make({
        message: `Missing generated schemas at ${GENERATED_SCHEMAS_PATH}. Run bun run generate.`,
        cause: O.some(cause),
      })
    )
  );
  const sourceMetadataText = yield* readPackageFile(GENERATED_SOURCE_METADATA_PATH).pipe(
    Effect.mapError((cause) =>
      AiSyncError.make({
        message: `Missing generated source metadata at ${GENERATED_SOURCE_METADATA_PATH}. Run bun run generate.`,
        cause: O.some(cause),
      })
    )
  );
  const expectedSchemaText = renderGeneratedSchemas();
  const generatedSources = yield* getGeneratedSourceMetadata();
  const expectedSources = TIER_ONE_SOURCES;
  const metadataMatchesSourceMap =
    A.length(generatedSources) === A.length(expectedSources) &&
    A.every(expectedSources, (expected) =>
      A.some(
        generatedSources,
        (actual) => AiSyncSourceMetadata.hasSameIdentity(actual, expected) && O.isSome(actual.contentHash)
      )
    );
  const expectedSourceMetadataText = renderGeneratedSourceMetadata(generatedSources);
  if (
    schemaText !== expectedSchemaText ||
    sourceMetadataText !== expectedSourceMetadataText ||
    !metadataMatchesSourceMap
  ) {
    return yield* AiSyncError.make({
      message: "Generated AI sync schema artifacts are stale. Run bun run generate.",
    });
  }
  return AiSyncDriftReport.make({ mode: "local", findings: [] });
});

/**
 * Compare a set of sources with an injected fetcher.
 *
 * **Example** (Compare sources with fetcher)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { AiSyncContentHash, AiSyncSourceId, AiSyncSourceMetadata, AiSyncSourceUrl, checkSourceDriftWithFetcher } from "@beep/ai-sync"
 * import * as O from "effect/Option"
 *
 * const source = AiSyncSourceMetadata.make({
 *   id: AiSyncSourceId.make("synthetic"),
 *   agent: "codex",
 *   domain: "config",
 *   tier: "tier_1",
 *   url: AiSyncSourceUrl.make("https://example.com/schema.json"),
 *   contentHash: O.some(AiSyncContentHash.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")),
 *   isOfficial: true,
 *   driftMechanism: "hash"
 * })
 * const program = checkSourceDriftWithFetcher({
 *   sources: [source],
 *   fetcher: () => Effect.succeed("different")
 * })
 *
 * Effect.runPromise(program).then((findings) => console.log(findings.length))
 * ```
 *
 * @param options - Sources and fetcher used to compare committed hashes.
 * @returns Drift findings for sources whose current content differs.
 * @effects Runs the supplied fetcher for each source with bounded concurrency,
 * hashes each fetched body, and returns findings without writing files.
 * @category validation
 * @since 0.0.0
 */
export const checkSourceDriftWithFetcher = <R>(options: {
  readonly sources: ReadonlyArray<AiSyncSourceMetadata>;
  readonly fetcher: (source: AiSyncSourceMetadata) => Effect.Effect<string, AiSyncError, R>;
}): Effect.Effect<ReadonlyArray<AiSyncDriftFinding>, AiSyncError, R> =>
  Effect.forEach(
    options.sources,
    (source) =>
      options.fetcher(source).pipe(
        Effect.flatMap(hashSourceText),
        Effect.map((actualHash) =>
          O.contains(source.contentHash, actualHash)
            ? A.empty<AiSyncDriftFinding>()
            : A.make(
                AiSyncDriftFinding.make({
                  sourceId: source.id,
                  expectedHash: source.contentHash,
                  actualHash,
                  message: `${source.id} content hash differs from committed metadata.`,
                })
              )
        )
      ),
    { concurrency: 3 }
  ).pipe(Effect.map(A.flatten));

/**
 * Networked strict drift check against committed Tier-1 hashes.
 *
 * **Example** (Run networked strict drift check)
 *
 * ```ts
 * import * as NodeServices from "@effect/platform-node/NodeServices"
 * import { Effect, Layer } from "effect"
 * import { checkStrictDrift } from "@beep/ai-sync"
 * import { AiSyncHttpLayer } from "@beep/ai-sync/generator"
 *
 * const RuntimeLayer = Layer.mergeAll(NodeServices.layer, AiSyncHttpLayer)
 * const program = checkStrictDrift().pipe(
 *   Effect.map((report) => report.findings.length),
 *   Effect.provide(RuntimeLayer)
 * )
 *
 * Effect.runPromise(program).then(console.log)
 * ```
 *
 * @effects Fetches each committed Tier-1 source through the configured HTTP
 * client, hashes the current response bodies, and reports drift findings
 * without writing files.
 * @category validation
 * @since 0.0.0
 */
export const checkStrictDrift = Effect.fn("AiSync.checkStrictDrift")(function* () {
  const generatedSources = yield* getGeneratedSourceMetadata();
  const findings = yield* checkSourceDriftWithFetcher({ sources: generatedSources, fetcher: fetchSourceText });

  return AiSyncDriftReport.make({ mode: "strict", findings });
});

/**
 * Fail when strict drift reports any findings.
 *
 * **Example** (Fail on strict drift findings)
 *
 * ```ts
 * import * as NodeServices from "@effect/platform-node/NodeServices"
 * import { Effect, Layer } from "effect"
 * import { assertNoStrictDrift } from "@beep/ai-sync"
 * import { AiSyncHttpLayer } from "@beep/ai-sync/generator"
 *
 * const RuntimeLayer = Layer.mergeAll(NodeServices.layer, AiSyncHttpLayer)
 * const program = assertNoStrictDrift().pipe(
 *   Effect.map((report) => report.mode),
 *   Effect.provide(RuntimeLayer)
 * )
 *
 * Effect.runPromise(program).then(console.log)
 * ```
 *
 * @effects Executes the strict network drift check and fails with `AiSyncError`
 * containing a source-by-source summary when any committed Tier-1 hash has
 * drifted.
 * @category validation
 * @since 0.0.0
 */
export const assertNoStrictDrift = Effect.fn("AiSync.assertNoStrictDrift")(function* () {
  return yield* checkStrictDrift().pipe(
    Effect.filterOrFail(
      (report) => !(A.length(report.findings) > 0),
      (report) =>
        AiSyncError.make({
          message: pipe(
            report.findings,
            A.map(
              (finding) =>
                `${finding.sourceId}: ${O.getOrElse(finding.expectedHash, () => "missing")} -> ${finding.actualHash}`
            ),
            A.join("\n")
          ),
        })
    )
  );
});
