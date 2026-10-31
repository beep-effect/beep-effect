# @beep/repo-workspaces

Monorepo workspace tooling for [Effect](https://effect.website) v4: find the workspace root, enumerate its packages, walk the dependency graph, detect the package manager, resolve pnpm catalogs, read the lockfile, check it for unsatisfied peer dependencies and work out which packages a git range touches. Every capability is a service you provide at the edge and swap in tests. Works with npm, pnpm, yarn Berry and bun. A separate `./testing` entry point holds repo-shape checks for a monorepo's own test suite: source boundaries, package layering and packed-install proofs.

## Why this package

Monorepo tooling keeps re-deriving the same facts: where the root is, which directories are packages, what depends on what, what a `catalog:` specifier means and which packages a change affects. Each tool re-derives them slightly differently, and the differences show up as bugs. This package answers those questions once.

Discovery is honest about what a glob means. A `packages/**` pattern finds packages nested more than one level deep, because the enumerator does a bounded descent rather than the one-level approximation that a trailing-`**` rewrite quietly turns it into — and a package that goes undiscovered with no diagnostic is the worst kind of wrong, because an empty result is indistinguishable from a legitimately empty workspace. The same discipline runs through the error model: a malformed `package.json`, an unenumerable pattern, a missing lockfile and a failed git command all fail through the typed channel with structured fields, while a developer wiring mistake (an uncompilable glob literal, a fractional `maxDepth`) stays a defect. The typed channel is exactly the set of things a caller can branch on.

Git runs through `@beep/git`'s `Git` service rather than a hard-coded subprocess call, so change detection is testable with no repository on disk and portable to a runtime that spawns processes differently. And where `@beep/npm-spec` declares the `CatalogResolver` and `WorkspaceResolver` seams — contracts that `@beep/package-json` consumes but no pure package can fill — this is the package that fills them.

Requires Node.js >=24.11.0. `effect` v4 is a peer dependency. You provide a `FileSystem` and `Path` implementation at the edge — `@effect/platform-node` or `@effect/platform-bun`.

`@beep/repo-workspaces` is ESM-only: the exports maps publish only `import` conditions, so `require()` — including tools that resolve in CJS mode — fails with Node's `ERR_PACKAGE_PATH_NOT_EXPORTED` rather than loading a CJS build that does not exist. Import from an ES module.

pnpm's catalog semantics come from pnpm's own `@pnpm/catalogs.*` packages, which install as regular dependencies. Reimplementing them would mean owning a moving spec with no oracle, so they are used directly and confined to a single internal module.

## Quick start

```ts
import { NodeFileSystem, NodePath } from "@effect/platform-node";
import { DependencyGraph, WorkspaceDiscovery, Workspaces } from "@beep/repo-workspaces";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

// Bind the layer to a const: layers memoize by reference, so calling
// Workspaces.layer() twice builds the whole stack twice.
const Platform = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);
const WorkspacesLayer = Workspaces.layer().pipe(Layer.provide(Platform));

const program = Effect.gen(function* () {
  const discovery = yield* WorkspaceDiscovery;

  const packages = yield* discovery.listPackages;
  const graph = DependencyGraph.make({ packages });

  // Parallel build tiers: level 0 depends on nothing in the workspace,
  // level n depends only on the levels below it.
  return yield* graph.levels();
});

Effect.runPromise(program.pipe(Effect.provide(WorkspacesLayer))).then(console.log);
// [ [ ...names with no workspace dependencies ], [ ...names that depend only on level 0 ], ... ]
```

`DependencyGraph` is a value class, not a service: build it from packages you already have. A cycle fails with `CyclicDependencyError`, whose `cycle` field names the packages actually in the cycle — the members of the strongly-connected components — and not the ones merely stalled behind it, which is the difference between a fix list and a suspect list.

`toMermaid()` renders the same graph for a job summary, an issue or a design doc. It is total, deterministic (nodes and edges both in sorted order) and safe for scoped names, which appear only inside quoted labels:

```ts
import { DependencyGraph, WorkspacePackage } from "@beep/repo-workspaces";

const member = (name: string, dependencies: Record<string, string> = {}) =>
  WorkspacePackage.make({
    name,
    version: "1.0.0",
    path: `/repo/packages/${name.slice(6)}`,
    packageJsonPath: `/repo/packages/${name.slice(6)}/package.json`,
    relativePath: `packages/${name.slice(6)}`,
    workspaceRoot: "/repo",
    dependencies,
  });

const graph = DependencyGraph.make({
  packages: [member("@acme/app", { "@acme/utils": "workspace:^" }), member("@acme/utils")],
});
console.log(graph.toMermaid());
// flowchart TD
//   0["@acme/app"]
//   1["@acme/utils"]
//   0 --> 1
```

## Change detection

`ChangeDetector` offers three depths of analysis on one service — `changedFiles` (raw paths from a git range), `changedPackages` (the packages owning them) and `affectedPackages` (the transitive blast radius through the dependency graph).

```ts
import { NodeServices } from "@effect/platform-node";
import { ChangeDetectionOptions, ChangeDetector, Workspaces } from "@beep/repo-workspaces";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

// layerWithGit runs ChangeDetector over @beep/git's Git service; NodeServices
// provides the ChildProcessSpawner it needs, alongside FileSystem and Path.
const WorkspacesLayer = Workspaces.layerWithGit().pipe(Layer.provide(NodeServices.layer));

const program = Effect.gen(function* () {
  const detector = yield* ChangeDetector;
  const affected = yield* detector.affectedPackages(ChangeDetectionOptions.make({ base: "origin/main" }));
  return affected.map((pkg) => pkg.name);
});

Effect.runPromise(program.pipe(Effect.provide(WorkspacesLayer))).then(console.log);
// [ ...names of packages the range touched, plus everything downstream of them ]
```

Git is a separate layer rather than a flag, because the extra requirement is a subprocess: a consumer that never detects changes should not have to be able to spawn one. A test provides the `Git` service with a `Layer.succeed` stub and needs no repository at all.

## pnpm catalogs

`WorkspaceCatalogs` assembles a workspace's catalogs with pnpm's precedence (the lockfile's record first, the inline `pnpm-workspace.yaml` declaration wins) and resolves `catalog:` specifiers against the result.

It also supplies the real implementations of `@beep/npm-spec`'s `CatalogResolver` and `WorkspaceResolver` contracts — the seams `@beep/package-json` reads through, which without a workspace under them can only answer `Option.none()`. Provide `Workspaces.resolvers` and `Package.resolve` rewrites `catalog:` and `workspace:` specifiers to concrete ranges:

```ts
import { Workspaces } from "@beep/repo-workspaces";
import * as Layer from "effect/Layer";

const WorkspacesLayer = Workspaces.layer();
const Resolvers = Workspaces.resolvers.pipe(Layer.provide(WorkspacesLayer));
// Layer<CatalogResolver | WorkspaceResolver, never, FileSystem | Path>
```

`Workspaces.resolverLayer(options?)` is that wiring in one call: the two contracts over a full workspace stack, needing only `FileSystem` and `Path` from you. A fresh layer per call is the point — root discovery re-runs each time, including the `process.cwd()` read when `options.cwd` is omitted, so a build tool that changes directory between manifests stays correct. It wires the config-dependency replay path; compose `Workspaces.resolvers` with `Workspaces.layer` yourself if config-dependency code must not run.

For whole manifests, `Workspaces.resolveManifest` is the one-shot path over `@beep/npm-spec`'s tolerant `Manifest` model:

```ts
import { Manifest } from "@beep/npm-spec/Manifest";
import { Workspaces } from "@beep/repo-workspaces";
import * as Effect from "effect/Effect";

const program = Effect.gen(function* () {
  const manifest = yield* Manifest.decode({ dependencies: { effect: "catalog:" } });
  const resolved = manifest.needsResolution ? yield* Workspaces.resolveManifest(manifest) : manifest;
  return resolved.toRecord();
});
// needsResolution is pure — checking it first skips catalog assembly entirely
// when no dependency field carries a catalog: or workspace: specifier
```

A specifier the workspace cannot answer fails typed as `UnresolvedDependencyError`: at the manifest level "no catalog entry" means the manifest cannot be projected to concrete ranges.

## Peer dependency checking

`PeerCheck.run(lockfile, options?)` reports unsatisfied peer dependencies as a pure value: no IO, no error channel, nothing in `R`, and no per-manager traversal logic. It reads `lockfile.format` once, to reject a format whose lockfile does not record peer resolution; past that gate the walk is the same for every manager. The answer comes from the resolved graph `@beep/lockfiles` normalizes, not from shelling out to a package manager's own peer command — bun has none, so the subprocess route cannot answer for every manager the rest of this package supports.

```ts
import { LockfileReader, PeerCheck, WorkspaceCatalogs, WorkspaceDiscovery } from "@beep/repo-workspaces";
import * as Effect from "effect/Effect";

const program = Effect.gen(function* () {
  const reader = yield* LockfileReader;
  const catalogs = yield* WorkspaceCatalogs;
  const discovery = yield* WorkspaceDiscovery;

  const lockfile = yield* reader.read;
  // Presence of each key is the assertion — see below.
  const report = PeerCheck.run(lockfile, {
    peerDependencyRules: yield* catalogs.peerDependencyRules,
    workspacePackages: yield* discovery.listPackages,
    catalogs: yield* catalogs.set,
  });

  return {
    clean:
      report.supported &&
      report.unresolvedImporters.length === 0 &&
      report.unverified.length === 0 &&
      report.required.length === 0,
    required: report.required.length,
  };
});
// { clean: whether the workspace is proven clean, required: count of non-optional findings }
```

**An empty `unsatisfied` is not the same as clean**, and reading it that way is the mistake this report's shape exists to prevent. Three other fields carry the difference between "nothing is wrong" and "nothing was checked", and a gate must read all four:

- `supported` is `false` for yarn, which resolves peers virtually and does not record which virtual instance satisfied which peer. The answer is unrecoverable, so it is not fabricated.
- `unresolvedImporters` names importers that could not be joined to package instances — in practice the root importer under npm and bun, neither of which records a resolved version per importer dependency.
- `unverified` says why the report is not a complete answer, and every reason means fail closed:
  - `"peerRulesNotApplied"` — the `peerDependencyRules` key was omitted, so pnpm's suppression policy was not applied.
  - `"unresolvedEdge"` — an instance records an edge the model could not name, or an importer dependency resolved through `link:` whose linked manifest's peers were not judged: its target was not supplied in `workspacePackages`, or the lockfile records no workspace row to walk. A linked parent's manifest peers are never in the lockfile, though `pnpm peers check` reads them from disk.
  - `"peerRangeUnresolved"` — a linked manifest declares a peer as a protocol specifier that could not be turned into a range (`catalog:` with the `catalogs` key omitted or no matching entry, `workspace:*`), and something resolved for that peer, so the comparison never ran.
  - `"peerVersionUnresolved"` — a peer resolved to a non-workspace provider whose version is a protocol specifier rather than a version: a `file:` directory or tarball, directly or through a `file:` override, which the lockfile records as `file:vendor/x` with no version for a directory, and a git or remote-tarball provider, which pnpm keys by its URL (`https://codeload.github.com/…`). The comparison never runs, so the peer is neither reported nor passed as satisfied; for a `file:` directory `pnpm peers check` reports it as a `bad` row even when the directory's manifest satisfies the range. It applies to peers declared by lockfile rows and by joined manifests alike.
- `required` is the getter for the rows a gate should act on — the non-optional ones. An unsatisfied *optional* peer is normal, so `optional` travels with the row rather than being filtered out at the source.

`WorkspaceCatalogs.peerDependencyRules` returns the workspace's effective merged pnpm suppression rules, which the lockfile records nowhere; without them a checker reports findings pnpm itself calls clean. **Presence of the `peerDependencyRules` option key is the assertion, not its contents.** Passing `NoPeerDependencyRules` asserts the workspace has none, so the report carries no `"peerRulesNotApplied"` — though it can still be unverified for another reason, or unsupported; omitting the key says nobody looked, and always yields `"peerRulesNotApplied"`. **All three axes of the supplied rules are applied**, with pnpm's measured semantics. `allowedVersions` hides a row whose resolved version a matching key's range permits, in all three key spellings pnpm accepts: `parent@version>peer` (what `pnpm:export` writes; the parent version is ignored, as pnpm ignores it), `parent>peer` (what a config-dependency plugin injects) and a bare `peer`, which pnpm applies to every parent that declares it. `ignoreMissing` hides a required peer nothing resolved for, and `allowAny` hides a peer that resolved outside its range; both are `@pnpm/matcher` patterns over the PEER name (`*` wildcard, leading `!` negates), never `parent>peer` keys, and the two never cross.

The `workspacePackages` option takes the packages `WorkspaceDiscovery` already returned, and supplying it is what turns a `link:`-resolved parent from a refusal into an answer: the matched manifest's declared peers join the walk, named from the manifest (`probe-a@1.0.0`, not the row's `packages/a@0.0.0`) and judged against the **importer's own** dependency set, which is where pnpm resolves them from. Measured one variable at a time on the probe workspace, against pnpm 12.5.1 and 12.6.0: a consumer's own `react@18.3.1` satisfies the linked parent's `^18.0.0` peer, the same version installed only by a sibling importer does not, and a consumer's own `react@17.0.2` is a `bad` row carrying `foundVersion`. A target the set does not cover — every target, when the key is omitted — keeps `"unresolvedEdge"`, so the option answers only for what it covers and says so about the rest. A covered target the walk cannot reach — one the lockfile records no workspace row for — keeps the marker too; the root importer's linked targets are walked and judged against the root's own dependencies, as pnpm does.

A `link:` target matches a supplied package by its directory or by its publish directory: pnpm links a workspace dependency into `publishConfig.directory` unless `publishConfig.linkDirectory` is `false` (it defaults to true), recording `link:../a/dist`. For such a link pnpm reads the built manifest at the target, while `PeerCheck` reads the source manifest and resolves its `catalog:` ranges through `catalogs`; the two agree when the build emits the ranges the source's specifiers resolve to. Attribution stops at a workspace package: a linked package's manifest peers are judged only for the importer that links it directly, and its own dependencies (registry or linked) only for its own importer, never for a consumer one link further out. Each `link:` edge is cleared only by the walk of the importer that records it.

The `catalogs` option takes `WorkspaceCatalogs.set()`, which already includes hook-injected catalogs. A linked manifest may declare a peer as a catalog specifier (`"typescript": "catalog:build:peers"`) rather than a range; with the set supplied it is resolved, judged, and reported by the resolved range, which is what `pnpm peers check` reports as `wantedRange`. A specifier that stays unresolvable — the key omitted, a catalog naming nothing for the peer, or another protocol such as `workspace:*` — is never passed as satisfied: when something resolved for that peer the report carries `"peerRangeUnresolved"`, and when nothing did the `found: null` row is reported anyway, since a missing provider needs no range.

## The synchronous escape hatch

Vitest's config-time project discovery cannot await. Two functions exist for exactly that case, and they run synchronously over file and path operations you supply. On Node you do not have to write them: the `@beep/repo-workspaces/node-sync` subpath exports `nodeSyncOps`, the ready-made `node:fs` and `node:path` bindings, so adopting the sync path is one extra import.

```ts
import { findWorkspaceRootSync, getWorkspacePackagesSync } from "@beep/repo-workspaces";
import { nodeSyncOps } from "@beep/repo-workspaces/node-sync";

const root = findWorkspaceRootSync(process.cwd(), nodeSyncOps);
const packages = root === null ? [] : getWorkspacePackagesSync(root, nodeSyncOps);
// root: the workspace root path, or null when none is found above the cwd
// packages: the discovered workspace packages, empty when there is no root
```

Both entry points take their path positionally, so the bag usually passes through verbatim; spread it to add `getWorkspacePackagesSync`'s traversal extras — `{ ...nodeSyncOps, maxDepth, onSkip }`. The function is total, so it cannot fail on a manifest it cannot use — but it never drops one silently either: `onSkip` receives a `WorkspaceDiscoverySkip` (`root`, `path`, `kind`, `cause`) for every manifest left out, with the same `kind` the Effect surface would have failed with, so "no packages" and "packages rejected" stay distinguishable. A manifest with no `version` is not skipped on either surface; it is a member with `version` absent, as pnpm treats it. The bindings are a separate subpath deliberately: the main entry imports nothing platform-shaped, and re-exporting them from it would drag `node:*` into every consumer, including the ones supplying their own operations. `nodePath` is the running platform's `node:path`, so on Windows the paths handed back are win32 paths.

Write the operations yourself when Node's built-ins are not the platform you mean — a Bun or Deno binding, a test fake, or `node:path/win32` to pin a dialect rather than follow the running platform. Each one is a one-liner:

```ts
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import * as path from "node:path";
import { findWorkspaceRootSync, getWorkspacePackagesSync } from "@beep/repo-workspaces";

const options = {
  fileSystem: {
    exists: existsSync,
    readFile: (p: string) => readFileSync(p, "utf8"),
    readDirectory: (p: string) => readdirSync(p),
    isDirectory: (p: string) => statSync(p).isDirectory(),
  },
  path, // node:path satisfies SyncPath verbatim
};

const root = findWorkspaceRootSync(process.cwd(), options);
const packages = root === null ? [] : getWorkspacePackagesSync(root, options);
// root: the workspace root path, or null when none is found above the cwd
// packages: the discovered workspace packages, empty when there is no root
```

Those four operations are the whole requirement. A fifth, `readDirectoryWithTypes`, is optional: supply it and package enumeration reads a directory's entries and their types in one call instead of a `readDirectory` plus an `isDirectory` per entry, which on a large workspace is a syscall per file. `nodeFileSystem` already implements it over `readdirSync(p, { withFileTypes: true })`, so the `node-sync` bindings get the fast path for free. Omit it and enumeration falls back to the four required operations with identical results — a cost optimization, never a behavior switch.

Each entry reports `name`, `isDirectory` and `isSymbolicLink` as a `SyncDirectoryEntry`, which Node's `Dirent` satisfies once its predicate methods are called. The link flag is load-bearing: a `Dirent` describes the entry itself, so a symlink pointing at a directory reports `isDirectory: false`, while the `stat`-based path resolves the link and calls the same entry a directory. Enumeration re-resolves links through `isDirectory` rather than trusting the flag, which is what keeps a workspace with symlinked packages discovered identically on both paths.

```ts
import { readdirSync } from "node:fs";
import type { SyncDirectoryEntry } from "@beep/repo-workspaces";

const readDirectoryWithTypes = (p: string): ReadonlyArray<SyncDirectoryEntry.Encoded> =>
  readdirSync(p, { withFileTypes: true }).map((entry) => ({
    name: entry.name,
    isDirectory: entry.isDirectory(),
    isSymbolicLink: entry.isSymbolicLink(),
  }));
// pass alongside the four required operations: { ...options.fileSystem, readDirectoryWithTypes }
```

For a test fake, `@beep/memfs`' `MemoryFileSystem.syncFileSystem(volume)` satisfies `SyncFileSystem` structurally — neither package imports the other — so a config-time discovery path can be exercised against a virtual workspace with nothing on disk.

Windows correctness is therefore the operations you pass, and nothing else. Both entry points drive one traversal state machine (the same dequeue order, depth rule, visit budget and `node_modules` prune), so the sync and Effect surfaces can never disagree about what a pattern means. The one deliberate difference is at a bound: the Effect enumerator fails typed, the sync one truncates. Prefer the Effect API everywhere you can run one.

## Error handling

Every failure is a `Schema.TaggedError` with structured fields you can branch on, not a prose string:

```ts
import { WorkspaceDiscovery, WorkspacePatternError } from "@beep/repo-workspaces";
import * as Effect from "effect/Effect";

const program = Effect.gen(function* () {
  const discovery = yield* WorkspaceDiscovery;
  return yield* discovery.listPackages;
}).pipe(
  Effect.catchTag("WorkspacePatternError", (error: WorkspacePatternError) =>
    // kind: "missingBaseDir" | "uncompilable" | "depthExceeded" | "budgetExceeded"
    Effect.logError(`pattern ${error.pattern} failed: ${error.kind}`).pipe(Effect.as([])),
  ),
);
```

`WorkspaceRootNotFoundError`, `WorkspaceDiscoveryError`, `WorkspacePatternError`, `PackageNotFoundError`, `WorkspaceManifestError`, `PackageManagerDetectionError`, `CatalogAssemblyError`, `LockfileReadError`, `CyclicDependencyError` and `ChangeDetectionError` each name one thing that can actually go wrong, and each method's error channel is narrowed to the ones it can produce. `CatalogAssemblyError` is defined in `@beep/npm-spec`, beside the resolver contract that names it in its channel — import it from there. Change detection additionally surfaces `@beep/git`'s typed git errors, such as `NotARepositoryError`.

## Testing

Every service here can be replaced with `Layer.succeed` and a hand-built value, and `WorkspaceDiscovery` ships that pattern ready-made: `WorkspaceDiscovery.layerTest(overrides)` provides an in-memory double where a test stubs only the methods it exercises. The defaults model an empty workspace, and the derived methods run over the effective `listPackages`, so stubbing that one method keeps `getPackage`, `importerMap` and `resolveFile` answering consistently:

```ts
import { WorkspaceDiscovery, WorkspacePackage } from "@beep/repo-workspaces";
import * as Effect from "effect/Effect";

// Bind to a const — layers memoize by reference.
const TestDiscovery = WorkspaceDiscovery.layerTest({
  listPackages:
    Effect.succeed([
      WorkspacePackage.make({
        name: "@my-org/utils",
        version: "1.0.0",
        path: "/repo/packages/utils",
        packageJsonPath: "/repo/packages/utils/package.json",
        relativePath: "packages/utils",
        workspaceRoot: "/repo",
      }),
    ]),
});
// program.pipe(Effect.provide(TestDiscovery))
```

A name miss in the derived `getPackage` fails with the service's own typed `PackageNotFoundError`, exactly as the live implementation does. Two deliberate edges: `info()` has no honest default (a fabricated root path would leak into consumer path logic), so it dies with an explanatory defect unless stubbed, and the derived file-ownership methods assume POSIX paths, so pass your own `resolveFile` for win32 fixtures. `WorkspaceDiscovery.makeTest(overrides)` returns the bare service shape when you want the double without a layer.

## Repo-shape checks (`./testing`)

A monorepo's shape drifts in ways no unit test sees: a package that should stay platform-free starts reading `process`, a low-level package grows an edge up into an application, or a bin resolves fine inside the workspace and is missing once installed from its tarball. `@beep/repo-workspaces/testing` holds three checks you run from your own test suite to catch each one. The main entry never re-exports it, so a consumer of `.` never loads a scanner or package-manager orchestration it does not use. Option bags are plain objects (each schema's `Encoded` form), and every check refuses to pass vacuously, so each example pairs "nothing wrong" with "something was checked".

### Layering

`WorkspaceLayering` holds the discovered package graph to a committed `layers.json`. `layers` is top-down: a package may depend only on a layer below its own, or on `tooling`. `unconstrained` globs name packages whose own edges are not checked, such as the private root, which must be classified like any other package. Every entry matches a package's `name`, never its `relativePath`. `fields` picks the dependency maps that count, and `requiredEdges` lists edges that must exist, so a discovery that silently drops edges fails. Decoding is strict: any other key fails `LayerPolicyError` naming the key, so a typo such as `requiredEdge` cannot silently drop that guard. `$schema` is always accepted, and keys a policy file carries for its own use go in `LayerPolicy.load(path, { allowKeys: [...] })`.

```json
{
  "layers": [["my-tool"], ["my-tool-cli", "my-tool-mcp"], ["my-tool-engine"]],
  "tooling": [],
  "unconstrained": ["my-monorepo"],
  "fields": ["dependencies", "peerDependencies", "optionalDependencies"],
  "requiredEdges": ["my-tool-mcp -> my-tool-engine"]
}
```

```ts
import { LayerPolicy, WorkspaceLayering } from "@beep/repo-workspaces/testing";
import * as Effect from "effect/Effect";

const layering = Effect.gen(function* () {
  const policy = yield* LayerPolicy.load("/repo/layers.json");
  const report = yield* WorkspaceLayering.checkWorkspace(policy);
  // Assert both: nothing wrong, and real edges were read.
  return { violations: report.violations, edgeCount: report.edgeCount };
});
```

An edge is drawn wherever a dependency's name is a workspace package, whatever its specifier, and once per declaring field. A cycle closed only by a devDependency is therefore invisible to a policy that checks runtime fields only: pin acyclicity across every field separately, with `DependencyGraph.make({ packages }).hasCycle`.

### Source boundaries

`SourceBoundary.scan` walks a source tree and reports every read of the global `process`, forbidden import, `stdout.write` or console write. It lexes each file first, so the word `process` in a comment, a string, template text or a regex is never a read, and a `/*` inside a string never hides the code after it. Assert `verifyFixtures()` beside your scan: it proves the scanner still flags and spares what its shipped fixtures say.

```ts
import { SourceBoundary } from "@beep/repo-workspaces/testing";
import * as Effect from "effect/Effect";

const boundary = Effect.gen(function* () {
  const scan = yield* SourceBoundary.scan({
    root: "/repo/packages/engine/src",
    rules: ["process", "node:process", "console", { forbidImports: ["node:*", "@effect/platform*"] }],
  });
  // Assert scan.files is non-empty, scan.violations is [] and verifyFixtures() is [].
  return { files: scan.files, violations: scan.violations, controls: SourceBoundary.verifyFixtures() };
});
```

| Rule | Flags |
| --- | --- |
| `"process"` | a read of the global `process`; `process.env.__PACKAGE_VERSION__` is exempt |
| `"node:process"` | an import of `node:process` or `process` |
| `"stdout-write"` | a `stdout.write`, or a `stdout.end` passing a final chunk, on anything named `stdout`; a renamed receiver is left to `"process"` |
| `"console"` | any reference to the global `console` |
| `"console-stdout"` | a reference to the global `console`, except a member access to a method Node writes to stderr: `error`, `warn`, `trace`, `assert`. A bare or aliased reference (`const c = console`, `f(console)`, `console[m]`) is flagged, since it can reach `log` |
| `{ forbidImports }` | an import equal to an entry, a subpath of one, or starting with an entry's text before a trailing `*` |
| `{ forbidTokens }` | an entry's exact text in code (never in a comment, string, template text or regex), as whole text: not inside a longer identifier |

Neither console rule flags core's `Console` service. `"console-stdout"` suits a stdio server that must keep stdout for its protocol but may log to stderr.

`allow` globs exempt a file from every rule, and the file is listed in `scan.allowed`. To exempt a file from one rule only, use `allowRules`, keyed by the rule (`"forbidImports"` covers every `{ forbidImports }` rule). The file is still checked against every other rule, and each offence a per-rule glob waives lands in `scan.waived` rather than disappearing, so a stale or over-broad waiver fails an assertion. Both kinds of glob compile with `@beep/glob` and match the scan's relative, `/`-separated path; an uncompilable one fails the scan with `GlobPatternError`. To confine a token to named files, forbid it with `{ forbidTokens }` and waive that rule for those files (`allowRules: { forbidTokens: ["version.ts"] }`): `scan.waived` then proves the confinement still matches something.

The scanner is a lexer, not a type checker. Its known limits:

- There is no scope analysis, so any local binding named `process` or `console` is flagged like the global: a parameter, a variable, a label, or an unannotated class field. An annotated class field (`process: T`) reads as a type member and is spared. Prefer renaming the binding; failing that, waive that one rule for the file with `allowRules` and assert `scan.waived` names exactly it.
- `globalThis["process"]` and `const { process: p } = globalThis` are not seen.
- A regex literal directly after a block-closing `}` reads as a division.
- A variable named `yield` or `await` in a sloppy-mode script reads as the keyword. Module and strict code reserve both words.
- JSX text reads as code, which is why `.tsx` and `.jsx` are not scanned by default.
- `forbidImports: ["node:*"]` matches only the `node:` spelling, not a bare `"fs"`. To forbid both, spread Node's `builtinModules` from `node:module` into the entries in your test file.

### Packed install

`PackedInstall.run` packs a carrier and every workspace package it needs, then installs the carrier into a fresh project outside the workspace under each package manager that answers `--version`, and checks every expected bin is linked and executable. It carries the traps each manager sets: the parent run's `npm_*` and `pnpm_config_*` context is scrubbed, pnpm's overrides go in `pnpm-workspace.yaml`, Yarn Berry gets the `node-modules` linker, `packageManager` is pinned to the probed version, and lifecycle scripts are skipped. By default it packs each package's built `dist/prod/npm/pkg`, the artifact a release publishes; build first.

It does not run the bins; the test does, inside the same scope, because the scratch directory (`result.scratch`) is removed when the scope closes. `consumer.runBin(name, args, options?)` runs one to completion and returns `{ stdout, stderr, exitCode }`. `consumer.command(name, args?, options?)` returns the `ChildProcess` command `runBin` builds, with stdin left open for a probe. `consumer.binProvenance(name)` names the package a `.bin` symlink resolves into. `PackedInstall.closure(carrier, options?)` names every package the run will pack before it runs, and `PackedInstall.timeoutBudget` sizes the outer timeout from those names and the run's own ceilings.

```ts
import { PackedInstall } from "@beep/repo-workspaces/testing";
import * as Effect from "effect/Effect";

const proof = Effect.gen(function* () {
  const result = yield* PackedInstall.run({
    carrier: "my-tool",
    closure: "auto",
    managers: ["npm", "pnpm", "yarn", "bun"],
    bins: ["my-tool"],
    env: {},
  });
  const env = { XDG_DATA_HOME: `${result.scratch}/xdg` };
  for (const consumer of result.consumers) {
    const version = yield* consumer.runBin("my-tool", ["--version"], { env });
    // Assert version.exitCode is 0; outside pnpm, assert the provenance names the carrier.
    yield* consumer.binProvenance("my-tool");
    yield* Effect.log(`${consumer.manager}: ${version.exitCode}`);
  }
}).pipe(Effect.scoped);
```

Pass the host environment in (`process.env` from the test file): nothing in the subpath reads `process` itself. `runBin` and `command` run under the environment the install ran under, with `options.env` layered over it after the parent manager's context is stripped, so an explicit entry such as `CI: "true"` wins and a key set to `undefined` removes a variable; a non-zero exit is a result, and a bin that cannot spawn or outlives its ceiling (one minute by default) fails `BinFailed`. A requested manager that is not installed lands in `result.unavailable`; pass `require: "all"` to make that a failure instead. Declare in `consumerDependencies` every package the consumer's own code imports besides the carrier: pnpm links only declared dependencies at a project's top level. An entry that names a packed package is written as its `file:` tarball whatever spec you pass; npm fails `EOVERRIDE` when a direct spec differs from its override.

By default only the carrier may declare its bins. If any other packed package declares one of the carrier's bin names, the run fails `BinConflict` before installing: under npm, bun and Yarn's flat layouts either package can take the `.bin` slot. npm and bun 1.4.0-1.4.3 were observed to link the package whose name sorts first; bun 1.4.4 and Yarn 1 and 4 keep the carrier's, the consumer's direct dependency. Sharing bin names is a supported choice for a carrier whose front ends are also installed on their own: pass `allowSharedBins: true`, read who owns the slot with `binProvenance` (every flat layout writes a symlink, so it always answers there), and prove the carrier's own shim with `consumer.runCarrierBin(name)`, which runs the file the carrier's `bin` map names with `node`.

When a closure member needs a dependency the registry does not have yet, pass it in `overrides`: package name to a publish-ready package directory, which is `npm pack`ed, or to a `.tgz`, which is used as it is. `workspaceOverrides: true` also takes every `"<name>": "file:<path>"` entry of the root `pnpm-workspace.yaml`'s `overrides:`; an explicit `overrides` entry wins. An override naming the carrier or a closure member, a path that is neither a package directory nor a `.tgz`, or a tarball whose manifest has another name fails `InvalidOverride`.

The installs run one after another. `timeoutBudget` adds each manager's `--version` probe (30 seconds), install (`installTimeout`, four minutes by default) and `perConsumer` (one minute by default), each package's pack (`packTimeout`, two minutes by default) and manifest read (30 seconds), 30 seconds for the untimed steps and one minute for cleanup. `PackedInstall.timeoutBudgetFor(runOptions, { perConsumer? })` plans the closure from the run's own options and does both in one Effect. A vitest test's timeout is fixed when it is declared, so await it at module evaluation. `PackedInstall.preflight` and `PackedInstall.gate` turn a missing prod build into "skip locally, fail under CI". `PackedInstall` is POSIX-only and fails `UnsupportedPlatform` elsewhere.

## Features

- `Workspaces.layer` / `Workspaces.layerWithGit` / `Workspaces.resolvers` — the composite layers, split on requirements rather than feature flags: a filesystem, a filesystem plus a subprocess, and the two `@beep/npm-spec` resolver contracts.
- `Workspaces.layerWithConfigDependencies` / `Workspaces.layerWithConfigDependenciesSubprocess` — opt in to replaying a pnpm config dependency's pnpmfile hooks, which is what lets catalogs and `releaseAgeGate()` see the entries a hook injects. The default layer runs no config-dependency code at all. The two spellings differ only in where the replay happens: in process, or in a `node` child process for a consumer whose code is bundled (a GitHub Action, say), where the in-process form's computed dynamic import cannot survive the bundler. The subprocess form asks for core's `ChildProcessSpawner`; `WorkspaceCatalogs` carries the same pair.
- `Workspaces.resolverLayer` / `Workspaces.resolveManifest` — the one-call manifest-resolution path: a fresh, unmemoized layer per call so root discovery follows your cwd, and one-shot resolution of a whole `Manifest` against the real workspace.
- `WorkspaceRoot` — root discovery from a `cwd`, over `WORKSPACE_MARKERS`.
- `WorkspaceDiscovery` — package enumeration with a bounded descent for segment-crossing `packages/**` patterns, per-package lookup and the `makeTest` / `layerTest` in-memory test doubles.
- `WorkspacePackage` — a deliberately tolerant manifest model, so one member with an odd version cannot fail discovery for the whole repo. `version` is optional and carried exactly as the manifest has it — absent for the ordinary version-less private root or member, never a `"0.0.0"` placeholder; a `version` that is present but not a string is `invalidShape`. `manifestRecord` keeps the as-read `package.json` for tolerant access to fields outside the typed slice without a second read; `WorkspacePackage.manifest(pkg)` re-reads and is the opt-in bridge to `@beep/package-json`'s strict `Package`.
- `DependencyGraph` — a value class over discovered packages: `levels()` for parallel build tiers, the flattened topological order, `toMermaid()` for a deterministic Mermaid `flowchart TD` of the whole graph, and `CyclicDependencyError` — naming the cycle's actual members — when there is no order.
- `PackageManagerDetector` — npm, pnpm, yarn or bun from lockfiles and the `packageManager` field.
- `WorkspaceCatalogs` — pnpm catalog assembly and `catalog:` resolution, on pnpm's own catalog packages; `releaseAgeGate()` assembles the effective `@beep/npm-spec` `ReleaseAgeGate` from inline `pnpm-workspace.yaml` release-age keys and replayed hook contributions, strictest-wins, in the same pass as the catalogs.
- `LockfileReader` — locate and parse the workspace's lockfile through `@beep/lockfiles`.
- `PeerCheck` — unsatisfied peer-dependency detection as a pure, total value over a parsed lockfile, with `UnsatisfiedPeer` and `PeerParent` as the report's rows. Read `supported`, `unresolvedImporters` and `unverified` alongside `unsatisfied`: an empty finding list is a clean bill of health only when those three say so.
- `NoPeerDependencyRules` / `PeerDependencyRules` — the effective pnpm suppression policy `WorkspaceCatalogs.peerDependencyRules` assembles, and the "I assert none apply" value for callers that have checked.
- `ChangeDetector` — git-range change detection over `@beep/git`'s `Git` service; swap the layer to mock it with no repository.
- `PublishabilityDetector` — whether a package publishes and to where, as a `PublishTarget` (registry, directory, access, provenance). No composite provides one: pick `PublishabilityDetector.layerNpm` (standard npm semantics) or `.layerNone` (nothing publishes) and provide it explicitly.
- `ReleaseTag` / `TrackingTag` — release-tag formatting (`ReleaseTag.single` / `.scoped`, strict SemVer by default with no `v` prefix) and the floating major/minor alias derivation GitHub Actions-style consumers expect (`v1`, `v1.2`), plus `classifyTag` to tell a release tag from a tracking alias.
- `VersioningStrategy` — classify a workspace as `single`, `fixed-group` or `independent` from package names and fixed groups, or detect it live against `PublishabilityDetector`, and produce the release tags for a batch with `tagsFor`.
- `findWorkspaceRootSync` / `getWorkspacePackagesSync` — the synchronous escape hatch for config-time callers that cannot await, over file and path operations you supply.
- `@beep/repo-workspaces/testing` — the repo-shape checks above: `SourceBoundary` (with the `GlobalRule`, `ForbidImportsRule` and `ForbidTokensRule` members of `BoundaryRule`), `WorkspaceLayering` with `LayerPolicy`, and `PackedInstall` with `InstalledConsumer`.
- `@beep/repo-workspaces/node-sync` — a second entry point holding the Node bindings for those operations (`nodeFileSystem`, `nodePath` and the `nodeSyncOps` bag), kept off the main entry so `node:*` never reaches a consumer that supplies its own. `nodeFileSystem` implements the optional `readDirectoryWithTypes` fast path, so the bindings enumerate a workspace in one `readdirSync` per directory.

## Development

```sh
# from the repository root
bun run beep quality package-verify @beep/repo-workspaces

# from packages/tooling/library/repo-workspaces
bun run test
bun run test:integration
bun run check
```

The unit suites run on `@beep/memfs` volumes and scripted processes, and read their lockfile and oracle captures from `test/fixtures/` through `import.meta.glob`, so none of them touches the disk. `test/integration/` is excluded from `bun run test`: those suites drive real git, pnpm and node processes over temporary trees on the host platform (the one `nodeHost` layer in `test/integration/utils/nodeFixture.ts`), and need all three on `PATH`. Both scripts run under `bunx --bun`, and the suites pass under Node too.

## Provenance

Ported from upstream `@effected/workspaces` (MIT, C. Spencer Beggs) through the effected port, which landed it in the scratchpad module `scratchpad/effected/workspaces`. Wave 4-W-a of `goals/effected-promotion` then promoted the core and config-dependency half into this package, and wave 4-W-b the `testing` cluster (`WorkspaceLayering`, `LayerPolicy`, `SourceBoundary`, `PackedInstall`) behind the `./testing` subpath, so no lab source directory remains; the lab-wide layering and peer-closure integration tests stay under `scratchpad/test/workspaces/integration/` until the packet closes. Each promotion moved the sources to `src/`, the tests to `test/` and the fixtures to `test/fixtures/`, renamed the schema identities from `@beep/scratchpad/effected/workspaces/<Name>` to `@beep/repo-workspaces/<Name>`, and made the changes listed under Deviations. The lab review rounds and canon exceptions are archived under `goals/effected-promotion/history/`.

### Attribution

- Upstream package: `@effected/workspaces` 0.32.0
- Upstream commit: `af7566a9da2eff169cb74955efcc5ede1e5de9f8` (`~/YeeBois/references/effect/effected`)
- License: [LICENSE](./LICENSE) (MIT; beep-effect and upstream notices)
- Vendored-engine notices: none found in source headers.

### Added exports

- `WorkspaceEnumerationDepthError`: added by lab review round 1 (see the carried deviations).
- `@beep/repo-workspaces/ConfigDependencyReplay` (`HookReplaySource`, `HookReplayContext`, `HookReplay`): the replay vocabulary, split out of `ConfigDependencyHooks` in the promotion so the hooks and the resolution ladder no longer import each other. The main entry still re-exports it.
- Branded option and record schemas added by the promotion: `ReleaseTagClassification`, `TrackingTagClassification` and `UnrecognizedTagClassification` (the `classifyTag` union members), `SyncRootCeiling` and `SyncEnumerationBound` (the sync option halves), and `FetchRequest`, `DepthStop`, `BudgetStop`, `InlineCatalogBlocks`, `DependencyBlocks` and `PresentDependencyBlocks` on the `internal/*` leaves.
- `internal/manifestFields` (`manifestVersionOf`, `dependencyBlocksOf`, `DependencyMap`, `mergedDependencies`) and `internal/traverse` `excludedBy`: the helpers the two discovery surfaces and the two enumerators now share. The `internal/*` leaves are exported for tests and the lab cluster, not as a stable surface.

### Deviations

One entry per class of change (law- or ruling-forced) and one per behavioural divergence. The lab ledger rows hold the full upstream and port behaviour for the port-era entries.

Promotion (wave 4-W-a):

- **schema-first** — the plain-data records and option bags are branded `S.Opaque` structs built with `X.make`, which copies its input, so compare them structurally and never with `===`. Option parameters take `X.Encoded`, or `X.Input` where a field holds a live class (`PeerCheckOptions`, `WorkspaceSnapshotsOptions`). A required field whose schema is itself an `S.Opaque` carries no key annotation, because annotating it rebuilds the struct and drops the brand. Inline helper contracts are named schemas (`InlineCatalogBlocks`, `DependencyBlocks`, `PresentDependencyBlocks`).
- **filesystem** — the config-dependency ladder (`internal/configDependencyResolution`, `internal/configDependencyFetch`, `internal/configDependencyShared`) reads through Effect `FileSystem`, `Path` and `Config` instead of `node:fs`, `node:os` and `process.env`; the store roots come from `Config` and `HostProcessPlatform`, with `HOME`/`USERPROFILE` as the home directory. Upstream's `os.homedir()` falls back to the passwd entry; this port does not, so with both variables unset (a login-less runner, a systemd unit with a clean environment) the home-based store roots are not searched (`test/internal/configDependencyResolution.coverage.test.ts`). `ConfigDependencyHooks.layerLive` therefore requires `FileSystem | Path`, `layerFrom` requires `Path`, and `layerSubprocess` requires the spawner, `FileSystem` and `Path`. `node-sync` reaches `node:fs` lazily and fails with `NodeSyncUnavailableError` on a runtime without it.
- **ambient-cwd** — `internal/layerRoot` `ambientCwd` is the one read of the ambient directory (`findLayerRoot` and `Workspaces` local exec). Like upstream's bare `process.cwd()`, a runtime without one fails, here as a defect; it never starts the root ascent at `/` (`test/internal/layerRoot.coverage.test.ts`, `test/Workspaces.coverage.test.ts`).
- **module-split** — `ConfigDependencyReplay` holds the replay vocabulary (see Added exports).
- **payload-rename** — `PackageNotFoundError` names its field `packageName` (D-24).
- **option-returns** — `WorkspacePatterns`'s string-entry filter and `internal/catalogs` `catalogNameOf` return `Option` instead of `undefined` and `null`.
- **complexity** — every function over the cognitive ceiling is split into named helpers (the `PeerCheck` walk and link scan, `DuplicateCheck`, both enumerators, the detector ladder, `ReleaseTag`, the catalog readers, the snapshots and `DependencyGraph`), and the duplicated readers fold into the shared helpers under Added exports. The detector ladder probes `yarn.lock` in both tiers, so a lockfile written while detection runs is still recognized.
- **effect-string** — string, array and record operations go through `effect/String`, `effect/Array` and `effect/Record` in source and tests, and the tests use `HashSet` and `MutableHashMap`.
- **runtime-portability** — `ConfigDependencyHooks.layerSubprocess` passes a `beep-replay` placeholder before its three argv payloads, and the replay script reads the last three `process.argv` entries. Bun's `node` shim under `bunx --bun` consumes the first argument after `-e`, so the lab's child lost its seed there and every subprocess replay failed under Bun; node passes the placeholder through. `ConfigDependencyHooksSubprocess.test.ts` pins the seven-argument contract.
- **test-environment** — the unit suites run on `@beep/memfs` (the fake pnpm in `test/support/fakeProcess.ts` writes into the same volume), load captures through `import.meta.glob`, and take node's `win32` and `posix` paths from `test/support/hostPath.ts`; the real-disk `readDirectoryWithTypes` case lives in `test/integration/node-sync.int.test.ts`. Layers reach tests through `it.layer` with a timeout, `Layer.build` or `Effect.provideService`, never `Effect.provide`, so no file carries an `@effect-diagnostics` skip directive. Five schema-heavy files gain a schema-derived round-trip property.

Promotion (wave 4-W-b, the `./testing` cluster):

- **schema-first** — the testing records and option bags follow the 4-W-a pattern: `SourceLiteral`, `LexedSource`, `ConsumerInput`, `PackedManifest`, `PackDirectory`, `BoundaryFixture`, `ReferenceOptions`, `ScanOptions`, `BinCommandOptions`, `BinProvenance`, `PackedInstallClosureOptions`, `PackedInstallPreflightOptions`, `PackedInstallPreflight`, `PackedInstallGate`, `PackedInstallResult` and `LayeringGraph` are branded `S.Opaque`, and the `PackedInstallOptions`, `RunBinOptions` and `PackedInstallBudget` interfaces are schemas whose ceilings accept any `Duration` input `Duration.fromInput` does. Every operation takes `X.Encoded` (`WorkspaceLayering.check` takes `LayeringGraph.Input`, which holds live `LayerEdge` values), so callers keep passing plain objects. `BoundaryRule` is the `GlobalRule` kit beside the `ForbidImportsRule` and `ForbidTokensRule` records.
- **option-returns** — `internal/sourceText` `cookIdentifier` and `internal/packedInstallPlan` `versionOf` return `Option` instead of `undefined`; `identifierTokens` returns an array instead of a lazy iterator.
- **complexity** — the lexer is a `Lexer` class of single-purpose steps, `SourceBoundary.check` dispatches each rule through `GlobalRule.match`, `scan` lists directories through named steps, and `PackedInstall.run`, `planClosure` and `binProvenance` delegate to module-level steps (probe, pack, inspect, replacement resolution, consumer install, bin checks, provenance walk). Spans name their owner (`PackedInstall.*`, `InstalledConsumer.*`).
- **shared-bins** — the real-manager suite keys bun's `.bin` winner by the probed version (1.4.4 links the carrier, earlier releases the name that sorts first) and requires `binProvenance` for every flat layout; upstream expected the front end under every bun (`test/integration/e2e/PackedInstall.e2e.test.ts`).
- **runtime-portability** — the P3 S1 control expects Bun's "Cannot find module" under Bun and Node's `ERR_MODULE_NOT_FOUND` under Node, keyed by `process.versions.bun`, since under `bunx --bun` the binary that imports from the consumer root is Bun's; the suite's own manager probe is bounded at 30 seconds, as the run's is.
- **reachability** — `PackedInstall` is the one `./testing` module that loads `@beep/commands`, the operational adapter that packs and installs; `test/reachability.test.ts` admits it and the `./testing` entry.
- **test-environment** — the testing suites read package sources through the raw-glob `test/support/sourceGraph.ts` (`sourceTexts`), the real-tree and real-manager suites take the `nodeHost` layer and write their fixtures through Effect `FileSystem`, and no file carries an `@effect-diagnostics` skip directive. `PackedInstallPlan` and `SourceBoundary` gain schema-derived round-trip properties.

Carried from the port:

- **native-runtime** — Effect hash collections and own-key-safe records replace native collections, frozen/null-prototype defaults and Object.* operations, with explicit snapshot version order (packages/tooling/library/repo-workspaces/test/DependencyGraph.test.ts:34; packages/tooling/library/repo-workspaces/test/PackedInstallPlan.test.ts; packages/tooling/library/repo-workspaces/test/WorkspaceSnapshots.test.ts:768; packages/tooling/library/repo-workspaces/test/WorkspacePackage.test.ts:331).
- **identity-keys** — Service-owned latest-snapshot fields with === comparisons replace WorkspaceDiscovery’s three identity-keyed WeakMap caches (packages/tooling/library/repo-workspaces/test/WorkspaceDiscovery.test.ts:801; packages/tooling/library/repo-workspaces/test/WorkspaceDiscovery.test.ts:896; packages/tooling/library/repo-workspaces/test/WorkspaceDiscovery.test.ts:905).
- **tagged-errors** — Tagged schema errors replace plain Error/RangeError failures and defects, and the three originating-cause error schemas preserve encoded stacks (packages/tooling/library/repo-workspaces/test/WorkspacesSync.test.ts:209; packages/tooling/library/repo-workspaces/test/LockfileReader.test.ts:278; packages/tooling/library/repo-workspaces/test/entrypoints.test.ts).
- **schema-first** — Executable annotated schemas, LiteralKit domains, derived guards and JSON codecs replace type-only payloads, repeated literals, manual guards and parsing, changing forced JSON error causes to SchemaError (packages/tooling/library/repo-workspaces/test/SourceBoundary.test.ts; packages/tooling/library/repo-workspaces/test/WorkspaceCatalogsPmAware.test.ts; packages/tooling/library/repo-workspaces/test/WorkspaceSnapshots.test.ts:804; packages/tooling/library/repo-workspaces/test/ConfigDependencySpec.test.ts).
- **numeric-domains** — S.Finite rejects non-finite offence coordinates and layering counts accepted by Schema.Number, while a schema-derived integer-depth guard preserves traversal acceptance (packages/tooling/library/repo-workspaces/test/SourceBoundary.test.ts; packages/tooling/library/repo-workspaces/test/WorkspaceLayering.test.ts; packages/tooling/library/repo-workspaces/test/WorkspaceDiscovery.test.ts:275; packages/tooling/library/repo-workspaces/test/WorkspacesSync.test.ts:209).
- **type-safety** — Schema and Predicate narrowing with typed Record/Option access replace unchecked runtime casts in hooks, manifest readers and planning helpers (module suite packages/tooling/library/repo-workspaces/test/**).
- **tsgo-diagnostics** — Tsgo forces zero-argument service thunks to Effect values, adds dual helper overloads and pipeable expressions, and reroutes four synchronous fs/path bindings through getBuiltinModule (packages/tooling/library/repo-workspaces/test/LockfileReader.test.ts:58; packages/tooling/library/repo-workspaces/test/WorkspaceDiscovery.test.ts:842; packages/tooling/library/repo-workspaces/test/WorkspaceCatalogs.test.ts:568; packages/tooling/library/repo-workspaces/test/WorkspaceSnapshots.test.ts; packages/tooling/library/repo-workspaces/test/WorkspacesSync.test.ts).
- **effect-first** — Effect.fn/fnUntraced operations, Effect helper sorts/orders and scoped layer/context composition replace arrow-wrapped generators and native helper patterns (module suite packages/tooling/library/repo-workspaces/test/**).
- **effect-imports** — Per-module effect/* imports replace the root effect barrel in source, tests and examples (module suite packages/tooling/library/repo-workspaces/test/**).
- **identity-annotations** — Beep $I annotations replace local schema identifiers and retarget JSON Schema definitions to namespaced keys (packages/tooling/library/repo-workspaces/test/LayerPolicy.test.ts; packages/tooling/library/repo-workspaces/test/ConfigDependencySpec.test.ts; packages/tooling/library/repo-workspaces/test/VersioningStrategy.test.ts).
- **test-environment** — Bun workspace discovery, Beep package names, lab-derived layering fixtures and bunx context replace upstream pnpm-monorepo test assumptions (packages/tooling/library/repo-workspaces/test/integration/e2e/PackedInstall.e2e.test.ts; scratchpad/test/workspaces/integration/layering.int.test.ts; packages/tooling/library/repo-workspaces/test/integration/node-sync.int.test.ts; scratchpad/test/workspaces/integration/peerClosure.int.test.ts; packages/tooling/library/repo-workspaces/test/integration/self.int.test.ts).
- **upstream-bug** — Escaping root links retain unmatched .. segments and unresolvedEdge instead of borrowing an unrelated internal package’s peers (packages/tooling/library/repo-workspaces/test/PeerCheck.test.ts:747).
- **upstream-bug** — Unrepresentable numeric version fields make TrackingTag.forVersion return [] instead of throwing during construction (packages/tooling/library/repo-workspaces/test/TrackingTag.test.ts:119).
- **upstream-bug** — Unrepresentable tracking-tag fields make classifyTag return unrecognized instead of throwing (packages/tooling/library/repo-workspaces/test/TrackingTag.test.ts:231).
- **upstream-bug** — Malformed version suffixes derive no tracking aliases instead of being discarded before core validation (packages/tooling/library/repo-workspaces/test/TrackingTag.test.ts:133).
- **upstream-bug** — Malformed version suffixes classify as unrecognized instead of releases across all supported tag styles (packages/tooling/library/repo-workspaces/test/TrackingTag.test.ts:245).
- **upstream-bug** — CatalogSet.rangeOf returns None for inherited catalog/dependency names instead of fabricating values or suppressing valid snapshot fallback (packages/tooling/library/repo-workspaces/test/WorkspaceCatalogs.test.ts:594; packages/tooling/library/repo-workspaces/test/WorkspaceCatalogs.test.ts:599; packages/tooling/library/repo-workspaces/test/WorkspaceStateSnapshotSeed.test.ts:275).
- **upstream-bug** — CatalogSet.resolveSpecifier checks own-key membership and returns None for inherited names instead of throwing through pnpm (packages/tooling/library/repo-workspaces/test/WorkspaceCatalogs.test.ts:594; packages/tooling/library/repo-workspaces/test/WorkspaceCatalogs.test.ts:599; packages/tooling/library/repo-workspaces/test/WorkspaceCatalogs.test.ts:606).
- **upstream-bug** — WorkspaceStateSnapshot.resolveIn requires own importer and dependency keys instead of fabricating versions from prototypes (packages/tooling/library/repo-workspaces/test/importerVersions.test.ts:186; packages/tooling/library/repo-workspaces/test/importerVersions.test.ts:191).
- **upstream-bug** — WorkspacePackage.dependencyDiff preserves an own __proto__ addition instead of losing it (packages/tooling/library/repo-workspaces/test/WorkspacePackage.test.ts:307).
- **upstream-bug** — WorkspacePackage.dependencyDiff preserves an own __proto__ removal instead of losing it (packages/tooling/library/repo-workspaces/test/WorkspacePackage.test.ts:315).
- **upstream-bug** — WorkspacePackage.dependencyDiff preserves an own __proto__ change payload instead of mutating the result prototype (packages/tooling/library/repo-workspaces/test/WorkspacePackage.test.ts:323).
- **upstream-bug** — WorkspaceRoot discovery passes a nearer null manifest and finds a valid ancestor instead of aborting with a property-access defect (packages/tooling/library/repo-workspaces/test/WorkspaceRoot.test.ts:116).
- **upstream-bug** — Top-level Bun default/named catalogs are validated and merged instead of being ignored when catalogs are outside the workspaces object (packages/tooling/library/repo-workspaces/test/WorkspaceCatalogsPmAware.test.ts:21; packages/tooling/library/repo-workspaces/test/WorkspaceCatalogsPmAware.test.ts:34; packages/tooling/library/repo-workspaces/test/integration/self.int.test.ts:110).
- **upstream-bug** — The lab child retains an own __proto__ catalog with ordered entries instead of dropping it through upstream object assignment (packages/tooling/library/repo-workspaces/test/ConfigDependencyHooksSubprocess.test.ts:135).
- **upstream-bug** — The lab preserves absolute link identity and unresolvedEdge instead of attributing an external target to an upstream workspace-relative manifest (packages/tooling/library/repo-workspaces/test/PeerCheck.test.ts:765).
- **upstream-bug** — The lab returns [] for an empty supplied tracking package name instead of throwing during upstream alias construction (packages/tooling/library/repo-workspaces/test/TrackingTag.test.ts:102).
- **upstream-bug** — The lab retains own replay-version keys in historical, live and serialized snapshots instead of silently dropping upstream __proto__ entries (packages/tooling/library/repo-workspaces/test/WorkspaceSnapshots.test.ts:863).
- **upstream-bug** — The lab historically merges top-level and nested Bun catalogs with tolerant nested precedence instead of upstream nested-only assembly (packages/tooling/library/repo-workspaces/test/WorkspaceSnapshots.test.ts:911).
- **native-runtime** — The lab passes an Effect HashMap at the importer-name boundary instead of the upstream native Map backing escape (packages/tooling/library/repo-workspaces/test/LockfileReader.test.ts).
- **schema-first** — The lab adds executable schemas and derived types for previously erased upstream options, data payloads and variants while retaining plain operation representations (packages/tooling/library/repo-workspaces/test/ReleaseTag.property.test.ts; packages/tooling/library/repo-workspaces/test/Workspaces.test.ts; packages/tooling/library/repo-workspaces/test/internal/roots.coverage.test.ts).
- **tagged-errors** — The lab encodes originating stacks in three additional error schemas instead of upstream name/message-only Defect causes (packages/tooling/library/repo-workspaces/test/PackedInstall.test.ts; packages/tooling/library/repo-workspaces/test/WorkspaceDiscovery.test.ts:920; packages/tooling/library/repo-workspaces/test/WorkspacePackage.test.ts:345).
- **numeric-domains** — The lab schemas restrict new literal-offset and version-core numeric fields to finite values instead of unrestricted upstream number models while leaving operation inputs unchanged (packages/tooling/library/repo-workspaces/src/internal/sourceText.ts; packages/tooling/library/repo-workspaces/src/ReleaseTag.ts:99).
- **identity-annotations** — The lab gives replay envelope fields and two reusable checks canonical identity metadata instead of their anonymous upstream schema surfaces (packages/tooling/library/repo-workspaces/src/ConfigDependencyHooks.ts:760; packages/tooling/library/repo-workspaces/src/ReleaseTag.ts:114; packages/tooling/library/repo-workspaces/src/internal/traverse.ts:30).
- **upstream-bug** — the lab keys duplicate-instance provenance with a JSON tuple codec, so relationships containing embedded NULs stay distinct; upstream's NUL-delimited keys merge them (packages/tooling/library/repo-workspaces/test/DuplicateCheck.test.ts:45; packages/tooling/library/repo-workspaces/test/DuplicateCheck.test.ts:77)
- **upstream-bug** — the lab only treats a pnpm-workspace.yaml that is a regular file as the root marker; upstream also accepts a directory with that name (packages/tooling/library/repo-workspaces/test/WorkspaceRoot.test.ts:130; packages/tooling/library/repo-workspaces/test/WorkspaceRoot.test.ts:147)
- **upstream-bug** — the lab rejects '..' traversal segments in config-dependency versions before building paths; upstream checks names only (packages/tooling/library/repo-workspaces/test/internal/configDependencyResolution.coverage.test.ts:15; packages/tooling/library/repo-workspaces/test/integration/ConfigDependencyHooks.int.test.ts:238)
- **upstream-bug** — the lab keeps an own __proto__ registry scope; upstream's plain assignment drops it (packages/tooling/library/repo-workspaces/test/internal/configDependencyFetch.coverage.test.ts:42)
- **schema-first** — the lab decodes and encodes the remaining synchronous JSON boundaries through Schema codecs, so malformed-JSON causes are SchemaError; upstream uses JSON.parse/JSON.stringify and surfaces SyntaxError (packages/tooling/library/repo-workspaces/test/WorkspacesSync.test.ts:676; packages/tooling/library/repo-workspaces/test/PackedInstallPlan.test.ts; packages/tooling/library/repo-workspaces/test/internal/packedInstallPlan.coverage.test.ts)

### Dependency backlog

None.

## License

[MIT](LICENSE)
