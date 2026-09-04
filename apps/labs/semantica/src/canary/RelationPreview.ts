import { $SemanticaId } from "@beep/identity/packages";
import { AlignmentSource, alignCandidates } from "@beep/langextract/Alignment";
import { parseModelOutput } from "@beep/langextract/Extraction";
import { NonNegativeInt, Sha256Hex } from "@beep/schema";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { Console, Effect, FileSystem, HashSet, Number as N, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CorpusPaperId } from "@/corpus/Manifest";
import { loadDocumentSelection } from "@/layers/DocumentSourceLive";
import { groundHostedExtractions, makeHostedExtractionRequest } from "@/layers/ExtractorLive";
import { LabConfig } from "@/runtime/Config";
import { Origin } from "@/schema/Document";
import { RelationPreviewFailed } from "@/schema/Errors";
import { ProviderCacheEntry } from "@/schema/ProviderCache";
import { Canonicalizer } from "@/services/Canonicalizer";
import { Chunker } from "@/services/Chunker";
import { DocumentSource } from "@/services/DocumentSource";
import { Parser } from "@/services/Parser";
import type { SourceDocument } from "@/schema/Document";

const $I = $SemanticaId.create("canary/RelationPreview");

class RelationPreviewCase extends S.Class<RelationPreviewCase>($I`RelationPreviewCase`)(
  { cacheDigest: Sha256Hex, paperId: CorpusPaperId },
  $I.annote("RelationPreviewCase", {
    description: "Historical cache key and W1 paper identity replayed by one zero-spend preview case.",
  })
) {}

/**
 * Versioned set of historical responses required by the E5 preview gate.
 *
 * **Example** (Inspect the case field)
 *
 * ```ts
 * import { RelationPreviewManifest } from "@/canary/RelationPreview"
 *
 * console.log(RelationPreviewManifest.fields.cases !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RelationPreviewManifest extends S.Class<RelationPreviewManifest>($I`RelationPreviewManifest`)(
  {
    cases: S.NonEmptyArray(RelationPreviewCase),
    schemaVersion: S.Literal("semantica-relation-preview/v1"),
  },
  $I.annote("RelationPreviewManifest", {
    description: "Committed E5 cache-preview case set with a versioned wire contract.",
  })
) {}

/**
 * Command inputs for one offline relation preview.
 *
 * **Example** (Create preview options)
 *
 * ```ts
 * import { RelationPreviewOptions } from "@/canary/RelationPreview"
 *
 * const options = RelationPreviewOptions.make({
 *   cases: "fixtures/relation-preview.json",
 *   manifest: "fixtures/w1.manifest.json"
 * })
 * console.log(options.cases) // "fixtures/relation-preview.json"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RelationPreviewOptions extends S.Class<RelationPreviewOptions>($I`RelationPreviewOptions`)(
  { cases: S.NonEmptyString, manifest: S.NonEmptyString },
  $I.annote("RelationPreviewOptions", {
    description: "Paths to the committed E5 case set and verified W1 manifest.",
  })
) {}

class RelationPreviewCaseResult extends S.Class<RelationPreviewCaseResult>($I`RelationPreviewCaseResult`)(
  {
    cacheKey: Sha256Hex,
    candidateCount: NonNegativeInt,
    degradedRelations: NonNegativeInt,
    groundedRelations: NonNegativeInt,
    paperId: CorpusPaperId,
    relationCandidates: NonNegativeInt,
  },
  $I.annote("RelationPreviewCaseResult", {
    description: "Parsed, relation-candidate, grounded, and degraded counts for one historical response.",
  })
) {}

class RelationPreviewReport extends S.Class<RelationPreviewReport>($I`RelationPreviewReport`)(
  {
    cases: S.NonEmptyArray(RelationPreviewCaseResult),
    groundedPapers: NonNegativeInt,
    groundedRelations: NonNegativeInt,
    passed: S.Literal(true),
    schemaVersion: S.Literal("semantica-relation-preview-report/v1"),
  },
  $I.annote("RelationPreviewReport", {
    description: "Successful zero-spend preview with at least one grounded relation on at least one paper.",
  })
) {}

const PreviewManifestJson = S.fromJsonString(RelationPreviewManifest).pipe(
  SchemaUtils.withCodecStatics(["decodeEffect", "encodeEffect"])
);
const ProviderCacheEntryJson = S.fromJsonString(ProviderCacheEntry).pipe(
  SchemaUtils.withCodecStatics(["encodeEffect", "decodeEffect"])
);
const PreviewReportJson = S.fromJsonString(RelationPreviewReport, { space: 2 }).pipe(
  SchemaUtils.withCodecStatics(["encodeEffect"])
);

const failed = (reason: RelationPreviewFailed["reason"], message: string): RelationPreviewFailed =>
  RelationPreviewFailed.make({ message, reason });

const isSelectedPaper =
  (paperId: CorpusPaperId) =>
  (document: SourceDocument): boolean =>
    Origin.match(document.origin, {
      Fixture: () => false,
      W1Paper: (origin) => Str.Equivalence(origin.paperId, paperId),
    });

const loadCanonicalPaper = Effect.fn("RelationPreview.loadCanonicalPaper")(function* (
  manifestPath: string,
  paperId: CorpusPaperId
) {
  const source = yield* DocumentSource;
  const parser = yield* Parser;
  const canonicalizer = yield* Canonicalizer;
  const chunker = yield* Chunker;
  const selection = yield* loadDocumentSelection(manifestPath, O.some(paperId), true).pipe(
    Effect.mapError(() => failed("manifest-invalid", "The E5 W1 manifest did not pass its integrity check."))
  );
  const documents = yield* source
    .list(selection)
    .pipe(Effect.mapError(() => failed("source-unavailable", "The selected E5 source paper could not be listed.")));
  const document = yield* A.findFirst(documents, isSelectedPaper(paperId)).pipe(
    Effect.fromOption,
    Effect.mapError(() => failed("source-unavailable", "The selected E5 source paper was absent from the listing."))
  );
  const bytes = yield* source
    .read(document)
    .pipe(Effect.mapError(() => failed("source-unavailable", "The selected E5 source paper could not be read.")));
  const parsed = yield* parser.parse(document, bytes);
  if (parsed.outcome === "Degraded") {
    return yield* failed("parse-degraded", "The selected E5 source paper produced a typed degraded parse.");
  }
  const canonical = yield* canonicalizer.identify(document, parsed);
  return { canonical, canonicalizer, chunks: yield* chunker.chunk(canonical) };
});

const readPreviewManifest = Effect.fn("RelationPreview.readManifest")(function* (filePath: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readFileString(filePath).pipe(
    Effect.flatMap(PreviewManifestJson.decodeEffect),
    Effect.mapError(() => failed("manifest-invalid", "The E5 preview manifest could not be read or decoded."))
  );
});

const readCacheEntry = Effect.fn("RelationPreview.readCacheEntry")(function* (cacheKey: Sha256Hex) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const config = yield* LabConfig;
  const filePath = path.join(config.providerCacheDirectory, `${cacheKey}.json`);
  const source = yield* fs
    .readFileString(filePath)
    .pipe(Effect.mapError(() => failed("cache-unavailable", "A required E5 provider-cache entry is unavailable.")));
  const entry = yield* ProviderCacheEntryJson.decodeEffect(source).pipe(
    Effect.mapError(() => failed("cache-invalid", "A required E5 provider-cache entry failed integrity decoding."))
  );
  if (!Str.Equivalence(entry.cacheKey, cacheKey)) {
    return yield* failed("cache-invalid", "An E5 cache file did not match its selected cache key.");
  }
  return entry;
});

const previewCase = Effect.fn("RelationPreview.previewCase")(function* (
  manifestPath: string,
  preview: RelationPreviewCase
) {
  const entry = yield* readCacheEntry(preview.cacheDigest);
  const { canonical, canonicalizer, chunks } = yield* loadCanonicalPaper(manifestPath, preview.paperId);
  const candidates = yield* parseModelOutput(entry.response).pipe(
    Effect.mapError(() => failed("response-invalid", "An E5 cached response did not decode as LangExtract output."))
  );
  const extractions = alignCandidates(candidates, AlignmentSource.fromRequest(makeHostedExtractionRequest(canonical)));
  const outcome = yield* groundHostedExtractions(
    canonicalizer,
    canonical,
    chunks,
    extractions,
    entry.key.model,
    O.some(entry.cacheKey)
  );
  if (outcome.outcome === "Degraded") {
    return yield* failed("response-invalid", "The E5 cached response did not produce an extracted evidence batch.");
  }
  const relationCandidates = A.length(A.filter(extractions, (item) => Str.Equivalence(item.label, "relation")));
  const groundedRelations = A.length(A.filter(outcome.batch.claims, (claim) => claim.body.kind === "Relation"));
  return RelationPreviewCaseResult.make({
    cacheKey: preview.cacheDigest,
    candidateCount: NonNegativeInt.make(A.length(extractions)),
    degradedRelations: NonNegativeInt.make(N.subtract(relationCandidates, groundedRelations)),
    groundedRelations: NonNegativeInt.make(groundedRelations),
    paperId: preview.paperId,
    relationCandidates: NonNegativeInt.make(relationCandidates),
  });
});

/**
 * Replays the committed breaker responses through the production relation
 * grounding boundary without calling a hosted provider.
 *
 * **Example** (Build the preview effect)
 *
 * ```ts
 * import { RelationPreviewOptions, runRelationPreview } from "@/canary/RelationPreview"
 *
 * const preview = runRelationPreview(RelationPreviewOptions.make({
 *   cases: "fixtures/relation-preview.json",
 *   manifest: "fixtures/w1.manifest.json"
 * }))
 * console.log(typeof preview) // "object"
 * ```
 *
 * @effects Reads verified local corpus and cache files and prints a successful report.
 * @category workflows
 * @since 0.0.0
 */
export const runRelationPreview = Effect.fn("RelationPreview.run")(function* (options: RelationPreviewOptions) {
  const manifest = yield* readPreviewManifest(options.cases);
  const cases = yield* Effect.forEach(manifest.cases, (preview) => previewCase(options.manifest, preview), {
    concurrency: 1,
  });
  const groundedRelations = A.reduce(cases, 0, (total, result) => N.sum(total, result.groundedRelations));
  const groundedPapers = HashSet.size(
    HashSet.fromIterable(
      A.map(
        A.filter(cases, (result) => N.isGreaterThan(result.groundedRelations, 0)),
        (result) => result.paperId
      )
    )
  );
  if (N.Equivalence(groundedRelations, 0) || N.Equivalence(groundedPapers, 0)) {
    return yield* failed(
      "preview-floor-not-met",
      "The E5 preview grounded no relation on any selected historical response."
    );
  }
  const report = RelationPreviewReport.make({
    cases,
    groundedPapers: NonNegativeInt.make(groundedPapers),
    groundedRelations: NonNegativeInt.make(groundedRelations),
    passed: true,
    schemaVersion: "semantica-relation-preview-report/v1",
  });
  const json = yield* PreviewReportJson.encodeEffect(report).pipe(Effect.orDie);
  yield* Console.log(json);
  return report;
});
