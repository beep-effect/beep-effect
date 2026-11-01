/**
 * repo-utils workspace discovery and dependency graph adoption parity (4-A3, reuse-ledger #139, #142, #238, #239,
 * #268).
 *
 * 4-A3 deletes repo-utils `Workspaces.ts` (`resolveWorkspaceDirs`, `getWorkspaceDir`, `resolveWorkspacePackages`,
 * `workspaceGlobsFrom`, `WorkspacePackage`), `Dependencies.ts` (`extractWorkspaceDependencies`,
 * `workspaceDependencyNames`, `sortWorkspacePackages`), `DependencyIndex.ts` (`buildRepoDependencyIndex`) and the
 * `WorkspaceDeps` schema, and moves every repo-cli caller onto `@beep/repo-workspaces`: members from
 * `WorkspaceDiscovery` (root pinned as start and ceiling, `containWithinRoot`), edges and order from
 * `DependencyGraph`. `beep topo-sort` prints `DependencyGraph.sort()`.
 *
 * Oracle, as the wave-4 plan names it (workspace set, dependency edges and topo-sort order over the live repo):
 *
 * 1. **Workspace set.** The retired `resolveWorkspaceDirs` is frozen below and run over the live root beside the
 *    kit's member list, read exactly as the adopters' `internal/RepoWorkspaces.ts` reads it. The gate is a
 *    byte-identical `name -> repo-relative directory` list and identical absolute directories (both sides report
 *    real paths).
 * 2. **Strict manifests.** The retired `resolveWorkspacePackages` re-read each member's `package.json` through
 *    `readPackageJsonFile`; the adopters decode the manifest the kit already read (`manifestRecord`) through the
 *    same strict `decodePackageJsonEffect`. The gate is a byte-identical encoded manifest per member.
 * 3. **Dependency edges.** The retired `buildRepoDependencyIndex` + `workspaceDependencyNames` edge list (root
 *    entry excluded, as every graph caller dropped it) against `DependencyGraph.dependenciesOf` per member. The gate
 *    is a byte-identical edge list.
 * 4. **Topological order.** The retired `sortWorkspacePackages` (repo-utils `topologicalSort`, a reversed core
 *    `Graph.topo` walk) against `DependencyGraph.sort()` (Kahn levels, each sorted). The two orders are NOT expected
 *    to match: the plan records the reorder (and the jsdoc inventory it drives) in one commit. The gate is that both
 *    orders hold exactly the member set and both respect every edge (each dependency before its dependents).
 * 5. **CLI outputs.** Read-only commands whose input is the discovered set are fingerprinted: `tsconfig-sync
 *    --check`, `lint package-scripts --check`, `fallow boundaries --check`, `labs list` and `docgen status` must be
 *    byte-identical before and after; `topo-sort` must print the legacy order before and the kit order after.
 *    Run the script once before the switch (`--out`), then after it with `--before <baseline.json>`, in the same
 *    checkout: `fallow boundaries --check` prints the absolute path of the config it checked.
 *
 * Nothing here runs in CI; the reports ride in `research/` and the PR body.
 *
 * Usage (from the repo root):
 *
 *   bun goals/effected-promotion/ops/repo-workspaces-adoption-parity.ts [--out <report.json>] [--before <baseline.json>]
 *
 * Exit status is non-zero when a gated surface disagrees, an order is not topological, or a CLI fingerprint differs
 * from the baseline.
 */
import * as NodeURL from "node:url";
import {
  DomainError,
  decodePackageJsonEffect,
  FsUtils,
  FsUtilsLive,
  GlobOptions,
  PackageJson,
  readPackageJsonFile,
  topologicalSort,
} from "@beep/repo-utils";
import { DependencyGraph } from "@beep/repo-workspaces/DependencyGraph";
import { WorkspaceDiscovery } from "@beep/repo-workspaces/WorkspaceDiscovery";
import { WorkspaceRoot } from "@beep/repo-workspaces/WorkspaceRoot";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Eq from "effect/Equal";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import type { FsUtilsShape } from "@beep/repo-utils";

const TOOL = "goals/effected-promotion/ops/repo-workspaces-adoption-parity.ts";
const repoRoot = Str.replace(/\/+$/, "")(NodeURL.fileURLToPath(new URL("../../..", import.meta.url)));

const sha256 = (text: string): string => new Bun.CryptoHasher("sha256").update(text).digest("hex");
const byName = Order.mapInput(Order.String, (entry: readonly [string, unknown]) => entry[0]);

// --- the retired repo-utils readers, frozen from ef39a087ea ---------------------------------------------------

// `Workspaces.ts` `IGNORED_DIRS`, `workspaceGlobsFrom`, `isSafeWorkspacePattern`, `isContainedCanonicalPath`.
const IGNORED_DIRS = ["**/node_modules/**", "**/dist/**", "**/build/**", "**/coverage/**", "**/.turbo/**"];
const absoluteWorkspacePattern = /^(?:[A-Za-z]:\/|\/\/|\/)/;
const normalizeSlashes = Str.replaceAll("\\", "/");
const workspaceGlobsFrom = (workspaces: unknown): ReadonlyArray<string> => {
  if (A.isArray(workspaces)) return A.filter(workspaces, P.isString);
  if (P.isObject(workspaces) && P.hasProperty(workspaces, "packages") && A.isArray(workspaces.packages)) {
    return A.filter(workspaces.packages, P.isString);
  }
  return [];
};
const isSafeWorkspacePattern = (pattern: string): boolean => {
  const normalized = normalizeSlashes(pattern);
  const segments = A.filter(Str.split(normalized, "/"), Str.isNonEmpty);
  return Str.isNonEmpty(normalized) && !absoluteWorkspacePattern.test(normalized) && !A.some(segments, Eq.equals(".."));
};
const isContainedCanonicalPath = (rootDir: string, candidateDir: string): boolean => {
  const root = normalizeSlashes(rootDir);
  const candidate = normalizeSlashes(candidateDir);
  return candidate === root || Str.startsWith(Str.endsWith("/")(root) ? root : `${root}/`)(candidate);
};

// `Workspaces.ts` `resolveWorkspaceDirs`: real-path member directories keyed by package name.
const legacyResolveWorkspaceDirs = Effect.fn("legacyResolveWorkspaceDirs")(function* (rootDir: string) {
  const fsUtils: FsUtilsShape = yield* FsUtils;
  const rawRoot = yield* fsUtils.readJson(`${rootDir}/package.json`);
  if (O.isNone(rawRoot)) return yield* DomainError.make({ message: "Failed to parse the root package.json" });
  const rootPackage = yield* decodePackageJsonEffect(rawRoot.value);
  const globs = workspaceGlobsFrom(rootPackage.workspaces);
  if (!A.every(globs, isSafeWorkspacePattern)) return yield* DomainError.make({ message: "Unsafe workspace glob" });
  const canonicalRoot = yield* fsUtils.realPath(rootDir);
  const manifests = yield* fsUtils.globFiles(
    A.map(globs, (glob) => `${Str.replace(/\/+$/, "")(glob)}/package.json`),
    GlobOptions.make({ cwd: rootDir, absolute: true, followSymlinks: true, ignore: IGNORED_DIRS })
  );
  const entries = yield* Effect.forEach(manifests, (manifest) =>
    Effect.gen(function* () {
      const dir = yield* fsUtils.getParentDirectory(manifest);
      const canonicalDir = yield* fsUtils.realPath(dir);
      if (!isContainedCanonicalPath(canonicalRoot, canonicalDir)) {
        return yield* DomainError.make({ message: `Workspace path escapes repository root: ${dir}` });
      }
      const raw = yield* fsUtils.readJson(`${dir}/package.json`);
      if (O.isNone(raw)) return yield* DomainError.make({ message: `Failed to parse ${dir}/package.json` });
      const pkg = yield* decodePackageJsonEffect(raw.value);
      return [pkg.name, canonicalDir] as const;
    })
  );
  return HashMap.fromIterable(entries);
});

// `DependencyIndex.ts` `buildRepoDependencyIndex` + `Dependencies.ts` `workspaceDependencyNames`, root entry dropped
// (TopoSort, TsconfigSync, Fallow and RegistrationGeometry all skipped `@beep/root` for the graph): every member's
// sorted unique workspace dependency names across the four buckets.
const legacyEdges = Effect.fn("legacyEdges")(function* (dirs: HashMap.HashMap<string, string>) {
  const names = HashSet.fromIterable(HashMap.keys(dirs));
  return yield* Effect.forEach(A.sort(HashMap.toEntries(dirs), byName), ([name, dir]) =>
    Effect.gen(function* () {
      const pkg = yield* readPackageJsonFile(`${dir}/package.json`);
      const buckets = [pkg.dependencies, pkg.devDependencies, pkg.peerDependencies, pkg.optionalDependencies];
      const deps = pipe(
        A.flatMap(buckets, (bucket) => A.fromIterable(HashMap.keys(bucket))),
        A.filter((dependency) => HashSet.has(names, dependency)),
        A.dedupe,
        A.sort(Order.String)
      );
      return [name, deps] as const;
    })
  );
});

// `Dependencies.ts` `sortWorkspacePackages`: repo-utils `topologicalSort` over the same adjacency.
const legacySort = (edges: ReadonlyArray<readonly [string, ReadonlyArray<string>]>) =>
  topologicalSort(HashMap.fromIterable(A.map(edges, ([name, deps]) => [name, HashSet.fromIterable(deps)] as const)));

// --- the kit side, as the adopters read it --------------------------------------------------------------------

// repo-cli `internal/RepoWorkspaces.ts`: the root pinned as start and ceiling, `containWithinRoot`,
// `skipMissingBaseDirs` and `skipDirectoryNames` (generated directories skipped before their manifests are read);
// its directory readers report each member's real path. Its fail-closed root guard (strict root decode,
// unsafe-pattern refusal) never fires on the live root and is pinned by `test/repo-workspaces.test.ts` instead.
// Inlined rather than imported so the same script runs on the base revision, where the reader does not exist yet;
// the generated-directory filter below repeats the skip there, where the kit has no `skipDirectoryNames`.
const GENERATED_DIRECTORY_NAMES = ["node_modules", "dist", "build", "coverage", ".turbo"];
const GENERATED_DIRECTORIES = HashSet.fromIterable(GENERATED_DIRECTORY_NAMES);
const kitMembers = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const discovery = yield* WorkspaceDiscovery.make({
    cwd: repoRoot,
    stopAt: repoRoot,
    containWithinRoot: true,
    skipMissingBaseDirs: true,
    skipDirectoryNames: GENERATED_DIRECTORY_NAMES,
  });
  const packages = A.filter(
    yield* discovery.listPackages,
    (member) =>
      !member.isRootWorkspace &&
      !A.some(Str.split(member.relativePath, "/"), (segment) => HashSet.has(GENERATED_DIRECTORIES, segment))
  );
  return yield* Effect.forEach(packages, (member) =>
    fs.realPath(member.path).pipe(Effect.map((dir) => ({ member, dir })))
  );
});

// --- checks --------------------------------------------------------------------------------------------------

// Every edge `name -> dependency` must place the dependency first.
const respectsEdges = (
  order: ReadonlyArray<string>,
  edges: ReadonlyArray<readonly [string, ReadonlyArray<string>]>
): boolean => {
  const position = MutableHashMap.empty<string, number>();
  A.forEach(order, (name, index) => MutableHashMap.set(position, name, index));
  return A.every(edges, ([name, deps]) =>
    A.every(deps, (dependency) =>
      pipe(
        O.all([MutableHashMap.get(position, dependency), MutableHashMap.get(position, name)]),
        O.exists(([before, after]) => before < after)
      )
    )
  );
};

const sameSet = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean =>
  A.length(left) === A.length(right) &&
  Eq.equals(HashSet.fromIterable(left), HashSet.fromIterable(right)) &&
  HashSet.size(HashSet.fromIterable(left)) === A.length(left);

const CliRun = S.Struct({
  command: S.String,
  exitCode: S.Number,
  stdoutSha256: S.String,
  stdoutLines: S.Number,
});
type CliRun = typeof CliRun.Type;

const OrderRecord = S.Struct({
  count: S.Number,
  sha256: S.String,
  topological: S.Boolean,
  sameSetAsMembers: S.Boolean,
});

const Report = S.Struct({
  schemaVersion: S.tag(1),
  tool: S.String,
  commit: S.optionalKey(S.String),
  members: S.Struct({
    count: S.Number,
    legacySha256: S.String,
    kitSha256: S.String,
    identical: S.Boolean,
    absoluteIdentical: S.Boolean,
  }),
  manifests: S.Struct({ count: S.Number, identical: S.Boolean, differing: S.Array(S.String) }),
  edges: S.Struct({ count: S.Number, legacySha256: S.String, kitSha256: S.String, identical: S.Boolean }),
  order: S.Struct({
    legacy: OrderRecord,
    kit: OrderRecord,
    identical: S.Boolean,
    positionsMoved: S.Number,
    kitOrder: S.Array(S.String),
  }),
  cli: S.Array(CliRun),
  comparison: S.optionalKey(
    S.Struct({ baseline: S.String, identical: S.Boolean, differing: S.Array(S.String), topoSortShift: S.String })
  ),
});
type Report = typeof Report.Type;
const encodeReport = S.encodeEffect(S.fromJsonString(Report));
const decodeReport = S.decodeUnknownEffect(S.fromJsonString(Report));

class ParityFailed extends S.TaggedError<ParityFailed, { readonly brand: unique symbol }>()("ParityFailed", {
  reasons: S.Array(S.String),
}) {}

const CLI_RUNS: ReadonlyArray<ReadonlyArray<string>> = [
  ["topo-sort"],
  ["tsconfig-sync", "--check"],
  ["lint", "package-scripts", "--check"],
  ["fallow", "boundaries", "--check"],
  ["labs", "list"],
  ["docgen", "status"],
];

const runCli = Effect.fn("runCli")(function* (args: ReadonlyArray<string>) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const command = ChildProcess.make("bun", ["run", "packages/tooling/tool/cli/src/bin.ts", "--", ...args], {
    cwd: repoRoot,
    stderr: "ignore",
  });
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* spawner.spawn(command);
      const stdout = yield* handle.stdout.pipe(
        Stream.decodeText(),
        Stream.runFold(
          () => "",
          (acc: string, chunk) => `${acc}${chunk}`
        )
      );
      const exitCode = yield* handle.exitCode;
      return {
        command: `beep ${A.join(args, " ")}`,
        exitCode: Number(exitCode),
        // Output that names the checkout (fallow boundaries prints its absolute path) is fingerprinted
        // with the repository root replaced, so reports recorded in different checkouts compare equal.
        stdoutSha256: sha256(Str.replaceAll(repoRoot, "<repo>")(stdout)),
        stdoutLines: A.length(A.filter(Str.split(stdout, "\n"), Str.isNonEmpty)),
      };
    })
  );
});

const flag = (name: string): O.Option<string> => {
  const index = process.argv.indexOf(name);
  return index === -1 ? O.none() : O.fromNullishOr(process.argv[index + 1]);
};

const orderLines = (order: ReadonlyArray<string>): string => `${A.join(order, "\n")}\n`;

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;

  // 1. Workspace set.
  const legacyDirs = yield* legacyResolveWorkspaceDirs(repoRoot);
  const members = yield* kitMembers;
  const relative = (dir: string): string => normalizeSlashes(path.relative(repoRoot, dir));
  const legacySet = A.sort(
    A.map(HashMap.toEntries(legacyDirs), ([name, dir]) => [name, relative(dir)] as const),
    byName
  );
  const kitSet = A.sort(
    A.map(members, ({ dir, member }) => [member.name, relative(dir)] as const),
    byName
  );
  const legacyAbsolute = A.sort(HashMap.toEntries(legacyDirs), byName);
  const kitAbsolute = A.sort(
    A.map(members, ({ dir, member }) => [member.name, dir] as const),
    byName
  );
  const membersIdentical = JSON.stringify(legacySet) === JSON.stringify(kitSet);
  const absoluteIdentical = JSON.stringify(legacyAbsolute) === JSON.stringify(kitAbsolute);

  // 2. Strict manifests.
  const manifestRows = yield* Effect.forEach(
    A.sort(
      A.map(members, ({ member }) => [member.name, member] as const),
      byName
    ),
    ([name, member]) =>
      Effect.gen(function* () {
        const legacy = yield* readPackageJsonFile(path.join(member.path, "package.json")).pipe(
          Effect.flatMap(PackageJson.encodeStrictEffect)
        );
        const kit = yield* decodePackageJsonEffect(member.manifestRecord).pipe(
          Effect.flatMap(PackageJson.encodeStrictEffect)
        );
        return [name, JSON.stringify(legacy) === JSON.stringify(kit)] as const;
      })
  );
  const differingManifests = A.map(
    A.filter(manifestRows, ([, same]) => !same),
    ([name]) => name
  );

  // 3. Dependency edges.
  const oldEdges = yield* legacyEdges(legacyDirs);
  const graph = DependencyGraph.make({ packages: A.map(members, ({ member }) => member) });
  const newEdges = yield* Effect.forEach(graph.names, (name) =>
    graph.dependenciesOf(name).pipe(Effect.map((deps) => [name, deps] as const))
  );
  const edgeCount = A.reduce(newEdges, 0, (total, [, deps]) => total + A.length(deps));
  const edgesIdentical = JSON.stringify(oldEdges) === JSON.stringify(newEdges);

  // 4. Topological order.
  const memberNames = A.map(kitSet, ([name]) => name);
  const legacyOrder = yield* legacySort(oldEdges);
  const kitOrder = yield* graph.sort();
  const orderRecord = (order: ReadonlyArray<string>) => ({
    count: A.length(order),
    sha256: sha256(orderLines(order)),
    topological: respectsEdges(order, newEdges),
    sameSetAsMembers: sameSet(order, memberNames),
  });
  const positionsMoved = A.length(A.filter(A.zip(legacyOrder, kitOrder), ([left, right]) => left !== right));

  // 5. CLI outputs.
  const cli = yield* Effect.forEach(CLI_RUNS, runCli);
  const commit = yield* spawner.string(ChildProcess.make("git", ["rev-parse", "HEAD"], { cwd: repoRoot })).pipe(
    Effect.map(Str.trim),
    Effect.map(O.liftPredicate(Str.isNonEmpty)),
    Effect.orElseSucceed(() => O.none<string>())
  );

  const comparison = yield* O.match(flag("--before"), {
    onNone: () => Effect.succeed(O.none<NonNullable<Report["comparison"]>>()),
    onSome: (baseline) =>
      Effect.gen(function* () {
        const before = yield* decodeReport(yield* fs.readFileString(baseline));
        const gatedCli = (runs: ReadonlyArray<CliRun>) => A.filter(runs, (run) => run.command !== "beep topo-sort");
        const topoOf = (runs: ReadonlyArray<CliRun>) =>
          A.findFirst(runs, (run) => run.command === "beep topo-sort").pipe(O.map((run) => run.stdoutSha256));
        const differing = A.flatMap(
          [
            ["members", before.members.kitSha256, sha256(JSON.stringify(kitSet))],
            ["edges", before.edges.kitSha256, sha256(JSON.stringify(newEdges))],
            ["order.kit", before.order.kit.sha256, sha256(orderLines(kitOrder))],
            ["cli", gatedCli(before.cli), gatedCli(cli)],
          ] as const,
          ([key, left, right]) => (JSON.stringify(left) === JSON.stringify(right) ? [] : [key])
        );
        // `topo-sort` printed the legacy order before the switch and must print the kit order after it.
        const topoBefore = topoOf(before.cli);
        const topoAfter = topoOf(cli);
        const topoSortShift = O.contains(topoBefore, before.order.legacy.sha256)
          ? O.contains(topoAfter, sha256(orderLines(kitOrder)))
            ? "legacy order before, kit order after"
            : "legacy order before, unexpected order after"
          : "unexpected order before";
        const shiftReason = topoSortShift === "legacy order before, kit order after" ? [] : ["topo-sort"];
        const all = [...differing, ...shiftReason];
        return O.some({ baseline, identical: A.isReadonlyArrayEmpty(all), differing: all, topoSortShift });
      }),
  });

  const report: Report = {
    schemaVersion: 1,
    tool: TOOL,
    ...O.match(commit, { onNone: () => ({}), onSome: (sha) => ({ commit: sha }) }),
    members: {
      count: A.length(kitSet),
      legacySha256: sha256(JSON.stringify(legacySet)),
      kitSha256: sha256(JSON.stringify(kitSet)),
      identical: membersIdentical,
      absoluteIdentical,
    },
    manifests: {
      count: A.length(manifestRows),
      identical: A.isReadonlyArrayEmpty(differingManifests),
      differing: differingManifests,
    },
    edges: {
      count: edgeCount,
      legacySha256: sha256(JSON.stringify(oldEdges)),
      kitSha256: sha256(JSON.stringify(newEdges)),
      identical: edgesIdentical,
    },
    order: {
      legacy: orderRecord(legacyOrder),
      kit: orderRecord(kitOrder),
      identical: orderLines(legacyOrder) === orderLines(kitOrder),
      positionsMoved,
      kitOrder,
    },
    cli,
    ...O.match(comparison, { onNone: () => ({}), onSome: (value) => ({ comparison: value }) }),
  };

  const json = yield* encodeReport(report);
  yield* O.match(flag("--out"), {
    onNone: () => Console.log(json),
    onSome: (out) => fs.writeFileString(out, `${json}\n`),
  });
  yield* Console.log(
    `members: ${report.members.count} (identical=${membersIdentical}, absolute=${absoluteIdentical}); manifests identical=${report.manifests.identical}; edges: ${edgeCount} (identical=${edgesIdentical}); order: legacy topological=${report.order.legacy.topological}, kit topological=${report.order.kit.topological}, ${positionsMoved} positions moved`
  );
  yield* Console.log(
    A.join(
      A.map(
        cli,
        (run) => `${run.command}: exit ${run.exitCode}, ${run.stdoutLines} lines, ${Str.slice(0, 12)(run.stdoutSha256)}`
      ),
      "; "
    )
  );
  yield* O.match(comparison, {
    onNone: () => Effect.void,
    onSome: (value) =>
      Console.log(
        `baseline ${value.baseline}: identical=${value.identical} (${value.topoSortShift})${value.identical ? "" : ` differing=${A.join(value.differing, ",")}`}`
      ),
  });

  const reasons = A.getSomes([
    membersIdentical ? O.none() : O.some("the legacy and kit workspace sets differ"),
    absoluteIdentical ? O.none() : O.some("the legacy and kit member directories differ"),
    report.manifests.identical ? O.none() : O.some(`strict manifests differ: ${A.join(differingManifests, ", ")}`),
    edgesIdentical ? O.none() : O.some("the legacy and kit dependency edges differ"),
    report.order.legacy.topological && report.order.legacy.sameSetAsMembers
      ? O.none()
      : O.some("the legacy order is not a topological order of the members"),
    report.order.kit.topological && report.order.kit.sameSetAsMembers
      ? O.none()
      : O.some("the kit order is not a topological order of the members"),
    ...A.map(
      A.filter(cli, (run) => run.exitCode !== 0),
      (run) => O.some(`${run.command} exited ${run.exitCode}`)
    ),
    O.flatMap(comparison, (value) =>
      value.identical ? O.none() : O.some(`baseline ${value.baseline} differs: ${A.join(value.differing, ", ")}`)
    ),
  ]);
  if (A.isReadonlyArrayNonEmpty(reasons)) return yield* ParityFailed.make({ reasons });
});

const services = Layer.mergeAll(WorkspaceRoot.layer, FsUtilsLive).pipe(Layer.provideMerge(NodeServices.layer));

// @effect-diagnostics-next-line strictEffectProvide:off -- this is the script's entry point; the one layer is provided once here. Owner: goals/effected-promotion. Exit: the script is deleted with the packet's closeout.
NodeRuntime.runMain(program.pipe(Effect.provide(services)));
