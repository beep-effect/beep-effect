# practice-kg-mcp Bun packaging spike

## Recommendation

**Verdict: `.exe` + sidecar assets is viable; a bare single `.exe` is not viable with the tested DuckDB package.**

The Linux proof passed with PGlite's three runtime assets embedded in the Bun
executable and DuckDB's native addon externalized. The bundle layout must keep
DuckDB's native addon and its shared library together under the package path:

```text
practice-kg-mcp[.exe]
node_modules/
  @duckdb/
    node-bindings-<platform>-<arch>/
      package.json
      duckdb.node
      <native shared libraries shipped by that platform package>
```

For the proved Linux x64 glibc build, the last line is `libduckdb.so`. This
layout fits `.mcpb`, which can carry files beside the executable.

The Windows release itself remains **NO-GO pending a Windows build and VM
run**. This host could bundle the Windows-targeted source but could not
download Bun's Windows x64 compiler runtime, and the Windows x64 DuckDB native
package was not present in the local cache. The recommended architecture is
still `.exe` plus DuckDB sidecars, not `bun.exe` plus an app folder, because
the equivalent Linux layout compiled and ran successfully. Before shipping,
install `@duckdb/node-bindings-win32-x64@1.5.5-r.1`, include every file that
package ships under
`node_modules/@duckdb/node-bindings-win32-x64/`, cross-compile, and execute the
same probes on Windows x64.

The older `duckdb` npm package was not tried: the requested fallback only
applies if `@duckdb/node-api` cannot work under `bun build --compile`, and
`@duckdb/node-api` passed once its native files were correctly externalized.

The repository's actual read-only
`packages/drivers/duckdb/package.json` depends on:

```json
"@duckdb/node-api": "catalog:"
```

The root catalog resolves that dependency to `1.5.5-r.1`.

## Verdict table

The Linux PASS results below refer to the final
`dist-linux-sidecar/practice-kg-mcp` build and its adjacent DuckDB sidecars,
not to a bare executable.

| Component | linux-x64 compile + run | Evidence |
|---|---:|---|
| PGlite open | PASS | Opened a new filesystem data directory and printed `PGLITE_OK`. |
| PGlite `SELECT 1` | PASS | Returned numeric `1`; the entry aborts on any other value. |
| DuckDB open | PASS | Opened a new `.duckdb` file and printed `DUCKDB_OK`. |
| DuckDB `SELECT 42` | PASS | Returned numeric `42`; the entry aborts on any other value. |
| stdio JSON-RPC `initialize` | PASS | Returned server name `practice-kg-mcp`; final harness asserted it. |
| stdio JSON-RPC `tools/list` | PASS | Returned dummy tool `ping`; final harness asserted it. |

| Windows attempt | Result | Evidence |
|---|---:|---|
| `bun-windows-x64` cross-compile, no flags | FAIL | Bundler could not resolve DuckDB's uninstalled optional platform addons. |
| `bun-windows-x64` cross-compile with asset naming and native-addon externals | FAIL | Bundling completed, then Bun could not download `bun-windows-x64-v1.3.14`. |
| Windows execution | NOT RUN | No `.exe` was produced. Wine exists at `/usr/bin/wine`, but there was no artifact to execute. |

## Versions and installation provenance

- Bun: `1.3.14` (`0d9b296a`)
- `@electric-sql/pglite`: `0.5.4`
- `@duckdb/node-api`: `1.5.5-r.1`
- `@duckdb/node-bindings`: `1.5.5-r.1`
- `@duckdb/node-bindings-linux-x64`: `1.5.5-r.1`
- `@duckdb/node-bindings-linux-x64-musl`: `1.5.5-r.1`
- `detect-libc`: `2.1.2`

Registry access was unavailable even though package installation was the only
allowed network use. The successful local install therefore used copies of
these exact already-installed packages from the read-only reference checkout,
placed under this spike's `vendor/` directory. Only copied package manifests
were minimized to remove development dependencies and point runtime
dependencies at local copied packages; package runtime files were unchanged.
The spike then ran its own successful `bun install --offline`, producing its
own `bun.lock` and `node_modules` inside the spike directory. The lockfile
records `file:vendor/...` sources; the versions above come from the installed
package manifests and match the reference checkout's lock/catalog versions.

Initial install without localized Bun temp/install directories:

```text
bun add v1.3.14 (0d9b296a)
error: Unexpected accessing temporary directory. Please set $BUN_TMPDIR or $BUN_INSTALL
```

Registry-backed retry after localizing Bun's directories:

```text
bun add v1.3.14 (0d9b296a)
Resolving dependencies
Resolved, downloaded and extracted [12]
error: ConnectionRefused downloading package manifest @duckdb/node-api

error: FailedToOpenSocket downloading package manifest @electric-sql/pglite
```

Successful local install command:

```sh
BUN_INSTALL="$PWD/.bun-install" BUN_TMPDIR="$PWD/.bun-tmp" TMPDIR="$PWD/.bun-tmp" bun install --offline
```

Exact output:

```text
bun install v1.3.14 (0d9b296a)
Saved lockfile

+ @duckdb/node-api@vendor/@duckdb/node-api
+ @duckdb/node-bindings@vendor/@duckdb/node-bindings
+ @duckdb/node-bindings-linux-x64@vendor/@duckdb/node-bindings-linux-x64
+ @duckdb/node-bindings-linux-x64-musl@vendor/@duckdb/node-bindings-linux-x64-musl
+ @electric-sql/pglite@vendor/@electric-sql/pglite
+ detect-libc@vendor/detect-libc

10 packages installed [2.00ms]
```

## Attempt A: Linux x64

### A1. No-flags single-binary compile

Command:

```sh
bun build --compile --target=bun-linux-x64 entry.ts --outfile dist-linux/practice-kg-mcp
```

Result: FAIL before artifact emission. `@duckdb/node-bindings` contains literal
`require(...)` calls for all supported platforms, while a Linux install only
had Linux x64 optional packages. Exact error:

```text
27 |                 ? require('@duckdb/node-bindings-linux-arm64-musl/duckdb.node')
                               ^
error: Could not resolve: "@duckdb/node-bindings-linux-arm64-musl/duckdb.node". Maybe you need to "bun install"?
    at /tmp/claude-1000/-home-elpresidank-YeeBois-projects-beep-effect5/42380f13-5094-4178-bd7c-67f03c9a231b/scratchpad/r1-spike/node_modules/@duckdb/node-bindings/duckdb.js:27:27

28 |                 : require('@duckdb/node-bindings-linux-arm64/duckdb.node');
                               ^
error: Could not resolve: "@duckdb/node-bindings-linux-arm64/duckdb.node". Maybe you need to "bun install"?
    at /tmp/claude-1000/-home-elpresidank-YeeBois-projects-beep-effect5/42380f13-5094-4178-bd7c-67f03c9a231b/scratchpad/r1-spike/node_modules/@duckdb/node-bindings/duckdb.js:28:27

30 |             return require('@duckdb/node-bindings-darwin-arm64/duckdb.node');
                                ^
error: Could not resolve: "@duckdb/node-bindings-darwin-arm64/duckdb.node". Maybe you need to "bun install"?
    at /tmp/claude-1000/-home-elpresidank-YeeBois-projects-beep-effect5/42380f13-5094-4178-bd7c-67f03c9a231b/scratchpad/r1-spike/node_modules/@duckdb/node-bindings/duckdb.js:30:28

32 |             return require('@duckdb/node-bindings-darwin-x64/duckdb.node');
                                ^
error: Could not resolve: "@duckdb/node-bindings-darwin-x64/duckdb.node". Maybe you need to "bun install"?
    at /tmp/claude-1000/-home-elpresidank-YeeBois-projects-beep-effect5/42380f13-5094-4178-bd7c-67f03c9a231b/scratchpad/r1-spike/node_modules/@duckdb/node-bindings/duckdb.js:32:28

34 |             return require('@duckdb/node-bindings-win32-arm64/duckdb.node');
                                ^
error: Could not resolve: "@duckdb/node-bindings-win32-arm64/duckdb.node". Maybe you need to "bun install"?
    at /tmp/claude-1000/-home-elpresidank-YeeBois-projects-beep-effect5/42380f13-5094-4178-bd7c-67f03c9a231b/scratchpad/r1-spike/node_modules/@duckdb/node-bindings/duckdb.js:34:28

36 |             return require('@duckdb/node-bindings-win32-x64/duckdb.node');
                                ^
error: Could not resolve: "@duckdb/node-bindings-win32-x64/duckdb.node". Maybe you need to "bun install"?
    at /tmp/claude-1000/-home-elpresidank-YeeBois-projects-beep-effect5/42380f13-5094-4178-bd7c-67f03c9a231b/scratchpad/r1-spike/node_modules/@duckdb/node-bindings/duckdb.js:36:28
```

### A2. Exclude unavailable platform addons

Command:

```sh
bun build --compile --target=bun-linux-x64 entry.ts --outfile dist-linux/practice-kg-mcp --external '@duckdb/node-bindings-linux-arm64/duckdb.node' --external '@duckdb/node-bindings-linux-arm64-musl/duckdb.node' --external '@duckdb/node-bindings-darwin-arm64/duckdb.node' --external '@duckdb/node-bindings-darwin-x64/duckdb.node' --external '@duckdb/node-bindings-win32-arm64/duckdb.node' --external '@duckdb/node-bindings-win32-x64/duckdb.node'
```

Exact compile output:

```text
  [36ms]  bundle  186 modules
 [122ms] compile  dist-linux/practice-kg-mcp
```

The emitted file was:

```text
practice-kg-mcp 96540800 bytes
```

Running it from a directory without `node_modules` proved that Bun embedded
`duckdb.node`, but did not embed or materialize its ELF dependency
`libduckdb.so`. Exact runtime error:

```text
385 | var require_duckdb = __commonJS((exports, module2) => {
386 |   module2.exports = __require("/$bunfs/root/duckdb-pfvkqxpb.node");
387 | });
388 |
389 | // node_modules/@duckdb/node-bindings-linux-x64/duckdb.node
390 |   module2.exports = __require("/$bunfs/root/duckdb-xz7b13g1.node");
                                   ^
error: libduckdb.so: cannot open shared object file: No such file or directory
 code: "ERR_DLOPEN_FAILED"

      at <anonymous> (/$bunfs/root/practice-kg-mcp:390:30)
      at <anonymous> (/$bunfs/root/practice-kg-mcp:32:47)
      at <anonymous> (/$bunfs/root/practice-kg-mcp:427:41)
      at <anonymous> (/$bunfs/root/practice-kg-mcp:32:47)
      at <anonymous> (/$bunfs/root/practice-kg-mcp:9724:40)
      at <anonymous> (/$bunfs/root/practice-kg-mcp:32:47)
      at <anonymous> (/$bunfs/root/practice-kg-mcp:9823:44)
      at <anonymous> (/$bunfs/root/practice-kg-mcp:32:47)
      at /$bunfs/root/practice-kg-mcp:13614:42

Bun v1.3.14 (Linux x64)
```

`readelf -d` showed that `duckdb.node` has:

```text
0x0000000000000001 (NEEDED)             Shared library: [libduckdb.so]
0x000000000000001d (RUNPATH)            Library runpath: [$ORIGIN]
```

Putting only `libduckdb.so` next to the executable is therefore insufficient:
the embedded addon lives under Bun's virtual `/$bunfs/root`, so its `$ORIGIN`
does not point to the executable's real directory.

### A3. Externalize DuckDB and expose the PGlite asset failure

The Linux x64 addon was also marked external and copied together with
`libduckdb.so` under
`node_modules/@duckdb/node-bindings-linux-x64/`. That allowed DuckDB's loader
to resolve the real on-disk addon and its `$ORIGIN` library. The first such
run then reached PGlite and failed because PGlite's assets were not embedded
automatically. Exact PGlite error text:

```text
ENOENT: no such file or directory, open '/$bunfs/root/pglite.data'
    path: "/$bunfs/root/pglite.data",
 syscall: "open",
   errno: -2,
    code: "ENOENT"

      at async w (/$bunfs/root/practice-kg-mcp:9867:60)
      at async <anonymous> (/$bunfs/root/practice-kg-mcp:19519:38)
      at async create (/$bunfs/root/practice-kg-mcp:19289:20)

Bun v1.3.14 (Linux x64)
```

### A4. Final passing Linux layout

Bun 1.3.14 has no `--asset` flag (`bun build --help` lists only
`--asset-naming`). The entry therefore explicitly imports:

```text
node_modules/@electric-sql/pglite/dist/initdb.wasm
node_modules/@electric-sql/pglite/dist/pglite.data
node_modules/@electric-sql/pglite/dist/pglite.wasm
```

using import attributes `with { type: "file" }`. The build uses
`--asset-naming='[name].[ext]'` because PGlite constructs exact
`new URL("./pglite.data", import.meta.url)`-style names.

Exact final compile command:

```sh
bun build --compile --target=bun-linux-x64 entry.ts --outfile dist-linux-sidecar/practice-kg-mcp --asset-naming='[name].[ext]' --external '@duckdb/node-bindings-linux-x64/duckdb.node' --external '@duckdb/node-bindings-linux-x64-musl/duckdb.node' --external '@duckdb/node-bindings-linux-arm64/duckdb.node' --external '@duckdb/node-bindings-linux-arm64-musl/duckdb.node' --external '@duckdb/node-bindings-darwin-arm64/duckdb.node' --external '@duckdb/node-bindings-darwin-x64/duckdb.node' --external '@duckdb/node-bindings-win32-arm64/duckdb.node' --external '@duckdb/node-bindings-win32-x64/duckdb.node'
```

Exact compile output:

```text
  [34ms]  bundle  187 modules
 [103ms] compile  dist-linux-sidecar/practice-kg-mcp
```

Final Linux bundle inventory:

```text
practice-kg-mcp 112523392 bytes
node_modules/@duckdb/node-bindings-linux-x64/duckdb.node 384264 bytes
node_modules/@duckdb/node-bindings-linux-x64/libduckdb.so 70529912 bytes
node_modules/@duckdb/node-bindings-linux-x64/package.json 276 bytes
```

No PGlite asset files exist beside the executable. `strings` on the executable
found all three at Bun virtual-filesystem paths:

```text
/$bunfs/root/initdb.wasm
/$bunfs/root/pglite.data
/$bunfs/root/pglite.wasm
```

Final verification command:

```sh
mkdir -p runtime/final-pglite-3
responses="$(cd dist-linux-sidecar && printf '%s\n%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | ./practice-kg-mcp ../runtime/final-pglite-3 ../runtime/final-3.duckdb)"
printf '%s\n' "$responses"
printf '%s\n' "$responses" | bun -e 'const lines=(await Bun.stdin.text()).trim().split("\n").map(JSON.parse); if (lines[0]?.result?.serverInfo?.name !== "practice-kg-mcp" || lines[1]?.result?.tools?.[0]?.name !== "ping") throw new Error("JSON-RPC assertion failed"); console.log("HARNESS_OK initialize=practice-kg-mcp tools/list=ping")'
```

Exact final output:

```text
PGLITE_OK path=../runtime/final-pglite-3 result=1
DUCKDB_OK path=../runtime/final-3.duckdb result=42
{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-03-26","capabilities":{"tools":{}},"serverInfo":{"name":"practice-kg-mcp","version":"0.0.0"}}}
{"jsonrpc":"2.0","id":2,"result":{"tools":[{"name":"ping","description":"Dummy read-only packaging probe","inputSchema":{"type":"object","properties":{},"additionalProperties":false}}]}}
HARNESS_OK initialize=practice-kg-mcp tools/list=ping
```

## Attempt B: Windows x64 cross-compile

No-flags command:

```sh
bun build --compile --target=bun-windows-x64 entry.ts --outfile dist-windows/practice-kg-mcp.exe
```

Result: FAIL with the same unresolved optional-addon error block recorded in
A1, including the missing
`@duckdb/node-bindings-win32-x64/duckdb.node`.

Final attempted command with assets and all native addons external:

```sh
bun build --compile --target=bun-windows-x64 entry.ts --outfile dist-windows/practice-kg-mcp.exe --asset-naming='[name].[ext]' --external '@duckdb/node-bindings-linux-x64/duckdb.node' --external '@duckdb/node-bindings-linux-x64-musl/duckdb.node' --external '@duckdb/node-bindings-linux-arm64/duckdb.node' --external '@duckdb/node-bindings-linux-arm64-musl/duckdb.node' --external '@duckdb/node-bindings-darwin-arm64/duckdb.node' --external '@duckdb/node-bindings-darwin-x64/duckdb.node' --external '@duckdb/node-bindings-win32-arm64/duckdb.node' --external '@duckdb/node-bindings-win32-x64/duckdb.node'
```

Exact output:

```text
  [28ms]  bundle  187 modules
Failed to download 'bun-windows-x64-v1.3.14': ConnectionRefused
```

Exact `dist-windows/` artifact inventory after the attempt:

```text
(empty; 0 files)
```

No `.exe`, PGlite asset, DuckDB addon, DLL, manifest, or other file landed in
the Windows output directory. This is an environment/network failure after
successful source bundling, not proof that Bun's Windows executable format is
incompatible. It also means Windows native-addon runtime behavior remains
unverified.

## Embedding conclusions

| File/component | Automatic single-binary behavior | Required packaging treatment |
|---|---|---|
| PGlite JavaScript | Embedded | None beyond normal bundling. |
| `pglite.wasm` | Not embedded automatically | Explicit `type: "file"` import plus stable `--asset-naming`; then embedded in the executable. |
| `initdb.wasm` | Not embedded automatically | Explicit `type: "file"` import plus stable `--asset-naming`; then embedded in the executable. |
| `pglite.data` | Not embedded automatically | Explicit `type: "file"` import plus stable `--asset-naming`; then embedded in the executable. |
| DuckDB `duckdb.node` | Bun can embed it, but that layout is unusable here | Mark the target addon path `--external` and ship it on disk under its package path. |
| Linux `libduckdb.so` | Not embedded or materialized automatically | Ship beside `duckdb.node` so the addon's `$ORIGIN` runpath resolves it. |
| Uninstalled DuckDB platform addons | Literal requires break bundling | Mark non-target addon subpaths `--external`, or install every optional platform package. |
| Windows DuckDB native files | Not available on this host | Install and inventory `@duckdb/node-bindings-win32-x64@1.5.5-r.1`; ship every native file it contains in the same package directory. |

Therefore:

- **Bare single executable:** FAIL with `@duckdb/node-api@1.5.5-r.1`.
- **Executable plus native DuckDB sidecars in `.mcpb`:** PASS on Linux x64 and
  recommended for Windows validation.
- **`bun.exe` plus an app folder:** not currently necessary; use only if the
  Windows cross-compile/VM gate later disproves the sidecar layout.
