# Workspaces environment retarget verification

The full requested module command was run before and after. All pre-existing skips remain unchanged; no timeout was raised.

## Recorded cases

13 of the 15 recorded cases pass. The two remaining cases have Bun equivalents and expose source limitations outside this task's write surface:

- Catalog assembly reads only `package.json.workspaces.catalog`/`catalogs`, while this repository declares top-level `catalog`. Its lockfile fallback also fails to parse the nested override.

- The real `bun.lock` is rejected at `overrides["onnxruntime-node@1.30.0"]`: Expected string.

## Other failures observed in this sandbox

These failures were already present in the before run. Entries below preserve the final observed failure per test or suite. Subprocess setup explicitly reports `spawnSync git EPERM`; child-process suites also report empty output, unavailable managers and hook-assembly failures. No network/socket/subprocess workaround was attempted.

###  scratchpad/test/workspaces/integration/ConfigDependencyFetch.int.test.ts [ scratchpad/test/workspaces/integration/ConfigDependencyFetch.int.test.ts ]

```text
Error: spawnSync git EPERM
```

###  scratchpad/test/workspaces/integration/WorkspaceSnapshotsHookReplay.int.test.ts [ scratchpad/test/workspaces/integration/WorkspaceSnapshotsHookReplay.int.test.ts ]

```text
Error: spawnSync git EPERM
```

###  scratchpad/test/workspaces/integration/WorkspaceSnapshotsNested.int.test.ts [ scratchpad/test/workspaces/integration/WorkspaceSnapshotsNested.int.test.ts ]

```text
Error: spawnSync git EPERM
```

###  scratchpad/test/workspaces/e2e/PackedInstall.e2e.test.ts > PackedInstall against a real fixture workspace > the dead proxy the installs run behind really blocks the registry

```text
AssertionError: expected '' to include 'ECONNREFUSED'
```

###  scratchpad/test/workspaces/e2e/PackedInstall.e2e.test.ts > PackedInstall against a real fixture workspace > packs dist/prod/npm/pkg by default, installs under every available manager, runs the bin, then removes the scratch directory

```text
@beep/scratchpad/effected/workspaces/PackedInstall/PackedInstallError: npm is required but did not answer --version
```

###  scratchpad/test/workspaces/e2e/PackedInstall.e2e.test.ts > PackedInstall against a real fixture workspace > P3 S1 under every available manager: a peer the consumer imports is declared through consumerDependencies

```text
@beep/scratchpad/effected/workspaces/PackedInstall/PackedInstallError: npm is required but did not answer --version
```

###  scratchpad/test/workspaces/e2e/PackedInstall.e2e.test.ts > PackedInstall overrides: a dependency no registry has, supplied from outside the workspace > workspaceOverrides: the workspace's own file: link to a directory installs under every available manager

```text
@beep/scratchpad/effected/workspaces/PackedInstall/PackedInstallError: npm is required but did not answer --version
```

###  scratchpad/test/workspaces/e2e/PackedInstall.e2e.test.ts > PackedInstall against a real fixture workspace > packs from source in the installed workspace, rewriting workspace:^, and every available manager's bin runs

```text
AssertionError: 
: expected 1 to equal +0
```

###  scratchpad/test/workspaces/e2e/PackedInstall.e2e.test.ts > PackedInstall against a real fixture workspace > yarn installs the packed carrier (skipped where yarn is not on PATH)

```text
@beep/scratchpad/effected/workspaces/PackedInstall/PackedInstallError: none of yarn answered --version from ~/.cache/claude-tmp/effected-packed-install-hU76l4
```

###  scratchpad/test/workspaces/e2e/PackedInstall.e2e.test.ts > PackedInstall against a real fixture workspace > P3 S1 control: without consumerDependencies pnpm resolves the peer inside the plugin but not at the root

```text
@beep/scratchpad/effected/workspaces/PackedInstall/PackedInstallError: none of pnpm answered --version from ~/.cache/claude-tmp/effected-packed-install-xxfIit
```

###  scratchpad/test/workspaces/e2e/PackedInstall.e2e.test.ts > PackedInstall against a real fixture workspace > allowSharedBins: .bin may run the front end under a flat layout, runCarrierBin always runs the carrier

```text
AssertionError: expected [ 'ManagerUnavailable', undefined ] to deeply equal [ 'BinConflict', …(1) ]
```

###  scratchpad/test/workspaces/e2e/PackedInstall.e2e.test.ts > PackedInstall against a real fixture workspace > a built directory still carrying workspace: fails UnresolvedProtocol, naming the specifier

```text
AssertionError: expected 'NoManagerAvailable' to equal 'UnresolvedProtocol'

Expected: "UnresolvedProtocol"
Received: "NoManagerAvailable"
```

###  scratchpad/test/workspaces/e2e/PackedInstall.e2e.test.ts > PackedInstall against a real fixture workspace > an expected bin the carrier does not ship fails MissingBin

```text
AssertionError: expected [ 'NoManagerAvailable', undefined ] to deeply equal [ 'MissingBin', 'npm' ]
```

###  scratchpad/test/workspaces/e2e/PackedInstall.e2e.test.ts > PackedInstall overrides: a dependency no registry has, supplied from outside the workspace > the fixture really is unresolvable: without an override the install fails behind the dead proxy

```text
AssertionError: expected [ 'PackFailed', undefined ] to deeply equal [ 'InstallFailed', 'bun' ]
```

###  scratchpad/test/workspaces/e2e/PackedInstall.e2e.test.ts > PackedInstall overrides: a dependency no registry has, supplied from outside the workspace > overrides: a supplied .tgz installs for the closure's transitive reference under every available manager

```text
AssertionError: the fixture packed external: expected false to be true
```

###  scratchpad/test/workspaces/e2e/RunBinStdin.e2e.test.ts > runBin and runCarrierBin stdin, real spawn > a string is written to the bin's stdin and closed

```text
AssertionError: expected '' to equal 'got:héllo|6'
```

###  scratchpad/test/workspaces/e2e/RunBinStdin.e2e.test.ts > runBin and runCarrierBin stdin, real spawn > bytes and a chunked stream arrive whole

```text
AssertionError: expected '' to equal 'got:hi|2'
```

###  scratchpad/test/workspaces/e2e/RunBinStdin.e2e.test.ts > runBin and runCarrierBin stdin, real spawn > omitted stdin is end of input at once: the bin exits instead of hanging

```text
AssertionError: expected '' to equal 'got:|0'
```

###  scratchpad/test/workspaces/e2e/RunBinStdin.e2e.test.ts > runBin and runCarrierBin stdin, real spawn > runCarrierBin takes stdin the same way

```text
AssertionError: expected '' to equal 'got:framed|6'
```

###  scratchpad/test/workspaces/integration/ConfigDependencyHooksSubprocess.int.test.ts > ConfigDependencyHooks.layerSubprocess — replays the pnpmfile in a child process > loads the config dependency's updateConfig and injects its catalogs

```text
@beep/scratchpad/effected/npm/CatalogAssemblyError/CatalogAssemblyError: Failed to assemble catalogs from hooks ~/.cache/claude-tmp/effected-hooks-subprocess-APCT4e
```

###  scratchpad/test/workspaces/integration/ConfigDependencyHooksSubprocess.int.test.ts > ConfigDependencyHooks.layerSubprocess — replays the pnpmfile in a child process > surfaces the release-age keys a hook sets

```text
@beep/scratchpad/effected/npm/CatalogAssemblyError/CatalogAssemblyError: Failed to assemble catalogs from hooks ~/.cache/claude-tmp/effected-hooks-subprocess-APCT4e
```

###  scratchpad/test/workspaces/integration/ConfigDependencyHooksSubprocess.int.test.ts > ConfigDependencyHooks.layerSubprocess — replays the pnpmfile in a child process > threads release-age keys last-hook-wins over ONE config object, in declaration order

```text
@beep/scratchpad/effected/npm/CatalogAssemblyError/CatalogAssemblyError: Failed to assemble catalogs from hooks ~/.cache/claude-tmp/effected-hooks-subprocess-APCT4e
```

###  scratchpad/test/workspaces/integration/ConfigDependencyHooksSubprocess.int.test.ts > ConfigDependencyHooks.layerSubprocess — a malformed peer-rules axis > drops a non-string allowedVersions entry INSIDE the child, before the next hook reads it

```text
@beep/scratchpad/effected/npm/CatalogAssemblyError/CatalogAssemblyError: Failed to assemble catalogs from hooks ~/.cache/claude-tmp/effected-hooks-subprocess-APCT4e
```

###  scratchpad/test/workspaces/integration/ConfigDependencyHooksSubprocess.int.test.ts > ConfigDependencyHooks.layerSubprocess — pnpm 11 loader order and skip discrimination > tries pnpmfile.mjs FIRST when both files exist — the .cjs is never loaded

```text
@beep/scratchpad/effected/npm/CatalogAssemblyError/CatalogAssemblyError: Failed to assemble catalogs from hooks ~/.cache/claude-tmp/effected-hooks-subprocess-APCT4e
```

###  scratchpad/test/workspaces/integration/ConfigDependencyHooksSubprocess.int.test.ts > ConfigDependencyHooks.layerSubprocess — drop-in interchangeable with layerLive > the two layers produce identical HookInjections for the same root and dependencies

```text
@beep/scratchpad/effected/npm/CatalogAssemblyError/CatalogAssemblyError: Failed to assemble catalogs from hooks ~/.cache/claude-tmp/effected-hooks-subprocess-APCT4e
```

###  scratchpad/test/workspaces/integration/ConfigDependencyHooksSubprocess.int.test.ts > Workspaces.layerWithConfigDependenciesSubprocess — releaseAgeGate reaches the hooks > combines inline + subprocess-replayed hook sources strictest-wins

```text
@beep/scratchpad/effected/npm/CatalogAssemblyError/CatalogAssemblyError: Failed to assemble catalogs from hooks ~/.cache/claude-tmp/effected-hooks-subprocess-APCT4e
```

###  scratchpad/test/workspaces/integration/ConfigDependencyHooksSubprocess.int.test.ts > ConfigDependencyHooks.layerSubprocess — pnpm 11 loader order and skip discrimination > a pnpmfile whose OWN nested import is missing fails typed, never silently skipped

```text
AssertionError: expected '~/.cache/claude-tmp/e…' to equal 'cfg-fixture-nested-missing'

Expected: "cfg-fixture-nested-missing"
Received: "~/.cache/claude-tmp/effected-hooks-subprocess-APCT4e"
```

###  scratchpad/test/workspaces/integration/ConfigDependencyHooksSubprocess.int.test.ts > ConfigDependencyHooks.layerSubprocess — load/replay failures name the dependency > a pnpmfile with a syntax error fails typed, naming that dependency

```text
AssertionError: expected '~/.cache/claude-tmp/e…' to equal 'cfg-fixture-syntax-error'

Expected: "cfg-fixture-syntax-error"
Received: "~/.cache/claude-tmp/effected-hooks-subprocess-APCT4e"
```

###  scratchpad/test/workspaces/integration/ConfigDependencyHooksSubprocess.int.test.ts > ConfigDependencyHooks.layerSubprocess — load/replay failures name the dependency > a hook that throws when called fails typed, naming that dependency

```text
AssertionError: expected '~/.cache/claude-tmp/e…' to equal 'cfg-fixture-throwing'

Expected: "cfg-fixture-throwing"
Received: "~/.cache/claude-tmp/effected-hooks-subprocess-APCT4e"
```

###  scratchpad/test/workspaces/integration/ConfigDependencyResolution.int.test.ts > ConfigDependencyHooks.layerSubprocess — resolves the DECLARED version > declared version installed under .pnpm-config → that copy runs (candidate A)

```text
@beep/scratchpad/effected/npm/CatalogAssemblyError/CatalogAssemblyError: Failed to assemble catalogs from hooks ~/.cache/claude-tmp/effected-ladder-root-0CUK2z
```

###  scratchpad/test/workspaces/integration/ConfigDependencyResolution.int.test.ts > ConfigDependencyHooks.layerSubprocess — resolves the DECLARED version > a `<version>+<integrity>` spec resolves by its version part

```text
@beep/scratchpad/effected/npm/CatalogAssemblyError/CatalogAssemblyError: Failed to assemble catalogs from hooks ~/.cache/claude-tmp/effected-ladder-root-0CUK2z
```

###  scratchpad/test/workspaces/integration/ConfigDependencyResolution.int.test.ts > ConfigDependencyHooks.layerSubprocess — resolves the DECLARED version > declared version NOT installed but in the store → the store copy runs (candidate B)

```text
@beep/scratchpad/effected/npm/CatalogAssemblyError/CatalogAssemblyError: Failed to assemble catalogs from hooks ~/.cache/claude-tmp/effected-ladder-root-0CUK2z
```

###  scratchpad/test/workspaces/integration/ConfigDependencyResolution.int.test.ts > ConfigDependencyHooks.layerSubprocess — resolves the DECLARED version > a store hash directory whose manifest carries another version is not trusted

```text
@beep/scratchpad/effected/npm/CatalogAssemblyError/CatalogAssemblyError: Failed to assemble catalogs from hooks ~/.cache/claude-tmp/effected-ladder-root-0CUK2z
```

###  scratchpad/test/workspaces/integration/ConfigDependencyResolution.int.test.ts > ConfigDependencyHooks.layerSubprocess — resolves the DECLARED version > pnpmfile.js is accepted, after .mjs and .cjs

```text
@beep/scratchpad/effected/npm/CatalogAssemblyError/CatalogAssemblyError: Failed to assemble catalogs from hooks ~/.cache/claude-tmp/effected-ladder-root-0CUK2z
```

###  scratchpad/test/workspaces/integration/ConfigDependencyResolution.int.test.ts > ConfigDependencyHooks.layerSubprocess — resolves the DECLARED version > a scoped name resolves through the store's nested links directory

```text
@beep/scratchpad/effected/npm/CatalogAssemblyError/CatalogAssemblyError: Failed to assemble catalogs from hooks ~/.cache/claude-tmp/effected-ladder-root-0CUK2z
```

###  scratchpad/test/workspaces/integration/ConfigDependencyResolution.int.test.ts > ConfigDependencyHooks.layerSubprocess — resolves the DECLARED version > declaration order is replay order across installed and store copies

```text
@beep/scratchpad/effected/npm/CatalogAssemblyError/CatalogAssemblyError: Failed to assemble catalogs from hooks ~/.cache/claude-tmp/effected-ladder-root-0CUK2z
```

###  scratchpad/test/workspaces/integration/ConfigDependencyResolution.int.test.ts > ConfigDependencyHooks.layerSubprocess — resolves the DECLARED version > two honest store copies of one version are AMBIGUOUS → typed, naming both, replaying neither

```text
@beep/scratchpad/effected/npm/CatalogAssemblyError/CatalogAssemblyError: Failed to assemble catalogs from hooks ~/.cache/claude-tmp/effected-ladder-root-0CUK2z
```

###  scratchpad/test/workspaces/integration/ConfigDependencyResolution.int.test.ts > ConfigDependencyHooks.layerSubprocess — resolves the DECLARED version > a version held by two distinct stores resolves from the FIRST in discovery order

```text
@beep/scratchpad/effected/npm/CatalogAssemblyError/CatalogAssemblyError: Failed to assemble catalogs from hooks ~/.cache/claude-tmp/effected-ladder-root-0CUK2z
```

###  scratchpad/test/workspaces/integration/ConfigDependencyResolution.int.test.ts > layerLive and layerSubprocess — the ladder is one implementation > both layers produce identical injections across installed, store and skipped dependencies

```text
@beep/scratchpad/effected/npm/CatalogAssemblyError/CatalogAssemblyError: Failed to assemble catalogs from hooks ~/.cache/claude-tmp/effected-ladder-root-0CUK2z
```

###  scratchpad/test/workspaces/integration/ConfigDependencyResolution.int.test.ts > ConfigDependencyHooks.layerSubprocess — resolves the DECLARED version > declared version installed nowhere → typed, fail-closed, naming the remediation

```text
Error: Test timed out in 5000ms.
If this is a long-running test, pass a timeout value as the last argument or configure it globally with "testTimeout".
```

###  scratchpad/test/workspaces/integration/ConfigDependencyResolution.int.test.ts > ConfigDependencyHooks.layerSubprocess — resolves the DECLARED version > the store is found through a .pnpm-config symlink's realpath when .modules.yaml is absent

```text
@beep/scratchpad/effected/npm/CatalogAssemblyError/CatalogAssemblyError: Failed to assemble catalogs from hooks ~/.cache/claude-tmp/effected-ladder-linked-7qFw91
```

###  scratchpad/test/workspaces/integration/ConfigDependencyResolution.int.test.ts > ConfigDependencyHooks.layerSubprocess — resolves the DECLARED version > a symlinked .pnpm-config entry at the declared version is candidate A

```text
@beep/scratchpad/effected/npm/CatalogAssemblyError/CatalogAssemblyError: Failed to assemble catalogs from hooks ~/.cache/claude-tmp/effected-ladder-linked-7qFw91
```

###  scratchpad/test/workspaces/integration/ConfigDependencyResolution.int.test.ts > ConfigDependencyHooks.layerSubprocess — resolves the DECLARED version > one store reached by two spellings is ONE store — an aliased path is never 'ambiguous'

```text
@beep/scratchpad/effected/npm/CatalogAssemblyError/CatalogAssemblyError: Failed to assemble catalogs from hooks ~/.cache/claude-tmp/effected-ladder-alias-6aHeG9
```

###  scratchpad/test/workspaces/integration/ConfigDependencyResolution.int.test.ts > ConfigDependencyHooks.layerSubprocess — resolves the DECLARED version > store formats are consulted NEWEST first, numerically — v11 beats v10 beats v9

```text
@beep/scratchpad/effected/npm/CatalogAssemblyError/CatalogAssemblyError: Failed to assemble catalogs from hooks ~/.cache/claude-tmp/effected-ladder-bare-KM13yu
```

###  scratchpad/test/workspaces/integration/ConfigDependencyResolution.int.test.ts > ConfigDependencyHooks.layerSubprocess — resolves the DECLARED version > rung 3: a store named only by $PNPM_HOME is found when .modules.yaml and .pnpm-config say nothing

```text
@beep/scratchpad/effected/npm/CatalogAssemblyError/CatalogAssemblyError: Failed to assemble catalogs from hooks ~/.cache/claude-tmp/effected-ladder-bare-KM13yu
```

## Vitest totals

```text
Before: Tests  57 failed | 1004 passed | 14 skipped (1075)
After:  Tests  44 failed | 1017 passed | 14 skipped (1075)
```
