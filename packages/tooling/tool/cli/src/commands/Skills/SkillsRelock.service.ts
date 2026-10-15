/**
 * The skills update train: `beep skills replay` and `beep skills relock`.
 *
 * **Details**
 *
 * A Renovate pin bump (B18) changes only `upstream.sourceRevision`, so the
 * lock's snapshot and effective hashes still describe the old pin. The train
 * moves in two deliberate steps (B22):
 *
 * 1. **Replay** loads the pristine tree at the lock's pin through
 *    {@link SkillUpstreamContentSource}, checks every patch file against its
 *    recorded digest, replays the series with the strict applier, and
 *    classifies every hunk (`applied`, `fuzz-applied`, `conflicted`) by its
 *    position-free identity. It writes nothing and never compares against the
 *    recorded snapshot hashes, which are stale by design after a bump.
 * 2. **Relock** runs the same replay, refuses unless it is clean and the
 *    license digest still matches, and seals the new `snapshot` and
 *    `effective` blocks into a plan digest. With `--expect <planDigest>` it
 *    rewrites `skills-lock.json` through a staged rename that re-checks the
 *    lock bytes first. Any refusal leaves the lock untouched, which is what
 *    holds a conflicted bump for the review ritual (B19).
 *
 * `materialize` then rebuilds the installed trees from the newly recorded
 * hashes, and `materialize --check` proves them.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { canonicalJsonText } from "../Goals/PacketCore/PacketDigest.ts";
import { isSecondStrike, readHunkLedger } from "./internal/HunkLedger.ts";
import { readSkillsLockDocument, requireVendoredEntry, SKILLS_LOCK_PATH } from "./internal/LockFile.ts";
import { decodePatchText, readVerifiedPatchSeries } from "./internal/PatchSeries.ts";
import { computeSkillTree, hashBytes, installedTargetsHash } from "./internal/SkillTree.ts";
import { applySkillPatch, classifySkillPatchHunks } from "./SkillPatches.apply.ts";
import { SkillRelockRefusal, SkillsCommandError, SkillsLockWriteRefusal } from "./Skills.errors.ts";
import { SkillEffective, SkillSnapshot } from "./Skills.schemas.ts";
import {
  renderSkillTreeDiff,
  SkillUpstreamContentSource,
  SkillUpstreamContentSourceLive,
  skillResolutionOfEntry,
} from "./Skills.service.ts";
import { VendoredSkillLockEntry } from "./SkillsLock.schemas.ts";
import { publishSkillsLockEntry } from "./SkillsLock.write.ts";
import { SkillHunkReport, SkillRelockReceipt, SkillReplayBatch, SkillReplayReport } from "./SkillsRelock.schemas.ts";
import type * as Crypto from "effect/Crypto";
import type * as FileSystem from "effect/FileSystem";
import type * as Path from "effect/Path";
import type { ComputedSkillTree } from "./internal/SkillTree.ts";
import type { SkillMaterializeRefusal, SkillUpstreamContentError } from "./Skills.errors.ts";
import type { SkillUpstreamContentFile } from "./Skills.schemas.ts";
import type { SkillsLockEntry, SkillsLockWrittenFile } from "./SkillsLock.schemas.ts";
import type { SkillReplayStatus } from "./SkillsRelock.schemas.ts";
import type { SkillHunkLedgerRow } from "./SkillsReview.schemas.ts";

const $I = $RepoCliId.create("commands/Skills/SkillsRelock.service");

const RELOCK_PLAN_SCHEMA_VERSION = "skills-relock-plan/v1";

type TrainRequirements = SkillUpstreamContentSource | FileSystem.FileSystem | Path.Path | Crypto.Crypto;

/**
 * Every failure `skills replay` and `skills relock` can raise.
 *
 * @category type-level
 * @since 0.0.0
 */
export type SkillUpdateTrainFailure =
  | SkillsCommandError
  | SkillRelockRefusal
  | SkillsLockWriteRefusal
  | SkillMaterializeRefusal
  | SkillUpstreamContentError;

/** A replay plus the trees relock needs to record it. */
type Replayed = {
  readonly report: SkillReplayReport;
  readonly pristine: ComputedSkillTree;
  readonly effective: O.Option<ComputedSkillTree>;
};

const encodeSnapshot = S.encodeEffect(SkillSnapshot);
const encodeEffective = S.encodeEffect(SkillEffective);
const snapshotEquivalence = S.toEquivalence(SkillSnapshot);
const effectiveEquivalence = S.toEquivalence(SkillEffective);

const refuse = (skill: string, reason: SkillRelockRefusal["reason"], message: string) =>
  Effect.fail(SkillRelockRefusal.make({ skill, reason, message }));

const requireVendored = (
  skills: Readonly<Record<string, SkillsLockEntry>>,
  skill: string
): Effect.Effect<VendoredSkillLockEntry, SkillRelockRefusal> =>
  requireVendoredEntry(skills, skill, "only vendored entries carry a pin to relock.", (reason, message) =>
    refuse(skill, reason, message)
  );

const strictReplay =
  (patches: ReadonlyArray<{ readonly path: string; readonly text: string }>) =>
  (files: ReadonlyArray<SkillUpstreamContentFile>) =>
    Effect.reduce(
      patches,
      () => files,
      (tree, patch) => applySkillPatch(patch.path, patch.text, tree)
    );

const classifySeries = Effect.fn("SkillsRelock.classifySeries")(function* (
  patches: ReadonlyArray<{ readonly path: string; readonly text: string }>,
  files: ReadonlyArray<SkillUpstreamContentFile>
): Effect.fn.Return<
  { readonly rows: ReadonlyArray<SkillHunkReport>; readonly tree: ReadonlyArray<SkillUpstreamContentFile> },
  SkillsCommandError,
  Crypto.Crypto
> {
  let tree = files;
  let rows = A.empty<SkillHunkReport>();
  for (const patch of patches) {
    const classified = yield* classifySkillPatchHunks(patch.path, patch.text, tree);
    tree = classified.tree;
    rows = A.appendAll(rows, classified.rows);
  }
  return { rows, tree };
});

const statusOf = (strictClean: boolean, rows: ReadonlyArray<SkillHunkReport>): SkillReplayStatus => {
  if (strictClean) {
    return "clean";
  }
  return A.some(rows, (row) => row.status === "fuzz-applied") && !A.some(rows, (row) => row.status === "conflicted")
    ? "fuzz-only"
    : "conflicted";
};

// The strict applier can refuse where every hunk classified as applied (a new-side header
// that does not land where it says); that refusal becomes its own conflicted row so the
// report never calls a replay clean that the strict applier rejected.
const withStrictRefusal = Effect.fn("SkillsRelock.withStrictRefusal")(function* (
  rows: ReadonlyArray<SkillHunkReport>,
  refusal: O.Option<{ readonly patch: string; readonly file: string; readonly message: string }>
): Effect.fn.Return<ReadonlyArray<SkillHunkReport>, SkillsCommandError, Crypto.Crypto> {
  if (O.isNone(refusal) || A.some(rows, (row) => row.status !== "applied")) {
    return rows;
  }
  const { patch, file, message } = refusal.value;
  return A.append(
    rows,
    SkillHunkReport.make({
      patch,
      file,
      hunk: 0,
      hunkHash: yield* hashBytes(new TextEncoder().encode(`${patch}\0${file}\0${message}`), `${patch}:strict`),
      oldStart: 0,
      status: "conflicted",
      shift: 0,
      detail: message,
    })
  );
});

const replayEntry = Effect.fn("SkillsRelock.replayEntry")(function* (
  repoRoot: string,
  skill: string,
  entry: VendoredSkillLockEntry
): Effect.fn.Return<
  Replayed,
  Exclude<SkillUpdateTrainFailure, SkillRelockRefusal | SkillsLockWriteRefusal>,
  TrainRequirements
> {
  const source = yield* SkillUpstreamContentSource;
  const content = yield* source.load(skillResolutionOfEntry(skill, entry));
  const pristine = yield* computeSkillTree(content.files, `${skill}:pristine`);
  const licenseSha = yield* hashBytes(content.licenseBytes, `${skill}:license`);
  const series = yield* readVerifiedPatchSeries(repoRoot, skill, entry);
  const patches = yield* Effect.forEach(
    series,
    Effect.fnUntraced(function* (patch) {
      return { path: patch.path, text: yield* decodePatchText(skill, patch) };
    })
  );
  const strict = yield* Effect.result(strictReplay(patches)(content.files));
  const classified = yield* classifySeries(patches, content.files);
  const rows = yield* withStrictRefusal(classified.rows, Result.isFailure(strict) ? O.some(strict.failure) : O.none());
  const status = statusOf(Result.isSuccess(strict), rows);
  const replayedFiles = Result.isSuccess(strict) ? strict.success : classified.tree;
  const effective = Result.isSuccess(strict)
    ? O.some(yield* computeSkillTree(strict.success, `${skill}:effective`))
    : O.none<ComputedSkillTree>();
  const licenseMatches = Str.Equivalence(licenseSha, entry.license.sha256);
  // A relicense at an unchanged tree is still unrecorded: the lock's license digest is stale (B30).
  const recorded =
    licenseMatches &&
    Str.Equivalence(pristine.treeHash, entry.snapshot.treeHash) &&
    Str.Equivalence(pristine.manifestHash, entry.snapshot.manifestHash) &&
    O.exists(effective, (tree) => Str.Equivalence(tree.treeHash, entry.effective.treeHash));
  const report = SkillReplayReport.make({
    skill,
    repository: entry.upstream.repository,
    sourceRevision: entry.upstream.sourceRevision,
    pristineTreeHash: pristine.treeHash,
    patchSetHash: entry.patches.patchSetHash,
    status,
    recorded,
    licenseMatches,
    effectiveTreeHash: O.map(effective, (tree) => tree.treeHash),
    hunks: rows,
    diff: yield* renderSkillTreeDiff(skill, content.files, replayedFiles),
  });
  return { report, pristine, effective };
});

/**
 * Reports whether a replay leaves nothing for a person to review.
 *
 * **Details**
 *
 * A replay is clean only when every hunk applies exactly and the license bytes
 * at the pin match the lock. A changed license fails closed even when the skill
 * tree is unchanged, because a relicense needs a reviewed lock-plan (B30).
 *
 * **Example** (Check a replay report)
 *
 * ```ts
 * import { isSkillReplayClean, SkillGitRevision, SkillReplayReport } from "@beep/repo-cli/commands/Skills"
 * import { Sha256Hex } from "@beep/schema/Sha256"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const digest = Sha256Hex.make("0".repeat(64))
 * const check = Effect.gen(function* () {
 *   const sourceRevision = yield* S.decodeEffect(SkillGitRevision)("d6e773a562dc85c2a81b7c571f40ca2d81896679")
 *   const report = SkillReplayReport.make({
 *     skill: "oracle", repository: "steipete/oracle", sourceRevision,
 *     pristineTreeHash: digest, patchSetHash: digest, status: "clean",
 *     recorded: true, licenseMatches: true, effectiveTreeHash: O.some(digest),
 *     hunks: [], diff: "",
 *   })
 *   return isSkillReplayClean(report)
 * })
 * Effect.runPromise(check).then(console.log) // true
 * ```
 *
 * @param report - One skill's replay outcome.
 * @returns `true` when the hunks apply exactly and the license digest still matches.
 * @category predicates
 * @since 0.0.0
 */
export const isSkillReplayClean = (report: SkillReplayReport): boolean =>
  report.status === "clean" && report.licenseMatches;

const describeUnresolved = (report: SkillReplayReport): string =>
  A.join(
    A.map(
      A.filter(report.hunks, (row) => row.status !== "applied"),
      (row) => `${row.patch} ${row.file} hunk ${row.hunk} (${row.status}, ${Str.slice(0, 12)(row.hunkHash)})`
    ),
    "; "
  );

const requireRelockable = (replayed: Replayed): Effect.Effect<ComputedSkillTree, SkillRelockRefusal> => {
  const report = replayed.report;
  if (report.status === "conflicted") {
    return refuse(
      report.skill,
      "replay-conflicted",
      `${report.skill} at ${report.sourceRevision} does not replay: ${describeUnresolved(report)}. The lock is untouched; the bump waits for the review ritual.`
    );
  }
  if (report.status === "fuzz-only") {
    return refuse(
      report.skill,
      "replay-fuzz-only",
      `${report.skill} at ${report.sourceRevision} replays only at shifted positions: ${describeUnresolved(report)}. Regenerate the patch at the new pin; strict apply never fuzzes (B27).`
    );
  }
  if (!report.licenseMatches) {
    return refuse(
      report.skill,
      "license-changed",
      `${report.skill} at ${report.sourceRevision} carries license bytes that no longer match the recorded digest; review the relicense before relocking.`
    );
  }
  return O.match(replayed.effective, {
    onNone: () =>
      refuse(report.skill, "replay-conflicted", `${report.skill} produced no effective tree; the lock is untouched.`),
    onSome: Effect.succeed,
  });
};

const planDigestOf = Effect.fn("SkillsRelock.planDigestOf")(function* (
  lockSha256: string,
  skill: string,
  entry: VendoredSkillLockEntry,
  snapshot: SkillSnapshot,
  effective: SkillEffective
): Effect.fn.Return<SkillRelockReceipt["planDigest"], SkillsCommandError, Crypto.Crypto> {
  const encoded = yield* Effect.all({
    snapshot: encodeSnapshot(snapshot),
    effective: encodeEffective(effective),
  }).pipe(SkillsCommandError.mapError(`Failed to encode the ${skill} relock plan.`, SKILLS_LOCK_PATH, skill));
  const preimage = canonicalJsonText({
    schemaVersion: RELOCK_PLAN_SCHEMA_VERSION,
    lockSha256,
    skill,
    sourceRevision: entry.upstream.sourceRevision,
    ...encoded,
  });
  return yield* hashBytes(new TextEncoder().encode(preimage), "skills-relock-plan");
});

const relockSkill = Effect.fn("SkillsRelock.relockSkill")(function* (
  repoRoot: string,
  skill: string,
  expect: O.Option<string>
): Effect.fn.Return<SkillRelockReceipt, SkillUpdateTrainFailure, TrainRequirements> {
  const lock = yield* readSkillsLockDocument(repoRoot);
  const entry = yield* requireVendored(lock.document.skills, skill);
  const replayed = yield* replayEntry(repoRoot, skill, entry);
  const effectiveTree = yield* requireRelockable(replayed);
  const snapshot = SkillSnapshot.make({
    algorithm: "sha256",
    treeHash: replayed.pristine.treeHash,
    fileCount: A.length(replayed.pristine.manifest),
    manifestHash: replayed.pristine.manifestHash,
    manifest: replayed.pristine.manifest,
  });
  const effective = SkillEffective.make({
    treeHash: effectiveTree.treeHash,
    installedTargets: entry.effective.installedTargets,
    installedTreeHash: yield* installedTargetsHash(
      A.map(entry.effective.installedTargets, (target) => [target, effectiveTree.treeHash] as const),
      skill
    ),
  });
  const planDigest = yield* planDigestOf(lock.sha256, skill, entry, snapshot, effective);
  const receipt = (outcome: SkillRelockReceipt["outcome"], written: O.Option<SkillsLockWrittenFile>) =>
    SkillRelockReceipt.make({
      planDigest,
      lockSha256: lock.sha256,
      skill,
      sourceRevision: entry.upstream.sourceRevision,
      snapshot,
      effective,
      outcome,
      lock: written,
    });
  if (O.isNone(expect)) {
    return receipt("planned", O.none());
  }
  if (!Str.Equivalence(expect.value, planDigest)) {
    return yield* SkillsLockWriteRefusal.make({
      reason: "digest-mismatch",
      message: `Relock plan moved since review: expected ${expect.value}, recomputed ${planDigest}. Re-run skills relock --skill ${skill} --json and review again.`,
    });
  }
  if (snapshotEquivalence(snapshot, entry.snapshot) && effectiveEquivalence(effective, entry.effective)) {
    return receipt("already-current", O.none());
  }
  return receipt(
    "written",
    O.some(
      yield* publishSkillsLockEntry(
        repoRoot,
        lock,
        skill,
        VendoredSkillLockEntry.make({ ...entry, snapshot, effective }),
        planDigest
      )
    )
  );
});

// B4: an unresolved hunk the ledger already records as unresolved at another pin is a
// second strike, reported as a promotion candidate; graduation stays a human decision.
const withPromoteCandidates = (
  report: SkillReplayReport,
  ledger: ReadonlyArray<SkillHunkLedgerRow>
): SkillReplayReport =>
  SkillReplayReport.make({
    ...report,
    promoteCandidates: A.dedupe(
      A.map(
        A.filter(
          report.hunks,
          (row) =>
            row.status !== "applied" &&
            isSecondStrike(ledger, { skill: report.skill, hunkHash: row.hunkHash, newRevision: report.sourceRevision })
        ),
        (row) => row.hunkHash
      )
    ),
  });

const replaySkills = Effect.fn("SkillsRelock.replaySkills")(function* (
  repoRoot: string,
  skill: O.Option<string>
): Effect.fn.Return<SkillReplayBatch, SkillUpdateTrainFailure, TrainRequirements> {
  const lock = yield* readSkillsLockDocument(repoRoot);
  const selected = yield* O.match(skill, {
    onNone: () =>
      Effect.succeed(
        A.filter(
          A.sortWith(R.toEntries(lock.document.skills), ([name]) => name, Str.Order),
          (pair): pair is [string, VendoredSkillLockEntry] => pair[1]._tag === "vendored"
        )
      ),
    onSome: (name) => Effect.map(requireVendored(lock.document.skills, name), (entry) => A.of([name, entry] as const)),
  });
  const ledger = yield* readHunkLedger(repoRoot);
  const reports = yield* Effect.forEach(selected, ([name, entry]) =>
    Effect.map(replayEntry(repoRoot, name, entry), (replayed) => withPromoteCandidates(replayed.report, ledger))
  );
  return SkillReplayBatch.make({ reports });
});

/**
 * Service contract for the skills update train.
 *
 * **Details**
 *
 * `replay` reports every selected vendored skill (all of them when `skill` is
 * `None`) at its lock pin without writing anything. `relock` records one
 * skill's new hashes: without `expect` it only returns the sealed plan
 * (`planned`); with the plan's digest it writes the lock, or reports
 * `already-current` when the lock already holds those hashes.
 *
 * @see {@link SkillUpdateTrain} for the injectable service built on this contract.
 * @category services
 * @since 0.0.0
 */
export interface SkillUpdateTrainShape {
  /** Plan, or with the reviewed digest write, one vendored skill's new snapshot and effective hashes. */
  readonly relock: (
    repoRoot: string,
    skill: string,
    expect: O.Option<string>
  ) => Effect.Effect<SkillRelockReceipt, SkillUpdateTrainFailure>;
  /** Replay the selected vendored skills at their lock pins and classify every hunk. */
  readonly replay: (
    repoRoot: string,
    skill: O.Option<string>
  ) => Effect.Effect<SkillReplayBatch, SkillUpdateTrainFailure>;
}

/**
 * Injectable update-train service: replay and relock.
 *
 * **Example** (Run against a substituted train)
 *
 * ```ts
 * import { SkillUpdateTrain } from "@beep/repo-cli/commands/Skills/SkillsRelock.service"
 * import { SkillReplayBatch } from "@beep/repo-cli/commands/Skills/SkillsRelock.schemas"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as O from "effect/Option"
 *
 * const quiet = Layer.succeed(
 *   SkillUpdateTrain,
 *   SkillUpdateTrain.of({
 *     replay: () => Effect.succeed(SkillReplayBatch.make({ reports: [] })),
 *     relock: () => Effect.die("not used"),
 *   })
 * )
 *
 * const program = Effect.gen(function* () {
 *   const train = yield* SkillUpdateTrain
 *   return yield* train.replay("/workspace/beep-effect", O.none())
 * })
 *
 * console.log(Effect.runSync(Effect.provide(program, quiet)).reports.length) // 0
 * ```
 *
 * @see {@link SkillUpdateTrainLive} for the layer backed by pinned GitHub content.
 * @category services
 * @since 0.0.0
 */
export class SkillUpdateTrain extends Context.Service<SkillUpdateTrain, SkillUpdateTrainShape>()(
  $I`SkillUpdateTrain`
) {}

const makeSkillUpdateTrain = Effect.gen(function* () {
  const runtimeContext = yield* Effect.context<TrainRequirements>();
  return SkillUpdateTrain.of({
    replay: Effect.fn("SkillUpdateTrain.replay")(function* (repoRoot, skill) {
      return yield* replaySkills(repoRoot, skill).pipe(Effect.provide(runtimeContext));
    }),
    relock: Effect.fn("SkillUpdateTrain.relock")(function* (repoRoot, skill, expect) {
      return yield* relockSkill(repoRoot, skill, expect).pipe(Effect.provide(runtimeContext));
    }),
  });
}).pipe(Effect.withSpan("SkillUpdateTrain.make"));

/**
 * Update-train layer that leaves the upstream-content source open.
 *
 * **When to use**
 *
 * Use when the pristine trees should come from somewhere other than GitHub,
 * such as a fixture source standing in for a bumped pin in a test.
 *
 * **Example** (Close the layer over an offline source)
 *
 * ```ts
 * import { SkillPathHistory, SkillUpstreamContent } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import { SkillUpstreamContentSource } from "@beep/repo-cli/commands/Skills/Skills.service"
 * import { SkillUpdateTrainLayer } from "@beep/repo-cli/commands/Skills/SkillsRelock.service"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as S from "effect/Schema"
 *
 * const offline = Layer.succeed(
 *   SkillUpstreamContentSource,
 *   SkillUpstreamContentSource.of({
 *     load: () => Effect.succeed(SkillUpstreamContent.make({ files: [], licenseBytes: new Uint8Array() })),
 *     listPathHistory: () =>
 *       Effect.orDie(
 *         S.decodeEffect(SkillPathHistory)({
 *           revisions: ["0123456789abcdef0123456789abcdef01234567"],
 *           truncated: false,
 *         })
 *       ),
 *   })
 * )
 *
 * console.log(Layer.isLayer(SkillUpdateTrainLayer.pipe(Layer.provide(offline)))) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const SkillUpdateTrainLayer = Layer.effect(SkillUpdateTrain, makeSkillUpdateTrain);

/**
 * Live update train backed by pinned GitHub content.
 *
 * **Details**
 *
 * The remaining requirements are an HTTP client and the platform filesystem,
 * path, and crypto services. A non-empty `GITHUB_TOKEN` raises the GitHub
 * REST budget from 60 requests an hour.
 *
 * **Example** (Supply the HTTP client the live source needs)
 *
 * ```ts
 * import { SkillUpdateTrainLive } from "@beep/repo-cli/commands/Skills/SkillsRelock.service"
 * import * as Layer from "effect/Layer"
 * import * as FetchHttpClient from "effect/http/FetchHttpClient";
 * console.log(Layer.isLayer(SkillUpdateTrainLive.pipe(Layer.provide(FetchHttpClient.layer)))) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const SkillUpdateTrainLive = SkillUpdateTrainLayer.pipe(Layer.provide(SkillUpstreamContentSourceLive));
