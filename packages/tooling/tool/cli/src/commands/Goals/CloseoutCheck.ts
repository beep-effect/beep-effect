/**
 * Online classification of a goal's committed closeout from hosted facts.
 *
 * **Details**
 *
 * One check per committed `closeout`: read the final PR first, then observe it
 * only when it merged inside the closeout window. An open final is not a
 * finding (the closeout PR is still in flight); a final closed without merging
 * can never verify and blocks at any age; a final merged before the window
 * reads its stored receipt instead of GitHub. Inside the window a verified
 * observation, or a committed `operatorRuling`, closes the final; an unknown
 * outcome caused only by failed GitHub reads or a still-running required
 * check is transient; anything else is `unverified` and blocks.
 * `goals doctor --online` and the `yeet sweep --retire` closeout trigger are
 * the only consumers, so both classify identically; the sweep counts only the
 * claims on `origin/main` ({@link GoalClaimScope}).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { ArrayKeyDefaultEmpty } from "@beep/schema/SchemaUtils/withKeyDefaults";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  GOAL_CLOSEOUT_WINDOW_DAYS,
  goalCompletionUnknownReasons,
  goalCompletionUnsatisfiedReasons,
  goalCompletionVerdict,
  goalFinalWithinCloseoutWindow,
  observeGoalCompletion,
  storedGoalCompletion,
} from "./Completion.ts";
import { GoalCompletionPull } from "./CompletionEvidence.schemas.ts";
import { GoalCompletionIo } from "./CompletionEvidence.service.ts";
import { goalCompletionIo, memoizeGoalCompletionRuleSuites, readGoalCompletion } from "./CompletionEvidence.ts";
import {
  GoalAttributedRedFact,
  GoalClaimSet,
  GoalCompletionClaims,
  GoalCompletionEvidenceGap,
  GoalCompletionReceipt,
  GoalCompletionReceiptVersion,
  GoalHostedEvidenceKind,
  GoalPullRequestRef,
} from "./Goals.schemas.ts";
import { readGoalCompletionClaims } from "./RedAttribution.ts";
import type * as Digest from "effect/crypto/Digest";
import type * as FileSystem from "effect/FileSystem";
import type * as Path from "effect/Path";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type {
  GoalEvidenceCheck,
  GoalManifest,
  GoalRedAttributionClaim,
  GoalRequiredCheckFact,
} from "./Goals.schemas.ts";
import type { GoalClaimScope } from "./RedAttribution.ts";

const $I = $RepoCliId.create("commands/Goals/CloseoutCheck");

/**
 * How one committed closeout classifies online.
 *
 * **Details**
 *
 * - `final-open`: the final PR is still open; no finding.
 * - `verified`: hosted facts verify the final.
 * - `operator-ruling`: not verified, but a committed `operatorRuling` closes it.
 * - `beyond-window`: merged before the closeout window and not verified; a note.
 * - `transient`: unknown only because a GitHub read failed or a required check is still running.
 * - `unverified`: unsatisfied, unknown for a structural reason, or closed without merging; blocking.
 *
 * **Example** (Guard an outcome)
 *
 * ```ts
 * import { GoalCloseoutCheckOutcome } from "@beep/repo-cli/commands/Goals/CloseoutCheck"
 * console.log(GoalCloseoutCheckOutcome.is["final-open"]("final-open")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GoalCloseoutCheckOutcome = LiteralKit([
  "final-open",
  "verified",
  "operator-ruling",
  "beyond-window",
  "transient",
  "unverified",
]).pipe(
  $I.annoteSchema("GoalCloseoutCheckOutcome", {
    description: "How one committed goal closeout classifies when its final PR is read online.",
  })
);

/**
 * How one committed closeout classifies online.
 *
 * @category type-level
 * @since 0.0.0
 */
export type GoalCloseoutCheckOutcome = typeof GoalCloseoutCheckOutcome.Type;

/**
 * The closeout outcomes that block: only `unverified`.
 *
 * **Example** (Test whether an outcome blocks)
 *
 * ```ts
 * import { GoalCloseoutCheckBlocking } from "@beep/repo-cli/commands/Goals/CloseoutCheck"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(GoalCloseoutCheckBlocking)("unverified")) // true
 * console.log(S.is(GoalCloseoutCheckBlocking)("transient")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GoalCloseoutCheckBlocking = GoalCloseoutCheckOutcome.pick(["unverified"]).pipe(
  $I.annoteSchema("GoalCloseoutCheckBlocking", {
    description: "The goal closeout outcomes that are blocking findings.",
  })
);

/**
 * The online classification of one packet's committed closeout.
 *
 * **Details**
 *
 * `reasons` says why the outcome is what it is (the unknown or unsatisfied
 * reasons, or the state of the final PR) and carries advisory notes: an
 * attribution conflict, or an attribution naming a context that was neither
 * red nor missing. `attributedReds` lists the reds committed claims cleared
 * when the outcome is verified; `rulingFile` names the operator ruling that
 * closed an `operator-ruling` outcome.
 *
 * **Example** (Record a blocking check)
 *
 * ```ts
 * import { GoalCloseoutCheck } from "@beep/repo-cli/commands/Goals/CloseoutCheck"
 *
 * const check = GoalCloseoutCheck.make({
 *   packet: "demo",
 *   finalPullRequest: 7,
 *   outcome: "unverified",
 *   reasons: ["unattributed red: Lint"],
 * })
 * console.log(check.rulingFile._tag) // "None"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalCloseoutCheck extends S.Opaque<GoalCloseoutCheck, { readonly brand: unique symbol }>()(
  S.Struct({
    packet: S.NonEmptyString,
    finalPullRequest: S.Int.check(S.isGreaterThan(0)),
    outcome: GoalCloseoutCheckOutcome,
    reasons: ArrayKeyDefaultEmpty(S.String),
    attributedReds: ArrayKeyDefaultEmpty(GoalAttributedRedFact),
    rulingFile: S.OptionFromNullOr(S.NonEmptyString).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.withDecodingDefaultKey(Effect.succeed(null))
    ),
  }).pipe(
    $I.annoteSchema("GoalCloseoutCheck", {
      description: "Online classification of one committed goal closeout: outcome, reasons, attributed reds, ruling.",
    })
  )
) {}

const isHostedEvidenceKind = S.is(GoalHostedEvidenceKind);
const TransientGap = GoalCompletionEvidenceGap.pick([
  "network-failure",
  "partial-ruleset-reads",
  "inventory-unobserved",
]);
const isTransientGap = S.is(TransientGap);
const FIX_PULL_REQUESTS_REF = "fix-pull-requests";

const headFactsOf = (receipt: GoalCompletionReceipt, context: string): ReadonlyArray<GoalRequiredCheckFact> =>
  A.filter(
    receipt.requiredCheckFacts,
    (fact) => fact.context === context && O.contains(receipt.acceptedHead, fact.head)
  );

const isPending = (fact: GoalRequiredCheckFact): boolean => O.isSome(fact.checkRunId) && fact.outcome === "unknown";

// Red, or never reported on the head: the facts a claim may attribute.
const redOrMissing = (facts: ReadonlyArray<GoalRequiredCheckFact>): boolean =>
  A.some(facts, (fact) => fact.outcome === "unsatisfied") ||
  (A.isReadonlyArrayNonEmpty(facts) && A.every(facts, (fact) => O.isNone(fact.checkRunId)));

const claimValue = (claim: GoalRedAttributionClaim): string => `${claim.attribution}#${claim.fixPullRequest}`;

// A context the receipt's counted claims attribute unambiguously.
const attributedBy = (receipt: GoalCompletionReceipt, context: string): boolean =>
  A.length(
    A.dedupe(
      A.map(
        A.filter(receipt.redAttributions, (claim) => claim.context === context),
        claimValue
      )
    )
  ) === 1;

// `required-check-unobserved` is transient only when every uncovered required
// context has a run that is still pending; a context with no run and no claim
// is structural.
const onlyPendingUncovered = (receipt: GoalCompletionReceipt): boolean => {
  const contexts = O.match(receipt.requiredChecks, {
    onNone: A.empty<string>,
    onSome: (snapshot) => snapshot.contexts,
  });
  const uncovered = A.filter(A.dedupe(contexts), (context) => {
    const facts = headFactsOf(receipt, context);
    const verified = A.some(facts, (fact) => fact.outcome === "verified");
    return !verified && !(attributedBy(receipt, context) && redOrMissing(facts));
  });
  return (
    A.isReadonlyArrayNonEmpty(uncovered) &&
    A.every(uncovered, (context) => A.some(headFactsOf(receipt, context), isPending))
  );
};

/**
 * Whether an `unknown` receipt is unknown only for transient reasons.
 *
 * **Details**
 *
 * Transient means every unknown reason is one of: the gaps `network-failure`,
 * `partial-ruleset-reads` and `inventory-unobserved`; a failed review-thread
 * read; a failed fix-PR read; merge facts unobserved (a failed read); a
 * required context whose run is still pending. Anything else is structural:
 * `rule-suite-unavailable`, `inventory-mismatch`,
 * `deleted-ruleset-unrecoverable`, `unsupported-rule-source`, a required
 * context with no run and no claim, a missing hosted evidence kind, or a v1
 * row. A verified or unsatisfied receipt is never transient.
 *
 * **Example** (A failed GitHub read is transient)
 *
 * ```ts
 * import { goalCompletionTransient } from "@beep/repo-cli/commands/Goals/CloseoutCheck"
 * import { GoalCompletionReceipt } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const receipt = GoalCompletionReceipt.make({
 *   repository: "example/repo",
 *   packet: "demo",
 *   declarationDigest: "digest",
 *   acceptedDeclarationDigest: O.none(),
 *   finalPullRequest: 7,
 *   acceptedHead: O.none(),
 *   merge: O.none(),
 *   evidence: [],
 *   nonRequiredReds: [],
 *   subClaims: [],
 *   outcome: "unknown",
 *   verifiedAt: DateTime.makeUnsafe(0),
 * })
 * console.log(goalCompletionTransient(receipt)) // true
 * ```
 *
 * @param receipt - An observed or stored completion receipt.
 * @returns `true` when every reason it is unknown is transient.
 * @category predicates
 * @since 0.0.0
 */
export const goalCompletionTransient = (receipt: GoalCompletionReceipt): boolean => {
  if (receipt.outcome !== "unknown") return false;
  if (O.isNone(receipt.merge)) return true;
  if (GoalCompletionReceiptVersion.is["goal-completion-receipt/v1"](receipt.schemaVersion)) return false;
  const gating = A.filter(receipt.evidence, (check) => check.ref.gating && isHostedEvidenceKind(check.ref.kind));
  const everyKind = A.every(GoalHostedEvidenceKind.literals, (kind) =>
    A.some(gating, (check) => check.ref.kind === kind)
  );
  const verdict = goalCompletionVerdict(receipt);
  const verdictUnknown = verdict._tag === "unknown";
  const transientCheck = (check: GoalEvidenceCheck): boolean =>
    check.ref.kind === "hosted-review-threads" ||
    check.ref.ref === FIX_PULL_REQUESTS_REF ||
    (check.ref.kind === "hosted-required-checks" && verdictUnknown);
  const gapsTransient =
    verdict._tag !== "unknown" ||
    A.every(
      verdict.gaps,
      (gap) => isTransientGap(gap) || (gap === "required-check-unobserved" && onlyPendingUncovered(receipt))
    );
  return (
    everyKind &&
    gapsTransient &&
    A.every(
      A.filter(gating, (check) => check.outcome === "unknown" || O.isNone(check.observedHead)),
      transientCheck
    )
  );
};

const unsatisfiedReasons = (receipt: GoalCompletionReceipt): ReadonlyArray<string> => {
  const reasons = [
    ...(O.contains(false)(receipt.merged) ? [`final #${receipt.finalPullRequest} has not merged`] : []),
    ...goalCompletionUnsatisfiedReasons(receipt),
    ...A.map(
      A.filter(
        receipt.evidence,
        (check) =>
          check.ref.gating &&
          isHostedEvidenceKind(check.ref.kind) &&
          O.exists(check.observedHead, (head) => !O.contains(head)(receipt.acceptedHead))
      ),
      (check) => `gating evidence ${check.ref.kind} "${check.ref.ref}" observed at another head`
    ),
  ];
  return A.isReadonlyArrayNonEmpty(reasons) ? reasons : ["completion unsatisfied"];
};

// Only a receipt that did not verify reaches here, so it is unsatisfied or unknown.
const outcomeReasons = (receipt: GoalCompletionReceipt): ReadonlyArray<string> =>
  receipt.outcome === "unsatisfied" ? unsatisfiedReasons(receipt) : goalCompletionUnknownReasons(receipt);

// Advisory notes about the committed claims themselves.
const claimNotes = (receipt: GoalCompletionReceipt, claims: GoalClaimSet): ReadonlyArray<string> => {
  const contexts = O.map(receipt.requiredChecks, (snapshot) => snapshot.contexts);
  const stale = O.match(contexts, {
    onNone: A.empty<GoalRedAttributionClaim>,
    onSome: (required) =>
      A.filter(
        claims.redAttributions,
        (claim) => !A.contains(required, claim.context) || !redOrMissing(headFactsOf(receipt, claim.context))
      ),
  });
  return [
    ...A.map(
      claims.conflicts,
      (conflict) =>
        `attribution conflict: ${conflict.context} in ${A.join(conflict.decisionFiles, ", ")}; the context stays unattributed`
    ),
    ...A.map(
      stale,
      (claim) => `stale attribution: ${claim.context} in ${claim.decisionFile} was neither red nor missing at the head`
    ),
  ];
};

/**
 * What {@link classifyGoalCloseout} decides from: the packet, its final, the pre-check read, the time, a receipt and the claims.
 *
 * **Details**
 *
 * `pull` is the final's pull-request read (none when it failed), `now` the
 * reading time, `receipt` the observed or stored receipt (none when nothing
 * was observed) and `claims` the committed claim set for the final.
 *
 * **Example** (A final whose read failed)
 *
 * ```ts
 * import { GoalCloseoutClassificationInput } from "@beep/repo-cli/commands/Goals/CloseoutCheck"
 * import { GoalClaimSet } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const input = GoalCloseoutClassificationInput.make({
 *   packet: "demo",
 *   finalPullRequest: 7,
 *   pull: O.none(),
 *   now: DateTime.makeUnsafe("2026-11-12T00:00:00Z"),
 *   receipt: O.none(),
 *   claims: GoalClaimSet.make({}),
 * })
 * console.log(input.pull._tag) // "None"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalCloseoutClassificationInput extends S.Opaque<
  GoalCloseoutClassificationInput,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    packet: S.NonEmptyString,
    finalPullRequest: S.Int.check(S.isGreaterThan(0)),
    pull: S.Option(GoalCompletionPull),
    now: S.DateTimeUtc,
    receipt: S.Option(GoalCompletionReceipt),
    claims: GoalClaimSet,
  }).pipe(
    $I.annoteSchema("GoalCloseoutClassificationInput", {
      description:
        "Inputs of one closeout classification: the packet, its final, the pull-request read, the time, a receipt and the committed claims.",
    })
  )
) {}

const closeoutCheck = (
  input: GoalCloseoutClassificationInput,
  outcome: GoalCloseoutCheckOutcome,
  reasons: ReadonlyArray<string>,
  extra: Partial<Pick<GoalCloseoutCheck, "attributedReds" | "rulingFile">> = {}
): GoalCloseoutCheck =>
  GoalCloseoutCheck.make({
    packet: input.packet,
    finalPullRequest: input.finalPullRequest,
    outcome,
    reasons: [...reasons],
    ...extra,
  });

// A v1 row that verified is returned as stored, so its verdict can be other than verified.
const verifiedCloseoutCheck = (input: GoalCloseoutClassificationInput, receipt: GoalCompletionReceipt) => {
  const verdict = goalCompletionVerdict(receipt);
  return closeoutCheck(
    input,
    "verified",
    [
      ...(GoalCompletionReceiptVersion.is["goal-completion-receipt/v1"](receipt.schemaVersion)
        ? [`verified by a goal-completion-receipt/v1 row (Yeet readiness rules)`]
        : []),
      ...claimNotes(receipt, input.claims),
    ],
    { attributedReds: verdict._tag === "verified" ? [...verdict.attributedReds] : [] }
  );
};

// The pull-request read decides alone: unread, open, closed without merging,
// or merged before the window (where only a stored verified receipt verifies).
const pullStateCheck = (input: GoalCloseoutClassificationInput): O.Option<GoalCloseoutCheck> => {
  const final = input.finalPullRequest;
  if (O.isNone(input.pull))
    return O.some(closeoutCheck(input, "transient", [`final #${final} unreadable: the pull request read failed`]));
  const pull = input.pull.value;
  if (!pull.merged)
    return O.some(
      pull.state === "open"
        ? closeoutCheck(input, "final-open", [`final #${final} open`])
        : closeoutCheck(input, "unverified", [
            `final #${final} closed without merging; bind a new final or reopen the packet`,
          ])
    );
  if (!O.exists(pull.merged_at, (mergedAt) => !goalFinalWithinCloseoutWindow(mergedAt, input.now))) return O.none();
  return O.some(
    O.match(
      O.filter(input.receipt, (receipt) => receipt.outcome === "verified"),
      {
        onSome: (receipt) => verifiedCloseoutCheck(input, receipt),
        onNone: () =>
          closeoutCheck(input, "beyond-window", [
            `final #${final} merged more than ${GOAL_CLOSEOUT_WINDOW_DAYS} days ago, beyond the rule-suite window`,
          ]),
      }
    )
  );
};

// Inside the window the receipt decides, then a committed ruling, then whether the unknown is transient.
const receiptCheck = (input: GoalCloseoutClassificationInput): GoalCloseoutCheck => {
  if (O.isNone(input.receipt))
    return closeoutCheck(input, "transient", [`final #${input.finalPullRequest} not observed`]);
  const receipt = input.receipt.value;
  if (receipt.outcome === "verified") return verifiedCloseoutCheck(input, receipt);
  const reasons = [...outcomeReasons(receipt), ...claimNotes(receipt, input.claims)];
  return O.match(
    A.findFirst(input.claims.operatorRulings, (claim) => claim.finalPullRequest === input.finalPullRequest),
    {
      onSome: (ruling) => closeoutCheck(input, "operator-ruling", reasons, { rulingFile: O.some(ruling.decisionFile) }),
      onNone: () => closeoutCheck(input, goalCompletionTransient(receipt) ? "transient" : "unverified", reasons),
    }
  );
};

/**
 * Classifies one committed closeout from its final PR, the reading time, a receipt and the committed claims.
 *
 * **Details**
 *
 * Pure. In order: a failed pull-request read is `transient`; an open final is
 * `final-open`; a final closed without merging is `unverified` at any age; a
 * final merged more than {@link GOAL_CLOSEOUT_WINDOW_DAYS} days before `now`
 * is `beyond-window` unless `receipt` (then the stored one) verified it;
 * otherwise a verified receipt is `verified`, a committed `operatorRuling`
 * for the final is `operator-ruling`, a transient unknown
 * ({@link goalCompletionTransient}) is `transient`, and anything else is
 * `unverified`.
 *
 * **Example** (An open final is no finding)
 *
 * ```ts
 * import { classifyGoalCloseout, GoalCloseoutClassificationInput } from "@beep/repo-cli/commands/Goals/CloseoutCheck"
 * import { GoalCompletionPull } from "@beep/repo-cli/commands/Goals/CompletionEvidence.schemas"
 * import { GoalClaimSet } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const pull = GoalCompletionPull.make({
 *   created_at: DateTime.makeUnsafe("2026-11-10T00:00:00Z"),
 *   number: 7,
 *   state: "open",
 *   merged: false,
 *   merged_at: O.none(),
 *   merge_commit_sha: O.none(),
 *   head: { sha: "head" },
 *   base: { ref: "main", repo: { full_name: "example/repo" } },
 * })
 * const check = classifyGoalCloseout(
 *   GoalCloseoutClassificationInput.make({
 *     packet: "demo",
 *     finalPullRequest: 7,
 *     pull: O.some(pull),
 *     now: DateTime.makeUnsafe("2026-11-12T00:00:00Z"),
 *     receipt: O.none(),
 *     claims: GoalClaimSet.make({}),
 *   })
 * )
 * console.log(check.outcome) // "final-open"
 * ```
 *
 * @param input - The packet, its final PR, the pre-check read, the reading time, the receipt and the committed claims.
 * @returns The classification.
 * @category validation
 * @since 0.0.0
 */
export const classifyGoalCloseout = (input: GoalCloseoutClassificationInput): GoalCloseoutCheck =>
  O.getOrElse(pullStateCheck(input), () => receiptCheck(input));

/**
 * Operations the closeout checker supplies.
 *
 * @category models
 * @since 0.0.0
 */
export type GoalCloseoutCheckerShape = {
  readonly check: (
    root: string,
    slug: string,
    manifest: GoalManifest,
    scope?: GoalClaimScope
  ) => Effect.Effect<O.Option<GoalCloseoutCheck>>;
};

const makeGoalCloseoutChecker = Effect.gen(function* () {
  const context = yield* Effect.context<
    ChildProcessSpawner.ChildProcessSpawner | Digest.Digest | FileSystem.FileSystem | Path.Path
  >();
  // One memoized port per checker, so packets that share a base read its rule-suite listing once.
  const io = yield* Effect.flatMap(goalCompletionIo(), memoizeGoalCompletionRuleSuites);
  const check = Effect.fn("GoalCloseoutChecker.check")(
    function* (root: string, slug: string, manifest: GoalManifest, scope: GoalClaimScope = "checkout") {
      const record = manifest.closeout;
      if (record === undefined || manifest.completionGate.grandfathered) return O.none<GoalCloseoutCheck>();
      const final = GoalPullRequestRef.make({ number: record.finalPullRequest, role: "final" });
      const pull = yield* readGoalCompletion(root, (port, at) => port.pullRequest(at, final.number)).pipe(
        Effect.option
      );
      const now = yield* DateTime.now;
      const merged = O.filter(pull, (value) => value.merged);
      // A merged final without a merge time reads as inside the window.
      const inWindow = O.exists(merged, (value) =>
        O.match(value.merged_at, { onNone: () => true, onSome: (at) => goalFinalWithinCloseoutWindow(at, now) })
      );
      const claims = inWindow
        ? yield* readGoalCompletionClaims(root, slug, final.number, scope)
        : GoalCompletionClaims.make({});
      const receipt = inWindow
        ? yield* observeGoalCompletion(root, slug, manifest, final, claims).pipe(Effect.option)
        : O.isSome(merged)
          ? yield* storedGoalCompletion(root, slug, manifest, final).pipe(Effect.orElseSucceed(O.none))
          : O.none<GoalCompletionReceipt>();
      return O.some(
        classifyGoalCloseout(
          GoalCloseoutClassificationInput.make({
            packet: slug,
            finalPullRequest: final.number,
            pull,
            now,
            receipt,
            claims: claims.committed,
          })
        )
      );
    },
    Effect.provideService(GoalCompletionIo, io),
    Effect.provideContext(context),
    Effect.orElseSucceed(O.none<GoalCloseoutCheck>)
  );
  const shape: GoalCloseoutCheckerShape = { check };
  return shape;
});

/**
 * Classifies a packet's committed closeout online.
 *
 * **Details**
 *
 * `check` returns none when the manifest commits no `closeout` or its gate is
 * grandfathered. Otherwise it reads the final PR first and observes it only
 * when it merged inside the closeout window, with the packet's committed
 * claims in the given {@link GoalClaimScope} (`checkout` by default); a final
 * merged before the window reads its stored receipt. The
 * result comes from {@link classifyGoalCloseout}. {@link GoalCloseoutCheckerLive}
 * reads GitHub through the completion port; {@link GoalCloseoutChecker.layerTest}
 * returns fixed checks.
 *
 * **Example** (Read a fixed check)
 *
 * ```ts
 * import { GoalCloseoutCheck, GoalCloseoutChecker } from "@beep/repo-cli/commands/Goals/CloseoutCheck"
 * import { GoalManifest } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 * import * as Effect from "effect/Effect"
 *
 * const manifest = GoalManifest.make({
 *   initiative: { id: "demo", status: "completed-retained" },
 *   completionGate: { operator: "yeet", requiresPullRequest: true, requiresMergeable: true, statement: "Ship.", grandfathered: false },
 *   closeout: { status: "completed-retained", finalPullRequest: 7 },
 * })
 * const fixed = GoalCloseoutCheck.make({ packet: "demo", finalPullRequest: 7, outcome: "verified" })
 * const program = GoalCloseoutChecker.use((checker) => checker.check("/repo", "demo", manifest))
 * const check = Effect.runSync(Effect.provide(program, GoalCloseoutChecker.layerTest([fixed])))
 * console.log(check._tag) // "Some"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class GoalCloseoutChecker extends Context.Service<GoalCloseoutChecker, GoalCloseoutCheckerShape>()(
  $I`GoalCloseoutChecker`
) {
  /**
   * A checker that returns the fixed check for the packet's slug, or none.
   *
   * **Example** (Build a fixed checker)
   *
   * ```ts
   * import { GoalCloseoutChecker } from "@beep/repo-cli/commands/Goals/CloseoutCheck"
   * import * as Layer from "effect/Layer"
   *
   * console.log(Layer.isLayer(GoalCloseoutChecker.layerTest([]))) // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layerTest = (checks: ReadonlyArray<GoalCloseoutCheck>): Layer.Layer<GoalCloseoutChecker> =>
    Layer.succeed(GoalCloseoutChecker, {
      check: Effect.fn("GoalCloseoutChecker.layerTest.check")((_root: string, slug: string) =>
        Effect.succeed(A.findFirst(checks, (check) => check.packet === slug))
      ),
    });
}

/**
 * The live closeout checker over the completion port.
 *
 * **Details**
 *
 * Built once per command run. A completion port already provided outside it
 * (a test fixture) is the one it reads through, with its rule-suite listings
 * memoized.
 *
 * **Example** (Inspect the live layer)
 *
 * ```ts
 * import { GoalCloseoutCheckerLive } from "@beep/repo-cli/commands/Goals/CloseoutCheck"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(GoalCloseoutCheckerLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const GoalCloseoutCheckerLive: Layer.Layer<
  GoalCloseoutChecker,
  never,
  ChildProcessSpawner.ChildProcessSpawner | Digest.Digest | FileSystem.FileSystem | Path.Path
> = Layer.effect(GoalCloseoutChecker, makeGoalCloseoutChecker);

/**
 * Classifies a packet's committed closeout through a provided {@link GoalCloseoutChecker}, or the live checker.
 *
 * **Example** (Build the read)
 *
 * ```ts
 * import { readGoalCloseoutCheck } from "@beep/repo-cli/commands/Goals/CloseoutCheck"
 * import { GoalManifest } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 * import * as Effect from "effect/Effect"
 *
 * const manifest = GoalManifest.make({
 *   initiative: { id: "demo", status: "active" },
 *   completionGate: { operator: "yeet", requiresPullRequest: true, requiresMergeable: true, statement: "Ship.", grandfathered: false },
 * })
 * console.log(Effect.isEffect(readGoalCloseoutCheck("/repo", "demo", manifest))) // true
 * ```
 *
 * @param root - Repository root.
 * @param slug - Packet slug under `goals/`.
 * @param manifest - The manifest whose committed closeout to classify.
 * @param scope - Which decision files count as claims; `checkout` by default.
 * @returns The classification, or none without a committed, non-grandfathered closeout.
 * @category queries
 * @since 0.0.0
 */
export const readGoalCloseoutCheck = Effect.fn("Goals.readGoalCloseoutCheck")(function* (
  root: string,
  slug: string,
  manifest: GoalManifest,
  scope: GoalClaimScope = "checkout"
) {
  const supplied = yield* Effect.serviceOption(GoalCloseoutChecker);
  const checker = O.isSome(supplied) ? supplied.value : yield* makeGoalCloseoutChecker;
  return yield* checker.check(root, slug, manifest, scope);
});
