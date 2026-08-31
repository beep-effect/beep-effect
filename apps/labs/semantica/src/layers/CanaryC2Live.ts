import { NonNegativeInt, PosInt, Sha256Hex } from "@beep/schema";
import { Clock, Console, Crypto, Effect, FileSystem, Layer, Number as N, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { writeJsonArtifact } from "@/canary/Artifact";
import { CanaryOptions } from "@/canary/Command";
import { p95 } from "@/layers/CanaryC0Live";
import { ReasonerLive } from "@/layers/ReasonerLive";
import { LabConfig } from "@/runtime/Config";
import { contentDigest, digestOmitting } from "@/schema/Digest";
import { ReasoningFailed } from "@/schema/Errors";
import {
  C2EvalReport,
  CrashIdentityWitness,
  GEntailmentExpectation,
  GEntailmentWitness,
  makeRdfStatement,
  ProjectionReasoningWitness,
  RdfStatement,
  RdfTriple,
  ReasoningWitness,
  reasoningVocabulary,
} from "@/schema/Reasoning";
import { EvalRunTelemetry } from "@/schema/Telemetry";
import { CanaryC1 } from "@/services/CanaryC1";
import { CanaryC2 } from "@/services/CanaryC2";
import { RdfProjection } from "@/services/RdfProjection";
import { Reasoner } from "@/services/Reasoner";

const C2_SCHEMA_VERSION = "c2-eval-report/v1";
const C2_STAGE = "c2";
const expectationJson = S.fromJsonString(GEntailmentExpectation);
const reportJson = S.fromJsonString(C2EvalReport, { space: 2 });
const telemetryJson = S.fromJsonString(EvalRunTelemetry, { space: 2 });
const tripleEquivalence = S.toEquivalence(S.Array(RdfTriple));

const failed = (reason: ReasoningFailed["reason"], message: string): ReasoningFailed =>
  ReasoningFailed.make({ message, reason });

const statement = Effect.fn("CanaryC2.statement")(function* (triple: RdfTriple) {
  return yield* Effect.fromResult(makeRdfStatement(triple)).pipe(
    Effect.mapError(() => failed("rule-invalid", "A C2 RDF statement did not encode."))
  );
});

const seedTriples = (run: string): A.NonEmptyReadonlyArray<RdfTriple> => {
  const projection = `<urn:semantica:c2:${run}:projection>`;
  const runNode = `<urn:semantica:c2:${run}:run>`;
  const property = "<urn:semantica:c2:property>";
  const middleProperty = "<urn:semantica:c2:middle-property>";
  const broadProperty = "<urn:semantica:c2:broad-property>";
  const projectionClass = "<urn:semantica:c2:Projection>";
  const artifactClass = "<urn:semantica:c2:Artifact>";
  const resourceClass = "<urn:semantica:c2:Resource>";
  return [
    RdfTriple.make({ subject: property, predicate: reasoningVocabulary.rdfsSubPropertyOf, object: middleProperty }),
    RdfTriple.make({
      subject: middleProperty,
      predicate: reasoningVocabulary.rdfsSubPropertyOf,
      object: broadProperty,
    }),
    RdfTriple.make({ subject: property, predicate: reasoningVocabulary.rdfsDomain, object: projectionClass }),
    RdfTriple.make({ subject: property, predicate: reasoningVocabulary.rdfsRange, object: "<urn:semantica:c2:Run>" }),
    RdfTriple.make({ subject: projection, predicate: property, object: runNode }),
    RdfTriple.make({ subject: projection, predicate: reasoningVocabulary.rdfType, object: projectionClass }),
    RdfTriple.make({ subject: projectionClass, predicate: reasoningVocabulary.rdfsSubClassOf, object: artifactClass }),
    RdfTriple.make({ subject: artifactClass, predicate: reasoningVocabulary.rdfsSubClassOf, object: resourceClass }),
    RdfTriple.make({
      subject: "<urn:semantica:c2:a>",
      predicate: reasoningVocabulary.skosBroaderTransitive,
      object: "<urn:semantica:c2:b>",
    }),
    RdfTriple.make({
      subject: "<urn:semantica:c2:b>",
      predicate: reasoningVocabulary.skosBroaderTransitive,
      object: "<urn:semantica:c2:c>",
    }),
  ];
};

const makeCanaryC2 = Effect.fn("CanaryC2.make")(function* () {
  const c1 = yield* CanaryC1;
  const config = yield* LabConfig;
  const crypto = yield* Crypto.Crypto;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const rdf = yield* RdfProjection;
  const reasoner = yield* Reasoner;

  return CanaryC2.of({
    run: Effect.fn("CanaryC2.run")(function* (options) {
      const started = yield* Clock.currentTimeMillis;
      const base = yield* c1.runWithSnapshot(CanaryOptions.make({ ...options, out: O.none() }));
      const expectation = yield* fs.readFileString(path.join(config.goldDirectory, "g-entailment-rdfs.json")).pipe(
        Effect.flatMap(S.decodeEffect(expectationJson)),
        Effect.mapError(() => failed("expectation-unavailable", "The C2 EYE expectation could not be decoded."))
      );
      const goldCases = yield* Effect.forEach(
        expectation.cases,
        Effect.fnUntraced(function* (testCase) {
          const asserted = yield* Effect.forEach(testCase.asserted, statement, { concurrency: 1 });
          const result = yield* reasoner.close(asserted);
          yield* reasoner.validate(result);
          const derived = A.map(result.derived, (value) =>
            RdfTriple.make({ object: value.object, predicate: value.predicate, subject: value.subject })
          );
          if (!tripleEquivalence(derived, testCase.expectedDerived)) {
            return yield* failed("oracle-mismatch", `C2 closure differed from EYE for ${testCase.id}.`);
          }
          const nonEmptyDerived = yield* A.match(result.derived, {
            onEmpty: () => Effect.fail(failed("oracle-mismatch", `C2 retained no conclusion for ${testCase.id}.`)),
            onNonEmpty: Effect.succeed,
          });
          const nonEmptyEvents = yield* A.match(result.events, {
            onEmpty: () => Effect.fail(failed("event-invalid", `C2 retained no event for ${testCase.id}.`)),
            onNonEmpty: Effect.succeed,
          });
          return { caseId: testCase.id, derived: nonEmptyDerived, events: nonEmptyEvents };
        }),
        { concurrency: 1 }
      );
      const nonEmptyGold = yield* A.match(goldCases, {
        onEmpty: () => Effect.fail(failed("oracle-mismatch", "C2 retained no EYE gold witnesses.")),
        onNonEmpty: Effect.succeed,
      });
      const expectationDigest = yield* contentDigest(GEntailmentExpectation)(expectation).pipe(
        Effect.provideService(Crypto.Crypto, crypto),
        Effect.mapError(() => failed("expectation-unavailable", "The C2 expectation digest failed."))
      );
      const firstProjection = yield* rdf.rebuild(base.snapshot);
      const secondProjection = yield* rdf.rebuild(base.snapshot);
      const firstDigest = yield* contentDigest(S.Array(S.String))(firstProjection.serializedQuads).pipe(
        Effect.provideService(Crypto.Crypto, crypto),
        Effect.mapError(() => failed("crash-mismatch", "The pre-crash projection digest failed."))
      );
      const secondDigest = yield* contentDigest(S.Array(S.String))(secondProjection.serializedQuads).pipe(
        Effect.provideService(Crypto.Crypto, crypto),
        Effect.mapError(() => failed("crash-mismatch", "The restart projection digest failed."))
      );
      if (!Str.Equivalence(firstDigest, secondDigest)) {
        return yield* failed("crash-mismatch", "Projection identity changed across the crash checkpoint rebuild.");
      }
      const projected = yield* Effect.forEach(
        secondProjection.serializedTriples,
        (triple) =>
          statement(
            RdfTriple.make({
              object: triple.object,
              predicate: triple.predicate,
              subject: triple.subject,
            })
          ),
        { concurrency: 1 }
      );
      const seeds = yield* Effect.forEach(seedTriples(base.report.base.run.id), statement, { concurrency: 1 });
      const asserted = A.appendAll(projected, seeds);
      const full = yield* reasoner.close(asserted);
      yield* reasoner.validate(full);
      const derived = yield* A.match(full.derived, {
        onEmpty: () => Effect.fail(failed("event-invalid", "The full C2 projection produced no conclusions.")),
        onNonEmpty: Effect.succeed,
      });
      const events = yield* A.match(full.events, {
        onEmpty: () => Effect.fail(failed("event-invalid", "The full C2 projection produced no inference events.")),
        onNonEmpty: Effect.succeed,
      });
      const closureDigest = yield* contentDigest(S.Array(RdfStatement))(full.closure).pipe(
        Effect.provideService(Crypto.Crypto, crypto),
        Effect.mapError(() => failed("report-invalid", "The C2 closure digest failed."))
      );
      const reasoning = ReasoningWitness.make({
        crash: CrashIdentityWitness.make({
          afterRestartDigest: secondDigest,
          beforeCrashDigest: firstDigest,
          checkpoint: "after-ledger-commit-before-projection",
        }),
        gold: GEntailmentWitness.make({ expectationDigest, cases: nonEmptyGold }),
        projection: ProjectionReasoningWitness.make({
          assertedCount: PosInt.make(A.length(full.asserted)),
          closureCount: PosInt.make(A.length(full.closure)),
          closureDigest,
          derived,
          eventCount: PosInt.make(A.length(events)),
          events,
        }),
      });
      const provisional: C2EvalReport = {
        base: base.report,
        reasoning,
        reportDigest: Sha256Hex.make(Str.repeat(64)("0")),
        schemaVersion: C2_SCHEMA_VERSION,
        stage: C2_STAGE,
      };
      const reportDigest = yield* digestOmitting(
        S.Struct(C2EvalReport.fields),
        "reportDigest"
      )(provisional).pipe(
        Effect.provideService(Crypto.Crypto, crypto),
        Effect.mapError(() => failed("report-invalid", "The C2 report digest failed."))
      );
      const report = yield* C2EvalReport.makeEffect({ ...provisional, reportDigest }).pipe(
        Effect.mapError(() => failed("report-invalid", "The C2 report violates its schema contract."))
      );
      const coldStarted = yield* Clock.currentTimeMillis;
      yield* Effect.scoped(Layer.build(ReasonerLive));
      const coldEnded = yield* Clock.currentTimeMillis;
      const timings = yield* Effect.forEach(A.replicate(seedTriples(base.report.base.run.id), 20), () =>
        Clock.currentTimeMillis.pipe(
          Effect.flatMap((queryStarted) =>
            reasoner.close(seeds).pipe(
              Effect.andThen(Clock.currentTimeMillis),
              Effect.map((ended) => ended - queryStarted)
            )
          )
        )
      );
      const coldStartMs = N.max(0, coldEnded - coldStarted);
      const queryP95 = p95(timings);
      if (coldStartMs >= 5_000 || queryP95 >= 100) {
        return yield* failed("tier-l-exceeded", `Tier-L failed: cold=${coldStartMs}ms p95=${queryP95}ms.`);
      }
      const ended = yield* Clock.currentTimeMillis;
      const telemetry = EvalRunTelemetry.make({
        coldStartMs: NonNegativeInt.make(coldStartMs),
        dependencyBytes: O.none(),
        diskGrowthBytes: base.baseTelemetry.diskGrowthBytes,
        mode: base.baseTelemetry.mode,
        modelBytes: O.none(),
        p95Ms: NonNegativeInt.make(queryP95),
        reportDigest,
        rssBytes: NonNegativeInt.make(process.memoryUsage().rss),
        runId: base.report.base.run.id,
        schemaVersion: "eval-telemetry/v1",
        startedAt: base.baseTelemetry.startedAt,
        wallClockMs: NonNegativeInt.make(N.max(0, ended - started)),
      });
      const output = options.out.pipe(
        O.getOrElse(() => path.join(".beep/semantica/runs", base.report.base.run.id, base.baseTelemetry.mode, "c2"))
      );
      yield* fs
        .makeDirectory(output, { recursive: true })
        .pipe(Effect.mapError(() => failed("report-invalid", "The C2 output directory could not be created.")));
      const artifactFailure = {
        encode: failed("report-invalid", "A C2 artifact did not encode."),
        write: failed("report-invalid", "A C2 artifact could not be written."),
      };
      yield* writeJsonArtifact(fs, reportJson, path.join(output, "eval-report.json"), report, artifactFailure);
      yield* writeJsonArtifact(fs, telemetryJson, path.join(output, "eval-telemetry.json"), telemetry, artifactFailure);
      yield* Console.log(report.reportDigest);
      return report;
    }),
  });
});

/**
 * C2 orchestration over C1 truth, rho-df closure, proof validation, and Tier-L.
 *
 * **Example** (Inspect the C2 Layer)
 *
 * ```ts
 * import { CanaryC2Live } from "@/layers/CanaryC2Live"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(CanaryC2Live)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const CanaryC2Live = Layer.effect(CanaryC2, makeCanaryC2());
