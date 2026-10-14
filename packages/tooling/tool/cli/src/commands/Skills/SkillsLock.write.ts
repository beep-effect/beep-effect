/**
 * Reviewed `skills-lock/v2` write: replay a sealed migration plan atomically.
 *
 * **Details**
 *
 * The writer never trusts a plan it did not just compute. It recomputes the
 * migration plan, refuses unless `--expect` names that plan's exact digest and
 * no row carries a conflict a write cannot settle, and then publishes two
 * things together:
 *
 * - the canonical `skills-lock.json` (`version: 2`), staged beside the lock and
 *   renamed over it as the commit point;
 * - the generated patch tree `.agents/skill-patches/<skill>/NNNN-<slug>.patch`,
 *   staged as a sibling directory and swapped in before the lock rename.
 *
 * Right before the swap the lock bytes are re-read and compared with the digest
 * the plan read, so a lock edited after planning refuses instead of being
 * overwritten. Any failure removes the stages and restores the previous patch
 * tree, so a failed write leaves no partial file. A plan whose lock text and
 * patch tree are already in place writes nothing and reports `already-applied`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Sha256HexFromBytes } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { formatJsonValue } from "../../internal/cli/Json.ts";
import { PATCH_ROOT, stagedPatchPath } from "./internal/PatchStaging.ts";
import { SkillsCommandError, SkillsLockWriteRefusal } from "./Skills.errors.ts";
import { compileSkillsLockMigration } from "./Skills.service.ts";
import { SkillsLockDocument, SkillsLockWriteReceipt, SkillsLockWrittenFile } from "./SkillsLock.schemas.ts";
import type { Sha256Hex } from "@beep/schema";
import type * as Crypto from "effect/Crypto";
import type { SkillPatchOwnerSource } from "./Skills.patches.ts";
import type { SkillUpstreamContentSource } from "./Skills.service.ts";
import type {
  SkillPatchFile,
  SkillsLockMigrationPlan,
  SkillsLockWriteOutcome,
  UnresolvedMigrationRow,
} from "./SkillsLock.schemas.ts";

const SKILLS_LOCK_PATH = "skills-lock.json";

const textEncoder = new TextEncoder();
const decodeSha256HexFromBytes = S.decodeUnknownEffect(Sha256HexFromBytes);
const encodeSkillsLockDocument = S.encodeEffect(SkillsLockDocument);

const sha256Of = (bytes: Uint8Array, label: string) =>
  decodeSha256HexFromBytes(bytes).pipe(SkillsCommandError.mapError(`Failed to compute SHA-256 for ${label}.`, label));

/**
 * The rows that block a lock write.
 *
 * **Details**
 *
 * Every `unresolved` row except `no-ratified-seed` (contract 8 writes those as
 * `local`): a missing or divergent install has no entry to write, and a seeded
 * skill whose provenance or upstream cannot be read must not be silently
 * demoted to `local`.
 *
 * **Example** (Check an empty plan)
 *
 * ```ts
 * import { SkillsLockMigrationPlan } from "@beep/repo-cli/commands/Skills/SkillsLock.schemas"
 * import { skillsLockWriteConflicts } from "@beep/repo-cli/commands/Skills/SkillsLock.write"
 * import { Sha256Hex } from "@beep/schema"
 *
 * const digest = Sha256Hex.make("0".repeat(64))
 * const plan = SkillsLockMigrationPlan.make({ planDigest: digest, lockSha256: digest, rows: [] })
 * console.log(skillsLockWriteConflicts(plan).length) // 0
 * ```
 *
 * @param plan - A sealed migration plan.
 * @returns The conflicted rows, in plan order.
 * @category queries
 * @since 0.0.0
 */
export const skillsLockWriteConflicts = (plan: SkillsLockMigrationPlan): ReadonlyArray<UnresolvedMigrationRow> =>
  A.filter(
    plan.rows,
    (row): row is UnresolvedMigrationRow => row.disposition === "unresolved" && row.cause !== "no-ratified-seed"
  );

/**
 * The `skills-lock/v2` document a plan writes.
 *
 * **Details**
 *
 * Each row contributes its entry under its skill name, in plan (name) order:
 * a vendored row its entry at the proposed pin, a local row its installed-tree
 * entry, and an unresolved `no-ratified-seed` row its local entry. A row with
 * no entry contributes nothing; a write refuses such a plan before reaching
 * this point.
 *
 * **Example** (Build the document of an empty plan)
 *
 * ```ts
 * import { SkillsLockMigrationPlan } from "@beep/repo-cli/commands/Skills/SkillsLock.schemas"
 * import { skillsLockDocumentOf } from "@beep/repo-cli/commands/Skills/SkillsLock.write"
 * import { Sha256Hex } from "@beep/schema"
 *
 * const digest = Sha256Hex.make("0".repeat(64))
 * const plan = SkillsLockMigrationPlan.make({ planDigest: digest, lockSha256: digest, rows: [] })
 * console.log(skillsLockDocumentOf(plan).version) // 2
 * ```
 *
 * @param plan - A sealed migration plan.
 * @returns The canonical lock document.
 * @category constructors
 * @since 0.0.0
 */
export const skillsLockDocumentOf = (plan: SkillsLockMigrationPlan): SkillsLockDocument =>
  SkillsLockDocument.make({
    version: 2,
    skills: R.fromEntries(
      A.flatMap(plan.rows, (row) =>
        O.toArray(O.map(O.fromUndefinedOr(row.entry), (entry) => [row.skill, entry] as const))
      )
    ),
  });

/**
 * Renders a `skills-lock/v2` document as the exact `skills-lock.json` text.
 *
 * **Details**
 *
 * Two-space formatted JSON with a trailing newline, the same formatting the
 * v1 lock used. Both the reviewed write and `skills update` over a v2 lock
 * render through this function, so the two never disagree about the bytes.
 *
 * **Example** (Render an empty v2 lock)
 *
 * ```ts
 * import { SkillsLockDocument } from "@beep/repo-cli/commands/Skills/SkillsLock.schemas"
 * import { renderSkillsLockDocumentText } from "@beep/repo-cli/commands/Skills/SkillsLock.write"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(renderSkillsLockDocumentText(SkillsLockDocument.make({ version: 2, skills: {} })))) // true
 * ```
 *
 * @param document - The lock document to render.
 * @returns The lock file text.
 * @category formatting
 * @since 0.0.0
 */
export const renderSkillsLockDocumentText = Effect.fn("SkillsLock.renderSkillsLockDocumentText")(function* (
  document: SkillsLockDocument
): Effect.fn.Return<string, SkillsCommandError> {
  const encoded = yield* encodeSkillsLockDocument(document).pipe(
    SkillsCommandError.mapError(`Failed to encode the ${SKILLS_LOCK_PATH} v2 document.`, SKILLS_LOCK_PATH)
  );
  return formatJsonValue(encoded);
});

const requireExpectedDigest = (plan: SkillsLockMigrationPlan, expect: O.Option<string>) =>
  O.match(expect, {
    onNone: () =>
      Effect.fail(
        SkillsLockWriteRefusal.make({
          reason: "missing-expect",
          message: `--write requires --expect <planDigest>; review the plan with lock-plan --json first (this plan is ${plan.planDigest}).`,
        })
      ),
    onSome: (expected) =>
      Str.Equivalence(expected, plan.planDigest)
        ? Effect.void
        : Effect.fail(
            SkillsLockWriteRefusal.make({
              reason: "digest-mismatch",
              message: `Plan moved since review: expected ${expected}, recomputed ${plan.planDigest}. Re-plan and review again.`,
            })
          ),
  });

const refuseConflicts = (plan: SkillsLockMigrationPlan) =>
  A.match(skillsLockWriteConflicts(plan), {
    onEmpty: () => Effect.void,
    onNonEmpty: (rows) =>
      Effect.fail(
        SkillsLockWriteRefusal.make({
          reason: "conflicted-plan",
          message: `Plan ${plan.planDigest} has ${A.length(rows)} conflict(s) a write cannot settle: ${A.join(
            A.map(rows, (row) => `${row.skill} (${row.note})`),
            "; "
          )}`,
        })
      ),
  });

const readPatchTreeDigests = Effect.fn("SkillsLock.readPatchTreeDigests")(function* (repoRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = path.join(repoRoot, PATCH_ROOT);
  const exists = yield* fs.exists(root).pipe(SkillsCommandError.mapError(`Failed to inspect ${PATCH_ROOT}.`, root));
  const entries = exists
    ? yield* fs
        .readDirectory(root, { recursive: true })
        .pipe(SkillsCommandError.mapError(`Failed to list ${PATCH_ROOT}.`, root))
    : A.empty<string>();
  const files = yield* Effect.forEach(
    entries,
    Effect.fnUntraced(function* (entry) {
      const absolute = path.join(root, entry);
      const stat = yield* fs.stat(absolute).pipe(SkillsCommandError.mapError(`Failed to stat ${absolute}.`, absolute));
      if (stat.type !== "File") {
        return A.empty<readonly [string, Sha256Hex]>();
      }
      const bytes = yield* fs
        .readFile(absolute)
        .pipe(SkillsCommandError.mapError(`Failed to read ${absolute}.`, absolute));
      return A.of([`${PATCH_ROOT}/${Str.replaceAll("\\", "/")(entry)}`, yield* sha256Of(bytes, absolute)] as const);
    })
  );
  return HashMap.fromIterable(A.flatten(files));
});

const isAlreadyApplied = Effect.fn("SkillsLock.isAlreadyApplied")(function* (
  repoRoot: string,
  lockText: string,
  patches: ReadonlyArray<SkillsLockWrittenFile>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const lockPath = path.join(repoRoot, SKILLS_LOCK_PATH);
  const current = yield* fs
    .readFileString(lockPath)
    .pipe(SkillsCommandError.mapError(`Failed to read ${SKILLS_LOCK_PATH}.`, lockPath));
  if (!Str.Equivalence(current, lockText)) {
    return false;
  }
  const tree = yield* readPatchTreeDigests(repoRoot);
  return (
    HashMap.size(tree) === A.length(patches) &&
    A.every(patches, (patch) => O.exists(HashMap.get(tree, patch.path), (sha) => Str.Equivalence(sha, patch.sha256)))
  );
});

const removeQuietly = Effect.fn("SkillsLock.removeQuietly")(function* (absolutePath: string) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.remove(absolutePath, { recursive: true, force: true }).pipe(Effect.ignore);
});

type PublishPaths = {
  readonly agentsDir: string;
  readonly target: string;
  readonly stage: string;
  readonly previous: string;
  readonly lockPath: string;
  readonly lockStage: string;
};

const publishPaths = Effect.fn("SkillsLock.publishPaths")(function* (repoRoot: string, planDigest: string) {
  const path = yield* Path.Path;
  const tag = Str.slice(0, 16)(planDigest);
  const agentsDir = path.join(repoRoot, ".agents");
  const lockPath = path.join(repoRoot, SKILLS_LOCK_PATH);
  return {
    agentsDir,
    target: path.join(repoRoot, PATCH_ROOT),
    stage: path.join(agentsDir, `.skill-patches.staging-${tag}`),
    previous: path.join(agentsDir, `.skill-patches.previous-${tag}`),
    lockPath,
    lockStage: `${lockPath}.staging-${tag}`,
  } satisfies PublishPaths;
});

// The stage directory is claimed non-recursively, so a leftover stage from a crashed run
// refuses instead of being merged; each patch is written exclusive-create.
const stagePatches = Effect.fn("SkillsLock.stagePatches")(function* (
  paths: PublishPaths,
  patchFiles: ReadonlyArray<SkillPatchFile>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs
    .makeDirectory(paths.agentsDir, { recursive: true })
    .pipe(SkillsCommandError.mapError(`Failed to create ${paths.agentsDir}.`, paths.agentsDir));
  yield* fs
    .makeDirectory(paths.stage)
    .pipe(SkillsCommandError.mapError(`Refusing to stage: ${paths.stage} already exists.`, paths.stage));
  yield* Effect.forEach(
    patchFiles,
    Effect.fnUntraced(function* (file) {
      // Containment: a patch path must resolve inside the staging root.
      const absolute = yield* stagedPatchPath(paths.stage, file.path);
      yield* fs
        .makeDirectory(path.dirname(absolute), { recursive: true })
        .pipe(SkillsCommandError.mapError(`Failed to create the parent of ${absolute}.`, absolute));
      yield* fs
        .writeFile(absolute, file.bytes, { flag: "wx" })
        .pipe(SkillsCommandError.mapError(`Failed to stage ${file.path}.`, absolute));
    }),
    { discard: true }
  );
});

const requireLockUnchanged = Effect.fn("SkillsLock.requireLockUnchanged")(function* (
  lockPath: string,
  expected: Sha256Hex
) {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs
    .readFileString(lockPath)
    .pipe(SkillsCommandError.mapError(`Failed to re-read ${SKILLS_LOCK_PATH}.`, lockPath));
  const actual = yield* sha256Of(textEncoder.encode(text), lockPath);
  if (!Str.Equivalence(actual, expected)) {
    return yield* SkillsLockWriteRefusal.make({
      reason: "lock-changed",
      message: `${SKILLS_LOCK_PATH} changed since planning (${expected} -> ${actual}); re-plan and review again.`,
    });
  }
});

// Returns whether this run created the patch tree where none existed before, so rollback
// knows to remove it rather than restore a set-aside tree.
const swapPatchTree = Effect.fn("SkillsLock.swapPatchTree")(function* (paths: PublishPaths, hasPatches: boolean) {
  const fs = yield* FileSystem.FileSystem;
  const existing = yield* fs
    .exists(paths.target)
    .pipe(SkillsCommandError.mapError(`Failed to inspect ${PATCH_ROOT}.`, paths.target));
  if (existing) {
    yield* fs
      .rename(paths.target, paths.previous)
      .pipe(SkillsCommandError.mapError(`Failed to set aside the previous ${PATCH_ROOT}.`, paths.target));
  }
  if (!hasPatches) {
    yield* removeQuietly(paths.stage);
    return false;
  }
  yield* fs
    .rename(paths.stage, paths.target)
    .pipe(SkillsCommandError.mapError(`Failed to publish the staged ${PATCH_ROOT}.`, paths.target));
  return !existing;
});

const rollback = Effect.fn("SkillsLock.rollback")(function* (paths: PublishPaths, createdTarget: boolean) {
  const fs = yield* FileSystem.FileSystem;
  yield* removeQuietly(paths.stage);
  yield* removeQuietly(paths.lockStage);
  const setAside = yield* fs.exists(paths.previous).pipe(Effect.orElseSucceed(() => false));
  if (setAside) {
    yield* removeQuietly(paths.target);
    yield* fs.rename(paths.previous, paths.target).pipe(Effect.ignore);
  } else if (createdTarget) {
    // First publish: no previous tree existed, so the new one must not outlive a failed lock rename.
    yield* removeQuietly(paths.target);
  }
});

const publish = Effect.fn("SkillsLock.publish")(function* (
  repoRoot: string,
  plan: SkillsLockMigrationPlan,
  lockText: string,
  patchFiles: ReadonlyArray<SkillPatchFile>
) {
  const fs = yield* FileSystem.FileSystem;
  const paths = yield* publishPaths(repoRoot, plan.planDigest);
  const createdTarget = yield* Ref.make(false);
  const run = Effect.gen(function* () {
    yield* stagePatches(paths, patchFiles);
    yield* fs
      .writeFileString(paths.lockStage, lockText, { flag: "wx" })
      .pipe(SkillsCommandError.mapError(`Refusing to stage: ${paths.lockStage} already exists.`, paths.lockStage));
    yield* requireLockUnchanged(paths.lockPath, plan.lockSha256);
    yield* Ref.set(createdTarget, yield* swapPatchTree(paths, A.isReadonlyArrayNonEmpty(patchFiles)));
    yield* fs
      .rename(paths.lockStage, paths.lockPath)
      .pipe(SkillsCommandError.mapError(`Failed to publish ${SKILLS_LOCK_PATH}.`, paths.lockPath));
  });
  yield* run.pipe(Effect.onError(() => Effect.flatMap(Ref.get(createdTarget), (created) => rollback(paths, created))));
  yield* removeQuietly(paths.previous);
});

const writtenPatches = (patchFiles: ReadonlyArray<SkillPatchFile>) =>
  Effect.forEach(
    patchFiles,
    Effect.fnUntraced(function* (file) {
      return SkillsLockWrittenFile.make({ path: file.path, sha256: yield* sha256Of(file.bytes, file.path) });
    })
  );

const makeReceipt = (
  plan: SkillsLockMigrationPlan,
  document: SkillsLockDocument,
  outcome: SkillsLockWriteOutcome,
  lock: SkillsLockWrittenFile,
  patches: ReadonlyArray<SkillsLockWrittenFile>
): SkillsLockWriteReceipt => {
  const vendored = A.length(A.filter(R.values(document.skills), (entry) => entry._tag === "vendored"));
  return SkillsLockWriteReceipt.make({
    planDigest: plan.planDigest,
    outcome,
    lock,
    vendored,
    local: R.size(document.skills) - vendored,
    patches,
  });
};

/**
 * Replays a reviewed skills-lock migration plan when `--expect` names its exact digest.
 *
 * **Details**
 *
 * Recomputes the plan, then refuses with a typed {@link SkillsLockWriteRefusal}
 * when `expect` is missing or differs from the recomputed digest, when any
 * row is conflicted, or when `skills-lock.json` changed between planning and
 * the rename. Otherwise it writes the canonical `version: 2` lock and the
 * generated patch tree through staged files and atomic renames, and returns
 * the receipt. When the lock text and patch tree already equal the plan's,
 * nothing is written and the receipt's outcome is `already-applied`.
 *
 * **Example** (Build the write effect)
 *
 * ```ts
 * import { writeSkillsLockMigration } from "@beep/repo-cli/commands/Skills/SkillsLock.write"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * console.log(Effect.isEffect(writeSkillsLockMigration("/workspace/beep-effect", O.some("0".repeat(64))))) // true
 * ```
 *
 * @param repoRoot - Absolute repository root holding `skills-lock.json` and the installed trees.
 * @param expect - The reviewed `planDigest` from `lock-plan --json`.
 * @returns The write receipt.
 * @category commands
 * @since 0.0.0
 */
export const writeSkillsLockMigration = Effect.fn("SkillsLock.writeSkillsLockMigration")(function* (
  repoRoot: string,
  expect: O.Option<string>
): Effect.fn.Return<
  SkillsLockWriteReceipt,
  SkillsCommandError | SkillsLockWriteRefusal,
  SkillUpstreamContentSource | SkillPatchOwnerSource | FileSystem.FileSystem | Path.Path | Crypto.Crypto
> {
  const artifacts = yield* compileSkillsLockMigration(repoRoot);
  const plan = artifacts.plan;
  yield* requireExpectedDigest(plan, expect);
  yield* refuseConflicts(plan);
  const document = skillsLockDocumentOf(plan);
  const lockText = yield* renderSkillsLockDocumentText(document);
  const lock = SkillsLockWrittenFile.make({
    path: SKILLS_LOCK_PATH,
    sha256: yield* sha256Of(textEncoder.encode(lockText), SKILLS_LOCK_PATH),
  });
  const patches = yield* writtenPatches(artifacts.patchFiles);
  if (yield* isAlreadyApplied(repoRoot, lockText, patches)) {
    return makeReceipt(plan, document, "already-applied", lock, patches);
  }
  yield* publish(repoRoot, plan, lockText, artifacts.patchFiles);
  return makeReceipt(plan, document, "written", lock, patches);
});
