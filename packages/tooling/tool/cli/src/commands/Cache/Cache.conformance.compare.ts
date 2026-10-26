/**
 * Compare backend topologies against the frozen rubric's hard gates.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { cacheConformancePinsPath } from "./Cache.conformance.native.ts";
import {
  CacheConformanceCaseId,
  CacheConformanceDimension,
  CacheConformanceProfile,
  CacheConformanceTopology,
  CacheConformanceVerdictKind,
} from "./Cache.conformance.schemas.ts";
import {
  cacheConformanceLoadEnvelopePath,
  loadCacheConformanceEnvelope,
  mergeCacheConformanceRuns,
} from "./Cache.conformance.ts";
import { decodeCacheExperimentText, readCacheExperimentBytes } from "./Cache.evidence.ts";
import { CacheCommandError } from "./Cache.schemas.ts";
import type { CacheConformanceRun, CacheConformanceVerdict } from "./Cache.conformance.schemas.ts";

const $I = $RepoCliId.create("commands/Cache/Cache.conformance.compare");
const hashBytes = S.decodeEffect(Sha256HexFromBytes);

/**
 * The frozen backend rubric and the digest its gate table was encoded from.
 *
 * **Example** (Read the rubric path)
 * ```ts
 * import { CacheConformanceRubric } from "@beep/repo-cli/commands/Cache"
 * console.assert(CacheConformanceRubric.path.endsWith("backend-rubric.md"))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CacheConformanceRubric = {
  path: "explorations/turborepo-quality-cache/research/backend-rubric.md",
  rubricSha256: "01311d70d5392f5262f0d6de3cfb45fb9215cbd721e4fbdc7dc09a8e5f12e026",
} as const;

/**
 * Status of one hard gate for one topology; unexecuted evidence is unproven, never a pass.
 *
 * **Example** (Name an unproven gate)
 * ```ts
 * import { CacheConformanceGateStatus } from "@beep/repo-cli/commands/Cache"
 * console.assert(CacheConformanceGateStatus.is.unproven("unproven"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CacheConformanceGateStatus = LiteralKit(["pass", "fail", "unproven"]).pipe(
  $I.annoteSchema("CacheConformanceGateStatus", {
    description: "pass needs executed passing evidence for every mapped verdict; not-executed evidence is unproven.",
  })
);
/**
 * Status of one hard gate for one topology.
 *
 * @category models
 * @since 0.0.0
 */
export type CacheConformanceGateStatus = typeof CacheConformanceGateStatus.Type;

/**
 * One (case, dimension) verdict that evidences a gate.
 *
 * **Example** (Inspect evidence fields)
 * ```ts
 * import { CacheConformanceGateEvidence } from "@beep/repo-cli/commands/Cache"
 * console.assert("dimension" in CacheConformanceGateEvidence.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheConformanceGateEvidence extends S.Opaque<
  CacheConformanceGateEvidence,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    case: S.NonEmptyString,
    dimension: S.OptionFromNullOr(CacheConformanceDimension),
    verdict: CacheConformanceVerdictKind,
    status: CacheConformanceGateStatus,
    source: S.String,
    detail: S.String,
  }).pipe(
    $I.annoteSchema("CacheConformanceGateEvidence", {
      description:
        "A mapped (case, dimension) verdict or a gate obligation, where it came from, its gate contribution and detail.",
    })
  )
) {}

/**
 * One hard gate evaluated for one topology.
 *
 * **Example** (Inspect gate result fields)
 * ```ts
 * import { CacheConformanceGateResult } from "@beep/repo-cli/commands/Cache"
 * console.assert("evidence" in CacheConformanceGateResult.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheConformanceGateResult extends S.Opaque<
  CacheConformanceGateResult,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    gate: S.Int.check(S.isBetween({ minimum: 1, maximum: 12 })),
    title: S.NonEmptyString,
    status: CacheConformanceGateStatus,
    reason: S.String,
    evidence: S.Array(CacheConformanceGateEvidence),
  }).pipe(
    $I.annoteSchema("CacheConformanceGateResult", {
      description: "Gate number, rubric title, status and the verdicts that decided it.",
    })
  )
) {}

/**
 * Hard-gate and material-win evaluation of one topology.
 *
 * **Example** (Inspect topology comparison fields)
 * ```ts
 * import { CacheConformanceTargetComparison } from "@beep/repo-cli/commands/Cache"
 * console.assert("eligible" in CacheConformanceTargetComparison.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheConformanceTargetComparison extends S.Opaque<
  CacheConformanceTargetComparison,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    profile: CacheConformanceProfile,
    topology: CacheConformanceTopology,
    release: S.NonEmptyString,
    representative: S.Boolean,
    executors: S.Array(S.NonEmptyString),
    role: LiteralKit(["incumbent", "evolved-incumbent", "candidate"]),
    candidate: S.Boolean,
    gates: S.Array(CacheConformanceGateResult),
    eligible: S.Boolean,
    blockersRemoved: S.Array(S.Int),
    regressions: S.Array(S.Int),
    notReproven: S.Array(S.Int),
    materialWin: LiteralKit(["win", "no-win", "not-evaluated"]),
    materialWinReason: S.String,
  }).pipe(
    $I.annoteSchema("CacheConformanceTargetComparison", {
      description:
        "Per-gate status, eligibility, gate deltas against the incumbent and the material-win verdict for one topology.",
    })
  )
) {}

/**
 * Comparison document `cache-conformance-comparison/v1`.
 *
 * **Example** (Inspect comparison fields)
 * ```ts
 * import { CacheConformanceComparison } from "@beep/repo-cli/commands/Cache"
 * console.assert("verdict" in CacheConformanceComparison.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheConformanceComparison extends S.Opaque<
  CacheConformanceComparison,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    schemaVersion: S.tag("cache-conformance-comparison/v1"),
    rubric: S.Struct({ path: S.NonEmptyString, sha256: Sha256Hex }),
    corpus: S.Struct({ specSha256: Sha256Hex, planSha256: Sha256Hex }),
    evidenceSources: S.Array(S.NonEmptyString),
    targets: S.Array(CacheConformanceTargetComparison),
    eligibleReplacements: S.Array(S.NonEmptyString),
    evolution: S.Array(S.NonEmptyString),
    verdict: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("CacheConformanceComparison", {
      description: "Frozen-rubric hard gates per topology, eligible replacements and the explicit selection verdict.",
    })
  )
) {}

/**
 * Pass or fail of one executed check outside the run reports.
 *
 * **Example** (Name a passing check)
 * ```ts
 * import { CacheConformanceEvidenceVerdict } from "@beep/repo-cli/commands/Cache"
 * console.assert(CacheConformanceEvidenceVerdict.is.pass("pass"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CacheConformanceEvidenceVerdict = LiteralKit(["pass", "fail"]).pipe(
  $I.annoteSchema("CacheConformanceEvidenceVerdict", {
    description: "Executed outcome of an external check; an unexecuted check is simply not listed.",
  })
);
/**
 * Executed outcome of an external check.
 *
 * @category models
 * @since 0.0.0
 */
export type CacheConformanceEvidenceVerdict = typeof CacheConformanceEvidenceVerdict.Type;

/**
 * One executed deployed or log check scored against a corpus case and dimension.
 *
 * **Example** (Inspect evidence check fields)
 * ```ts
 * import { CacheConformanceEvidenceCheck } from "@beep/repo-cli/commands/Cache"
 * console.assert("expectation" in CacheConformanceEvidenceCheck.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheConformanceEvidenceCheck extends S.Opaque<
  CacheConformanceEvidenceCheck,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    case: CacheConformanceCaseId,
    dimension: CacheConformanceDimension,
    verdict: CacheConformanceEvidenceVerdict,
    expectation: S.NonEmptyString,
    detail: S.String,
  }).pipe(
    $I.annoteSchema("CacheConformanceEvidenceCheck", {
      description: "Executed check with the case and dimension it evidences; merged with run verdicts, fail first.",
    })
  )
) {}

/**
 * One executed check of a gate obligation that no corpus case covers (for example gate 12 maintenance).
 *
 * **Example** (Inspect obligation check fields)
 * ```ts
 * import { CacheConformanceObligationCheck } from "@beep/repo-cli/commands/Cache"
 * console.assert("obligation" in CacheConformanceObligationCheck.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheConformanceObligationCheck extends S.Opaque<
  CacheConformanceObligationCheck,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    gate: S.Int.check(S.isBetween({ minimum: 1, maximum: 12 })),
    obligation: S.NonEmptyString,
    verdict: CacheConformanceEvidenceVerdict,
    expectation: S.NonEmptyString,
    detail: S.String,
  }).pipe(
    $I.annoteSchema("CacheConformanceObligationCheck", {
      description: "Executed check of a named gate obligation outside the corpus.",
    })
  )
) {}

/**
 * External executed evidence for one profile's topologies, `cache-conformance-evidence/v1`.
 *
 * **Details**
 * Deployed IAM, lifecycle, log-scan and correlation checks are not run by the
 * corpus executors; listing them here lets a gate reach pass or fail from
 * executed evidence instead of staying unproven. Source inspection is not
 * evidence: list only checks that were executed.
 *
 * **Example** (Decode an evidence document)
 * ```ts
 * import { CacheConformanceEvidence } from "@beep/repo-cli/commands/Cache"
 * import * as S from "effect/Schema"
 * console.assert(S.is(S.toEncoded(CacheConformanceEvidence))({
 *   schemaVersion: "cache-conformance-evidence/v1", source: "research/aws-lab-c1023a.json", observedAt: "2026-10-23",
 *   profile: "disposable-deployment", topologies: ["beep-incumbent"], checks: [], obligations: []
 * }))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheConformanceEvidence extends S.Opaque<CacheConformanceEvidence, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("cache-conformance-evidence/v1"),
    source: S.NonEmptyString,
    observedAt: S.NonEmptyString,
    profile: CacheConformanceProfile,
    topologies: S.NonEmptyArray(CacheConformanceTopology),
    checks: S.Array(CacheConformanceEvidenceCheck),
    obligations: S.Array(CacheConformanceObligationCheck).pipe(
      S.withDecodingDefaultKey(Effect.succeed([])),
      S.withConstructorDefault(Effect.succeed([]))
    ),
  }).pipe(
    $I.annoteSchema("CacheConformanceEvidence", {
      description: "Provenance, profile, topologies and the executed checks it contributes to the comparison.",
    })
  )
) {}

type EvidenceRef = readonly [caseId: string, dimension: CacheConformanceDimension];
type GateRule = {
  readonly gate: number;
  readonly title: string;
  readonly evidence: ReadonlyArray<EvidenceRef>;
  readonly enumerated?: ReadonlyArray<EvidenceRef>;
  readonly representative?: boolean;
  readonly obligations?: ReadonlyArray<string>;
};

const clients = ["published-stable-client", "published-canary-client"] as const;
const over = (cases: ReadonlyArray<string>, dimension: CacheConformanceDimension): ReadonlyArray<EvidenceRef> =>
  A.map(cases, (id) => [id, dimension] as const);
const wireCases = [
  "RC-001",
  "RC-002",
  "RC-003",
  "RC-004",
  "RC-005",
  "RC-006",
  "RC-007",
  "RC-008",
  "RC-009",
  "RC-010",
  "RC-011",
  "RC-012",
  "RC-014",
  "RC-015",
  "RC-016",
  "RC-023",
  "RC-024",
  "RC-025",
  "RC-026",
];
const cycle = ["RC-009", "RC-010", "RC-017", "RC-018", "RC-019", "RC-020"];

// Frozen gate table encoded from the rubric at `rubricSha256`.
const gateTable: ReadonlyArray<GateRule> = [
  {
    gate: 1,
    title: "exact stable client completes status, signed PUT, HEAD, GET, miss and fault cycles with direct receipts",
    evidence: over(cycle, "published-stable-client"),
  },
  {
    gate: 2,
    title: "exact published canary completes the same matrix in an isolated namespace",
    evidence: over(cycle, "published-canary-client"),
  },
  {
    gate: 3,
    title:
      "strict OpenAPI deviations are enumerated, and no core deviation breaks the published clients or Beep policy",
    // Every strict verdict must be executed (a failure is an enumerated
    // deviation, not a gate failure); the published clients must still accept
    // the backend's actual upload status. Policy breakage is gates 4 and 5.
    enumerated: over(wireCases, "strict-openapi"),
    evidence: A.flatMap(clients, (dimension) => over(["RC-009"], dimension)),
  },
  {
    gate: 4,
    title: "readers cannot write; writers exist only in protected workflows; storage permissions preserve that split",
    evidence: over(["RC-011", "RC-012", "RC-013"], "beep-security-policy"),
  },
  {
    gate: 5,
    title: "a credential is bound to its tenant/namespace and caller-controlled selectors cannot escape it",
    evidence: over(["RC-014", "RC-015"], "beep-security-policy"),
  },
  {
    gate: 6,
    title:
      "valid x-artifact-tag values round-trip opaquely; missing, invalid, wrong-team and corrupted artifacts are rejected before restore",
    // The signed replay (RC-017) proves opaque tag round-trip; RC-006's strict
    // verdict also scores sha/dirty-hash metadata, so it stays under gate 3.
    evidence: A.flatMap(clients, (dimension) => over(["RC-017", "RC-018", "RC-019", "RC-020", "RC-021"], dimension)),
  },
  {
    gate: 7,
    title: "every error class is attributable despite Turbo's task-level fail-soft behavior",
    evidence: [...over(["RC-010", "RC-023"], "strict-openapi"), ...over(["RC-023"], "observability")],
  },
  {
    gate: 8,
    title: "logs, traces, summaries and failure output pass synthetic-secret and artifact-content redaction tests",
    evidence: [...over(["RC-030"], "observability"), ...over(["RC-030"], "beep-security-policy")],
  },
  {
    gate: 9,
    title: "measured payload and concurrency envelopes cover current p99/peak with the ratified safety multipliers",
    evidence: over(["RC-027", "RC-028"], "performance-envelope"),
    representative: true,
  },
  {
    gate: 10,
    title:
      "retention, encryption, public-access block, lifecycle cleanup, backup, budget alarms and teardown are explicit",
    evidence: [...over(["RC-029"], "beep-security-policy"), ...over(["RC-029"], "observability")],
  },
  {
    gate: 11,
    title: "deployment pins immutable source/image/package digests and has a rehearsed incumbent rollback",
    evidence: over(["RC-032"], "beep-security-policy"),
  },
  {
    gate: 12,
    title: "license and maintenance obligations are acceptable for the deployed and modified topology",
    // The license obligation is read from the pinned backend's registry
    // metadata; maintenance needs an executed obligation check. Source
    // inspection never earns a pass.
    evidence: [],
    obligations: ["license", "maintenance"],
  },
];

const BackendPins = S.Struct({
  backends: S.Array(
    S.Struct({
      id: S.NonEmptyString,
      package: S.OptionFromOptionalKey(S.String),
      release: S.OptionFromOptionalKey(S.String),
      license: S.NonEmptyString,
    })
  ),
}).pipe($I.annoteSchema("CacheConformanceBackendPins", { description: "Pinned backends and their licenses." }));
const decodeBackendPins = S.decodeEffect(S.fromJsonString(BackendPins));
const permissiveLicenses = HashSet.make("MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC");

const detailOf = (verdict: CacheConformanceVerdict) =>
  Match.value(verdict).pipe(
    Match.when({ verdict: "fail" }, (failed) => Str.slice(0, 240)(failed.detail)),
    Match.when({ verdict: "not-executed" }, (skipped) => skipped.reason),
    Match.when({ verdict: "unsupported-optional" }, (absent) => absent.reason),
    Match.orElse(() => "")
  );

const statusOf = (verdict: CacheConformanceVerdict["verdict"], enumerated: boolean): CacheConformanceGateStatus =>
  Match.value(verdict).pipe(
    Match.when("pass", (): CacheConformanceGateStatus => "pass"),
    Match.when("unsupported-optional", (): CacheConformanceGateStatus => "pass"),
    Match.when("fail", (): CacheConformanceGateStatus => (enumerated ? "pass" : "fail")),
    Match.orElse((): CacheConformanceGateStatus => "unproven")
  );

type ExternalEvidence = {
  readonly checks: ReadonlyArray<{ readonly source: string; readonly check: CacheConformanceEvidenceCheck }>;
  readonly obligations: ReadonlyArray<{ readonly source: string; readonly check: CacheConformanceObligationCheck }>;
  readonly license: CacheConformanceGateEvidence;
};

const evidenceOf =
  (run: CacheConformanceRun, external: ExternalEvidence, enumerated: boolean) =>
  ([id, dimension]: EvidenceRef): ReadonlyArray<CacheConformanceGateEvidence> => {
    const verdict = A.findFirst(run.cases, (entry) => entry.id === id).pipe(
      O.map((entry) => entry.verdicts[dimension]),
      O.getOrElse(
        (): CacheConformanceVerdict => ({ verdict: "not-executed", reason: `${id} is absent from the runs.` })
      )
    );
    const fromRun = CacheConformanceGateEvidence.make({
      case: id,
      dimension: O.some(dimension),
      verdict: verdict.verdict,
      status: statusOf(verdict.verdict, enumerated),
      source: "run",
      detail: detailOf(verdict),
    });
    const fromEvidence = A.map(
      A.filter(external.checks, ({ check }) => check.case === id && check.dimension === dimension),
      ({ source, check }) =>
        CacheConformanceGateEvidence.make({
          case: id,
          dimension: O.some(dimension),
          verdict: check.verdict,
          status: statusOf(check.verdict, enumerated),
          source,
          detail: `${check.expectation}: ${Str.slice(0, 240)(check.detail)}`,
        })
    );
    // Executed external evidence settles a case the runs could not execute.
    return A.isReadonlyArrayNonEmpty(fromEvidence) && fromRun.status === "unproven"
      ? fromEvidence
      : A.prepend(fromEvidence, fromRun);
  };

const obligationOf = (external: ExternalEvidence, gate: number) => (obligation: string) =>
  obligation === "license"
    ? [external.license]
    : A.match(
        A.filter(external.obligations, ({ check }) => check.gate === gate && check.obligation === obligation),
        {
          onEmpty: () => [
            CacheConformanceGateEvidence.make({
              case: obligation,
              dimension: O.none(),
              verdict: "not-executed",
              status: "unproven",
              source: "none",
              detail: `No executed ${obligation} obligation check was supplied.`,
            }),
          ],
          onNonEmpty: (checks) =>
            A.map(checks, ({ source, check }) =>
              CacheConformanceGateEvidence.make({
                case: obligation,
                dimension: O.none(),
                verdict: check.verdict,
                status: check.verdict,
                source,
                detail: `${check.expectation}: ${Str.slice(0, 240)(check.detail)}`,
              })
            ),
        }
      );

const hasStatus =
  (status: CacheConformanceGateStatus) =>
  (evidence: ReadonlyArray<CacheConformanceGateEvidence>): boolean =>
    A.some(evidence, (item) => item.status === status);
const hasFail = hasStatus("fail");
const hasUnproven = hasStatus("unproven");

const gateStatusOf = (
  evidence: ReadonlyArray<CacheConformanceGateEvidence>,
  nonRepresentative: boolean
): CacheConformanceGateStatus => {
  if (hasFail(evidence)) return "fail";
  const proven = A.isReadonlyArrayNonEmpty(evidence) && !hasUnproven(evidence) && !nonRepresentative;
  return proven ? "pass" : "unproven";
};

const namedEvidence = (item: CacheConformanceGateEvidence) =>
  `${item.case}${O.match(item.dimension, { onNone: () => "", onSome: (dimension) => ` ${dimension}` })}`;

const failReason = (evidence: ReadonlyArray<CacheConformanceGateEvidence>) =>
  A.join(
    A.map(
      A.filter(evidence, (item) => item.status === "fail"),
      (item) => `${namedEvidence(item)}: ${item.detail}`
    ),
    " | "
  );

const unprovenReason = (evidence: ReadonlyArray<CacheConformanceGateEvidence>, nonRepresentative: boolean) =>
  nonRepresentative && !hasUnproven(evidence)
    ? "Measured only on a non-representative profile; gate 9 needs a disposable-deployment run."
    : `Unexecuted evidence: ${A.join(
        A.dedupe(
          A.map(
            A.filter(evidence, (item) => item.status === "unproven"),
            namedEvidence
          )
        ),
        ", "
      )}`;

const gateReasonOf = (
  status: CacheConformanceGateStatus,
  evidence: ReadonlyArray<CacheConformanceGateEvidence>,
  nonRepresentative: boolean
) =>
  Match.value(status).pipe(
    Match.when("fail", () => failReason(evidence)),
    Match.when("unproven", () => unprovenReason(evidence, nonRepresentative)),
    Match.orElse(() => "Every mapped verdict passed.")
  );

const evaluateGate =
  (run: CacheConformanceRun, external: ExternalEvidence, envelopeNote: string) => (rule: GateRule) => {
    const evidence = [
      ...A.flatMap(rule.enumerated ?? [], evidenceOf(run, external, true)),
      ...A.flatMap(rule.evidence, evidenceOf(run, external, false)),
      ...A.flatMap(rule.obligations ?? [], obligationOf(external, rule.gate)),
    ];
    const nonRepresentative = (rule.representative ?? false) && !run.representative;
    const status = gateStatusOf(evidence, nonRepresentative);
    const reason = gateReasonOf(status, evidence, nonRepresentative);
    return CacheConformanceGateResult.make({
      gate: rule.gate,
      title: rule.title,
      status,
      reason: rule.representative === true ? Str.trim(`${reason} ${envelopeNote}`) : reason,
      evidence,
    });
  };

const labelOf = (run: { readonly profile: string; readonly topology: string }) => `${run.profile}/${run.topology}`;

/**
 * Compare topologies on the frozen rubric's twelve hard gates.
 *
 * **Details**
 * The rubric file must still hash to the digest its gate table was encoded
 * from. Runs are merged per profile and topology; each gate maps to the case
 * and dimension verdicts that evidence it. Any failing verdict fails the gate;
 * any unexecuted verdict leaves it unproven, never passed; gate 9 also needs a
 * representative (disposable-deployment) run. A candidate is eligible only
 * when every gate passes, and is then checked for a material win over the
 * incumbent of the same profile (proven blocker removed with no regression;
 * weighted points and the 20-percent metric are not computed here). When no
 * candidate qualifies, the verdict says "no eligible replacement".
 *
 * **Example** (Plan a comparison)
 * ```ts
 * import { compareCacheConformanceRuns } from "@beep/repo-cli/commands/Cache"
 * console.assert(typeof compareCacheConformanceRuns === "function")
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const compareCacheConformanceRuns = Effect.fn("CacheConformance.compareRuns")(function* (
  root: string,
  runs: A.NonEmptyReadonlyArray<CacheConformanceRun>,
  evidence: ReadonlyArray<CacheConformanceEvidence> = []
) {
  const rubric = yield* readCacheExperimentBytes(root, CacheConformanceRubric.path).pipe(Effect.flatMap(hashBytes));
  if (rubric !== CacheConformanceRubric.rubricSha256)
    return yield* CacheCommandError.new(
      `${CacheConformanceRubric.path} changed (SHA-256 ${rubric}); the frozen gate table no longer applies.`
    );
  const pins = yield* readCacheExperimentBytes(root, cacheConformancePinsPath).pipe(
    Effect.flatMap(decodeCacheExperimentText),
    Effect.flatMap(decodeBackendPins)
  );
  const envelope = yield* loadCacheConformanceEnvelope(root);
  const envelopeNote = envelope.concurrency.censored
    ? `The envelope is a floor, not demand: observed peak concurrency (${envelope.concurrency.readPeak} read / ${envelope.concurrency.writePeak} write) equals the reserved caps, so demand is censored (${cacheConformanceLoadEnvelopePath}).`
    : "";
  // Merging checks corpus identity only within one target; compare across
  // targets only when every run was scored against the same corpus.
  const corpus = A.headNonEmpty(runs).corpus;
  const foreign = A.findFirst(
    runs,
    (run) => run.corpus.specSha256 !== corpus.specSha256 || run.corpus.sourcePlanSha256 !== corpus.sourcePlanSha256
  );
  if (O.isSome(foreign))
    return yield* CacheCommandError.new(
      `${labelOf(foreign.value)} was scored against a different corpus; regenerate it before comparing targets.`
    );
  const groups = A.groupBy(runs, labelOf);
  const merged = yield* Effect.forEach(R.values(groups), mergeCacheConformanceRuns);
  const externalFor = (run: CacheConformanceRun): ExternalEvidence => {
    const matching = A.filter(
      evidence,
      (document) => document.profile === run.profile && A.contains(document.topologies, run.topology)
    );
    // A semver build suffix (`2.12.0+tag-passthrough`) marks a locally
    // modified build of the pinned release; its license is the release's.
    const release = A.head(Str.split(run.backend.release, "+")).pipe(O.getOrElse(() => run.backend.release));
    const pinned = A.findFirst(pins.backends, (backend) =>
      A.contains([backend.package, backend.release], O.some(`${run.backend.id}@${release}`))
    );
    const license = O.match(pinned, {
      onNone: () =>
        CacheConformanceGateEvidence.make({
          case: "license",
          dimension: O.none(),
          verdict: "not-executed",
          status: "unproven",
          source: cacheConformancePinsPath,
          detail: `${run.backend.id}@${run.backend.release} is not a pinned backend.`,
        }),
      onSome: (backend) =>
        CacheConformanceGateEvidence.make({
          case: "license",
          dimension: O.none(),
          verdict: HashSet.has(permissiveLicenses, backend.license) ? "pass" : "fail",
          status: HashSet.has(permissiveLicenses, backend.license) ? "pass" : "fail",
          source: cacheConformancePinsPath,
          detail: `${backend.id} is ${backend.license} per the pinned registry metadata.`,
        }),
    });
    return {
      checks: A.flatMap(matching, (document) =>
        A.map(document.checks, (check) => ({ source: document.source, check }))
      ),
      obligations: A.flatMap(matching, (document) =>
        A.map(document.obligations, (check) => ({ source: document.source, check }))
      ),
      license,
    };
  };
  const evaluated = A.map(merged, (run) => ({
    run,
    gates: A.map(gateTable, evaluateGate(run, externalFor(run), envelopeNote)),
  }));
  const incumbents = HashMap.fromIterable(
    A.map(
      A.filter(evaluated, ({ run }) => run.topology === "beep-incumbent"),
      (entry) => [entry.run.profile, entry] as const
    )
  );
  const statusAt = (all: ReadonlyArray<CacheConformanceGateResult>, gate: number) =>
    O.match(
      A.findFirst(all, (result) => result.gate === gate),
      { onNone: (): CacheConformanceGateStatus => "unproven", onSome: (result) => result.status }
    );
  const targets = A.map(evaluated, ({ run, gates }) => {
    const role = Match.value(run.topology).pipe(
      Match.when("beep-incumbent", () => "incumbent" as const),
      Match.when("beep-incumbent-evolved", () => "evolved-incumbent" as const),
      Match.orElse(() => "candidate" as const)
    );
    const candidate = role === "candidate";
    const eligible = A.every(gates, (gate) => gate.status === "pass");
    // Only the incumbent of the same profile is a fair baseline: profiles prove
    // different gates, so a missing one reports "no incumbent", never a substitute.
    const baseline = HashMap.get(incumbents, run.profile);
    const delta = (keep: (mine: CacheConformanceGateStatus, theirs: CacheConformanceGateStatus) => boolean) =>
      O.match(baseline, {
        onNone: () => [],
        onSome: (incumbent) =>
          A.filterMap(gates, (gate) =>
            keep(gate.status, statusAt(incumbent.gates, gate.gate)) ? Result.succeed(gate.gate) : Result.failVoid
          ),
      });
    const blockersRemoved = role === "incumbent" ? [] : delta((mine, theirs) => mine === "pass" && theirs === "fail");
    // A regression is measured (incumbent pass, this fail); a gate the
    // incumbent passes but this target leaves unproven is only not re-proven.
    const regressions = role === "incumbent" ? [] : delta((mine, theirs) => mine === "fail" && theirs === "pass");
    const notReproven = role === "incumbent" ? [] : delta((mine, theirs) => mine === "unproven" && theirs === "pass");
    const gateList = (all: ReadonlyArray<number>) =>
      A.join(
        A.map(all, (gate) => `${gate}`),
        ", "
      );
    const [materialWin, materialWinReason] = Match.value(role).pipe(
      Match.when("incumbent", () => ["not-evaluated", "The incumbent is the baseline, not a candidate."] as const),
      Match.when(
        "evolved-incumbent",
        () => ["not-evaluated", "A retain-and-evolve result for the incumbent, not a replacement candidate."] as const
      ),
      Match.orElse(() =>
        !eligible
          ? ([
              "not-evaluated",
              `Not eligible: gates ${A.join(
                A.map(
                  A.filter(gates, (gate) => gate.status !== "pass"),
                  (gate) => `${gate.gate} ${gate.status}`
                ),
                ", "
              )}.`,
            ] as const)
          : O.isNone(baseline)
            ? (["not-evaluated", "No incumbent run to compare against."] as const)
            : A.isReadonlyArrayNonEmpty(blockersRemoved) && !A.isReadonlyArrayNonEmpty(regressions)
              ? ([
                  "win",
                  `Removes proven incumbent blockers at gates ${gateList(blockersRemoved)} with no regression.`,
                ] as const)
              : ([
                  "no-win",
                  "No proven blocker removed without regression; weighted points and the 20-percent decision metric are not computed by this tool.",
                ] as const)
      )
    );
    return CacheConformanceTargetComparison.make({
      profile: run.profile,
      topology: run.topology,
      release: run.backend.release,
      representative: run.representative,
      executors: run.executors,
      role,
      candidate,
      gates,
      eligible,
      blockersRemoved,
      regressions,
      notReproven,
      materialWin,
      materialWinReason,
    });
  });
  const eligibleReplacements = A.map(
    A.filter(targets, (target) => target.candidate && target.eligible && target.materialWin === "win"),
    labelOf
  );
  const gateList = (all: ReadonlyArray<number>) =>
    A.match(all, {
      onEmpty: () => "none",
      onNonEmpty: (gates) =>
        A.join(
          A.map(gates, (gate) => `${gate}`),
          ", "
        ),
    });
  const evolution = A.map(
    A.filter(targets, (target) => target.role === "evolved-incumbent"),
    (target) => {
      const pending = A.isReadonlyArrayNonEmpty(target.notReproven)
        ? ` Gates ${gateList(target.notReproven)} pass for the incumbent but are not yet re-proven here.`
        : "";
      return A.isReadonlyArrayNonEmpty(target.blockersRemoved) && !A.isReadonlyArrayNonEmpty(target.regressions)
        ? `${labelOf(target)} improves on the incumbent: gates ${gateList(target.blockersRemoved)} pass where the incumbent fails, with no measured regression.${pending} Retain and evolve; it is not a replacement.`
        : `${labelOf(target)} does not improve on the incumbent without regression (blockers removed: ${gateList(target.blockersRemoved)}; regressions: ${gateList(target.regressions)}).${pending} Retain and evolve; it is not a replacement.`;
    }
  );
  const first = A.headNonEmpty(runs);
  return CacheConformanceComparison.make({
    rubric: { path: CacheConformanceRubric.path, sha256: rubric },
    corpus: { specSha256: first.corpus.specSha256, planSha256: first.corpus.sourcePlanSha256 },
    evidenceSources: A.dedupe(A.map(evidence, (document) => document.source)),
    targets,
    eligibleReplacements,
    evolution,
    verdict: A.match(eligibleReplacements, {
      onEmpty: () =>
        "No eligible replacement: no candidate passes every hard gate with a material win over the incumbent. Retain and evolve the incumbent.",
      onNonEmpty: (names) => `Eligible replacement with a material win: ${A.join(names, ", ")}.`,
    }),
  });
}, CacheCommandError.mapError("Cannot compare conformance runs."));

const cell = (status: CacheConformanceGateStatus) => status;

/**
 * Render the comparison as a short Markdown summary.
 *
 * **Example** (Reference the Markdown renderer)
 * ```ts
 * import { renderCacheConformanceComparison } from "@beep/repo-cli/commands/Cache"
 * console.assert(typeof renderCacheConformanceComparison === "function")
 * ```
 *
 * @param comparison - Comparison to render.
 * @returns The Markdown summary.
 * @category encoding
 * @since 0.0.0
 */
export const renderCacheConformanceComparison = (comparison: CacheConformanceComparison) => {
  const header = `| Target | ${A.join(
    A.map(gateTable, (rule) => `G${rule.gate}`),
    " | "
  )} | Eligible |`;
  const divider = `| --- | ${A.join(
    A.map(gateTable, () => "---"),
    " | "
  )} | --- |`;
  const rows = A.map(
    comparison.targets,
    (target) =>
      `| ${labelOf(target)} ${target.release}${target.representative ? " (representative)" : ""} | ${A.join(
        A.map(target.gates, (gate) => cell(gate.status)),
        " | "
      )} | ${target.eligible ? "yes" : "no"} |`
  );
  const failures = A.flatMap(comparison.targets, (target) =>
    A.map(
      A.filter(target.gates, (gate) => gate.status === "fail"),
      (gate) => `- ${labelOf(target)} gate ${gate.gate}: ${Str.slice(0, 300)(gate.reason)}`
    )
  );
  return A.join(
    [
      "# Remote Cache backend comparison",
      "",
      "Generated by `bun run beep cache conformance-compare`; do not edit by hand.",
      "",
      `Rubric \`${comparison.rubric.path}\` at SHA-256 \`${comparison.rubric.sha256}\`.`,
      "Gate status: pass needs every mapped verdict executed and passing; unexecuted evidence is unproven, never a pass.",
      "",
      `**Verdict:** ${comparison.verdict}`,
      "",
      ...A.map(comparison.evolution, (line) => `- ${line}`),
      ...(A.isReadonlyArrayNonEmpty(comparison.evolution) ? [""] : []),
      `External evidence: ${A.match(comparison.evidenceSources, {
        onEmpty: () =>
          "none supplied; gates 4, 8, 10, 11 and the gate 12 maintenance obligation need executed deployed checks.",
        onNonEmpty: (sources) => A.join(sources, ", "),
      })}`,
      "",
      header,
      divider,
      ...rows,
      "",
      "## Gates",
      "",
      ...A.map(gateTable, (rule) => `${rule.gate}. ${rule.title}`),
      "",
      "## Failed gates",
      "",
      ...(A.isReadonlyArrayNonEmpty(failures) ? failures : ["None."]),
      "",
    ],
    "\n"
  );
};
