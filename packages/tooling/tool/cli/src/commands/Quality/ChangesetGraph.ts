/**
 * Changeset package graph validation for release safety.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { GlobSet } from "@beep/glob/GlobSet";
import { $RepoCliId } from "@beep/identity/packages";
import { FrontmatterSource } from "@beep/markdown/FrontmatterSource";
import { FrontmatterFormat } from "@beep/markdown/MarkdownNode";
import { WorkspacePatterns } from "@beep/repo-workspaces/WorkspacePatterns";
import { LiteralKit } from "@beep/schema";
import { A, Str } from "@beep/utils";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, flow, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { parseDocument } from "yaml";
import { manifestParser } from "../../internal/ManifestRead.ts";
import { runCaptured } from "../../internal/process/index.ts";
import { ChangesetGraphError } from "./Quality.errors.ts";
import type { LenientManifest } from "@beep/package-json/LenientManifest";
import type * as Crypto from "effect/Crypto";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";

/**
 * Public changeset graph error export.
 *
 * @category errors
 * @since 0.0.0
 */
export { ChangesetGraphError } from "./Quality.errors.ts";

const $I = $RepoCliId.create("commands/Quality/ChangesetGraph");

const nulSeparator = "\u0000";
const gitTrackedPackageJsonPathspecs = [":(glob)**/package.json"] as const;
const retiredChangesetPackagesPath = "standards/changesets.retired-packages.json";

class RetiredChangesetPackageRecord extends S.Opaque<
  RetiredChangesetPackageRecord,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    name: S.String,
    rationale: S.String,
  }).pipe(
    $I.annoteSchema("RetiredChangesetPackageRecord", {
      description: "A retired package name that may still appear in pending historical changesets.",
    })
  )
) {}

class RetiredChangesetPackages extends S.Opaque<RetiredChangesetPackages, { readonly brand: unique symbol }>()(
  S.Struct({
    packages: S.Array(RetiredChangesetPackageRecord),
  }).pipe(
    $I.annoteSchema("RetiredChangesetPackages", {
      description: "Repo-owned retirement record for missing package names accepted by the changeset graph guard.",
    })
  )
) {}

/**
 * A package name referenced by a changeset file.
 *
 * **Example** (Make package reference)
 *
 * ```ts
 * import { ChangesetGraphPackageReference } from "@beep/repo-cli/commands/Quality/ChangesetGraph"
 *
 * const reference = ChangesetGraphPackageReference.make({
 *   file: ".changeset/example.md",
 *   packageName: "@beep/schema"
 * })
 * console.log(reference.packageName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ChangesetGraphPackageReference extends S.Opaque<
  ChangesetGraphPackageReference,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    file: S.String,
    packageName: S.String,
  }).pipe(
    $I.annoteSchema("ChangesetGraphPackageReference", {
      description: "A package name referenced by a changeset file.",
    })
  )
) {}

/**
 * Summary emitted by the changeset package graph guard.
 *
 * **Example** (Make graph summary)
 *
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
 *
 * @category models
 * @since 0.0.0
 */
export class ChangesetGraphSummary extends S.Opaque<ChangesetGraphSummary, { readonly brand: unique symbol }>()(
  S.Struct({
    workspacePackages: S.Finite,
    changesetFiles: S.Finite,
    references: S.Finite,
    missingReferences: S.Array(ChangesetGraphPackageReference),
  }).pipe(
    $I.annoteSchema("ChangesetGraphSummary", {
      description: "Aggregate result emitted by the changeset package graph guard.",
    })
  )
) {}

const ChangesetBumpKind = LiteralKit(["major", "minor", "patch"]);

const parseWorkspacePackageJson = manifestParser(["name", "private"]);
const decodeChangesetFrontmatter = S.decodeUnknownEffect(S.Record(S.String, ChangesetBumpKind));
const decodeRetiredChangesetPackages = S.decodeUnknownEffect(S.fromJsonString(RetiredChangesetPackages));

const byReferenceKeyAscending: Order.Order<ChangesetGraphPackageReference> = Order.mapInput(
  Order.String,
  (reference) => `${reference.file}${nulSeparator}${reference.packageName}`
);

const normalizePath = Str.replaceAll("\\", "/");
const stripTrailingSlashes = Str.replace(/\/+$/g, "");
const isReadmeChangeset = Str.endsWith("/README.md");

const toNulSeparatedLines: (output: string) => ReadonlyArray<string> = flow(
  Str.split(nulSeparator),
  A.map(Str.trim),
  A.filter(Str.isNonEmpty),
  A.dedupe,
  A.sort(Order.String)
);

/**
 * The root's workspace patterns through `@beep/repo-workspaces` (4-A2): a
 * non-empty `pnpm-workspace.yaml` `packages:` list first, else the root
 * `package.json` `workspaces` field in either shape.
 */
const readWorkspacePatterns = Effect.fn("ChangesetGraph.readWorkspacePatterns")(function* (
  repoRoot: string
): Effect.fn.Return<ReadonlyArray<string>, ChangesetGraphError, FileSystem.FileSystem | Path.Path> {
  return yield* WorkspacePatterns.read(repoRoot).pipe(
    Effect.mapError((error) => ChangesetGraphError.new(error, error.message, error.path))
  );
});

// `git ls-files` prints repo-relative paths without a `./` prefix, so a `./packages/*` entry
// (which git pathspecs used to accept) drops its leading dot segments before compiling.
const stripLeadingDotSegments = Str.replace(/^(?:\.\/)+/, "");

const packageJsonGlob = (pattern: string): string =>
  `${pipe(pattern, normalizePath, stripLeadingDotSegments, stripTrailingSlashes)}/package.json`;

// `<pattern>/package.json` for one workspace entry; a `!pattern` keeps its bang,
// so the set reads it as an exclusion. Git pathspecs expand neither braces nor
// a leading `!`, so the tracked manifests are matched here, not by git.
const packageJsonGlobForWorkspacePattern = (pattern: string): string =>
  Str.startsWith("!")(pattern) ? `!${packageJsonGlob(Str.slice(1)(pattern))}` : packageJsonGlob(pattern);

/**
 * Find the closing fence accepted by `@changesets/parse` in one forward line scan.
 * The opening `---` can appear anywhere on its line; a later closing fence
 * permits indentation and trailing whitespace. Each line is visited once,
 * including malformed files with many opening candidates and no closing fence.
 *
 * **Example** (Find an indented closing fence)
 *
 * ```ts
 * import { changesetsParseClosingFenceLine } from "@beep/repo-cli/test/Quality"
 *
 * console.log(changesetsParseClosingFenceLine(["---", "  ---"]))
 * ```
 *
 * @param lines - Source lines split on newline, including any carriage returns.
 * @returns The 1-based closing fence line, if a frontmatter pair exists.
 * @category parsing
 * @since 0.0.0
 */
export const changesetsParseClosingFenceLine = (lines: Iterable<string>): O.Option<number> => {
  let opened = false;
  let lineNumber = 0;
  for (const line of lines) {
    lineNumber += 1;
    if (opened && Str.trim(line) === "---") {
      return O.some(lineNumber);
    }
    opened ||= Str.includes("---")(line);
  }
  return O.none();
};

const collectGitOutput = Effect.fn("ChangesetGraph.collectGitOutput")(function* (
  repoRoot: string,
  args: ReadonlyArray<string>
): Effect.fn.Return<string, ChangesetGraphError, Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner> {
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

const readPackageJsonText = Effect.fn("ChangesetGraph.readPackageJsonText")(function* (
  filePath: string
): Effect.fn.Return<string, ChangesetGraphError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs
    .readFileString(filePath)
    .pipe(ChangesetGraphError.mapError(`Failed to read package manifest ${filePath}.`, filePath));
});

/**
 * Read the `name` and `private` flag of one workspace `package.json` text.
 *
 * **Details**
 *
 * A present `name` or `private` must keep its JSON shape; other malformed
 * fields stay `LenientManifest` issues. Strict JSON only: JSONC text fails.
 *
 * **Example** (Read a private workspace manifest)
 *
 * ```ts
 * import { readChangesetGraphWorkspaceManifest } from "@beep/repo-cli/test/Quality"
 * import * as Effect from "effect/Effect"
 *
 * const manifest = Effect.runSync(
 *   readChangesetGraphWorkspaceManifest('{"name":"@beep/demo","private":true}', "packages/demo/package.json")
 * )
 * console.log(manifest.name, manifest.isPrivate) // @beep/demo true
 * ```
 *
 * @param content - Workspace `package.json` text.
 * @param filePath - Path named in a failure.
 * @returns The workspace manifest through `LenientManifest`.
 * @category parsing
 * @since 0.0.0
 */
export const readChangesetGraphWorkspaceManifest = Effect.fn("ChangesetGraph.readChangesetGraphWorkspaceManifest")(
  function* (content: string, filePath: string): Effect.fn.Return<LenientManifest, ChangesetGraphError> {
    return yield* parseWorkspacePackageJson(content).pipe(
      ChangesetGraphError.mapError(`Failed to parse package manifest ${filePath}.`, filePath)
    );
  }
);

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

/**
 * Collect the repo-relative workspace `package.json` paths declared by the
 * root workspace globs.
 *
 * **Details**
 *
 * The catalog is the tracked `package.json` files (`git ls-files`) that the
 * root workspace patterns select, matched as `<pattern>/package.json` by a
 * `@beep/glob` `GlobSet` with the defaults `WorkspaceDiscovery` compiles, so
 * braces, globstars and `!` exclusions read as the package managers read them.
 * It names exactly the tracked workspace manifests — the same derivation the
 * changeset graph guard uses. The path-aware changeset status wrapper reuses
 * it so both lanes agree on workspace membership.
 *
 * **Example** (Collect workspace manifests)
 *
 * ```ts
 * import { collectWorkspacePackageJsonFiles } from "@beep/repo-cli/commands/Quality/ChangesetGraph"
 *
 * const program = collectWorkspacePackageJsonFiles(process.cwd())
 * console.log(program) // example value
 * ```
 *
 * @param repoRoot - Repository root used as the git working directory.
 * @returns Sorted repo-relative workspace `package.json` paths (root excluded).
 * @category utilities
 * @since 0.0.0
 */
export const collectWorkspacePackageJsonFiles = Effect.fn("ChangesetGraph.collectWorkspacePackageJsonFiles")(function* (
  repoRoot: string
): Effect.fn.Return<
  ReadonlyArray<string>,
  ChangesetGraphError,
  FileSystem.FileSystem | Path.Path | Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner
> {
  const workspaceManifests = yield* GlobSet.compile(
    A.map(yield* readWorkspacePatterns(repoRoot), packageJsonGlobForWorkspacePattern)
  ).pipe(Effect.mapError((error) => ChangesetGraphError.new(error, error.message)));
  const output = yield* collectGitOutput(repoRoot, ["ls-files", "-z", "--", ...gitTrackedPackageJsonPathspecs]);

  return pipe(
    toNulSeparatedLines(output),
    A.filter((file) => file !== "package.json" && workspaceManifests.matches(file))
  );
});

const collectWorkspacePackages = Effect.fn("ChangesetGraph.collectWorkspacePackages")(function* (
  repoRoot: string
): Effect.fn.Return<
  ReadonlyArray<LenientManifest>,
  ChangesetGraphError,
  FileSystem.FileSystem | Path.Path | Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner
> {
  const path = yield* Path.Path;
  const packageJsonFiles = yield* collectWorkspacePackageJsonFiles(repoRoot);
  const documents = yield* Effect.forEach(
    packageJsonFiles,
    Effect.fn(function* (file) {
      const filePath = path.join(repoRoot, file);
      const document = yield* readChangesetGraphWorkspaceManifest(yield* readPackageJsonText(filePath), filePath);
      if (P.isUndefined(document.name)) {
        return yield* ChangesetGraphError.make({
          message: `Workspace package manifest ${file} does not declare a package name.`,
          file,
        });
      }
      return document;
    }),
    { concurrency: 8 }
  );

  return documents;
});

const collectChangesetFiles = Effect.fn("ChangesetGraph.collectChangesetFiles")(function* (
  repoRoot: string
): Effect.fn.Return<
  ReadonlyArray<string>,
  ChangesetGraphError,
  FileSystem.FileSystem | Path.Path | Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner
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
 * **Example** (Parse references from Markdown)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import { changesetPackageReferencesFromText } from "@beep/repo-cli/commands/Quality/ChangesetGraph"
 *
 * const program = changesetPackageReferencesFromText(
 *   ".changeset/example.md",
 *   "---\n\"@beep/schema\": patch\n---\n\nPatch schema."
 * )
 * Effect.runPromise(program)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const changesetPackageReferencesFromText = Effect.fn("ChangesetGraph.changesetPackageReferencesFromText")(
  function* (
    file: string,
    content: string
  ): Effect.fn.Return<ReadonlyArray<ChangesetGraphPackageReference>, ChangesetGraphError> {
    const frontmatter = pipe(
      O.fromUndefinedOr(FrontmatterSource.split(content).frontmatter),
      O.filter((block) => FrontmatterFormat.is.yaml(block.format)),
      O.map((block) => block.value)
    );

    if (O.isNone(frontmatter)) {
      const closingFenceLine = changesetsParseClosingFenceLine(Str.split(content, "\n"));
      if (O.isSome(closingFenceLine)) {
        return yield* ChangesetGraphError.make({
          message: `Changeset frontmatter in ${file} closes on line ${closingFenceLine.value} for @changesets/parse, but the shared frontmatter grammar reads no YAML block; open the file with a --- line at offset 0 and close the block with an unindented --- line.`,
          file,
        });
      }
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
      ChangesetGraphError.mapError(
        `Changeset frontmatter in ${file} must map package names to major | minor | patch bumps.`,
        file
      )
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
 * **Example** (Find missing package references)
 *
 * ```ts
 * import { ChangesetGraphPackageReference, findMissingChangesetPackageReferences } from "@beep/repo-cli/commands/Quality/ChangesetGraph"
 *
 * const missing = findMissingChangesetPackageReferences(
 *   ["@beep/schema"],
 *   [ChangesetGraphPackageReference.make({ file: ".changeset/demo.md", packageName: "@beep/missing" })]
 * )
 * console.log(missing.length)
 * ```
 *
 * @param workspacePackageNames - Current workspace package names.
 * @param references - Package references parsed from changeset files.
 * @returns References that do not resolve to a workspace package.
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
 * **Example** (Build summary from inputs)
 *
 * ```ts
 * import { makeChangesetGraphSummary } from "@beep/repo-cli/commands/Quality/ChangesetGraph"
 *
 * const summary = makeChangesetGraphSummary(["@beep/schema"], [".changeset/demo.md"], [])
 * console.log(summary.changesetFiles)
 * ```
 *
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
 * **Example** (Run changeset graph check)
 *
 * ```ts
 * import { runChangesetGraphCheck } from "@beep/repo-cli/commands/Quality/ChangesetGraph"
 *
 * const program = runChangesetGraphCheck(process.cwd())
 * console.log(program) // example value
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const runChangesetGraphCheck = Effect.fn("ChangesetGraph.runChangesetGraphCheck")(function* (
  repoRoot: string
): Effect.fn.Return<
  ChangesetGraphSummary,
  ChangesetGraphError,
  FileSystem.FileSystem | Path.Path | Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner
> {
  const workspaces = yield* collectWorkspacePackages(repoRoot);
  const workspacePackageNames = pipe(
    A.map(workspaces, (document) => O.fromUndefinedOr(document.name)),
    A.getSomes,
    A.dedupe,
    A.sort(Order.String)
  );
  const privatePackageNames = pipe(
    A.map(
      A.filter(workspaces, (document) => document.private === true),
      (document) => O.fromUndefinedOr(document.name)
    ),
    A.getSomes,
    A.dedupe,
    A.sort(Order.String)
  );
  const allowedMissingPackageNames = yield* readRetiredChangesetPackageNames(repoRoot);
  const changesetFiles = yield* collectChangesetFiles(repoRoot);
  const references = yield* collectChangesetPackageReferences(repoRoot, changesetFiles);
  const privateReferences = A.filter(references, (reference) => A.contains(privatePackageNames, reference.packageName));
  if (!A.isReadonlyArrayEmpty(privateReferences)) {
    yield* Console.error("[changeset-graph] private workspace changesets are forbidden:");
    for (const reference of privateReferences) {
      yield* Console.error(`- ${reference.file} :: ${reference.packageName}`);
    }
    return yield* ChangesetGraphError.make({
      message: "Changeset package graph validation failed: private workspaces must not accumulate release notes.",
    });
  }
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
