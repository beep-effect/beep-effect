import * as NLPService from "@beep/nlp-processing/NLPService";
import { SourceTextExtractor } from "@beep/provenance";
import { NonNegativeInt } from "@beep/schema";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { WinkBackendLive, WinkEngineLive } from "@beep/wink";
import { Clock, Console, Crypto, DateTime, Effect, FileSystem, Layer, Number as N, Order, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { writeJsonArtifact } from "@/canary/Artifact";
import { CorpusPaperId } from "@/corpus/Manifest";
import { CorpusManifestBuilder } from "@/corpus/ManifestBuilder";
import { F1Catalog, F1Index } from "@/fixtures/F1";
import { loadDocumentSelection } from "@/layers/DocumentSourceLive";
import { EvaluatorLive } from "@/layers/EvaluatorLive";
import {
  HOSTED_EXTRACTION_ARTIFACT_HASH,
  HostedLangExtractLive,
  PATTERN_MODEL_IDENTITY,
  PatternExtractorLive,
} from "@/layers/ExtractorLive";
import { GoldSourceLive } from "@/layers/GoldSourceLive";
import {
  ActiveModelIdentityLive,
  AnthropicExtractionModelIdentity,
  LanguageModelRuntimeLive,
} from "@/layers/LanguageModelLive";
import { LedgerLive } from "@/layers/LedgerLive";
import { LabConfig, RuntimeMode } from "@/runtime/Config";
import { SEMANTICA_VERSION } from "@/runtime/Version";
import { contentDigest } from "@/schema/Digest";
import { C0ExecutionFailed, GoldUnavailable, ReportInvalid } from "@/schema/Errors";
import { EvalReport, EvalRun, EvalSelection, EvalSelectionMode, makeRunId } from "@/schema/Eval";
import { C0ExecutionResult } from "@/schema/Execution";
import { GoldRef } from "@/schema/Gold";
import { EventBody, makeProvenanceEventId, ProvenanceEvent } from "@/schema/Provenance";
import { EvalRunTelemetry } from "@/schema/Telemetry";
import { CanaryC0 } from "@/services/CanaryC0";
import { Canonicalizer } from "@/services/Canonicalizer";
import { Chunker } from "@/services/Chunker";
import { DocumentSource } from "@/services/DocumentSource";
import { Evaluator } from "@/services/Evaluator";
import { HostedExtractor, PatternExtractor } from "@/services/Extractor";
import { Ledger } from "@/services/Ledger";
import { Parser } from "@/services/Parser";
import { ProviderCache } from "@/services/ProviderCache";
import type { Config } from "effect";
import type * as LanguageModel from "effect/unstable/ai/LanguageModel";
import type { CanaryOptions } from "@/canary/Command";
import type { F1FixtureId } from "@/fixtures/F1";
import type { SourceDocument } from "@/schema/Document";
import type { ExtractOutcome as ExtractOutcomeValue } from "@/schema/Evidence";
import type { EventBody as EventBodyValue, ProvenanceEvent as ProvenanceEventValue } from "@/schema/Provenance";
import type { ParseOutcome } from "@/schema/Text";
import type { GoldSource } from "@/services/GoldSource";

const GoldRefJson = S.fromJsonString(GoldRef).pipe(SchemaUtils.withCodecStatics(["decodeEffect"]));
const EvalReportJson = S.fromJsonString(EvalReport, { space: 2 });
const EvalTelemetryJson = S.fromJsonString(EvalRunTelemetry, { space: 2 });
const fallbackExtractor = SourceTextExtractor.make({
  name: "semantica-parser-degraded",
  version: SEMANTICA_VERSION,
});

const executionFailed = (message: string): C0ExecutionFailed => C0ExecutionFailed.make({ message });

const selectionIncludesW1: (selection: EvalSelectionMode) => boolean = EvalSelectionMode.$match({
  f1: () => false,
  "f1+w1": () => true,
});

const makeEvent = Effect.fn("CanaryC0.makeEvent")(function* (
  body: EventBodyValue,
  prev: O.Option<ProvenanceEventValue["id"]>
) {
  const id = yield* Effect.fromResult(
    makeProvenanceEventId({
      body,
      prev,
    })
  ).pipe(Effect.orDie);
  return ProvenanceEvent.make({ body, id, prev });
});

const parsedEventBody = (document: SourceDocument, outcome: ParseOutcome): EventBodyValue =>
  EventBody.cases.Parsed.make({
    document: document.id,
    extractor: outcome.outcome === "Parsed" ? outcome.extractor : fallbackExtractor,
    kind: "Parsed",
    outcome: outcome.outcome === "Parsed" ? "parsed" : outcome.kind,
  });

const batchEvents = Effect.fn("CanaryC0.batchEvents")(function* (
  outcome: ExtractOutcomeValue,
  previous: ProvenanceEventValue
) {
  if (outcome.outcome === "Degraded") {
    return [previous] as const;
  }
  const extracted = yield* makeEvent(
    EventBody.cases.Extracted.make({
      batch: outcome.batch.id,
      kind: "Extracted",
      model: outcome.batch.model,
    }),
    O.some(previous.id)
  );
  return [
    extracted,
    yield* makeEvent(
      EventBody.cases.Asserted.make({
        claims: A.map(outcome.batch.claims, (claim) => claim.id),
        kind: "Asserted",
      }),
      O.some(extracted.id)
    ),
  ] as const;
});

const selectedPaper = (paper: O.Option<string>) =>
  O.match(paper, {
    onNone: () => Effect.succeed(O.none<CorpusPaperId>()),
    onSome: (value) =>
      CorpusPaperId.decodeEffect(value).pipe(
        Effect.asSome,
        Effect.mapError(() => executionFailed("The requested --paper value is not a valid W1 corpus id."))
      ),
  });

const directoryBytes = Effect.fn("CanaryC0.directoryBytes")(function* (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  target: string
): Effect.fn.Return<number, C0ExecutionFailed> {
  const info = yield* fs.stat(target).pipe(Effect.option);
  if (O.isNone(info)) {
    return 0;
  }
  if (info.value.type === "File") {
    return Number(info.value.size);
  }
  if (info.value.type !== "Directory") {
    return 0;
  }
  const entries = yield* fs
    .readDirectory(target)
    .pipe(Effect.mapError(() => executionFailed("The C0 ledger size could not be measured.")));
  const sizes = yield* Effect.forEach(entries, (entry) => directoryBytes(fs, path, path.join(target, entry)), {
    concurrency: 4,
  });
  return N.sumAll(sizes);
});

/**
 * Returns the nearest-rank p95 for a bounded timing sample.
 *
 * **Example** (Select a small-sample p95)
 *
 * ```ts
 * import { p95 } from "@/layers/CanaryC0Live"
 *
 * console.log(p95([1, 2, 3])) // 3
 * ```
 *
 * @category observability
 * @since 0.0.0
 */
export const p95 = (timings: ReadonlyArray<number>): number =>
  A.match(A.sort(timings, Order.Number), {
    onEmpty: () => 0,
    onNonEmpty: (ordered) => {
      let rank = 0;
      while (N.multiply(rank + 1, 100) < N.multiply(A.length(ordered), 95)) {
        rank += 1;
      }
      return A.get(ordered, rank).pipe(O.getOrElse(() => A.lastNonEmpty(ordered)));
    },
  });

const makeCanaryC0 = Effect.fn("CanaryC0.make")(function* (
  hostedProvider: Layer.Layer<LanguageModel.LanguageModel, Config.ConfigError>,
  goldSourceLayer: (
    directory: string
  ) => Layer.Layer<GoldSource, never, Crypto.Crypto | FileSystem.FileSystem | Path.Path>
) {
  const canonicalizer = yield* Canonicalizer;
  const chunker = yield* Chunker;
  const config = yield* LabConfig;
  const corpusManifestBuilder = yield* CorpusManifestBuilder;
  const crypto = yield* Crypto.Crypto;
  const documentSource = yield* DocumentSource;
  const f1Catalog = yield* F1Catalog;
  const fs = yield* FileSystem.FileSystem;
  const parser = yield* Parser;
  const path = yield* Path.Path;
  const providerCache = yield* ProviderCache;

  const runWithSnapshot = Effect.fn("CanaryC0.runWithSnapshot")(function* (options: CanaryOptions) {
    const startedAt = yield* DateTime.now;
    const startedMillis = yield* Clock.currentTimeMillis;
    const paper = yield* selectedPaper(options.paper);
    const includeW1 = selectionIncludesW1(options.selection);
    if (!includeW1 && O.isSome(paper)) {
      return yield* executionFailed("The --paper flag requires --selection f1+w1.");
    }
    const selection = yield* loadDocumentSelection(options.manifest, paper, includeW1).pipe(
      Effect.provideService(CorpusManifestBuilder, corpusManifestBuilder),
      Effect.provideService(F1Catalog, f1Catalog),
      Effect.mapError(() => executionFailed("The C0 document selection failed validation."))
    );
    const goldPath = path.join(config.goldDirectory, "gold.json");
    const gold = yield* fs.readFileString(goldPath).pipe(
      Effect.flatMap(GoldRefJson.decodeEffect),
      Effect.mapError(() =>
        GoldUnavailable.make({
          message: `Required gold reference is unavailable: ${goldPath}`,
          reason: "read-failed",
        })
      )
    );
    const documents = yield* documentSource.list(selection);
    const w1 = A.getSomes(
      A.map(documents, (document) =>
        document.origin.kind === "W1Paper" ? O.some(document.origin.paperId) : O.none<CorpusPaperId>()
      )
    );
    const f1 = A.getSomes(
      A.map(documents, (document) =>
        document.origin.kind === "Fixture" ? O.some(document.origin.fixtureId) : O.none<F1FixtureId>()
      )
    );
    const selectedF1 = yield* A.match(f1, {
      onEmpty: () => Effect.fail(executionFailed("C0 requires at least one F1 fixture.")),
      onNonEmpty: Effect.succeed,
    });
    const hostedModel = yield* AnthropicExtractionModelIdentity({
      artifactHash: yield* HOSTED_EXTRACTION_ARTIFACT_HASH.pipe(Effect.provideService(Crypto.Crypto, crypto)),
      model: config.extractorModel,
    });
    const runBody = {
      corpusHash: selection.manifest.corpusHash,
      extractor: hostedModel,
      fixtureIndexDigest: yield* contentDigest(F1Index)(selection.fixtures).pipe(
        Effect.provideService(Crypto.Crypto, crypto),
        Effect.orDie
      ),
      gold,
      patternLane: PATTERN_MODEL_IDENTITY,
      selection: EvalSelection.make({ f1: selectedF1, w1 }),
      stage: "c0" as const,
    };
    const run = EvalRun.make({ ...runBody, id: yield* Effect.fromResult(makeRunId(runBody)).pipe(Effect.orDie) });
    const mode = RuntimeMode.$match(config.offline || options.offline ? "replay" : "live", {
      live: () => "live" as const,
      replay: () => "replay" as const,
    });
    const selectedConfig = LabConfig.of({ ...config, mode, offline: mode === "replay" });
    const ledgerDirectory = path.join(config.ledgerRoot, run.id, mode);
    yield* fs
      .remove(ledgerDirectory, { force: true, recursive: true })
      .pipe(Effect.mapError(() => executionFailed("The prior C0 mode ledger could not be cleared.")));
    const beforeBytes = yield* directoryBytes(fs, path, ledgerDirectory);

    const support = Layer.mergeAll(
      Layer.succeed(Canonicalizer, canonicalizer),
      Layer.succeed(Crypto.Crypto, crypto),
      Layer.succeed(FileSystem.FileSystem, fs),
      Layer.succeed(LabConfig, selectedConfig),
      Layer.succeed(Path.Path, path),
      Layer.succeed(ProviderCache, providerCache)
    );
    const identity = ActiveModelIdentityLive(hostedModel);
    const languageModel = LanguageModelRuntimeLive(hostedProvider).pipe(
      Layer.provide(identity),
      Layer.provide(support)
    );
    const hosted = HostedLangExtractLive.pipe(
      Layer.provide(languageModel),
      Layer.provide(identity),
      Layer.provide(support)
    );
    const nlp = NLPService.layer(WinkBackendLive).pipe(Layer.provide(WinkEngineLive));
    const pattern = PatternExtractorLive.pipe(Layer.provide(nlp), Layer.provide(support));
    const evaluator = EvaluatorLive.pipe(Layer.provide(goldSourceLayer(config.goldDirectory)), Layer.provide(support));
    const executionLayer = Layer.mergeAll(
      hosted,
      pattern,
      evaluator,
      LedgerLive({ ledgerRoot: config.ledgerRoot, mode, runId: run.id }).pipe(Layer.provide(support))
    );

    const execution = yield* Effect.scoped(
      Layer.build(executionLayer).pipe(
        Effect.mapError(() => executionFailed("The selected C0 execution layers could not be acquired.")),
        Effect.flatMap((context) =>
          Effect.gen(function* () {
            const layersReadyMillis = yield* Clock.currentTimeMillis;
            const hostedExtractor = yield* HostedExtractor;
            const patternExtractor = yield* PatternExtractor;
            const ledger = yield* Ledger;
            const evaluatorService = yield* Evaluator;
            const results = yield* Effect.forEach(
              documents,
              Effect.fnUntraced(function* (document) {
                const documentStarted = yield* Clock.currentTimeMillis;
                const bytes = yield* documentSource.read(document);
                const outcome = yield* parser.parse(document, bytes);
                const ingested = yield* ProvenanceEvent.makeEffect({
                  body: EventBody.cases.Ingested.make({ document: document.id, kind: "Ingested" }),
                  id: document.acquired,
                  prev: O.none(),
                }).pipe(Effect.mapError(() => executionFailed("The document acquisition event id is not canonical.")));
                const parsed = yield* makeEvent(parsedEventBody(document, outcome), O.some(ingested.id));
                if (outcome.outcome === "Degraded") {
                  yield* ledger.appendDocument(document, outcome, O.none(), [], [ingested, parsed]);
                  return {
                    outcomes: [] as ReadonlyArray<ExtractOutcomeValue>,
                    timing: (yield* Clock.currentTimeMillis) - documentStarted,
                  };
                }
                const canonical = yield* canonicalizer.identify(document, outcome);
                const chunks = yield* chunker.chunk(canonical).pipe(Effect.provideService(Crypto.Crypto, crypto));
                const chunked = yield* makeEvent(
                  EventBody.cases.Chunked.make({
                    chunks: A.map(chunks, (chunk) => chunk.id),
                    document: document.id,
                    kind: "Chunked",
                  }),
                  O.some(parsed.id)
                );
                yield* ledger.appendDocument(document, outcome, O.some(canonical), chunks, [ingested, parsed, chunked]);
                const extractionOutcomes = yield* Effect.all(
                  [hostedExtractor.extract(canonical, chunks), patternExtractor.extract(canonical, chunks)],
                  { concurrency: 2 }
                ).pipe(Effect.provideService(Crypto.Crypto, crypto));
                yield* Effect.forEach(
                  extractionOutcomes,
                  Effect.fnUntraced(function* (extraction) {
                    yield* ledger.appendBatch(extraction, yield* batchEvents(extraction, chunked));
                  }),
                  { concurrency: 1, discard: true }
                );
                return { outcomes: extractionOutcomes, timing: (yield* Clock.currentTimeMillis) - documentStarted };
              }),
              { concurrency: 1 }
            );
            const outcomes = A.flatMap(results, (result) => result.outcomes);
            const snapshot = yield* ledger.read(run.id);
            const report = yield* evaluatorService
              .score(run, snapshot, outcomes)
              .pipe(Effect.provideService(Crypto.Crypto, crypto));
            return {
              coldStartMs: N.max(0, layersReadyMillis - startedMillis),
              report,
              snapshot,
              timings: A.map(results, (result) => result.timing),
            };
          }).pipe(Effect.provide(context))
        )
      )
    );

    const endedMillis = yield* Clock.currentTimeMillis;
    const afterBytes = yield* directoryBytes(fs, path, ledgerDirectory);
    const outputDirectory = options.out.pipe(O.getOrElse(() => path.join(".beep/semantica/runs", run.id, mode)));
    yield* fs
      .makeDirectory(outputDirectory, { recursive: true })
      .pipe(Effect.mapError(() => executionFailed("The C0 output directory could not be created.")));
    const telemetry = EvalRunTelemetry.make({
      coldStartMs: NonNegativeInt.make(execution.coldStartMs),
      dependencyBytes: O.none(),
      diskGrowthBytes: NonNegativeInt.make(N.max(0, afterBytes - beforeBytes)),
      mode,
      modelBytes: O.none(),
      p95Ms: NonNegativeInt.make(p95(execution.timings)),
      reportDigest: execution.report.reportDigest,
      rssBytes: NonNegativeInt.make(process.memoryUsage().rss),
      runId: run.id,
      schemaVersion: "eval-telemetry/v1",
      startedAt,
      wallClockMs: NonNegativeInt.make(N.max(0, endedMillis - startedMillis)),
    });
    const artifactFailure = {
      encode: executionFailed("A C0 output artifact did not encode."),
      write: executionFailed("A C0 output artifact could not be written."),
    };
    yield* writeJsonArtifact(
      fs,
      EvalReportJson,
      path.join(outputDirectory, "eval-report.json"),
      execution.report,
      artifactFailure
    );
    yield* writeJsonArtifact(
      fs,
      EvalTelemetryJson,
      path.join(outputDirectory, "eval-telemetry.json"),
      telemetry,
      artifactFailure
    );
    yield* Console.log(execution.report.reportDigest);
    if (execution.report.unexpectedDegraded > 0) {
      return yield* ReportInvalid.make({ message: "C0 completed with unexpected degraded documents." });
    }
    return C0ExecutionResult.make({ report: execution.report, snapshot: execution.snapshot, telemetry });
  });

  return CanaryC0.of({
    run: Effect.fn("CanaryC0.run")((options: CanaryOptions) =>
      runWithSnapshot(options).pipe(Effect.map((result) => result.report))
    ),
    runWithSnapshot,
  });
});

/**
 * Full C0 runner over supplied hosted-model and gold-source Layers.
 *
 * **Example** (Inspect the test seam)
 *
 * ```ts
 * import { CanaryC0WithGoldSourceLive } from "@/layers/CanaryC0Live"
 *
 * console.log(typeof CanaryC0WithGoldSourceLive) // "function"
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const CanaryC0WithGoldSourceLive = (options: {
  readonly goldSourceLayer: (
    directory: string
  ) => Layer.Layer<GoldSource, never, Crypto.Crypto | FileSystem.FileSystem | Path.Path>;
  readonly hostedProvider: Layer.Layer<LanguageModel.LanguageModel, Config.ConfigError>;
}) => Layer.effect(CanaryC0, makeCanaryC0(options.hostedProvider, options.goldSourceLayer));

/**
 * Runtime C0 runner over Anthropic-compatible model input and filesystem gold.
 *
 * **Example** (Inspect the runtime constructor)
 *
 * ```ts
 * import { CanaryC0Live } from "@/layers/CanaryC0Live"
 *
 * console.log(typeof CanaryC0Live) // "function"
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const CanaryC0Live = (hostedProvider: Layer.Layer<LanguageModel.LanguageModel, Config.ConfigError>) =>
  CanaryC0WithGoldSourceLive({ goldSourceLayer: GoldSourceLive, hostedProvider });
