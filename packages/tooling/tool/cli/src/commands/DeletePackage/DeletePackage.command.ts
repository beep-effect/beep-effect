/**
 * Complete package deletion and registration-residue doctor command.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { DomainError, decodePackageJsonEffect, findRepoRoot, resolveWorkspaceDirs } from "@beep/repo-utils";
import { normalizePath } from "@beep/schema";
import { A, Str, Text, thunkFalse } from "@beep/utils";
import { Config, Console, Effect, FileSystem, Path, pipe } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { Argument, Command, Flag } from "effect/unstable/cli";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { applyJsoncModification } from "../../internal/cli/Jsonc.ts";
import { makeRegistrationGeometryService, RegistrationTarget } from "../../internal/cli/RegistrationGeometry/index.ts";
import { runToExit } from "../../internal/process/index.ts";
import { CreatePackageIdentityRegistration } from "../CreatePackage/internal/IdentityRegistration.ts";
import { changesetPackageReferencesFromText } from "../Quality/ChangesetGraph.ts";
import { syncTsconfigAtRoot } from "../TsconfigSync/index.ts";
import { DeletePackagePolicyEvaluation } from "./DeletePackage.policy.ts";
import { DeletePackageManifest, DeletePackagePolicy } from "./DeletePackage.schemas.ts";
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
  },
  $I.annote("ResolvedDeleteTarget", {
    description: "A live workspace target or an explicit deleted-target doctor probe.",
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
    return ResolvedDeleteTarget.make({
      target: RegistrationTarget.make({
        packageName: name,
        packagePath: relativeDir,
        private: manifest.private !== false,
      }),
      liveWorkspace: true,
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
  });
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
  const unknown = yield* S.decodeEffect(S.fromJsonString(S.Unknown))(content).pipe(
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

const rewritePendingChangesets = Effect.fn("DeletePackage.rewritePendingChangesets")(function* (
  repoRoot: string,
  packageName: string
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
  yield* fs.writeFileString(
    deletionNote,
    Text.joinLines(["---", "{}", "---", "", `No release: remove \`${packageName}\` from the workspace.`, ""])
  );
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

const runBaselineWriters = Effect.fn("DeletePackage.runBaselineWriters")(function* (repoRoot: string) {
  const steps: ReadonlyArray<readonly [label: string, args: ReadonlyArray<string>]> = [
    ["fallow boundaries", ["run", "beep", "fallow", "boundaries", "--write"]],
    ["fallow health baseline", ["run", "fallow:health:baseline:write"]],
    ["fallow dead-code baseline", ["run", "fallow:dead-code:baseline:write"]],
    ["JSDoc inventory pair", ["run", "beep", "quality", "jsdoc-inventory"]],
    ["schema-first inventory", ["run", "beep", "lint", "schema-first", "--write"]],
    ["test typecheck baseline", ["run", "beep", "lint", "package-test-typecheck", "--write-baseline"]],
    ["schema catalog", ["run", "beep", "lint", "schema-catalog", "--write"]],
    ["Knip baseline", ["run", "beep", "quality", "knip", "--write-baseline"]],
    ["coverage replacement baseline", ["run", "coverage:baseline:write"]],
  ];
  for (const [label, args] of steps) yield* runStep(repoRoot, label, "bun", args);
});

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

const doctorIsClean = (observations: ReadonlyArray<RegistrationObservation>): boolean =>
  A.every(observations, (item) => Str.equivalence(item.status, "clean") || Str.equivalence(item.status, "historical"));

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
    if (!doctorIsClean(observations)) return yield* failWithReportedExit("delete-package --check: residue found.");
    yield* Console.log("[delete-package --check] clean: no registration residue remains for the deleted target.");
    return;
  }
  const pending = A.filter(observations, (item) => !Str.equivalence(item.status, "clean"));
  yield* Console.log(
    `[delete-package --check] live target: ${A.length(pending)} surface(s) carry registrations the inverse plan removes.`
  );
});

const runApplyMode = Effect.fn("DeletePackage.runApplyMode")(function* (
  geometry: RegistrationGeometryServiceShape,
  plan: RegistrationPlan,
  packageName: string
) {
  const observations = yield* geometry.apply(plan);
  if (!doctorIsClean(observations)) {
    for (const item of observations) {
      if (!Str.equivalence(item.status, "clean"))
        yield* Console.error(`[delete-package] residue ${item.surfaceId}: ${A.join(item.evidence, ", ")}`);
    }
    return yield* failWithReportedExit("delete-package: post-apply doctor found residue.");
  }
  yield* Console.log(`[delete-package] complete: ${packageName} removed with zero declared residue.`);
});

const handler = Effect.fn("DeletePackage.handler")(function* (options: DeletePackageHandlerOptions) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot();
  const resolved = yield* resolveDeleteTarget(repoRoot, options.target, options.check);
  const executePlan = Effect.fn("DeletePackage.executePlan")(function* (plan: RegistrationPlan) {
    if (options.retireChangesets)
      yield* Console.log(
        "[delete-package] --retire-changesets requested; the existing retired registry is preserved without adding an ambiguous name record."
      );
    if (options.identityMajor)
      yield* Console.log(
        "[delete-package] --identity-major requested; the deletion note remains empty until an identity release policy writer is ratified."
      );

    yield* CreatePackageIdentityRegistration.removeIdentityPackageRegistration(
      path.join(repoRoot, "packages/foundation/modeling/identity/src/packages.ts"),
      pipe(plan.target.packageName, Str.replace("@beep/", Str.empty))
    );
    yield* removeShapeTestRow(repoRoot, plan.target.packageName);
    yield* removeWorkspaceLiteral(repoRoot, plan.target.packagePath);
    yield* rewritePendingChangesets(repoRoot, plan.target.packageName);
    yield* fs.remove(path.join(repoRoot, plan.target.packagePath), { recursive: true, force: true });
    yield* syncTsconfigAtRoot(repoRoot, { mode: "sync", filter: undefined, verbose: false }).pipe(
      Effect.mapError(DomainError.newCause("tsconfig-sync failed after package deletion."))
    );
    if (!options.skipLockfile) yield* runStep(repoRoot, "lockfile refresh", "bun", ["install", "--lockfile-only"]);
    if (!options.skipBaselines) yield* runBaselineWriters(repoRoot);
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
  return yield* runApplyMode(geometry, plan, resolved.target.packageName);
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
    dryRun: Flag.boolean("dry-run"),
    check: Flag.boolean("check"),
    skipLockfile: Flag.boolean("skip-lockfile"),
    skipBaselines: Flag.boolean("skip-baselines"),
    retireChangesets: Flag.boolean("retire-changesets"),
    identityMajor: Flag.boolean("identity-major"),
    cascade: Flag.boolean("cascade"),
    also: Flag.string("also").pipe(Flag.withDefault(Str.empty)),
    rewritePackets: Flag.boolean("rewrite-packets"),
    allowStalePackets: Flag.boolean("allow-stale-packets"),
    allowPublished: Flag.boolean("allow-published"),
    pruneCatalog: Flag.boolean("prune-catalog"),
    force: Flag.boolean("force"),
  },
  handler
).pipe(Command.withDescription("Delete a leaf workspace package or doctor a deleted package for registration residue"));
