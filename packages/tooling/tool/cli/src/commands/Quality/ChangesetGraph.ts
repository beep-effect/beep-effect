/**
 * Changeset package graph validation for release safety.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { A, Str } from "@beep/utils";
import { Console, Effect, FileSystem, flow, Order, Path, pipe } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { parseDocument } from "yaml";
import { runCaptured } from "../../internal/process/index.ts";
import { ChangesetGraphError } from "./Quality.errors.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";

/**
 * Public changeset graph error export.
 *
 * @category errors
 * @since 0.0.0
 */
export { ChangesetGraphError } from "./Quality.errors.ts";

const $I = $RepoCliId.create("commands/Quality/ChangesetGraph");

const changesetFrontmatterPattern = /^---\r?\n([\s\S]*?)\r?\n---/;
const nulSeparator = "\u0000";
const gitWorkspacePackageJsonPathspecs = ["package.json"] as const;
const retiredChangesetPackagesPath = "standards/changesets.retired-packages.json";

class ChangesetGraphWorkspacesObject extends S.Class<ChangesetGraphWorkspacesObject>(
  $I`ChangesetGraphWorkspacesObject`
)(
  {
    packages: S.Array(S.String).pipe(S.optionalKey),
  },
  $I.annote("ChangesetGraphWorkspacesObject", {
    description: "Object-form root package workspace declaration used by the changeset graph guard.",
  })
) {}

class ChangesetGraphPackageJson extends S.Class<ChangesetGraphPackageJson>($I`ChangesetGraphPackageJson`)(
  {
    name: S.optionalKey(S.String),
    workspaces: S.optionalKey(S.Union([S.Array(S.String), ChangesetGraphWorkspacesObject])),
  },
  $I.annote("ChangesetGraphPackageJson", {
    description: "Minimal package.json shape used by the changeset graph guard.",
  })
) {}

class RetiredChangesetPackageRecord extends S.Class<RetiredChangesetPackageRecord>($I`RetiredChangesetPackageRecord`)(
  {
    name: S.String,
    rationale: S.String,
  },
  $I.annote("RetiredChangesetPackageRecord", {
    description: "A retired package name that may still appear in pending historical changesets.",
  })
) {}

class RetiredChangesetPackages extends S.Class<RetiredChangesetPackages>($I`RetiredChangesetPackages`)(
  {
    packages: S.Array(RetiredChangesetPackageRecord),
  },
  $I.annote("RetiredChangesetPackages", {
    description: "Repo-owned retirement record for missing package names accepted by the changeset graph guard.",
  })
) {}

/**
 * A package name referenced by a changeset file.
 *
 * @example
 * ```ts
 * import { ChangesetGraphPackageReference } from "@beep/repo-cli/commands/Quality/ChangesetGraph"
 *
 * const reference = ChangesetGraphPackageReference.make({
 *   file: ".changeset/example.md",
 *   packageName: "@beep/schema"
 * })
 * console.log(reference.packageName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ChangesetGraphPackageReference extends S.Class<ChangesetGraphPackageReference>(
  $I`ChangesetGraphPackageReference`
)(
  {
    file: S.String,
    packageName: S.String,
  },
  $I.annote("ChangesetGraphPackageReference", {
    description: "A package name referenced by a changeset file.",
  })
) {}

/**
 * Summary emitted by the changeset package graph guard.
 *
 * @example
 * ```ts
 * import { ChangesetGraphSummary } from "@beep/repo-cli/commands/Quality/ChangesetGraph"
 *
 * const summary = ChangesetGraphSummary.make({
 *   workspacePackages: 1,
 *   changesetFiles: 1,
 *   references: 1,
 *   missingReferences: []
 * })
 * console.log(summary.workspacePackages)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ChangesetGraphSummary extends S.Class<ChangesetGraphSummary>($I`ChangesetGraphSummary`)(
  {
    workspacePackages: S.Finite,
    changesetFiles: S.Finite,
    references: S.Finite,
    missingReferences: S.Array(ChangesetGraphPackageReference),
  },
  $I.annote("ChangesetGraphSummary", {
    description: "Aggregate result emitted by the changeset package graph guard.",
  })
) {}

const decodePackageJson = S.decodeUnknownEffect(S.fromJsonString(ChangesetGraphPackageJson));
const decodeChangesetFrontmatter = S.decodeUnknownEffect(S.Record(S.String, S.Unknown));
const decodeRetiredChangesetPackages = S.decodeUnknownEffect(S.fromJsonString(RetiredChangesetPackages));

const byReferenceKeyAscending: Order.Order<ChangesetGraphPackageReference> = Order.mapInput(
  Order.String,
  (reference) => `${reference.file}${nulSeparator}${reference.packageName}`
);

const normalizePath = Str.replaceAll("\\", "/");
const stripTrailingSlashes = Str.replace(/\/+$/g, "");
const isReadmeChangeset = Str.endsWith("/README.md");

type ChangesetGraphWorkspaces = ChangesetGraphPackageJson["workspaces"];

const isWorkspacePatternArray = (value: Exclude<ChangesetGraphWorkspaces, undefined>): value is ReadonlyArray<string> =>
  A.isArray(value) && A.every(value, P.isString);

const toNulSeparatedLines: (output: string) => ReadonlyArray<string> = flow(
  Str.split(nulSeparator),
  A.map(Str.trim),
  A.filter(Str.isNonEmpty),
  A.dedupe,
  A.sort(Order.String)
);

const workspacePatternsFrom = (document: ChangesetGraphPackageJson): ReadonlyArray<string> => {
  if (P.isUndefined(document.workspaces)) {
    return A.empty<string>();
  }

  return isWorkspacePatternArray(document.workspaces)
    ? document.workspaces
    : (document.workspaces.packages ?? A.empty());
};

const packageJsonPathspecForWorkspacePattern = (pattern: string): string =>
  `:(glob)${pipe(pattern, normalizePath, stripTrailingSlashes)}/package.json`;

const extractFrontmatter = (content: string): O.Option<string> =>
  pipe(
    O.fromNullishOr(changesetFrontmatterPattern.exec(content)),
    O.flatMap((match) => O.fromNullishOr(match[1]))
  );

const collectGitOutput = Effect.fn("ChangesetGraph.collectGitOutput")(function* (
  repoRoot: string,
  args: ReadonlyArray<string>
): Effect.fn.Return<string, ChangesetGraphError, ChildProcessSpawner.ChildProcessSpawner> {
  const result = yield* runCaptured({
    command: "git",
    args,
    cwd: repoRoot,
    source: "stdout",
  }).pipe(ChangesetGraphError.mapError(`Failed to run git ${A.join(args, " ")}.`));
  if (result.exitCode !== 0) {
    return yield* ChangesetGraphError.make({
      message: `git ${A.join(args, " ")} failed with exit code ${result.exitCode}.`,
    });
  }
  return result.output;
});

const readPackageJson = Effect.fn("ChangesetGraph.readPackageJson")(function* (
  filePath: string
): Effect.fn.Return<ChangesetGraphPackageJson, ChangesetGraphError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const content = yield* fs
    .readFileString(filePath)
    .pipe(ChangesetGraphError.mapError(`Failed to read package manifest ${filePath}.`, filePath));

  return yield* decodePackageJson(content).pipe(
    ChangesetGraphError.mapError(`Failed to parse package manifest ${filePath}.`, filePath)
  );
});

const readRetiredChangesetPackageNames = Effect.fn("ChangesetGraph.readRetiredChangesetPackageNames")(function* (
  repoRoot: string
): Effect.fn.Return<ReadonlyArray<string>, ChangesetGraphError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const filePath = path.join(repoRoot, retiredChangesetPackagesPath);
  const exists = yield* fs
    .exists(filePath)
    .pipe(
      ChangesetGraphError.mapError(`Failed to inspect ${retiredChangesetPackagesPath}.`, retiredChangesetPackagesPath)
    );

  if (!exists) {
    return A.empty<string>();
  }

  const content = yield* fs
    .readFileString(filePath)
    .pipe(
      ChangesetGraphError.mapError(`Failed to read ${retiredChangesetPackagesPath}.`, retiredChangesetPackagesPath)
    );
  const record = yield* decodeRetiredChangesetPackages(content).pipe(
    ChangesetGraphError.mapError(`Failed to parse ${retiredChangesetPackagesPath}.`, retiredChangesetPackagesPath)
  );

  return pipe(
    record.packages,
    A.map((entry) => entry.name),
    A.filter(Str.isNonEmpty),
    A.dedupe,
    A.sort(Order.String)
  );
});

const collectWorkspacePackageJsonFiles = Effect.fn("ChangesetGraph.collectWorkspacePackageJsonFiles")(function* (
  repoRoot: string
): Effect.fn.Return<
  ReadonlyArray<string>,
  ChangesetGraphError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const path = yield* Path.Path;
  const rootPackageJson = yield* readPackageJson(path.join(repoRoot, "package.json"));
  const workspacePathspecs = pipe(
    workspacePatternsFrom(rootPackageJson),
    A.map(packageJsonPathspecForWorkspacePattern)
  );
  const output = yield* collectGitOutput(repoRoot, [
    "ls-files",
    "-z",
    "--",
    ...gitWorkspacePackageJsonPathspecs,
    ...workspacePathspecs,
  ]);

  return pipe(
    toNulSeparatedLines(output),
    A.filter((file) => file !== "package.json")
  );
});

const collectWorkspacePackageNames = Effect.fn("ChangesetGraph.collectWorkspacePackageNames")(function* (
  repoRoot: string
): Effect.fn.Return<
  ReadonlyArray<string>,
  ChangesetGraphError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const path = yield* Path.Path;
  const packageJsonFiles = yield* collectWorkspacePackageJsonFiles(repoRoot);
  const names = yield* Effect.forEach(
    packageJsonFiles,
    Effect.fn(function* (file) {
      const document = yield* readPackageJson(path.join(repoRoot, file));
      if (P.isUndefined(document.name)) {
        return yield* ChangesetGraphError.make({
          message: `Workspace package manifest ${file} does not declare a package name.`,
          file,
        });
      }
      return document.name;
    }),
    { concurrency: 8 }
  );

  return pipe(names, A.dedupe, A.sort(Order.String));
});

const collectChangesetFiles = Effect.fn("ChangesetGraph.collectChangesetFiles")(function* (
  repoRoot: string
): Effect.fn.Return<
  ReadonlyArray<string>,
  ChangesetGraphError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const output = yield* collectGitOutput(repoRoot, ["ls-files", "-z", "--", ":(glob).changeset/*.md"]);
  const trackedFiles = pipe(
    toNulSeparatedLines(output),
    A.filter((file) => !isReadmeChangeset(file)),
    A.sort(Order.String)
  );
  const existingFiles = yield* Effect.forEach(
    trackedFiles,
    Effect.fn(function* (file) {
      const exists = yield* fs
        .exists(path.join(repoRoot, file))
        .pipe(ChangesetGraphError.mapError(`Failed to inspect changeset file ${file}.`, file));
      return exists ? O.some(file) : O.none<string>();
    }),
    { concurrency: 8 }
  );

  return pipe(
    existingFiles,
    A.filter(O.isSome),
    A.map((option) => option.value),
    A.sort(Order.String)
  );
});

/**
 * Parse package references from one changeset Markdown document.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { changesetPackageReferencesFromText } from "@beep/repo-cli/commands/Quality/ChangesetGraph"
 *
 * const program = changesetPackageReferencesFromText(
 *   ".changeset/example.md",
 *   "---\n\"@beep/schema\": patch\n---\n\nPatch schema."
 * )
 * Effect.runPromise(program)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const changesetPackageReferencesFromText = Effect.fn("ChangesetGraph.changesetPackageReferencesFromText")(
  function* (
    file: string,
    content: string
  ): Effect.fn.Return<ReadonlyArray<ChangesetGraphPackageReference>, ChangesetGraphError> {
    const frontmatter = extractFrontmatter(content);

    if (O.isNone(frontmatter)) {
      return A.empty<ChangesetGraphPackageReference>();
    }

    const document = yield* Effect.try({
      try: () => parseDocument(frontmatter.value),
      catch: (cause) => ChangesetGraphError.new(cause, `Failed to parse changeset frontmatter in ${file}.`, file),
    });

    if (!A.isReadonlyArrayEmpty(document.errors)) {
      const message = pipe(
        A.head(document.errors),
        O.map((error) => error.message),
        O.getOrElse(() => "YAML parser reported an unknown error.")
      );
      return yield* ChangesetGraphError.make({
        message: `Invalid changeset frontmatter in ${file}: ${message}`,
        file,
      });
    }

    const value = yield* Effect.try({
      try: () => document.toJSON(),
      catch: (cause) => ChangesetGraphError.new(cause, `Failed to read changeset frontmatter in ${file}.`, file),
    });

    if (P.isNullish(value)) {
      return A.empty<ChangesetGraphPackageReference>();
    }

    const decoded = yield* decodeChangesetFrontmatter(value).pipe(
      ChangesetGraphError.mapError(`Changeset frontmatter in ${file} must be a package bump mapping.`, file)
    );

    return pipe(
      R.keys(decoded),
      A.filter(Str.isNonEmpty),
      A.map((packageName) => ChangesetGraphPackageReference.make({ file, packageName })),
      A.sort(byReferenceKeyAscending)
    );
  }
);

const collectChangesetPackageReferences = Effect.fn("ChangesetGraph.collectChangesetPackageReferences")(function* (
  repoRoot: string,
  files: ReadonlyArray<string>
): Effect.fn.Return<
  ReadonlyArray<ChangesetGraphPackageReference>,
  ChangesetGraphError,
  FileSystem.FileSystem | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const references = yield* Effect.forEach(
    files,
    Effect.fn(function* (file) {
      const content = yield* fs
        .readFileString(path.join(repoRoot, file))
        .pipe(ChangesetGraphError.mapError(`Failed to read changeset file ${file}.`, file));
      return yield* changesetPackageReferencesFromText(file, content);
    }),
    { concurrency: 8 }
  );

  return pipe(A.flatten(references), A.sort(byReferenceKeyAscending));
});

/**
 * Find changeset package references that are not in the workspace graph.
 *
 * @param workspacePackageNames - Current workspace package names.
 * @param references - Package references parsed from changeset files.
 * @returns References that do not resolve to a workspace package.
 * @example
 * ```ts
 * import { ChangesetGraphPackageReference, findMissingChangesetPackageReferences } from "@beep/repo-cli/commands/Quality/ChangesetGraph"
 *
 * const missing = findMissingChangesetPackageReferences(
 *   ["@beep/schema"],
 *   [ChangesetGraphPackageReference.make({ file: ".changeset/demo.md", packageName: "@beep/missing" })]
 * )
 * console.log(missing.length)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const findMissingChangesetPackageReferences: {
  (
    references: ReadonlyArray<ChangesetGraphPackageReference>
  ): (workspacePackageNames: ReadonlyArray<string>) => ReadonlyArray<ChangesetGraphPackageReference>;
  (
    workspacePackageNames: ReadonlyArray<string>,
    references: ReadonlyArray<ChangesetGraphPackageReference>
  ): ReadonlyArray<ChangesetGraphPackageReference>;
} = dual(
  2,
  (
    workspacePackageNames: ReadonlyArray<string>,
    references: ReadonlyArray<ChangesetGraphPackageReference>
  ): ReadonlyArray<ChangesetGraphPackageReference> =>
    findMissingChangesetPackageReferencesWithAllowedMissing(workspacePackageNames, A.empty(), references)
);

const findMissingChangesetPackageReferencesWithAllowedMissing = (
  workspacePackageNames: ReadonlyArray<string>,
  allowedMissingPackageNames: ReadonlyArray<string>,
  references: ReadonlyArray<ChangesetGraphPackageReference>
): ReadonlyArray<ChangesetGraphPackageReference> =>
  pipe(
    references,
    A.filter(
      (reference) =>
        !A.some(allowedMissingPackageNames, (packageName) => packageName === reference.packageName) &&
        !A.some(workspacePackageNames, (packageName) => packageName === reference.packageName)
    ),
    A.dedupeWith((left, right) => left.file === right.file && left.packageName === right.packageName),
    A.sort(byReferenceKeyAscending)
  );

const makeSummaryWithAllowedMissing = (
  workspacePackageNames: ReadonlyArray<string>,
  allowedMissingPackageNames: ReadonlyArray<string>,
  changesetFiles: ReadonlyArray<string>,
  references: ReadonlyArray<ChangesetGraphPackageReference>
): ChangesetGraphSummary =>
  ChangesetGraphSummary.make({
    workspacePackages: A.length(workspacePackageNames),
    changesetFiles: A.length(changesetFiles),
    references: A.length(references),
    missingReferences: findMissingChangesetPackageReferencesWithAllowedMissing(
      workspacePackageNames,
      allowedMissingPackageNames,
      references
    ),
  });

const makeSummary = (
  workspacePackageNames: ReadonlyArray<string>,
  changesetFiles: ReadonlyArray<string>,
  references: ReadonlyArray<ChangesetGraphPackageReference>
): ChangesetGraphSummary => makeSummaryWithAllowedMissing(workspacePackageNames, A.empty(), changesetFiles, references);

/**
 * Build a changeset graph summary from already-collected inputs.
 *
 * @example
 * ```ts
 * import { makeChangesetGraphSummary } from "@beep/repo-cli/commands/Quality/ChangesetGraph"
 *
 * const summary = makeChangesetGraphSummary(["@beep/schema"], [".changeset/demo.md"], [])
 * console.log(summary.changesetFiles)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const makeChangesetGraphSummary: {
  (
    changesetFiles: ReadonlyArray<string>,
    references: ReadonlyArray<ChangesetGraphPackageReference>
  ): (workspacePackageNames: ReadonlyArray<string>) => ChangesetGraphSummary;
  (
    workspacePackageNames: ReadonlyArray<string>,
    changesetFiles: ReadonlyArray<string>,
    references: ReadonlyArray<ChangesetGraphPackageReference>
  ): ChangesetGraphSummary;
} = dual(3, makeSummary);

/**
 * Run the non-mutating changeset package graph guard.
 *
 * @example
 * ```ts
 * import { runChangesetGraphCheck } from "@beep/repo-cli/commands/Quality/ChangesetGraph"
 *
 * const program = runChangesetGraphCheck(process.cwd())
 * console.log(program) // example value
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const runChangesetGraphCheck = Effect.fn("ChangesetGraph.runChangesetGraphCheck")(function* (
  repoRoot: string
): Effect.fn.Return<
  ChangesetGraphSummary,
  ChangesetGraphError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const workspacePackageNames = yield* collectWorkspacePackageNames(repoRoot);
  const allowedMissingPackageNames = yield* readRetiredChangesetPackageNames(repoRoot);
  const changesetFiles = yield* collectChangesetFiles(repoRoot);
  const references = yield* collectChangesetPackageReferences(repoRoot, changesetFiles);
  const summary = makeSummaryWithAllowedMissing(
    workspacePackageNames,
    allowedMissingPackageNames,
    changesetFiles,
    references
  );

  yield* Console.log(
    `[changeset-graph] workspace_packages=${summary.workspacePackages} changeset_files=${summary.changesetFiles} references=${summary.references} missing_references=${A.length(summary.missingReferences)}`
  );

  if (!A.isReadonlyArrayEmpty(summary.missingReferences)) {
    yield* Console.error("[changeset-graph] changeset package references outside current workspace graph:");
    for (const reference of summary.missingReferences) {
      yield* Console.error(`- ${reference.file} :: ${reference.packageName}`);
    }
    return yield* ChangesetGraphError.make({
      message: "Changeset package graph validation failed.",
    });
  }

  return summary;
});
