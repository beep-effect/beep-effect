/**
 * The vendored-skill review ritual: `beep skills review`.
 *
 * **Details**
 *
 * A session replays every selected vendored skill at its current pin (the
 * update train's replay, B29), keys every hunk on (base pin, current pin,
 * patch-set hash, hunk hash), and queues each hunk the hunk ledger has not
 * settled: a `conflict` item for a hunk that did not apply exactly, and a
 * `classification` item for a hunk that applies but was never classified.
 *
 * The walk is bounded and resumable (contract 8): every answer is appended to
 * `.agents/skill-patches/ledger.jsonl` the moment it is given, the walk stops
 * when the time budget runs out or the reviewer quits, and the next session
 * starts from the first undecided hunk. `--ghost` first replays earlier human
 * decisions on byte-identical hunks at the same pin; a hunk that conflicted at
 * an earlier pin too is a second strike (B4) and always goes to a human with
 * `promote-candidate` suggested.
 *
 * Agents prepare a session (the read-only listing); the answers come from a
 * {@link SkillReviewDecider}, an interactive prompt or a scripted file of the
 * reviewer's decisions. Classification authority stays with the human (B21).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as Prompt from "effect/cli/Prompt";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Str from "effect/String";
import {
  appendHunkLedgerRows,
  decisionAtKey,
  ghostCandidate,
  isSecondStrike,
  latestClassification,
  readHunkLedger,
} from "./internal/HunkLedger.ts";
import { readSkillsLockDocument, SKILLS_LOCK_PATH } from "./internal/LockFile.ts";
import { readAtMergeBase } from "./internal/MergeBase.ts";
import { decodePatchText, readVerifiedPatchSeries } from "./internal/PatchSeries.ts";
import { listSkillPatchHunks } from "./SkillPatches.apply.ts";
import { SkillReviewRefusal, SkillsCommandError } from "./Skills.errors.ts";
import { decodeSkillsLockDocumentJson } from "./SkillsLock.schemas.ts";
import { SkillUpdateTrain, SkillUpdateTrainLive } from "./SkillsRelock.service.ts";
import {
  SkillHunkLedgerRow,
  SkillReviewDecide,
  SkillReviewItem,
  SkillReviewQuit,
  SkillReviewSession,
  SkillReviewSkill,
  SkillReviewSkip,
} from "./SkillsReview.schemas.ts";
import type * as Crypto from "effect/Crypto";
import type * as FileSystem from "effect/FileSystem";
import type * as Path from "effect/Path";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type * as Terminal from "effect/Terminal";
import type { HunkLedgerKey } from "./internal/HunkLedger.ts";
import type { SkillGitRevision, SkillPatchLabel } from "./Skills.schemas.ts";
import type { SkillsLockEntry, VendoredSkillLockEntry } from "./SkillsLock.schemas.ts";
import type { SkillHunkReport, SkillReplayReport } from "./SkillsRelock.schemas.ts";
import type { SkillUpdateTrainFailure } from "./SkillsRelock.service.ts";
import type {
  SkillPatchHunk,
  SkillReviewAnswer,
  SkillReviewOptions,
  SkillReviewScript,
  SkillReviewScriptEntry,
  SkillReviewStop,
} from "./SkillsReview.schemas.ts";

const $I = $RepoCliId.create("commands/Skills/SkillsReview.service");

/**
 * Every failure `skills review` can raise.
 *
 * @category type-level
 * @since 0.0.0
 */
export type SkillReviewFailure = SkillUpdateTrainFailure | SkillReviewRefusal;

// ---------------------------------------------------------------------------
// Services: the base pins and the decider.
// ---------------------------------------------------------------------------

/**
 * Service contract for the pins a review keys its old revision on.
 *
 * **Details**
 *
 * `baseRevisions` maps each vendored skill to the `sourceRevision` the base
 * branch's lock records. A skill missing from the map is keyed with its
 * current pin as both revisions, as it is when no bump is pending.
 *
 * @see {@link SkillReviewBaseSource} for the injectable service built on this contract.
 * @category services
 * @since 0.0.0
 */
export interface SkillReviewBaseSourceShape {
  /** The vendored pins of the base branch's lock, by skill. */
  readonly baseRevisions: (
    repoRoot: string
  ) => Effect.Effect<Readonly<Record<string, SkillGitRevision>>, SkillsCommandError>;
}

/**
 * Injectable source of the base branch's vendored pins.
 *
 * **Example** (Key every skill on its current pin)
 *
 * ```ts
 * import { SkillReviewBaseSource } from "@beep/repo-cli/commands/Skills/SkillsReview.service"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * const noBump = Layer.succeed(SkillReviewBaseSource, SkillReviewBaseSource.of({ baseRevisions: () => Effect.succeed({}) }))
 * console.log(Layer.isLayer(noBump)) // true
 * ```
 *
 * @see {@link SkillReviewBaseSourceLive} for the layer reading the lock at the merge-base with `origin/main`.
 * @category services
 * @since 0.0.0
 */
export class SkillReviewBaseSource extends Context.Service<SkillReviewBaseSource, SkillReviewBaseSourceShape>()(
  $I`SkillReviewBaseSource`
) {}

const REVIEW_BASE_REF = "origin/main";

const vendoredEntries = (
  skills: Readonly<Record<string, SkillsLockEntry>>
): Readonly<Record<string, VendoredSkillLockEntry>> =>
  R.getSomes(R.map(skills, (entry) => (entry._tag === "vendored" ? O.some(entry) : O.none<VendoredSkillLockEntry>())));

const readBaseRevisions = Effect.fn("SkillReviewBaseSource.readBaseRevisions")(function* (repoRoot: string) {
  const read = yield* readAtMergeBase(repoRoot, REVIEW_BASE_REF, SKILLS_LOCK_PATH, "the review's old revisions");
  if (O.isNone(read.text)) {
    return R.empty<string, SkillGitRevision>();
  }
  const document = yield* decodeSkillsLockDocumentJson(read.text.value).pipe(
    SkillsCommandError.mapError(`The base ${SKILLS_LOCK_PATH} is not a skills-lock/v2 document.`, repoRoot)
  );
  return R.map(vendoredEntries(document.skills), (entry) => entry.upstream.sourceRevision);
});

/**
 * Live base-pin source: `skills-lock.json` at the merge-base of `HEAD` and `origin/main`.
 *
 * **Details**
 *
 * On a Renovate branch that is the lock before the bump, so each skill's old
 * revision is the pin the bump moved from. On `main` it is the current lock,
 * so old and new revisions coincide. A base without the lock yields no pins.
 *
 * **Example** (Inspect the layer)
 *
 * ```ts
 * import { SkillReviewBaseSourceLive } from "@beep/repo-cli/commands/Skills/SkillsReview.service"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(SkillReviewBaseSourceLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const SkillReviewBaseSourceLive = Layer.effect(
  SkillReviewBaseSource,
  Effect.gen(function* () {
    const runtime = yield* Effect.context<ChildProcessSpawner.ChildProcessSpawner | Crypto.Crypto>();
    return SkillReviewBaseSource.of({
      baseRevisions: Effect.fn("SkillReviewBaseSource.baseRevisions")(function* (repoRoot) {
        return yield* readBaseRevisions(repoRoot).pipe(Effect.provide(runtime));
      }),
    });
  })
);

/**
 * Service contract for whoever answers the queued hunks.
 *
 * **Details**
 *
 * `prepare` sees the queue and every hunk identity the session knows before
 * the walk starts, so a scripted decider can refuse an answer that names no
 * hunk or more than one. `answer` is asked once per queued hunk, in order,
 * until the queue empties, the budget runs out, or it answers `quit`.
 *
 * @see {@link SkillReviewDecider} for the injectable service built on this contract.
 * @category services
 * @since 0.0.0
 */
export interface SkillReviewDeciderShape {
  /** Answer one queued hunk. */
  readonly answer: (item: SkillReviewItem) => Effect.Effect<SkillReviewAnswer, SkillReviewRefusal | SkillsCommandError>;
  /** Check the decider's answers against the hunks the session knows. */
  readonly prepare: (
    queue: ReadonlyArray<SkillReviewItem>,
    known: HashSet.HashSet<string>
  ) => Effect.Effect<void, SkillReviewRefusal | SkillsCommandError>;
}

/**
 * Injectable answer source for a review session.
 *
 * **Example** (Skip every hunk)
 *
 * ```ts
 * import { SkillReviewSkip } from "@beep/repo-cli/commands/Skills/SkillsReview.schemas"
 * import { SkillReviewDecider } from "@beep/repo-cli/commands/Skills/SkillsReview.service"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * const skipAll = Layer.succeed(
 *   SkillReviewDecider,
 *   SkillReviewDecider.of({ prepare: () => Effect.void, answer: () => Effect.succeed(SkillReviewSkip.make({})) })
 * )
 * console.log(Layer.isLayer(skipAll)) // true
 * ```
 *
 * @see {@link skillReviewDeciderFromScript} for scripted answers and {@link makeSkillReviewDeciderPrompt} for the terminal.
 * @category services
 * @since 0.0.0
 */
export class SkillReviewDecider extends Context.Service<SkillReviewDecider, SkillReviewDeciderShape>()(
  $I`SkillReviewDecider`
) {}

const entriesFor = (script: SkillReviewScript, hunkHash: string): ReadonlyArray<SkillReviewScriptEntry> =>
  A.filter(script, (entry) => Str.startsWith(entry.hunk)(hunkHash));

const ghostKey = (skill: string, hunkHash: string): string => `${skill}\u0000${hunkHash}`;

/**
 * Removes from the queue the items a ghost replay already recorded.
 *
 * **Details**
 *
 * A hunk hash carries no skill name, so items are matched on skill and hunk
 * together: the same hunk queued for two skills stays queued for the skill
 * the ghosts did not cover.
 *
 * **Example** (Dequeue ghosted items)
 *
 * ```ts
 * import { dequeueGhosted } from "@beep/repo-cli/commands/Skills/SkillsReview.service"
 *
 * console.log(dequeueGhosted([], []).length) // 0
 * ```
 *
 * @internal
 * @param queue - Items waiting for a decision.
 * @param ghosts - Ledger rows the ghost replay recorded.
 * @returns The items still waiting for a reviewer.
 * @category utilities
 * @since 0.0.0
 */
export const dequeueGhosted: {
  (
    ghosts: ReadonlyArray<SkillHunkLedgerRow>
  ): (queue: ReadonlyArray<SkillReviewItem>) => ReadonlyArray<SkillReviewItem>;
  (queue: ReadonlyArray<SkillReviewItem>, ghosts: ReadonlyArray<SkillHunkLedgerRow>): ReadonlyArray<SkillReviewItem>;
} = dual(2, (queue: ReadonlyArray<SkillReviewItem>, ghosts: ReadonlyArray<SkillHunkLedgerRow>) => {
  const ghosted = HashSet.fromIterable(A.map(ghosts, (row) => ghostKey(row.skill, row.hunkHash)));
  return A.filter(queue, (item) => !HashSet.has(ghosted, ghostKey(item.skill, item.hunkHash)));
});

const requireOneHunk = (entry: SkillReviewScriptEntry, known: HashSet.HashSet<string>) => {
  const matches = A.filter(A.fromIterable(known), Str.startsWith(entry.hunk));
  return Match.value(A.length(matches)).pipe(
    Match.when(0, () =>
      Effect.fail(
        SkillReviewRefusal.make({
          reason: "unknown-hunk",
          message: `The scripted answer for ${entry.hunk} names no hunk of the reviewed skills.`,
        })
      )
    ),
    Match.when(1, () => Effect.succeed(A.getUnsafe(matches, 0))),
    Match.orElse(() =>
      Effect.fail(
        SkillReviewRefusal.make({
          reason: "ambiguous-hunk",
          message: `The scripted answer for ${entry.hunk} matches ${A.length(matches)} hunks; use a longer prefix.`,
        })
      )
    )
  );
};

/**
 * Builds a decider that answers from a scripted file of a reviewer's decisions.
 *
 * **Details**
 *
 * Each entry names a hunk by its identity or a unique prefix of at least 12
 * hex characters. `prepare` refuses an entry that names no hunk of the
 * reviewed skills (`unknown-hunk`) or several (`ambiguous-hunk`), and refuses
 * two entries for one hunk. A queued hunk the script does not name is
 * skipped, so it stays queued. An entry for a hunk the ledger already settled
 * is accepted and unused, which keeps a re-run of the same script a no-op.
 *
 * **Example** (Answer one hunk)
 *
 * ```ts
 * import { SkillReviewScriptEntry } from "@beep/repo-cli/commands/Skills/SkillsReview.schemas"
 * import { skillReviewDeciderFromScript } from "@beep/repo-cli/commands/Skills/SkillsReview.service"
 * import * as O from "effect/Option"
 *
 * const decider = skillReviewDeciderFromScript([
 *   SkillReviewScriptEntry.make({ hunk: "0123456789ab", decision: "keep", label: O.some("policy") }),
 * ])
 * console.log(typeof decider.answer) // "function"
 * ```
 *
 * @param script - The reviewer's answers.
 * @returns A decider shape for {@link SkillReviewDecider}.
 * @category constructors
 * @since 0.0.0
 */
export const skillReviewDeciderFromScript = (script: SkillReviewScript): SkillReviewDeciderShape =>
  SkillReviewDecider.of({
    prepare: Effect.fn("SkillReviewDeciderScript.prepare")(function* (_queue, known) {
      const named = yield* Effect.forEach(script, (entry) => requireOneHunk(entry, known));
      // Two entries that resolve to the same hunk are refused up front, before anything is recorded.
      const repeated = A.filter(
        A.dedupe(named),
        (hunk) => A.length(A.filter(named, (other) => Str.Equivalence(other, hunk))) > 1
      );
      if (A.isReadonlyArrayNonEmpty(repeated)) {
        return yield* SkillReviewRefusal.make({
          reason: "ambiguous-hunk",
          message: `More than one scripted answer names hunk ${Str.slice(0, 12)(A.headNonEmpty(repeated))}.`,
        });
      }
    }),
    answer: Effect.fn("SkillReviewDeciderScript.answer")(function* (item) {
      const entries = entriesFor(script, item.hunkHash);
      return yield* Match.value(A.length(entries)).pipe(
        Match.when(0, () => Effect.succeed<SkillReviewAnswer>(SkillReviewSkip.make({}))),
        Match.when(1, () =>
          Effect.succeed<SkillReviewAnswer>(
            SkillReviewDecide.make({ decision: A.getUnsafe(entries, 0).decision, label: A.getUnsafe(entries, 0).label })
          )
        ),
        Match.orElse(() =>
          Effect.fail(
            SkillReviewRefusal.make({
              reason: "ambiguous-hunk",
              message: `${A.length(entries)} scripted answers name hunk ${Str.slice(0, 12)(item.hunkHash)}.`,
            })
          )
        )
      );
    }),
  });

type Choice = { readonly title: string; readonly value: SkillReviewAnswer; readonly description?: string };

const decide = (decision: SkillReviewDecide["decision"], label: O.Option<SkillPatchLabel>) =>
  SkillReviewDecide.make({ decision, label });

const classificationChoices: ReadonlyArray<Choice> = [
  { title: "keep as policy", value: decide("keep", O.some("policy")) },
  { title: "keep as repo-adaptation", value: decide("keep", O.some("repo-adaptation")) },
  { title: "keep as temporary-drift", value: decide("keep", O.some("temporary-drift")) },
  { title: "drop (upstream covers it)", value: decide("drop", O.none()) },
];

const conflictChoices = (item: SkillReviewItem): ReadonlyArray<Choice> => [
  { title: "rebase onto the new pin", value: decide("rebase", O.none()) },
  { title: "keep (intent stays; re-cut later)", value: decide("keep", O.none()) },
  { title: "drop (upstream covers it)", value: decide("drop", O.none()) },
  {
    title: "promote-candidate (graduate to a guide)",
    value: decide("promote-candidate", O.none()),
    ...(item.twoStrike ? { description: "Two strikes: this hunk conflicted at an earlier pin too (B4)." } : {}),
  },
];

const sessionChoices: ReadonlyArray<Choice> = [
  { title: "skip (leave queued)", value: SkillReviewSkip.make({}) },
  { title: "quit (checkpoint and stop)", value: SkillReviewQuit.make({}) },
];

const itemHeader = (item: SkillReviewItem): string =>
  A.join(
    [
      "",
      `${item.skill} — ${item.kind}${item.twoStrike ? " (two strikes: promote-candidate suggested)" : ""}`,
      `${item.patch} ${item.file} hunk ${item.hunk === 0 ? "section" : item.hunk} — ${item.status}, labelled ${item.currentLabel}, ${Str.slice(0, 12)(item.hunkHash)}`,
      ...(Str.isEmpty(item.detail) ? A.empty<string>() : [item.detail]),
      "",
      item.text,
      "",
    ],
    "\n"
  );

/**
 * Builds the terminal decider: it prints each queued hunk and asks for a decision.
 *
 * **Details**
 *
 * A classification item offers keep under each label or drop; a conflict
 * item offers rebase, keep, drop, or promote-candidate. Every item also
 * offers skip and quit, and an interrupted prompt (Ctrl-C) quits, so the
 * decisions already recorded stay in the ledger.
 *
 * **Example** (Inspect the constructor)
 *
 * ```ts
 * import { makeSkillReviewDeciderPrompt } from "@beep/repo-cli/commands/Skills/SkillsReview.service"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(makeSkillReviewDeciderPrompt)) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeSkillReviewDeciderPrompt = Effect.gen(function* () {
  const runtime = yield* Effect.context<Terminal.Terminal | FileSystem.FileSystem | Path.Path>();
  return SkillReviewDecider.of({
    prepare: Effect.fn("SkillReviewDeciderPrompt.prepare")(function* (queue) {
      yield* Console.log(`skills review: ${A.length(queue)} hunk(s) queued.`);
    }),
    answer: Effect.fn("SkillReviewDeciderPrompt.answer")(function* (item) {
      yield* Console.log(itemHeader(item));
      const choices = A.appendAll(
        item.kind === "classification" ? classificationChoices : conflictChoices(item),
        sessionChoices
      );
      return yield* Prompt.run(Prompt.Select({ message: "Decision", choices })).pipe(
        Effect.catchTag("QuitError", () => Effect.succeed<SkillReviewAnswer>(SkillReviewQuit.make({}))),
        Effect.provide(runtime)
      );
    }),
  });
}).pipe(Effect.withSpan("SkillReviewDeciderPrompt.make"));

// ---------------------------------------------------------------------------
// Building the queue.
// ---------------------------------------------------------------------------

type ReviewedSkill = {
  readonly report: SkillReplayReport;
  readonly oldRevision: SkillGitRevision;
  readonly items: ReadonlyArray<SkillReviewItem>;
};

const hunkTextsOf = Effect.fn("SkillsReview.hunkTextsOf")(function* (
  repoRoot: string,
  skill: string,
  entry: VendoredSkillLockEntry
) {
  const series = yield* readVerifiedPatchSeries(repoRoot, skill, entry);
  const listed = yield* Effect.forEach(
    series,
    Effect.fnUntraced(function* (patch) {
      return yield* listSkillPatchHunks(patch.path, yield* decodePatchText(skill, patch));
    })
  );
  return A.flatten(listed);
});

const textFor = (hunks: ReadonlyArray<SkillPatchHunk>, row: SkillHunkReport): string =>
  O.match(
    A.findFirst(hunks, (hunk) => Str.Equivalence(hunk.hunkHash, row.hunkHash)),
    { onNone: () => row.detail, onSome: (hunk) => hunk.text }
  );

const labelOf = (entry: VendoredSkillLockEntry, patch: string): SkillPatchLabel =>
  O.match(
    A.findFirst(entry.patches.series, (candidate) => Str.Equivalence(candidate.path, patch)),
    { onNone: (): SkillPatchLabel => "temporary-drift", onSome: (candidate) => candidate.label }
  );

// A hunk is settled when its key carries a decision (conflict) or it was ever classified.
const isSettled = (ledger: ReadonlyArray<SkillHunkLedgerRow>, key: HunkLedgerKey, applied: boolean): boolean =>
  applied ? O.isSome(latestClassification(ledger, key)) : O.isSome(decisionAtKey(ledger, key));

type ItemContext = {
  readonly ledger: ReadonlyArray<SkillHunkLedgerRow>;
  readonly report: SkillReplayReport;
  readonly entry: VendoredSkillLockEntry;
  readonly oldRevision: SkillGitRevision;
  readonly hunks: ReadonlyArray<SkillPatchHunk>;
};

const itemOf =
  (context: ItemContext) =>
  (row: SkillHunkReport): O.Option<SkillReviewItem> => {
    const { ledger, report } = context;
    const key: HunkLedgerKey = {
      skill: report.skill,
      oldRevision: context.oldRevision,
      newRevision: report.sourceRevision,
      patchSetHash: report.patchSetHash,
      hunkHash: row.hunkHash,
    };
    const applied = row.status === "applied";
    if (isSettled(ledger, key, applied)) {
      return O.none();
    }
    const twoStrike = !applied && isSecondStrike(ledger, key);
    return O.some(
      SkillReviewItem.make({
        ...key,
        kind: applied ? "classification" : "conflict",
        patch: row.patch,
        file: row.file,
        hunk: row.hunk,
        status: row.status,
        detail: row.detail,
        currentLabel: labelOf(context.entry, row.patch),
        twoStrike,
        ghost: applied || twoStrike ? O.none() : ghostCandidate(ledger, key),
        text: textFor(context.hunks, row),
      })
    );
  };

const reviewSkill = Effect.fn("SkillsReview.reviewSkill")(function* (
  repoRoot: string,
  ledger: ReadonlyArray<SkillHunkLedgerRow>,
  skills: Readonly<Record<string, VendoredSkillLockEntry>>,
  base: Readonly<Record<string, SkillGitRevision>>,
  report: SkillReplayReport
) {
  const entry = R.get(skills, report.skill);
  if (O.isNone(entry)) {
    return { report, oldRevision: report.sourceRevision, items: A.empty() } satisfies ReviewedSkill;
  }
  const oldRevision = O.getOrElse(R.get(base, report.skill), () => report.sourceRevision);
  const hunks = yield* hunkTextsOf(repoRoot, report.skill, entry.value);
  const items = A.getSomes(A.map(report.hunks, itemOf({ ledger, report, entry: entry.value, oldRevision, hunks })));
  return { report, oldRevision, items } satisfies ReviewedSkill;
});

// ---------------------------------------------------------------------------
// Walking the queue.
// ---------------------------------------------------------------------------

const ledgerRow = Effect.fn("SkillsReview.ledgerRow")(function* (
  item: SkillReviewItem,
  answer: SkillReviewDecide,
  reviewer: string,
  origin: SkillHunkLedgerRow["origin"]
) {
  return SkillHunkLedgerRow.make({
    skill: item.skill,
    oldRevision: item.oldRevision,
    newRevision: item.newRevision,
    patchSetHash: item.patchSetHash,
    hunkHash: item.hunkHash,
    patch: item.patch,
    file: item.file,
    hunk: item.hunk,
    status: item.status,
    decision: answer.decision,
    label: answer.label,
    reviewer,
    decidedAt: yield* DateTime.now,
    origin,
  });
});

// A classification keeps with a label or drops; a conflict takes any decision.
const requireFits = (item: SkillReviewItem, answer: SkillReviewDecide): Effect.Effect<void, SkillReviewRefusal> => {
  const fits =
    item.kind === "conflict" || answer.decision === "drop" || (answer.decision === "keep" && O.isSome(answer.label));
  return fits
    ? Effect.void
    : Effect.fail(
        SkillReviewRefusal.make({
          reason: "invalid-decision",
          message: `Hunk ${Str.slice(0, 12)(item.hunkHash)} of ${item.skill} needs a classification: keep with a label, or drop.`,
        })
      );
};

type Walk = {
  readonly recorded: ReadonlyArray<SkillHunkLedgerRow>;
  readonly queue: ReadonlyArray<SkillReviewItem>;
  readonly stoppedBy: SkillReviewStop;
};

const answerItem = Effect.fn("SkillsReview.answerItem")(function* (
  repoRoot: string,
  reviewer: string,
  item: SkillReviewItem,
  answer: SkillReviewAnswer
): Effect.fn.Return<
  O.Option<SkillHunkLedgerRow>,
  SkillReviewRefusal | SkillsCommandError,
  FileSystem.FileSystem | Path.Path
> {
  if (answer._tag !== "decide") {
    return O.none();
  }
  yield* requireFits(item, answer);
  const row = yield* ledgerRow(item, answer, reviewer, "review");
  yield* appendHunkLedgerRows(repoRoot, [row]);
  return O.some(row);
});

const walkQueue = Effect.fn("SkillsReview.walkQueue")(function* (
  repoRoot: string,
  reviewer: string,
  budget: Duration.Duration,
  queue: ReadonlyArray<SkillReviewItem>
): Effect.fn.Return<
  Walk,
  SkillReviewRefusal | SkillsCommandError,
  SkillReviewDecider | FileSystem.FileSystem | Path.Path
> {
  const decider = yield* SkillReviewDecider;
  const deadline = (yield* Clock.currentTimeMillis) + Duration.toMillis(budget);
  let recorded = A.empty<SkillHunkLedgerRow>();
  let remaining = A.empty<SkillReviewItem>();
  const stopAt = (index: number, stoppedBy: SkillReviewStop): Walk => ({
    recorded,
    queue: A.appendAll(remaining, A.drop(queue, index)),
    stoppedBy,
  });
  for (let index = 0; index < A.length(queue); index++) {
    const item = A.getUnsafe(queue, index);
    if ((yield* Clock.currentTimeMillis) >= deadline) {
      return stopAt(index, "budget");
    }
    const answer = yield* decider.answer(item);
    if (answer._tag === "quit") {
      return stopAt(index, "quit");
    }
    const row = yield* answerItem(repoRoot, reviewer, item, answer);
    recorded = O.match(row, { onNone: () => recorded, onSome: (value) => A.append(recorded, value) });
    remaining = O.isNone(row) ? A.append(remaining, item) : remaining;
  }
  return { recorded, queue: remaining, stoppedBy: "queue-empty" };
});

const ghostRows = Effect.fn("SkillsReview.ghostRows")(function* (queue: ReadonlyArray<SkillReviewItem>) {
  return yield* Effect.forEach(
    A.filter(queue, (item) => O.isSome(item.ghost)),
    (item) =>
      O.match(item.ghost, {
        onNone: () => Effect.die("unreachable: filtered on Some"),
        onSome: (prior) =>
          ledgerRow(
            item,
            SkillReviewDecide.make({ decision: prior.decision, label: prior.label }),
            prior.reviewer,
            "ghost"
          ),
      })
  );
});

const skillStates = (
  reviewed: ReadonlyArray<ReviewedSkill>,
  queue: ReadonlyArray<SkillReviewItem>
): ReadonlyArray<SkillReviewSkill> =>
  A.map(reviewed, ({ report, oldRevision, items }) => {
    const unresolved = A.length(A.filter(queue, (item) => Str.Equivalence(item.skill, report.skill)));
    return SkillReviewSkill.make({
      skill: report.skill,
      oldRevision,
      newRevision: report.sourceRevision,
      state: A.isReadonlyArrayEmpty(items) ? "clear" : unresolved === 0 ? "decided" : "queued",
      unresolved,
    });
  });

type ReviewRequirements = SkillUpdateTrain | SkillReviewBaseSource | FileSystem.FileSystem | Path.Path | Crypto.Crypto;

const runReview = Effect.fn("SkillsReview.runReview")(function* (
  repoRoot: string,
  options: SkillReviewOptions
): Effect.fn.Return<SkillReviewSession, SkillReviewFailure, ReviewRequirements | SkillReviewDecider> {
  const train = yield* SkillUpdateTrain;
  const baseSource = yield* SkillReviewBaseSource;
  const lock = yield* readSkillsLockDocument(repoRoot);
  const base = yield* baseSource.baseRevisions(repoRoot);
  const ledger = yield* readHunkLedger(repoRoot);
  const batch = yield* train.replay(repoRoot, options.skill);
  const skills = vendoredEntries(lock.document.skills);
  const reviewed = yield* Effect.forEach(batch.reports, (report) =>
    reviewSkill(repoRoot, ledger, skills, base, report)
  );
  const queue = A.flatMap(reviewed, ({ items }) => items);
  const session = (walk: Walk) =>
    SkillReviewSession.make({
      stoppedBy: walk.stoppedBy,
      budgetMinutes: Num.round(Duration.toMinutes(options.budget), 0),
      recorded: walk.recorded,
      queue: walk.queue,
      skills: skillStates(reviewed, walk.queue),
    });
  if (!options.decide) {
    return session({ recorded: A.empty(), queue, stoppedBy: "listed" });
  }
  const ghosts = options.ghost ? yield* ghostRows(queue) : A.empty<SkillHunkLedgerRow>();
  yield* appendHunkLedgerRows(repoRoot, ghosts);
  const toWalk = dequeueGhosted(queue, ghosts);
  const decider = yield* SkillReviewDecider;
  yield* decider.prepare(
    toWalk,
    HashSet.fromIterable(A.flatMap(batch.reports, (report) => A.map(report.hunks, (row) => row.hunkHash)))
  );
  const walk = yield* walkQueue(repoRoot, options.reviewer, options.budget, toWalk);
  return session({ ...walk, recorded: A.appendAll(ghosts, walk.recorded) });
});

/**
 * Service contract for the review ritual.
 *
 * @see {@link SkillHunkReview} for the injectable service built on this contract.
 * @category services
 * @since 0.0.0
 */
export interface SkillHunkReviewShape {
  /** Prepare, or with `decide`, walk one bounded review session answered by the provided decider. */
  readonly review: (
    repoRoot: string,
    options: SkillReviewOptions
  ) => Effect.Effect<SkillReviewSession, SkillReviewFailure, SkillReviewDecider>;
}

/**
 * Injectable review-ritual service.
 *
 * **Example** (Run against a substituted reviewer)
 *
 * ```ts
 * import { SkillReviewOptions, SkillReviewSession } from "@beep/repo-cli/commands/Skills/SkillsReview.schemas"
 * import {
 *   SkillHunkReview,
 *   SkillReviewDecider,
 *   skillReviewDeciderFromScript,
 * } from "@beep/repo-cli/commands/Skills/SkillsReview.service"
 * import * as Duration from "effect/Duration"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as O from "effect/Option"
 *
 * const empty = Layer.succeed(
 *   SkillHunkReview,
 *   SkillHunkReview.of({
 *     review: () =>
 *       Effect.succeed(SkillReviewSession.make({ stoppedBy: "listed", budgetMinutes: 20, recorded: [], queue: [], skills: [] })),
 *   })
 * )
 *
 * const program = Effect.gen(function* () {
 *   const review = yield* SkillHunkReview
 *   return yield* review.review("/workspace/beep-effect", SkillReviewOptions.make({
 *     skill: O.none(),
 *     decide: false,
 *     ghost: false,
 *     reviewer: "@kriegcloud",
 *     budget: Duration.minutes(20),
 *   })).pipe(Effect.provideService(SkillReviewDecider, skillReviewDeciderFromScript([])))
 * })
 *
 * console.log(Effect.runSync(Effect.provide(program, empty)).stoppedBy) // "listed"
 * ```
 *
 * @see {@link SkillHunkReviewLayer} for the layer that leaves its collaborators open.
 * @category services
 * @since 0.0.0
 */
export class SkillHunkReview extends Context.Service<SkillHunkReview, SkillHunkReviewShape>()($I`SkillHunkReview`) {}

/**
 * Review layer that leaves the update train and the base pins open.
 *
 * **Example** (Inspect the layer)
 *
 * ```ts
 * import { SkillHunkReviewLayer } from "@beep/repo-cli/commands/Skills/SkillsReview.service"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(SkillHunkReviewLayer)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const SkillHunkReviewLayer = Layer.effect(
  SkillHunkReview,
  Effect.gen(function* () {
    const runtime = yield* Effect.context<ReviewRequirements>();
    return SkillHunkReview.of({
      review: Effect.fn("SkillHunkReview.review")(function* (repoRoot, options) {
        return yield* runReview(repoRoot, options).pipe(Effect.provide(runtime));
      }),
    });
  })
);

/**
 * Live review layer: GitHub-backed replay and the merge-base lock.
 *
 * **Example** (Supply the HTTP client the live replay needs)
 *
 * ```ts
 * import { SkillHunkReviewLive } from "@beep/repo-cli/commands/Skills/SkillsReview.service"
 * import * as Layer from "effect/Layer"
 * import * as FetchHttpClient from "effect/http/FetchHttpClient";
 * console.log(Layer.isLayer(SkillHunkReviewLive.pipe(Layer.provide(FetchHttpClient.layer)))) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const SkillHunkReviewLive = SkillHunkReviewLayer.pipe(
  Layer.provide(Layer.mergeAll(SkillUpdateTrainLive, SkillReviewBaseSourceLive))
);
