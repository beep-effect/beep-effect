/**
 * Reviewed qualification state and configuration audit policy.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoConfigsId } from "@beep/identity/packages";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Rec from "effect/Record";
import * as R from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  CacheEvidenceReference,
  CacheQualificationKey,
  CacheQualificationState,
  CacheTaskConfiguration,
  CacheTaskContract,
  isCacheTransitionAllowed,
} from "./Cache.policy.ts";

const PosInt = S.Int.check(S.isGreaterThan(0, { message: "Expected a positive integer" })).annotate({
  title: "PosInt",
  description: "An integer greater than zero.",
});

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
/**
 * Decoded lifecycle state and its required payload.
 *
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
 * import * as S from "effect/Schema"
 * import { CacheQualificationStore } from "@beep/repo-configs/cache"
 * const store = CacheQualificationStore.make({ revision: S.Natural.make(0), entries: [], history: [] })
 * console.assert(store.entries.length === 0)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheQualificationStore extends S.Class<CacheQualificationStore>($I`CacheQualificationStore`)(
  {
    schemaVersion: S.tag("cache-qualification-store/v1"),
    revision: S.Natural,
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
 * Workspace package that owns a computation, or the `//` root for root tasks and global settings.
 *
 * **Details**
 *
 * A subject is the review unit of the baseline: every reviewed record names the
 * package whose computations it covers, and the root subject additionally covers
 * the global Turbo configuration, configuration-source digests, scope, profile and
 * epoch. Two reviews of different subjects never share a line in the encoded
 * baseline, so independent re-records merge without conflict.
 *
 * **Example** (Accept a package name and the root subject)
 *
 * ```ts
 * import { CacheBaselineSubject } from "@beep/repo-configs/cache"
 * import * as S from "effect/Schema"
 * console.assert(S.is(CacheBaselineSubject)("@beep/identity") && S.is(CacheBaselineSubject)("//"))
 * console.assert(!S.is(CacheBaselineSubject)("@beep/identity#lint"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CacheBaselineSubject = S.NonEmptyString.check(S.isPattern(/^[^#\s]+$/)).pipe(
  $I.annoteSchema("CacheBaselineSubject", {
    description: "Workspace package that owns a computation, or the // root for root tasks and global settings.",
  })
);

/**
 * Decoded baseline review subject.
 *
 * @category models
 * @since 0.0.0
 */
export type CacheBaselineSubject = typeof CacheBaselineSubject.Type;

/**
 * The subject that owns root tasks, global configuration, sources, scope, profile and epoch.
 *
 * **Example** (Root tasks resolve to the root subject)
 *
 * ```ts
 * import { cacheBaselineRootSubject, cacheBaselineSubject } from "@beep/repo-configs/cache"
 * console.assert(cacheBaselineSubject("//#changeset:status") === cacheBaselineRootSubject)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const cacheBaselineRootSubject: CacheBaselineSubject = "//";

/**
 * Resolve the review subject of a computation identifier.
 *
 * **Example** (A package task resolves to its package)
 *
 * ```ts
 * import { cacheBaselineSubject } from "@beep/repo-configs/cache"
 * console.assert(cacheBaselineSubject("@beep/identity#lint") === "@beep/identity")
 * ```
 *
 * @param computation - A `package#task` computation identifier.
 * @returns The package name before the `#` separator.
 * @category policies
 * @since 0.0.0
 */
export const cacheBaselineSubject = (computation: string): CacheBaselineSubject =>
  A.headNonEmpty(Str.split(computation, "#"));

/**
 * Every review subject a projection requires, sorted, always including the root subject.
 *
 * **Example** (An empty projection still requires the root review)
 *
 * ```ts
 * import { CachePolicyProjection, cacheBaselineSubjects } from "@beep/repo-configs/cache"
 * const projection = CachePolicyProjection.make({ globalConfiguration: {}, nodes: [], sources: [] })
 * console.assert(cacheBaselineSubjects(projection).join() === "//")
 * ```
 *
 * @param projection - Effective settings whose executable computations need review.
 * @returns Sorted unique subjects covering every node plus the root subject.
 * @category policies
 * @since 0.0.0
 */
export const cacheBaselineSubjects = (projection: CachePolicyProjection): ReadonlyArray<CacheBaselineSubject> =>
  A.sort(
    A.dedupe(
      A.prepend(
        A.map(projection.nodes, (node) => cacheBaselineSubject(node.computation)),
        cacheBaselineRootSubject
      )
    ),
    Order.String
  );

/**
 * Explicitly reviewed legacy posture and the currently authorized implementation scope.
 *
 * **Details**
 *
 * `reviews` holds one deliberate review record per subject (see
 * {@link CacheBaselineSubject}); {@link cachePolicyBaselineFailures} rejects a
 * baseline whose reviews and projection subjects disagree. Nodes are kept sorted by
 * computation so the pretty-printed file merges per package.
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
    schemaVersion: S.tag("cache-qualification-baseline/v2"),
    profile: S.NonEmptyString,
    epoch: S.NonEmptyString,
    scope: S.NonEmptyArray(CacheQualificationKey.fields.computation),
    reviews: S.Record(CacheBaselineSubject, CacheReviewDecision),
    projection: CachePolicyProjection,
  },
  $I.annote("CachePolicyBaseline", {
    description: "Explicitly reviewed legacy posture and the currently authorized implementation scope.",
  })
) {}

/**
 * One reviewed re-record of the baseline: the review decision and the posture it authorizes.
 *
 * **Details**
 *
 * `subjects`, when present, names the subjects the reviewer deliberately
 * re-reviewed. Every subject whose nodes changed must be listed or the record is
 * rejected, and listed subjects are stamped even when unchanged.
 *
 * **Example** (Inspect the policy contract)
 *
 * ```ts
 * import { CachePolicyBaselineReview } from "@beep/repo-configs/cache"
 * import * as S from "effect/Schema"
 * console.assert(!S.is(CachePolicyBaselineReview)({}))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CachePolicyBaselineReview extends S.Class<CachePolicyBaselineReview>($I`CachePolicyBaselineReview`)(
  {
    review: CacheReviewDecision,
    scope: CachePolicyBaseline.fields.scope,
    profile: CachePolicyBaseline.fields.profile,
    epoch: CachePolicyBaseline.fields.epoch,
    subjects: CacheBaselineSubject.pipe(S.Array, S.OptionFromOptionalKey),
  },
  $I.annote("CachePolicyBaselineReview", {
    description: "One reviewed re-record of the baseline: the review decision and the posture it authorizes.",
  })
) {}

/**
 * Inputs to one baseline re-record: the committed baseline, the observed projection and the review.
 *
 * **Example** (Inspect the policy contract)
 *
 * ```ts
 * import { CachePolicyBaselineRecordRequest } from "@beep/repo-configs/cache"
 * import * as S from "effect/Schema"
 * console.assert(!S.is(CachePolicyBaselineRecordRequest)({}))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CachePolicyBaselineRecordRequest extends S.Class<CachePolicyBaselineRecordRequest>(
  $I`CachePolicyBaselineRecordRequest`
)(
  { prior: S.Option(CachePolicyBaseline), projection: CachePolicyProjection, review: CachePolicyBaselineReview },
  $I.annote("CachePolicyBaselineRecordRequest", {
    description: "Inputs to one baseline re-record: the committed baseline, the observed projection and the review.",
  })
) {}

/**
 * A recorded baseline with the subjects the new review stamped, carried forward or dropped.
 *
 * **Example** (Inspect the policy contract)
 *
 * ```ts
 * import { CachePolicyBaselineRecord } from "@beep/repo-configs/cache"
 * import * as S from "effect/Schema"
 * console.assert(!S.is(CachePolicyBaselineRecord)({}))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CachePolicyBaselineRecord extends S.Class<CachePolicyBaselineRecord>($I`CachePolicyBaselineRecord`)(
  {
    baseline: CachePolicyBaseline,
    stamped: S.Array(CacheBaselineSubject),
    carried: S.Array(CacheBaselineSubject),
    dropped: S.Array(CacheBaselineSubject),
  },
  $I.annote("CachePolicyBaselineRecord", {
    description: "A recorded baseline with the subjects the new review stamped, carried forward or dropped.",
  })
) {}

/**
 * Why a baseline re-record was refused: changed subjects the review did not name, or named subjects that do not exist.
 *
 * **Example** (Inspect the policy contract)
 *
 * ```ts
 * import { CachePolicyBaselineRejection } from "@beep/repo-configs/cache"
 * import * as S from "effect/Schema"
 * console.assert(!S.is(CachePolicyBaselineRejection)({}))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CachePolicyBaselineRejection extends S.Class<CachePolicyBaselineRejection>(
  $I`CachePolicyBaselineRejection`
)(
  { unreviewed: S.Array(CacheBaselineSubject), unknown: S.Array(CacheBaselineSubject) },
  $I.annote("CachePolicyBaselineRejection", {
    description: "Changed subjects the review did not name, or named subjects that do not exist.",
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
/**
 * Decoded cache policy finding reason.
 *
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
 * import * as S from "effect/Schema"
 * import { CacheQualificationStore, cacheLedgerFailures } from "@beep/repo-configs/cache"
 * const store = CacheQualificationStore.make({ revision: S.Natural.make(0), entries: [], history: [] })
 * console.assert(cacheLedgerFailures(store).length === 0)
 * ```
 *
 * @param store - Ledger whose revisions and transitions must agree.
 * @returns Violations found while reconstructing the ledger.
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

const sameNodes = S.toEquivalence(S.Array(CachePolicyNode));
const sameSources = S.toEquivalence(S.Array(CachePolicySource));
const sameSubjects = S.toEquivalence(S.Array(S.String));
const sortedComputations = (projection: CachePolicyProjection) => A.map(projection.nodes, (node) => node.computation);
const subjectNodes = (projection: CachePolicyProjection, subject: CacheBaselineSubject) =>
  A.filter(projection.nodes, (node) => cacheBaselineSubject(node.computation) === subject);

/**
 * Verify that every projection subject carries exactly one review and nodes stay merge-sorted.
 *
 * **Example** (Accept a root-only baseline)
 *
 * ```ts
 * import * as Cache from "@beep/repo-configs/cache"
 * import { Sha256Hex } from "@beep/schema/Sha256"
 * const digest = Sha256Hex.make("0000000000000000000000000000000000000000000000000000000000000000")
 * const review = Cache.CacheReviewDecision.make({ reviewer: "fixture", reason: "empty", basis: Cache.CacheEvidenceReference.make({ path: "review.md", sha256: digest }) })
 * const baseline = Cache.CachePolicyBaseline.make({
 *   profile: "fixture", epoch: "v1", scope: ["fixture#lint"], reviews: { "//": review },
 *   projection: Cache.CachePolicyProjection.make({ globalConfiguration: {}, nodes: [], sources: [] }),
 * })
 * console.assert(Cache.cachePolicyBaselineFailures(baseline).length === 0)
 * ```
 *
 * @param baseline - Reviewed baseline whose reviews must cover its subjects.
 * @returns Violations: unreviewed subjects, orphan reviews and unsorted nodes.
 * @category policies
 * @since 0.0.0
 */
export const cachePolicyBaselineFailures = (baseline: CachePolicyBaseline): ReadonlyArray<string> => {
  const subjects = cacheBaselineSubjects(baseline.projection);
  const reviewed = Rec.keys(baseline.reviews);
  const computations = sortedComputations(baseline.projection);
  return A.flatten([
    A.map(
      A.filter(subjects, (subject) => !A.contains(reviewed, subject)),
      (subject) => `unreviewed-subject:${subject}`
    ),
    A.map(
      A.filter(reviewed, (subject) => !A.contains(subjects, subject)),
      (subject) => `orphan-review:${subject}`
    ),
    sameSubjects(computations, A.sort(computations, Order.String)) ? A.empty<string>() : ["unsorted-nodes"],
  ]);
};

/**
 * Record a reviewed baseline, stamping the new review only on subjects whose posture changed.
 *
 * **Details**
 *
 * A subject is stamped when it is new, when its nodes differ from the prior
 * baseline, when the request names it, or (for the root subject) when the global
 * configuration, sources, scope, profile or epoch changed. Every other subject
 * carries its prior review forward byte-for-byte, so two re-records touching
 * different packages change disjoint regions of the encoded file. Subjects that
 * left the projection are dropped. When the request names subjects, any stamped
 * subject outside that list rejects the record, as does a named subject that does
 * not exist.
 *
 * **Example** (Record a first baseline)
 *
 * ```ts
 * import * as Cache from "@beep/repo-configs/cache"
 * import { Sha256Hex } from "@beep/schema/Sha256"
 * import * as O from "effect/Option"
 * import * as R from "effect/Result"
 * const digest = Sha256Hex.make("0000000000000000000000000000000000000000000000000000000000000000")
 * const decision = Cache.CacheReviewDecision.make({ reviewer: "fixture", reason: "empty", basis: Cache.CacheEvidenceReference.make({ path: "review.md", sha256: digest }) })
 * const projection = Cache.CachePolicyProjection.make({ globalConfiguration: {}, nodes: [], sources: [] })
 * const review = Cache.CachePolicyBaselineReview.make({ review: decision, scope: ["fixture#lint"], profile: "fixture", epoch: "v1", subjects: O.none() })
 * const record = R.getOrThrow(Cache.recordCachePolicyBaseline(Cache.CachePolicyBaselineRecordRequest.make({ prior: O.none(), projection, review })))
 * console.assert(record.stamped.join() === "//" && record.carried.length === 0)
 * ```
 *
 * @param input - The committed baseline (if any), the observed projection and the review decision.
 * @returns The recorded baseline with its stamped, carried and dropped subjects, or a rejection.
 * @category policies
 * @since 0.0.0
 */
export const recordCachePolicyBaseline = (
  input: CachePolicyBaselineRecordRequest
): R.Result<CachePolicyBaselineRecord, CachePolicyBaselineRejection> => {
  const { prior, projection, review: request } = input;
  const sorted = CachePolicyProjection.make({
    ...projection,
    nodes: A.sortWith(projection.nodes, (node) => node.computation, Order.String),
  });
  const subjects = cacheBaselineSubjects(sorted);
  const rootChanged = O.match(prior, {
    onNone: () => true,
    onSome: (previous) =>
      !sameGlobalConfiguration(previous.projection.globalConfiguration, sorted.globalConfiguration) ||
      !sameSources(previous.projection.sources, sorted.sources) ||
      !sameSubjects(previous.scope, request.scope) ||
      previous.profile !== request.profile ||
      previous.epoch !== request.epoch,
  });
  const changed = (subject: CacheBaselineSubject) =>
    O.match(prior, {
      onNone: () => true,
      onSome: (previous) =>
        !Rec.has(previous.reviews, subject) ||
        !sameNodes(subjectNodes(previous.projection, subject), subjectNodes(sorted, subject)) ||
        (subject === cacheBaselineRootSubject && rootChanged),
    });
  const named = O.getOrElse(request.subjects, () => A.empty<CacheBaselineSubject>());
  const stamped = A.filter(subjects, (subject) => changed(subject) || A.contains(named, subject));
  const unreviewed = O.isSome(request.subjects) ? A.filter(stamped, (subject) => !A.contains(named, subject)) : [];
  const unknown = A.filter(named, (subject) => !A.contains(subjects, subject));
  if (A.isReadonlyArrayNonEmpty(unreviewed) || A.isReadonlyArrayNonEmpty(unknown)) {
    return R.fail(CachePolicyBaselineRejection.make({ unreviewed, unknown }));
  }
  const carried = A.filter(subjects, (subject) => !A.contains(stamped, subject));
  const dropped = O.match(prior, {
    onNone: () => A.empty<CacheBaselineSubject>(),
    onSome: (previous) => A.filter(Rec.keys(previous.reviews), (subject) => !A.contains(subjects, subject)),
  });
  const reviewOf = (subject: CacheBaselineSubject) =>
    A.contains(stamped, subject)
      ? request.review
      : O.getOrElse(
          O.flatMap(prior, (previous) => Rec.get(previous.reviews, subject)),
          () => request.review
        );
  const baseline = CachePolicyBaseline.make({
    profile: request.profile,
    epoch: request.epoch,
    scope: request.scope,
    reviews: Rec.fromEntries(A.map(subjects, (subject) => [subject, reviewOf(subject)] as const)),
    projection: sorted,
  });
  return R.succeed(CachePolicyBaselineRecord.make({ baseline, stamped, carried, dropped }));
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
 * import * as S from "effect/Schema"
 * import * as Cache from "@beep/repo-configs/cache"
 * import { Sha256Hex } from "@beep/schema/Sha256"
 * const digest = Sha256Hex.make("0000000000000000000000000000000000000000000000000000000000000000")
 * const projection = Cache.CachePolicyProjection.make({ globalConfiguration: {}, nodes: [], sources: [] })
 * const baseline = Cache.CachePolicyBaseline.make({
 *   profile: "fixture", epoch: "v1", scope: ["fixture#lint"], projection,
 *   reviews: { "//": Cache.CacheReviewDecision.make({ reviewer: "fixture", reason: "empty population", basis: Cache.CacheEvidenceReference.make({ path: "review.md", sha256: digest }) }) }
 * })
 * const report = Cache.auditCachePolicy(Cache.CachePolicyAuditRequest.make({
 *   baseline, current: projection, profile: "fixture", epoch: "v1",
 *   store: Cache.CacheQualificationStore.make({ revision: S.Natural.make(0), entries: [], history: [] })
 * }))
 * console.assert(report.unassessed.length === 0 && report.findings.length === 0)
 * ```
 *
 * @param request - Reviewed baseline, current configuration and qualification ledger.
 * @returns Findings and unassessed computations for the supplied policy state.
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
