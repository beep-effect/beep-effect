/**
 * Recording changes to a vendored skill's patch series: `beep skills patch add`
 * and `beep skills patch label`.
 *
 * **Details**
 *
 * `patch add` is the first remedy `skills update --check` names for
 * `hand-edited-vendored-output`. It reconstructs the verified effective tree
 * (the same checks `materialize` runs, B17), diffs it against the installed
 * tree, and plans one new `temporary-drift` patch per changed file, numbered
 * after the existing series. The plan is proven before it is sealed: the new
 * patches must replay with the strict applier onto the effective tree and
 * reproduce the installed tree byte for byte. With the reviewed digest it
 * writes the new patch files exclusive-create and publishes the lock through
 * the staged, re-checked rename the other lock writers use.
 *
 * `patch label` moves each patch's lock label to the label the hunk ledger's
 * classifications agree on, so the first ritual's decisions (B21) reach the
 * lock without a hand edit (B23).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { canonicalJsonText } from "../Goals/PacketCore/PacketDigest.ts";
import { latestClassification, readHunkLedger } from "./internal/HunkLedger.ts";
import { readSkillsLockDocument, requireVendoredEntry, SKILLS_LOCK_PATH } from "./internal/LockFile.ts";
import { decodePatchText, PatchSeriesFile, readVerifiedPatchSeries } from "./internal/PatchSeries.ts";
import {
  computeSkillTree,
  hashBytes,
  installedTargetsHash,
  patchSetHashOf,
  readTargetTree,
} from "./internal/SkillTree.ts";
import { applySkillPatch, listSkillPatchHunks } from "./SkillPatches.apply.ts";
import { SkillPatchRefusal, SkillsCommandError, SkillsLockWriteRefusal } from "./Skills.errors.ts";
import { SkillPatchOwnerSourceLive } from "./Skills.patches.ts";
import { SkillEffective, SkillPatch, SkillPatches } from "./Skills.schemas.ts";
import { buildSkillPatchAdditions, SkillUpstreamContentSourceLive } from "./Skills.service.ts";
import { VendoredSkillLockEntry } from "./SkillsLock.schemas.ts";
import { publishSkillsLockEntry } from "./SkillsLock.write.ts";
import { reconstructVendoredSkill } from "./SkillsMaterialize.service.ts";
import {
  SkillPatchAddReceipt,
  SkillPatchLabelChange,
  SkillPatchLabelPending,
  SkillPatchLabelReceipt,
} from "./SkillsPatch.schemas.ts";
import type { Sha256Hex } from "@beep/schema";
import type * as Crypto from "effect/Crypto";
import type { ComputedSkillTree } from "./internal/SkillTree.ts";
import type { SkillMaterializeRefusal, SkillPatchApplyError, SkillUpstreamContentError } from "./Skills.errors.ts";
import type { SkillPatchOwnerSource } from "./Skills.patches.ts";
import type { SkillPatchLabel, SkillUpstreamContentFile } from "./Skills.schemas.ts";
import type { SkillUpstreamContentSource } from "./Skills.service.ts";
import type {
  SkillPatchFile,
  SkillsLockDocument,
  SkillsLockEntry,
  SkillsLockWrittenFile,
} from "./SkillsLock.schemas.ts";
import type { SkillPatchLabelPendingReason, SkillPatchPlanOutcome } from "./SkillsPatch.schemas.ts";
import type { SkillHunkLedgerRow } from "./SkillsReview.schemas.ts";

const $I = $RepoCliId.create("commands/Skills/SkillsPatch.service");

const PATCH_ADD_SCHEMA_VERSION = "skills-patch-add-plan/v1";
const PATCH_LABEL_SCHEMA_VERSION = "skills-patch-label-plan/v1";

type PatchRequirements =
  | SkillUpstreamContentSource
  | SkillPatchOwnerSource
  | FileSystem.FileSystem
  | Path.Path
  | Crypto.Crypto;

/**
 * Every failure `skills patch add` and `skills patch label` can raise.
 *
 * @category type-level
 * @since 0.0.0
 */
export type SkillPatchRecorderFailure =
  | SkillsCommandError
  | SkillPatchRefusal
  | SkillsLockWriteRefusal
  | SkillMaterializeRefusal
  | SkillPatchApplyError
  | SkillUpstreamContentError;

const encodePatches = S.encodeEffect(SkillPatches);
const encodeEffective = S.encodeEffect(SkillEffective);
const textEncoder = new TextEncoder();

const refuse = (skill: string, reason: SkillPatchRefusal["reason"], message: string) =>
  Effect.fail(SkillPatchRefusal.make({ skill, reason, message }));

const requireVendored = (
  skills: Readonly<Record<string, SkillsLockEntry>>,
  skill: string
): Effect.Effect<VendoredSkillLockEntry, SkillPatchRefusal> =>
  requireVendoredEntry(skills, skill, "edit it in place and run beep skills update.", (reason, message) =>
    refuse(skill, reason, message)
  );

const digestOf = Effect.fn("SkillsPatch.digestOf")(function* (preimage: unknown, label: string) {
  return yield* hashBytes(textEncoder.encode(canonicalJsonText(preimage)), label);
});

const requireExpected = (expect: string, planDigest: Sha256Hex, rerun: string) =>
  Str.Equivalence(expect, planDigest)
    ? Effect.void
    : Effect.fail(
        SkillsLockWriteRefusal.make({
          reason: "digest-mismatch",
          message: `Plan moved since review: expected ${expect}, recomputed ${planDigest}. Re-run ${rerun} --json and review again.`,
        })
      );

// Every install target must exist and hold the same tree; that tree is the hand edit.
const readInstalledTree = Effect.fn("SkillsPatch.readInstalledTree")(function* (
  repoRoot: string,
  skill: string,
  targets: ReadonlyArray<string>
): Effect.fn.Return<ComputedSkillTree, SkillsCommandError | SkillPatchRefusal, PatchRequirements> {
  const trees = yield* Effect.forEach(targets, (target) =>
    readTargetTree(repoRoot, target, skill).pipe(
      Effect.flatMap(
        O.match({
          onNone: () => refuse(skill, "missing-target", `Install target ${target} of ${skill} does not exist.`),
          onSome: Effect.succeed,
        })
      )
    )
  );
  const hashes = HashSet.fromIterable(A.map(trees, (tree) => tree.treeHash));
  return yield* O.match(A.head(trees), {
    onNone: () => refuse(skill, "missing-target", `${skill} records no install target.`),
    onSome: (tree) =>
      HashSet.size(hashes) === 1
        ? Effect.succeed(tree)
        : refuse(
            skill,
            "divergent-targets",
            `The install targets of ${skill} hold different trees; run beep skills materialize --check to see which.`
          ),
  });
});

const requireFreePaths = Effect.fn("SkillsPatch.requireFreePaths")(function* (
  repoRoot: string,
  skill: string,
  entry: VendoredSkillLockEntry,
  added: ReadonlyArray<SkillPatch>
): Effect.fn.Return<void, SkillsCommandError | SkillPatchRefusal, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  for (const patch of added) {
    const absolute = path.join(repoRoot, patch.path);
    const taken =
      A.some(entry.patches.series, (existing) => Str.Equivalence(existing.path, patch.path)) ||
      (yield* fs.exists(absolute).pipe(SkillsCommandError.mapError(`Failed to inspect ${patch.path}.`, absolute)));
    if (taken) {
      return yield* refuse(skill, "patch-exists", `${patch.path} already exists; refusing to overwrite a patch.`);
    }
  }
});

// The proof the plan is sealed on: the new patches, applied strictly to the effective tree,
// reproduce the installed tree.
const requireReplayReproduces = Effect.fn("SkillsPatch.requireReplayReproduces")(function* (
  skill: string,
  effectiveFiles: ReadonlyArray<SkillUpstreamContentFile>,
  files: ReadonlyArray<SkillPatchFile>,
  installed: ComputedSkillTree
): Effect.fn.Return<void, SkillsCommandError | SkillPatchRefusal | SkillPatchApplyError, Crypto.Crypto> {
  let tree = effectiveFiles;
  for (const file of files) {
    const text = yield* decodePatchText(skill, PatchSeriesFile.make({ path: file.path, bytes: file.bytes }));
    tree = yield* applySkillPatch(file.path, text, tree);
  }
  const replayed = yield* computeSkillTree(tree, `${skill}:patch-add`);
  if (!Str.Equivalence(replayed.treeHash, installed.treeHash)) {
    return yield* refuse(
      skill,
      "replay-mismatch",
      `The new patches replay to ${replayed.treeHash}, not the installed ${installed.treeHash}; nothing was written.`
    );
  }
});

type PlannedAdd = {
  readonly receipt: (outcome: SkillPatchPlanOutcome, lock: O.Option<SkillsLockWrittenFile>) => SkillPatchAddReceipt;
  readonly files: ReadonlyArray<SkillPatchFile>;
  readonly lock: { readonly document: SkillsLockDocument; readonly sha256: Sha256Hex };
  readonly entry: VendoredSkillLockEntry;
  readonly planDigest: Sha256Hex;
};

const planAdd = Effect.fn("SkillsPatch.planAdd")(function* (
  repoRoot: string,
  skill: string
): Effect.fn.Return<PlannedAdd, SkillPatchRecorderFailure, PatchRequirements> {
  const lock = yield* readSkillsLockDocument(repoRoot);
  const entry = yield* requireVendored(lock.document.skills, skill);
  const installed = yield* readInstalledTree(repoRoot, skill, entry.effective.installedTargets);
  const effectiveFiles = yield* reconstructVendoredSkill(repoRoot, skill, entry);
  const effectiveTree = yield* computeSkillTree(effectiveFiles, `${skill}:effective`);
  if (Str.Equivalence(installed.treeHash, effectiveTree.treeHash)) {
    return yield* refuse(
      skill,
      "no-hand-edit",
      `The installed ${skill} tree already equals its recorded effective tree; there is no hand edit to record.`
    );
  }
  const additions = yield* buildSkillPatchAdditions(
    skill,
    repoRoot,
    effectiveTree,
    installed,
    A.length(entry.patches.series)
  );
  const added = A.map(additions, ([patch]) => patch);
  const files = A.map(additions, ([, file]) => file);
  yield* requireFreePaths(repoRoot, skill, entry, added);
  yield* requireReplayReproduces(skill, effectiveFiles, files, installed);
  const existing = yield* readVerifiedPatchSeries(repoRoot, skill, entry);
  const patches = SkillPatches.make({
    required: true,
    patchSetHash: yield* patchSetHashOf(A.appendAll(existing, files), skill),
    series: A.appendAll(entry.patches.series, added),
  });
  const effective = SkillEffective.make({
    treeHash: installed.treeHash,
    installedTargets: entry.effective.installedTargets,
    installedTreeHash: yield* installedTargetsHash(
      A.map(entry.effective.installedTargets, (target) => [target, installed.treeHash] as const),
      skill
    ),
  });
  const encoded = yield* Effect.all({ patches: encodePatches(patches), effective: encodeEffective(effective) }).pipe(
    SkillsCommandError.mapError(`Failed to encode the ${skill} patch-add plan.`, SKILLS_LOCK_PATH, skill)
  );
  const planDigest = yield* digestOf(
    {
      schemaVersion: PATCH_ADD_SCHEMA_VERSION,
      lockSha256: lock.sha256,
      skill,
      sourceRevision: entry.upstream.sourceRevision,
      ...encoded,
    },
    PATCH_ADD_SCHEMA_VERSION
  );
  return {
    receipt: (outcome, written) =>
      SkillPatchAddReceipt.make({
        planDigest,
        lockSha256: lock.sha256,
        skill,
        sourceRevision: entry.upstream.sourceRevision,
        added,
        patches,
        effective,
        outcome,
        lock: written,
      }),
    files,
    lock,
    entry: VendoredSkillLockEntry.make({ ...entry, patches, effective }),
    planDigest,
  };
});

// New patch files are created exclusively; any later failure removes exactly those files.
const publishAdd = Effect.fn("SkillsPatch.publishAdd")(function* (
  repoRoot: string,
  skill: string,
  planned: PlannedAdd
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  // Only files this attempt created are rolled back: an exclusive-create failure means the path
  // already existed, and that file belongs to someone else.
  const created = yield* Ref.make(A.empty<string>());
  const writeFiles = Effect.forEach(
    planned.files,
    (file) => {
      const absolute = path.join(repoRoot, file.path);
      return fs
        .makeDirectory(path.dirname(absolute), { recursive: true })
        .pipe(
          Effect.andThen(fs.writeFile(absolute, file.bytes, { flag: "wx" })),
          Effect.andThen(Ref.update(created, A.append(absolute))),
          SkillsCommandError.mapError(`Failed to write ${file.path}.`, absolute)
        );
    },
    { discard: true }
  );
  return yield* writeFiles.pipe(
    Effect.andThen(publishSkillsLockEntry(repoRoot, planned.lock, skill, planned.entry, planned.planDigest)),
    Effect.onError(() =>
      Effect.flatMap(Ref.get(created), (paths) =>
        Effect.forEach(paths, (absolute) => fs.remove(absolute, { force: true }).pipe(Effect.ignore), {
          discard: true,
        })
      )
    )
  );
});

const addPatch = Effect.fn("SkillsPatch.addPatch")(function* (
  repoRoot: string,
  skill: string,
  expect: O.Option<string>
): Effect.fn.Return<SkillPatchAddReceipt, SkillPatchRecorderFailure, PatchRequirements> {
  const planned = yield* planAdd(repoRoot, skill);
  if (O.isNone(expect)) {
    return planned.receipt("planned", O.none());
  }
  yield* requireExpected(expect.value, planned.planDigest, `beep skills patch add --skill ${skill}`);
  return planned.receipt("written", O.some(yield* publishAdd(repoRoot, skill, planned)));
});

type PatchVerdict =
  | { readonly _tag: "label"; readonly label: SkillPatchLabel }
  | { readonly _tag: "pending"; readonly reason: SkillPatchLabelPendingReason };

// A patch takes a label only when every hunk's latest classification keeps it under that one label.
const verdictOf = (classifications: ReadonlyArray<O.Option<SkillHunkLedgerRow>>): PatchVerdict => {
  const rows = A.getSomes(classifications);
  if (A.length(rows) < A.length(classifications) || A.isReadonlyArrayEmpty(rows)) {
    return { _tag: "pending", reason: "unclassified" };
  }
  if (A.some(rows, (row) => row.decision === "drop")) {
    return { _tag: "pending", reason: "dropped" };
  }
  const labels = A.dedupe(A.getSomes(A.map(rows, (row) => row.label)));
  return O.match(A.head(labels), {
    onNone: (): PatchVerdict => ({ _tag: "pending", reason: "unclassified" }),
    onSome: (label): PatchVerdict =>
      A.length(labels) === 1 ? { _tag: "label", label } : { _tag: "pending", reason: "mixed" },
  });
};

const classifyPatch = Effect.fn("SkillsPatch.classifyPatch")(function* (
  skill: string,
  ledger: ReadonlyArray<SkillHunkLedgerRow>,
  patch: SkillPatch,
  bytes: Uint8Array
) {
  const hunks = yield* listSkillPatchHunks(
    patch.path,
    yield* decodePatchText(skill, PatchSeriesFile.make({ path: patch.path, bytes }))
  );
  return verdictOf(A.map(hunks, (hunk) => latestClassification(ledger, { skill, hunkHash: hunk.hunkHash })));
});

const labelPatches = Effect.fn("SkillsPatch.labelPatches")(function* (
  repoRoot: string,
  skill: string,
  expect: O.Option<string>
): Effect.fn.Return<SkillPatchLabelReceipt, SkillPatchRecorderFailure, PatchRequirements> {
  const lock = yield* readSkillsLockDocument(repoRoot);
  const entry = yield* requireVendored(lock.document.skills, skill);
  const files = yield* readVerifiedPatchSeries(repoRoot, skill, entry);
  const ledger = yield* readHunkLedger(repoRoot);
  const verdicts = yield* Effect.forEach(A.zip(entry.patches.series, files), ([patch, file]) =>
    Effect.map(classifyPatch(skill, ledger, patch, file.bytes), (verdict) => [patch, verdict] as const)
  );
  const changes = A.flatMap(verdicts, ([patch, verdict]) =>
    verdict._tag === "label" && verdict.label !== patch.label
      ? [SkillPatchLabelChange.make({ patch: patch.path, from: patch.label, to: verdict.label })]
      : A.empty<SkillPatchLabelChange>()
  );
  const pending = A.flatMap(verdicts, ([patch, verdict]) =>
    verdict._tag === "pending"
      ? [SkillPatchLabelPending.make({ patch: patch.path, reason: verdict.reason })]
      : A.empty<SkillPatchLabelPending>()
  );
  const planDigest = yield* digestOf(
    {
      schemaVersion: PATCH_LABEL_SCHEMA_VERSION,
      lockSha256: lock.sha256,
      skill,
      changes: A.map(changes, ({ patch, from, to }) => ({ patch, from, to })),
    },
    PATCH_LABEL_SCHEMA_VERSION
  );
  const receipt = (outcome: SkillPatchPlanOutcome, written: O.Option<SkillsLockWrittenFile>) =>
    SkillPatchLabelReceipt.make({
      planDigest,
      lockSha256: lock.sha256,
      skill,
      changes,
      pending,
      outcome,
      lock: written,
    });
  if (O.isNone(expect)) {
    return receipt("planned", O.none());
  }
  yield* requireExpected(expect.value, planDigest, `beep skills patch label --skill ${skill}`);
  if (A.isReadonlyArrayEmpty(changes)) {
    return receipt("already-current", O.none());
  }
  const relabel = (patch: SkillPatch): SkillPatch =>
    O.match(
      A.findFirst(changes, (change) => Str.Equivalence(change.patch, patch.path)),
      {
        onNone: () => patch,
        onSome: (change) => SkillPatch.make({ ...patch, label: change.to }),
      }
    );
  const relabelled = VendoredSkillLockEntry.make({
    ...entry,
    patches: SkillPatches.make({ ...entry.patches, series: A.map(entry.patches.series, relabel) }),
  });
  return receipt("written", O.some(yield* publishSkillsLockEntry(repoRoot, lock, skill, relabelled, planDigest)));
});

/**
 * Service contract for recording changes to a vendored skill's patch series.
 *
 * **Details**
 *
 * `add` turns a hand edit of the installed tree into new patches; `label`
 * moves patch labels to the hunk ledger's classifications. Both only return
 * the sealed plan (`planned`) without `expect`, and write only when `expect`
 * equals a freshly recomputed `planDigest`.
 *
 * @see {@link SkillPatchRecorder} for the injectable service built on this contract.
 * @category services
 * @since 0.0.0
 */
export interface SkillPatchRecorderShape {
  /** Plan, or with the reviewed digest write, patches that record a hand edit of one vendored skill. */
  readonly add: (
    repoRoot: string,
    skill: string,
    expect: O.Option<string>
  ) => Effect.Effect<SkillPatchAddReceipt, SkillPatchRecorderFailure>;
  /** Plan, or with the reviewed digest write, patch labels taken from the hunk ledger. */
  readonly label: (
    repoRoot: string,
    skill: string,
    expect: O.Option<string>
  ) => Effect.Effect<SkillPatchLabelReceipt, SkillPatchRecorderFailure>;
}

/**
 * Injectable patch-series recorder: `patch add` and `patch label`.
 *
 * **Example** (Plan against a substituted recorder)
 *
 * ```ts
 * import { SkillPatchRecorder } from "@beep/repo-cli/commands/Skills/SkillsPatch.service"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * const refusing = Layer.succeed(
 *   SkillPatchRecorder,
 *   SkillPatchRecorder.of({
 *     add: () => Effect.die("not used"),
 *     label: () => Effect.die("not used"),
 *   })
 * )
 *
 * const program = Effect.gen(function* () {
 *   const recorder = yield* SkillPatchRecorder
 *   return typeof recorder.add
 * })
 *
 * console.log(Effect.runSync(Effect.provide(program, refusing))) // "function"
 * ```
 *
 * @see {@link SkillPatchRecorderLive} for the layer backed by pinned GitHub content.
 * @category services
 * @since 0.0.0
 */
export class SkillPatchRecorder extends Context.Service<SkillPatchRecorder, SkillPatchRecorderShape>()(
  $I`SkillPatchRecorder`
) {}

const makeSkillPatchRecorder = Effect.gen(function* () {
  const runtimeContext = yield* Effect.context<PatchRequirements>();
  return SkillPatchRecorder.of({
    add: Effect.fn("SkillPatchRecorder.add")(function* (repoRoot, skill, expect) {
      return yield* addPatch(repoRoot, skill, expect).pipe(Effect.provide(runtimeContext));
    }),
    label: Effect.fn("SkillPatchRecorder.label")(function* (repoRoot, skill, expect) {
      return yield* labelPatches(repoRoot, skill, expect).pipe(Effect.provide(runtimeContext));
    }),
  });
}).pipe(Effect.withSpan("SkillPatchRecorder.make"));

/**
 * Patch recorder layer that leaves the upstream-content and owner sources open.
 *
 * **When to use**
 *
 * Use when the pristine tree or the CODEOWNERS owners should come from
 * somewhere other than GitHub and `origin/main`, such as fixtures in a test.
 *
 * **Example** (Close the layer over offline sources)
 *
 * ```ts
 * import { SkillPatchOwnerSource, skillPatchOwnerSourceFromCodeowners } from "@beep/repo-cli/commands/Skills/Skills.patches"
 * import { SkillPathHistory, SkillUpstreamContent } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import { SkillUpstreamContentSource } from "@beep/repo-cli/commands/Skills/Skills.service"
 * import { SkillPatchRecorderLayer } from "@beep/repo-cli/commands/Skills/SkillsPatch.service"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as S from "effect/Schema"
 *
 * const offline = Layer.mergeAll(
 *   Layer.succeed(
 *     SkillUpstreamContentSource,
 *     SkillUpstreamContentSource.of({
 *       load: () => Effect.succeed(SkillUpstreamContent.make({ files: [], licenseBytes: new Uint8Array() })),
 *       listPathHistory: () =>
 *         Effect.orDie(
 *           S.decodeEffect(SkillPathHistory)({
 *             revisions: ["0123456789abcdef0123456789abcdef01234567"],
 *             truncated: false,
 *           })
 *         ),
 *     })
 *   ),
 *   Layer.succeed(SkillPatchOwnerSource, skillPatchOwnerSourceFromCodeowners("* @kriegcloud\n"))
 * )
 *
 * console.log(Layer.isLayer(SkillPatchRecorderLayer.pipe(Layer.provide(offline)))) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const SkillPatchRecorderLayer = Layer.effect(SkillPatchRecorder, makeSkillPatchRecorder);

/**
 * Live patch recorder backed by pinned GitHub content and `origin/main` CODEOWNERS.
 *
 * **Example** (Supply the HTTP client the live source needs)
 *
 * ```ts
 * import { SkillPatchRecorderLive } from "@beep/repo-cli/commands/Skills/SkillsPatch.service"
 * import * as Layer from "effect/Layer"
 * import * as FetchHttpClient from "effect/http/FetchHttpClient";
 * console.log(Layer.isLayer(SkillPatchRecorderLive.pipe(Layer.provide(FetchHttpClient.layer)))) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const SkillPatchRecorderLive = SkillPatchRecorderLayer.pipe(
  Layer.provide(Layer.mergeAll(SkillUpstreamContentSourceLive, SkillPatchOwnerSourceLive))
);
