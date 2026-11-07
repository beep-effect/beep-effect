/**
 * Repo-local entity kit freeze law.
 *
 * **Details**
 *
 * Decision D3 of `explorations/alchemy-domain-adoption/DECISIONS.md` forbids
 * the hand-rolled entity kit in `packages/shared/domain/src/entity/` in new
 * work. This law scans every git-tracked `.ts`/`.tsx` file under `packages/`
 * and `apps/` for an import or re-export of a frozen kit specifier, or of a
 * frozen kit binding of the `@beep/shared-domain` barrel, and compares the
 * importing files with the committed baseline
 * `standards/entity-kit-freeze.baseline.jsonc`. A file outside the baseline
 * fails; a baseline file that stopped importing the kit fails until
 * `--write` prunes it, so the baseline only ratchets down.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { formatJsonc, readArtifact, writeArtifact } from "@beep/repo-cli-kit/artifacts/index";
import { findRepoRoot } from "@beep/repo-utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as F from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  ENTITY_KIT_FREEZE_BASELINE_PATH,
  ENTITY_KIT_FREEZE_RULE_ID,
  ENTITY_KIT_FROZEN_SINCE,
  EntityKitFreezeBaseline,
  EntityKitFreezeFinding,
  EntityKitFreezeRule,
  EntityKitFreezeSummary,
  EntityKitImport,
  EntityKitImporter,
  entityKitFreezeBarrelSpecifier,
  entityKitFreezeExemptPaths,
  entityKitFrozenBarrelBindings,
  entityKitFrozenSpecifiers,
} from "./EntityKitFreeze.model.ts";
import {
  lineStartOffsets,
  locateIndex,
  messageGitErrorAdapter,
  scanTrackedTextFiles,
} from "./internal/TrackedTextFiles.ts";
import { EntityKitFreezeExecutionError } from "./Laws.errors.ts";
import type { Git } from "@beep/git/Git";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { EntityKitFreezeOptions } from "./EntityKitFreeze.model.ts";

/**
 * An `import`/`export` statement with a `from` clause. The clause admits only
 * identifiers, braces, commas, `*` and whitespace, so a match cannot run from
 * an unrelated keyword across code into a later `from`.
 */
const FROM_CLAUSE_PATTERN =
  /\b(?:import|export)\b(?<clause>[\w$\s{},*]*?)\bfrom\s*(?<quote>["'])(?<specifier>[^"'\r\n]+)\k<quote>/gu;

/** A side-effect `import "x"` or a dynamic / type-query `import("x")`. */
const BARE_IMPORT_PATTERN = /\bimport\s*\(?\s*(?<quote>["'])(?<specifier>[^"'\r\n]+)\k<quote>/gu;

/** The named-binding list of an import or export clause. */
const NAMED_BINDINGS_PATTERN = /\{(?<bindings>[^}]*)\}/u;

const BINDING_TYPE_PREFIX_PATTERN = /^type\s+/u;

const BINDING_ALIAS_PATTERN = /\s+as\s+/u;

/** Cheap pre-filter: every frozen specifier and the barrel contain this literal. */
const RULE_LITERAL = entityKitFreezeBarrelSpecifier;

const SCANNED_ROOTS = ["packages/", "apps/"];

const SCANNED_EXTENSIONS = [".ts", ".tsx"];

const KIT_DIRECTORY = "packages/shared/domain/src/entity/";

const EXCLUDED_SEGMENTS = ["node_modules", "dist"];

const WRITE_COMMAND = "bun run beep laws entity-kit-freeze --write";

const baselineHeader = A.join(
  [
    "// Entity kit freeze baseline (decision D3, explorations/alchemy-domain-adoption/DECISIONS.md).",
    "// Files listed here may keep importing the frozen entity kit in packages/shared/domain/src/entity/;",
    "// any other importer fails `bun run beep laws entity-kit-freeze --check`. The list only",
    `// ratchets down: \`${WRITE_COMMAND}\` prunes files that stopped`,
    "// importing the kit and never adds one.",
    "",
  ],
  "\n"
);

type RawImport = {
  readonly index: number;
  readonly match: string;
};

const byIndexAscending = Order.mapInput(Order.Number, (found: RawImport) => found.index);

const byFileAscending = Order.mapInput(Order.String, (importer: EntityKitImporter) => importer.file);

const byFindingFileAscending = Order.mapInput(Order.String, (finding: EntityKitFreezeFinding) => finding.file);

const isFrozenSpecifier = (specifier: string): boolean => A.contains(entityKitFrozenSpecifiers, specifier);

const bindingName = (binding: string): string =>
  F.pipe(
    Str.split(F.pipe(binding, Str.trim, Str.replace(BINDING_TYPE_PREFIX_PATTERN, "")), BINDING_ALIAS_PATTERN),
    A.headNonEmpty,
    Str.trim
  );

/**
 * The frozen kit bindings named in an import or export clause.
 *
 * **Example** (Read the frozen bindings of a clause)
 *
 * ```ts
 * import { frozenBarrelBindings } from "@beep/repo-cli/commands/Laws/EntityKitFreeze"
 *
 * console.log(frozenBarrelBindings(" { Principal, type ProductEntity as PE } ")) // [ "ProductEntity" ]
 * ```
 *
 * @param clause - Text between the `import`/`export` keyword and `from`.
 * @returns The frozen binding names in clause order.
 * @category utilities
 * @since 0.0.0
 */
export const frozenBarrelBindings = (clause: string): ReadonlyArray<string> =>
  F.pipe(
    O.fromNullishOr(NAMED_BINDINGS_PATTERN.exec(clause)?.groups?.bindings),
    O.map(
      F.flow(
        Str.split(","),
        A.map(bindingName),
        A.filter((name) => A.contains(entityKitFrozenBarrelBindings, name))
      )
    ),
    O.getOrElse(A.empty<string>)
  );

const fromClauseImports = (content: string): ReadonlyArray<RawImport> =>
  A.flatMap(A.fromIterable(F.pipe(content, Str.matchAll(FROM_CLAUSE_PATTERN))), (found): ReadonlyArray<RawImport> => {
    const index = found.index ?? 0;
    const specifier = found.groups?.specifier ?? "";
    if (isFrozenSpecifier(specifier)) {
      return [{ index, match: specifier }];
    }
    return specifier === entityKitFreezeBarrelSpecifier
      ? A.map(frozenBarrelBindings(found.groups?.clause ?? ""), (binding) => ({
          index,
          match: `${specifier} { ${binding} }`,
        }))
      : A.empty();
  });

const bareImports = (content: string): ReadonlyArray<RawImport> =>
  A.getSomes(
    A.map(A.fromIterable(F.pipe(content, Str.matchAll(BARE_IMPORT_PATTERN))), (found) =>
      F.pipe(
        O.fromNullishOr(found.groups?.specifier),
        O.filter(isFrozenSpecifier),
        O.map((specifier): RawImport => ({ index: found.index ?? 0, match: specifier }))
      )
    )
  );

/**
 * Find every import or re-export of the frozen entity kit in one file's text.
 *
 * **Details**
 *
 * Reports `import`/`export ... from` statements of a frozen specifier,
 * side-effect and dynamic imports of one, and `@beep/shared-domain` imports
 * or re-exports whose named bindings include a frozen kit binding (one entry
 * per binding). Surviving value-schema subpaths such as `entity/Principal`
 * and non-kit barrel bindings are ignored. Positions are 1-based.
 *
 * **Example** (Find a frozen subpath import)
 *
 * ```ts
 * import { findEntityKitImports } from "@beep/repo-cli/commands/Laws/EntityKitFreeze"
 *
 * const [found] = findEntityKitImports('import { make } from "@beep/shared-domain/entity/EntityKit"\n')
 * console.log(found?.match) // "@beep/shared-domain/entity/EntityKit"
 * ```
 *
 * **Example** (Ignore a surviving value schema)
 *
 * ```ts
 * import { findEntityKitImports } from "@beep/repo-cli/commands/Laws/EntityKitFreeze"
 *
 * console.log(findEntityKitImports('import * as P from "@beep/shared-domain/entity/Principal"').length) // 0
 * ```
 *
 * @param content - The file's text.
 * @returns Frozen-kit imports ordered by position.
 * @category utilities
 * @since 0.0.0
 */
export const findEntityKitImports = (content: string): ReadonlyArray<EntityKitImport> => {
  if (!F.pipe(content, Str.includes(RULE_LITERAL))) {
    return A.empty();
  }
  const lineStarts = lineStartOffsets(content);
  return F.pipe(
    A.appendAll(fromClauseImports(content), bareImports(content)),
    A.sort(byIndexAscending),
    A.map((found) => EntityKitImport.make({ ...locateIndex(lineStarts, found.index), match: found.match }))
  );
};

/**
 * Scan one file into its frozen-kit importer record, if it has any import.
 *
 * **Example** (Scan a barrel import)
 *
 * ```ts
 * import { scanEntityKitImporter } from "@beep/repo-cli/commands/Laws/EntityKitFreeze"
 *
 * const [importer] = scanEntityKitImporter("packages/demo/src/a.ts", 'import { ProductEntity } from "@beep/shared-domain"')
 * console.log(importer?.imports[0]?.match) // "@beep/shared-domain { ProductEntity }"
 * ```
 *
 * **Example** (Scan in a pipeline)
 *
 * ```ts
 * import { pipe } from "effect/Function"
 * import { scanEntityKitImporter } from "@beep/repo-cli/commands/Laws/EntityKitFreeze"
 *
 * console.log(pipe("packages/demo/src/b.ts", scanEntityKitImporter("export const b = 1")).length) // 0
 * ```
 *
 * @param file - Repository-relative path.
 * @param content - The file's text.
 * @returns One importer record, or none when the file does not import the kit.
 * @category utilities
 * @since 0.0.0
 */
export const scanEntityKitImporter: {
  (content: string): (file: string) => ReadonlyArray<EntityKitImporter>;
  (file: string, content: string): ReadonlyArray<EntityKitImporter>;
} = F.dual(
  2,
  (file: string, content: string): ReadonlyArray<EntityKitImporter> =>
    A.match(findEntityKitImports(content), {
      onEmpty: A.empty<EntityKitImporter>,
      onNonEmpty: (imports) => [EntityKitImporter.make({ file, imports })],
    })
);

/**
 * Whether the entity kit freeze law scans a repository-relative path.
 *
 * **Details**
 *
 * Scans `.ts`/`.tsx` files under `packages/` and `apps/`, except the kit
 * itself, any `node_modules` or `dist` segment, and the law's own files.
 *
 * **Example** (Classify paths)
 *
 * ```ts
 * import { isEntityKitFreezeScope } from "@beep/repo-cli/commands/Laws/EntityKitFreeze"
 *
 * console.log(isEntityKitFreezeScope("packages/iam/domain/src/User.ts")) // true
 * console.log(isEntityKitFreezeScope("packages/shared/domain/src/entity/EntityKit.ts")) // false
 * console.log(isEntityKitFreezeScope("docs/example.ts")) // false
 * ```
 *
 * @param file - Repository-relative path.
 * @returns `true` when the path is scanned.
 * @category predicates
 * @since 0.0.0
 */
export const isEntityKitFreezeScope = (file: string): boolean =>
  A.some(SCANNED_ROOTS, (root) => F.pipe(file, Str.startsWith(root))) &&
  A.some(SCANNED_EXTENSIONS, (extension) => F.pipe(file, Str.endsWith(extension))) &&
  !F.pipe(file, Str.startsWith(KIT_DIRECTORY)) &&
  !A.some(Str.split(file, "/"), (segment) => A.contains(EXCLUDED_SEGMENTS, segment)) &&
  !A.contains(entityKitFreezeExemptPaths, file);

/**
 * Compare the scanned importers with the baseline files.
 *
 * **Details**
 *
 * An importer outside the baseline is a `new-importer` finding carrying its
 * imports. A baseline file that is no longer an importer (it dropped the
 * import, moved out of scope or was deleted) is a `stale-baseline` finding.
 * Findings are ordered by file.
 *
 * **Example** (Detect a new importer and a stale baseline row)
 *
 * ```ts
 * import { diffEntityKitBaseline, scanEntityKitImporter } from "@beep/repo-cli/commands/Laws/EntityKitFreeze"
 *
 * const importers = scanEntityKitImporter("packages/demo/src/New.ts", 'import * as K from "@beep/shared-domain/entity"')
 * const findings = diffEntityKitBaseline(importers, ["packages/demo/src/Old.ts"])
 * console.log(findings.map((finding) => finding.rule)) // [ "new-importer", "stale-baseline" ]
 * ```
 *
 * **Example** (Compare in a pipeline)
 *
 * ```ts
 * import { pipe } from "effect/Function"
 * import { diffEntityKitBaseline } from "@beep/repo-cli/commands/Laws/EntityKitFreeze"
 *
 * console.log(pipe([], diffEntityKitBaseline(["packages/demo/src/Old.ts"]))[0]?.rule) // "stale-baseline"
 * ```
 *
 * @param importers - Scanned importer records.
 * @param baselineFiles - Files allowed to keep importing the kit.
 * @returns Findings ordered by file.
 * @category utilities
 * @since 0.0.0
 */
export const diffEntityKitBaseline: {
  (
    baselineFiles: ReadonlyArray<string>
  ): (importers: ReadonlyArray<EntityKitImporter>) => ReadonlyArray<EntityKitFreezeFinding>;
  (
    importers: ReadonlyArray<EntityKitImporter>,
    baselineFiles: ReadonlyArray<string>
  ): ReadonlyArray<EntityKitFreezeFinding>;
} = F.dual(
  2,
  (
    importers: ReadonlyArray<EntityKitImporter>,
    baselineFiles: ReadonlyArray<string>
  ): ReadonlyArray<EntityKitFreezeFinding> => {
    const allowed = HashSet.fromIterable(baselineFiles);
    const importing = HashSet.fromIterable(A.map(importers, (importer) => importer.file));
    const newImporters = A.map(
      A.filter(importers, (importer) => !HashSet.has(allowed, importer.file)),
      (importer) =>
        EntityKitFreezeFinding.make({ file: importer.file, rule: "new-importer", imports: importer.imports })
    );
    const stale = A.map(
      A.filter(A.dedupe(baselineFiles), (file) => !HashSet.has(importing, file)),
      (file) => EntityKitFreezeFinding.make({ file, rule: "stale-baseline" })
    );
    return A.sort(A.appendAll(newImporters, stale), byFindingFileAscending);
  }
);

/**
 * Prune a baseline to the files that still import the kit; it never adds a file.
 *
 * **Example** (Prune a stale row)
 *
 * ```ts
 * import { pruneEntityKitBaseline } from "@beep/repo-cli/commands/Laws/EntityKitFreeze"
 *
 * console.log(pruneEntityKitBaseline(["b.ts", "c.ts"], ["c.ts", "a.ts", "b.ts"])) // [ "b.ts", "c.ts" ]
 * ```
 *
 * **Example** (Prune in a pipeline)
 *
 * ```ts
 * import { pipe } from "effect/Function"
 * import { pruneEntityKitBaseline } from "@beep/repo-cli/commands/Laws/EntityKitFreeze"
 *
 * console.log(pipe(["a.ts"], pruneEntityKitBaseline(["a.ts", "z.ts"]))) // [ "a.ts" ]
 * ```
 *
 * @param importerFiles - Files that import the kit now.
 * @param baselineFiles - The committed baseline files.
 * @returns The sorted, deduplicated intersection.
 * @category utilities
 * @since 0.0.0
 */
export const pruneEntityKitBaseline: {
  (baselineFiles: ReadonlyArray<string>): (importerFiles: ReadonlyArray<string>) => ReadonlyArray<string>;
  (importerFiles: ReadonlyArray<string>, baselineFiles: ReadonlyArray<string>): ReadonlyArray<string>;
} = F.dual(2, (importerFiles: ReadonlyArray<string>, baselineFiles: ReadonlyArray<string>): ReadonlyArray<string> => {
  const importing = HashSet.fromIterable(importerFiles);
  return A.sort(
    A.filter(A.dedupe(baselineFiles), (file) => HashSet.has(importing, file)),
    Order.String
  );
});

/**
 * Render one finding as report lines.
 *
 * **Details**
 *
 * A `new-importer` renders one `file:line:col  new-importer  match` line per
 * import; a `stale-baseline` renders one line naming the prune command.
 *
 * **Example** (Format a new importer)
 *
 * ```ts
 * import { diffEntityKitBaseline, formatEntityKitFreezeFinding, scanEntityKitImporter } from "@beep/repo-cli/commands/Laws/EntityKitFreeze"
 *
 * const importers = scanEntityKitImporter("packages/demo/src/a.ts", 'import { ProductEntity } from "@beep/shared-domain"')
 * for (const finding of diffEntityKitBaseline(importers, [])) {
 *   console.log(formatEntityKitFreezeFinding(finding))
 *   // [ "packages/demo/src/a.ts:1:1  new-importer  @beep/shared-domain { ProductEntity }" ]
 * }
 * ```
 *
 * @param finding - The finding to render.
 * @returns Human-readable report lines.
 * @category utilities
 * @since 0.0.0
 */
export const formatEntityKitFreezeFinding = (finding: EntityKitFreezeFinding): ReadonlyArray<string> =>
  EntityKitFreezeRule.match(finding.rule, {
    "new-importer": () =>
      A.map(finding.imports, (found) => `${finding.file}:${found.line}:${found.column}  new-importer  ${found.match}`),
    "stale-baseline": () => [`${finding.file}  stale-baseline  no longer imports the kit; run ${WRITE_COMMAND}`],
  });

const encodeBaseline = S.encodeEffect(EntityKitFreezeBaseline);

const readBaseline = Effect.fn("EntityKitFreeze.readBaseline")(function* (
  absolutePath: string
): Effect.fn.Return<O.Option<EntityKitFreezeBaseline>, EntityKitFreezeExecutionError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const exists = yield* fs
    .exists(absolutePath)
    .pipe(EntityKitFreezeExecutionError.mapError(`Failed to stat ${ENTITY_KIT_FREEZE_BASELINE_PATH}`));
  if (!exists) {
    return O.none();
  }
  const baseline = yield* readArtifact({
    path: absolutePath,
    schema: EntityKitFreezeBaseline,
    onReadError: () => EntityKitFreezeExecutionError.new(`Failed to read ${ENTITY_KIT_FREEZE_BASELINE_PATH}.`),
    onDecodeError: () =>
      EntityKitFreezeExecutionError.new(
        `Failed to decode ${ENTITY_KIT_FREEZE_BASELINE_PATH} as an ${ENTITY_KIT_FREEZE_RULE_ID} baseline.`
      ),
  });
  return O.some(baseline);
});

const writeBaseline = Effect.fn("EntityKitFreeze.writeBaseline")(function* (
  absolutePath: string,
  baseline: EntityKitFreezeBaseline
): Effect.fn.Return<void, EntityKitFreezeExecutionError, FileSystem.FileSystem | Path.Path> {
  const encoded = yield* encodeBaseline(baseline).pipe(
    EntityKitFreezeExecutionError.mapError("Failed to encode the entity kit freeze baseline")
  );
  const body = yield* formatJsonc(encoded).pipe(
    EntityKitFreezeExecutionError.mapError("Failed to render the entity kit freeze baseline")
  );
  yield* writeArtifact({
    path: absolutePath,
    header: baselineHeader,
    body,
    onError: () => EntityKitFreezeExecutionError.new(`Failed to write ${ENTITY_KIT_FREEZE_BASELINE_PATH}.`),
  });
});

/**
 * Run the entity kit freeze law over the git-tracked package and app sources.
 *
 * **Details**
 *
 * Scans the tracked files in {@link isEntityKitFreezeScope}, reads the
 * committed baseline (a missing baseline is empty) and reports
 * {@link diffEntityKitBaseline}'s findings. With `write`, the baseline is
 * pruned to the files that still import the kit, or seeded from the scan when
 * no baseline exists yet, and written before the comparison; new importers
 * still fail, since `write` never admits one. `strictFailure` is set when
 * `strictCheck` or `write` is on and a finding remains.
 *
 * **Example** (Check the repository)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { EntityKitFreezeOptions } from "@beep/repo-cli/commands/Laws/EntityKitFreeze.model"
 * import { runEntityKitFreeze } from "@beep/repo-cli/commands/Laws/EntityKitFreeze"
 *
 * const program = Effect.map(
 *   runEntityKitFreeze(EntityKitFreezeOptions.make({ cwd: process.cwd(), strictCheck: true })),
 *   (summary) => summary.findings.length
 * )
 *
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param options - Repository location, strictness and write mode.
 * @returns Effect that scans the tracked sources and summarizes every finding.
 * @category utilities
 * @since 0.0.0
 */
export const runEntityKitFreeze = Effect.fn("EntityKitFreeze.runEntityKitFreeze")(function* (
  options: EntityKitFreezeOptions
): Effect.fn.Return<
  EntityKitFreezeSummary,
  EntityKitFreezeExecutionError,
  SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner | Git
> {
  const path = yield* Path.Path;
  const scan = yield* scanTrackedTextFiles({
    cwd: options.cwd,
    gitErrors: messageGitErrorAdapter(EntityKitFreezeExecutionError.new),
    mapError: EntityKitFreezeExecutionError.mapError,
    isSkipped: P.not(isEntityKitFreezeScope),
    scan: scanEntityKitImporter,
  });
  const repoRoot = yield* findRepoRoot(options.cwd).pipe(
    EntityKitFreezeExecutionError.mapError("Failed to locate the repository root")
  );
  const baselinePath = path.join(repoRoot, ENTITY_KIT_FREEZE_BASELINE_PATH);
  const committed = yield* readBaseline(baselinePath);
  const importers = A.sort(scan.findings, byFileAscending);
  const importerFiles = A.map(importers, (importer) => importer.file);
  const committedFiles = O.match(committed, { onNone: A.empty<string>, onSome: (baseline) => baseline.files });
  const baselineFiles = options.write
    ? O.match(committed, {
        onNone: () => importerFiles,
        onSome: (baseline) => pruneEntityKitBaseline(importerFiles, baseline.files),
      })
    : committedFiles;
  if (options.write) {
    yield* writeBaseline(
      baselinePath,
      EntityKitFreezeBaseline.make({
        version: 1,
        rule: ENTITY_KIT_FREEZE_RULE_ID,
        frozenSince: O.match(committed, {
          onNone: () => ENTITY_KIT_FROZEN_SINCE,
          onSome: (baseline) => baseline.frozenSince,
        }),
        files: baselineFiles,
      })
    );
  }
  const findings = diffEntityKitBaseline(importers, baselineFiles);
  return EntityKitFreezeSummary.make({
    scannedFiles: scan.scannedFiles,
    skippedBinaryFiles: scan.skippedBinaryFiles,
    outOfScopeFiles: scan.skippedFiles,
    importerFiles: A.length(importers),
    baselineFiles: A.length(baselineFiles),
    prunedFiles: options.write && O.isSome(committed) ? A.length(committedFiles) - A.length(baselineFiles) : 0,
    wroteBaseline: options.write,
    strictFailure: (options.strictCheck || options.write) && A.isReadonlyArrayNonEmpty(findings),
    findings,
  });
});
