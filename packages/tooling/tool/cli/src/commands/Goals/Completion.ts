/**
 * Read-only goal completion verification and explicit workstation-scoped receipt refresh.
 *
 * **Details**
 *
 * Completion is decided from hosted facts alone: the final PR merged, every
 * required check at the merged head is green or named by a committed
 * `redAttribution` claim, and no review thread is outstanding. The local Yeet
 * verdict is not read; a declared `yeet-verdict` ref gates nothing.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { outstanding } from "@beep/github/ReviewThread";
import { $RepoCliId } from "@beep/identity/packages";
import { appendContainedFileString, readContainedFileStringNoFollow } from "@beep/repo-cli-kit/cli/FsGuards";
import { findRepoRoot } from "@beep/repo-utils";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { resolveProofLedgerLocation } from "../Yeet/internal/ArtifactPaths.ts";
import { loadYeetInboxView } from "../Yeet/internal/InboxView.ts";
import { recordYeetLocalShardOutcome, YeetLocalShardOutcome } from "../Yeet/internal/LocalShardPoison.ts";
import { decideYeetReviewWindow, YEET_REVIEW_WINDOW_DEFAULT } from "../Yeet/internal/ReviewWindow.ts";
import { YeetCommandError } from "../Yeet/Yeet.errors.ts";
import { GoalCompletionEvidenceInput, GoalMergeTimeEvidenceRequest } from "./CompletionEvidence.schemas.ts";
import {
  decideGoalCompletionEvidence,
  describeGoalCompletionEvidence,
  GoalCompletionIoLive,
  goalCompletionIo,
  readGoalCompletion,
  readGoalMergeTimeEvidence,
} from "./CompletionEvidence.ts";
import {
  goalCompletionReceiptStore,
  GoalCompletionReceiptJson as ReceiptJson,
} from "./CompletionReceiptStore.service.ts";
import {
  GoalAcceptanceEvidenceRef,
  GoalCheckConclusion,
  GoalClaimSet,
  GoalCloseoutVerification,
  GoalCloseoutView,
  GoalCompletionClaims,
  GoalCompletionEvidenceVerdict,
  GoalCompletionReceipt,
  GoalCompletionReceiptVersion,
  GoalEvidenceCheck,
  GoalHostedEvidenceKind,
  GoalManifest,
  GoalMergeResult,
  GoalNonRequiredRed,
  GoalRedAttributionClaim,
  GoalRequiredCheckFact,
  GoalRequiredCheckSnapshot,
  GoalReviewThreadTally,
  goalPullRequestRefs,
} from "./Goals.schemas.ts";
import { listGoalPackets, parseGoalManifestText } from "./Inventory.ts";
import { canonicalJsonTextResult, sha256Hex } from "./PacketCore/PacketDigest.ts";
import { readGoalCompletionClaims } from "./RedAttribution.ts";
import type { ReviewThreads } from "@beep/github/ReviewThread";
import type { FsGuardError } from "@beep/repo-cli-kit/cli/FsGuards";
import type * as FileSystem from "effect/FileSystem";
import type { GoalObservedCheckRun } from "./CompletionEvidence.schemas.ts";
import type { GoalAttributedRedFact, GoalCompletionOutcome, GoalPullRequestRef } from "./Goals.schemas.ts";
import type { GoalPacketRecord } from "./Inventory.ts";

const $I = $RepoCliId.create("commands/Goals/Completion");
const hostedRef = GoalAcceptanceEvidenceRef.make({ kind: "hosted-required-checks", ref: "required", gating: true });
// Gating while a fix PR named by a committed claim cannot be read: the claim is
// counted, but this unknown check keeps the outcome from verifying (DN-5).
const fixPullRequestsRef = GoalAcceptanceEvidenceRef.make({
  kind: "hosted-required-checks",
  ref: "fix-pull-requests",
  gating: true,
});
const reviewThreadsRef = GoalAcceptanceEvidenceRef.make({
  kind: "hosted-review-threads",
  ref: "outstanding",
  gating: true,
});
const V1_RECEIPT_NOTE = "v1 receipt predates hosted-only rules; rerun refresh";
const REVIEW_THREADS_UNREADABLE = "review threads unreadable";

/**
 * Pure verification input: absence is explicit and cannot become a success by default.
 *
 * **Details**
 *
 * `redAttributions` holds the committed claims the verdict may use, after
 * their fix PRs were read (DN-5); `reviewThreads` is the final's thread tally
 * when the read succeeded. Both default to empty, so an observation built
 * without them attributes nothing and records no thread read.
 *
 * **Example** (Inspect the observation boundary)
 *
 * ```ts
 * import { GoalCompletionObservation } from "@beep/repo-cli/commands/Goals/Completion"
 * console.log(GoalCompletionObservation.fields.merged)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalCompletionObservation extends S.Opaque<GoalCompletionObservation, { readonly brand: unique symbol }>()(
  S.Struct({
    repository: S.NonEmptyString,
    packet: S.NonEmptyString,
    declarationDigest: S.NonEmptyString,
    acceptedDeclarationDigest: S.Option(S.NonEmptyString),
    requiredChecks: S.Option(GoalRequiredCheckSnapshot).pipe(S.withConstructorDefault(Effect.succeedNone)),
    finalPullRequest: S.Int.check(S.isGreaterThan(0)),
    acceptedHead: S.Option(S.NonEmptyString),
    merged: S.Option(S.Boolean),
    merge: S.Option(GoalMergeResult),
    grandfathered: S.Boolean,
    evidence: S.Array(GoalEvidenceCheck),
    requiredCheckFacts: S.Array(GoalRequiredCheckFact).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<GoalRequiredCheckFact>()))
    ),
    reviewThreads: S.Option(GoalReviewThreadTally).pipe(S.withConstructorDefault(Effect.succeedNone)),
    redAttributions: S.Array(GoalRedAttributionClaim).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<GoalRedAttributionClaim>()))
    ),
    nonRequiredReds: S.Array(GoalNonRequiredRed),
    subClaims: S.Array(GoalEvidenceCheck),
    verifiedAt: S.DateTimeUtcFromString,
  }).pipe(
    $I.annoteSchema("GoalCompletionObservation", {
      description: "Facts observed once for a declared final PR, separate from the pure completion decision.",
    })
  )
) {}

/**
 * Decides the merge-time evidence verdict for an observation or stored receipt.
 *
 * **Details**
 *
 * The verdict is re-derived from the stored rule-suite inventory, head-bound
 * facts and committed red attributions every time, so a persisted `verified`
 * outcome or `inventoryComplete` flag cannot bypass incomplete evidence.
 *
 * **Example** (Inspect the verdict reader)
 *
 * ```ts
 * import { goalCompletionVerdict } from "@beep/repo-cli/commands/Goals/Completion"
 * console.log(typeof goalCompletionVerdict)
 * ```
 *
 * @param observation - Observation or receipt holding merge, head, inventory, facts and attributions.
 * @returns The verified, unsatisfied or unknown evidence verdict.
 * @category validation
 * @since 0.0.0
 */
export const goalCompletionVerdict = (
  observation: Pick<
    GoalCompletionObservation,
    "merge" | "acceptedHead" | "requiredChecks" | "requiredCheckFacts" | "redAttributions"
  >
): GoalCompletionEvidenceVerdict =>
  decideGoalCompletionEvidence(
    GoalCompletionEvidenceInput.make({
      acceptedHead: observation.acceptedHead,
      mergeCommit: O.map(observation.merge, (merge) => merge.mergeCommit),
      requiredChecks: observation.requiredChecks,
      facts: observation.requiredCheckFacts,
      redAttributions: observation.redAttributions,
    })
  );

// Only hosted facts gate (DN-9): a declared `yeet-verdict`, `proof-fact` or
// `packet-history` ref is recorded at most and never decides the outcome.
const isHostedEvidenceKind = S.is(GoalHostedEvidenceKind);
const gatingEvidence = (evidence: ReadonlyArray<GoalEvidenceCheck>): ReadonlyArray<GoalEvidenceCheck> =>
  A.filter(evidence, (check) => check.ref.gating && isHostedEvidenceKind(check.ref.kind));

const isFixPullRequestsCheck = (check: GoalEvidenceCheck): boolean =>
  check.ref.kind === fixPullRequestsRef.kind && check.ref.ref === fixPullRequestsRef.ref;

// A transient read failure names itself in its detail; any other unknown gating
// check is named by its kind and ref.
const unknownEvidenceReason = (check: GoalEvidenceCheck): string =>
  isFixPullRequestsCheck(check) || (check.ref.kind === "hosted-review-threads" && check.outcome === "unknown")
    ? check.detail
    : `gating evidence ${check.ref.kind} "${check.ref.ref}" unknown`;

/**
 * Names every reason a non-unsatisfied observation or receipt is not verified.
 *
 * **Details**
 *
 * Empty exactly when the merge facts and accepted head are present, both
 * hosted evidence kinds (`hosted-required-checks` and `hosted-review-threads`)
 * gate and are verified at the accepted head, and the merge-time evidence
 * verdict is verified. A failed review-thread read and an unreadable fix PR
 * name themselves (`review threads unreadable`, `fix PR #n unreadable`). A
 * stored `goal-completion-receipt/v1` row adds
 * `v1 receipt predates hosted-only rules; rerun refresh`. Doctor prints these
 * reasons instead of the merge-time verdict, so an unknown completion never
 * reads as verified.
 *
 * **Example** (A receipt with no facts names what is missing)
 *
 * ```ts
 * import { goalCompletionUnknownReasons } from "@beep/repo-cli/commands/Goals/Completion"
 * import * as O from "effect/Option"
 *
 * const reasons = goalCompletionUnknownReasons({
 *   merge: O.none(),
 *   acceptedHead: O.none(),
 *   evidence: [],
 *   requiredChecks: O.none(),
 *   requiredCheckFacts: [],
 *   redAttributions: [],
 * })
 * console.log(reasons.includes("no hosted-review-threads evidence")) // true
 * ```
 *
 * @param observation - Observation or receipt facts, with the receipt's schema version when it has one.
 * @returns Plain reasons, empty when every gating fact is verified.
 * @category validation
 * @since 0.0.0
 */
export const goalCompletionUnknownReasons = (
  observation: Pick<
    GoalCompletionObservation,
    "merge" | "acceptedHead" | "evidence" | "requiredChecks" | "requiredCheckFacts" | "redAttributions"
  > & { readonly schemaVersion?: GoalCompletionReceiptVersion | undefined }
): ReadonlyArray<string> => {
  const gating = gatingEvidence(observation.evidence);
  const verdict = goalCompletionVerdict(observation);
  return [
    ...(observation.schemaVersion === GoalCompletionReceiptVersion.Enum["goal-completion-receipt/v1"]
      ? [V1_RECEIPT_NOTE]
      : []),
    ...(O.isNone(observation.merge) ? ["merge facts unobserved"] : []),
    ...(O.isNone(observation.acceptedHead) ? ["accepted head unobserved"] : []),
    ...A.map(
      A.filter(GoalHostedEvidenceKind.literals, (kind) => !A.some(gating, (check) => check.ref.kind === kind)),
      (kind) => `no ${kind} evidence`
    ),
    ...A.map(
      A.filter(gating, (check) => check.outcome === "unknown" || O.isNone(check.observedHead)),
      unknownEvidenceReason
    ),
    ...(verdict._tag === "unknown" ? [`merge-time evidence gaps: ${A.join(verdict.gaps, ", ")}`] : []),
  ];
};

/**
 * Names the hosted facts that make an observation or receipt unsatisfied: its unattributed reds and outstanding review threads.
 *
 * **Details**
 *
 * One reason per kind, in order: `unattributed red: <contexts>` when the
 * merge-time verdict is unsatisfied, and `<n> review thread(s) outstanding`
 * when the thread tally has any. Empty when neither applies.
 * `goals completion refresh` prints these as its remediation lead, and the
 * online closeout check reports them as the reasons a closeout is `unverified`.
 *
 * **Example** (Outstanding threads)
 *
 * ```ts
 * import { goalCompletionUnsatisfiedReasons } from "@beep/repo-cli/commands/Goals/Completion"
 * import { GoalReviewThreadTally } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 * import * as O from "effect/Option"
 *
 * const reasons = goalCompletionUnsatisfiedReasons({
 *   merge: O.none(),
 *   acceptedHead: O.none(),
 *   requiredChecks: O.none(),
 *   requiredCheckFacts: [],
 *   redAttributions: [],
 *   reviewThreads: O.some(GoalReviewThreadTally.make({ total: 3, outstanding: 2 })),
 * })
 * console.log(reasons) // ["2 review thread(s) outstanding"]
 * ```
 *
 * @param observation - Observation or receipt facts, with the final's thread tally.
 * @returns Plain reasons, empty when no red is unattributed and no thread is outstanding.
 * @category validation
 * @since 0.0.0
 */
export const goalCompletionUnsatisfiedReasons = (
  observation: Pick<
    GoalCompletionObservation,
    "merge" | "acceptedHead" | "requiredChecks" | "requiredCheckFacts" | "redAttributions" | "reviewThreads"
  >
): ReadonlyArray<string> => {
  const verdict = goalCompletionVerdict(observation);
  return [
    ...(verdict._tag === "unsatisfied" && A.isReadonlyArrayNonEmpty(verdict.reds)
      ? [`unattributed red: ${A.join(A.dedupe(A.map(verdict.reds, (fact) => fact.context)), ", ")}`]
      : []),
    ...O.toArray(
      O.map(
        O.filter(observation.reviewThreads, (tally) => tally.outstanding > 0),
        (tally) => `${tally.outstanding} review thread(s) outstanding`
      )
    ),
  ];
};

const overallOutcome = (observation: GoalCompletionObservation): GoalCompletionOutcome => {
  if (observation.grandfathered) return "verified";
  if (O.contains(false)(observation.merged)) return "unsatisfied";
  const verdict = goalCompletionVerdict(observation);
  const gating = gatingEvidence(observation.evidence);
  if (
    verdict._tag === "unsatisfied" ||
    A.some(
      gating,
      (check) =>
        check.outcome === "unsatisfied" ||
        O.exists(check.observedHead, (head) => !O.contains(head)(observation.acceptedHead))
    )
  )
    return "unsatisfied";
  if (O.isNone(observation.merged) || A.isReadonlyArrayNonEmpty(goalCompletionUnknownReasons(observation)))
    return "unknown";
  return "verified";
};

/**
 * Resolves observations without IO; substitutes cleanly in fixtures and offline callers.
 *
 * **Example** (Inspect the verifier service)
 *
 * ```ts
 * import { GoalCompletionVerifier } from "@beep/repo-cli/commands/Goals/Completion"
 * console.log(typeof GoalCompletionVerifier.of)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class GoalCompletionVerifier extends Context.Service<
  GoalCompletionVerifier,
  {
    readonly resolve: (observation: GoalCompletionObservation) => Effect.Effect<GoalCompletionReceipt>;
  }
>()($I`GoalCompletionVerifier`) {
  /**
   * Resolve a receipt from a complete, typed observation.
   *
   * **Example** (Inspect the pure resolver)
   *
   * ```ts
   * import { GoalCompletionVerifier } from "@beep/repo-cli/commands/Goals/Completion"
   * console.log(typeof GoalCompletionVerifier.resolve)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly resolve = Effect.fn("Goals.Completion.resolve")((observation: GoalCompletionObservation) =>
    Effect.succeed(
      GoalCompletionReceipt.make({
        schemaVersion: GoalCompletionReceiptVersion.Enum["goal-completion-receipt/v2"],
        repository: observation.repository,
        packet: observation.packet,
        declarationDigest: observation.declarationDigest,
        acceptedDeclarationDigest: observation.acceptedDeclarationDigest,
        requiredChecks: observation.requiredChecks,
        finalPullRequest: observation.finalPullRequest,
        acceptedHead: observation.acceptedHead,
        merged: observation.merged,
        merge: observation.merge,
        evidence: observation.evidence,
        requiredCheckFacts: observation.requiredCheckFacts,
        reviewThreads: observation.reviewThreads,
        redAttributions: observation.redAttributions,
        nonRequiredReds: observation.nonRequiredReds,
        subClaims: observation.subClaims,
        outcome: overallOutcome(observation),
        verifiedAt: observation.verifiedAt,
      })
    )
  );
}

const equivalentReceipt = S.toEquivalence(GoalCompletionReceipt);
/**
 * Digests the decoded completion declaration, initiative identity and packet identity canonically.
 *
 * **Details**
 *
 * The committed `closeout` record digests under the `proposedCloseout` label
 * the retired proposal used, so a receipt written while a packet still
 * carried its proposal keeps matching after `goals set-status` bound it, and
 * every stored receipt keeps its digest. The label is the only place the old
 * key survives; the manifest schema no longer models it.
 *
 * **Example** (Inspect the digest operation)
 *
 * ```ts
 * import { goalCompletionDeclarationDigest } from "@beep/repo-cli/commands/Goals/Completion"
 * console.log(typeof goalCompletionDeclarationDigest)
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const goalCompletionDeclarationDigest = Effect.fn("Goals.Completion.declarationDigest")(function* (
  manifest: GoalManifest
) {
  const gate = yield* S.encodeEffect(GoalManifest)(manifest);
  const declaration = yield* Effect.fromResult(
    canonicalJsonTextResult({
      initiative: { id: manifest.initiative.id },
      packetId: manifest.initiative.packetId,
      completionGate: gate.completionGate,
      proposedCloseout: gate.closeout,
      pullRequests: goalPullRequestRefs(manifest),
    })
  );
  return yield* sha256Hex(declaration);
});
const evidenceCheck = (
  ref: GoalAcceptanceEvidenceRef,
  outcome: GoalCompletionOutcome,
  head: O.Option<string>,
  detail: string
) => GoalEvidenceCheck.make({ ref, outcome, observedHead: head, detail });

const declaredRefs = (manifest: GoalManifest, kind: GoalHostedEvidenceKind): ReadonlyArray<GoalAcceptanceEvidenceRef> =>
  A.filter(manifest.completionGate.acceptanceEvidence ?? [], (ref) => ref.kind === kind);

const RedAttributionValidation = S.Struct({
  counted: S.Array(GoalRedAttributionClaim),
  dropped: S.Array(GoalRedAttributionClaim),
  unreadable: S.Array(GoalRedAttributionClaim),
}).pipe(
  $I.annoteSchema("RedAttributionValidation", {
    description:
      "Committed red attributions split by their fix PR read: counted (open or merged), dropped (closed without merging) and unreadable.",
  })
);
type RedAttributionValidation = typeof RedAttributionValidation.Type;

// DN-5: one pull-request read per distinct fix PR. A fix PR that is open or
// merged counts; one closed without merging is dropped; a failed read is
// unreadable (GitHub reports a missing PR as a failed read too).
const validateRedAttributions = Effect.fn("Goals.Completion.validateRedAttributions")(function* (
  root: string,
  claims: ReadonlyArray<GoalRedAttributionClaim>
) {
  const reads = yield* Effect.forEach(A.dedupe(A.map(claims, (claim) => claim.fixPullRequest)), (number) =>
    readGoalCompletion(root, (io, root) => io.pullRequest(root, number)).pipe(
      Effect.option,
      Effect.map((pull) => [number, pull] as const)
    )
  );
  const pulls = HashMap.fromIterable(reads);
  const pullOf = (claim: GoalRedAttributionClaim) => O.flatten(HashMap.get(pulls, claim.fixPullRequest));
  return RedAttributionValidation.make({
    counted: A.filter(claims, (claim) => O.exists(pullOf(claim), (pull) => pull.state === "open" || pull.merged)),
    dropped: A.filter(claims, (claim) => O.exists(pullOf(claim), (pull) => pull.state === "closed" && !pull.merged)),
    unreadable: A.filter(claims, (claim) => O.isNone(pullOf(claim))),
  });
});

const fixPullRequestList = (claims: ReadonlyArray<GoalRedAttributionClaim>): string =>
  A.join(
    A.map(A.dedupe(A.map(claims, (claim) => claim.fixPullRequest)), (number) => `#${number}`),
    ", "
  );

const equivalentVerdict = S.toEquivalence(GoalCompletionEvidenceVerdict);

// The claims the verdict counts. A claim whose fix PR could not be read counts
// whenever it decides something, so the verdict is not verified without it and
// differs with it: it clears a red, or it covers a required context that never
// reported a run (DN-4 `missing`). Counting it never makes the verdict
// unsatisfied. `pending` then keeps the gating fix-pull-requests check
// unknown, so the outcome is a transient unknown rather than verified,
// unsatisfied or a structural unknown (DN-5, DN-13).
const countedRedAttributions = (observation: GoalCompletionObservation, validation: RedAttributionValidation) => {
  const strict = goalCompletionVerdict({ ...observation, redAttributions: validation.counted });
  const optimistic = A.appendAll(validation.counted, validation.unreadable);
  const withUnreadable = goalCompletionVerdict({ ...observation, redAttributions: optimistic });
  const pending =
    strict._tag !== "verified" && withUnreadable._tag !== "unsatisfied" && !equivalentVerdict(strict, withUnreadable);
  return pending
    ? { pending, redAttributions: optimistic, verdict: withUnreadable }
    : { pending, redAttributions: validation.counted, verdict: strict };
};

// Records the committed claims and the hosted-required-checks evidence they
// decide; the outcome comes from the verdict alone (see countedRedAttributions
// for a claim whose fix PR could not be read).
const withRedAttributions = (
  observation: GoalCompletionObservation,
  manifest: GoalManifest,
  validation: RedAttributionValidation
): GoalCompletionObservation => {
  const { pending, redAttributions, verdict } = countedRedAttributions(observation, validation);
  const outcome: GoalCompletionOutcome = verdict._tag;
  const head = observation.acceptedHead;
  const contexts = O.getOrElse(
    O.map(observation.requiredChecks, (snapshot) => A.length(snapshot.contexts)),
    () => 0
  );
  const detail = A.join(
    [
      `Newest required-context runs at the accepted head; ${contexts} contexts.`,
      describeGoalCompletionEvidence(verdict),
      ...(A.isReadonlyArrayNonEmpty(validation.dropped)
        ? [`Not counted: fix PR ${fixPullRequestList(validation.dropped)} closed without merging.`]
        : []),
      ...(A.isReadonlyArrayNonEmpty(validation.unreadable) && !pending
        ? [`Not counted: fix PR ${fixPullRequestList(validation.unreadable)} unreadable.`]
        : []),
      "The merge-push rule suite supplies the merge-time ruleset inventory, including rulesets deleted since then; GitHub lists rule suites for one month.",
    ],
    " "
  );
  const required = [
    evidenceCheck(hostedRef, outcome, head, detail),
    ...(pending
      ? [
          evidenceCheck(
            fixPullRequestsRef,
            "unknown",
            head,
            `fix PR ${fixPullRequestList(validation.unreadable)} unreadable`
          ),
        ]
      : []),
    ...A.map(declaredRefs(manifest, "hosted-required-checks"), (ref) =>
      evidenceCheck(ref, outcome, head, "Hosted required checks at the accepted head.")
    ),
  ];
  return GoalCompletionObservation.make({
    ...observation,
    redAttributions,
    evidence: A.appendAll(
      required,
      A.filter(observation.evidence, (check) => check.ref.kind !== "hosted-required-checks")
    ),
  });
};

const reviewThreadTally = (read: ReviewThreads): GoalReviewThreadTally =>
  GoalReviewThreadTally.make({ total: A.length(read.threads), outstanding: outstanding(read) });

// DN-7: zero outstanding threads verifies, any outstanding thread is
// unsatisfied, and a failed read is a transient unknown.
const reviewThreadEvidence = (
  manifest: GoalManifest,
  head: O.Option<string>,
  tally: O.Option<GoalReviewThreadTally>
): ReadonlyArray<GoalEvidenceCheck> => {
  const outcome = O.match(tally, {
    onNone: (): GoalCompletionOutcome => "unknown",
    onSome: (value): GoalCompletionOutcome => (value.outstanding === 0 ? "verified" : "unsatisfied"),
  });
  const detail = O.match(tally, {
    onNone: () => REVIEW_THREADS_UNREADABLE,
    onSome: (value) =>
      value.outstanding === 0
        ? `No outstanding review thread (${value.total} read when refresh ran).`
        : `${value.outstanding} of ${value.total} review threads outstanding when refresh ran.`,
  });
  return A.map(A.prepend(declaredRefs(manifest, "hosted-review-threads"), reviewThreadsRef), (ref) =>
    evidenceCheck(ref, outcome, head, detail)
  );
};

// DN-12: the accepted-head manifest is read raw, so a key the current schema
// no longer models (a legacy `proposedCloseout`) still names its final.
const AcceptedHeadFinalNaming = S.Struct({
  closeout: S.optionalKey(S.Struct({ finalPullRequest: S.Int })),
  proposedCloseout: S.optionalKey(S.Struct({ finalPullRequest: S.Int })),
  completionGate: S.optionalKey(
    S.Struct({ pullRequests: S.Struct({ number: S.Int, role: S.String }).pipe(S.Array, S.optionalKey) })
  ),
}).pipe(
  $I.annoteSchema("AcceptedHeadFinalNaming", {
    description: "The keys of a raw accepted-head manifest that can name the goal's final pull request.",
  })
);
const decodeAcceptedHeadFinalNaming = S.decodeUnknownOption(AcceptedHeadFinalNaming);

const namesFinal = (raw: unknown, number: number): O.Option<boolean> =>
  O.map(
    decodeAcceptedHeadFinalNaming(raw),
    (naming) =>
      naming.closeout?.finalPullRequest === number ||
      naming.proposedCloseout?.finalPullRequest === number ||
      A.some(naming.completionGate?.pullRequests ?? [], (ref) => ref.number === number && ref.role === "final")
  );

const readAcceptedManifest = Effect.fn("Goals.Completion.acceptedManifest")(function* (
  root: string,
  head: string,
  slug: string
) {
  const io = yield* goalCompletionIo();
  const path = `goals/${slug}/ops/manifest.json`;
  const local = yield* io.manifestAtHead(root, head, path).pipe(Effect.orElseSucceed(O.none<string>));
  const acceptedText = O.isSome(local)
    ? local
    : yield* io.hostedManifest(root, head, path).pipe(Effect.orElseSucceed(O.none<string>));
  const raw = O.flatMap(acceptedText, parseGoalManifestText);
  const manifest = O.isSome(raw)
    ? yield* S.decodeUnknownEffect(GoalManifest)(raw.value).pipe(Effect.option)
    : O.none<GoalManifest>();
  return { raw, manifest };
});

/**
 * Observes a final PR on GitHub without writing receipt or manifest state.
 *
 * **Details**
 *
 * Reads the pull request, its merge commit, the accepted-head manifest, the
 * newest check run per required context at the accepted head, the merge-time
 * rule-suite inventory and the review threads. The local Yeet verdict is not
 * read. `claims` supplies the committed `redAttribution` claims (it defaults
 * to none): each distinct fix PR is read once, a claim whose fix PR closed
 * without merging is dropped and named in the hosted detail, and an
 * unreadable fix PR keeps the outcome a transient unknown when its claim
 * decides something: it would clear a red, or cover a required context that
 * never reported a run. An open final resolves unsatisfied with
 * `merged = false`; a failed pull-request read resolves unknown.
 *
 * **Example** (Inspect the read-only adapter)
 *
 * ```ts
 * import { observeGoalCompletion } from "@beep/repo-cli/commands/Goals/Completion"
 * console.log(typeof observeGoalCompletion)
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const observeGoalCompletion = Effect.fn("Goals.Completion.observe")(function* (
  root: string,
  slug: string,
  manifest: GoalManifest,
  final: GoalPullRequestRef,
  claims: GoalCompletionClaims = GoalCompletionClaims.make({})
) {
  const providedVerifier = yield* Effect.serviceOption(GoalCompletionVerifier);
  const resolve = O.getOrElse(
    O.map(providedVerifier, (verifier) => verifier.resolve),
    () => GoalCompletionVerifier.resolve
  );
  const digest = yield* goalCompletionDeclarationDigest(manifest);
  const verifiedAt = yield* DateTime.now;
  const initial = GoalCompletionObservation.make({
    repository: "unobserved",
    packet: slug,
    declarationDigest: digest,
    acceptedDeclarationDigest: O.none(),
    finalPullRequest: final.number,
    acceptedHead: O.none(),
    merged: O.none(),
    merge: O.none(),
    grandfathered: manifest.completionGate.grandfathered,
    evidence: [],
    nonRequiredReds: [],
    subClaims: [],
    verifiedAt,
  });
  if (initial.grandfathered) return yield* resolve(initial);
  const pullRead = yield* readGoalCompletion(root, (io, root) => io.pullRequest(root, final.number)).pipe(
    Effect.option
  );
  if (O.isNone(pullRead)) return yield* resolve(initial);
  const pull = pullRead.value;
  const head = pull.head.sha;
  const known = GoalCompletionObservation.make({
    ...initial,
    repository: pull.base.repo.full_name,
    acceptedHead: O.some(head),
    merged: O.some(pull.merged),
  });
  if (!pull.merged) {
    return yield* resolve(known);
  }
  const reads = yield* Effect.gen(function* () {
    const mergeSha = yield* Effect.fromOption(pull.merge_commit_sha).pipe(
      Effect.mapError(() => YeetCommandError.make({ message: "Merged PR has no merge result" }))
    );
    const mergedAt = yield* Effect.fromOption(pull.merged_at).pipe(
      Effect.mapError(() => YeetCommandError.make({ message: "Merged PR has no merge time" }))
    );
    // Project only the decoded fields: a large merge commit's file patches would
    // otherwise truncate the captured response and lose the merge facts.
    const mergeCommit = yield* readGoalCompletion(root, (io, root) => io.commit(root, mergeSha));
    // GitHub binds this merge result to this PR head for all three workflows. A single-parent
    // result cannot distinguish squash from rebase reliably; retain method=None rather than guess.
    const merge = GoalMergeResult.make({
      mergeCommit: mergeSha,
      tree: mergeCommit.commit.tree.sha,
      mergedAt,
      method: A.length(mergeCommit.parents) === 2 ? O.some("merge") : O.none(),
      baseRef: pull.base.ref,
    });
    const accepted = yield* readAcceptedManifest(root, head, slug);
    const acceptedDeclarationDigest = O.isSome(accepted.manifest)
      ? yield* Effect.asSome(goalCompletionDeclarationDigest(accepted.manifest.value))
      : O.none<string>();
    const pages = yield* readGoalCompletion(root, (io, root) => io.checkRuns(root, head));
    const checks = A.flatMap(pages, (page) => page.check_runs);
    const mergeTime = yield* readGoalMergeTimeEvidence(
      root,
      GoalMergeTimeEvidenceRequest.make({
        base: pull.base.ref,
        mergeCommit: mergeSha,
        mergedAt,
        acceptedHead: head,
        checkRuns: checks,
      })
    );
    const requiredChecks = mergeTime.requiredChecks;
    const required = O.map(requiredChecks, (snapshot) => snapshot.contexts);
    const threads = yield* readGoalCompletion(root, (io, root) => io.reviewThreads(root, final.number)).pipe(
      Effect.option
    );
    const reviewThreads = O.map(threads, reviewThreadTally);
    const validation = yield* validateRedAttributions(root, claims.committed.redAttributions);
    const conclusion = (check: GoalObservedCheckRun, atMerge: boolean): GoalCheckConclusion =>
      atMerge &&
      !O.exists(check.completed_at, (time) => DateTime.toEpochMillis(time) <= DateTime.toEpochMillis(mergedAt))
        ? "pending"
        : S.is(GoalCheckConclusion)(check.conclusion)
          ? check.conclusion
          : check.status === "completed"
            ? "unknown"
            : "pending";
    const nonRequiredReds = O.match(required, {
      onNone: A.empty<GoalNonRequiredRed>,
      onSome: (contexts) =>
        A.getSomes(
          A.map(A.dedupe(A.map(checks, (check) => check.name)), (name) => {
            if (A.contains(contexts, name)) return O.none<GoalNonRequiredRed>();
            const matching = A.filter(checks, (check) => check.name === name && check.head_sha === head);
            const final = A.reduce(matching, O.none<GoalObservedCheckRun>(), (found, check) =>
              O.isNone(found) || check.id > found.value.id ? O.some(check) : found
            );
            const beforeMerge = A.filter(matching, (check) =>
              O.exists(check.started_at, (time) => DateTime.toEpochMillis(time) <= DateTime.toEpochMillis(mergedAt))
            );
            const atMerge = A.reduce(beforeMerge, O.none<GoalObservedCheckRun>(), (found, check) =>
              O.isNone(found) || check.id > found.value.id ? O.some(check) : found
            );
            if (O.isNone(final)) return O.none<GoalNonRequiredRed>();
            const conclusionFinal = conclusion(final.value, false);
            if (conclusionFinal === "success" || conclusionFinal === "neutral" || conclusionFinal === "skipped")
              return O.none<GoalNonRequiredRed>();
            return O.some(
              GoalNonRequiredRed.make({
                lane: name,
                conclusionAtMerge: O.isSome(atMerge) ? conclusion(atMerge.value, true) : "unknown",
                conclusionFinal,
                attribution: "unknown",
              })
            );
          })
        ),
    });
    const timeline = yield* readGoalCompletion(root, (io, root) => io.timeline(root, final.number)).pipe(Effect.option);
    const events = O.getOrElse(O.map(timeline, A.flatten), A.empty);
    const readyTimes = A.getSomes(
      A.map(
        A.filter(events, (event) => event.event === "ready_for_review"),
        (event) => O.fromUndefinedOr(event.created_at)
      )
    );
    const lastReady = A.reduce(readyTimes, O.none<DateTime.Utc>(), (found, time) =>
      O.isNone(found) || DateTime.toEpochMillis(time) > DateTime.toEpochMillis(found.value) ? O.some(time) : found
    );
    const suites = yield* readGoalCompletion(root, (io, root) => io.checkSuites(root, head)).pipe(Effect.option);
    const received = O.flatMap(suites, (pages) =>
      A.reduce(
        A.flatMap(pages, (page) => page.check_suites),
        O.none<DateTime.Utc>(),
        (found, suite) =>
          O.isNone(found) ? O.some(suite.created_at) : O.some(DateTime.min(found.value, suite.created_at))
      )
    );
    const forced = A.getSomes(
      A.map(
        A.filter(events, (event) => event.event === "head_ref_force_pushed"),
        (event) => O.fromUndefinedOr(event.created_at)
      )
    );
    const pushedAt = O.map(received, (first) =>
      A.reduce(forced, first, (left, right) => DateTime.toUtc(DateTime.max(left, right)))
    );
    const readyAt = O.orElse(lastReady, () => (O.isSome(timeline) ? O.some(pull.created_at) : O.none()));
    const window = O.map(O.all({ pushedAt, readyAt }), (instants) =>
      decideYeetReviewWindow({
        ...instants,
        now: mergedAt,
        readyAnchor: O.isSome(lastReady) ? "ready-for-review" : "pr-opened",
        window: YEET_REVIEW_WINDOW_DEFAULT,
      })
    );
    const subClaims = [
      evidenceCheck(
        GoalAcceptanceEvidenceRef.make({ kind: "packet-history", ref: "accepted-declaration", gating: false }),
        O.match(
          O.flatMap(accepted.raw, (raw) => namesFinal(raw, final.number)),
          {
            onNone: (): GoalCompletionOutcome => "unknown",
            onSome: (names): GoalCompletionOutcome => (names ? "verified" : "unsatisfied"),
          }
        ),
        O.some(head),
        `The accepted-head manifest names #${final.number} as its final through closeout, a legacy proposedCloseout or a final completionGate.pullRequests entry. A historical sub-claim that never gates or resets lifecycle.`
      ),
      evidenceCheck(
        GoalAcceptanceEvidenceRef.make({ kind: "packet-history", ref: "draft-to-ready", gating: false }),
        O.isNone(timeline) ? "unknown" : O.isSome(lastReady) ? "verified" : "unsatisfied",
        O.some(head),
        "ready_for_review event proves transition from draft; caller identity does not prove yeet invocation."
      ),
      evidenceCheck(
        GoalAcceptanceEvidenceRef.make({ kind: "packet-history", ref: "review-window", gating: false }),
        O.match(window, {
          onNone: (): GoalCompletionOutcome => "unknown",
          onSome: (value): GoalCompletionOutcome => (value._tag === "elapsed" ? "verified" : "unsatisfied"),
        }),
        O.some(head),
        O.match(window, {
          onNone: () => "Timeline or GitHub head receipt time unavailable.",
          onSome: (value) =>
            `Raw review window at merge: ${value._tag}; anchor ${value.anchoredAt}. Every force push restarts this evidence; the 2026-11-10 rewrite carry is not applied, so an unsatisfied raw window can coexist with a carried merge.`,
        })
      ),
      evidenceCheck(
        GoalAcceptanceEvidenceRef.make({ kind: "yeet-verdict", ref: "merge-ready", gating: false }),
        "unknown",
        O.none(),
        "Not read: completion gates only on hosted facts, so the local Yeet verdict is advisory."
      ),
    ];
    return withRedAttributions(
      GoalCompletionObservation.make({
        ...known,
        merge: O.some(merge),
        acceptedDeclarationDigest,
        requiredChecks,
        evidence: reviewThreadEvidence(manifest, O.some(head), reviewThreads),
        requiredCheckFacts: mergeTime.facts,
        reviewThreads,
        nonRequiredReds,
        subClaims,
      }),
      manifest,
      validation
    );
  }).pipe(Effect.option);
  return yield* resolve(O.getOrElse(reads, () => known));
});

const receiptLocation = Effect.fn("Goals.Completion.receiptLocation")(function* (root: string) {
  const path = yield* Path.Path;
  const { ledgerRoot } = yield* resolveProofLedgerLocation(root);
  return { ledgerRoot, file: path.join(ledgerRoot, ".beep", "goals", "completion-receipts.ndjson") };
});

const readReceiptRepository = Effect.fn("Goals.Completion.receiptRepository")(function* (root: string) {
  const remote = yield* Effect.flatMap(goalCompletionIo(), (io) => io.originUrl(root)).pipe(
    Effect.orElseSucceed(O.none<string>)
  );
  return O.flatMap(remote, (text) =>
    O.flatMap(Str.match(/github\.com[:/]([^/\s]+\/[^/\s]+?)(?:\.git)?\s*$/u)(text), (match) => A.get(match, 1))
  );
});

const readLegacyReceipts = Effect.fn("Goals.Completion.legacyReceipts")(function* (root: string) {
  const location = yield* receiptLocation(root);
  const read = yield* readContainedFileStringNoFollow(location.ledgerRoot, location.file);
  const text = O.getOrElse(read.contents, () => "");
  const lines = Str.split(text, "\n");
  const complete = Str.endsWith("\n")(text) ? lines : A.dropRight(lines, 1);
  return A.getSomes(A.map(complete, ReceiptJson.decodeOption));
});

const readSharedReceipts = Effect.fn("Goals.Completion.sharedReceipts")(
  function* (repository: O.Option<string>) {
    if (O.isNone(repository)) return A.empty<GoalCompletionReceipt>();
    const store = yield* goalCompletionReceiptStore();
    return yield* store.list(repository.value);
  },
  Effect.catchTag("YeetCommandError", (error) =>
    Effect.logWarning(`[goals:completion] shared receipt store unreadable: ${error.message}`).pipe(
      Effect.as(A.empty<GoalCompletionReceipt>())
    )
  )
);

const newestReceipt = (receipts: ReadonlyArray<GoalCompletionReceipt>): O.Option<GoalCompletionReceipt> =>
  A.reduce(receipts, O.none<GoalCompletionReceipt>(), (found, receipt) =>
    O.isNone(found) || DateTime.isGreaterThan(receipt.verifiedAt, found.value.verifiedAt) ? O.some(receipt) : found
  );

// A stored receipt back as an observation. The thread tally and the committed
// claims map explicitly; a v1 row has no `merged`, so its merge facts stand in.
const receiptObservation = (receipt: GoalCompletionReceipt, grandfathered: boolean): GoalCompletionObservation =>
  GoalCompletionObservation.make({
    ...receipt,
    merged: O.orElse(receipt.merged, () => (O.isSome(receipt.merge) ? O.some(true) : O.none())),
    grandfathered,
    reviewThreads: receipt.reviewThreads,
    redAttributions: receipt.redAttributions,
  });

/**
 * Reads the latest matching receipt; changed declarations cannot reuse an older verdict.
 *
 * **Details**
 *
 * Reads the union of the workstation store shared by every clone of the
 * repository and the owning clone's legacy
 * `.beep/goals/completion-receipts.ndjson`, dropping identical rows. Only
 * rows for this packet, declaration digest, final PR and `origin` repository
 * match. The newest definite match wins, else the newest match, except that
 * a verified receipt is sticky: when that pick is `unknown` and a matching
 * `verified` receipt exists, the newest `verified` one is selected instead,
 * so a degraded refresh can never regress a goal another clone verified.
 * A newer definite `unknown` still replaces an older `unsatisfied` receipt.
 * An unreadable shared store degrades to the legacy rows with a warning.
 *
 * The picked row is re-resolved under the hosted-only rules, with its thread
 * tally and committed `redAttributions` mapped back explicitly. A
 * `goal-completion-receipt/v1` row that was `verified` is returned as stored:
 * it verified under the stricter Yeet readiness gate, which already counted
 * review threads. Any other v1 row reads `unknown` and keeps its v1 tag, so
 * {@link goalCompletionUnknownReasons} names it for a rerun of refresh.
 *
 * **Example** (Inspect the receipt reader)
 *
 * ```ts
 * import { storedGoalCompletion } from "@beep/repo-cli/commands/Goals/Completion"
 * console.log(typeof storedGoalCompletion)
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const storedGoalCompletion = Effect.fn("Goals.Completion.stored")(function* (
  root: string,
  slug: string,
  manifest: GoalManifest,
  final: GoalPullRequestRef
) {
  const digest = yield* goalCompletionDeclarationDigest(manifest);
  const legacy = yield* readLegacyReceipts(root);
  const repository = yield* readReceiptRepository(root);
  const shared = yield* readSharedReceipts(repository);
  const receipts = A.dedupeWith(A.appendAll(shared, legacy), equivalentReceipt);
  const matching = A.filter(
    receipts,
    (receipt) =>
      receipt.packet === slug &&
      receipt.declarationDigest === digest &&
      receipt.finalPullRequest === final.number &&
      O.contains(receipt.repository)(repository)
  );
  const definite = A.filter(
    matching,
    (receipt) =>
      receipt.outcome !== "unknown" ||
      (O.isSome(receipt.merge) &&
        O.exists(receipt.requiredChecks, (snapshot) => snapshot.rulesetReadsComplete) &&
        A.some(gatingEvidence(receipt.evidence), (check) => check.outcome !== "unknown"))
  );
  const candidates = A.isReadonlyArrayNonEmpty(definite) ? definite : matching;
  const verified = A.filter(candidates, (receipt) => receipt.outcome === "verified");
  const picked = newestReceipt(candidates);
  const newest =
    O.exists(picked, (receipt) => receipt.outcome === "unknown") && A.isReadonlyArrayNonEmpty(verified)
      ? newestReceipt(verified)
      : picked;
  if (O.isNone(newest)) return newest;
  const receipt = newest.value;
  const v1 = GoalCompletionReceiptVersion.is["goal-completion-receipt/v1"](receipt.schemaVersion);
  if (v1 && receipt.outcome === "verified") return newest;
  const resolved = yield* GoalCompletionVerifier.resolve(
    receiptObservation(receipt, manifest.completionGate.grandfathered)
  );
  return O.some(
    v1 && resolved.outcome !== "verified"
      ? GoalCompletionReceipt.make({ ...resolved, schemaVersion: receipt.schemaVersion, outcome: "unknown" })
      : resolved
  );
});

/**
 * How many days after its merge a goal final stays inside the online closeout window.
 *
 * **Details**
 *
 * GitHub lists rule suites for one month, so a final merged longer ago can no
 * longer be observed in full. Online closeout checks read such a final's
 * stored receipt instead of observing it, and session views list a verified
 * closeout only while its final is inside the window.
 *
 * **Example** (Read the window)
 *
 * ```ts
 * import { GOAL_CLOSEOUT_WINDOW_DAYS } from "@beep/repo-cli/commands/Goals/Completion"
 * console.log(GOAL_CLOSEOUT_WINDOW_DAYS) // 28
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const GOAL_CLOSEOUT_WINDOW_DAYS = 28;

/**
 * Whether a final merged at `mergedAt` is inside the closeout window at `now`.
 *
 * **Details**
 *
 * True when the merge is at most {@link GOAL_CLOSEOUT_WINDOW_DAYS} days
 * before `now`; a merge time after `now` is inside the window too.
 *
 * **Example** (Classify two merges)
 *
 * ```ts
 * import { goalFinalWithinCloseoutWindow } from "@beep/repo-cli/commands/Goals/Completion"
 * import * as DateTime from "effect/DateTime"
 *
 * const now = DateTime.makeUnsafe("2026-11-12T00:00:00Z")
 * console.log(goalFinalWithinCloseoutWindow(DateTime.makeUnsafe("2026-11-01T00:00:00Z"), now)) // true
 * console.log(goalFinalWithinCloseoutWindow(DateTime.makeUnsafe("2026-10-01T00:00:00Z"), now)) // false
 * ```
 *
 * @param mergedAt - When the final merged.
 * @param now - The reading time.
 * @returns Whether the merge lies inside the window.
 * @category predicates
 * @since 0.0.0
 */
export const goalFinalWithinCloseoutWindow: {
  (now: DateTime.Utc): (mergedAt: DateTime.Utc) => boolean;
  (mergedAt: DateTime.Utc, now: DateTime.Utc): boolean;
} = dual(2, (mergedAt: DateTime.Utc, now: DateTime.Utc): boolean =>
  DateTime.isGreaterThanOrEqualTo(mergedAt, DateTime.subtract(now, { days: GOAL_CLOSEOUT_WINDOW_DAYS }))
);

/**
 * The local inbox shard that tracks one closeout's online classification.
 *
 * **Details**
 *
 * `yeet sweep --retire` appends a P0 `local-shard-failed` row under this shard
 * when a merged closeout does not verify, and acknowledges it once the check
 * verifies or an operator ruling on `origin/main` closes the final;
 * `goals completion refresh` acknowledges it the same way in the checkout
 * where it runs. Either writer also acknowledges the rows of a final the
 * packet no longer binds ({@link updateGoalCloseoutShards}).
 *
 * **Example** (Name a shard)
 *
 * ```ts
 * import { goalCloseoutShard } from "@beep/repo-cli/commands/Goals/Completion"
 * console.log(goalCloseoutShard("demo", 7)) // "goal-closeout:demo#7"
 * ```
 *
 * @param slug - The packet slug.
 * @param finalPullRequest - The closeout's final PR.
 * @returns `goal-closeout:<slug>#<n>`.
 * @category formatting
 * @since 0.0.0
 */
export const goalCloseoutShard: {
  (finalPullRequest: number): (slug: string) => string;
  (slug: string, finalPullRequest: number): string;
} = dual(2, (slug: string, finalPullRequest: number): string => `goal-closeout:${slug}#${finalPullRequest}`);

/**
 * The command a closeout shard's inbox row names as its re-run.
 *
 * **Example** (Name the re-run)
 *
 * ```ts
 * import { goalCloseoutRefreshCommand } from "@beep/repo-cli/commands/Goals/Completion"
 * console.log(goalCloseoutRefreshCommand("demo")) // "bun run beep goals completion refresh --slug demo"
 * ```
 *
 * @param slug - The packet slug.
 * @returns The `goals completion refresh` command for the packet.
 * @category formatting
 * @since 0.0.0
 */
export const goalCloseoutRefreshCommand = (slug: string): string =>
  `bun run beep goals completion refresh --slug ${slug}`;

/**
 * Builds the operator-facing closeout view of one packet from a manifest and an optional receipt.
 *
 * **Details**
 *
 * Pure over its inputs: a manifest without a committed `closeout` has no
 * view, and `verification` is `verified` exactly when `receipt` resolved
 * `verified`. Readers that hold the clone-scoped receipt
 * ({@link readGoalCloseoutView}) feed it here; tests feed fixtures directly.
 * The manifest's `initiative.status` is never derived from the receipt.
 *
 * **Example** (Build an unverified view)
 *
 * ```ts
 * import { goalCloseoutView } from "@beep/repo-cli/commands/Goals/Completion"
 * import { GoalManifest } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 * import * as O from "effect/Option"
 *
 * const manifest = GoalManifest.make({
 *   initiative: { id: "demo", status: "completed-retained" },
 *   completionGate: { operator: "yeet", requiresPullRequest: true, requiresMergeable: true, statement: "Ship.", grandfathered: false },
 *   closeout: { status: "completed-retained", finalPullRequest: 7 },
 * })
 * console.log(O.map(goalCloseoutView("demo", manifest, O.none()), (view) => view.verification)) // Some("unverified")
 * ```
 *
 * @param slug - The packet directory name.
 * @param manifest - The decoded manifest.
 * @param receipt - The newest matching clone receipt, when one exists.
 * @returns The view, or none when the manifest commits no closeout.
 * @category projections
 * @since 0.0.0
 */
export const goalCloseoutView: {
  (manifest: GoalManifest, receipt: O.Option<GoalCompletionReceipt>): (slug: string) => O.Option<GoalCloseoutView>;
  (slug: string, manifest: GoalManifest, receipt: O.Option<GoalCompletionReceipt>): O.Option<GoalCloseoutView>;
} = dual(
  3,
  (slug: string, manifest: GoalManifest, receipt: O.Option<GoalCompletionReceipt>): O.Option<GoalCloseoutView> =>
    O.map(O.fromUndefinedOr(manifest.closeout), (closeout) =>
      GoalCloseoutView.make({
        packet: slug,
        closeout,
        verification: O.exists(receipt, (row) => row.outcome === "verified") ? "verified" : "unverified",
      })
    )
);

// A committed closeout's view with the stored receipt it was read against.
const readCloseoutViewAndReceipt = Effect.fn("Goals.Completion.readCloseoutViewAndReceipt")(function* (
  root: string,
  slug: string,
  manifest: GoalManifest
) {
  if (manifest.closeout === undefined) return O.none();
  const final = A.findFirst(goalPullRequestRefs(manifest), (ref) => ref.role === "final");
  const receipt = O.isNone(final)
    ? O.none<GoalCompletionReceipt>()
    : yield* storedGoalCompletion(root, slug, manifest, final.value).pipe(Effect.orElseSucceed(O.none));
  return O.map(goalCloseoutView(slug, manifest, receipt), (view) => ({ view, receipt }));
});

/**
 * Reads one packet's closeout view against this clone's completion receipts.
 *
 * **Details**
 *
 * Unfiltered: any committed `closeout` yields a view (`goals explain` prints
 * it). The receipt is the one {@link storedGoalCompletion} picks for the
 * closeout's final PR; nothing reads GitHub.
 *
 * **Example** (Inspect the single-packet reader)
 *
 * ```ts
 * import { readGoalCloseoutView } from "@beep/repo-cli/commands/Goals/Completion"
 * console.log(typeof readGoalCloseoutView)
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const readGoalCloseoutView = Effect.fn("Goals.Completion.readCloseoutView")(function* (
  root: string,
  slug: string,
  manifest: GoalManifest
) {
  const read = yield* readCloseoutViewAndReceipt(root, slug, manifest);
  return O.map(read, ({ view }) => view);
});

/**
 * Collects this checkout's committed closeouts that still need attention, for session resume views.
 *
 * **Details**
 *
 * Lists a committed closeout whose stored receipt is not verified in this
 * clone, or whose final merged in the last {@link GOAL_CLOSEOUT_WINDOW_DAYS}
 * days. A closeout verified longer ago is left out, so `session open` stays
 * short as closeouts accumulate.
 *
 * **Example** (Inspect the read-only session query)
 *
 * ```ts
 * import { readGoalCloseoutViews } from "@beep/repo-cli/commands/Goals/Completion"
 * console.log(typeof readGoalCloseoutViews)
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const readGoalCloseoutViews = Effect.fn("Goals.Completion.closeoutViews")(function* (root: string) {
  const records = yield* listGoalPackets(root);
  const now = yield* DateTime.now;
  const views = yield* Effect.forEach(
    records,
    Effect.fnUntraced(function* (record) {
      const parsed = O.flatMap(O.fromUndefinedOr(record.manifestText), parseGoalManifestText);
      if (O.isNone(parsed)) return O.none<GoalCloseoutView>();
      const manifest = yield* S.decodeUnknownEffect(GoalManifest)(parsed.value).pipe(Effect.option);
      if (O.isNone(manifest)) return O.none<GoalCloseoutView>();
      const read = yield* readCloseoutViewAndReceipt(root, record.slug, manifest.value);
      return O.map(
        O.filter(
          read,
          ({ view, receipt }) =>
            !GoalCloseoutVerification.is.verified(view.verification) ||
            O.exists(
              O.flatMap(receipt, (row) => row.merge),
              (merge) => goalFinalWithinCloseoutWindow(merge.mergedAt, now)
            )
        ),
        ({ view }) => view
      );
    }),
    { concurrency: 1 }
  );
  return A.getSomes(views);
});

const readRefreshManifest = Effect.fn("Goals.Completion.refreshManifest")(function* (record: GoalPacketRecord) {
  const parsed = yield* Effect.fromOption(
    O.flatMap(O.fromUndefinedOr(record.manifestText), parseGoalManifestText)
  ).pipe(Effect.mapError(() => YeetCommandError.make({ message: "Requested goal manifest is missing or invalid" })));
  return yield* S.decodeUnknownEffect(GoalManifest)(parsed).pipe(
    Effect.mapError(() => YeetCommandError.make({ message: "Requested goal manifest cannot decode" }))
  );
});
const equivalentClaimSet = S.toEquivalence(GoalClaimSet);

const decisionFiles = (claims: ReadonlyArray<{ readonly decisionFile: string }>): string =>
  A.join(A.dedupe(A.map(claims, (claim) => claim.decisionFile)), ", ");

const describeAttributedRed = (red: GoalAttributedRedFact): string =>
  `${red.context} (${red.observed === "missing" ? "never reported, " : ""}${red.attribution}, fix #${red.fixPullRequest}, ${red.decisionFile}, ${red.source})`;

// What the operator does next for an outcome that is not verified.
const remediationHints = (slug: string, receipt: GoalCompletionReceipt): ReadonlyArray<string> =>
  Match.value(receipt.outcome).pipe(
    Match.when("unsatisfied", () => [
      ...goalCompletionUnsatisfiedReasons(receipt),
      `next: name each red required check with its cause and fix PR in a committed decisions/ file (bun run beep goals decisions add ${slug} --title "..." --reversal "..." --final ${receipt.finalPullRequest} --attribute-red "<context>=<cause>#<fix>"), answer every outstanding review thread, or record an operatorRuling; then rerun refresh`,
    ]),
    Match.orElse(() => [
      `unknown: ${A.join(goalCompletionUnknownReasons(receipt), "; ")}`,
      "next: rerun refresh once GitHub facts are readable; a final GitHub can no longer verify (it lists rule suites for one month) closes only through an operatorRuling decision file",
    ])
  );

// Prints the outcome, the reds committed claims attributed (with their
// sources), and for an outcome that is not verified the operator rulings, the
// remediation and what the working-tree claims would change once committed.
const reportRefresh = Effect.fn("Goals.Completion.reportRefresh")(function* (
  root: string,
  label: string,
  slug: string,
  manifest: GoalManifest,
  receipt: GoalCompletionReceipt,
  claims: GoalCompletionClaims
) {
  const verdict = goalCompletionVerdict(receipt);
  const attributed = verdict._tag === "verified" ? verdict.attributedReds : A.empty<GoalAttributedRedFact>();
  const headOnly = A.filter(attributed, (red) => red.source === "head");
  yield* Console.log(
    receipt.outcome === "verified" && A.isReadonlyArrayNonEmpty(headOnly)
      ? `${label}: verified (claims at HEAD only: ${decisionFiles(headOnly)}; not done until they merge)`
      : `${label}: ${receipt.outcome}`
  );
  yield* Effect.forEach(attributed, (red) => Console.log(`${label}: attributed ${describeAttributedRed(red)}`), {
    discard: true,
  });
  if (receipt.outcome === "verified") return;
  yield* Effect.forEach(
    claims.committed.operatorRulings,
    (ruling) => Console.log(`${label}: closed by operator ruling ${ruling.decisionFile} (${ruling.source})`),
    { discard: true }
  );
  yield* Effect.forEach(remediationHints(slug, receipt), (hint) => Console.log(`${label}: ${hint}`), {
    discard: true,
  });
  if (equivalentClaimSet(claims.preview, claims.committed)) return;
  const uncommitted = A.filter(claims.preview.redAttributions, (claim) => claim.source === "working-tree");
  if (A.isReadonlyArrayNonEmpty(uncommitted)) {
    const validation = yield* validateRedAttributions(root, claims.preview.redAttributions);
    const preview = yield* GoalCompletionVerifier.resolve(
      withRedAttributions(receiptObservation(receipt, manifest.completionGate.grandfathered), manifest, validation)
    );
    yield* Console.log(
      preview.outcome === "verified"
        ? `${label}: would verify once committed: ${decisionFiles(uncommitted)}`
        : `${label}: still ${preview.outcome} with the working-tree claims in ${decisionFiles(uncommitted)}`
    );
  }
  yield* Effect.forEach(
    A.filter(claims.preview.operatorRulings, (ruling) => ruling.source === "working-tree"),
    (ruling) => Console.log(`${label}: operator ruling ${ruling.decisionFile} counts once committed`),
    { discard: true }
  );
});

const refreshRecord = Effect.fn("Goals.Completion.refreshRecord")(function* (
  root: string,
  record: GoalPacketRecord,
  explicit: boolean,
  write: (
    receipt: GoalCompletionReceipt
  ) => Effect.Effect<void, YeetCommandError | FsGuardError | S.SchemaError, FileSystem.FileSystem | Path.Path>
) {
  const decoded = readRefreshManifest(record);
  const manifest = yield* explicit ? decoded.pipe(Effect.asSome) : decoded.pipe(Effect.option);
  if (O.isNone(manifest)) return;
  if (manifest.value.completionGate.grandfathered) {
    if (explicit) {
      yield* Console.log(`[goals:completion] ${record.slug}: grandfathered (no receipt needed)`);
    }
    return;
  }
  const finalRead = Effect.fromOption(
    A.findFirst(goalPullRequestRefs(manifest.value), (ref) => ref.role === "final")
  ).pipe(Effect.mapError(() => YeetCommandError.make({ message: "Requested goal has no final pull request" })));
  const final = yield* explicit ? finalRead.pipe(Effect.asSome) : finalRead.pipe(Effect.option);
  if (O.isNone(final)) return;
  const label = `[goals:completion] ${record.slug} #${final.value.number}`;
  const claims = yield* readGoalCompletionClaims(root, record.slug, final.value.number);
  // The receipt is written from the committed claims only (DN-6).
  const receipt = yield* observeGoalCompletion(root, record.slug, manifest.value, final.value, claims);
  if (O.isNone(receipt.merge)) {
    yield* Console.log(`${label}: ${receipt.outcome} (no post-merge receipt written)`);
    return;
  }
  yield* write(receipt);
  yield* reportRefresh(root, label, record.slug, manifest.value, receipt, claims);
  yield* acknowledgeClosedFinal(root, label, record.slug, receipt, receipt.merge.value, claims.committed);
});

// A final this refresh closes clears its P0 inbox row in this checkout, and
// the rows of any final the packet bound before it (DN-14).
const acknowledgeClosedFinal = Effect.fn("Goals.Completion.acknowledgeClosedFinal")(function* (
  root: string,
  label: string,
  slug: string,
  receipt: GoalCompletionReceipt,
  merge: GoalMergeResult,
  claims: GoalClaimSet
) {
  if (!refreshClosesFinal(receipt, claims)) return;
  yield* updateGoalCloseoutShards(
    root,
    GoalCloseoutShardUpdate.make({
      slug,
      boundFinal: O.some(receipt.finalPullRequest),
      exitCode: O.some(0),
      headSha: merge.mergeCommit,
      label,
    })
  );
});

// Whether a refresh closes the final in this checkout: a plain `verified`, or
// an operator ruling for the final on origin/main (DN-15). A verified outcome
// that counts a claim found only at `HEAD`, or a ruling found only at `HEAD`,
// is not done until that claim merges.
const refreshClosesFinal = (receipt: GoalCompletionReceipt, claims: GoalClaimSet): boolean => {
  const verdict = goalCompletionVerdict(receipt);
  const headOnly = verdict._tag === "verified" && A.some(verdict.attributedReds, (red) => red.source === "head");
  return (
    (receipt.outcome === "verified" && !headOnly) ||
    A.some(
      claims.operatorRulings,
      (ruling) => ruling.source === "origin-main" && ruling.finalPullRequest === receipt.finalPullRequest
    )
  );
};

/**
 * One update to a packet's closeout inbox rows in a checkout.
 *
 * **Details**
 *
 * `boundFinal` is the final the packet binds now, if any. `exitCode` is what
 * to record for that final's `goal-closeout:<slug>#<n>` row: `1` raises the
 * P0 row, `0` acknowledges it, none leaves it alone. Every still-open row of
 * the packet that names another final is superseded and acknowledged.
 * `label` prefixes the line printed when the inbox cannot be updated.
 *
 * **Example** (Acknowledge every row of a reopened packet)
 *
 * ```ts
 * import { GoalCloseoutShardUpdate } from "@beep/repo-cli/commands/Goals/Completion"
 * import * as O from "effect/Option"
 *
 * const update = GoalCloseoutShardUpdate.make({
 *   slug: "demo",
 *   boundFinal: O.none(),
 *   exitCode: O.none(),
 *   headSha: "abc123",
 *   label: "[yeet] closeout check goals/demo",
 * })
 * console.log(update.boundFinal._tag) // "None"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalCloseoutShardUpdate extends S.Opaque<GoalCloseoutShardUpdate, { readonly brand: unique symbol }>()(
  S.Struct({
    slug: S.NonEmptyString,
    boundFinal: S.Option(S.Int.check(S.isGreaterThan(0))),
    exitCode: S.Option(S.Int),
    headSha: S.NonEmptyString,
    label: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("GoalCloseoutShardUpdate", {
      description:
        "One update to a packet's closeout inbox rows: the bound final, the exit to record for it, the head and a report label.",
    })
  )
) {}

const closeoutShardPrefix = (slug: string): string => `goal-closeout:${slug}#`;

/**
 * Brings a packet's closeout inbox rows in a checkout in step with its bound final, best-effort.
 *
 * **Details**
 *
 * First acknowledges every still-open `local-shard-failed` row whose shard is
 * `goal-closeout:<slug>#<m>` for a final `m` other than `boundFinal`: a
 * reopened or rebound packet leaves those rows with nothing that would ever
 * clear them. Then it records `exitCode` for the bound final's shard
 * ({@link goalCloseoutShard}). Each record names
 * {@link goalCloseoutRefreshCommand} and `headSha`. A failed inbox read or
 * write prints `<label>: could not update the closeout inbox row: <message>`
 * and never fails the caller. `yeet sweep --retire` and
 * `goals completion refresh` are the writers.
 *
 * **Example** (Build the update)
 *
 * ```ts
 * import { GoalCloseoutShardUpdate, updateGoalCloseoutShards } from "@beep/repo-cli/commands/Goals/Completion"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const update = GoalCloseoutShardUpdate.make({
 *   slug: "demo",
 *   boundFinal: O.some(7),
 *   exitCode: O.some(0),
 *   headSha: "abc123",
 *   label: "[goals:completion] demo #7",
 * })
 * console.log(Effect.isEffect(updateGoalCloseoutShards("/repo", update))) // true
 * ```
 *
 * @param root - The checkout whose inbox carries the rows.
 * @param update - The packet, its bound final and the exit to record.
 * @returns The superseded shards it acknowledged.
 * @category services
 * @since 0.0.0
 */
export const updateGoalCloseoutShards = Effect.fn("Goals.updateGoalCloseoutShards")(
  function* (root: string, update: GoalCloseoutShardUpdate) {
    const bound = O.map(update.boundFinal, (number) => goalCloseoutShard(update.slug, number));
    const record = (shard: string, exitCode: number) =>
      recordYeetLocalShardOutcome(
        root,
        YeetLocalShardOutcome.make({
          command: goalCloseoutRefreshCommand(update.slug),
          exitCode,
          headSha: update.headSha,
          shard,
        })
      );
    const inbox = yield* loadYeetInboxView(root);
    const superseded = A.dedupe(
      A.filterMap(inbox.entries, (entry) =>
        entry.row.kind === "local-shard-failed" &&
        !entry.ack.acked &&
        Str.startsWith(closeoutShardPrefix(update.slug))(entry.row.capsule.shard) &&
        !O.contains(bound, entry.row.capsule.shard)
          ? Result.succeed(entry.row.capsule.shard)
          : Result.failVoid
      )
    );
    yield* Effect.forEach(superseded, (shard) => record(shard, 0), { discard: true });
    yield* Effect.forEach(O.toArray(O.all([bound, update.exitCode])), ([shard, exitCode]) => record(shard, exitCode), {
      discard: true,
    });
    return superseded;
  },
  (effect, _root, update) =>
    effect.pipe(
      Effect.catch((error) =>
        Console.error(`${update.label}: could not update the closeout inbox row: ${error.message}`).pipe(
          Effect.as(A.empty<string>())
        )
      )
    )
);
/**
 * Runs an effect with one memoized completion port for the whole run.
 *
 * **Details**
 *
 * Builds {@link GoalCompletionIoLive} once around `effect`, so packets that
 * share a base branch read its rule-suite listing once. A port provided
 * outside the run (a test fixture) is the one the memo wraps.
 * `goals completion refresh` and `goals doctor --online` run under it.
 *
 * **Example** (Wrap a run)
 *
 * ```ts
 * import { withGoalCompletionIo } from "@beep/repo-cli/commands/Goals/Completion"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(withGoalCompletionIo(Effect.void))) // true
 * ```
 *
 * @param effect - The run that reads completion facts.
 * @returns The same run with the memoized port provided.
 * @category combinators
 * @since 0.0.0
 */
export const withGoalCompletionIo = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  GoalCompletionIoLive.pipe(
    Layer.build,
    Effect.flatMap((context) => Effect.provideContext(effect, context)),
    Effect.scoped
  );
const refresh = Effect.fn("Goals.Completion.refresh")(function* (slug: O.Option<string>) {
  const root = yield* findRepoRoot();
  const records = yield* listGoalPackets(root);
  const location = yield* receiptLocation(root);
  const repository = yield* readReceiptRepository(root);
  // The workstation store is shared by every clone of the repository; without
  // a resolvable github.com origin the owning clone's legacy file still records it.
  const store = O.isSome(repository) ? yield* Effect.asSome(goalCompletionReceiptStore()) : O.none();
  const write = (receipt: GoalCompletionReceipt) =>
    O.match(store, {
      onSome: (shared) => shared.append(receipt),
      onNone: () =>
        ReceiptJson.encode(receipt).pipe(
          Effect.flatMap((text) => appendContainedFileString(location.ledgerRoot, location.file, `${text}\n`)),
          Effect.asVoid
        ),
    });
  if (O.exists(slug, (value) => !A.some(records, (record) => record.slug === value))) {
    return yield* YeetCommandError.make({ message: "Requested goal packet does not exist" });
  }
  const selected = O.match(slug, {
    onNone: () => records,
    onSome: (value) => A.filter(records, (record) => record.slug === value),
  });
  yield* Effect.forEach(selected, (record) => refreshRecord(root, record, O.isSome(slug), write));
}, withGoalCompletionIo);
/**
 * Explicit sole writer for derived completion receipts; doctor never calls this command.
 *
 * **Details**
 *
 * `refresh` observes each final from hosted facts, counting only committed
 * decision-file claims, and appends a `goal-completion-receipt/v2` row. It
 * prints attributed reds with their sources; a verified outcome that counts a
 * claim found only at `HEAD` reads
 * `verified (claims at HEAD only: …; not done until they merge)`. An outcome
 * that is not verified prints committed operator rulings, a remediation hint
 * and, when working-tree claims differ, whether they would verify once
 * committed (nothing about them is stored). A plain `verified`, or an
 * `operatorRuling` for the final on `origin/main`, acknowledges the packet's
 * `goal-closeout:<slug>#<n>` P0 inbox row in this checkout, the row
 * `yeet sweep --retire` raises for a merged closeout that did not verify,
 * and the rows of any final the packet bound before.
 *
 * **Example** (Inspect the completion command)
 *
 * ```ts
 * import { goalsCompletionCommand } from "@beep/repo-cli/commands/Goals/Completion"
 * console.log(goalsCompletionCommand.name)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const goalsCompletionCommand = Command.make("completion").pipe(
  Command.withSubcommands([
    Command.make("refresh", { slug: Flag.String("slug").pipe(Flag.optional) }, ({ slug }) => refresh(slug)).pipe(
      Command.withDescription("Explicitly observe GitHub and append workstation-scoped goal completion receipts")
    ),
  ])
);
