/**
 * Read-only goal completion verification and explicit clone-scoped receipt refresh.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import { Command, Flag } from "effect/cli";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { appendContainedFileString, readContainedFileStringNoFollow } from "../../internal/cli/FsGuards.ts";
import { ghOutput } from "../../internal/github/index.ts";
import { runGitOutput } from "../../internal/repo-run/index.ts";
import { JsonStringCodec } from "../../internal/schema/JsonCodec.ts";
import { resolveProofLedgerLocation } from "../Yeet/internal/ArtifactPaths.ts";
import { hydrateYeetReadOnlyContext } from "../Yeet/internal/Handler.ts";
import { MergeGateCheckRun } from "../Yeet/internal/MergeGate.ts";
import { decideYeetReviewWindow } from "../Yeet/internal/ReviewWindow.ts";
import { readYeetRulesetRequiredContexts } from "../Yeet/internal/Settle.ts";
import { YeetVerdict } from "../Yeet/internal/Verdict.ts";
import { YeetCommandError } from "../Yeet/Yeet.errors.ts";
import {
  GoalAcceptanceEvidenceRef,
  GoalCompletionReceipt,
  GoalEvidenceCheck,
  GoalManifest,
  GoalMergeResult,
  GoalNonRequiredRed,
  goalPullRequestRefs,
} from "./Goals.schemas.ts";
import { listGoalPackets, parseGoalManifestText } from "./Inventory.ts";
import { canonicalJsonText, sha256Hex } from "./PacketCore/PacketDigest.ts";
import type { GoalCompletionOutcome, GoalPullRequestRef } from "./Goals.schemas.ts";

const $I = $RepoCliId.create("commands/Goals/Completion");
const hostedRef = GoalAcceptanceEvidenceRef.make({ kind: "hosted-required-checks", ref: "required", gating: true });
const gitAdapter = {
  onSpawnFailure: (command: string) => (_cause: unknown) => YeetCommandError.make({ message: `Cannot run ${command}` }),
  onNonZeroExit: ({ commandLine }: { readonly commandLine: string }) =>
    YeetCommandError.make({ message: `${commandLine} failed` }),
  onTruncated: O.none<(command: string) => YeetCommandError>(),
};

/**
 * Pure verification input: absence is explicit and cannot become a success by default.
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
export class GoalCompletionObservation extends S.Class<GoalCompletionObservation>($I`GoalCompletionObservation`)(
  {
    repository: S.NonEmptyString,
    packet: S.NonEmptyString,
    declarationDigest: S.NonEmptyString,
    acceptedDeclarationDigest: S.Option(S.NonEmptyString),
    finalPullRequest: S.Int.check(S.isGreaterThan(0)),
    acceptedHead: S.Option(S.NonEmptyString),
    merged: S.Option(S.Boolean),
    merge: S.Option(GoalMergeResult),
    grandfathered: S.Boolean,
    evidence: S.Array(GoalEvidenceCheck),
    nonRequiredReds: S.Array(GoalNonRequiredRed),
    subClaims: S.Array(GoalEvidenceCheck),
    verifiedAt: S.DateTimeUtcFromString,
  },
  $I.annote("GoalCompletionObservation", {
    description: "Facts observed once for a declared final PR, separate from the pure completion decision.",
  })
) {}

const overallOutcome = (observation: GoalCompletionObservation): GoalCompletionOutcome => {
  if (observation.grandfathered) return "verified";
  if (O.contains(false)(observation.merged)) return "unsatisfied";
  const gating = A.filter(observation.evidence, (check) => check.ref.gating);
  if (
    A.some(
      gating,
      (check) =>
        check.outcome === "unsatisfied" ||
        O.exists(check.observedHead, (head) => !O.contains(head)(observation.acceptedHead))
    )
  )
    return "unsatisfied";
  if (
    O.isNone(observation.merged) ||
    O.isNone(observation.merge) ||
    O.isNone(observation.acceptedHead) ||
    O.isNone(observation.acceptedDeclarationDigest) ||
    A.isReadonlyArrayEmpty(gating) ||
    A.some(gating, (check) => check.outcome === "unknown" || O.isNone(check.observedHead))
  )
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
        schemaVersion: "goal-completion-receipt/v1",
        repository: observation.repository,
        packet: observation.packet,
        declarationDigest: observation.declarationDigest,
        acceptedDeclarationDigest: observation.acceptedDeclarationDigest,
        finalPullRequest: observation.finalPullRequest,
        acceptedHead: observation.acceptedHead,
        merge: observation.merge,
        evidence: observation.evidence,
        nonRequiredReds: observation.nonRequiredReds,
        subClaims: observation.subClaims,
        outcome: overallOutcome(observation),
        verifiedAt: observation.verifiedAt,
      })
    )
  );
}

const Pull = S.Struct({
  number: S.Int,
  merged: S.Boolean,
  merged_at: S.OptionFromNullOr(S.DateTimeUtcFromString),
  merge_commit_sha: S.OptionFromNullOr(S.NonEmptyString),
  head: S.Struct({ sha: S.NonEmptyString }),
  base: S.Struct({ ref: S.NonEmptyString, repo: S.Struct({ full_name: S.NonEmptyString }) }),
});
const Commit = S.Struct({
  sha: S.NonEmptyString,
  parents: S.Array(S.Struct({ sha: S.NonEmptyString })),
  commit: S.Struct({ tree: S.Struct({ sha: S.NonEmptyString }) }),
});
const TimedCheck = S.Struct({
  ...MergeGateCheckRun.fields,
  head_sha: S.NonEmptyString,
  completed_at: S.OptionFromNullOr(S.DateTimeUtcFromString),
});
const CheckPages = S.Array(S.Struct({ check_runs: S.Array(TimedCheck) }));
const TimelinePages = S.Struct({ event: S.String, created_at: S.optionalKey(S.DateTimeUtcFromString) }).pipe(
  S.Array,
  S.Array
);
const ReceiptJson = JsonStringCodec(GoalCompletionReceipt);
const readJson = Effect.fn("Goals.Completion.readJson")(function* <Sch extends S.Codec<unknown, unknown>>(
  root: string,
  args: ReadonlyArray<string>,
  schema: Sch
) {
  const text = yield* ghOutput({
    cwd: root,
    args,
    label: "goal completion GitHub observation",
    onFailure: (failure) => YeetCommandError.make({ message: `${failure.label}: ${failure._tag}` }),
  });
  return yield* JsonStringCodec(schema)
    .decode(text)
    .pipe(Effect.mapError(() => YeetCommandError.make({ message: "Invalid goal completion GitHub payload" })));
});
const declarationDigest = Effect.fn("Goals.Completion.declarationDigest")(function* (manifest: GoalManifest) {
  const gate = yield* S.encodeEffect(GoalManifest)(manifest);
  return yield* sha256Hex(
    canonicalJsonText({
      initiative: { id: manifest.initiative.id },
      packetId: manifest.packetId,
      completionGate: gate.completionGate,
      pullRequests: goalPullRequestRefs(manifest),
    })
  );
});
const evidenceCheck = (
  ref: GoalAcceptanceEvidenceRef,
  outcome: GoalCompletionOutcome,
  head: O.Option<string>,
  detail: string
) => GoalEvidenceCheck.make({ ref, outcome, observedHead: head, detail });

const readLocalEvidence = Effect.fn("Goals.Completion.localEvidence")(function* (
  root: string,
  ref: GoalAcceptanceEvidenceRef,
  head: string
) {
  if (ref.kind !== "yeet-verdict")
    return evidenceCheck(
      ref,
      "unknown",
      O.none(),
      `${ref.kind} reference needs an independently head-bound provider; no evidence inferred from its path.`
    );
  const read = yield* readContainedFileStringNoFollow(root, ref.ref).pipe(Effect.option);
  const verdict =
    O.isSome(read) && O.isSome(read.value.contents)
      ? yield* JsonStringCodec(YeetVerdict).decode(read.value.contents.value).pipe(Effect.option)
      : O.none<YeetVerdict>();
  if (O.isNone(verdict)) return evidenceCheck(ref, "unknown", O.none(), "Yeet verdict absent, invalid or unreadable.");
  const observedHead = verdict.value.resolvedHeadSha;
  const ready = O.map(verdict.value.mergeReady, (value) => value.ready);
  return evidenceCheck(
    ref,
    O.exists(observedHead, (value) => value !== head) || O.contains(false)(ready)
      ? "unsatisfied"
      : O.isSome(ready) && O.isSome(observedHead)
        ? "verified"
        : "unknown",
    observedHead,
    "Yeet verdict checked against resolvedHeadSha and mergeReady.ready."
  );
});

/**
 * Observes a final PR on GitHub without writing receipt or manifest state.
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
  final: GoalPullRequestRef
) {
  const digest = yield* declarationDigest(manifest);
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
  if (initial.grandfathered) return yield* GoalCompletionVerifier.resolve(initial);
  const pullRead = yield* readJson(root, ["api", `repos/{owner}/{repo}/pulls/${final.number}`], Pull).pipe(
    Effect.option
  );
  if (O.isNone(pullRead)) return yield* GoalCompletionVerifier.resolve(initial);
  const pull = pullRead.value;
  const head = pull.head.sha;
  const known = GoalCompletionObservation.make({
    ...initial,
    repository: pull.base.repo.full_name,
    acceptedHead: O.some(head),
    merged: O.some(pull.merged),
  });
  if (!pull.merged) return yield* GoalCompletionVerifier.resolve(known);
  const reads = yield* Effect.gen(function* () {
    const mergeSha = yield* Effect.fromOption(pull.merge_commit_sha).pipe(
      Effect.mapError(() => YeetCommandError.make({ message: "Merged PR has no merge result" }))
    );
    const mergedAt = yield* Effect.fromOption(pull.merged_at).pipe(
      Effect.mapError(() => YeetCommandError.make({ message: "Merged PR has no merge time" }))
    );
    const mergeCommit = yield* readJson(root, ["api", `repos/{owner}/{repo}/commits/${mergeSha}`], Commit);
    // GitHub binds this merge result to this PR head for all three workflows. A single-parent
    // result cannot distinguish squash from rebase reliably; retain method=None rather than guess.
    const merge = GoalMergeResult.make({
      mergeCommit: mergeSha,
      tree: mergeCommit.commit.tree.sha,
      mergedAt,
      method: A.length(mergeCommit.parents) === 2 ? O.some("merge") : O.none(),
      baseRef: pull.base.ref,
    });
    const acceptedText = yield* runGitOutput(
      root,
      ["show", `${head}:goals/${slug}/ops/manifest.json`],
      gitAdapter
    ).pipe(
      Effect.catchTag("YeetCommandError", () =>
        ghOutput({
          cwd: root,
          args: [
            "api",
            `repos/{owner}/{repo}/contents/goals/${slug}/ops/manifest.json?ref=${head}`,
            "-H",
            "Accept: application/vnd.github.raw+json",
          ],
          label: "accepted-head goal declaration",
          onFailure: (failure) => YeetCommandError.make({ message: `${failure.label}: ${failure._tag}` }),
        })
      ),
      Effect.option
    );
    const acceptedParsed = O.flatMap(acceptedText, parseGoalManifestText);
    const acceptedManifest = O.isSome(acceptedParsed)
      ? yield* S.decodeUnknownEffect(GoalManifest)(acceptedParsed.value).pipe(Effect.option)
      : O.none<GoalManifest>();
    const acceptedDeclarationDigest = O.isSome(acceptedManifest)
      ? O.some(yield* declarationDigest(acceptedManifest.value))
      : O.none<string>();
    const pages = yield* readJson(
      root,
      ["api", `repos/{owner}/{repo}/commits/${head}/check-runs?per_page=100`, "--paginate", "--slurp"],
      CheckPages
    );
    const checks = A.flatMap(pages, (page) => page.check_runs);
    const rules = yield* readYeetRulesetRequiredContexts(
      yield* hydrateYeetReadOnlyContext({ base: `origin/${pull.base.ref}`, head, packetDir: ".beep/yeet/packets" })
    );
    const required = O.map(rules, (value) => value.contexts);
    const gatingOutcome = O.match(required, {
      onNone: (): GoalCompletionOutcome => "unknown",
      onSome: (contexts): GoalCompletionOutcome => {
        if (A.isReadonlyArrayEmpty(contexts)) return "unknown";
        const outcomes = A.map(contexts, (name): GoalCompletionOutcome => {
          const matching = A.filter(
            checks,
            (check) =>
              check.name === name &&
              check.head_sha === head &&
              O.exists(check.completed_at, (time) => DateTime.toEpochMillis(time) <= DateTime.toEpochMillis(mergedAt))
          );
          const newest = A.reduce(matching, O.none<typeof TimedCheck.Type>(), (found, check) =>
            O.isNone(found) || check.id > found.value.id ? O.some(check) : found
          );
          return O.match(newest, {
            onNone: () => "unknown",
            onSome: (check) =>
              check.status !== "completed"
                ? "unknown"
                : check.conclusion === "success" || check.conclusion === "neutral" || check.conclusion === "skipped"
                  ? "verified"
                  : "unsatisfied",
          });
        });
        return A.contains(outcomes, "unsatisfied")
          ? "unsatisfied"
          : A.contains(outcomes, "unknown")
            ? "unknown"
            : "verified";
      },
    });
    let evidence = A.of(
      evidenceCheck(
        hostedRef,
        gatingOutcome,
        O.some(head),
        `Required contexts observed at accepted head before merge; ${O.getOrElse(O.map(required, A.length), () => 0)} contexts. Current base ruleset read separately; unavailable history is unknown.`
      )
    );
    for (const ref of manifest.completionGate.acceptanceEvidence ?? []) {
      evidence = A.append(
        evidence,
        ref.kind === "hosted-required-checks"
          ? evidenceCheck(ref, gatingOutcome, O.some(head), "Hosted required checks at accepted head.")
          : yield* readLocalEvidence(root, ref, head)
      );
    }
    const nonRequiredReds = A.map(
      A.filter(
        checks,
        (check) => check.conclusion === "failure" && !O.exists(required, (contexts) => A.contains(contexts, check.name))
      ),
      (check) =>
        GoalNonRequiredRed.make({
          lane: check.name,
          conclusionAtMerge: O.exists(
            check.completed_at,
            (time) => DateTime.toEpochMillis(time) <= DateTime.toEpochMillis(mergedAt)
          )
            ? "failure"
            : "pending",
          conclusionFinal: "failure",
          attribution: "unknown",
        })
    );
    const timeline = yield* readJson(
      root,
      ["api", `repos/{owner}/{repo}/issues/${final.number}/timeline?per_page=100`, "--paginate", "--slurp"],
      TimelinePages
    ).pipe(Effect.option);
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
    const suites = yield* readJson(
      root,
      ["api", `repos/{owner}/{repo}/commits/${head}/check-suites?per_page=100`, "--paginate", "--slurp"],
      S.Struct({ check_suites: S.Array(S.Struct({ created_at: S.DateTimeUtcFromString })) }).pipe(S.Array)
    ).pipe(Effect.option);
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
    const window = O.map(O.all({ pushedAt, readyAt: lastReady }), (instants) =>
      decideYeetReviewWindow({
        ...instants,
        now: mergedAt,
        readyAnchor: "ready-for-review",
        window: Duration.minutes(20),
      })
    );
    const subClaims = [
      evidenceCheck(
        GoalAcceptanceEvidenceRef.make({ kind: "packet-history", ref: "draft-to-ready", gating: false }),
        O.isNone(timeline) ? "unknown" : O.isSome(lastReady) ? "verified" : "unknown",
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
            `Review window at merge: ${value._tag}; anchor ${value.anchoredAt}. Check-suite first receipt plus force-push events use Yeet semantics.`,
        })
      ),
      evidenceCheck(
        GoalAcceptanceEvidenceRef.make({ kind: "yeet-verdict", ref: "merge-ready", gating: false }),
        "unknown",
        O.none(),
        "No head-bound Yeet verdict inferred from timeline or successful checks."
      ),
    ];
    return GoalCompletionObservation.make({
      ...known,
      merge: O.some(merge),
      acceptedDeclarationDigest,
      evidence,
      nonRequiredReds,
      subClaims,
    });
  }).pipe(Effect.option);
  return yield* GoalCompletionVerifier.resolve(O.getOrElse(reads, () => known));
});

const receiptLocation = Effect.fn("Goals.Completion.receiptLocation")(function* (root: string) {
  const path = yield* Path.Path;
  const { ledgerRoot } = yield* resolveProofLedgerLocation(root);
  return { ledgerRoot, file: path.join(ledgerRoot, ".beep", "goals", "completion-receipts.ndjson") };
});

/**
 * Reads the latest matching receipt; changed declarations cannot reuse an older verdict.
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
  const digest = yield* declarationDigest(manifest);
  const location = yield* receiptLocation(root);
  const read = yield* readContainedFileStringNoFollow(location.ledgerRoot, location.file);
  const text = O.getOrElse(read.contents, () => "");
  const lines = Str.split(text, "\n");
  const complete = Str.endsWith("\n")(text) ? lines : A.dropRight(lines, 1);
  const receipts = A.getSomes(A.map(complete, ReceiptJson.decodeOption));
  const remote = yield* runGitOutput(root, ["remote", "get-url", "origin"], gitAdapter).pipe(Effect.option);
  const repository = O.flatMap(remote, (text) =>
    O.flatMap(Str.match(/github\.com[:/]([^/\s]+\/[^/\s]+?)(?:\.git)?\s*$/u)(text), (match) => A.get(match, 1))
  );
  const matching = A.filter(
    receipts,
    (receipt) =>
      receipt.packet === slug &&
      receipt.declarationDigest === digest &&
      receipt.finalPullRequest === final.number &&
      O.contains(receipt.repository)(repository)
  );
  const newest = A.reduce(matching, O.none<GoalCompletionReceipt>(), (found, receipt) =>
    O.isNone(found) || DateTime.isGreaterThan(receipt.verifiedAt, found.value.verifiedAt) ? O.some(receipt) : found
  );
  if (O.isNone(newest)) return newest;
  const receipt = newest.value;
  return O.some(
    yield* GoalCompletionVerifier.resolve(
      GoalCompletionObservation.make({
        ...receipt,
        merged: O.isSome(receipt.merge) ? O.some(true) : O.none(),
        grandfathered: manifest.completionGate.grandfathered,
      })
    )
  );
});

const refresh = Effect.fn("Goals.Completion.refresh")(function* (slug: O.Option<string>) {
  const root = yield* findRepoRoot();
  const records = yield* listGoalPackets();
  const location = yield* receiptLocation(root);
  for (const record of records) {
    if (O.exists(slug, (value) => value !== record.slug)) continue;
    const parsed = O.flatMap(O.fromUndefinedOr(record.manifestText), parseGoalManifestText);
    if (O.isNone(parsed)) continue;
    const manifest = yield* S.decodeUnknownEffect(GoalManifest)(parsed.value).pipe(Effect.option);
    if (O.isNone(manifest)) continue;
    const final = A.findFirst(goalPullRequestRefs(manifest.value), (ref) => ref.role === "final");
    if (O.isNone(final) || manifest.value.completionGate.grandfathered) continue;
    const receipt = yield* observeGoalCompletion(root, record.slug, manifest.value, final.value);
    if (O.isNone(receipt.merge)) {
      yield* Console.log(
        `[goals:completion] ${record.slug} #${final.value.number}: ${receipt.outcome} (no post-merge receipt written)`
      );
      continue;
    }
    yield* appendContainedFileString(location.ledgerRoot, location.file, `${yield* ReceiptJson.encode(receipt)}\n`);
    yield* Console.log(`[goals:completion] ${record.slug} #${final.value.number}: ${receipt.outcome}`);
  }
});

/**
 * Explicit sole writer for derived completion receipts; doctor never calls this command.
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
      Command.withDescription("Explicitly observe GitHub and append clone-scoped goal completion receipts")
    ),
  ])
);
