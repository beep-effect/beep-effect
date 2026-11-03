/** Full syntax-only Effect Vitest scan and ratchet orchestration. @packageDocumentation @since 0.0.0 */

import { failWithReportedExit } from "@beep/repo-cli-kit/cli/ExitCodeError";
import { createWorkspaceOwnerResolver } from "@beep/repo-cli-kit/tsmorph/index";
import { findRepoRoot } from "@beep/repo-utils";
import { FsUtils, GlobOptions } from "@beep/repo-utils/FsUtils";
import { toPosixPath } from "@beep/repo-utils/schemas/TypeScriptSourceExclusions";
import { A, Str } from "@beep/utils";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Inspectable from "effect/Inspectable";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { Node, Project, SyntaxKind } from "ts-morph";
import { EffectVitestLintError } from "../Lint.errors.ts";
import {
  EffectVitestCensusRow,
  EffectVitestFinding,
  EffectVitestInventoryDocument,
  EffectVitestScanTiming,
  EffectVitestSourceFileGlobs,
  isEffectVitestTestFilePath,
  makeEffectVitestFindingKey,
} from "../Lint.schemas.ts";
import { detectEffectVitestFindings } from "./EffectVitestDetectors.ts";
import { applyEffectVitestPrimitiveGraph } from "./EffectVitestPolicy.ts";
import { readEffectVitestPrimitiveGraph } from "./EffectVitestPrimitives.ts";
import {
  readEffectVitestInventory,
  writeEffectVitestCensus,
  writeEffectVitestInventory,
  writeEffectVitestRows,
} from "./EffectVitestStore.ts";
import type { Node as MorphNode, ObjectLiteralExpression, SourceFile } from "ts-morph";
import type { EffectVitestLintOptions, EffectVitestPrimitiveGraphDocument } from "../Lint.schemas.ts";

const EffectVitestPackageMetadata = S.Struct({
  name: S.tag("@effect/vitest"),
  version: S.NonEmptyString,
});

const EffectVitestPackageMetadataJson = S.fromJsonString(EffectVitestPackageMetadata);
const decodeEffectVitestPackageMetadata = S.decodeEffect(EffectVitestPackageMetadataJson);

/**
 * Fail when the installed Effect Vitest package does not match the decoded graph header.
 *
 * **Example** (Build the version guard)
 *
 * ```ts import.meta.vitest name="Build the version guard"
 * import { verifyEffectVitestPin } from "@beep/repo-cli/commands/Lint"
 * import * as Effect from "effect/Effect";
 * import { readEffectVitestPrimitiveGraph } from "@beep/repo-cli/commands/Lint"
 *
 * const program = readEffectVitestPrimitiveGraph(process.cwd()).pipe(
 *   Effect.flatMap((graph) => verifyEffectVitestPin(process.cwd(), graph))
 * )
 * Effect.isEffect(program) // => true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const verifyEffectVitestPin: {
  (
    root: string,
    graph: EffectVitestPrimitiveGraphDocument
  ): Effect.Effect<void, EffectVitestLintError, FileSystem.FileSystem | Path.Path>;
  (
    graph: EffectVitestPrimitiveGraphDocument
  ): (root: string) => Effect.Effect<void, EffectVitestLintError, FileSystem.FileSystem | Path.Path>;
} = dual(
  2,
  Effect.fn("EffectVitestScan.verifyPin")(function* (root: string, graph: EffectVitestPrimitiveGraphDocument) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const packagePath = path.resolve(root, "node_modules", graph.package, "package.json");
    const text = yield* fs
      .readFileString(packagePath)
      .pipe(EffectVitestLintError.mapError("Unable to read the installed @effect/vitest package metadata."));
    const installed = yield* decodeEffectVitestPackageMetadata(text).pipe(
      Effect.mapError((cause) =>
        EffectVitestLintError.new(
          `Unable to decode installed @effect/vitest package metadata: ${Inspectable.toStringUnknown(cause, 0)}`
        )
      )
    );
    if (!Equal.equals(installed.version, graph.version)) {
      return yield* EffectVitestLintError.new(
        `Installed ${graph.package} ${installed.version} does not match graph pin ${graph.tag} (${graph.sha}). ` +
          "Regenerate source anchors at the new tag, review the semantic diff, and update the graph pin before rerunning effect-vitest."
      );
    }
  })
);

const findingOrder = Order.mapInput(Order.String, (finding: EffectVitestFinding) => finding.id);

/**
 * Count physical source lines without treating a terminal newline as an empty line.
 *
 * **Example** (Count empty and unterminated sources)
 *
 * ```ts import.meta.vitest name="Count empty and unterminated sources"
 * import { countEffectVitestSourceLines } from "@beep/repo-cli/commands/Lint"
 *
 * countEffectVitestSourceLines("") // => 0
 * countEffectVitestSourceLines("one\ntwo") // => 2
 * countEffectVitestSourceLines("one\n") // => 1
 * ```
 *
 * @param text - Complete source text, including any final newline.
 * @returns Physical source-line count, excluding the empty segment after a final newline.
 * @category utilities
 * @since 0.0.0
 */
export const countEffectVitestSourceLines = (text: string): number =>
  Str.isEmpty(text) ? 0 : Str.split("\n")(text).length - (Str.endsWith("\n")(text) ? 1 : 0);

/**
 * Discover the schema-owned D9 path set through the repository filesystem service.
 *
 * **Details**
 *
 * The schema keeps includes and `!` exclusions together for persistence. This
 * boundary converts exclusions to `GlobOptions.ignore` because the shared glob
 * service treats every pattern-array entry as an alternative.
 *
 * **Example** (Discover files beneath a repository root)
 *
 * ```ts import.meta.vitest name="Discover files beneath a repository root"
 * import { discoverEffectVitestSourcePaths } from "@beep/repo-cli/commands/Lint"
 * import * as Effect from "effect/Effect";
 * const program = discoverEffectVitestSourcePaths(process.cwd())
 * Effect.isEffect(program) // => true
 * ```
 *
 * @category resources
 * @since 0.0.0
 */
export const discoverEffectVitestSourcePaths = Effect.fn("EffectVitestScan.discoverSourcePaths")(function* (
  root: string
) {
  const fsUtils = yield* FsUtils;
  const excludedGlobs = A.filter(EffectVitestSourceFileGlobs, Str.startsWith("!"));
  const includedGlobs = A.filter(EffectVitestSourceFileGlobs, (pattern) => !Str.startsWith("!")(pattern));
  return yield* fsUtils
    .globFiles(
      includedGlobs,
      GlobOptions.make({
        cwd: root,
        absolute: true,
        ignore: A.map(excludedGlobs, Str.slice(1)),
      })
    )
    .pipe(EffectVitestLintError.mapError("Unable to discover the Effect Vitest D9 scope."));
});

const literalStrings = (expression: MorphNode | undefined): O.Option<ReadonlyArray<string>> =>
  Node.isArrayLiteralExpression(expression)
    ? O.all(
        A.map(expression.getElements(), (element) =>
          Node.isStringLiteral(element) || Node.isNoSubstitutionTemplateLiteral(element)
            ? O.some(element.getLiteralValue())
            : O.none()
        )
      )
    : O.none();

const propertyInitializer = (owner: ObjectLiteralExpression, name: string): O.Option<MorphNode> =>
  O.flatMap(O.fromUndefinedOr(owner.getProperty(name)), (property) =>
    Node.isPropertyAssignment(property) ? O.fromUndefinedOr(property.getInitializer()) : O.none()
  );

const enablesBrowserMode = (owner: ObjectLiteralExpression): boolean =>
  O.exists(
    propertyInitializer(owner, "browser"),
    (browser) =>
      Node.isObjectLiteralExpression(browser) &&
      O.exists(propertyInitializer(browser, "enabled"), (enabled) => enabled.getKind() === SyntaxKind.TrueKeyword)
  );

/**
 * Read the literal `include` globs of every vitest project object that enables browser mode.
 *
 * **Details**
 *
 * A project counts only when its object literal holds `browser: { enabled: true }` beside an
 * `include` array of string literals. Disabled browser blocks, jsdom environments, and computed
 * include lists yield nothing, so their files keep every finding.
 *
 * **Example** (Read a browser project's include globs)
 *
 * ```ts
 * import { browserModeIncludeGlobs } from "@beep/repo-cli/commands/Lint"
 * import { Project } from "ts-morph"
 *
 * const config = new Project({ useInMemoryFileSystem: true }).createSourceFile(
 *   "vitest.browser.config.ts",
 *   'export default defineConfig({ test: { include: ["test/browser/**\/*.test.ts"], browser: { enabled: true } } })'
 * )
 * console.log(browserModeIncludeGlobs(config)) // ["test/browser/**\/*.test.ts"]
 * ```
 *
 * @param config - The parsed vitest config source file to scan.
 * @returns The include globs of every browser-mode project, in source order; empty when none qualifies.
 * @category parsing
 * @since 0.0.0
 */
export const browserModeIncludeGlobs = (config: SourceFile): ReadonlyArray<string> =>
  A.flatMap(
    A.filter(config.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression), enablesBrowserMode),
    (project: ObjectLiteralExpression) =>
      O.getOrElse(O.flatMap(propertyInitializer(project, "include"), literalStrings), A.empty<string>)
  );

// `@effect/vitest/utils` asserters wrap `node:assert`, which a real browser runtime does not provide.
const NODE_ASSERT_REPLACEMENT_RULES = ["EV006"];

/**
 * Drop rows whose canonical replacement needs `node:assert` when the file runs in a browser project.
 *
 * **Example** (Keep Node rows and drop browser data-assertion rows)
 *
 * ```ts
 * import { retainBrowserSafeFindings } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(retainBrowserSafeFindings([], true)) // []
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const retainBrowserSafeFindings: {
  (findings: ReadonlyArray<EffectVitestFinding>, browserMode: boolean): ReadonlyArray<EffectVitestFinding>;
  (browserMode: boolean): (findings: ReadonlyArray<EffectVitestFinding>) => ReadonlyArray<EffectVitestFinding>;
} = dual(2, (findings: ReadonlyArray<EffectVitestFinding>, browserMode: boolean) =>
  browserMode ? A.filter(findings, (finding) => !A.contains(NODE_ASSERT_REPLACEMENT_RULES, finding.ruleId)) : findings
);

const VitestConfigGlobs = ["{apps,packages,infra}/**/vitest*.config.{ts,mts,js,mjs}"];

const discoverBrowserModeTestPaths = Effect.fnUntraced(function* (root: string) {
  const fsUtils = yield* FsUtils;
  const path = yield* Path.Path;
  const configProject = new Project({ skipAddingFilesFromTsConfig: true, skipFileDependencyResolution: true });
  const configs = yield* fsUtils.globFiles(
    VitestConfigGlobs,
    GlobOptions.make({ cwd: root, absolute: true, ignore: ["**/node_modules/**"] })
  );
  const included = yield* Effect.forEach(configs, (configPath) =>
    A.match(browserModeIncludeGlobs(configProject.addSourceFileAtPath(configPath)), {
      onEmpty: () => Effect.succeed(A.empty<string>()),
      onNonEmpty: (globs) =>
        fsUtils.globFiles(
          globs,
          GlobOptions.make({ cwd: path.dirname(configPath), absolute: true, ignore: ["**/node_modules/**"] })
        ),
    })
  );
  return HashSet.fromIterable(A.map(A.flatten(included), toPosixPath));
}, EffectVitestLintError.mapError("Unable to discover the vitest browser-mode projects."));

const legacyFindingKey = (finding: EffectVitestFinding): string =>
  makeEffectVitestFindingKey(
    EffectVitestFinding.make({ ...finding, occurrence: O.none(), id: Str.replace(/#\d+$/u, "#1")(finding.id) })
  );
const occurrenceGroup = (finding: EffectVitestFinding): string =>
  makeEffectVitestFindingKey(EffectVitestFinding.make({ ...finding, id: Str.replace(/#\d+$/u, "#1")(finding.id) }));
const findingGroups = (findings: ReadonlyArray<EffectVitestFinding>, key: (finding: EffectVitestFinding) => string) => {
  const groups = MutableHashMap.empty<string, ReadonlyArray<EffectVitestFinding>>();
  for (const finding of findings) {
    const identity = key(finding);
    MutableHashMap.set(groups, identity, [
      ...O.getOrElse(MutableHashMap.get(groups, identity), A.empty<EffectVitestFinding>),
      finding,
    ]);
  }
  return groups;
};
const membershipKeys = (current: ReadonlyArray<EffectVitestFinding>, baseline: ReadonlyArray<EffectVitestFinding>) => {
  const currentGroups = findingGroups(current, legacyFindingKey);
  const baselineGroups = findingGroups(baseline, legacyFindingKey);
  return (finding: EffectVitestFinding): string => {
    const legacy = legacyFindingKey(finding);
    const left = MutableHashMap.get(currentGroups, legacy);
    const right = MutableHashMap.get(baselineGroups, legacy);
    const uniqueLegacy =
      O.exists(left, (rows) => rows.length === 1) &&
      O.exists(right, (rows) => rows.length === 1) &&
      (O.exists(left, (rows) => A.some(rows, (row) => O.isNone(row.occurrence))) ||
        O.exists(right, (rows) => A.some(rows, (row) => O.isNone(row.occurrence))));
    return uniqueLegacy ? legacy : makeEffectVitestFindingKey(finding);
  };
};

/**
 * Reapply justified exceptions only across unambiguous occurrence matches.
 *
 * **Details**
 *
 * Ordinary membership may bridge unique legacy fingerprints, but an exception
 * requires matching stored anchors on both sides. Legacy rows lack full historical
 * statement/context identity and always require explicit re-review. Duplicate
 * anchored occurrences (the same statement fingerprint more than once, such as
 * two identical calls on one line) inherit an exception only when nothing about
 * the duplicate group moved: the group has the same members on both sides, by
 * exact id (line, column and ordinal), each member sits at its own line and
 * column, and the live row's id equals the excepted row's. A regeneration of
 * unchanged source therefore keeps every reviewed exception, while a duplicate
 * that was added, deleted or shifted, or members told apart only by ordinal,
 * reopen the whole group for re-review, because nothing then proves which
 * occurrence the reason was written for.
 *
 * **Example** (Preserve an exception reason)
 *
 * ```ts import.meta.vitest name="Preserve an exception reason"
 * import { preserveEffectVitestExceptions } from "@beep/repo-cli/commands/Lint"
 * import * as O from "effect/Option"
 *
 * preserveEffectVitestExceptions([], O.none()).length // => 0
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const preserveEffectVitestExceptions: {
  (
    live: ReadonlyArray<EffectVitestFinding>,
    existing: O.Option<EffectVitestInventoryDocument>
  ): ReadonlyArray<EffectVitestFinding>;
  (
    existing: O.Option<EffectVitestInventoryDocument>
  ): (live: ReadonlyArray<EffectVitestFinding>) => ReadonlyArray<EffectVitestFinding>;
} = dual(2, (live: ReadonlyArray<EffectVitestFinding>, existing: O.Option<EffectVitestInventoryDocument>) => {
  const previous = O.getOrElse(
    O.map(existing, (document) => document.findings),
    A.empty<EffectVitestFinding>
  );
  const key = makeEffectVitestFindingKey;
  const previousGroups = findingGroups(previous, occurrenceGroup);
  const liveGroups = findingGroups(live, occurrenceGroup);
  const keyedPrevious: ReadonlyArray<readonly [string, EffectVitestFinding]> = A.map(
    previous,
    (finding): readonly [string, EffectVitestFinding] => [key(finding), finding]
  );
  const previousByKey = HashMap.fromIterable(keyedPrevious);
  const groupIds = (rows: ReadonlyArray<EffectVitestFinding>) => HashSet.fromIterable(A.map(rows, (row) => row.id));
  // The id without its ordinal: the line and column the occurrence sits at.
  const positionedApart = (rows: ReadonlyArray<EffectVitestFinding>): boolean =>
    HashSet.size(HashSet.fromIterable(A.map(rows, (row) => Str.replace(/#\d+$/u, "")(row.id)))) === rows.length;
  // Unique on both sides: the anchor alone identifies the occurrence. A
  // duplicate group identifies it only while its exact ids are unchanged.
  const unambiguous = (candidate: EffectVitestFinding, finding: EffectVitestFinding): boolean => {
    const before = MutableHashMap.get(previousGroups, occurrenceGroup(candidate));
    const after = MutableHashMap.get(liveGroups, occurrenceGroup(finding));
    const unique = O.exists(before, (rows) => rows.length === 1) && O.exists(after, (rows) => rows.length === 1);
    const unchangedGroup =
      Equal.equals(candidate.id, finding.id) &&
      O.exists(before, (rows) =>
        O.exists(
          after,
          (others) =>
            rows.length === others.length && positionedApart(rows) && Equal.equals(groupIds(rows), groupIds(others))
        )
      );
    return unique || unchangedGroup;
  };
  return A.map(live, (finding) => {
    const match = HashMap.get(previousByKey, key(finding));
    return O.match(match, {
      onNone: () => finding,
      onSome: (candidate) =>
        candidate.status === "exception" &&
        O.isSome(candidate.reason) &&
        O.isSome(candidate.occurrence) &&
        O.isSome(finding.occurrence) &&
        unambiguous(candidate, finding)
          ? EffectVitestFinding.make({ ...finding, status: "exception", reason: candidate.reason })
          : finding,
    });
  });
});

type EffectVitestFindingDifference = {
  readonly currentCount: number;
  readonly baselineCount: number;
  readonly introduced: ReadonlyArray<EffectVitestFinding>;
  readonly resolved: ReadonlyArray<EffectVitestFinding>;
};

/**
 * Diff live findings against the baseline using the shared membership ratchet.
 *
 * **Example** (Classify baseline growth)
 *
 * ```ts import.meta.vitest name="Classify baseline growth"
 * import { diffEffectVitestFindings } from "@beep/repo-cli/commands/Lint"
 *
 * diffEffectVitestFindings([], []).introduced.length // => 0
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const diffEffectVitestFindings: {
  (
    current: ReadonlyArray<EffectVitestFinding>,
    baseline: ReadonlyArray<EffectVitestFinding>
  ): EffectVitestFindingDifference;
  (
    baseline: ReadonlyArray<EffectVitestFinding>
  ): (current: ReadonlyArray<EffectVitestFinding>) => EffectVitestFindingDifference;
} = dual(2, (current: ReadonlyArray<EffectVitestFinding>, baseline: ReadonlyArray<EffectVitestFinding>) => {
  const key = membershipKeys(current, baseline);
  const keyedCurrent = A.map(current, (finding) => ({ finding, key: key(finding) }));
  const keyedBaseline = A.map(baseline, (finding) => ({ finding, key: key(finding) }));
  const keyedOrder = Order.mapInput(
    Order.String,
    (entry: { readonly finding: EffectVitestFinding }) => entry.finding.id
  );
  const currentKeys = HashSet.fromIterable(A.map(keyedCurrent, ({ key }) => key));
  const baselineKeys = HashSet.fromIterable(A.map(keyedBaseline, ({ key }) => key));
  return {
    currentCount: current.length,
    baselineCount: baseline.length,
    introduced: A.map(
      A.sort(
        A.filter(keyedCurrent, ({ key }) => !HashSet.has(baselineKeys, key)),
        keyedOrder
      ),
      ({ finding }) => finding
    ),
    resolved: A.map(
      A.sort(
        A.filter(keyedBaseline, ({ key }) => !HashSet.has(currentKeys, key)),
        keyedOrder
      ),
      ({ finding }) => finding
    ),
  };
});

type EffectVitestFileCount = readonly [file: string, count: number];

const fileCountOrder = Order.mapInput(Order.String, (entry: EffectVitestFileCount) => entry[0]);

/**
 * Render the introduced-finding report as the stable count line, one line per
 * file in path order, then the total.
 *
 * **Details**
 *
 * The first line stays byte-identical to the historical
 * `[effect-vitest] N new finding(s)` message so log-scanning hints keep
 * matching. The per-file lines name the scanned test files whose rows are
 * missing from `standards/effect-vitest.inventory.jsonc`, which is what an
 * operator needs to attribute a stale inventory to the change that added the
 * tests. An empty introduced set renders no lines.
 *
 * **Example** (Group introduced rows by file)
 *
 * ```ts import.meta.vitest name="Group introduced rows by file"
 * import { formatEffectVitestIntroducedReport } from "@beep/repo-cli/commands/Lint"
 *
 * formatEffectVitestIntroducedReport([]).length // => 0
 * ```
 *
 * @param introduced - Live findings absent from the committed baseline.
 * @returns Report lines in print order.
 * @category utilities
 * @since 0.0.0
 */
export const formatEffectVitestIntroducedReport = (
  introduced: ReadonlyArray<EffectVitestFinding>
): ReadonlyArray<string> => {
  if (A.isReadonlyArrayEmpty(introduced)) {
    return A.empty<string>();
  }
  const countsByFile = A.reduce(introduced, HashMap.empty<string, number>(), (counts, finding) =>
    HashMap.modifyAt(counts, finding.file, (count) => O.some(O.getOrElse(count, () => 0) + 1))
  );
  const entries: ReadonlyArray<EffectVitestFileCount> = A.sort(HashMap.toEntries(countsByFile), fileCountOrder);
  return [
    `[effect-vitest] ${introduced.length} new finding(s)`,
    ...A.map(
      entries,
      ([file, count]) =>
        `[effect-vitest]   ${Str.replaceAll(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/gu, "[control]")(file)}: ${count} new finding(s)`
    ),
    `[effect-vitest] total: ${introduced.length} new finding(s) in ${entries.length} file(s); refresh with \`bun run beep lint effect-vitest --write\` after reviewing them`,
  ];
};

const reportMembership = Effect.fnUntraced(function* (
  merged: ReadonlyArray<EffectVitestFinding>,
  baseline: ReadonlyArray<EffectVitestFinding>
) {
  const difference = diffEffectVitestFindings(merged, baseline);
  if (difference.introduced.length > 0) {
    yield* Effect.forEach(formatEffectVitestIntroducedReport(difference.introduced), (line) => Console.error(line), {
      discard: true,
    });
    return yield* failWithReportedExit("effect-vitest: ratchet failed on new instances.");
  }
  yield* Console.log(
    `[effect-vitest] introduced=${difference.introduced.length} resolved=${difference.resolved.length}`
  );
});

/**
 * Run the requested P0c census, baseline, rows, or default-ratchet modes.
 *
 * **Details**
 *
 * The operation verifies the installed rc.115 pin, builds one syntax-only
 * project from the D9 paths, and returns a scan receipt distinct from package
 * test timing.
 *
 * **Example** (Build the default ratchet effect)
 *
 * ```ts import.meta.vitest name="Build the default ratchet effect"
 * import { EffectVitestLintOptions, runEffectVitestLint } from "@beep/repo-cli/commands/Lint"
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option"
 *
 * const options = EffectVitestLintOptions.make({ census: false, write: false, rows: O.none() })
 * Effect.isEffect(runEffectVitestLint(options)) // => true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const runEffectVitestLint = Effect.fn("EffectVitestScan.run")(function* (options: EffectVitestLintOptions) {
  const root = yield* findRepoRoot().pipe(
    EffectVitestLintError.mapError("Unable to locate the repository root for effect-vitest.")
  );
  const graph = yield* readEffectVitestPrimitiveGraph(root);
  yield* verifyEffectVitestPin(root, graph);
  const started = performance.now();
  const ownerOf = yield* createWorkspaceOwnerResolver({
    root,
    fallbackOwner: "@beep/root",
    fallbackPrefixes: [{ prefix: "infra/", owner: "@beep/infra" }],
  });
  const sourcePaths = yield* discoverEffectVitestSourcePaths(root);
  const browserModePaths = yield* discoverBrowserModeTestPaths(root);
  yield* Console.log(
    `[effect-vitest:phase] discoveryMs=${(performance.now() - started).toFixed(1)} files=${sourcePaths.length}`
  );
  const census = A.empty<EffectVitestCensusRow>();
  const findings = A.empty<EffectVitestFinding>();
  const encoder = new TextEncoder();
  const path = yield* Path.Path;

  const project = new Project({ skipAddingFilesFromTsConfig: true, skipFileDependencyResolution: true });
  project.addSourceFilesAtPaths(sourcePaths);
  yield* Console.log(`[effect-vitest:phase] projectMs=${(performance.now() - started).toFixed(1)}`);
  const collectSource = Effect.fnUntraced(function* (sourceFile: SourceFile) {
    const absolute = sourceFile.getFilePath();
    const file = toPosixPath(path.relative(root, absolute));
    const owner = ownerOf(absolute);
    const kind = isEffectVitestTestFilePath(file) ? "test" : "support";
    const text = sourceFile.getFullText();
    census.push(
      EffectVitestCensusRow.make({
        file,
        package: owner,
        kind,
        bytes: encoder.encode(text).byteLength,
        lines: countEffectVitestSourceLines(text),
      })
    );
    const detected = retainBrowserSafeFindings(
      yield* detectEffectVitestFindings(sourceFile, file, owner),
      HashSet.has(browserModePaths, toPosixPath(absolute))
    );
    findings.push(...(kind === "test" ? detected : A.filter(detected, (finding) => finding.ruleId === "EV003")));
  });
  for (const sourceFile of project.getSourceFiles()) yield* collectSource(sourceFile);
  yield* Console.log(
    `[effect-vitest:phase] detectMs=${(performance.now() - started).toFixed(1)} findings=${findings.length}`
  );

  const censusOrder = Order.mapInput(Order.String, (row: EffectVitestCensusRow) => row.file);
  const graphBackedFindings = yield* applyEffectVitestPrimitiveGraph(findings, graph);
  const sortedFindings = A.sort(graphBackedFindings, findingOrder);
  const existing = yield* readEffectVitestInventory(root);
  if (!options.write && O.isSome(existing) && !Equal.equals(existing.value.effectVitestVersion, graph.version)) {
    return yield* EffectVitestLintError.new(
      `Baseline pin ${existing.value.effectVitestVersion} does not match graph pin ${graph.version}; refresh it with effect-vitest --write after reviewing the pinned source diff.`
    );
  }
  const merged = preserveEffectVitestExceptions(sortedFindings, existing);
  yield* Console.log(`[effect-vitest:phase] mergeMs=${(performance.now() - started).toFixed(1)}`);
  const document = EffectVitestInventoryDocument.make({
    schemaVersion: "effect-vitest-inventory/v1",
    effectVitestVersion: graph.version,
    scope: EffectVitestSourceFileGlobs,
    findings: merged,
  });

  if (options.census) {
    yield* writeEffectVitestCensus(root, A.sort(census, censusOrder));
    yield* Console.log(`[effect-vitest:phase] censusWriteMs=${(performance.now() - started).toFixed(1)}`);
  }
  if (options.write) {
    yield* writeEffectVitestInventory(root, document);
    yield* Console.log(`[effect-vitest:phase] inventoryWriteMs=${(performance.now() - started).toFixed(1)}`);
  }
  if (O.isSome(options.rows)) {
    yield* writeEffectVitestRows(root, options.rows.value, merged);
    yield* Console.log(`[effect-vitest:phase] rowsWriteMs=${(performance.now() - started).toFixed(1)}`);
  }

  const timing = EffectVitestScanTiming.make({
    scanMs: performance.now() - started,
    fileCount: census.length,
    findingCount: merged.length,
  });
  yield* Console.log(
    `[effect-vitest] files=${timing.fileCount} findings=${timing.findingCount} scanMs=${timing.scanMs.toFixed(1)}`
  );

  if (!options.write && !options.census && O.isNone(options.rows)) {
    const baseline = O.getOrElse(
      O.map(existing, (value) => value.findings),
      A.empty<EffectVitestFinding>
    );
    yield* reportMembership(merged, baseline);
  }
  return timing;
});
