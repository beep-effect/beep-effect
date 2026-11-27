import { GlobPattern, GlobPatternOptions } from "@beep/glob/GlobPattern";
import { isLabsWorkspacePath } from "@beep/repo-cli-kit/cli/Labs/index";
import { workspaceDirectories, workspacePackages } from "@beep/repo-cli-kit/RepoWorkspaces";
import { mentionsAnyToken, mentionsRepoPath, mentionsToken, shadowPrefixesFor } from "@beep/repo-cli-kit/WholeToken";
import { computeTransitiveClosure, decodePackageJsonEffect, toSortedRecord } from "@beep/repo-utils";
import { ALL_DEPENDENCY_FIELDS } from "@beep/repo-workspaces/internal/dependencyFields";
import { normalizePath } from "@beep/schema";
import { PosixPath } from "@beep/schema/PosixPath";
import { A, Str, thunkFalse } from "@beep/utils";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { identity, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { Node, Project, SyntaxKind } from "ts-morph";
import { listGitVisiblePaths } from "../../../Quality/internal/QualityArtifactSupport.ts";
import { DeletePackageDataResource } from "../DataResource.ts";
import { isCanonicalDeletionChangeset } from "../DeletionChangeset.ts";
import { IDENTITY_SHAPE_TEST_PATH, shapeTestRowAccessor } from "../ShapeTestRow.ts";
import { RegistrationGeometryError } from "./RegistrationGeometry.errors.ts";
import { surfacesForTarget } from "./RegistrationGeometry.plan.ts";
import {
  DependentHit,
  DependentsReport,
  RegistrationObservation,
  RegistrationSurface,
} from "./RegistrationGeometry.schemas.ts";
import type { GitCommandErrorAdapter } from "../../../../internal/repo-run/GitExec.ts";
import type {
  DependentHitKind,
  RegistrationObservationStatus,
  RegistrationTarget,
} from "./RegistrationGeometry.schemas.ts";

const decodeJsonEffect = S.decodeEffect(S.fromJsonString(S.Unknown));

const SCAN_ROOTS = ["packages", "apps", "scratchpad", "standards", "goals", "research", ".changeset", ".github"];
const EXCLUDED_DIRECTORIES = HashSet.fromIterable([".git", "node_modules", "dist", "coverage", ".turbo", ".beep"]);
const SOURCE_SUFFIXES = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];
const TEXT_SUFFIXES = [...SOURCE_SUFFIXES, ".json", ".jsonc", ".md", ".yml", ".yaml", ".toml"];
const RECORD_SUFFIXES = A.append(TEXT_SUFFIXES, ".tsv");

const isSuffixIn =
  (suffixes: ReadonlyArray<string>) =>
  (file: string): boolean =>
    A.some(suffixes, (suffix) => Str.endsWith(suffix)(file));

const collectFiles = Effect.fn("RegistrationGeometry.collectFiles")(function* (
  root: string,
  suffixes: ReadonlyArray<string>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const walk = Effect.fn("RegistrationGeometry.collectFiles.walk")(function* (
    current: string
  ): Effect.fn.Return<ReadonlyArray<string>, never, FileSystem.FileSystem | Path.Path> {
    const stat = yield* fs.stat(current).pipe(Effect.option);
    if (O.isNone(stat)) return A.empty<string>();
    if (stat.value.type === "File") return isSuffixIn(suffixes)(current) ? A.of(current) : A.empty<string>();
    if (stat.value.type !== "Directory") return A.empty<string>();

    const entries = yield* fs.readDirectory(current).pipe(Effect.orElseSucceed(A.empty<string>));
    let files = A.empty<string>();
    for (const entry of entries) {
      if (HashSet.has(EXCLUDED_DIRECTORIES, entry)) continue;
      const walk1 = yield* walk(path.join(current, entry));
      files = A.appendAll(files, walk1);
    }
    return files;
  });

  const walk2 = yield* walk(root);
  return A.sort(walk2, Order.String);
});

const gitListingAdapter = (repoRoot: string): GitCommandErrorAdapter<RegistrationGeometryError> => ({
  onSpawnFailure: (commandLine) =>
    RegistrationGeometryError.newCause(`Cannot list git-visible files at ${repoRoot}: ${commandLine} did not run.`),
  onNonZeroExit: ({ commandLine, exitCode, output }) =>
    RegistrationGeometryError.make({
      message: `Cannot list git-visible files at ${repoRoot}: delete-package scans only a git work tree and never falls back to a filesystem walk (${commandLine} exited ${exitCode}: ${Str.trim(output)}).`,
      cause: O.none(),
    }),
  onTruncated: O.none(),
});

const hasExcludedSegment = (file: string): boolean =>
  A.some(Str.split("/")(file), (segment) => HashSet.has(EXCLUDED_DIRECTORIES, segment));

const gitVisibleFilesAt = Effect.fn("RegistrationGeometry.gitVisibleFilesAt")(function* (
  repoRoot: string,
  acknowledgementFile: O.Option<string>
) {
  const files = yield* listGitVisiblePaths(repoRoot, A.empty(), gitListingAdapter(repoRoot));
  return A.filter(files, (file) => !hasExcludedSegment(file) && !O.exists(acknowledgementFile, Str.equivalence(file)));
});

const isUnderRoot =
  (root: string) =>
  (file: string): boolean =>
    Str.startsWith(`${root}/`)(file);

const readVisibleFile = Effect.fn("RegistrationGeometry.readVisibleFile")(function* (
  repoRoot: string,
  relativeFile: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* fs.readFileString(path.join(repoRoot, relativeFile)).pipe(Effect.option);
});

/**
 * How many occurrences of a trimmed line in a repository-relative file are
 * acknowledged, so the doctor treats up to that many matching lines as clean.
 *
 * **Example** (Acknowledge nothing)
 *
 * ```ts
 * import type { AcknowledgedOccurrences } from "@beep/repo-cli/test/DeletePackage"
 *
 * const none: AcknowledgedOccurrences = () => 0
 * console.log(none("package.json", '"kind": "deploy",')) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AcknowledgedOccurrences = (file: string, text: string) => number;

const noAcknowledgedOccurrences: AcknowledgedOccurrences = () => 0;

const hasUnacknowledgedMention = (
  file: string,
  content: string,
  mentionsNeedle: (text: string) => boolean,
  acknowledgedOccurrences: AcknowledgedOccurrences
): boolean => {
  const mentioningLines = A.map(A.filter(Str.split("\n")(content), mentionsNeedle), Str.trim);
  return (
    A.isReadonlyArrayEmpty(mentioningLines) ||
    A.some(
      R.toEntries(A.groupBy(mentioningLines, identity)),
      ([text, lines]) => A.length(lines) > acknowledgedOccurrences(file, text)
    )
  );
};

type NeedleMatcher = (needles: ReadonlyArray<string>) => (text: string) => boolean;

const needleMatcherFor =
  (target: RegistrationTarget, workspacePaths: ReadonlyArray<string>): NeedleMatcher =>
  (needles) => {
    const shadowPrefixes = shadowPrefixesFor(target.packagePath, workspacePaths);
    const matchers = A.map(needles, (needle) =>
      Str.equivalence(needle, target.packagePath) ? mentionsRepoPath(needle, shadowPrefixes) : mentionsToken(needle)
    );
    return (text) => A.some(matchers, (matches) => matches(text));
  };

const workspacePathsAt = Effect.fn("RegistrationGeometry.workspacePathsAt")(function* (repoRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const hasRootManifest = yield* fs.exists(path.join(repoRoot, "package.json")).pipe(Effect.orElseSucceed(thunkFalse));
  if (!hasRootManifest) return A.empty<string>();
  const directories = yield* workspaceDirectories(repoRoot);
  return A.map(A.fromIterable(directories), ([, directory]) => normalizePath(path.relative(repoRoot, directory)));
});

const existingEvidence = Effect.fn("RegistrationGeometry.existingEvidence")(function* (
  repoRoot: string,
  relativeFiles: ReadonlyArray<string>,
  mentionsNeedle: (text: string) => boolean
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  let evidence = A.empty<string>();

  for (const relativeFile of relativeFiles) {
    const absoluteFile = path.join(repoRoot, relativeFile);
    const exists = yield* fs.exists(absoluteFile).pipe(Effect.orElseSucceed(thunkFalse));
    if (!exists) continue;
    const content = yield* fs.readFileString(absoluteFile).pipe(Effect.orElseSucceed(() => Str.empty));
    if (mentionsNeedle(content)) evidence = A.append(evidence, relativeFile);
  }
  return evidence;
});

const isPendingChangesetResidue = Effect.fn("RegistrationGeometry.isPendingChangesetResidue")(function* (
  file: string,
  content: string,
  packageName: string
) {
  const path = yield* Path.Path;
  const deletionNoteFile = `delete-${Str.replace("@beep/", Str.empty)(packageName)}.md`;
  const hasDeletionNoteBasename = Str.equivalence(path.basename(file), deletionNoteFile);
  if (!hasDeletionNoteBasename) return mentionsToken(packageName)(content);
  const isCanonicalDeletionNote = yield* isCanonicalDeletionChangeset(file, content, packageName);
  return !isCanonicalDeletionNote;
});

const recordGlob = GlobPatternOptions.make({ nonegate: true, nocomment: true });

const historicalRecordMatcherFor = (surfaces: ReadonlyArray<RegistrationSurface>): ((file: string) => boolean) => {
  const patterns = pipe(
    surfaces,
    A.filter(RegistrationSurface.guards["historical-record"]),
    A.flatMap((surface) => surface.files),
    A.map((source) => Result.getOrThrow(GlobPattern.compileResult(source, recordGlob)))
  );
  return (file) => A.some(patterns, (pattern) => pattern.matches(file));
};

const observation = (
  surfaceId: string,
  status: RegistrationObservationStatus,
  evidence: ReadonlyArray<string>
): RegistrationObservation => RegistrationObservation.make({ surfaceId, status, evidence });

const inspectSurface = Effect.fn("RegistrationGeometry.inspectSurface")(function* (
  repoRoot: string,
  target: RegistrationTarget,
  surface: RegistrationSurface,
  matchNeedles: NeedleMatcher,
  visibleFiles: ReadonlyArray<string>,
  isHistoricalRecord: (file: string) => boolean,
  acknowledgedOccurrences: AcknowledgedOccurrences
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  return yield* RegistrationSurface.match(surface, {
    "owned-tree": Effect.fn(function* (owned) {
      const exists = yield* fs.exists(path.join(repoRoot, owned.root)).pipe(Effect.orElseSucceed(thunkFalse));
      return observation(owned.id, exists ? "residue" : "clean", exists ? [owned.root] : []);
    }),
    "workspace-literal": Effect.fn(function* (workspace) {
      const evidence = yield* existingEvidence(
        repoRoot,
        [workspace.file],
        mentionsAnyToken([`"${workspace.workspacePath}"`])
      );
      return observation(workspace.id, A.isReadonlyArrayNonEmpty(evidence) ? "residue" : "clean", evidence);
    }),
    "identity-segment": Effect.fn(function* (identity) {
      const registryEvidence = yield* existingEvidence(
        repoRoot,
        [identity.registryFile],
        mentionsAnyToken([`"${identity.slug}"`, identity.accessor])
      );
      const shapeTestEvidence = yield* existingEvidence(
        repoRoot,
        [IDENTITY_SHAPE_TEST_PATH],
        mentionsToken(identity.accessor)
      );
      const evidence = A.appendAll(registryEvidence, shapeTestEvidence);
      return observation(identity.id, A.isReadonlyArrayNonEmpty(evidence) ? "residue" : "clean", evidence);
    }),
    "derived-rebuild": Effect.fn(function* (derived) {
      const evidence = yield* existingEvidence(
        repoRoot,
        derived.outputs,
        matchNeedles([target.packageName, target.packagePath])
      );
      const labsRootReference =
        isLabsWorkspacePath(target.packagePath) && A.some(evidence, Str.equivalence("tsconfig.packages.json"));
      const dirtyStatus = labsRootReference ? "residue" : "drift";
      return observation(derived.id, A.isReadonlyArrayNonEmpty(evidence) ? dirtyStatus : "clean", evidence);
    }),
    "generated-inventory": Effect.fn(function* (inventory) {
      const evidence = yield* existingEvidence(repoRoot, inventory.outputs, matchNeedles([inventory.membershipKey]));
      return observation(inventory.id, A.isReadonlyArrayNonEmpty(evidence) ? "residue" : "clean", evidence);
    }),
    "authored-reference": Effect.fn(function* (authored) {
      const mentionsNeedle = matchNeedles(authored.needles);
      let evidence = A.empty<string>();
      for (const relative of A.filter(visibleFiles, isSuffixIn(TEXT_SUFFIXES))) {
        if (isHistoricalRecord(relative)) continue;
        const content = yield* readVisibleFile(repoRoot, relative);
        if (
          O.isSome(content) &&
          mentionsNeedle(content.value) &&
          hasUnacknowledgedMention(relative, content.value, mentionsNeedle, acknowledgedOccurrences)
        )
          evidence = A.append(evidence, relative);
      }
      return observation(
        authored.id,
        A.isReadonlyArrayNonEmpty(evidence) ? "residue" : "clean",
        A.sort(evidence, Order.String)
      );
    }),
    "pending-changeset": Effect.fn(function* (pending) {
      const files = A.filter(visibleFiles, (file) => isUnderRoot(".changeset")(file) && Str.endsWith(".md")(file));
      let evidence = A.empty<string>();
      for (const file of files) {
        const read = yield* readVisibleFile(repoRoot, file);
        if (O.isNone(read)) continue;
        const residue = yield* isPendingChangesetResidue(file, read.value, pending.packageName);
        if (residue) evidence = A.append(evidence, file);
      }
      return observation(
        pending.id,
        A.isReadonlyArrayNonEmpty(evidence) ? "residue" : "clean",
        A.sort(evidence, Order.String)
      );
    }),
    "runtime-artifact": Effect.fn(function* (runtime) {
      const targetExists = yield* fs
        .exists(path.join(repoRoot, target.packagePath))
        .pipe(Effect.orElseSucceed(thunkFalse));
      const ciFiles = yield* collectFiles(path.join(repoRoot, ".beep", "ci"), TEXT_SUFFIXES);
      const mentionsPackage = mentionsToken(target.packageName);
      let evidence = targetExists ? A.of(target.packagePath) : A.empty<string>();
      for (const file of ciFiles) {
        const content = yield* fs.readFileString(file).pipe(Effect.orElseSucceed(() => Str.empty));
        if (mentionsPackage(content)) evidence = A.append(evidence, normalizePath(path.relative(repoRoot, file)));
      }
      return observation(
        runtime.id,
        A.isReadonlyArrayNonEmpty(evidence) ? "residue" : "clean",
        A.sort(evidence, Order.String)
      );
    }),
    "data-resource": (data) => {
      const slug = Str.replace("@beep/", Str.empty)(target.packageName);
      const ownershipProven = DeletePackageDataResource.labSchemaOwnershipProven(slug, data.resourceName);
      return Effect.succeed(
        ownershipProven
          ? observation(data.id, "consent-required", [
              `manual cleanup: DROP SCHEMA IF EXISTS "${data.resourceName}" CASCADE; (owner ${data.owner}, consent flag ${data.destructiveConsentFlag})`,
            ])
          : observation(data.id, "residue", [
              `refused stale data resource ${data.resourceName}: expected package-owned schema ${DeletePackageDataResource.expectedLabSchemaName(slug)}; no database command emitted`,
            ])
      );
    },
    "historical-record": Effect.fn(function* (historical) {
      const mentionsNeedle = matchNeedles(historical.needles);
      let evidence = A.empty<string>();
      for (const relative of A.filter(visibleFiles, isSuffixIn(RECORD_SUFFIXES))) {
        if (!isHistoricalRecord(relative)) continue;
        const content = yield* readVisibleFile(repoRoot, relative);
        if (O.exists(content, mentionsNeedle)) evidence = A.append(evidence, relative);
      }
      return observation(
        historical.id,
        A.isReadonlyArrayNonEmpty(evidence) ? "historical" : "clean",
        A.sort(evidence, Order.String)
      );
    }),
  });
});

/**
 * Probes every declared surface of a target under a repository root and
 * reports one doctor observation per surface.
 *
 * **Details**
 *
 * Surfaces are inspected with a concurrency of 8; the result keeps surface
 * order. The Effect reads files only and requires `FileSystem`, `Path` and
 * `Git`. Candidate files come from one git-visible listing (tracked plus
 * untracked, not ignored), so gitignored build output is never evidence; only
 * the runtime-artifact probe walks the gitignored `.beep/ci` tree. An
 * `authored-reference` file whose only matching lines are acknowledged, no more
 * often than acknowledged, reads `clean`. A file the `historical-records` surface
 * declares is a dated record: the `authored-references` probe skips it and the
 * `historical-records` observation lists it, which keeps the doctor clean.
 *
 * **Gotchas**
 *
 * A `repoRoot` that is not a git work tree fails with a
 * `RegistrationGeometryError` naming it; there is no filesystem fallback.
 *
 * - No path with a `.git`, `node_modules`, `dist`, `coverage`, `.turbo` or `.beep` segment is
 *   read, even in a checkout that does not ignore them; the runtime-artifact probe reads
 *   `.beep/ci` from inside that root.
 * - A file whose text names the target only across lines, with no single line naming it,
 *   still counts as an authored reference.
 * - A needle equal to the target's package path skips occurrences inside a sibling workspace
 *   path (`packages/tooling/deploy/x` does not name `packages/tooling/deploy`), exactly as the
 *   dependents scan does. Package names, the identity slug and accessor, name-keyed inventory
 *   keys and the quoted workspace literal match as whole tokens.
 * - A repository with no root manifest has no sibling workspace paths; any other workspace
 *   discovery failure fails the Effect.
 * - A pending changeset is residue when it names the package or reuses the deletion note's
 *   basename, unless it is the dedicated deletion note the delete itself emits.
 * - Any mention of the accessor left in the identity shape test is residue, because the
 *   deletion removes that accessor's rows.
 * - A labs target referenced by `tsconfig.packages.json` is residue, not rebuildable drift:
 *   labs are excluded from the root TS solution.
 *
 * **Example** (Collect doctor statuses)
 *
 * ```ts
 * import * as A from "effect/Array"
 * import * as Effect from "effect/Effect"
 * import { inspectTargetAtRoot, RegistrationTarget } from "@beep/repo-cli/test/DeletePackage"
 * import { PosixPath } from "@beep/schema/PosixPath"
 *
 * const target = RegistrationTarget.make({
 *   packageName: "@beep/demo",
 *   packagePath: PosixPath.make("packages/demo"),
 *   private: true
 * })
 * const statuses = inspectTargetAtRoot(".", target).pipe(
 *   Effect.map(A.map((observation) => observation.status))
 * )
 *
 * console.log(Effect.isEffect(statuses)) // true
 * ```
 *
 * @param repoRoot - Absolute or working-directory-relative repository root.
 * @param target - Package whose surfaces are probed.
 * @param acknowledgedOccurrences - Acknowledged occurrences per `(file, trimmed line)`; none by default.
 * @param acknowledgementFile - Repository-relative `--acknowledge` file the scans skip; none by default.
 * @category queries
 * @since 0.0.0
 */
export const inspectTargetAtRoot = Effect.fn("RegistrationGeometry.inspectTargetAtRoot")(function* (
  repoRoot: string,
  target: RegistrationTarget,
  acknowledgedOccurrences: AcknowledgedOccurrences = noAcknowledgedOccurrences,
  acknowledgementFile: O.Option<string> = O.none()
) {
  const workspacePaths = yield* workspacePathsAt(repoRoot);
  const matchNeedles = needleMatcherFor(target, workspacePaths);
  const visibleFiles = yield* gitVisibleFilesAt(repoRoot, acknowledgementFile);
  const surfaces = surfacesForTarget(target);
  const isHistoricalRecord = historicalRecordMatcherFor(surfaces);
  return yield* Effect.forEach(
    surfaces,
    (surface) =>
      inspectSurface(
        repoRoot,
        target,
        surface,
        matchNeedles,
        visibleFiles,
        isHistoricalRecord,
        acknowledgedOccurrences
      ),
    { concurrency: 8 }
  );
});

const addReverseEdge = (
  reverse: HashMap.HashMap<string, HashSet.HashSet<string>>,
  dependency: string,
  owner: string
): HashMap.HashMap<string, HashSet.HashSet<string>> => {
  const owners = pipe(HashMap.get(reverse, dependency), O.getOrElse(HashSet.empty<string>));
  return HashMap.set(reverse, dependency, HashSet.add(owners, owner));
};

const manifestKindFor = (bucket: string): DependentHitKind =>
  bucket === "dependencies"
    ? "manifest-prod"
    : bucket === "devDependencies"
      ? "manifest-dev"
      : bucket === "peerDependencies"
        ? "manifest-peer"
        : "manifest-optional";

const hitKey = (hit: DependentHit): string =>
  `${hit.kind}\u0000${hit.owner}\u0000${hit.file}\u0000${O.getOrElse(hit.line, () => 0)}\u0000${O.getOrElse(hit.script, () => Str.empty)}`;

const ownerForFile = (file: string, workspaces: ReadonlyArray<readonly [name: string, dir: string]>): string =>
  pipe(
    A.findFirst(workspaces, ([, dir]) => Str.startsWith(`${normalizePath(dir)}/`)(normalizePath(file))),
    O.map(([name]) => name),
    O.getOrElse(() => "@beep/root")
  );

const isTargetSpecifier = (specifier: string, packageName: string): boolean =>
  Str.equivalence(specifier, packageName) || Str.startsWith(`${packageName}/`)(specifier);

const dynamicImportSpecifier = (node: Node): O.Option<string> => {
  if (!Node.isCallExpression(node)) return O.none();
  const expression = node.getExpression();
  const isLoader =
    (Node.isIdentifier(expression) && Str.equivalence(expression.getText(), "require")) ||
    expression.getKind() === SyntaxKind.ImportKeyword;
  if (!isLoader) return O.none();
  return pipe(
    A.head(node.getArguments()),
    O.flatMap((argument) => (Node.isStringLiteral(argument) ? O.some(argument.getLiteralText()) : O.none()))
  );
};

const importTypeSpecifier = (node: Node): O.Option<string> => {
  if (!Node.isImportTypeNode(node)) return O.none();
  const argument = node.getArgument();
  const literal = Node.isLiteralTypeNode(argument) ? argument.getLiteral() : argument;
  return Node.isStringLiteral(literal) ? O.some(literal.getLiteralText()) : O.none();
};

const importEqualsSpecifier = (node: Node): O.Option<string> => {
  if (!Node.isExternalModuleReference(node)) return O.none();
  const expression = node.getExpression();
  return Node.isStringLiteral(expression) ? O.some(expression.getLiteralText()) : O.none();
};

const nestedSpecifier = (node: Node): O.Option<string> =>
  O.firstSomeOf([dynamicImportSpecifier(node), importTypeSpecifier(node), importEqualsSpecifier(node)]);

const importHitsInFile = (
  project: Project,
  absoluteFile: string,
  relativeFile: string,
  owner: string,
  content: string,
  target: RegistrationTarget
): ReadonlyArray<DependentHit> => {
  const source = project.createSourceFile(absoluteFile, content, { overwrite: true });
  const lines = Str.split("\n")(content);
  let hits = A.empty<DependentHit>();
  const kind = importKindForFile(relativeFile);

  const append = (line: number): void => {
    hits = A.append(
      hits,
      DependentHit.make({
        kind,
        owner,
        file: PosixPath.make(relativeFile),
        line: O.some(line),
        direct: true,
        text: O.map(A.get(lines, line - 1), Str.trim),
      })
    );
  };

  for (const declaration of source.getImportDeclarations()) {
    if (isTargetSpecifier(declaration.getModuleSpecifierValue(), target.packageName))
      append(declaration.getStartLineNumber());
  }
  for (const declaration of source.getExportDeclarations()) {
    const specifier = declaration.getModuleSpecifierValue();
    if (specifier !== undefined && isTargetSpecifier(specifier, target.packageName))
      append(declaration.getStartLineNumber());
  }
  source.forEachDescendant((node) => {
    const specifier = nestedSpecifier(node);
    if (O.isSome(specifier) && isTargetSpecifier(specifier.value, target.packageName))
      append(node.getStartLineNumber());
  });
  return hits;
};

const importKindForFile = (relativeFile: string): DependentHitKind =>
  Str.includes("/test/")(relativeFile) || Str.includes(".test.")(relativeFile) ? "import-test" : "import-prod";

const needleLineHits = (
  content: string,
  matchesLine: (line: string) => boolean,
  hitForLine: (line: number, text: string) => DependentHit
): ReadonlyArray<DependentHit> => {
  const lines = Str.split("\n")(content);
  let hits = A.empty<DependentHit>();
  for (let index = 0; index < A.length(lines); index += 1) {
    const line = pipe(
      A.get(lines, index),
      O.getOrElse(() => Str.empty)
    );
    if (matchesLine(line)) hits = A.append(hits, hitForLine(index + 1, Str.trim(line)));
  }
  return hits;
};

const accessorHitsInFile = (
  relativeFile: string,
  owner: string,
  content: string,
  referencesAccessor: (line: string) => boolean
): ReadonlyArray<DependentHit> =>
  needleLineHits(content, referencesAccessor, (line, text) =>
    DependentHit.make({
      kind: importKindForFile(relativeFile),
      owner,
      file: PosixPath.make(relativeFile),
      line: O.some(line),
      direct: true,
      text: O.some(text),
    })
  );

const BASELINE_REFERENCE_FILES = [
  "bun.lock",
  "tsconfig.json",
  "tsconfig.packages.json",
  "syncpack.config.ts",
  "packages/foundation/modeling/identity/src/packages.ts",
];

const isBaselineReferenceFile = (file: string): boolean =>
  Str.startsWith("standards/")(file) ||
  Str.startsWith(".changeset/")(file) ||
  A.some(BASELINE_REFERENCE_FILES, Str.equivalence(file));

const isPacketHistoricalRecord = (file: string): boolean =>
  Str.startsWith("goals/")(file) && (Str.includes("/history/")(file) || Str.includes("/research/")(file));

const AUTHORED_KIND_RULES: ReadonlyArray<readonly [matches: (file: string) => boolean, kind: DependentHitKind]> = [
  [isBaselineReferenceFile, "baseline"],
  [isPacketHistoricalRecord, "historical-doc"],
  [Str.startsWith("goals/"), "packet"],
  [Str.startsWith("research/"), "historical-doc"],
  [Str.equivalence("package.json"), "script"],
];

const authoredKindFor = (file: string): DependentHitKind =>
  pipe(
    A.findFirst(AUTHORED_KIND_RULES, ([matches]) => matches(file)),
    O.map(([, kind]) => kind),
    O.getOrElse((): DependentHitKind => "file-path")
  );

type WorkspaceEdge = { readonly owner: string; readonly bucket: string; readonly dependency: string };

const collectWorkspaceEdges = Effect.fn("RegistrationGeometry.collectWorkspaceEdges")(function* (
  repoRoot: string,
  targetName: string
) {
  const packages = yield* workspacePackages(repoRoot).pipe(
    Effect.mapError(RegistrationGeometryError.newCause(`Failed to build dependency index for ${targetName}.`))
  );
  const memberNames = HashSet.fromIterable(
    A.map(
      A.filter(packages, (pkg) => !pkg.isRootWorkspace),
      (pkg) => pkg.name
    )
  );
  return A.flatMap(packages, (pkg) =>
    A.flatMap(ALL_DEPENDENCY_FIELDS, (bucket) =>
      pipe(
        R.keys(pkg[bucket]),
        A.filter((dependency) => HashSet.has(memberNames, dependency)),
        A.sort(Order.String),
        A.map((dependency): WorkspaceEdge => ({ owner: pkg.name, bucket, dependency }))
      )
    )
  );
});

const rootScriptHits = (
  scripts: Readonly<Record<string, string>>,
  mentionsTarget: (text: string) => boolean
): ReadonlyArray<DependentHit> =>
  pipe(
    R.toEntries(scripts),
    A.filter(([, command]) => mentionsTarget(command)),
    A.map(([name, command]) =>
      DependentHit.make({
        kind: "script",
        owner: "@beep/root",
        file: PosixPath.make("package.json"),
        line: O.none(),
        direct: true,
        text: O.some(Str.trim(command)),
        script: O.some(name),
      })
    )
  );

const rootPolicyFileHits = Effect.fn("RegistrationGeometry.rootPolicyFileHits")(function* (
  repoRoot: string,
  mentionsTarget: (text: string) => boolean
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  let hits = A.empty<DependentHit>();
  for (const rootPolicyFile of ["turbo.json", "lefthook.yml", "biome.jsonc"]) {
    const absoluteFile = path.join(repoRoot, rootPolicyFile);
    const exists = yield* fs.exists(absoluteFile).pipe(Effect.orElseSucceed(thunkFalse));
    if (!exists) continue;
    const content = yield* fs.readFileString(absoluteFile);
    if (mentionsTarget(content)) {
      hits = A.append(
        hits,
        DependentHit.make({
          kind: "file-path",
          owner: "@beep/root",
          file: PosixPath.make(rootPolicyFile),
          line: O.none(),
          direct: true,
        })
      );
    }
  }
  return hits;
});

const decodedRootManifest = Effect.fn("RegistrationGeometry.decodedRootManifest")(function* (repoRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const content = yield* fs.readFileString(path.join(repoRoot, "package.json"));
  const unknown = yield* decodeJsonEffect(content).pipe(
    Effect.mapError(RegistrationGeometryError.newCause("Failed to parse root package.json during E15 scanning."))
  );
  return yield* decodePackageJsonEffect(unknown).pipe(
    Effect.mapError(RegistrationGeometryError.newCause("Failed to decode root package.json during E15 scanning."))
  );
});

const dedupedSortedHits = (hits: ReadonlyArray<DependentHit>): ReadonlyArray<DependentHit> => {
  let seen = HashSet.empty<string>();
  const deduped = A.filter(hits, (hit) => {
    const key = hitKey(hit);
    if (HashSet.has(seen, key)) return false;
    seen = HashSet.add(seen, key);
    return true;
  });
  return A.sort(deduped, Order.mapInput(Order.String, hitKey));
};

/**
 * Builds the reverse-dependency report that gates deletion of a workspace
 * package.
 *
 * **Details**
 *
 * The scan combines workspace manifest edges, their transitive closure,
 * TypeScript imports, identity-accessor references, authored path mentions,
 * root scripts, and root policy files. It deduplicates and sorts every hit so
 * repeated scans of the same checkout return the same report.
 *
 * **Gotchas**
 *
 * Files inside the target package are omitted because a package's own imports
 * and path references must not block its removal. The returned Effect requires
 * filesystem, path, git, and workspace-discovery services from the caller.
 * Candidate files are the git-visible set (tracked plus untracked, not
 * ignored), so gitignored build output is never a dependent; a listed file
 * gone from disk is skipped, and a `repoRoot` that is not a git work tree
 * fails with a `RegistrationGeometryError` naming it.
 *
 * - The `--acknowledge` file names the target by construction, so it is never scanned: it is
 *   not a dependent of the deletion it reviews.
 * - Each root script naming the target is its own hit, keyed by script name, although every
 *   root script shares `package.json` and has no line.
 * - A needle equal to the target's package path skips occurrences inside a sibling workspace
 *   path, the same reading the doctor applies.
 * - Rows of the identity shape test naming the target's accessor are not dependents, because
 *   the deletion removes them. The identity registry is not a dependent either (the
 *   identity-segment surface rewrites it); every other file naming the accessor is.
 * - Inside a goal packet, only the live planning surface is a `packet` hit. A mention under a
 *   packet's `history/` or `research/` records the past and is a `historical-doc` hit.
 *
 * **Example** (Build a dependency scan)
 *
 * ```ts
 * import { dependentsOfAtRoot, RegistrationTarget } from "@beep/repo-cli/test/DeletePackage"
 * import { PosixPath } from "@beep/schema/PosixPath"
 * import * as Effect from "effect/Effect";
 * const target = RegistrationTarget.make({
 *   packageName: "@beep/example",
 *   packagePath: PosixPath.make("packages/example"),
 *   private: true
 * })
 * const scan = dependentsOfAtRoot(".", target)
 *
 * console.log(Effect.isEffect(scan)) // true
 * ```
 *
 * @param repoRoot - Repository root the scan reads.
 * @param target - Package whose dependents are reported.
 * @param acknowledgementFile - Repository-relative `--acknowledge` file the scan skips; none by default.
 * @effects Reads workspace manifests and authored repository files without
 * modifying the checkout.
 * @category queries
 * @since 0.0.0
 */
export const dependentsOfAtRoot = Effect.fn("RegistrationGeometry.dependentsOfAtRoot")(function* (
  repoRoot: string,
  target: RegistrationTarget,
  acknowledgementFile: O.Option<string> = O.none()
) {
  const path = yield* Path.Path;
  const workspaceDirectories3 = yield* workspaceDirectories(repoRoot);
  const workspaces = A.fromIterable(workspaceDirectories3);
  const edges = yield* collectWorkspaceEdges(repoRoot, target.packageName);
  const reverse = A.reduce(edges, HashMap.empty<string, HashSet.HashSet<string>>(), (map, edge) =>
    addReverseEdge(map, edge.dependency, edge.owner)
  );

  const manifestHitFor = (edge: WorkspaceEdge): DependentHit => {
    const relativeManifest = pipe(
      A.findFirst(workspaces, ([name]) => Str.equivalence(name, edge.owner)),
      O.map(([, dir]) => normalizePath(path.relative(repoRoot, path.join(dir, "package.json")))),
      O.getOrElse(() => "package.json")
    );
    return DependentHit.make({
      kind: manifestKindFor(edge.bucket),
      owner: edge.owner,
      file: PosixPath.make(relativeManifest),
      line: O.none(),
      direct: true,
    });
  };
  const descendantWorkspaceHits = A.flatMap(workspaces, ([owner, directory]) => {
    const workspacePath = normalizePath(path.relative(repoRoot, directory));
    return !Str.equivalence(workspacePath, target.packagePath) &&
      Str.startsWith(`${target.packagePath}/`)(workspacePath)
      ? A.of(
          DependentHit.make({
            kind: "file-path",
            owner,
            file: PosixPath.make(`${workspacePath}/package.json`),
            line: O.none(),
            direct: true,
          })
        )
      : A.empty<DependentHit>();
  });
  let hits = A.appendAll(
    pipe(
      edges,
      A.filter((edge) => Str.equivalence(edge.dependency, target.packageName)),
      A.map(manifestHitFor)
    ),
    descendantWorkspaceHits
  );

  const direct = pipe(HashMap.get(reverse, target.packageName), O.getOrElse(HashSet.empty<string>));
  const transitive = yield* computeTransitiveClosure(reverse, target.packageName);
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  const identitySurface = A.findFirst(surfacesForTarget(target), RegistrationSurface.guards["identity-segment"]);
  const identityAccessor = O.map(identitySurface, (surface) => surface.accessor);
  const mentionsTarget = needleMatcherFor(
    target,
    A.map(workspaces, ([, directory]) => normalizePath(path.relative(repoRoot, directory)))
  )([target.packageName, target.packagePath]);
  const mentionsAccessor: (text: string) => boolean = O.match(identityAccessor, {
    onNone: () => thunkFalse,
    onSome: mentionsToken,
  });
  const isRemovedShapeTestRow = (relativeFile: string, line: string): boolean =>
    Str.equivalence(relativeFile, IDENTITY_SHAPE_TEST_PATH) &&
    O.exists(identityAccessor, (accessor) => O.exists(shapeTestRowAccessor(line), Str.equivalence(accessor)));
  const isIdentityRegistry = (relativeFile: string): boolean =>
    O.exists(identitySurface, (surface) => Str.equivalence(relativeFile, surface.registryFile));

  const sourceHits = (
    absoluteFile: string,
    relativeFile: string,
    owner: string,
    content: string
  ): ReadonlyArray<DependentHit> => {
    if (!isSuffixIn(SOURCE_SUFFIXES)(absoluteFile)) return A.empty<DependentHit>();
    const importHits = importHitsInFile(project, absoluteFile, relativeFile, owner, content, target);
    const accessorHits = isIdentityRegistry(relativeFile)
      ? A.empty<DependentHit>()
      : accessorHitsInFile(
          relativeFile,
          owner,
          content,
          (line) => mentionsAccessor(line) && !isRemovedShapeTestRow(relativeFile, line)
        );
    return A.appendAll(importHits, accessorHits);
  };
  const textHits = (relativeFile: string, owner: string, content: string): ReadonlyArray<DependentHit> =>
    needleLineHits(
      content,
      (line) => mentionsTarget(line) && !isRemovedShapeTestRow(relativeFile, line),
      (line, text) =>
        DependentHit.make({
          kind: authoredKindFor(relativeFile),
          owner,
          file: PosixPath.make(relativeFile),
          line: O.some(line),
          direct: true,
          text: O.some(text),
        })
    );
  const scanFile = Effect.fn("RegistrationGeometry.dependentsOfAtRoot.scanFile")(function* (relativeFile: string) {
    if (Str.startsWith(`${target.packagePath}/`)(relativeFile)) return A.empty<DependentHit>();
    const read = yield* readVisibleFile(repoRoot, relativeFile);
    if (O.isNone(read)) return A.empty<DependentHit>();
    const content = read.value;
    if (!mentionsTarget(content) && !mentionsAccessor(content)) return A.empty<DependentHit>();
    const absoluteFile = path.join(repoRoot, relativeFile);
    const owner = ownerForFile(absoluteFile, workspaces);
    return A.appendAll(sourceHits(absoluteFile, relativeFile, owner, content), textHits(relativeFile, owner, content));
  });

  const gitVisibleFiles = yield* gitVisibleFilesAt(repoRoot, acknowledgementFile);
  const visibleFiles = A.filter(gitVisibleFiles, isSuffixIn(TEXT_SUFFIXES));
  for (const root of SCAN_ROOTS) {
    for (const relativeFile of A.filter(visibleFiles, isUnderRoot(root))) {
      const scanFile4 = yield* scanFile(relativeFile);
      hits = A.appendAll(hits, scanFile4);
    }
  }

  const rootManifest = yield* decodedRootManifest(repoRoot);
  hits = A.appendAll(hits, rootScriptHits(toSortedRecord(rootManifest.scripts), mentionsTarget));
  const rootPolicyFileHits5 = yield* rootPolicyFileHits(repoRoot, mentionsTarget);
  hits = A.appendAll(hits, rootPolicyFileHits5);

  return DependentsReport.make({
    target,
    directWorkspaceDependents: A.sort(A.fromIterable(direct), Order.String),
    transitiveWorkspaceDependents: A.sort(A.fromIterable(transitive), Order.String),
    hits: dedupedSortedHits(hits),
  });
});
