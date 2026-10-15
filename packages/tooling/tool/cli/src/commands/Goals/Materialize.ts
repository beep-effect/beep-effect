/**
 * Materialization executor: replay a reviewed `MaterializationPlan`.
 *
 * **Details**
 *
 * The writer never compiles a plan of its own. It receives a plan whose
 * `planId` the caller has already matched against the reviewed id, refuses
 * any plan with conflicts, and then:
 *
 * - **bootstrap**: stages every `create` payload in
 *   `goals/.staging-<digest>/`, validates the staged tree, claims
 *   `goals/<slug>` with a non-recursive `makeDirectory` (the no-replace
 *   guard), and renames the stage onto the empty claim. Any failure removes
 *   the stage and an empty claim, so a failed write leaves no trace. A retry
 *   after a crash first sweeps every `goals/.staging-*` (E12) and reclaims an
 *   empty slug directory (E11), so no crash point blocks the next attempt.
 * - **adopt**: asserts every `preserve` pre-image digest, then writes each
 *   `create` with exclusive-create, so a file that appeared after planning
 *   fails the write instead of being clobbered.
 *
 * Both return a `goal-materialization-receipt/v1`. The pre-image check
 * (`readPinnedFile`) and the staged single-file replacement built on it
 * (`replacePinnedFile`) are shared with `explore graduate`, whose exploration
 * manifest edit is the only other reviewed write.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { createContainedFileString } from "../../internal/cli/FsGuards.ts";
import { assertJournalFileLockOwned, withJournalFileLock } from "../../internal/repo-run/AdmissionJournal.ts";
import { removeEmptyDirectory } from "../../internal/repo-run/DirectoryHandle.ts";
import { MaterializationReceipt, MaterializedFile } from "./Bootstrap.schemas.ts";
import { GoalPlanInputError, GoalPlanOperationalError } from "./Goals.errors.ts";
import { decodeGoalManifest } from "./Goals.schemas.ts";
import { GOALS_DIR, parseGoalManifestText, readmeLifecycleToken } from "./Inventory.ts";
import { canonicalJsonTextPretty, sha256HexBytes } from "./PacketCore/PacketDigest.ts";
import type { MaterializationPlan, PlanEntry, ValidationRequirement } from "./Bootstrap.schemas.ts";

const GOAL_MD_MAX_CHARS = 4000;

const textEncoder = new TextEncoder();

const writtenCreates = (plan: MaterializationPlan): ReadonlyArray<PlanEntry & { readonly payload: string }> =>
  A.filter(
    plan.entries,
    (entry): entry is PlanEntry & { readonly payload: string } =>
      entry.action === "create" && entry.payload !== undefined
  );

const refuseConflicted = (plan: MaterializationPlan) =>
  A.isReadonlyArrayNonEmpty(plan.conflicts)
    ? Effect.fail(
        GoalPlanInputError.new(
          `Plan ${plan.planId} has ${A.length(plan.conflicts)} conflict(s); a conflicted plan never writes.`
        )
      )
    : Effect.void;

const fileErrorFor = (message: string) => GoalPlanOperationalError.new(message);

const writeExclusive = (root: string, absolutePath: string, payload: string) =>
  createContainedFileString(root, absolutePath, payload).pipe(
    Effect.mapError(
      fileErrorFor(`Refusing to write ${absolutePath}: it exists, escapes the packet, or cannot be created.`)
    )
  );

const receiptFile = Effect.fn("Goals.receiptFile")(function* (entry: PlanEntry & { readonly payload: string }) {
  const digest = yield* sha256HexBytes(textEncoder.encode(entry.payload));
  return MaterializedFile.make({ path: entry.path, digest });
});

// Checks the staged packet against the plan's validations the stage can prove
// on its own; doctor and index requirements run after publish.
const validateStage = Effect.fn("Goals.validateStage")(function* (stagePath: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const read = (relative: string) =>
    fs
      .readFileString(path.join(stagePath, relative))
      .pipe(Effect.mapError(fileErrorFor(`Staged packet is missing ${relative}.`)));
  const manifestText = yield* read("ops/manifest.json");
  const parsed = parseGoalManifestText(manifestText);
  if (O.isNone(parsed)) {
    return yield* GoalPlanOperationalError.new("Staged ops/manifest.json is not valid JSON.")(undefined);
  }
  yield* decodeGoalManifest(parsed.value).pipe(
    Effect.mapError((issue) =>
      GoalPlanOperationalError.new(`Staged ops/manifest.json does not decode: ${issue.message}`)(issue)
    )
  );
  const goalMd = yield* read("GOAL.md");
  if (Str.length(goalMd) > GOAL_MD_MAX_CHARS) {
    return yield* GoalPlanOperationalError.new(`Staged GOAL.md exceeds ${GOAL_MD_MAX_CHARS} characters.`)(undefined);
  }
  const readme = yield* read("README.md");
  if (O.isNone(readmeLifecycleToken(readme))) {
    return yield* GoalPlanOperationalError.new("Staged README.md has no lifecycle status line.")(undefined);
  }
  const checked: ReadonlyArray<ValidationRequirement> = [
    "manifest-decodes",
    "goal-md-within-budget",
    "readme-lifecycle-line",
  ];
  return checked;
});

const removeQuietly = Effect.fn("Goals.removeQuietly")(function* (absolutePath: string) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.remove(absolutePath, { recursive: true, force: true }).pipe(Effect.ignore);
});

// An empty-only, atomic removal: a claim that a concurrent creator has started
// filling is never deleted (no check-then-remove gap).
const removeIfEmpty = (absolutePath: string) => Effect.asVoid(removeEmptyDirectory(absolutePath));

// E12: a staging directory is never published content, so every leftover
// `goals/.staging-*` (a foreign digest, or this plan's own from a crashed attempt)
// is removed before staging.
const sweepStaleStages = Effect.fn("Goals.sweepStaleStages")(function* (goalsDir: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const goalsLink = yield* fs.readLink(goalsDir).pipe(
    Effect.as(true),
    Effect.orElseSucceed(() => false)
  );
  if (goalsLink) {
    return yield* GoalPlanOperationalError.new("Refusing to sweep staging entries through a symlinked goals root.")(
      undefined
    );
  }
  const entries = yield* fs.readDirectory(goalsDir).pipe(Effect.orElseSucceed(A.empty<string>));
  // Every removal is attempted; the failures are reported together by path.
  const outcomes = yield* Effect.forEach(A.filter(entries, Str.startsWith(".staging-")), (entry) => {
    const stage = path.join(goalsDir, entry);
    return fs.remove(stage, { recursive: true, force: true }).pipe(
      Effect.as(O.none<string>()),
      Effect.orElseSucceed(() => O.some(stage))
    );
  });
  const failed = A.getSomes(outcomes);
  if (A.isReadonlyArrayNonEmpty(failed)) {
    return yield* GoalPlanOperationalError.new(
      `Refusing to stage: could not remove stale staging director${A.length(failed) === 1 ? "y" : "ies"} ${A.join(failed, ", ")}.`
    )(undefined);
  }
});

/**
 * Publishes a reviewed bootstrap plan as a new goal packet, atomically.
 *
 * **Details**
 *
 * Stages every `create` payload under `goals/.staging-<digest>/`, validates
 * the stage (manifest decodes, `GOAL.md` budget, README lifecycle line),
 * claims `goals/<slug>` with a non-recursive `makeDirectory`, and renames the
 * stage onto the empty claim. If any step fails, the stage and an empty
 * claim are removed. A conflicted plan or a non-bootstrap plan is refused
 * before any write.
 *
 * **Gotchas**
 *
 * The caller must already have matched `plan.planId` against the reviewed id
 * (`--expect`); this function trusts the plan it receives.
 *
 * **Example** (Build the write effect)
 *
 * ```ts
 * import { publishBootstrapPlan } from "@beep/repo-cli/commands/Goals/Materialize"
 *
 * console.log(typeof publishBootstrapPlan) // "function"
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const publishBootstrapPlan = Effect.fn("Goals.publishBootstrapPlan")(function* (
  plan: MaterializationPlan,
  repoRoot = "."
) {
  if (plan.mode !== "bootstrap") {
    return yield* GoalPlanInputError.new(`Plan ${plan.planId} is an ${plan.mode} plan, not a bootstrap plan.`);
  }
  yield* refuseConflicted(plan);
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const target = path.join(repoRoot, plan.packetPath);
  const stage = path.join(repoRoot, GOALS_DIR, `.staging-${Str.slice(-16)(plan.planId)}`);
  const creates = writtenCreates(plan);

  const run = Effect.gen(function* () {
    yield* sweepStaleStages(path.join(repoRoot, GOALS_DIR));
    yield* fs
      .makeDirectory(stage)
      .pipe(Effect.mapError(fileErrorFor(`Refusing to stage: ${stage} already exists or cannot be created.`)));
    yield* Effect.forEach(
      creates,
      (entry) =>
        writeExclusive(
          path.resolve(stage),
          path.resolve(stage, path.relative(plan.packetPath, entry.path)),
          entry.payload
        ),
      { discard: true }
    );
    const validations = yield* validateStage(stage);
    // E11: an empty slug directory is an abandoned claim from a crashed attempt.
    yield* removeIfEmpty(target);
    yield* fs
      .makeDirectory(target)
      .pipe(Effect.mapError(fileErrorFor(`Refusing to publish: ${plan.packetPath} already exists.`)));
    yield* fs
      .rename(stage, target)
      .pipe(Effect.mapError(fileErrorFor(`Failed to publish the staged packet onto ${plan.packetPath}.`)));
    return validations;
  });

  const validations = yield* run.pipe(
    Effect.onError(() => Effect.andThen(removeQuietly(stage), removeIfEmpty(target)))
  );
  const written = yield* Effect.forEach(creates, receiptFile);
  return MaterializationReceipt.make({
    planId: plan.planId,
    mode: plan.mode,
    slug: plan.slug,
    written,
    validations,
  });
});

/**
 * Reads a file whose bytes a reviewed plan pinned, refusing when they moved.
 *
 * **Details**
 *
 * The shared pre-image check: adoption's `preserve` rows and the graduation
 * manifest edit both call it, so "the file still matches the reviewed
 * digest" has one definition. The digest is SHA-256 over the raw bytes.
 *
 * **Example** (Build the pinned read)
 *
 * ```ts
 * import { readPinnedFile } from "@beep/repo-cli/commands/Goals/Materialize"
 * import * as Effect from "effect/Effect"
 *
 * const read = readPinnedFile("goals/demo/README.md", "0".repeat(64))
 * console.log(Effect.isEffect(read)) // true
 * ```
 *
 * @param relativePath - Repository-relative path of the pinned file.
 * @param preImageDigest - SHA-256 hex digest the reviewed plan recorded for the file.
 * @param repoRoot - Repository root the path resolves against.
 * @returns The file's current bytes, or an operational error when it is unreadable or changed.
 * @category commands
 * @since 0.0.0
 */
export const readPinnedFile = Effect.fn("Goals.readPinnedFile")(function* (
  relativePath: string,
  preImageDigest: string,
  repoRoot = "."
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const bytes = yield* fs
    .readFile(path.join(repoRoot, relativePath))
    .pipe(Effect.mapError(fileErrorFor(`Failed to read preserved ${relativePath}.`)));
  const digest = yield* sha256HexBytes(bytes);
  if (digest !== preImageDigest) {
    return yield* GoalPlanOperationalError.new(
      `${relativePath} changed since the plan was reviewed; re-plan before writing.`
    )(undefined);
  }
  return bytes;
});

/**
 * Writes a file through a staged sibling and an atomic rename.
 *
 * **Details**
 *
 * Writes `text` exclusively to `<file>.staging-<content digest prefix>`, runs
 * `beforeRename` (a last guard such as a pre-image re-check), and renames the
 * stage over the file. A leftover stage from a crashed attempt is removed
 * first, and any failure removes the stage, so readers see either the old
 * file or the complete new one, never a partial write. Returns the SHA-256
 * digest of the written text.
 *
 * **Example** (Build the atomic write)
 *
 * ```ts
 * import { writeFileAtomically } from "@beep/repo-cli/commands/Goals/Materialize"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(writeFileAtomically("goals/demo/ops/trace.json", "{}\n"))) // true
 * ```
 *
 * @param target - Path of the file to write.
 * @param text - The complete new content.
 * @param beforeRename - Guard run after staging and before the rename; its failure aborts the write.
 * @returns The SHA-256 hex digest of `text` once the rename lands.
 * @category commands
 * @since 0.0.0
 */
export const writeFileAtomically = Effect.fn("Goals.writeFileAtomically")(function* <E = never, R = never>(
  target: string,
  text: string,
  beforeRename: Effect.Effect<void, E, R> = Effect.void
) {
  const fs = yield* FileSystem.FileSystem;
  const digest = yield* sha256HexBytes(textEncoder.encode(text));
  const stage = `${target}.staging-${Str.slice(0, 16)(digest)}`;
  yield* removeQuietly(stage);
  yield* Effect.gen(function* () {
    yield* fs
      .writeFileString(stage, text, { flag: "wx" })
      .pipe(Effect.mapError(fileErrorFor(`Refusing to stage ${target}: ${stage} exists or cannot be created.`)));
    yield* beforeRename;
    yield* fs.rename(stage, target).pipe(Effect.mapError(fileErrorFor(`Failed to publish the staged ${target}.`)));
  }).pipe(Effect.onError(() => removeQuietly(stage)));
  return digest;
});

/**
 * Replaces a pinned file through a staged sibling and an atomic rename.
 *
 * **Details**
 *
 * The whole check-render-rename runs under the owned-generation file lock
 * `<file>.lock` (the lock the packet event store uses), so concurrent writers
 * of the same file serialize. Inside the lock it checks the pre-image with
 * {@link readPinnedFile}, renders the replacement from the current text, and
 * publishes it with {@link writeFileAtomically}, re-checking lock ownership
 * and the pre-image between staging and the rename. A writer that waited for
 * the lock then finds the pre-image moved and refuses, so two writers of one
 * reviewed pre-image yield one replacement and one refusal. The file is
 * either the pre-image or the full replacement. Returns the before and after
 * digests; a lock that stays busy or is lost refuses with
 * `GoalPlanOperationalError`.
 *
 * **Example** (Build the pinned replacement)
 *
 * ```ts
 * import { replacePinnedFile } from "@beep/repo-cli/commands/Goals/Materialize"
 * import * as Effect from "effect/Effect"
 *
 * const write = replacePinnedFile("goals/demo/README.md", "0".repeat(64), (text) => Effect.succeed(`${text}\n`))
 * console.log(Effect.isEffect(write)) // true
 * ```
 *
 * @param relativePath - Repository-relative path of the pinned file.
 * @param preImageDigest - SHA-256 hex digest the reviewed plan recorded for the file.
 * @param render - Builds the replacement text from the current (pinned) text.
 * @param repoRoot - Repository root the path resolves against.
 * @returns The pre-image and replacement digests once the rename lands.
 * @category commands
 * @since 0.0.0
 */
export const replacePinnedFile = Effect.fn("Goals.replacePinnedFile")(function* (
  relativePath: string,
  preImageDigest: string,
  render: (text: string) => Effect.Effect<string, GoalPlanOperationalError>,
  repoRoot = "."
) {
  const path = yield* Path.Path;
  const target = path.join(repoRoot, relativePath);
  const lockPath = `${target}.lock`;
  return yield* withJournalFileLock(
    lockPath,
    Effect.fnUntraced(function* (lockToken: string) {
      const bytes = yield* readPinnedFile(relativePath, preImageDigest, repoRoot);
      const next = yield* render(new TextDecoder().decode(bytes));
      const afterDigest = yield* writeFileAtomically(
        target,
        next,
        assertJournalFileLockOwned(lockPath, lockToken).pipe(
          Effect.andThen(readPinnedFile(relativePath, preImageDigest, repoRoot)),
          Effect.asVoid
        )
      );
      return { beforeDigest: preImageDigest, afterDigest };
    }),
    undefined,
    `Refusing to replace ${relativePath}: another writer holds ${lockPath}.`
  ).pipe(
    Effect.catchTag(
      "QualitySchedulerError",
      Effect.fnUntraced(function* (error) {
        return yield* GoalPlanOperationalError.new(`Refusing to replace ${relativePath}: ${error.message}`)(error);
      })
    )
  );
});

/**
 * Applies a reviewed adoption plan to an existing packet without overwriting anything.
 *
 * **Details**
 *
 * Every `preserve` row's file must still match its `preImageDigest`; then each
 * `create` row is written with exclusive-create. `retain` and `report` rows do
 * no I/O. A conflicted or non-adopt plan is refused before any write.
 *
 * **Example** (Build the write effect)
 *
 * ```ts
 * import { applyAdoptionPlan } from "@beep/repo-cli/commands/Goals/Materialize"
 *
 * console.log(typeof applyAdoptionPlan) // "function"
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const applyAdoptionPlan = Effect.fn("Goals.applyAdoptionPlan")(function* (
  plan: MaterializationPlan,
  repoRoot = "."
) {
  if (plan.mode !== "adopt") {
    return yield* GoalPlanInputError.new(`Plan ${plan.planId} is a ${plan.mode} plan, not an adoption plan.`);
  }
  yield* refuseConflicted(plan);
  const path = yield* Path.Path;
  yield* Effect.forEach(
    plan.preservations,
    (preservation) => readPinnedFile(preservation.path, preservation.preImageDigest, repoRoot),
    { discard: true }
  );
  const creates = writtenCreates(plan);
  yield* Effect.forEach(
    creates,
    (entry) => writeExclusive(path.resolve(repoRoot), path.resolve(repoRoot, entry.path), entry.payload),
    {
      discard: true,
    }
  );
  const written = yield* Effect.forEach(creates, receiptFile);
  return MaterializationReceipt.make({
    planId: plan.planId,
    mode: plan.mode,
    slug: plan.slug,
    written,
    validations: [],
  });
});

/**
 * Refuses unless `--expect` names exactly the recompiled plan id.
 *
 * **Details**
 *
 * Shared by every `--write` replay (bootstrap, adopt, explore graduate). A
 * missing `--expect` or one that differs from the recompiled id refuses with a
 * typed input error: the tree or the inputs moved since review.
 *
 * **Example** (Build the guard for a matching id)
 *
 * ```ts
 * import { requireExpectedPlanId } from "@beep/repo-cli/commands/Goals/Materialize"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * console.log(Effect.isEffect(requireExpectedPlanId("goal-plan/v1:abc", O.some("goal-plan/v1:abc")))) // true
 * ```
 *
 * @param planId - The id of the plan just recompiled from the live tree.
 * @param expect - The reviewed id passed with `--expect`, if any.
 * @returns Succeeds when the ids match; otherwise a plan input error.
 * @category commands
 * @since 0.0.0
 */
export const requireExpectedPlanId: {
  (planId: string, expect: O.Option<string>): Effect.Effect<void, GoalPlanInputError>;
  (expect: O.Option<string>): (planId: string) => Effect.Effect<void, GoalPlanInputError>;
} = dual(
  2,
  (planId: string, expect: O.Option<string>): Effect.Effect<void, GoalPlanInputError> =>
    O.match(expect, {
      onNone: () =>
        Effect.fail(
          GoalPlanInputError.new(
            `--write requires --expect <planId>; review the plan with --plan --json first (this plan is ${planId}).`
          )
        ),
      onSome: (expected) =>
        expected === planId
          ? Effect.void
          : Effect.fail(
              GoalPlanInputError.new(
                `Plan moved since review: expected ${expected}, recompiled ${planId}. Re-plan and review again.`
              )
            ),
    })
);

/**
 * Replays a reviewed plan when `--expect` names its exact `planId`, then prints the receipt.
 *
 * **Details**
 *
 * Shared by `goals bootstrap --write` and `goals adopt --write`. A missing
 * `--expect` or one that differs from the recompiled plan's id refuses with
 * a typed input error and writes nothing: the tree or the inputs moved since
 * review, so the reviewed plan is no longer the plan being written.
 *
 * **Example** (Build the write effect)
 *
 * ```ts
 * import { writeReviewedPlan } from "@beep/repo-cli/commands/Goals/Materialize"
 *
 * console.log(typeof writeReviewedPlan) // "function"
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const writeReviewedPlan = Effect.fn("Goals.writeReviewedPlan")(function* (
  plan: MaterializationPlan,
  expect: O.Option<string>
) {
  yield* requireExpectedPlanId(plan.planId, expect);
  const receipt = yield* plan.mode === "bootstrap" ? publishBootstrapPlan(plan) : applyAdoptionPlan(plan);
  // The receipt was just constructed from its own schema, so encoding cannot fail.
  const encoded = yield* S.encodeEffect(MaterializationReceipt)(receipt).pipe(Effect.orDie);
  yield* Console.log(Str.trimEnd(canonicalJsonTextPretty(encoded)));
  return receipt;
});

/**
 * `--write`: replay a reviewed plan. Shared by `goals bootstrap` and `goals adopt`.
 *
 * **Example** (Read the flag)
 *
 * ```ts
 * import { materializeWriteFlag } from "@beep/repo-cli/commands/Goals/Materialize"
 *
 * console.log(typeof materializeWriteFlag) // "object"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const materializeWriteFlag = Flag.Boolean("write").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Replay the reviewed plan named by --expect; never writes a plan you have not reviewed")
);

/**
 * `--expect <planId>`: the reviewed plan id a `--write` must match.
 *
 * **Example** (Read the flag)
 *
 * ```ts
 * import { materializeExpectFlag } from "@beep/repo-cli/commands/Goals/Materialize"
 *
 * console.log(typeof materializeExpectFlag) // "object"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const materializeExpectFlag = Flag.String("expect").pipe(
  Flag.optional,
  Flag.withDescription("The reviewed planId (goal-plan/v1:...) that --write must match")
);

/**
 * Refuses unless exactly one of `--plan` or `--write` was passed.
 *
 * **Example** (Build the guard effect)
 *
 * ```ts
 * import { requireOneMode } from "@beep/repo-cli/commands/Goals/Materialize"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(requireOneMode({ plan: true, write: false }))) // true
 * ```
 *
 * @param options - The parsed `--plan` and `--write` flags.
 * @returns Succeeds when exactly one mode is selected.
 * @category commands
 * @since 0.0.0
 */
export const requireOneMode = (options: { readonly plan: boolean; readonly write: boolean }) =>
  options.plan === options.write
    ? Effect.fail(
        GoalPlanInputError.new(
          "Pass exactly one of --plan (review the plan) or --write --expect <planId> (replay a reviewed plan)."
        )
      )
    : Effect.void;
