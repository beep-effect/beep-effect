/**
 * Complete package deletion and registration-residue doctor command.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { DomainError, decodePackageJsonEffect, findRepoRoot, resolveWorkspaceDirs } from "@beep/repo-utils";
import { normalizePath } from "@beep/schema";
import { PosixPath } from "@beep/schema/PosixPath";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { A, Str, thunkFalse } from "@beep/utils";
import { Config, Console, Effect, FileSystem, Path, pipe } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { Argument, Command, Flag } from "effect/unstable/cli";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { applyJsoncModification } from "../../internal/cli/Jsonc.ts";
import { decodeLabManifestJson, isLabsWorkspacePath, LAB_MANIFEST_FILENAME } from "../../internal/cli/Labs/index.ts";
import {
  DeletionNotePolicy,
  LabTargetFacts,
  makeRegistrationGeometryService,
  RegistrationSurface,
  RegistrationTarget,
  surfacesForTarget,
} from "../../internal/cli/RegistrationGeometry/index.ts";
import { runToExit } from "../../internal/process/index.ts";
import { CreatePackageIdentityRegistration } from "../CreatePackage/internal/IdentityRegistration.ts";
import { LabIdentitySegment } from "../CreatePackage/internal/LabIdentitySegment.ts";
import { changesetPackageReferencesFromText } from "../Quality/ChangesetGraph.ts";
import { subtractPackageFromCoverageRegressionBaseline } from "../Quality/internal/CoverageRegression.ts";
import { syncTsconfigAtRoot } from "../TsconfigSync/index.ts";
import { DeletePackagePolicyEvaluation } from "./DeletePackage.policy.ts";
import {
  BaselineOutputStamp,
  BaselineStepOutcome,
  BaselineWriterExitPolicy,
  BaselineWriterStep,
  DeletePackageManifest,
  DeletePackagePolicy,
} from "./DeletePackage.schemas.ts";
import { DeletePackageDataResource } from "./internal/DataResource.ts";
import { renderCanonicalDeletionChangeset } from "./internal/DeletionChangeset.ts";
import type {
  DependentsReport,
  RegistrationGeometryServiceShape,
  RegistrationObservation,
  RegistrationPlan,
} from "../../internal/cli/RegistrationGeometry/index.ts";

const $I = $RepoCliId.create("commands/DeletePackage");
const RETIRED_REGISTRY_PATH = "standards/changesets.retired-packages.json";
const IDENTITY_SHAPE_TEST_PATH = "packages/foundation/modeling/identity/test/shape-stable.test.ts";

class ResolvedDeleteTarget extends S.Class<ResolvedDeleteTarget>($I`ResolvedDeleteTarget`)(
  {
    target: RegistrationTarget,
    liveWorkspace: S.Boolean,
    workspacePaths: S.Array(PosixPath),
  },
  $I.annote("ResolvedDeleteTarget", {
    description: "A live workspace target or deleted-target doctor probe with the resolved workspace path inventory.",
  })
) {}

const packageNameForInput = (input: string): string =>
  Str.startsWith("@beep/")(input)
    ? input
    : `@beep/${pipe(
        input,
        Str.split("/"),
        A.last,
        O.getOrElse(() => input)
      )}`;

const decodeManifest = Effect.fn("DeletePackage.decodeManifest")(function* (file: string, content: string) {
  return yield* S.decodeEffect(S.fromJsonString(DeletePackageManifest))(content).pipe(
    Effect.mapError(DomainError.newCause(`Failed to decode package manifest at ${file}.`))
  );
});

const SKIPPED_WALK_ENTRIES = ["node_modules", ".beep", ".turbo", "dist", "coverage", "docs", ".next", "target"];

const findDeletedTargetPath = Effect.fn("DeletePackage.findDeletedTargetPath")(function* (
  repoRoot: string,
  slug: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const walkEntry = Effect.fn("DeletePackage.findDeletedTargetPath.walkEntry")(function* (
    directory: string,
    entry: string
  ): Effect.fn.Return<O.Option<string>, never, FileSystem.FileSystem | Path.Path> {
    if (A.some(SKIPPED_WALK_ENTRIES, Str.equivalence(entry))) return O.none();
    const child = path.join(directory, entry);
    const stat = yield* fs.stat(child).pipe(Effect.option);
    if (O.isNone(stat) || stat.value.type !== "Directory") return O.none();
    return yield* walk(child);
  });
  const walk = Effect.fn("DeletePackage.findDeletedTargetPath.walk")(function* (
    directory: string
  ): Effect.fn.Return<O.Option<string>, never, FileSystem.FileSystem | Path.Path> {
    const exists = yield* fs.exists(directory).pipe(Effect.orElseSucceed(thunkFalse));
    if (!exists) return O.none();
    if (Str.equivalence(path.basename(directory), slug))
      return O.some(normalizePath(path.relative(repoRoot, directory)));
    const entries = yield* fs.readDirectory(directory).pipe(Effect.orElseSucceed(A.empty<string>));
    for (const entry of entries) {
      const found = yield* walkEntry(directory, entry);
      if (O.isSome(found)) return found;
    }
    return O.none();
  });

  for (const root of ["packages", "apps"]) {
    const found = yield* walk(path.join(repoRoot, root));
    if (O.isSome(found)) return found;
  }
  return O.none<string>();
});

// P2-D18: a labs directory with a missing or corrupt lab.manifest.json WARNS
// and proceeds with no lab facts in BOTH check and apply modes, so
// delete-package stays the cheap escape valve for half-created labs.
const resolveLabFacts = Effect.fn("DeletePackage.resolveLabFacts")(function* (repoRoot: string, relativeDir: string) {
  if (!isLabsWorkspacePath(relativeDir)) return O.none<LabTargetFacts>();
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const manifestFile = `${relativeDir}/${LAB_MANIFEST_FILENAME}`;
  const decoded = yield* fs
    .readFileString(path.join(repoRoot, manifestFile))
    .pipe(Effect.flatMap(decodeLabManifestJson), Effect.option);
  return yield* O.match(decoded, {
    onNone: () =>
      Console.error(
        `[delete-package] warning: ${manifestFile} is missing or invalid; continuing without lab manifest facts.`
      ).pipe(Effect.as(O.none<LabTargetFacts>())),
    onSome: (labManifest) =>
      Effect.succeedSome(
        LabTargetFacts.make({
          manifestFile: PosixPath.make(manifestFile),
          postgresSchema: labManifest.postgresSchema,
          localOnly: true,
        })
      ),
  });
});

const resolveDeleteTarget = Effect.fn("DeletePackage.resolveTarget")(function* (
  repoRoot: string,
  input: string,
  doctor: boolean
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const normalizedInput = normalizePath(input);
  const requestedName = packageNameForInput(input);
  const workspaces = A.fromIterable(yield* resolveWorkspaceDirs(repoRoot));
  const workspacePaths = A.map(workspaces, ([, dir]) => normalizePath(path.relative(repoRoot, dir)));
  const match = A.findFirst(
    workspaces,
    ([name, dir]) =>
      Str.equivalence(name, requestedName) ||
      Str.equivalence(normalizePath(path.relative(repoRoot, dir)), normalizedInput)
  );

  if (O.isSome(match)) {
    const [name, dir] = match.value;
    const relativeDir = normalizePath(path.relative(repoRoot, dir));
    const manifestPath = path.join(dir, "package.json");
    const manifest = yield* fs
      .readFileString(manifestPath)
      .pipe(Effect.flatMap((content) => decodeManifest(manifestPath, content)));
    const lab = yield* resolveLabFacts(repoRoot, relativeDir);
    return ResolvedDeleteTarget.make({
      target: RegistrationTarget.make({
        packageName: name,
        packagePath: relativeDir,
        private: manifest.private !== false,
        lab,
      }),
      liveWorkspace: true,
      workspacePaths,
    });
  }

  if (!doctor) return yield* DomainError.newMessage(`No workspace matches "${input}".`);
  const slug = pipe(requestedName, Str.replace("@beep/", Str.empty));
  const discoveredDeletedPath = Str.includes("/")(normalizedInput)
    ? O.some(normalizedInput)
    : yield* findDeletedTargetPath(repoRoot, slug);
  const inferredPath = pipe(
    discoveredDeletedPath,
    O.getOrElse(() => slug)
  );
  return ResolvedDeleteTarget.make({
    target: RegistrationTarget.make({
      packageName: requestedName,
      packagePath: normalizePath(inferredPath),
      private: true,
    }),
    liveWorkspace: false,
    workspacePaths,
  });
});

const workspacePathsAtRoot = Effect.fn("DeletePackage.workspacePathsAtRoot")(function* (repoRoot: string) {
  const path = yield* Path.Path;
  const workspaces = A.fromIterable(yield* resolveWorkspaceDirs(repoRoot));
  return A.map(workspaces, ([, directory]) => normalizePath(path.relative(repoRoot, directory)));
});

const enforceOwnedTreeTargetPolicy = Effect.fn("DeletePackage.enforceOwnedTreeTargetPolicy")(function* (
  target: RegistrationTarget,
  workspacePaths: ReadonlyArray<string>
) {
  const refusal = DeletePackagePolicyEvaluation.ownedTreeRefusal(target, workspacePaths);
  if (O.isNone(refusal)) return;
  yield* Console.error(
    `[delete-package] REFUSE [${refusal.value.kind}/${refusal.value.severity}] ${refusal.value.detail}`
  );
  return yield* failWithReportedExit("delete-package: target path refused.");
});

const printPlan = Effect.fn("DeletePackage.printPlan")(function* (
  plan: RegistrationPlan,
  report: DependentsReport,
  prefix: string
) {
  yield* Console.log(`${prefix} Package: ${plan.target.packageName}`);
  yield* Console.log(`${prefix} Path: ${plan.target.packagePath}`);
  yield* Console.log(`${prefix} Dependents cascade:`);
  yield* Console.log(
    `  direct: ${A.isReadonlyArrayNonEmpty(report.directWorkspaceDependents) ? A.join(report.directWorkspaceDependents, ", ") : "(none)"}`
  );
  yield* Console.log(
    `  transitive: ${A.isReadonlyArrayNonEmpty(report.transitiveWorkspaceDependents) ? A.join(report.transitiveWorkspaceDependents, ", ") : "(none)"}`
  );
  for (const hit of report.hits) {
    yield* Console.log(
      `  - ${hit.kind}: ${hit.owner} ${hit.file}${pipe(
        hit.line,
        O.map((line) => `:${line}`),
        O.getOrElse(() => Str.empty)
      )}`
    );
  }
  yield* Console.log(`${prefix} Inverse plan ${plan.version}:`);
  for (const operation of plan.operations) {
    yield* Console.log(`  - [${operation.operation}] ${operation.surfaceId}: ${operation.detail}`);
  }
});

const isStringArray = (value: unknown): value is ReadonlyArray<string> =>
  A.isArray(value) && A.every(value, P.isString);

const workspaceLiteralJsonPath = (workspaces: unknown, packagePath: string): ReadonlyArray<string | number> => {
  if (isStringArray(workspaces)) {
    return pipe(
      A.findFirstIndex(workspaces, Str.equivalence(packagePath)),
      O.map((index): ReadonlyArray<string | number> => ["workspaces", index]),
      O.getOrElse(A.empty<string | number>)
    );
  }
  if (P.isObject(workspaces) && P.hasProperty(workspaces, "packages") && isStringArray(workspaces.packages)) {
    return pipe(
      A.findFirstIndex(workspaces.packages, Str.equivalence(packagePath)),
      O.map((index): ReadonlyArray<string | number> => ["workspaces", "packages", index]),
      O.getOrElse(A.empty<string | number>)
    );
  }
  return A.empty<string | number>();
};

const removeWorkspaceLiteral = Effect.fn("DeletePackage.removeWorkspaceLiteral")(function* (
  repoRoot: string,
  packagePath: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const file = path.join(repoRoot, "package.json");
  const content = yield* fs.readFileString(file);
  const unknown = yield* UnknownFromJsonString.decodeEffect(content).pipe(
    Effect.mapError(DomainError.newCause(`Failed to parse ${file}.`))
  );
  const manifest = yield* decodePackageJsonEffect(unknown).pipe(
    Effect.mapError(DomainError.newCause(`Failed to decode ${file}.`))
  );
  const jsonPath = workspaceLiteralJsonPath(O.getOrUndefined(manifest.workspaces), packagePath);
  if (A.isReadonlyArrayNonEmpty(jsonPath)) {
    yield* fs.writeFileString(file, applyJsoncModification({ content, path: jsonPath, value: undefined }));
  }
});

const removeShapeTestRow = Effect.fn("DeletePackage.removeShapeTestRow")(function* (
  repoRoot: string,
  packageName: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const file = path.join(repoRoot, IDENTITY_SHAPE_TEST_PATH);
  const exists = yield* fs.exists(file).pipe(Effect.orElseSucceed(thunkFalse));
  if (!exists) return;
  const accessor = CreatePackageIdentityRegistration.toIdentityAccessorName(
    pipe(packageName, Str.replace("@beep/", Str.empty))
  );
  const content = yield* fs.readFileString(file);
  const next = pipe(
    content,
    Str.split("\n"),
    A.filter((line) => !Str.includes(accessor)(line)),
    A.join("\n")
  );
  if (!Str.equivalence(content, next)) yield* fs.writeFileString(file, next);
});

const stripPackageFromFrontmatter = (content: string, packageName: string): string => {
  let inFrontmatter = false;
  let boundaryCount = 0;
  const nextLines = A.filter(Str.split("\n")(content), (line) => {
    if (Str.equivalence(Str.trim(line), "---")) {
      boundaryCount += 1;
      inFrontmatter = boundaryCount === 1;
      return true;
    }
    if (boundaryCount === 2) inFrontmatter = false;
    return !(inFrontmatter && Str.includes(packageName)(line));
  });
  return A.join(nextLines, "\n");
};

const pruneChangesetFile = Effect.fn("DeletePackage.pruneChangesetFile")(function* (
  repoRoot: string,
  file: string,
  packageName: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const content = yield* fs.readFileString(file);
  const references = yield* changesetPackageReferencesFromText(normalizePath(path.relative(repoRoot, file)), content);
  if (!A.some(references, (reference) => Str.equivalence(reference.packageName, packageName))) return;
  if (A.length(references) === 1) {
    yield* fs.remove(file, { force: true });
    return;
  }
  yield* fs.writeFileString(file, stripPackageFromFrontmatter(content, packageName));
});

/**
 * Prune pending changesets naming the package, then emit the canonical `{}`
 * deletion note — or skip the note entirely under the labs-exempt policy.
 *
 * **Details**
 *
 * The prune loop is policy-independent: every other pending changeset naming
 * the package is deleted (single-package) or key-stripped (multi-package)
 * even for labs targets. Only the dedicated `delete-<slug>.md` deletion note
 * is gated by {@link DeletionNotePolicy}: labs deletions are ceremony-exempt
 * and emit no changeset.
 *
 * **Example** (Build a labs-exempt rewrite effect)
 *
 * ```ts
 * import { rewritePendingChangesets } from "@beep/repo-cli/commands/DeletePackage"
 * import { Effect } from "effect"
 *
 * const program = rewritePendingChangesets("/repo", "@beep/probe", "labs-exempt")
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const rewritePendingChangesets = Effect.fn("DeletePackage.rewritePendingChangesets")(function* (
  repoRoot: string,
  packageName: string,
  deletionNotePolicy: DeletionNotePolicy
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const changesetDir = path.join(repoRoot, ".changeset");
  const exists = yield* fs.exists(changesetDir).pipe(Effect.orElseSucceed(thunkFalse));
  if (!exists) return;
  const entries = yield* fs.readDirectory(changesetDir);
  for (const entry of entries) {
    if (!Str.endsWith(".md")(entry) || Str.equivalence(entry, "README.md")) continue;
    yield* pruneChangesetFile(repoRoot, path.join(changesetDir, entry), packageName);
  }

  const slug = pipe(packageName, Str.replace("@beep/", Str.empty));
  const deletionNote = path.join(changesetDir, `delete-${slug}.md`);
  yield* DeletionNotePolicy.$match(deletionNotePolicy, {
    "emit-empty-note": () => fs.writeFileString(deletionNote, renderCanonicalDeletionChangeset(packageName)),
    "labs-exempt": () => Effect.void,
  });
});

const runStep = Effect.fn("DeletePackage.runStep")(function* (
  repoRoot: string,
  label: string,
  command: string,
  args: ReadonlyArray<string>
) {
  yield* Console.log(`[delete-package] ${label}: ${command} ${A.join(args, " ")}`);
  const exitCode = yield* runToExit({ command, args, cwd: repoRoot, stdio: "inherit" }).pipe(
    Effect.mapError(DomainError.newCause(`Failed to spawn ${command}.`))
  );
  if (exitCode !== 0) return yield* DomainError.newMessage(`${label} failed with exit code ${exitCode}.`);
});

// Every writer stays zero-only except the fallow health baseline: fallow
// exposes no write-only mode and exits 1 on pre-existing findings even though
// the --save-baseline write succeeded (P1 round-trip proof), so that one step
// tolerates exit 1 iff its verified output was provably written. Exit >= 2 is
// a real fallow fault and always fails.
//
// The coverage baseline is deliberately NOT in this table. Its writer re-runs
// the repo-wide coverage suite (~12 minutes, and coupled to every test in the
// repo passing) to compute what is, for a leaf deletion, a pure row removal —
// so the delete path subtracts the target's rows schema-first instead
// (receipt 9, lab-apps-lifecycle).
const BASELINE_WRITER_STEPS: ReadonlyArray<BaselineWriterStep> = [
  BaselineWriterStep.make({ label: "fallow boundaries", args: ["run", "beep", "fallow", "boundaries", "--write"] }),
  BaselineWriterStep.make({
    label: "fallow health baseline",
    args: ["run", "fallow:health:baseline:write"],
    exitPolicy: "tolerate-finding-exit",
    verifiedOutput: O.some(PosixPath.make("standards/fallow.health.regression-baseline.jsonc")),
  }),
  BaselineWriterStep.make({ label: "fallow dead-code baseline", args: ["run", "fallow:dead-code:baseline:write"] }),
  BaselineWriterStep.make({ label: "JSDoc inventory pair", args: ["run", "beep", "quality", "jsdoc-inventory"] }),
  BaselineWriterStep.make({
    label: "schema-first inventory",
    args: ["run", "beep", "lint", "schema-first", "--write"],
  }),
  BaselineWriterStep.make({
    label: "test typecheck baseline",
    args: ["run", "beep", "lint", "package-test-typecheck", "--write-baseline"],
  }),
  BaselineWriterStep.make({ label: "schema catalog", args: ["run", "beep", "lint", "schema-catalog", "--write"] }),
  BaselineWriterStep.make({ label: "Knip baseline", args: ["run", "beep", "quality", "knip", "--write-baseline"] }),
];

const baselineOutputWritten = (before: O.Option<BaselineOutputStamp>, after: O.Option<BaselineOutputStamp>): boolean =>
  O.exists(after, (afterStamp) =>
    O.match(before, {
      onNone: () => true,
      onSome: (beforeStamp) =>
        beforeStamp.mtimeMillis !== afterStamp.mtimeMillis || beforeStamp.size !== afterStamp.size,
    })
  );

const baselineStepOutcome = (
  exitCode: number,
  exitPolicy: BaselineWriterExitPolicy,
  before: O.Option<BaselineOutputStamp>,
  after: O.Option<BaselineOutputStamp>
): BaselineStepOutcome => {
  if (exitCode === 0) return "ok";
  return BaselineWriterExitPolicy.$match(exitPolicy, {
    "zero-only": (): BaselineStepOutcome => "failed",
    "tolerate-finding-exit": (): BaselineStepOutcome =>
      exitCode === 1 && baselineOutputWritten(before, after) ? "tolerated" : "failed",
  });
};

const statBaselineOutput = Effect.fn("DeletePackage.statBaselineOutput")(function* (
  repoRoot: string,
  verifiedOutput: O.Option<string>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* O.match(verifiedOutput, {
    onNone: () => Effect.succeed(O.none<BaselineOutputStamp>()),
    onSome: (output) =>
      fs.stat(path.join(repoRoot, output)).pipe(
        Effect.option,
        Effect.map(
          O.map((info) =>
            BaselineOutputStamp.make({
              mtimeMillis: pipe(
                info.mtime,
                O.map((mtime) => mtime.getTime()),
                O.getOrElse(() => 0)
              ),
              size: Number(info.size),
            })
          )
        )
      ),
  });
});

const runBaselineWriters = Effect.fn("DeletePackage.runBaselineWriters")(function* (
  repoRoot: string,
  packageName: string
) {
  // Coverage first, and not as a shell step: the target's rows are removed
  // from the committed baseline in-process, which is what a repo-wide
  // regeneration would produce for a leaf target without the coverage rerun.
  yield* Console.log(`[delete-package] coverage baseline subtraction: ${packageName}`);
  yield* subtractPackageFromCoverageRegressionBaseline(repoRoot, packageName).pipe(
    Effect.mapError(DomainError.newCause("coverage baseline subtraction failed."))
  );
  for (const step of BASELINE_WRITER_STEPS) {
    yield* Console.log(`[delete-package] ${step.label}: bun ${A.join(step.args, " ")}`);
    const before = yield* statBaselineOutput(repoRoot, step.verifiedOutput);
    const exitCode = yield* runToExit({ command: "bun", args: step.args, cwd: repoRoot, stdio: "inherit" }).pipe(
      Effect.mapError(DomainError.newCause("Failed to spawn bun."))
    );
    const after = yield* statBaselineOutput(repoRoot, step.verifiedOutput);
    yield* BaselineStepOutcome.$match(baselineStepOutcome(exitCode, step.exitPolicy, before, after), {
      ok: () => Effect.void,
      tolerated: () =>
        Console.log(
          `[delete-package] ${step.label}: baseline written; pre-existing findings exit tolerated (exit ${exitCode}).`
        ),
      failed: () => DomainError.newMessage(`${step.label} failed with exit code ${exitCode}.`),
    });
  }
});

/**
 * Baseline-writer step table, the pure exit-outcome decision helper, and the
 * writer stage itself.
 *
 * **Details**
 *
 * `baselineStepOutcome` classifies one writer invocation: exit 0 is `ok`;
 * exit 1 under `tolerate-finding-exit` is `tolerated` only when the verified
 * output's `(mtime, size)` stamp changed or the file was created; everything
 * else — including every exit `>= 2` — is `failed`. `run` is the full writer
 * stage: coverage-baseline subtraction first, then the shell steps in table
 * order.
 *
 * **Example** (Classify a finding exit without a written baseline)
 *
 * ```ts
 * import { DeletePackageBaselineWriters } from "@beep/repo-cli/commands/DeletePackage"
 * import * as O from "effect/Option"
 *
 * const outcome = DeletePackageBaselineWriters.baselineStepOutcome(1, "tolerate-finding-exit", O.none(), O.none())
 * console.log(outcome) // "failed"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const DeletePackageBaselineWriters = {
  baselineStepOutcome,
  steps: BASELINE_WRITER_STEPS,
  run: runBaselineWriters,
} as const;

const invalidateCiMirrors = Effect.fn("DeletePackage.invalidateCiMirrors")(function* (repoRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  for (const file of ["jsdoc-documentation.inventory.jsonc", "jsdoc-documentation.inventory.md"]) {
    yield* fs.remove(path.join(repoRoot, ".beep", "ci", file), { force: true });
  }
});

const hasLivePromotionRecord = Effect.fn("DeletePackage.hasLivePromotionRecord")(function* (
  repoRoot: string,
  packagePath: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const file = path.join(repoRoot, packagePath, "README.md");
  const exists = yield* fs.exists(file).pipe(Effect.orElseSucceed(thunkFalse));
  if (!exists) return false;
  const content = yield* fs.readFileString(file).pipe(Effect.orElseSucceed(() => Str.empty));
  return Str.includes("promotion record")(Str.toLowerCase(content));
});

const hasRetiredCollision = Effect.fn("DeletePackage.hasRetiredCollision")(function* (
  repoRoot: string,
  packageName: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const file = path.join(repoRoot, RETIRED_REGISTRY_PATH);
  const exists = yield* fs.exists(file).pipe(Effect.orElseSucceed(thunkFalse));
  if (!exists) return false;
  const content = yield* fs.readFileString(file);
  return Str.includes(packageName)(content);
});

type DeletePackageHandlerOptions = {
  readonly target: string;
  readonly dryRun: boolean;
  readonly check: boolean;
  readonly skipLockfile: boolean;
  readonly skipBaselines: boolean;
  readonly retireChangesets: boolean;
  readonly identityMajor: boolean;
  readonly cascade: boolean;
  readonly also: string;
  readonly rewritePackets: boolean;
  readonly allowStalePackets: boolean;
  readonly allowPublished: boolean;
  readonly pruneCatalog: boolean;
  readonly force: boolean;
  readonly dropData: boolean;
  readonly allowNonLocalData: boolean;
};

const planPrintPrefix = (options: DeletePackageHandlerOptions): string =>
  options.dryRun ? "[dry-run]" : options.check ? "[check]" : "[delete-package]";

const assembleDeletePolicy = Effect.fn("DeletePackage.assembleDeletePolicy")(function* (
  repoRoot: string,
  resolved: ResolvedDeleteTarget,
  options: DeletePackageHandlerOptions
) {
  const inCi = yield* Config.boolean("CI").pipe(Config.withDefault(false));
  const retiredNameCollision =
    resolved.liveWorkspace && (yield* hasRetiredCollision(repoRoot, resolved.target.packageName));
  const livePromotionRecord =
    resolved.liveWorkspace && (yield* hasLivePromotionRecord(repoRoot, resolved.target.packagePath));
  const dataSurface = A.findFirst(surfacesForTarget(resolved.target), RegistrationSurface.guards["data-resource"]);
  const databaseUrl = yield* Config.string("DATABASE_URL").pipe(Config.option);
  const slug = pipe(resolved.target.packageName, Str.replace("@beep/", Str.empty));
  return DeletePackagePolicy.make({
    allowPublished: options.allowPublished,
    allowStalePackets: options.allowStalePackets,
    cascade: options.cascade,
    force: options.force,
    pruneCatalog: options.pruneCatalog,
    rewritePackets: options.rewritePackets,
    skipBaselines: options.skipBaselines,
    inCi,
    retiredNameCollision,
    livePromotionRecord,
    cascadeClosureAllowed: false,
    catalogUniquenessProven: false,
    dropData: options.dropData,
    allowNonLocalData: options.allowNonLocalData,
    dataResourceDeclared: O.isSome(dataSurface),
    dataConnectionNonLocal: O.exists(databaseUrl, (url) => !DeletePackageDataResource.isLocalDatabaseUrl(url)),
    dataOwnershipProven: O.exists(dataSurface, (surface) =>
      DeletePackageDataResource.labSchemaOwnershipProven(slug, surface.resourceName)
    ),
  });
});

const runCheckMode = Effect.fn("DeletePackage.runCheckMode")(function* (
  geometry: RegistrationGeometryServiceShape,
  resolved: ResolvedDeleteTarget
) {
  const observations = yield* geometry.inspect(resolved.target);
  for (const item of observations) {
    if (!Str.equivalence(item.status, "clean"))
      yield* Console.log(`[check] ${item.surfaceId}: ${item.status} ${A.join(item.evidence, ", ")}`);
  }
  if (!resolved.liveWorkspace) {
    if (!DeletePackagePolicyEvaluation.doctorIsClean(resolved.target, observations))
      return yield* failWithReportedExit("delete-package --check: residue found.");
    yield* Console.log("[delete-package --check] clean: no registration residue remains for the deleted target.");
    return;
  }
  const pending = A.filter(observations, (item) => !Str.equivalence(item.status, "clean"));
  yield* Console.log(
    `[delete-package --check] live target: ${A.length(pending)} surface(s) carry registrations the inverse plan removes.`
  );
});

// Post-apply doctor residue lines: every non-clean observation prints before the reported failure.
const reportResidueObservations = (observations: ReadonlyArray<RegistrationObservation>) =>
  Effect.forEach(
    A.filter(observations, (item) => !Str.equivalence(item.status, "clean")),
    (item) => Console.error(`[delete-package] residue ${item.surfaceId}: ${A.join(item.evidence, ", ")}`),
    { discard: true }
  );

// The accepted consent-required lab data-resource observation carries the
// manual DROP SCHEMA step; surface it so the manual step is never silent.
const reportConsentRequiredObservations = (observations: ReadonlyArray<RegistrationObservation>) =>
  Effect.forEach(
    A.filter(observations, (item) => Str.equivalence(item.status, "consent-required")),
    (item) => Console.log(`[delete-package] data-resource ${item.surfaceId}: ${A.join(item.evidence, ", ")}`),
    { discard: true }
  );

const runApplyMode = Effect.fn("DeletePackage.runApplyMode")(function* (
  geometry: RegistrationGeometryServiceShape,
  plan: RegistrationPlan
) {
  const observations = yield* geometry.apply(plan);
  if (!DeletePackagePolicyEvaluation.doctorIsClean(plan.target, observations)) {
    yield* reportResidueObservations(observations);
    return yield* failWithReportedExit("delete-package: post-apply doctor found residue.");
  }
  yield* reportConsentRequiredObservations(observations);
  yield* Console.log(`[delete-package] complete: ${plan.target.packageName} removed with zero declared residue.`);
});

const handler = Effect.fn("DeletePackage.handler")(function* (options: DeletePackageHandlerOptions) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot();
  const resolved = yield* resolveDeleteTarget(repoRoot, options.target, options.check);
  yield* enforceOwnedTreeTargetPolicy(resolved.target, resolved.workspacePaths);
  const executePlan = Effect.fn("DeletePackage.executePlan")(function* (plan: RegistrationPlan) {
    yield* enforceOwnedTreeTargetPolicy(plan.target, yield* workspacePathsAtRoot(repoRoot));
    if (options.retireChangesets)
      yield* Console.log(
        "[delete-package] --retire-changesets requested; the existing retired registry is preserved without adding an ambiguous name record."
      );
    if (options.identityMajor)
      yield* Console.log(
        "[delete-package] --identity-major requested; the deletion note remains empty until an identity release policy writer is ratified."
      );

    // P2-D16: the data phase is print-only — policy gates ran in preflight and
    // the live DROP executor is deferred, so the manual step is printed here
    // whether or not consent was given.
    const dataSurface = A.findFirst(surfacesForTarget(plan.target), RegistrationSurface.guards["data-resource"]);
    const dataSlug = pipe(plan.target.packageName, Str.replace("@beep/", Str.empty));
    yield* O.match(dataSurface, {
      onNone: () => Effect.void,
      onSome: (surface) => {
        if (!DeletePackageDataResource.labSchemaOwnershipProven(dataSlug, surface.resourceName)) {
          return Console.error(
            `[delete-package] data-resource ${surface.id}: REFUSE stale manifest resource ${surface.resourceName}; no database command emitted.`
          );
        }
        return Console.log(
          options.dropData
            ? `[delete-package] data-resource ${surface.id}: consent received; the live drop is deferred in P2; run manually: ${DeletePackageDataResource.renderManualDropStep(surface.resourceName)}`
            : `[delete-package] data-resource ${surface.id}: requires ${surface.destructiveConsentFlag}; manual step: ${DeletePackageDataResource.renderManualDropStep(surface.resourceName)}`
        );
      },
    });

    const deletionNotePolicy = pipe(
      A.findFirst(surfacesForTarget(plan.target), RegistrationSurface.guards["pending-changeset"]),
      O.map((surface) => surface.deletionNotePolicy),
      O.getOrElse((): DeletionNotePolicy => "emit-empty-note")
    );

    yield* CreatePackageIdentityRegistration.removeIdentityPackageRegistration(
      path.join(repoRoot, "packages/foundation/modeling/identity/src/packages.ts"),
      pipe(plan.target.packageName, Str.replace("@beep/", Str.empty))
    );
    yield* removeShapeTestRow(repoRoot, plan.target.packageName);
    yield* removeWorkspaceLiteral(repoRoot, plan.target.packagePath);
    yield* rewritePendingChangesets(repoRoot, plan.target.packageName, deletionNotePolicy);
    yield* fs.remove(path.join(repoRoot, plan.target.packagePath), { recursive: true, force: true });
    // Belt-and-braces reconstructive inverse: the flat removal above already
    // swept the compose call, and the labs segment sync re-renders both
    // generated regions from the now-smaller apps/labs/* catalog.
    if (isLabsWorkspacePath(plan.target.packagePath))
      yield* LabIdentitySegment.syncLabIdentitySegment(repoRoot).pipe(
        Effect.mapError(DomainError.newCause("labs identity-segment sync failed after tree removal."))
      );
    yield* syncTsconfigAtRoot(repoRoot, { mode: "sync", filter: undefined, verbose: false }).pipe(
      Effect.mapError(DomainError.newCause("tsconfig-sync failed after package deletion."))
    );
    if (!options.skipLockfile) yield* runStep(repoRoot, "lockfile refresh", "bun", ["install", "--lockfile-only"]);
    if (!options.skipBaselines) yield* runBaselineWriters(repoRoot, plan.target.packageName);
    yield* invalidateCiMirrors(repoRoot);
  });
  const geometry = yield* makeRegistrationGeometryService(repoRoot, executePlan);
  const report = yield* geometry.dependentsOf(resolved.target);
  const plan = yield* geometry.planInverse(resolved.target);
  yield* printPlan(plan, report, planPrintPrefix(options));

  const policy = yield* assembleDeletePolicy(repoRoot, resolved, options);
  const refusals = DeletePackagePolicyEvaluation.refusalReasons(resolved.target, report, policy);
  for (const refusal of refusals)
    yield* Console.error(`[delete-package] REFUSE [${refusal.kind}/${refusal.severity}] ${refusal.detail}`);
  if (A.isReadonlyArrayNonEmpty(refusals)) return yield* failWithReportedExit("delete-package: preflight refused.");

  if (options.dryRun) return;
  if (options.check) return yield* runCheckMode(geometry, resolved);
  return yield* runApplyMode(geometry, plan);
});

/**
 * Delete a leaf workspace package or inspect a deleted target for registration residue.
 *
 * **Example** (Preview a deletion)
 *
 * ```ts
 * console.log("bun run beep delete-package @beep/example --dry-run")
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const deletePackageCommand = Command.make(
  "delete-package",
  {
    target: Argument.string("name-or-path"),
    dryRun: Flag.boolean("dry-run").pipe(Flag.withDefault(false)),
    check: Flag.boolean("check").pipe(Flag.withDefault(false)),
    skipLockfile: Flag.boolean("skip-lockfile").pipe(Flag.withDefault(false)),
    skipBaselines: Flag.boolean("skip-baselines").pipe(Flag.withDefault(false)),
    retireChangesets: Flag.boolean("retire-changesets").pipe(Flag.withDefault(false)),
    identityMajor: Flag.boolean("identity-major").pipe(Flag.withDefault(false)),
    cascade: Flag.boolean("cascade").pipe(Flag.withDefault(false)),
    also: Flag.string("also").pipe(Flag.withDefault(Str.empty)),
    rewritePackets: Flag.boolean("rewrite-packets").pipe(Flag.withDefault(false)),
    allowStalePackets: Flag.boolean("allow-stale-packets").pipe(Flag.withDefault(false)),
    allowPublished: Flag.boolean("allow-published").pipe(Flag.withDefault(false)),
    pruneCatalog: Flag.boolean("prune-catalog").pipe(Flag.withDefault(false)),
    force: Flag.boolean("force").pipe(Flag.withDefault(false)),
    dropData: Flag.boolean("drop-data").pipe(Flag.withDefault(false)),
    allowNonLocalData: Flag.boolean("allow-non-local-data").pipe(Flag.withDefault(false)),
  },
  handler
).pipe(Command.withDescription("Delete a leaf workspace package or doctor a deleted package for registration residue"));
