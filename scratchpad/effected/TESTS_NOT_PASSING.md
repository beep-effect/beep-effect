# Copied tests that do not pass in the lab

State after the verbatim copy (step 1) and the test-side layout fixes (first part of step 2),
measured 2026-10-09. Every other copied test passes. Nothing below was skipped, deleted or
edited; each test is exactly as upstream wrote it.

The operator has not yet ruled on these. Options on the table: leave them failing as recorded
here, skip them with a reason, or supply what they need (for example the upstream
`package.json` as a data file).

## Summary

| Module | Result after the layout fixes | Environment-bound | Other |
| --- | --- | --- | --- |
| cli | 15 failed, 1614 passed (1629) | 13 | 2 |
| engine | 1 failed, 51 passed (52) | 1 | 0 |
| env | 281 passed (281) | 0 | 0 |
| github | 2 failed, 369 passed (371) | 2 | 0 |
| github-actions | 5 failed, 649 passed (654) | 7 | 3 |
| memfs | 1 failed, 554 passed, 21 skipped (576) | 1 | 0 |
| npm | 286 passed (286) | 0 | 0 |
| sbom | 3 failed, 127 passed (130) | 3 | 0 |
| schema-org | 98 passed (98) | 0 | 0 |
| workspaces | 15 failed, 988 passed, 1 skipped (1004) | 15 | 0 |
| yaml | 2040 passed (2040) | 0 | 0 |

Totals: 42 environment-bound, 5 other.

## Environment-bound

### cli

- `scratchpad/test/cli/declarations.test.ts > the built declarations > match the source entrypoints they were built from, or the gates below would read a stale build`: needs built dist output. Compares src entrypoints with dist/dev/pkg/*.d.ts, which is not built here; it also needs a SRC path fix, so it was left unchanged.
- `scratchpad/test/cli/declarations.test.ts > the built declarations > let a consumer provide CliUi.run's CliTheme from the root entrypoint, leaving no requirement`: needs built dist output. Symlinks dist/dev/pkg plus the package's own node_modules (effect, @types/node, .bin/tsc) into a temp consumer and compiles it; none of those exist here.
- `scratchpad/test/cli/declarations.test.ts > the built declarations > leave no top-level declaration in ui.d.ts or ui-testing.d.ts unexported, so the scoped suppression hides nothing`: needs built dist output. Reads dist/dev/pkg/ui.d.ts and ui-testing.d.ts, which are not built here.
- `scratchpad/test/cli/declarations.test.ts > the built declarations > give every export of ui.d.ts and ui-testing.d.ts a release tag, which API Extractor does not report for them`: needs built dist output. Reads the rolled-up dist/dev/pkg/*.d.ts, which are not built here.
- `scratchpad/test/cli/declarations.test.ts > the published manifest > declares every type package ui.d.ts imports as an optional peer, beside the runtime peers it types`: needs built dist output. Reads dist/dev/pkg/ui.d.ts and the built dist/dev/pkg/package.json manifest, neither of which exists here.
- `scratchpad/test/cli/declarations.test.ts > the reviewed ./ui and ./ui/testing surfaces > each built .d.ts exports exactly the reviewed names`: needs built dist output. Reads dist/dev/pkg/ui.d.ts and ui-testing.d.ts, which are not built here.
- `scratchpad/test/cli/declarations.test.ts > the reviewed ./ui and ./ui/testing surfaces > each built module exports exactly the reviewed values`: needs built dist output. Imports the built bundles dist/dev/pkg/ui.js and ui-testing.js, which do not exist here.
- `scratchpad/test/cli/declarations.test.ts > the reviewed ./ui and ./ui/testing surfaces > the members the reviewed lists add are on the built declarations`: needs built dist output. Reads dist/dev/pkg/ui.d.ts and ui-testing.d.ts, which are not built here.
- `scratchpad/test/cli/CliStdin.test.ts > a non-interactive run never consumes piped stdin > a handler that waits before reading still gets every byte, through the fallback path`: needs built dist output. Runs fixtures/stdin-gate.mts under Node's strip-only mode; upstream resolves the sibling @effected packages to built output, while here they load as source and the child dies with ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX at scratchpad/effected/glob/internal/limits.ts:31 (a parameter property). Seen with the fixture path fixed, then the fixture was put back unchanged.
- `scratchpad/test/cli/CliStdin.test.ts > a non-interactive run never consumes piped stdin > control: with the flag given, the same handler also gets every byte`: needs built dist output. Same fixture and same cause as the test above: the sibling packages must be built JS for Node's strip-only mode to run the chain.
- `scratchpad/test/cli/ui/CliUi.live.exit.test.ts > CliUi.live in a real process: the tick never holds it open > the process exits promptly once the view's scope closes: no ref'd timer is left behind`: needs built dist output. Runs fixtures/live-exit.mts under Node's strip-only mode and fails the same way (glob/internal/limits.ts:31 loaded as source instead of built output); seen with the fixture path fixed, then the fixture was put back unchanged.
- `scratchpad/test/cli/ui/CliUiTest.serializer.test.ts > @effected/cli/ui/testing/serializer > is registered through the config: an escape-laden string snapshots as token markup`: inspects the upstream repository. The serializer is registered by upstream's root vitest.config.ts (snapshotSerializers for the @effected/cli project); scratchpad/vitest.effected.config.ts does not register it and the test forbids expect.addSnapshotSerializer.
- `scratchpad/test/cli/boundary.test.ts > cli boundary > reachability > ./ui files name the package's own entrypoint through import type only, so the root types are never copied`: needs the package's own package.json. Asserts ui/CliUi.ts imports the root types through the package's own name "@effected/cli", a self-reference that needs the package's name and exports map; the copy rewrote it to "../index.ts". Its two mutation-control literals were also rewritten by the copy (see otherFailures), so it was left unchanged.

### engine

- `scratchpad/test/engine/entrypoints.test.ts > ./guard loads nothing before its guards listen > the built ./guard reaches only ProcessGuard.js, and no package at all`: needs built dist output. It asserts that build:dev emitted dist/dev/pkg/guard.js and walks the built .js graph, and this repo has no build output for the module; the test was left exactly as copied and still fails on the same existsSync assertion as in the baseline.

### github

- `scratchpad/test/github/reachability.test.ts > bundle reachability > the package declares itself side-effect free`: needs the package's own package.json. It reads the package's own package.json (resolve(SRC, "..", "package.json")) to assert "sideEffects": false, and the copied module has no package.json in this repo (ENOENT on scratchpad/effected/package.json).
- `scratchpad/test/github/reachability.test.ts > bundle reachability > every runtime dependency is declared`: needs the package's own package.json. It reads the package's own package.json to compare reachable bare imports against dependencies and peerDependencies, and that manifest does not exist in this repo (ENOENT on scratchpad/effected/package.json).

### github-actions

- `reachability.test.ts > bundle reachability > the package declares itself side-effect free`: needs the package's own package.json. Reads the package's own package.json (resolve(SRC, "..", "package.json")) to assert "sideEffects": false; the module has no package.json in this repo (ENOENT on scratchpad/effected/package.json). Test body left unchanged.
- `reachability.test.ts > bundle reachability > every runtime dependency is declared`: needs the package's own package.json. Reads the package's own package.json to compare dependencies/peerDependencies with the import graph; the module has no package.json in this repo (ENOENT on scratchpad/effected/package.json). Test body left unchanged.
- `ambientReads.test.ts > ambient process reads > every read of process.env / process.arch / process.platform in src/ is an allowlisted site`: host or other. The file imports the TypeScript 7 scanner from "typescript/unstable/ast" (upstream pins typescript@7.0.2); here the bare "typescript" package resolves to 6.0.3, which has no such export, so the suite fails at import with 0 tests collected. It also needs the "../src/" path fix at line 23, so the file was left unchanged.
- `ambientReads.test.ts > ambient process reads > the scan can fail — it is asserting on a non-empty set with ActionEnvironment in it`: host or other. Same suite-level import failure: "typescript/unstable/ast" needs TypeScript 7 as the bare "typescript" package and this repo resolves 6.0.3; it also needs the "../src/" path fix, so it was left unchanged.
- `ambientReads.test.ts > ambient process reads > the scanner counts code, not comments or strings, and sees inside a template substitution`: host or other. Same suite-level import failure: "typescript/unstable/ast" needs TypeScript 7 as the bare "typescript" package and this repo resolves 6.0.3.
- `ambientReads.test.ts > ambient process reads > the scanner resumes template text after a substitution, so `}` inside a template is not code`: host or other. Same suite-level import failure: "typescript/unstable/ast" needs TypeScript 7 as the bare "typescript" package and this repo resolves 6.0.3.
- `ambientReads.test.ts > ambient process reads > a lookalike is not a read: another object's `.env`, or `process` without the member`: host or other. Same suite-level import failure: "typescript/unstable/ast" needs TypeScript 7 as the bare "typescript" package and this repo resolves 6.0.3.

### memfs

- `scratchpad/test/memfs/integration/node.int.test.ts > FileSystem errno parity (node) > failure shape matches the node adapter > copyFile from a directory`: host or other. The case runs fs.copyFile(emptyDir, out) on the real filesystem under os.tmpdir() and expects EISDIR on Linux, but os.tmpdir() here is /home/elpresidank/.cache/claude-tmp on btrfs, where an empty directory has st_size 0, so Node 24.20.0 copies zero bytes and succeeds; it needs a temp filesystem whose empty directories report a non-zero size (ext4, xfs, tmpfs).

### sbom

- `scratchpad/test/sbom/reachability.test.ts > bundle reachability > the package declares itself side-effect free`: needs the package's own package.json. Reads the package's own package.json (resolve(SRC, "..", "package.json")) to assert sideEffects === false; the module has no package.json here (now ENOENT on scratchpad/effected/package.json).
- `scratchpad/test/sbom/reachability.test.ts > bundle reachability > every runtime dependency is declared`: needs the package's own package.json. Reads dependencies/peerDependencies from the package's own package.json to check every reachable bare import is declared; no such manifest exists in this repo.
- `scratchpad/test/sbom/reachability.test.ts > bundle reachability > the SBOM half reaches only effect and the kit packages it derives from`: inspects the upstream repository. Expects the bare sibling-package specifier "@effected/spdx" in the reachable set of Sbom.ts and SbomMetadataSource.ts, but here spdx is vendored and imported as "../spdx/index.ts", which the walker follows as a relative edge instead of recording, so the actual set is ["effect"].

### workspaces

- `scratchpad/test/workspaces/e2e/PackedInstall.e2e.test.ts > PackedInstall against a real fixture workspace > runs under pnpm, and every manager spawn gets the parent's context scrubbed`: needs pnpm. It asserts the suite itself was launched through pnpm (npm_config_user_agent matching /^pnpm\//); here vitest is launched by bun and the value is 'bun/1.4.2 npm/? node/v26.3.0 linux x64'.
- `scratchpad/test/workspaces/integration/layering.int.test.ts > the kit's layering, checked by WorkspaceLayering > the discovered workspace satisfies lib/configs/layers.json, over dozens of real edges`: inspects the upstream repository. It loads <repo root>/lib/configs/layers.json and checks the upstream @effected workspace graph against it; this repo has no lib/configs directory.
- `scratchpad/test/workspaces/integration/layering.int.test.ts > the kit's layering, checked by WorkspaceLayering > each of spec §4's forbidden edges is rejected by this policy (positive controls)`: inspects the upstream repository. Same shared setup: needs the upstream lib/configs/layers.json policy and the upstream @effected package graph.
- `scratchpad/test/workspaces/integration/layering.int.test.ts > the kit's layering, checked by WorkspaceLayering > test-only devDependency edges exist, sit outside the checked fields, and would be caught if checked`: inspects the upstream repository. Same shared setup: needs lib/configs/layers.json and the upstream @effected/engine -> @effected/workspaces devDependency edge.
- `scratchpad/test/workspaces/integration/layering.int.test.ts > the kit's layering, checked by WorkspaceLayering > the whole graph, every field included, is acyclic`: inspects the upstream repository. Same shared setup fails on the missing lib/configs/layers.json before the graph is examined, and the graph it means is the upstream workspace.
- `scratchpad/test/workspaces/integration/node-sync.int.test.ts > the node-sync preset against the real repository > findWorkspaceRootSync finds the workspace root from a packages/ subdir`: inspects the upstream repository. It asserts a pnpm-workspace.yaml exists at the discovered workspace root; this repo is a bun workspace without that file.
- `scratchpad/test/workspaces/integration/node-sync.int.test.ts > the node-sync preset against the real repository > getWorkspacePackagesSync enumerates this package and its siblings`: inspects the upstream repository. It expects @effected/workspaces, @effected/glob and @effected/walker to be workspace packages; the copied modules have no package.json here and the workspace lists @beep/* packages.
- `scratchpad/test/workspaces/integration/peerClosure.int.test.ts > every published @effected package declares its full peer closure > none is missing a peer that a dependency or peer of it requires`: inspects the upstream repository. It requires more than 25 published @effected workspace packages with their manifests; this repo's workspace contains none (0 found).
- `scratchpad/test/workspaces/integration/self.int.test.ts > the effected repository, discovered by the package that lives in it > discovers itself, and its siblings`: inspects the upstream repository. It expects @effected/workspaces, lockfiles, glob and walker among the discovered workspace packages; this repo's workspace has only @beep/* packages.
- `scratchpad/test/workspaces/integration/self.int.test.ts > the effected repository, discovered by the package that lives in it > attributes this very test file to this package`: needs the package's own package.json. It needs the package's own package.json named @effected/workspaces above the test file; here the nearest manifest is @beep/scratchpad.
- `scratchpad/test/workspaces/integration/self.int.test.ts > the effected repository, discovered by the package that lives in it > detects pnpm`: needs pnpm. It asserts the containing repository is managed by pnpm; this repo is managed by bun (detected 'bun').
- `scratchpad/test/workspaces/integration/self.int.test.ts > the effected repository, discovered by the package that lives in it > builds an acyclic graph and orders workspaces before their dependents`: inspects the upstream repository. It orders @effected/lockfiles, glob and walker before @effected/workspaces in the workspace graph; none of them is a workspace package here (indexOf is -1 for all).
- `scratchpad/test/workspaces/integration/self.int.test.ts > the effected repository, discovered by the package that lives in it > resolves the repo's own effect catalog entry`: inspects the upstream repository. It reads the upstream pnpm-workspace.yaml named catalog `effect`; this repo has no such named catalog.
- `scratchpad/test/workspaces/integration/self.int.test.ts > the effected repository, discovered by the package that lives in it > reads the real pnpm-lock.yaml with importer paths resolved to real names`: inspects the upstream repository. It asserts the repository lockfile is pnpm format with an @effected/glob importer; this repo has only bun.lock (see notes for the bun parse error it surfaces).
- `scratchpad/test/workspaces/integration/self.int.test.ts > the sync escape hatch agrees with the Effect surface > getWorkspacePackagesSync agrees on the dependency maps too`: needs the package's own package.json. It looks up the workspace package named @effected/workspaces, which needs the package's own package.json; discovery fails with PackageNotFoundError here.

## Other

Failures that are neither a layout path nor a missing environment.

- **cli**: scratchpad/test/cli/boundary.test.ts > cli boundary > reachability > no root module imports the package's own name, which would make the root declarations import themselves: the real-tree part passes; the mutation control fails (expected [] to deeply equal ['@effected/cli']) because the copy's specifier rewrite changed a string literal that is scanner input, not an import: 'import type { CliTheme } from "@effected/cli";' became '... from "../../effected/cli/index.ts";' (line 287; line 292 likewise), which isPackageSelfName cannot match. Updating the expected value cannot fix it. Not changed: restoring a literal is outside the allowed changes.
- **cli**: scratchpad/test/cli/boundary.test.ts > cli boundary > reachability > mutation control: a root module reaching ./ui is flagged, however it gets there: throws 'no module /effected/cli/ui-testing.ts' because the copy rewrote the virtual module text at line 398 from import("@effected/cli/ui") / "@effected/cli/ui/testing" to relative paths, which the walker then follows out of the virtual graph. Same cause, not changed. Verified with a throwaway copy of the file: restoring lines 269, 272, 287, 292 and 398 to upstream text makes this test and the one above pass (11 of 12 in the file), leaving only the package-self-name test listed under environmentBound.
- **github-actions**: reachability.test.ts > bundle reachability > the light half reaches only effect and the kit packages it derives from - AssertionError at line 158: expected ['@effected/github-commands','effect'], received ['effect']. Cause: the copy rewrote the source's bare sibling imports ("@effected/github-commands", "@effected/glob", "@effected/walker") to relative paths ("../github-commands/index.ts" etc.). The test's walker treats every specifier starting with "." as an intra-package edge and follows it, so the sibling kit packages never appear in the bare-import set. Not fixable by rules 1 or 2: replacing the expected literal with the rewritten specifier still fails because the walker never records relative specifiers, and dropping the literal would remove an asserted edge. Left unchanged.
- **github-actions**: reachability.test.ts > bundle reachability > the markdown engine is confined to the writer, on Azure's terms - AssertionError at line 207 ('GitHubMarkdown does not reach the engine — the walker is blind: expected false to be true'). Same cause: GitHubMarkdown.ts now imports "../markdown/index.ts" instead of "@effected/markdown" (and ManagedDocument/CheckDocument import "../templates/index.ts"), which the walker follows instead of recording. Left unchanged.
- **github-actions**: reachability.test.ts > bundle reachability > the @effected/npm edge is confined to the installer, on Azure's terms - AssertionError at line 233 ('PackageManagerInstaller does not reach @effected/npm — the walker is blind: expected false to be true'). Same cause: PackageManagerInstaller.ts now imports "../npm/index.ts" instead of "@effected/npm". Left unchanged.
