/**
 * Reviewed qualification state and configuration audit policy.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoConfigsId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, Sha256Hex } from "@beep/schema";
import { PosInt } from "@beep/schema/Int";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  CacheEvidenceReference,
  CacheQualificationKey,
  CacheQualificationState,
  CacheTaskConfiguration,
  CacheTaskContract,
  isCacheTransitionAllowed,
} from "./Cache.policy.ts";

const $I = $RepoConfigsId.create("cache/Cache.governance.policy");

/**
 * Names the reviewer and the content-addressed basis for a state transition.
 *
 * **Example** (Inspect the policy contract)
 *
 * ```ts
 * import { CacheReviewDecision } from "@beep/repo-configs/cache"
 * import * as S from "effect/Schema"
 * console.assert(!S.is(CacheReviewDecision)({}))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheReviewDecision extends S.Class<CacheReviewDecision>($I`CacheReviewDecision`)(
  { reviewer: S.NonEmptyString, reason: S.NonEmptyString, basis: CacheEvidenceReference },
  $I.annote("CacheReviewDecision", {
    description: "Names the reviewer and the content-addressed basis for a state transition.",
  })
) {}

/**
 * State-specific data required for every stage of a qualification claim.
 *
 * **Example** (Inspect the policy contract)
 *
 * ```ts
 * import { CacheQualificationStatus } from "@beep/repo-configs/cache"
 * import * as S from "effect/Schema"
 * console.assert(!S.is(CacheQualificationStatus)({ state: "qualified" }))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CacheQualificationStatus = CacheQualificationState.toTaggedUnion("state")({
  unassessed: { reason: S.NonEmptyString },
  excluded: { review: CacheReviewDecision },
  candidate: { contract: CacheTaskContract, review: CacheReviewDecision },
  shadow: { contract: CacheTaskContract, review: CacheReviewDecision, receipts: S.Array(CacheEvidenceReference) },
  qualified: {
    contract: CacheTaskContract,
    review: CacheReviewDecision,
    receipts: S.NonEmptyArray(CacheEvidenceReference),
  },
  suspended: { contract: CacheTaskContract, review: CacheReviewDecision },
}).pipe(
  $I.annoteSchema("CacheQualificationStatus", {
    description: "State-specific qualification evidence and review obligations.",
  })
);
/** Decoded lifecycle state and its required payload.
 * @category models
 * @since 0.0.0
 */
export type CacheQualificationStatus = typeof CacheQualificationStatus.Type;

/**
 * One explicit assessment; omitted census tuples remain unassessed.
 *
 * **Example** (Inspect the policy contract)
 *
 * ```ts
 * import { CacheQualificationEntry } from "@beep/repo-configs/cache"
 * import * as S from "effect/Schema"
 * console.assert(!S.is(CacheQualificationEntry)({}))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheQualificationEntry extends S.Class<CacheQualificationEntry>($I`CacheQualificationEntry`)(
  { key: CacheQualificationKey, status: CacheQualificationStatus },
  $I.annote("CacheQualificationEntry", {
    description: "One explicit assessment; omitted census tuples remain unassessed.",
  })
) {}

/**
 * One retained lifecycle decision at a monotonically increasing ledger revision.
 *
 * **Example** (Reject a history event without a reviewed entry)
 *
 * ```ts
 * import { CacheQualificationEvent } from "@beep/repo-configs/cache"
 * import * as S from "effect/Schema"
 * console.assert(!S.is(CacheQualificationEvent)({ revision: 1 }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheQualificationEvent extends S.Class<CacheQualificationEvent>($I`CacheQualificationEvent`)(
  { revision: PosInt, entry: CacheQualificationEntry },
  $I.annote("CacheQualificationEvent", {
    description: "One retained review decision in the append-only qualification history.",
  })
) {}

/**
 * Single-writer reviewed qualification ledger with optimistic revision checking.
 *
 * **Example** (Inspect the policy contract)
 *
 * ```ts
 * import { CacheQualificationStore } from "@beep/repo-configs/cache"
 * import { NonNegativeInt } from "@beep/schema"
 * const store = CacheQualificationStore.make({ revision: NonNegativeInt.make(0), entries: [], history: [] })
 * console.assert(store.entries.length === 0)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheQualificationStore extends S.Class<CacheQualificationStore>($I`CacheQualificationStore`)(
  {
    schemaVersion: S.tag("cache-qualification-store/v1"),
    revision: NonNegativeInt,
    entries: S.Array(CacheQualificationEntry),
    history: S.Array(CacheQualificationEvent),
  },
  $I.annote("CacheQualificationStore", {
    description: "Single-writer reviewed qualification ledger with optimistic revision checking.",
  })
) {}

/**
 * Reviewed command and effective configuration for an executable computation.
 *
 * **Example** (Inspect the policy contract)
 *
 * ```ts
 * import { CachePolicyNode } from "@beep/repo-configs/cache"
 * import * as S from "effect/Schema"
 * console.assert(!S.is(CachePolicyNode)({}))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CachePolicyNode extends S.Class<CachePolicyNode>($I`CachePolicyNode`)(
  {
    computation: CacheQualificationKey.fields.computation,
    command: S.NonEmptyString,
    commandDigest: Sha256Hex,
    dependencies: S.Array(S.String),
    configuration: CacheTaskConfiguration,
  },
  $I.annote("CachePolicyNode", {
    description: "Reviewed command and effective configuration for an executable computation.",
  })
) {}

/**
 * Configuration source digest retained for root and child drift attribution.
 *
 * **Example** (Inspect the policy contract)
 *
 * ```ts
 * import { CachePolicySource } from "@beep/repo-configs/cache"
 * import * as S from "effect/Schema"
 * console.assert(!S.is(CachePolicySource)({}))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CachePolicySource extends S.Class<CachePolicySource>($I`CachePolicySource`)(
  { path: S.NonEmptyString, sha256: Sha256Hex },
  $I.annote("CachePolicySource", {
    description: "Configuration source digest retained for root and child drift attribution.",
  })
) {}

/**
 * Deterministic effective settings, independent of source-value task hashes.
 *
 * **Example** (Inspect the policy contract)
 *
 * ```ts
 * import { CachePolicyProjection } from "@beep/repo-configs/cache"
 * import * as S from "effect/Schema"
 * console.assert(!S.is(CachePolicyProjection)({}))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CachePolicyProjection extends S.Class<CachePolicyProjection>($I`CachePolicyProjection`)(
  { globalConfiguration: S.Json, nodes: S.Array(CachePolicyNode), sources: S.Array(CachePolicySource) },
  $I.annote("CachePolicyProjection", {
    description: "Deterministic effective settings, independent of source-value task hashes.",
  })
) {}

/**
 * Explicitly reviewed legacy posture and the currently authorized implementation scope.
 *
 * **Example** (Inspect the policy contract)
 *
 * ```ts
 * import { CachePolicyBaseline } from "@beep/repo-configs/cache"
 * import * as S from "effect/Schema"
 * console.assert(!S.is(CachePolicyBaseline)({}))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CachePolicyBaseline extends S.Class<CachePolicyBaseline>($I`CachePolicyBaseline`)(
  {
    schemaVersion: S.tag("cache-qualification-baseline/v1"),
    review: CacheReviewDecision,
    profile: S.NonEmptyString,
    epoch: S.NonEmptyString,
    scope: S.NonEmptyArray(CacheQualificationKey.fields.computation),
    projection: CachePolicyProjection,
  },
  $I.annote("CachePolicyBaseline", {
    description: "Explicitly reviewed legacy posture and the currently authorized implementation scope.",
  })
) {}

/**
 * Inputs to the read-only audit for one named environment and epoch.
 *
 * **Example** (Inspect the policy contract)
 *
 * ```ts
 * import { CachePolicyAuditRequest } from "@beep/repo-configs/cache"
 * import * as S from "effect/Schema"
 * console.assert(!S.is(CachePolicyAuditRequest)({}))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CachePolicyAuditRequest extends S.Class<CachePolicyAuditRequest>($I`CachePolicyAuditRequest`)(
  {
    baseline: CachePolicyBaseline,
    current: CachePolicyProjection,
    store: CacheQualificationStore,
    profile: S.NonEmptyString,
    epoch: S.NonEmptyString,
  },
  $I.annote("CachePolicyAuditRequest", {
    description: "Inputs to the read-only audit for one named environment and epoch.",
  })
) {}

/**
 * Reasons a current configuration differs from reviewed cache policy.
 *
 * **Example** (Inspect the policy contract)
 *
 * ```ts
 * import { CachePolicyFindingKind } from "@beep/repo-configs/cache"
 * console.assert(CachePolicyFindingKind.is["unreviewed-expansion"]("unreviewed-expansion"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CachePolicyFindingKind = LiteralKit([
  "unreviewed-expansion",
  "configuration-drift",
  "global-configuration-drift",
  "configuration-source-drift",
  "suspended-reuse",
  "unqualified-reuse",
  "assessment-drift",
  "duplicate-identity",
]).pipe(
  $I.annoteSchema("CachePolicyFindingKind", { description: "Configuration drift and unreviewed reuse findings." })
);
/** Decoded cache policy finding reason.
 * @category models
 * @since 0.0.0
 */
export type CachePolicyFindingKind = typeof CachePolicyFindingKind.Type;

/**
 * An attributable policy finding with its enforcement severity.
 *
 * **Example** (Inspect the policy contract)
 *
 * ```ts
 * import { CachePolicyFinding } from "@beep/repo-configs/cache"
 * import * as S from "effect/Schema"
 * console.assert(!S.is(CachePolicyFinding)({}))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CachePolicyFinding extends S.Class<CachePolicyFinding>($I`CachePolicyFinding`)(
  { kind: CachePolicyFindingKind, subject: S.NonEmptyString, blocking: S.Boolean },
  $I.annote("CachePolicyFinding", { description: "An attributable policy finding with its enforcement severity." })
) {}

/**
 * Blocking findings and honest unassessed legacy population for an audit.
 *
 * **Example** (Inspect the policy contract)
 *
 * ```ts
 * import { CachePolicyAuditReport } from "@beep/repo-configs/cache"
 * const report = CachePolicyAuditReport.make({ findings: [], unassessed: ["@beep/identity#lint"] })
 * console.assert(report.unassessed.length === 1)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CachePolicyAuditReport extends S.Class<CachePolicyAuditReport>($I`CachePolicyAuditReport`)(
  {
    schemaVersion: S.tag("cache-policy-audit/v1"),
    findings: S.Array(CachePolicyFinding),
    unassessed: S.Array(S.String),
  },
  $I.annote("CachePolicyAuditReport", {
    description: "Blocking findings and honest unassessed legacy population for an audit.",
  })
) {}

const sameConfiguration = S.toEquivalence(CacheTaskConfiguration);
const sameGlobalConfiguration = S.toEquivalence(S.Json);
const sameKey = S.toEquivalence(CacheQualificationKey);
const sameDependencies = S.toEquivalence(S.Array(S.String));
const sameEntries = S.toEquivalence(S.Array(CacheQualificationEntry));

/**
 * Verify that contiguous legal history reconstructs the current ledger exactly.
 *
 * **Example** (Accept an empty initial ledger)
 *
 * ```ts
 * import { CacheQualificationStore, cacheLedgerFailures } from "@beep/repo-configs/cache"
 * import { NonNegativeInt } from "@beep/schema"
 * const store = CacheQualificationStore.make({ revision: NonNegativeInt.make(0), entries: [], history: [] })
 * console.assert(cacheLedgerFailures(store).length === 0)
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const cacheLedgerFailures = (store: CacheQualificationStore): ReadonlyArray<string> => {
  let failures = A.empty<string>();
  let entries = A.empty<CacheQualificationEntry>();
  if (store.revision !== A.length(store.history)) failures = A.append(failures, "revision-history-mismatch");
  let expectedRevision = 0;
  for (const event of store.history) {
    expectedRevision += 1;
    if (event.revision !== expectedRevision) failures = A.append(failures, "noncontiguous-history");
    const prior = A.findFirst(entries, (entry) => sameKey(entry.key, event.entry.key));
    const from = O.match(prior, { onNone: () => "unassessed" as const, onSome: (entry) => entry.status.state });
    if (!isCacheTransitionAllowed(from, event.entry.status.state))
      failures = A.append(failures, "illegal-history-transition");
    entries = A.append(
      A.filter(entries, (entry) => !sameKey(entry.key, event.entry.key)),
      event.entry
    );
  }
  if (!sameEntries(entries, store.entries)) failures = A.append(failures, "history-projection-mismatch");
  return A.dedupe(failures);
};

type ReportFinding = (kind: CachePolicyFindingKind, subject: string, blocking?: boolean) => void;

const auditContractConfiguration = (node: CachePolicyNode, contract: CacheTaskContract, find: ReportFinding) => {
  if (
    !sameConfiguration(node.configuration, contract.configuration) ||
    contract.commandDigest !== node.commandDigest ||
    !sameDependencies(node.dependencies, contract.dependencies) ||
    contract.commands[0] !== node.command
  )
    find("configuration-drift", node.computation);
};

const auditContractNode = (
  node: CachePolicyNode,
  entry: CacheQualificationEntry,
  baseline: CachePolicyBaseline,
  reviewed: O.Option<CachePolicyNode>,
  find: ReportFinding
): boolean => {
  const status = entry.status;
  if (CacheQualificationStatus.isAnyOf(["suspended", "excluded"])(status)) {
    find("suspended-reuse", node.computation);
    return true;
  }
  if (!CacheQualificationStatus.isAnyOf(["candidate", "shadow", "qualified"])(status)) return false;
  if (status.state !== "qualified") find("unqualified-reuse", node.computation);
  if (!sameKey(entry.key, status.contract.key)) find("assessment-drift", node.computation);
  auditContractConfiguration(node, status.contract, find);
  if (!O.exists(reviewed, (prior) => prior.configuration.cache) && status.state !== "qualified")
    find("unreviewed-expansion", node.computation);
  if (!A.contains(baseline.scope, node.computation)) find("unreviewed-expansion", node.computation);
  return true;
};

const auditLegacyNode = (node: CachePolicyNode, reviewed: O.Option<CachePolicyNode>, find: ReportFinding) => {
  if (O.isNone(reviewed) || !reviewed.value.configuration.cache) {
    find("unreviewed-expansion", node.computation);
  } else if (
    node.command !== reviewed.value.command ||
    node.commandDigest !== reviewed.value.commandDigest ||
    !sameDependencies(node.dependencies, reviewed.value.dependencies) ||
    !sameConfiguration(node.configuration, reviewed.value.configuration)
  ) {
    find("configuration-drift", node.computation);
  }
};

const auditPopulation = (
  request: CachePolicyAuditRequest,
  relevant: ReadonlyArray<CacheQualificationEntry>,
  find: ReportFinding
): ReadonlyArray<string> => {
  const unassessed: Array<string> = [];
  const auditNode = (node: CachePolicyNode) => {
    if (!node.configuration.cache) return;
    const assessment = A.findFirst(relevant, (entry) => entry.key.computation === node.computation);
    const reviewed = A.findFirst(request.baseline.projection.nodes, (row) => row.computation === node.computation);
    if (O.isNone(assessment) || assessment.value.status.state === "unassessed") unassessed.push(node.computation);
    if (O.isSome(assessment) && auditContractNode(node, assessment.value, request.baseline, reviewed, find)) return;
    auditLegacyNode(node, reviewed, find);
  };
  A.forEach(request.current.nodes, auditNode);
  return unassessed;
};

const auditSourceDrift = (baseline: CachePolicyProjection, current: CachePolicyProjection, find: ReportFinding) => {
  for (const source of current.sources) {
    const prior = A.findFirst(baseline.sources, (row) => row.path === source.path);
    if (O.isNone(prior) || prior.value.sha256 !== source.sha256) find("configuration-source-drift", source.path, false);
  }
  for (const source of baseline.sources) {
    if (!A.some(current.sources, (row) => row.path === source.path))
      find("configuration-source-drift", source.path, false);
  }
};

/**
 * Compare effective cache configuration with reviewed baseline and explicit tuple assessments.
 *
 * **Details**
 *
 * Disabling reuse is permitted. Changed global semantics, new cached
 * computations, and material changes to cached commands require review.
 * Raw config source changes remain visible even when effective settings
 * are unchanged. Missing assessments are reported as unassessed.
 *
 * **Example** (Audit an empty executable population)
 *
 * ```ts
 * import * as Cache from "@beep/repo-configs/cache"
 * import { NonNegativeInt, Sha256Hex } from "@beep/schema"
 * const digest = Sha256Hex.make("0000000000000000000000000000000000000000000000000000000000000000")
 * const projection = Cache.CachePolicyProjection.make({ globalConfiguration: {}, nodes: [], sources: [] })
 * const baseline = Cache.CachePolicyBaseline.make({
 *   profile: "fixture", epoch: "v1", scope: ["fixture#lint"], projection,
 *   review: Cache.CacheReviewDecision.make({ reviewer: "fixture", reason: "empty population", basis: Cache.CacheEvidenceReference.make({ path: "review.md", sha256: digest }) })
 * })
 * const report = Cache.auditCachePolicy(Cache.CachePolicyAuditRequest.make({
 *   baseline, current: projection, profile: "fixture", epoch: "v1",
 *   store: Cache.CacheQualificationStore.make({ revision: NonNegativeInt.make(0), entries: [], history: [] })
 * }))
 * console.assert(report.unassessed.length === 0 && report.findings.length === 0)
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const auditCachePolicy = (request: CachePolicyAuditRequest): CachePolicyAuditReport => {
  const { baseline, current, store, profile, epoch } = request;
  let findings = A.empty<CachePolicyFinding>();
  const find = (kind: CachePolicyFindingKind, subject: string, blocking = true) => {
    findings = A.append(findings, CachePolicyFinding.make({ kind, subject, blocking }));
  };
  for (const failure of cacheLedgerFailures(store)) find("assessment-drift", `qualification-ledger:${failure}`);
  if (!sameGlobalConfiguration(baseline.projection.globalConfiguration, current.globalConfiguration)) {
    find("global-configuration-drift", "turbo-global-configuration");
  }
  for (const projection of [baseline.projection, current]) {
    const ids = A.map(projection.nodes, (node) => node.computation);
    if (A.length(A.dedupe(ids)) !== A.length(ids)) find("duplicate-identity", "executable-census");
  }
  if (
    A.length(
      A.dedupeWith(
        A.map(store.entries, (entry) => entry.key),
        sameKey
      )
    ) !== A.length(store.entries)
  ) {
    find("duplicate-identity", "qualification-ledger");
  }
  const relevant = A.filter(
    store.entries,
    (entry) => entry.key.layer === "turbo-task-result" && entry.key.profile === profile && entry.key.epoch === epoch
  );
  const unassessed = auditPopulation(request, relevant, find);
  auditSourceDrift(baseline.projection, current, find);
  return CachePolicyAuditReport.make({ findings, unassessed });
};
