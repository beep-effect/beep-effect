/**
 * QualityArtifactSupport discovery adoption parity (4-A1, reuse-ledger #143).
 *
 * 4-A1 moves repo-cli `Quality/internal/QualityArtifactSupport.ts`
 * `discoverWorkspacePackages` off its hand-rolled `*`-segment pattern expander
 * and onto `@beep/repo-workspaces` `WorkspaceDiscovery`, discovery only: the
 * kit finds the members with its opt-in `containWithinRoot` (upstream
 * link-following stays the default, W4-f), every one is checked again through
 * `resolvePathWithinCanonicalRoot`, and the unchanged `LenientManifest` reader
 * decodes its as-read manifest. The oracle is byte
 * identity of everything the Quality generators derive from discovery over the
 * live repository:
 *
 * - `discovery`: every discovered package (name, repo-relative path, repo-relative
 *   absolute path and a fingerprint of the decoded manifest), sorted by name;
 * - `coverageScope`: `workspaceCoverageScopeOwners` and the affected-scope plan
 *   for a fixed change set (`CoverageScope`);
 * - `coverageRegression`: `collectCoverageSnapshot` and the console output and
 *   verdict of `compareCoverageRegressionBaseline` (`CoverageRegression`, which
 *   also runs the coverage-disposition gap check over discovery).
 *
 * The `jsdoc-inventory` half of the oracle is a byte comparison of two
 * `bun run beep quality jsdoc-inventory --output-json <file>` runs, recorded in
 * the PR body.
 *
 * It also runs fixture probes through the exported `discoverWorkspacePackages`
 * (symlinks inside and outside the root, under `*`, `**` and literals, a root
 * behind a symlinked ancestor, negation and `**` patterns, a dot directory, a
 * root without `workspaces`, a `pnpm-workspace.yaml`, malformed manifests and
 * the version and name shapes the kit's tolerant projection rejects), so every
 * behaviour shift the switch makes has a witness.
 *
 * Run it once before the switch to record the baseline (`--out`), then after the
 * switch with `--before <baseline>`: every surface must match the baseline
 * exactly, and every probe that changed must be listed in `INTENDED_SHIFTS` with
 * its reason. Nothing here runs in CI; the reports ride in `research/` and the PR
 * body.
 *
 * Usage (from the repo root):
 *
 *   env -u TURBO_SCM_BASE bun goals/effected-promotion/ops/qas-discovery-adoption-parity.ts [--out <report.json>] [--before <baseline.json>]
 *
 * Exit status is non-zero when a surface differs or a probe shift is unclassified.
 */
import * as NodeURL from "node:url";
import {
  collectCoverageSnapshot,
  compareCoverageRegressionBaseline,
  discoverWorkspacePackages,
  planWorkspaceCoverageAffectedScope,
  workspaceCoverageScopeOwners,
} from "@beep/repo-cli/test/Quality";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Console from "effect/Console";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Str from "effect/String";

const TOOL = "goals/effected-promotion/ops/qas-discovery-adoption-parity.ts";
const repoRoot = Str.replace(/\/$/, "")(NodeURL.fileURLToPath(new URL("../../..", import.meta.url)));

class ParityFailed extends Data.TaggedError("ParityFailed")<{ readonly reason: string }> {}

const sha256 = (text: string): string => new Bun.CryptoHasher("sha256").update(text).digest("hex");
const relativeTo = (root: string, value: string): string =>
  value === root ? "." : Str.startsWith(`${root}/`)(value) ? Str.slice(root.length + 1)(value) : value;
const relative = (value: string): string => relativeTo(repoRoot, value);
const relativeAll = (text: string): string => Str.replaceAll(`${repoRoot}/`, "")(text);

// A fixed change set: a foundation leaf (many dependents), the kit itself, a
// repo-cli file and a root document.
const AFFECTED_CHANGES = [
  "packages/foundation/primitive/utils/src/index.ts",
  "packages/tooling/library/repo-workspaces/src/WorkspaceDiscovery.ts",
  "packages/tooling/tool/cli/src/commands/Quality/internal/QualityArtifactSupport.ts",
  "README.md",
];

// Probe outputs the switch changes on purpose. Every key is a probe id.
const INTENDED_SHIFTS: Record<string, string> = {
  "literal-symlink-escape":
    "A literal pattern segment is contained like a `*` entry: a member whose real path leaves the root is skipped (the expander only checked `*` entries).",
  "dot-directory":
    "A `*` segment does not match a dot directory, as the package managers' globbers read it (the expander listed every entry).",
  "missing-base-dir":
    "A wildcard pattern whose base directory is absent fails discovery as a likely typo (the expander skipped it silently); a missing literal member is still skipped.",
  "negated-pattern":
    "A `!` pattern excludes its matches, as npm, yarn, bun and pnpm read it (the expander read it as a literal path).",
  "double-star":
    "A `**` pattern descends, as npm, yarn, bun and pnpm read it (the expander read it as a literal segment and found nothing).",
  "double-star-symlink-escape":
    "A `**` pattern descends (the expander found nothing), and the kit's `containWithinRoot` neither reads nor descends into a link whose real path leaves the root.",
  "member-numeric-version":
    "The kit's tolerant projection rejects a present non-string `version` before the strict reader runs (the expander's `LenientManifest` read ignored `version`).",
  "member-empty-version":
    "The kit's tolerant projection rejects an empty `version`, which would resolve `workspace:^` to a bare `^` (the expander ignored `version`).",
  "member-empty-name":
    'The kit\'s tolerant projection rejects an empty `name` (the expander accepted any string name, `""` included).',
  "pnpm-workspace-precedence":
    "The kit reads a non-empty `pnpm-workspace.yaml` `packages` list before the root `workspaces`, as pnpm does (the expander read only `workspaces`).",
  "pnpm-workspace-invalid-yaml":
    "The kit parses `pnpm-workspace.yaml` when it exists, so a malformed one fails discovery as a workspace config decode (the expander never read it).",
  "symlink-inside-only":
    "A member reached through an in-root link is recorded at its repo-relative link path, as the kit enumerated it (the expander recorded a `*` entry at its link target).",
  "symlinked-root-ancestor":
    "Members are recorded lexically under the root as given, so a root behind a symlinked ancestor keeps plain repo-relative paths (the expander recorded `*` entries at their canonical paths, relative to the uncanonicalized root, i.e. `../..`).",
};

// --- surfaces ----------------------------------------------------------------

const discoverySurface = Effect.gen(function* () {
  const path = yield* Path.Path;
  const packages = yield* discoverWorkspacePackages(repoRoot, path);
  return pipe(
    A.fromIterable(MutableHashMap.values(packages)),
    A.map((info) => ({
      name: info.name,
      path: info.path,
      absolutePath: relative(info.absolutePath),
      manifestSha256: sha256(JSON.stringify(info.packageJson)),
    })),
    A.sort(Order.mapInput(Order.String, (row: { readonly name: string }) => row.name))
  );
});

const capturingConsole = (lines: Array<string>): Console.Console => {
  const push =
    (level: string) =>
    (...args: ReadonlyArray<unknown>): void => {
      lines.push(`${level}: ${relativeAll(A.join(A.map(args, String), " "))}`);
    };
  const noop = (): void => undefined;
  return {
    assert: noop,
    clear: noop,
    count: noop,
    countReset: noop,
    debug: push("debug"),
    dir: noop,
    dirxml: noop,
    error: push("error"),
    group: noop,
    groupCollapsed: noop,
    groupEnd: noop,
    info: push("info"),
    log: push("log"),
    table: noop,
    time: noop,
    timeEnd: noop,
    timeLog: noop,
    trace: noop,
    warn: push("warn"),
  };
};

const coverageScopeSurface = Effect.gen(function* () {
  const owners = yield* workspaceCoverageScopeOwners(repoRoot);
  const affected = yield* planWorkspaceCoverageAffectedScope(repoRoot, AFFECTED_CHANGES);
  return { owners: JSON.parse(JSON.stringify(owners)), affected: JSON.parse(JSON.stringify(affected)) };
});

// The typed failure's tag and message only: a pretty cause carries stack frames with checkout paths.
const renderFailure = (cause: Cause.Cause<{ readonly _tag: string; readonly message: string }>): string =>
  O.match(Cause.findErrorOption(cause), {
    onNone: () => "defect",
    onSome: (error) => `failure: ${error._tag}: ${relativeAll(error.message)}`,
  });

const coverageRegressionSurface = Effect.gen(function* () {
  const snapshot = yield* collectCoverageSnapshot(repoRoot);
  const lines: Array<string> = [];
  // No `base`: with TURBO_SCM_BASE unset (see Usage) every row is judged at the committed floors.
  const exit = yield* compareCoverageRegressionBaseline(repoRoot, false, [], undefined, undefined).pipe(
    Effect.provideService(Console.Console, capturingConsole(lines)),
    Effect.exit
  );
  return {
    snapshot: JSON.parse(JSON.stringify(snapshot)),
    verdict: Exit.match(exit, { onFailure: renderFailure, onSuccess: () => "success" }),
    console: lines,
  };
});

// --- probes ------------------------------------------------------------------

type Tree = Record<string, string>;

const manifest = (name: string, extra: Record<string, unknown> = {}): string => JSON.stringify({ name, ...extra });

// Each probe: a file tree under `repo/`, symlinks as [link, target] relative to
// the scratch directory, and optionally the root to discover from (default
// `repo`). `outside/` sits beside `repo/`.
const PROBES: ReadonlyArray<
  | readonly [string, Tree, ReadonlyArray<readonly [string, string]>]
  | readonly [string, Tree, ReadonlyArray<readonly [string, string]>, string]
> = [
  [
    "star-and-literal",
    {
      "repo/package.json": manifest("root", { workspaces: ["packages/*", "tools/x"] }),
      "repo/packages/a/package.json": manifest("a"),
      "repo/packages/b/package.json": manifest("b"),
      "repo/packages/no-manifest/README.md": "x",
      "repo/tools/x/package.json": manifest("x"),
    },
    [],
  ],
  ["root-only", { "repo/package.json": manifest("root") }, []],
  [
    "object-form",
    {
      "repo/package.json": manifest("root", { workspaces: { packages: ["packages/*"] } }),
      "repo/packages/a/package.json": manifest("a"),
    },
    [],
  ],
  [
    "symlink-escape-star",
    {
      "repo/package.json": manifest("root", { workspaces: ["packages/*"] }),
      "repo/packages/a/package.json": manifest("a"),
      "outside/escaped/package.json": manifest("escaped"),
    },
    [["repo/packages/out", "outside/escaped"]],
  ],
  [
    "symlink-inside",
    {
      "repo/package.json": manifest("root", { workspaces: ["packages/*", "linked/*"] }),
      "repo/packages/real/package.json": manifest("real"),
      "repo/linked/.keep": "",
    },
    [["repo/linked/alias", "repo/packages/real"]],
  ],
  [
    "literal-symlink-escape",
    {
      "repo/package.json": manifest("root", { workspaces: ["linked"] }),
      "outside/escaped/package.json": manifest("escaped"),
    },
    [["repo/linked", "outside/escaped"]],
  ],
  [
    "dot-directory",
    {
      "repo/package.json": manifest("root", { workspaces: ["packages/*"] }),
      "repo/packages/.hidden/package.json": manifest("hidden"),
      "repo/packages/a/package.json": manifest("a"),
    },
    [],
  ],
  [
    "negated-pattern",
    {
      "repo/package.json": manifest("root", { workspaces: ["packages/*", "!packages/skip"] }),
      "repo/packages/a/package.json": manifest("a"),
      "repo/packages/skip/package.json": manifest("skip"),
    },
    [],
  ],
  [
    "double-star",
    {
      "repo/package.json": manifest("root", { workspaces: ["packages/**"] }),
      "repo/packages/a/package.json": manifest("a"),
      "repo/packages/group/b/package.json": manifest("b"),
    },
    [],
  ],
  [
    "missing-base-dir",
    {
      "repo/package.json": manifest("root", { workspaces: ["packages/*", "absent/*"] }),
      "repo/packages/a/package.json": manifest("a"),
    },
    [],
  ],
  [
    "missing-literal",
    {
      "repo/package.json": manifest("root", { workspaces: ["packages/*", "absent"] }),
      "repo/packages/a/package.json": manifest("a"),
    },
    [],
  ],
  [
    "malformed-workspaces",
    {
      "repo/package.json": manifest("root", { workspaces: ["packages/*", 7] }),
      "repo/packages/a/package.json": manifest("a"),
    },
    [],
  ],
  [
    "member-invalid-json",
    { "repo/package.json": manifest("root", { workspaces: ["packages/*"] }), "repo/packages/bad/package.json": "{" },
    [],
  ],
  [
    "member-missing-name",
    { "repo/package.json": manifest("root", { workspaces: ["packages/*"] }), "repo/packages/bad/package.json": "{}" },
    [],
  ],
  [
    "member-jsonc",
    {
      "repo/package.json": manifest("root", { workspaces: ["packages/*"] }),
      "repo/packages/bad/package.json": '{\n  // comment\n  "name": "bad",\n}\n',
    },
    [],
  ],
  [
    "escaping-member-invalid-json",
    {
      "repo/package.json": manifest("root", { workspaces: ["packages/*"] }),
      "repo/packages/a/package.json": manifest("a"),
      "outside/escaped/package.json": "{",
    },
    [["repo/packages/out", "outside/escaped"]],
  ],
  [
    "double-star-symlink-escape",
    {
      "repo/package.json": manifest("root", { workspaces: ["packages/**"] }),
      "repo/packages/a/package.json": manifest("a"),
      "outside/package.json": "{",
      "outside/deep/package.json": manifest("deep"),
    },
    [["repo/packages/out", "outside"]],
  ],
  [
    "member-numeric-version",
    {
      "repo/package.json": manifest("root", { workspaces: ["packages/*"] }),
      "repo/packages/a/package.json": manifest("a", { version: 1 }),
    },
    [],
  ],
  [
    "member-empty-version",
    {
      "repo/package.json": manifest("root", { workspaces: ["packages/*"] }),
      "repo/packages/a/package.json": manifest("a", { version: "" }),
    },
    [],
  ],
  [
    "member-empty-name",
    {
      "repo/package.json": manifest("root", { workspaces: ["packages/*"] }),
      "repo/packages/a/package.json": manifest(""),
    },
    [],
  ],
  [
    "member-dependencies-array",
    {
      "repo/package.json": manifest("root", { workspaces: ["packages/*"] }),
      "repo/packages/a/package.json": manifest("a", { dependencies: [] }),
    },
    [],
  ],
  [
    "pnpm-workspace-precedence",
    {
      "repo/package.json": manifest("root", { workspaces: ["packages/*"] }),
      "repo/pnpm-workspace.yaml": "packages:\n  - tools/*\n",
      "repo/packages/a/package.json": manifest("a"),
      "repo/tools/t/package.json": manifest("t"),
    },
    [],
  ],
  [
    "pnpm-workspace-invalid-yaml",
    {
      "repo/package.json": manifest("root", { workspaces: ["packages/*"] }),
      "repo/pnpm-workspace.yaml": "packages: [\n",
      "repo/packages/a/package.json": manifest("a"),
    },
    [],
  ],
  [
    "symlink-inside-only",
    {
      "repo/package.json": manifest("root", { workspaces: ["linked/*"] }),
      "repo/packages/real/package.json": manifest("real"),
      "repo/linked/.keep": "",
    },
    [["repo/linked/alias", "repo/packages/real"]],
  ],
  [
    "symlinked-root-ancestor",
    {
      "real/repo/package.json": manifest("root", { workspaces: ["packages/*", "tools/x"] }),
      "real/repo/packages/a/package.json": manifest("a"),
      "real/repo/tools/x/package.json": manifest("x"),
    },
    [["alias", "real"]],
    "alias/repo",
  ],
];

const runProbe = (tree: Tree, links: ReadonlyArray<readonly [string, string]>, rootPath: string) =>
  Effect.scoped(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const scratch = yield* fs.realPath(yield* fs.makeTempDirectoryScoped({ prefix: "beep-4a1-discovery-probe-" }));
      yield* Effect.forEach(R.toEntries(tree), ([file, content]) =>
        Effect.andThen(
          fs.makeDirectory(path.dirname(path.join(scratch, file)), { recursive: true }),
          fs.writeFileString(path.join(scratch, file), content)
        )
      );
      yield* Effect.forEach(links, ([link, target]) =>
        Effect.andThen(
          fs.makeDirectory(path.dirname(path.join(scratch, link)), { recursive: true }),
          fs.symlink(path.join(scratch, target), path.join(scratch, link))
        )
      );
      const root = path.join(scratch, rootPath);
      const exit = yield* Effect.exit(discoverWorkspacePackages(root, path));
      return Exit.match(exit, {
        onFailure: (cause) =>
          pipe(
            Cause.findErrorOption(cause),
            O.match({
              onNone: () => `defect: ${Cause.pretty(cause)}`,
              onSome: (error) => `error: ${Str.replaceAll(scratch, "<scratch>")(error.message)}`,
            })
          ),
        onSuccess: (packages) =>
          pipe(
            A.fromIterable(MutableHashMap.values(packages)),
            A.map((info) => `${info.name}=${info.path}@${relativeTo(scratch, info.absolutePath)}`),
            A.sort(Order.String),
            A.join("\n")
          ),
      });
    })
  );

// --- report ------------------------------------------------------------------

type Report = {
  readonly tool: string;
  readonly surfaces: {
    readonly discovery: unknown;
    readonly coverageScope: unknown;
    readonly coverageRegression: unknown;
  };
  readonly probes: ReadonlyArray<{ readonly id: string; readonly output: string }>;
};

const flagValue = (flag: string): O.Option<string> =>
  O.flatMap(
    A.findFirstIndex(process.argv, (arg) => arg === flag),
    (index) => A.get(process.argv, index + 1)
  );

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const surfaces = {
    discovery: yield* discoverySurface,
    coverageScope: yield* coverageScopeSurface,
    coverageRegression: yield* coverageRegressionSurface,
  };
  const probes = yield* Effect.forEach(PROBES, ([id, tree, links, rootPath]) =>
    Effect.map(runProbe(tree, links, rootPath ?? "repo"), (output) => ({ id, output }))
  );
  const current: Report = { tool: TOOL, surfaces, probes };

  const report = yield* O.match(flagValue("--before"), {
    onNone: () => Effect.succeed<Record<string, unknown>>(current),
    onSome: (baselinePath) =>
      Effect.map(fs.readFileString(baselinePath), (text) => {
        const before: Report = JSON.parse(text);
        const previous = R.fromEntries(A.map(before.probes, (probe) => [probe.id, probe.output] as const));
        const shifts = pipe(
          current.probes,
          A.filter((probe) => O.getOrNull(R.get(previous, probe.id)) !== probe.output),
          A.map((probe) => ({
            id: probe.id,
            before: O.getOrNull(R.get(previous, probe.id)),
            after: probe.output,
            reason: O.getOrElse(R.get(INTENDED_SHIFTS, probe.id), () => ""),
          }))
        );
        const surfaceNames = ["discovery", "coverageScope", "coverageRegression"] as const;
        return {
          ...current,
          comparison: {
            baseline: relative(baselinePath),
            surfacesIdentical: R.fromEntries(
              A.map(
                surfaceNames,
                (name) =>
                  [name, JSON.stringify(before.surfaces[name]) === JSON.stringify(current.surfaces[name])] as const
              )
            ),
            probeShifts: shifts,
            unclassified: A.map(
              A.filter(shifts, (shift) => Str.isEmpty(shift.reason)),
              (shift) => shift.id
            ),
          },
        };
      }),
  });

  const encoded = `${JSON.stringify(report, null, 2)}\n`;
  yield* O.match(flagValue("--out"), {
    onNone: () => Console.log(encoded),
    onSome: (out) => fs.writeFileString(out, encoded),
  });

  const comparison = report.comparison as
    | { readonly surfacesIdentical: Record<string, boolean>; readonly unclassified: ReadonlyArray<string> }
    | undefined;
  if (comparison !== undefined) {
    const differing = A.filter(R.toEntries(comparison.surfacesIdentical), ([, same]) => !same);
    yield* Console.log(
      `surfaces differing: ${differing.length}; probe shifts unclassified: ${comparison.unclassified.length}`
    );
    if (A.isReadonlyArrayNonEmpty(differing) || A.isReadonlyArrayNonEmpty(comparison.unclassified)) {
      return yield* new ParityFailed({
        reason: `differing surfaces [${A.join(
          A.map(differing, ([name]) => name),
          ", "
        )}], unclassified probes [${A.join(comparison.unclassified, ", ")}]`,
      });
    }
  }
});

program.pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
