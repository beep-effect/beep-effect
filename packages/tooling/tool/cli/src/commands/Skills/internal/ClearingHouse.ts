/**
 * The clearing-house writer: one verified skill tree, published to every install target.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Ref from "effect/Ref";
import * as Str from "effect/String";
import { SkillsCommandError } from "../Skills.errors.ts";
import type { SkillUpstreamContentFile } from "../Skills.schemas.ts";

/**
 * Name of the work directory that holds stages and set-aside trees, beside each physical skills directory.
 *
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const MATERIALIZE_WORK_DIR = ".skills-materialize";

const textDecoder = new TextDecoder();

/** One physical place a skill is published, with its stage and work directory. */
type PhysicalTarget = {
  readonly absolute: string;
  readonly workDir: string;
};

/** A target whose previous tree was set aside (or that had none) before its stage was renamed in. */
type Swap = {
  readonly target: string;
  readonly previous: O.Option<string>;
};

/**
 * Resolves each install target to its physical directory and drops duplicates.
 *
 * **Details**
 *
 * The parent directory is resolved through `realPath`, so a target reached
 * through a symbolic link (this repository links `.agents/skills` onto
 * `.claude/skills`) collapses onto the directory it names. Two logical
 * targets then publish one physical tree, and the equivalence check still
 * reads both logical paths afterwards.
 *
 * @internal
 * @category queries
 * @since 0.0.0
 */
export const physicalTargets = Effect.fn("ClearingHouse.physicalTargets")(function* (
  repoRoot: string,
  skill: string,
  targets: ReadonlyArray<string>
): Effect.fn.Return<ReadonlyArray<PhysicalTarget>, SkillsCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const resolved = yield* Effect.forEach(
    targets,
    Effect.fnUntraced(function* (target) {
      const absolute = path.join(repoRoot, target);
      const parent = path.dirname(absolute);
      yield* fs
        .makeDirectory(parent, { recursive: true })
        .pipe(SkillsCommandError.mapError(`Failed to create ${parent}.`, parent, skill));
      const realParent = yield* fs
        .realPath(parent)
        .pipe(SkillsCommandError.mapError(`Failed to resolve ${parent}.`, parent, skill));
      return {
        absolute: path.join(realParent, path.basename(absolute)),
        workDir: path.join(path.dirname(realParent), MATERIALIZE_WORK_DIR),
      } satisfies PhysicalTarget;
    })
  );
  return A.dedupeWith(resolved, (left, right) => Str.Equivalence(left.absolute, right.absolute));
});

const writeStagedFile = Effect.fn("ClearingHouse.writeStagedFile")(function* (
  stage: string,
  skill: string,
  file: SkillUpstreamContentFile
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolute = path.join(stage, file.path);
  const inside = path.relative(stage, absolute);
  if (Str.isEmpty(inside) || Str.startsWith("..")(inside) || path.isAbsolute(inside)) {
    return yield* SkillsCommandError.make({
      message: `Refusing to stage ${file.path}: it resolves outside the ${skill} stage.`,
      file: file.path,
      skill,
    });
  }
  yield* fs
    .makeDirectory(path.dirname(absolute), { recursive: true })
    .pipe(SkillsCommandError.mapError(`Failed to create the parent of ${absolute}.`, absolute, skill));
  if (file.mode === "120000") {
    return yield* fs
      .symlink(textDecoder.decode(file.bytes), absolute)
      .pipe(SkillsCommandError.mapError(`Failed to stage the link ${file.path}.`, absolute, skill));
  }
  yield* fs
    .writeFile(absolute, file.bytes, { flag: "wx" })
    .pipe(SkillsCommandError.mapError(`Failed to stage ${file.path}.`, absolute, skill));
  yield* fs
    .chmod(absolute, file.mode === "100755" ? 0o755 : 0o644)
    .pipe(SkillsCommandError.mapError(`Failed to set the mode of ${file.path}.`, absolute, skill));
});

const isSetAside = Str.endsWith(".previous");

// Leftover stages of a run that died mid-publish carry nothing worth keeping: the re-run
// rebuilds from the lock (contract 2). A set-aside tree may hold the only copy of a hand edit,
// so it is never deleted here; the publish refuses until someone moves it back or removes it.
const sweepLeftovers = Effect.fn("ClearingHouse.sweepLeftovers")(function* (workDir: string, skill: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const entries = A.filter(
    yield* fs.readDirectory(workDir).pipe(Effect.orElseSucceed(A.empty<string>)),
    Str.startsWith(`${skill}.`)
  );
  const setAside = A.map(A.filter(entries, isSetAside), (entry) => path.join(workDir, entry));
  if (A.isReadonlyArrayNonEmpty(setAside)) {
    return yield* SkillsCommandError.make({
      message: `An earlier publish of ${skill} left its previous tree set aside at ${A.join(setAside, ", ")}; move it back to its target or remove it, then re-run.`,
      file: setAside[0],
      skill,
    });
  }
  yield* Effect.forEach(
    entries,
    (entry) => fs.remove(path.join(workDir, entry), { recursive: true, force: true }).pipe(Effect.ignore),
    { discard: true }
  );
});

// The work directory goes away once it is empty; another skill's leftovers keep it.
const removeIfEmpty = Effect.fn("ClearingHouse.removeIfEmpty")(function* (workDir: string) {
  const fs = yield* FileSystem.FileSystem;
  const entries = yield* fs.readDirectory(workDir).pipe(Effect.option);
  if (O.exists(entries, A.isReadonlyArrayEmpty)) {
    yield* fs.remove(workDir, { recursive: true, force: true }).pipe(Effect.ignore);
  }
});

const stageTree = Effect.fn("ClearingHouse.stageTree")(function* (
  target: PhysicalTarget,
  skill: string,
  files: ReadonlyArray<SkillUpstreamContentFile>
) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs
    .makeDirectory(target.workDir, { recursive: true })
    .pipe(SkillsCommandError.mapError(`Failed to create ${target.workDir}.`, target.workDir, skill));
  yield* sweepLeftovers(target.workDir, skill);
  const stage = yield* fs
    .makeTempDirectory({ directory: target.workDir, prefix: `${skill}.stage-` })
    .pipe(SkillsCommandError.mapError(`Failed to create a stage in ${target.workDir}.`, target.workDir, skill));
  yield* Effect.forEach(files, (file) => writeStagedFile(stage, skill, file), { discard: true });
  return stage;
});

// Returns the set-aside trees it could not move back, so the failure can name them.
const restore = Effect.fn("ClearingHouse.restore")(function* (swaps: ReadonlyArray<Swap>) {
  const fs = yield* FileSystem.FileSystem;
  const stranded: Array<string> = [];
  for (const swap of A.reverse(swaps)) {
    yield* fs.remove(swap.target, { recursive: true, force: true }).pipe(Effect.ignore);
    if (O.isSome(swap.previous)) {
      const restored = yield* fs.rename(swap.previous.value, swap.target).pipe(Effect.option);
      if (O.isNone(restored)) {
        stranded.push(swap.previous.value);
      }
    }
  }
  return stranded;
});

const restoreAfter = (swaps: Ref.Ref<Array<Swap>>, skill: string) =>
  Effect.fnUntraced(function* (error: SkillsCommandError) {
    const stranded = yield* restore(yield* Ref.get(swaps));
    return yield* A.isReadonlyArrayNonEmpty(stranded)
      ? SkillsCommandError.make({
          ...(error.cause === undefined ? {} : { cause: error.cause }),
          message: `${error.message} The previous tree could not be moved back and is kept at ${A.join(stranded, ", ")}.`,
          file: stranded[0],
          skill,
        })
      : error;
  });

/**
 * Publishes one verified tree to every install target by staged sibling and rename.
 *
 * **Details**
 *
 * Every physical target gets a fully written stage first. Then the targets
 * are swapped back to back: the previous tree is renamed aside, the stage is
 * renamed in. A failure this writer sees before every swap completes (a
 * caught failure) restores each swapped target from its set-aside tree, so no
 * target changes. A process that dies between two swaps runs no restore; the
 * targets are left skewed, the caller's equivalence check reports the skew,
 * and a plain re-run rebuilds every target from the lock. Leftover stages and
 * Leftover stages of a dead run are swept at the next publish; a set-aside
 * tree is kept and named in the error, never deleted.
 *
 * @internal
 * @category commands
 * @since 0.0.0
 */
export const publishSkillTree = Effect.fn("ClearingHouse.publishSkillTree")(function* (
  repoRoot: string,
  skill: string,
  targets: ReadonlyArray<string>,
  files: ReadonlyArray<SkillUpstreamContentFile>
): Effect.fn.Return<void, SkillsCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const physical = yield* physicalTargets(repoRoot, skill, targets);
  const stages = yield* Effect.forEach(physical, (target) =>
    Effect.map(stageTree(target, skill, files), (stage) => [target, stage] as const)
  );
  const swaps = yield* Ref.make(A.empty<Swap>());
  const swapIn = Effect.fnUntraced(function* (target: PhysicalTarget, stage: string) {
    const exists = yield* fs
      .exists(target.absolute)
      .pipe(SkillsCommandError.mapError(`Failed to inspect ${target.absolute}.`, target.absolute, skill));
    const previous = exists ? O.some(`${stage}.previous`) : O.none<string>();
    if (O.isSome(previous)) {
      yield* fs
        .rename(target.absolute, previous.value)
        .pipe(
          SkillsCommandError.mapError(`Failed to set aside the previous ${target.absolute}.`, target.absolute, skill)
        );
    }
    yield* Ref.update(swaps, A.append({ target: target.absolute, previous }));
    yield* fs
      .rename(stage, target.absolute)
      .pipe(SkillsCommandError.mapError(`Failed to publish ${target.absolute}.`, target.absolute, skill));
  });
  yield* Effect.forEach(stages, ([target, stage]) => swapIn(target, stage), { discard: true }).pipe(
    Effect.catchTag("SkillsCommandError", restoreAfter(swaps, skill)),
    Effect.onInterrupt(() => Effect.flatMap(Ref.get(swaps), restore)),
    Effect.ensuring(
      Effect.forEach(stages, ([, stage]) => fs.remove(stage, { recursive: true, force: true }).pipe(Effect.ignore), {
        discard: true,
      })
    )
  );
  yield* Effect.forEach(
    A.getSomes(A.map(yield* Ref.get(swaps), (swap) => swap.previous)),
    (previous) => fs.remove(previous, { recursive: true, force: true }).pipe(Effect.ignore),
    { discard: true }
  );
  yield* Effect.forEach(physical, (target) => removeIfEmpty(target.workDir), { discard: true });
});
