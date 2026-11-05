/**
 * Adversarial corpus, synthetic controls and reserved family execution receipts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import * as S from "effect/Schema";
import { CitationOracleJson } from "./citationOracleJson.ts";

const $I = $LawPracticeUseCasesId.create("internal/citationRegexBenchmarks");
const Nanos = S.Finite.check(S.isInt(), S.isGreaterThan(0)).pipe(
  $I.annoteSchema("Nanos", {
    description: "Positive whole monotonic nanoseconds measured inside a synthetic benchmark child.",
  })
);
const FileReference = S.Struct({ path: S.NonEmptyString, sha256: Sha256Hex }).pipe(
  $I.annoteSchema("FileReference", { description: "Repository-contained source or proof file with an exact digest." })
);
const Runtime = LiteralKit(["node", "bun"]).pipe(
  $I.annoteSchema("Runtime", { description: "Required JavaScript runtime kind for portable safety controls." })
);
const Sample = S.Struct({
  control: LiteralKit(["safe-linear", "catastrophic-backtracking"]),
  size: S.Natural,
  matched: S.Boolean,
  samplesNanos: S.NonEmptyArray(Nanos),
  runtime: S.NonEmptyString,
  bunVersion: S.NullOr(S.String),
  warmups: S.tag(2),
  repetitions: S.tag(5),
  evaluationsPerSample: S.tag(256),
  totalEvaluations: S.tag(1792),
}).pipe(
  $I.annoteSchema("Sample", {
    description: "Warmup/sample work metadata and raw measured values from the synthetic child.",
  })
);
const ControlRow = LiteralKit(["measured", "deadline"])
  .toTaggedUnion("outcome")({
    measured: { size: S.Natural, sample: Sample, exitCode: S.tag(0), exitConfirmed: S.tag(true) },
    deadline: { size: S.Natural, exitSignal: S.tag("SIGKILL"), exitConfirmed: S.tag(true) },
  })
  .pipe(
    $I.annoteSchema("ControlRow", { description: "A completed sample or confirmed force-stopped control process." })
  );

/**
 * Synthetic process-isolated control measurements; not source-family proof.
 *
 * **Example** (Select the control decoder)
 *
 * ```ts
 * import { CitationRegexBenchmarkControls } from "@beep/law-practice-use-cases/test"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(CitationRegexBenchmarkControls)
 * void decode
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export class CitationRegexBenchmarkControls extends S.Opaque<
  CitationRegexBenchmarkControls,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    schemaVersion: S.tag("citation-regex-benchmark-controls/v1"),
    scope: S.tag("Synthetic linear/catastrophic controls only; no oracle family approval."),
    planSha256: Sha256Hex,
    parentSha256: Sha256Hex,
    childSha256: Sha256Hex,
    python: S.NonEmptyString,
    platform: S.NonEmptyString,
    architecture: S.NonEmptyString,
    cpuModel: S.NonEmptyString,
    watchdogScope: S.tag("Child lifetime including startup; regex samples exclude startup."),
    runs: S.Array(
      S.Struct({
        runtimeKind: Runtime,
        control: LiteralKit(["safe-linear", "catastrophic-backtracking"]),
        decision: LiteralKit(["accepted", "rejected-scaling", "rejected-deadline"]),
        rows: S.NonEmptyArray(ControlRow),
      })
    ),
  }).pipe(
    $I.annoteSchema("CitationRegexBenchmarkControls", {
      description: "Raw samples, bounded work and confirmed exits for the benchmark's positive and negative controls.",
    })
  )
) {}

/**
 * Exact-size corpus and exhaustive source family/instance obligation sets.
 *
 * **Example** (Select the corpus decoder)
 *
 * ```ts
 * import { CitationRegexBenchmarkContract } from "@beep/law-practice-use-cases/test"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(CitationRegexBenchmarkContract)
 * void decode
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export class CitationRegexBenchmarkContract extends S.Opaque<
  CitationRegexBenchmarkContract,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    schemaVersion: S.tag("citation-regex-benchmark-contract/v1"),
    scope: S.tag("Synthetic adversarial corpus and benchmark protocol; no family approval."),
    commit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    tree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
    oracleLicense: S.Struct({
      id: S.tag("BSD-2-Clause"),
      material: S.tag("source-adaptation-and-test-observations"),
      notice: S.tag("THIRD_PARTY_NOTICES.md"),
      sha256: S.tag("db2c3c974a69bd9141257a10daee138116cd04ec354cd5239d0af52bc5025772"),
    }),
    syntheticLicense: S.Struct({ id: S.tag("Apache-2.0"), path: S.tag("LICENSE"), sha256: Sha256Hex }),
    generatorSha256: Sha256Hex,
    planSha256: Sha256Hex,
    sourceProjectionSha256: Sha256Hex,
    controlsSha256: Sha256Hex,
    sourceProjection: CitationOracleJson(
      S.Struct({
        families: S.Array(S.Struct({ id: S.NonEmptyString, form: S.NonEmptyString })),
        extractorInstances: S.Array(
          S.Struct({
            id: S.NonEmptyString,
            artifactSha256: Sha256Hex,
            index: S.Natural,
            patternSha256: Sha256Hex,
            flags: S.Natural,
            constructor: S.NonEmptyString,
          })
        ),
      })
    ),
    cases: S.Array(
      S.Struct({
        id: S.NonEmptyString,
        recipeId: S.NonEmptyString,
        size: S.Natural,
        text: S.String,
        inputSha256: Sha256Hex,
      })
    ),
  }).pipe(
    $I.annoteSchema("CitationRegexBenchmarkContract", {
      description:
        "All indexed regex obligations plus geometric synthetic inputs; static reviews and family execution are independently required.",
    })
  )
) {}

/**
 * Reserved family benchmark result format; no result artifact exists yet.
 *
 * **Example** (Select the future result decoder)
 *
 * ```ts
 * import { CitationRegexBenchmarkResults } from "@beep/law-practice-use-cases/test"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(CitationRegexBenchmarkResults)
 * void decode
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export class CitationRegexBenchmarkResults extends S.Opaque<
  CitationRegexBenchmarkResults,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    schemaVersion: S.tag("citation-regex-family-results/v1"),
    contractSha256: Sha256Hex,
    environment: S.Struct({
      nodeVersion: S.tag("v24.22.1"),
      bunVersion: S.tag("1.4.4"),
      platform: S.NonEmptyString,
      architecture: S.NonEmptyString,
      cpuModel: S.NonEmptyString,
    }),
    protocol: S.Struct({
      warmups: S.tag(2),
      repetitions: S.tag(5),
      operationCount: S.tag(256),
      unit: S.tag("nanoseconds"),
      ratioThreshold: S.tag(3.5),
      consecutiveBreaches: S.tag(2),
    }),
    producer: S.Struct({
      path: S.tag("goals/citation-extraction-engine/ops/run-regex-family-benchmarks.ts"),
      sha256: Sha256Hex,
    }),
    families: S.NonEmptyArray(
      S.Struct({
        id: S.NonEmptyString,
        staticReview: FileReference,
        implementation: S.NonEmptyArray(FileReference),
        routing: S.Struct({
          mode: LiteralKit(["literal-prefilter", "bounded-without-prefilter"]),
          rationale: S.NonEmptyString,
        }),
        positiveCaseProofs: S.NonEmptyArray(FileReference),
        adversarialCaseProofs: S.NonEmptyArray(FileReference),
        targetTest: S.Struct({ path: S.NonEmptyString, name: S.NonEmptyString, sha256: Sha256Hex }),
        benchmarks: S.NonEmptyArray(
          S.Struct({
            recipeId: S.NonEmptyString,
            runtimeKind: Runtime,
            sizes: S.NonEmptyArray(
              S.Struct({ size: S.Natural, samplesNanos: S.NonEmptyArray(Nanos), workCapsProof: FileReference })
            ),
          })
        ),
      })
    ),
    instanceCoverage: S.NonEmptyArray(
      S.Struct({
        instanceId: S.NonEmptyString,
        sourcePatternSha256: Sha256Hex,
        familyIds: S.NonEmptyArray(S.NonEmptyString),
      })
    ),
  }).pipe(
    $I.annoteSchema("CitationRegexBenchmarkResults", {
      description:
        "Source-bound review/routing/positive-case and geometric execution obligations; full engine comparison remains a separate gate.",
    })
  )
) {}
