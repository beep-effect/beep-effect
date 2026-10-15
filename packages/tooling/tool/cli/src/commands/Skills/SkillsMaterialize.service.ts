/**
 * `beep skills materialize`: rebuild installed skill trees from the lock, verified before written.
 *
 * **Details**
 *
 * For every vendored entry of `skills-lock.json` the materializer loads the
 * pristine tree at `upstream.sourceRevision` through
 * {@link SkillUpstreamContentSource}, checks it against the lock's snapshot
 * tree and manifest hashes, checks every patch file against its recorded
 * digest and the series against `patches.patchSetHash`, replays the series in
 * order with the strict applier, and checks the result against
 * `effective.treeHash` (B17). Only a tree that passed every check is written,
 * and it is written by the one clearing-house writer to every install target
 * (B16). After the write, every target is re-read and must hash to the
 * effective tree and to `effective.installedTreeHash`.
 *
 * Local entries are never reconstructed: their targets are verified against
 * `installedTreeHash`, the same oracle `skills update --check` uses.
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
import * as Str from "effect/String";
import { publishSkillTree } from "./internal/ClearingHouse.ts";
import { readSkillsLockText, SKILLS_LOCK_PATH } from "./internal/LockFile.ts";
import { decodePatchText, readVerifiedPatchSeries } from "./internal/PatchSeries.ts";
import { computeSkillTree, installedTargetsHash, readTargetTree, validateRelativePath } from "./internal/SkillTree.ts";
import { applySkillPatch } from "./SkillPatches.apply.ts";
import { SkillMaterializeRefusal, SkillsCommandError } from "./Skills.errors.ts";
import {
  SkillUpstreamContentSource,
  SkillUpstreamContentSourceLive,
  skillResolutionOfEntry,
} from "./Skills.service.ts";
import { decodeSkillsLockDocumentJson } from "./SkillsLock.schemas.ts";
import { SkillMaterializeReport, SkillMaterializeRow, SkillMaterializeTarget } from "./SkillsMaterialize.schemas.ts";
import type { Sha256Hex } from "@beep/schema";
import type * as Crypto from "effect/Crypto";
import type * as FileSystem from "effect/FileSystem";
import type * as Path from "effect/Path";
import type { SkillPatchApplyError, SkillUpstreamContentError } from "./Skills.errors.ts";
import type { SkillUpstreamContentFile } from "./Skills.schemas.ts";
import type { LocalSkillLockEntry, SkillsLockEntry, VendoredSkillLockEntry } from "./SkillsLock.schemas.ts";
import type { SkillMaterializeMode, SkillMaterializeTargetState } from "./SkillsMaterialize.schemas.ts";

const $I = $RepoCliId.create("commands/Skills/SkillsMaterialize.service");

type MaterializeRequirements = SkillUpstreamContentSource | FileSystem.FileSystem | Path.Path | Crypto.Crypto;

/**
 * Every failure `materialize` can raise.
 *
 * @category type-level
 * @since 0.0.0
 */
export type SkillMaterializeFailure =
  | SkillsCommandError
  | SkillMaterializeRefusal
  | SkillPatchApplyError
  | SkillUpstreamContentError;

/** What one install target holds right now. */
type TargetReading = {
  readonly target: string;
  readonly treeHash: O.Option<Sha256Hex>;
};

const refuse = (skill: string, reason: SkillMaterializeRefusal["reason"], message: string) =>
  Effect.fail(SkillMaterializeRefusal.make({ skill, reason, message }));

const readLock = Effect.fn("SkillsMaterialize.readLock")(function* (repoRoot: string) {
  const { lockPath, text } = yield* readSkillsLockText(repoRoot);
  return yield* decodeSkillsLockDocumentJson(text).pipe(
    SkillsCommandError.mapError(`${SKILLS_LOCK_PATH} is not a skills-lock/v2 document.`, lockPath)
  );
});

const selectEntries = Effect.fn("SkillsMaterialize.selectEntries")(function* (
  skills: Readonly<Record<string, SkillsLockEntry>>,
  skill: O.Option<string>
): Effect.fn.Return<ReadonlyArray<readonly [string, SkillsLockEntry]>, SkillMaterializeRefusal> {
  const entries = A.sortWith(R.toEntries(skills), ([name]) => name, Str.Order);
  if (O.isNone(skill)) {
    return entries;
  }
  const selected = A.filter(entries, ([name]) => Str.Equivalence(name, skill.value));
  return A.isReadonlyArrayNonEmpty(selected)
    ? selected
    : yield* refuse(skill.value, "unknown-skill", `${skill.value} has no entry in ${SKILLS_LOCK_PATH}.`);
});

// A publish replaces the whole target directory, so only the skill's own install directories qualify.
const skillDirectories = (skill: string): ReadonlyArray<string> => [
  `.claude/skills/${skill}`,
  `.agents/skills/${skill}`,
];

const requireSafeTargets = Effect.fn("SkillsMaterialize.requireSafeTargets")(function* (
  skill: string,
  targets: ReadonlyArray<string>
): Effect.fn.Return<ReadonlyArray<string>, SkillMaterializeRefusal> {
  return yield* Effect.forEach(targets, (target) =>
    validateRelativePath(target, skill).pipe(
      Effect.catchTag("SkillsCommandError", () =>
        refuse(skill, "unsafe-target", `Install target ${target} of ${skill} is not a contained repo-relative path.`)
      ),
      Effect.filterOrElse(
        (normalized) => A.contains(skillDirectories(skill), normalized),
        () => refuse(skill, "unsafe-target", `Install target ${target} of ${skill} is not that skill's directory.`)
      )
    )
  );
});

const readTargets = Effect.fn("SkillsMaterialize.readTargets")(function* (
  repoRoot: string,
  skill: string,
  targets: ReadonlyArray<string>
): Effect.fn.Return<
  ReadonlyArray<TargetReading>,
  SkillsCommandError,
  FileSystem.FileSystem | Path.Path | Crypto.Crypto
> {
  return yield* Effect.forEach(targets, (target) =>
    Effect.map(readTargetTree(repoRoot, target, skill), (tree) => ({
      target,
      treeHash: O.map(tree, (value) => value.treeHash),
    }))
  );
});

// Every target present and the installed-targets hash equal to the recorded one.
const installMatches = Effect.fn("SkillsMaterialize.installMatches")(function* (
  readings: ReadonlyArray<TargetReading>,
  skill: string,
  expected: Sha256Hex
): Effect.fn.Return<boolean, SkillsCommandError, Crypto.Crypto> {
  const present = A.getSomes(
    A.map(readings, (reading) => O.map(reading.treeHash, (treeHash) => [reading.target, treeHash] as const))
  );
  if (A.length(present) !== A.length(readings)) {
    return false;
  }
  return Str.Equivalence(yield* installedTargetsHash(present, skill), expected);
});

const targetState = (reading: TargetReading, matches: (treeHash: Sha256Hex) => boolean): SkillMaterializeTargetState =>
  O.match(reading.treeHash, {
    onNone: () => "missing",
    onSome: (treeHash) => (matches(treeHash) ? "matches" : "differs"),
  });

const reportTargets = (
  readings: ReadonlyArray<TargetReading>,
  matches: (treeHash: Sha256Hex) => boolean
): ReadonlyArray<SkillMaterializeTarget> =>
  A.map(readings, (reading) =>
    SkillMaterializeTarget.make({ target: reading.target, state: targetState(reading, matches) })
  );

/**
 * Rebuilds a vendored entry's effective tree in memory and verifies every step (B17).
 *
 * **Details**
 *
 * Loads the pristine tree at `upstream.sourceRevision`, refuses unless it
 * hashes to the snapshot tree and manifest hashes, refuses unless every patch
 * file matches its recorded digest and the series matches
 * `patches.patchSetHash`, replays the series in order, and refuses unless the
 * result hashes to `effective.treeHash`. Nothing is written.
 *
 * **Example** (Inspect the requirements before providing them)
 *
 * ```ts
 * import type { VendoredSkillLockEntry } from "@beep/repo-cli/commands/Skills/SkillsLock.schemas"
 * import { reconstructVendoredSkill } from "@beep/repo-cli/commands/Skills/SkillsMaterialize.service"
 * import * as Effect from "effect/Effect"
 *
 * const rebuildOracle = (entry: VendoredSkillLockEntry) =>
 *   reconstructVendoredSkill("/workspace/beep-effect", "oracle", entry).pipe(Effect.map((files) => files.length))
 *
 * console.log(typeof rebuildOracle) // "function"
 * ```
 *
 * @param repoRoot - Absolute repository root holding the patch series.
 * @param skill - The entry's lock key.
 * @param entry - The vendored lock entry.
 * @returns The verified effective tree, sorted by path.
 * @category queries
 * @since 0.0.0
 */
export const reconstructVendoredSkill = Effect.fn("SkillsMaterialize.reconstructVendoredSkill")(function* (
  repoRoot: string,
  skill: string,
  entry: VendoredSkillLockEntry
): Effect.fn.Return<ReadonlyArray<SkillUpstreamContentFile>, SkillMaterializeFailure, MaterializeRequirements> {
  const source = yield* SkillUpstreamContentSource;
  const content = yield* source.load(skillResolutionOfEntry(skill, entry));
  const pristine = yield* computeSkillTree(content.files, `${skill}:pristine`);
  if (
    !Str.Equivalence(pristine.treeHash, entry.snapshot.treeHash) ||
    !Str.Equivalence(pristine.manifestHash, entry.snapshot.manifestHash)
  ) {
    return yield* refuse(
      skill,
      "pristine-mismatch",
      `The tree at ${entry.upstream.sourceRevision} hashes to ${pristine.treeHash} (manifest ${pristine.manifestHash}), but the snapshot records ${entry.snapshot.treeHash} (manifest ${entry.snapshot.manifestHash}).`
    );
  }
  const patches = yield* readVerifiedPatchSeries(repoRoot, skill, entry);
  let files: ReadonlyArray<SkillUpstreamContentFile> = content.files;
  for (const patch of patches) {
    files = yield* applySkillPatch(patch.path, yield* decodePatchText(skill, patch), files);
  }
  const effective = yield* computeSkillTree(files, `${skill}:effective`);
  if (!Str.Equivalence(effective.treeHash, entry.effective.treeHash)) {
    return yield* refuse(
      skill,
      "effective-mismatch",
      `Pristine plus ${A.length(patches)} patch(es) hashes to ${effective.treeHash}, but the lock records ${entry.effective.treeHash}.`
    );
  }
  return A.sortWith(files, (file) => file.path, Str.Order);
});

const materializeVendored = Effect.fn("SkillsMaterialize.materializeVendored")(function* (
  repoRoot: string,
  mode: SkillMaterializeMode,
  skill: string,
  entry: VendoredSkillLockEntry
): Effect.fn.Return<SkillMaterializeRow, SkillMaterializeFailure, MaterializeRequirements> {
  const targets = yield* requireSafeTargets(skill, entry.effective.installedTargets);
  const files = yield* reconstructVendoredSkill(repoRoot, skill, entry);
  const matchesEffective = (treeHash: Sha256Hex): boolean => Str.Equivalence(treeHash, entry.effective.treeHash);
  const before = yield* readTargets(repoRoot, skill, targets);
  const current =
    A.every(before, (reading) => O.exists(reading.treeHash, matchesEffective)) &&
    (yield* installMatches(before, skill, entry.effective.installedTreeHash));
  const row = (status: SkillMaterializeRow["status"]) =>
    SkillMaterializeRow.make({
      skill,
      kind: "vendored",
      status,
      patches: A.length(entry.patches.series),
      targets: reportTargets(before, matchesEffective),
    });
  if (current) {
    return row("current");
  }
  if (mode === "check") {
    return row("would-rebuild");
  }
  yield* publishSkillTree(repoRoot, skill, targets, files);
  // Cross-target equivalence after every write: each target must hold the effective tree.
  const after = yield* readTargets(repoRoot, skill, targets);
  const equivalent =
    A.every(after, (reading) => O.exists(reading.treeHash, matchesEffective)) &&
    (yield* installMatches(after, skill, entry.effective.installedTreeHash));
  if (!equivalent) {
    return yield* refuse(
      skill,
      "post-write-divergence",
      `After publishing ${skill}, its targets still disagree with the effective tree ${entry.effective.treeHash}.`
    );
  }
  return row("rebuilt");
});

// A local entry records only the cross-target hash, so a mismatch marks every present target as differing.
const verifyLocal = Effect.fn("SkillsMaterialize.verifyLocal")(function* (
  repoRoot: string,
  skill: string,
  entry: LocalSkillLockEntry
): Effect.fn.Return<
  SkillMaterializeRow,
  SkillsCommandError | SkillMaterializeRefusal,
  FileSystem.FileSystem | Path.Path | Crypto.Crypto
> {
  const targets = yield* requireSafeTargets(skill, entry.installedTargets);
  const readings = yield* readTargets(repoRoot, skill, targets);
  const current = yield* installMatches(readings, skill, entry.installedTreeHash);
  return SkillMaterializeRow.make({
    skill,
    kind: "local",
    status: current ? "current" : "local-drift",
    patches: 0,
    targets: reportTargets(readings, () => current),
  });
});

/**
 * Service contract for `beep skills materialize`.
 *
 * **Details**
 *
 * `materialize` reads `skills-lock.json` under `repoRoot`, examines every
 * entry (or only the one `skill` names), and returns one row per entry. In
 * `check` mode nothing is written. In `write` mode each vendored entry whose
 * targets differ from its verified effective tree is republished through the
 * clearing-house writer. Local entries are verified, never rewritten.
 *
 * @see {@link SkillMaterializer} for the injectable service built on this contract.
 * @category services
 * @since 0.0.0
 */
export interface SkillMaterializerShape {
  /** Verify or rebuild the installed trees of every selected lock entry. */
  readonly materialize: (
    repoRoot: string,
    mode: SkillMaterializeMode,
    skill: O.Option<string>
  ) => Effect.Effect<SkillMaterializeReport, SkillMaterializeFailure>;
}

/**
 * Injectable materializer for vendored and local skill trees.
 *
 * **Example** (Run against a substituted materializer)
 *
 * ```ts
 * import { SkillMaterializer } from "@beep/repo-cli/commands/Skills/SkillsMaterialize.service"
 * import { SkillMaterializeReport } from "@beep/repo-cli/commands/Skills/SkillsMaterialize.schemas"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as O from "effect/Option"
 *
 * const empty = Layer.succeed(
 *   SkillMaterializer,
 *   SkillMaterializer.of({
 *     materialize: (_repoRoot, mode) => Effect.succeed(SkillMaterializeReport.make({ mode, rows: [] })),
 *   })
 * )
 *
 * const program = Effect.gen(function* () {
 *   const materializer = yield* SkillMaterializer
 *   return yield* materializer.materialize("/workspace/beep-effect", "check", O.none())
 * })
 *
 * console.log(Effect.runSync(Effect.provide(program, empty)).rows.length) // 0
 * ```
 *
 * @see {@link SkillMaterializerLive} for the layer backed by pinned GitHub content.
 * @category services
 * @since 0.0.0
 */
export class SkillMaterializer extends Context.Service<SkillMaterializer, SkillMaterializerShape>()(
  $I`SkillMaterializer`
) {}

const makeSkillMaterializer = Effect.gen(function* () {
  const runtimeContext = yield* Effect.context<MaterializeRequirements>();
  return SkillMaterializer.of({
    materialize: Effect.fn("SkillMaterializer.materialize")(function* (repoRoot, mode, skill) {
      const lock = yield* readLock(repoRoot);
      const entries = yield* selectEntries(lock.skills, skill);
      const rows = yield* Effect.forEach(entries, ([name, entry]) =>
        entry._tag === "vendored"
          ? materializeVendored(repoRoot, mode, name, entry)
          : verifyLocal(repoRoot, name, entry)
      );
      return SkillMaterializeReport.make({ mode, rows });
    }, Effect.provide(runtimeContext)),
  });
}).pipe(Effect.withSpan("SkillMaterializer.make"));

/**
 * Materializer layer that leaves the upstream-content source open.
 *
 * **When to use**
 *
 * Use when the pristine trees should come from somewhere other than GitHub,
 * such as a fixture source in a test; filesystem, path, and crypto services
 * are captured when the layer is built, so a test can also substitute a
 * fault-injecting filesystem.
 *
 * **Example** (Close the layer over an offline source)
 *
 * ```ts
 * import { SkillUpstreamContent, SkillPathHistory } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import { SkillUpstreamContentSource } from "@beep/repo-cli/commands/Skills/Skills.service"
 * import { SkillMaterializerLayer } from "@beep/repo-cli/commands/Skills/SkillsMaterialize.service"
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
 * console.log(Layer.isLayer(SkillMaterializerLayer.pipe(Layer.provide(offline)))) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const SkillMaterializerLayer = Layer.effect(SkillMaterializer, makeSkillMaterializer);

/**
 * Live materializer backed by pinned GitHub content.
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
 * import { SkillMaterializerLive } from "@beep/repo-cli/commands/Skills/SkillsMaterialize.service"
 * import * as Layer from "effect/Layer"
 * import * as FetchHttpClient from "effect/http/FetchHttpClient";
 * console.log(Layer.isLayer(SkillMaterializerLive.pipe(Layer.provide(FetchHttpClient.layer)))) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const SkillMaterializerLive = SkillMaterializerLayer.pipe(Layer.provide(SkillUpstreamContentSourceLive));
