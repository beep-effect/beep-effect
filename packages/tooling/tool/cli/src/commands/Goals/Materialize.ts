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
 *   the stage and an empty claim, so a failed write leaves no trace.
 * - **adopt**: asserts every `preserve` pre-image digest, then writes each
 *   `create` with exclusive-create, so a file that appeared after planning
 *   fails the write instead of being clobbered.
 *
 * Both return a `goal-materialization-receipt/v1`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as Console from "effect/Console";
import { Flag } from "effect/cli";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
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

const writeExclusive = Effect.fn("Goals.writeExclusive")(function* (absolutePath: string, payload: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs
    .makeDirectory(path.dirname(absolutePath), { recursive: true })
    .pipe(Effect.mapError(fileErrorFor(`Failed to create the parent of ${absolutePath}.`)));
  yield* fs
    .writeFileString(absolutePath, payload, { flag: "wx" })
    .pipe(Effect.mapError(fileErrorFor(`Refusing to write ${absolutePath}: it exists or cannot be created.`)));
});

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

const removeIfEmpty = Effect.fn("Goals.removeIfEmpty")(function* (absolutePath: string) {
  const fs = yield* FileSystem.FileSystem;
  const entries = yield* fs.readDirectory(absolutePath).pipe(Effect.option);
  if (O.exists(entries, A.isReadonlyArrayEmpty)) {
    yield* fs.remove(absolutePath).pipe(Effect.ignore);
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
    yield* fs
      .makeDirectory(stage)
      .pipe(Effect.mapError(fileErrorFor(`Refusing to stage: ${stage} already exists or cannot be created.`)));
    yield* Effect.forEach(
      creates,
      (entry) => writeExclusive(path.join(stage, path.relative(plan.packetPath, entry.path)), entry.payload),
      { discard: true }
    );
    const validations = yield* validateStage(stage);
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
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* Effect.forEach(
    plan.preservations,
    Effect.fnUntraced(function* (preservation) {
      const bytes = yield* fs
        .readFile(path.join(repoRoot, preservation.path))
        .pipe(Effect.mapError(fileErrorFor(`Failed to read preserved ${preservation.path}.`)));
      const digest = yield* sha256HexBytes(bytes);
      if (digest !== preservation.preImageDigest) {
        return yield* GoalPlanOperationalError.new(
          `${preservation.path} changed since the plan was reviewed; re-plan before writing.`
        )(undefined);
      }
    }),
    { discard: true }
  );
  const creates = writtenCreates(plan);
  yield* Effect.forEach(creates, (entry) => writeExclusive(path.join(repoRoot, entry.path), entry.payload), {
    discard: true,
  });
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
  if (O.isNone(expect)) {
    return yield* GoalPlanInputError.new(
      `--write requires --expect <planId>; review the plan with --plan --json first (this plan is ${plan.planId}).`
    );
  }
  if (expect.value !== plan.planId) {
    return yield* GoalPlanInputError.new(
      `Plan moved since review: expected ${expect.value}, recompiled ${plan.planId}. Re-plan and review again.`
    );
  }
  const receipt = yield* plan.mode === "bootstrap" ? publishBootstrapPlan(plan) : applyAdoptionPlan(plan);
  const encoded = yield* S.encodeUnknownEffect(MaterializationReceipt)(receipt).pipe(
    Effect.mapError((issue) => GoalPlanOperationalError.new("Failed to encode the materialization receipt.")(issue))
  );
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
