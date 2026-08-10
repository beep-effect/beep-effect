/**
 * Detection for gate artifacts that predate the change they gate.
 *
 * A gate run *before* the change it gates is a vacuous proof, and its
 * transcript entry is indistinguishable from a real one. The lived instance:
 * `beep quality test-tsgo` exited 0, then new tests were written, then the gate
 * was never re-run — `vitest` stayed green because it does not typecheck, and
 * the publish proof failed on exactly the new lines. Nothing in the green
 * recorded *which tree* it had been established against.
 *
 * **Details**
 *
 * The generalizable fix is to make a gate result carry provenance, and the
 * cheapest honest provenance a cached artifact already has is its modification
 * time. This module compares each cached gate artifact against the newest file
 * this branch changed: an artifact older than the branch's newest edit cannot
 * have observed that edit, whatever its contents claim.
 *
 * **Gotchas**
 *
 * Freshness here is necessary, not sufficient. An artifact newer than every
 * changed file *may* still have been produced by a run that skipped the gate;
 * this catches the ordering failure, not every vacuous proof. It is a warning
 * surface for that reason, and a stale verdict names the command that
 * regenerates it rather than guessing at intent.
 *
 * The comparison set is the branch's changed files rather than the whole source
 * tree, which keeps the check bounded by the size of the diff and targets the
 * actual failure: a gate that ran before *this branch's* edits landed.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Effect, FileSystem, Order, Path, pipe } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { sortedUniquePaths } from "../../../internal/repo-run/index.ts";
import { GOALS_DOCTOR_BASELINE_PATH } from "../../Goals/Doctor.ts";
import {
  coverageRegressionBaselinePath,
  coverageRegressionRegenerationCommand,
} from "../../Quality/internal/CoverageRegression.ts";
import {
  defaultJSDocTotalsBaselinePath,
  jsdocInventoryRegenerationCommand,
  jsdocTotalsSnapshotCommand,
} from "../../Quality/internal/JSDocRatchet.ts";
import {
  collectStagedPublishPaths,
  collectUnstagedTrackedPaths,
  collectUntrackedPaths,
  runGitPathList,
} from "./GitExec.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { RepoRunContext } from "../../../internal/repo-run/index.ts";
import type { YeetCommandError } from "../Yeet.errors.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/GateStaleness");

/**
 * The kinds of cached artifact a verification gate can leave behind.
 *
 * **Details**
 *
 * The kind is what the operator needs to know to judge a stale verdict: a
 * stale `baseline` means a ratchet was compared against pre-change numbers,
 * while a stale `inventory` means a generated report describes an older tree.
 *
 * **Example** (List the tracked artifact kinds)
 *
 * ```ts
 * import { GateArtifactKind } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(GateArtifactKind.Options)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GateArtifactKind = LiteralKit(["baseline", "inventory", "manifest", "snapshot", "tsbuildinfo"]).pipe(
  $I.annoteSchema("GateArtifactKind", {
    title: "Gate Artifact Kind",
    description: "The kind of cached artifact one verification gate leaves behind.",
  })
);

/**
 * The kinds of cached artifact a verification gate can leave behind.
 *
 * @category type-level
 * @since 0.0.0
 */
export type GateArtifactKind = typeof GateArtifactKind.Type;

/**
 * One file observed on disk with the modification time it carried.
 *
 * **Example** (Witness one artifact)
 *
 * ```ts
 * import { GateFileWitness } from "@beep/repo-cli/test/Yeet"
 *
 * const witness = GateFileWitness.make({ modifiedAtMs: 1_700_000_000_000, path: "standards/coverage.regression-baseline.jsonc" })
 * console.log(witness.path)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GateFileWitness extends S.Class<GateFileWitness>($I`GateFileWitness`)(
  {
    modifiedAtMs: S.Finite,
    path: S.String,
  },
  $I.annote("GateFileWitness", {
    description: "One file observed on disk with the modification time it carried.",
  })
) {}

/**
 * A cached gate artifact and the command that regenerates it.
 *
 * **Example** (Describe one gated artifact)
 *
 * ```ts
 * import { GateArtifactDescriptor } from "@beep/repo-cli/test/Yeet"
 *
 * const descriptor = GateArtifactDescriptor.make({
 *   artifactPath: "standards/coverage.regression-baseline.jsonc",
 *   gateId: "coverage-regression",
 *   kind: "baseline",
 *   regenerateCommand: "bun run beep quality coverage --write-baseline",
 * })
 * console.log(descriptor.gateId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GateArtifactDescriptor extends S.Class<GateArtifactDescriptor>($I`GateArtifactDescriptor`)(
  {
    artifactPath: S.NonEmptyString,
    gateId: S.NonEmptyString,
    kind: GateArtifactKind,
    regenerateCommand: S.NonEmptyString,
  },
  $I.annote("GateArtifactDescriptor", {
    description: "One cached verification-gate artifact paired with the command that regenerates it.",
  })
) {}

/**
 * A gate artifact newer than every file this branch changed.
 *
 * @category models
 * @since 0.0.0
 */
export class GateFresh extends S.Class<GateFresh>($I`GateFresh`)(
  {
    status: S.tag("fresh"),
    gateId: S.NonEmptyString,
  },
  $I.annote("GateFresh", {
    description: "A gate artifact at least as new as every file this branch changed.",
  })
) {}

/**
 * A gate artifact that predates a file this branch changed.
 *
 * @category models
 * @since 0.0.0
 */
export class GateStale extends S.Class<GateStale>($I`GateStale`)(
  {
    status: S.tag("stale"),
    gateId: S.NonEmptyString,
    artifactPath: S.NonEmptyString,
    kind: GateArtifactKind,
    newestInputPath: S.NonEmptyString,
    regenerateCommand: S.NonEmptyString,
    skewMs: S.Finite,
  },
  $I.annote("GateStale", {
    description: "A gate artifact older than the newest file this branch changed, so it cannot have observed it.",
  })
) {}

/**
 * A gate whose freshness could not be established either way.
 *
 * **Details**
 *
 * Two different absences land here and both are honest non-answers: the
 * artifact does not exist yet (nothing has been proven, so nothing is stale),
 * and the branch changed nothing observable (no input to be older than).
 *
 * @category models
 * @since 0.0.0
 */
export class GateUnproven extends S.Class<GateUnproven>($I`GateUnproven`)(
  {
    status: S.tag("unproven"),
    gateId: S.NonEmptyString,
    detail: S.String,
  },
  $I.annote("GateUnproven", {
    description: "A gate whose freshness could not be established because the artifact or the inputs are absent.",
  })
) {}

/**
 * What the staleness check concluded about one gate artifact.
 *
 * **Example** (Decode a stale verdict)
 *
 * ```ts
 * import { GateStalenessVerdict } from "@beep/repo-cli/test/Yeet"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownOption(GateStalenessVerdict)({
 *   status: "unproven",
 *   gateId: "coverage-regression",
 *   detail: "artifact not found",
 * })
 * console.log(decoded)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GateStalenessVerdict = S.Union([GateFresh, GateStale, GateUnproven]).pipe(
  S.toTaggedUnion("status"),
  $I.annoteSchema("GateStalenessVerdict", {
    description: "What the gate-staleness check concluded about one cached verification artifact.",
  })
);

/**
 * What the staleness check concluded about one gate artifact.
 *
 * @category type-level
 * @since 0.0.0
 */
export type GateStalenessVerdict = typeof GateStalenessVerdict.Type;

const isGateStale = S.is(GateStale);
const isGateUnproven = S.is(GateUnproven);

/**
 * The cached gate artifacts yeet knows how to judge for staleness.
 *
 * **Details**
 *
 * Every entry is a committed or generated artifact a repo gate *reads* on a
 * later run, which is what makes an out-of-date copy a false green rather than
 * a harmless stale file. Paths come from the constants their owning gates
 * already export, so a gate that moves its artifact moves this catalog with it.
 *
 * **Example** (Count the tracked gate artifacts)
 *
 * ```ts
 * import { YEET_GATE_ARTIFACT_DESCRIPTORS } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YEET_GATE_ARTIFACT_DESCRIPTORS.length > 0)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const YEET_GATE_ARTIFACT_DESCRIPTORS: ReadonlyArray<GateArtifactDescriptor> = [
  GateArtifactDescriptor.make({
    artifactPath: coverageRegressionBaselinePath,
    gateId: "coverage-regression",
    kind: "baseline",
    regenerateCommand: coverageRegressionRegenerationCommand,
  }),
  GateArtifactDescriptor.make({
    artifactPath: defaultJSDocTotalsBaselinePath,
    gateId: "jsdoc-totals-ratchet",
    kind: "baseline",
    regenerateCommand: `${jsdocInventoryRegenerationCommand} && ${jsdocTotalsSnapshotCommand}`,
  }),
  GateArtifactDescriptor.make({
    artifactPath: "standards/knip.regression-baseline.jsonc",
    gateId: "knip-ratchet",
    kind: "baseline",
    regenerateCommand: "bun run beep quality knip --write-baseline",
  }),
  GateArtifactDescriptor.make({
    artifactPath: "standards/test-typecheck.blindspot-baseline.jsonc",
    gateId: "test-typecheck-blindspot",
    kind: "baseline",
    regenerateCommand: "bun run beep lint package-test-typecheck --write-baseline",
  }),
  GateArtifactDescriptor.make({
    artifactPath: GOALS_DOCTOR_BASELINE_PATH,
    gateId: "goals-doctor",
    kind: "baseline",
    regenerateCommand: "bun run beep goals doctor --write-baseline",
  }),
  GateArtifactDescriptor.make({
    artifactPath: ".beep/ci/jsdoc-documentation.inventory.jsonc",
    gateId: "jsdoc-documentation-inventory",
    kind: "inventory",
    regenerateCommand: "bun run beep ci lane jsdoc-inventory",
  }),
];

/**
 * Judge one gate artifact against the newest file this branch changed.
 *
 * **Details**
 *
 * An artifact strictly older than an input cannot have observed that input, so
 * that is the whole rule. Equal timestamps count as fresh: a gate that writes
 * its artifact in the same clock tick as the edit it consumed is the ordinary
 * regenerate-after-edit case, and filesystem timestamp granularity is coarse
 * enough that punishing ties would report constant false staleness.
 *
 * **Example** (Judge an artifact older than the change)
 *
 * ```ts
 * import { assessGateStaleness, GateArtifactDescriptor, GateFileWitness } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const descriptor = GateArtifactDescriptor.make({
 *   artifactPath: "standards/coverage.regression-baseline.jsonc",
 *   gateId: "coverage-regression",
 *   kind: "baseline",
 *   regenerateCommand: "bun run beep quality coverage",
 * })
 * const verdict = assessGateStaleness(
 *   descriptor,
 *   O.some(GateFileWitness.make({ modifiedAtMs: 1_000, path: descriptor.artifactPath })),
 *   O.some(GateFileWitness.make({ modifiedAtMs: 2_000, path: "packages/x/src/X.ts" }))
 * )
 * console.log(verdict.status)
 * ```
 *
 * @param descriptor - The gate artifact being judged.
 * @param artifact - The artifact as observed on disk, when it exists.
 * @param newestInput - The newest file this branch changed, when there is one.
 * @returns Whether the artifact predates the change it gates.
 * @category detection
 * @since 0.0.0
 */
export const assessGateStaleness: {
  (
    artifact: O.Option<GateFileWitness>,
    newestInput: O.Option<GateFileWitness>
  ): (descriptor: GateArtifactDescriptor) => GateStalenessVerdict;
  (
    descriptor: GateArtifactDescriptor,
    artifact: O.Option<GateFileWitness>,
    newestInput: O.Option<GateFileWitness>
  ): GateStalenessVerdict;
} = dual(
  3,
  (
    descriptor: GateArtifactDescriptor,
    artifact: O.Option<GateFileWitness>,
    newestInput: O.Option<GateFileWitness>
  ): GateStalenessVerdict => {
    if (O.isNone(artifact)) {
      return GateUnproven.make({ detail: `${descriptor.artifactPath} does not exist`, gateId: descriptor.gateId });
    }
    if (O.isNone(newestInput)) {
      return GateUnproven.make({ detail: "no changed files to compare against", gateId: descriptor.gateId });
    }
    const skewMs = newestInput.value.modifiedAtMs - artifact.value.modifiedAtMs;
    return skewMs > 0
      ? GateStale.make({
          artifactPath: descriptor.artifactPath,
          gateId: descriptor.gateId,
          kind: descriptor.kind,
          newestInputPath: newestInput.value.path,
          regenerateCommand: descriptor.regenerateCommand,
          skewMs,
        })
      : GateFresh.make({ gateId: descriptor.gateId });
  }
);

/**
 * Keep only the verdicts that name a real problem.
 *
 * **Example** (Filter a verdict list)
 *
 * ```ts
 * import { GateFresh, staleGateVerdicts } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(staleGateVerdicts([GateFresh.make({ gateId: "coverage-regression" })]).length)
 * ```
 *
 * @param verdicts - Every verdict produced by one staleness pass.
 * @returns Only the stale verdicts, in the order they were produced.
 * @category detection
 * @since 0.0.0
 */
export const staleGateVerdicts = (verdicts: ReadonlyArray<GateStalenessVerdict>): ReadonlyArray<GateStale> =>
  A.filter(verdicts, isGateStale);

/**
 * Keep only verdicts whose proof artifact or comparison input is absent.
 *
 * **Example** (Filter an unproven verdict)
 *
 * ```ts
 * import { GateUnproven, unprovenGateVerdicts } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(unprovenGateVerdicts([GateUnproven.make({ gateId: "coverage-regression", detail: "artifact not found" })]).length)
 * ```
 *
 * @param verdicts - Every verdict produced by one staleness pass.
 * @returns Only unproven verdicts, in the order they were produced.
 * @category detection
 * @since 0.0.0
 */
export const unprovenGateVerdicts = (verdicts: ReadonlyArray<GateStalenessVerdict>): ReadonlyArray<GateUnproven> =>
  A.filter(verdicts, isGateUnproven);

/**
 * Render the gate-staleness line of a yeet status summary.
 *
 * **Details**
 *
 * A clean pass renders one line rather than nothing, because "the check ran and
 * found nothing" and "the check never ran" must not look identical — that is
 * the same absence-of-provenance failure this module exists to catch.
 *
 * **Example** (Render a clean pass)
 *
 * ```ts
 * import { renderYeetGateStalenessBlock } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(renderYeetGateStalenessBlock([], []))
 * ```
 *
 * @param stale - Stale verdicts from one staleness pass.
 * @param unproven - Verdicts whose proof artifact or comparison input is absent.
 * @returns The `gate staleness:` line plus one indented line per stale gate.
 * @category formatting
 * @since 0.0.0
 */
export const renderYeetGateStalenessBlock: {
  (unproven: ReadonlyArray<GateUnproven>): (stale: ReadonlyArray<GateStale>) => string;
  (stale: ReadonlyArray<GateStale>, unproven: ReadonlyArray<GateUnproven>): string;
} = dual(2, (stale: ReadonlyArray<GateStale>, unproven: ReadonlyArray<GateUnproven>): string =>
  A.isReadonlyArrayEmpty(stale) && A.isReadonlyArrayEmpty(unproven)
    ? "gate staleness: none"
    : A.join(
        [
          `gate staleness: ${A.length(stale)} stale, ${A.length(unproven)} unproven`,
          ...A.map(
            stale,
            (verdict) =>
              `  - ${verdict.gateId} (${verdict.kind}): ${verdict.artifactPath} is older than ${verdict.newestInputPath}; regenerate with \`${verdict.regenerateCommand}\``
          ),
          ...A.map(unproven, (verdict) => `  - ${verdict.gateId} (unproven): ${verdict.detail}`),
        ],
        "\n"
      )
);

const witnessOrder = Order.mapInput(Order.Number, (witness: GateFileWitness) => witness.modifiedAtMs);

const witnessFile = Effect.fn("Yeet.witnessGateFile")(function* (
  repoRoot: string,
  relativePath: string
): Effect.fn.Return<O.Option<GateFileWitness>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const info = yield* fs
    .stat(path.isAbsolute(relativePath) ? relativePath : path.join(repoRoot, relativePath))
    .pipe(Effect.map(O.some), Effect.orElseSucceed(O.none<FileSystem.File.Info>));
  return pipe(
    info,
    O.flatMap((value) => value.mtime),
    O.map((mtime) => GateFileWitness.make({ modifiedAtMs: mtime.getTime(), path: relativePath }))
  );
});

/**
 * Collect every file this branch changed, committed or not.
 *
 * **Details**
 *
 * Committed range plus staged, unstaged, and untracked paths. The uncommitted
 * arms matter most: the lived failure was a gate run against a tree that did
 * not yet contain the new test files, which existed only in the worktree.
 *
 * @param context - Repo context supplying the base range and worktree root.
 * @returns Deduplicated repo-relative paths this branch touched.
 * @category diagnostics
 * @since 0.0.0
 */
export const collectYeetGateInputPaths = Effect.fn("Yeet.collectYeetGateInputPaths")(function* (
  context: RepoRunContext
): Effect.fn.Return<ReadonlyArray<string>, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const committed = yield* runGitPathList(context.repoRoot, [
    "diff",
    "--name-only",
    "-z",
    `${context.base}...${context.head}`,
  ]).pipe(Effect.orElseSucceed(A.empty<string>));
  const staged = yield* collectStagedPublishPaths(context.repoRoot).pipe(Effect.orElseSucceed(A.empty<string>));
  const unstaged = yield* collectUnstagedTrackedPaths(context.repoRoot).pipe(Effect.orElseSucceed(A.empty<string>));
  const untracked = yield* collectUntrackedPaths(context.repoRoot).pipe(Effect.orElseSucceed(A.empty<string>));
  return sortedUniquePaths([...committed, ...staged, ...unstaged, ...untracked]);
});

/**
 * Judge every known gate artifact against this branch's newest change.
 *
 * **When to use**
 *
 * Use from any surface that reports whether a green is trustworthy — yeet
 * status today, a preflight battery next. It reads the filesystem only, so it
 * costs a stat per changed file and per catalogued artifact.
 *
 * **Gotchas**
 *
 * Artifacts this branch itself changed are excluded from the input set before
 * the comparison, because a regenerated baseline is both an artifact and a
 * changed file and would otherwise be reported as stale against itself.
 *
 * **Example** (Collect staleness through the test seam)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { collectYeetGateStaleness, RepoRunContext } from "@beep/repo-cli/test/Yeet"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/widgets",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 *
 * const stale = collectYeetGateStaleness(context).pipe(Effect.map((verdicts) => verdicts.length))
 * ```
 *
 * @param context - Repo context whose branch supplies the changed-file set.
 * @returns One verdict per catalogued gate artifact.
 * @category diagnostics
 * @since 0.0.0
 */
export const collectYeetGateStaleness = Effect.fn("Yeet.collectYeetGateStaleness")(function* (
  context: RepoRunContext
): Effect.fn.Return<
  ReadonlyArray<GateStalenessVerdict>,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const artifactPaths = A.map(YEET_GATE_ARTIFACT_DESCRIPTORS, (descriptor) => descriptor.artifactPath);
  const inputPaths = yield* collectYeetGateInputPaths(context).pipe(
    Effect.map(A.filter((candidate) => !A.contains(artifactPaths, candidate)))
  );
  const inputWitnesses = yield* Effect.forEach(inputPaths, (candidate) => witnessFile(context.repoRoot, candidate), {
    concurrency: 8,
  });
  const newestInput = pipe(A.getSomes(inputWitnesses), A.sort(witnessOrder), A.last);
  return yield* Effect.forEach(
    YEET_GATE_ARTIFACT_DESCRIPTORS,
    Effect.fnUntraced(function* (descriptor: GateArtifactDescriptor) {
      const artifact = yield* witnessFile(context.repoRoot, descriptor.artifactPath);
      return assessGateStaleness(descriptor, artifact, newestInput);
    }),
    { concurrency: 4 }
  );
});
