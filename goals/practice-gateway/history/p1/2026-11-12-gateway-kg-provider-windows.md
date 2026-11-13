# Evidence — the gateway's knowledge-graph provider loads DuckDB 2 on Windows (2026-11-12)

Question: `apps/practice-kg-mcp` adds the DuckDB addon's folder to the Windows
DLL search path (`SetDllDirectoryW`, `src/NativeAddon.ts`). The practice
gateway has no such step, and its last Windows proof
([2026-10-14](2026-10-14-gateway-selfcheck-vm.md)) predates DuckDB 2 (#2303).
Does the gateway's practice-kg provider fail to load `duckdb.dll` on Windows?

Answer: no. Gateway 0.1.4 in the layout #3127 ships (signed `bun.exe` plus
`practice-gateway.js`) loads DuckDB 2.0.0-r.1, mounts all 13 knowledge-graph
tools and answers a DuckDB-backed query. No code changed;
`PRACTICE_GATEWAY_VERSION` stays 0.1.4.

## Setup

- **Build:** `bun run --cwd apps/practice-gateway package:mcpb:windows` at
  commit `ca046993864`. `practice-gateway-windows-x64.mcpb`, 84 MB, sha256
  `4a7cea6e64945c6e54e1d9e31c6e6e9920c44671c5ccc0763d92ce3f4ae8fcc0`:
  `manifest.json`, `practice-gateway.js`, the three PGlite assets, `bun.exe`
  1.4.4 and `node_modules/@duckdb/node-bindings-win32-x64/` (`duckdb.node`,
  `duckdb.dll`).
- **VM:** Windows 11 Enterprise Evaluation, NT 10.0.26300.0, booted from the
  `clean` snapshot. `~/VMs/practice-gateway/milkman.lock` has been held since
  2026-11-08 with the VM shut off, so the snapshot was copied out read-only
  (`qemu-img convert -l snapshot.name=clean`) into a second libvirt domain
  with its own SSH port; the locked VM was not started or reverted. Smart App
  Control is off in that image (`VerifiedAndReputablePolicyState = 0`); no
  Windows setting was changed.
- **Bundle:** `makePracticeKgSmokeBundle` (`apps/practice-kg-mcp/src/smoke.ts`)
  built on Linux and copied in: one document, 4 nodes, 3 edges,
  `bundleVersion` `2026-10-20-01`.
- **Profile:** one choice, `knowledge-graph` → `practice-kg`, saved as
  `%LOCALAPPDATA%\beep\practice-gateway\practice-profile.json`.

## Runs

All on the VM, bundle unpacked to `C:\kgproof\before`.

| # | Launch | Result |
| --- | --- | --- |
| 1 | Interactive session, cwd the unpacked folder, `BUNDLE_DIR` set, no `NODE_PATH`: `bun.exe --no-env-file practice-gateway.js --self-check` | exit 0, one JSON line on stdout, stderr empty |
| 2 | Interactive session, `manifest.json` replayed as Claude Desktop does (command, args, env with `NODE_PATH=${__dirname}/node_modules`), neutral cwd: `--self-check`, then MCP `initialize`, `tools/list`, one `tools/call` | exit 0, stderr empty, 18 tools, call answered |
| 3 | Harness SSH, same replay without `NODE_PATH` | exit 0, stderr empty, 18 tools, call answered |

Self-check checks (runs 1 and 2): `practice-kg-bundle-present` satisfied,
`practice-kg-self-check` satisfied. `claude-desktop-installed`,
`claude-signed-in` and `bitlocker-on` are missing, as expected on the clean
image.

`initialize` (protocol `2025-11-25`) answered `beep-practice-gateway` 0.1.4.
`tools/list` returned the five setup tools plus `kg_clients`,
`kg_docket_family`, `kg_application_lookup`, `kg_find`, `corpus_search_text`,
`corpus_get_document`, `email_search`, `kg_candidate_claims`,
`claim_self_check`, `claim_inspect_input`, `kg_provenance`, `kg_matter_lookup`
and `kg_correspondent_lookup`. `corpus_search_text` with `{"query":"fixture"}`
returned the fixture row (`docket` `20001US01`, `bundle_version`
`2026-10-20-01`, `total` 1).

While run 3 served, the gateway process had both files mapped from the
unpacked folder:

```
C:\kgproof\before\node_modules\@duckdb\node-bindings-win32-x64\duckdb.node
C:\kgproof\before\node_modules\@duckdb\node-bindings-win32-x64\duckdb.dll
```

Control: the same driver against the Linux bundle from the same commit
returned the same 18 tools and the same row.

## Why the gateway does not need the DLL step

`process.dlopen` under Bun 1.4.4 on Windows finds the `duckdb.dll` beside the
addon only when the addon path uses backslashes. One fresh `bun.exe` process
per path form, neutral cwd:

```js
const holder = { exports: {} };
process.dlopen(holder, process.argv[2]);
```

| Path passed to `process.dlopen` | Result |
| --- | --- |
| `C:\kgproof\before\node_modules\@duckdb\node-bindings-win32-x64\duckdb.node` | loaded |
| `C:\kgproof\before\node_modules/@duckdb/node-bindings-win32-x64/duckdb.node` | `LoadLibrary failed: The specified module could not be found.` |
| `C:/kgproof/before/node_modules/@duckdb/node-bindings-win32-x64/duckdb.node` | same failure |

`resolveNativeAddon` in practice-kg-mcp returns
`<executable folder>node_modules/<request>`, the second form, so that host
needs `SetDllDirectoryW`. The gateway installs no resolver: Bun resolves
`@duckdb/node-bindings-win32-x64/duckdb.node` from the script's folder (or
`NODE_PATH`) and loads it by a native path. That last step is inferred from
the table and the module listing, not read from Bun's source.

Rule for later changes: code that builds an addon path itself must hand
`process.dlopen` a backslash path or add the folder to the DLL search path.

## Limits

- Smart App Control is off on the VM, so this says nothing about its verdict
  on the unsigned `duckdb.node`. The same addon files load under Smart App
  Control on the attorney PC inside practice-kg-mcp
  ([decision 2026-11-12](../../decisions/2026-11-12-windows-signed-runtime-launch.md)).
- The clean image has no Claude Desktop; the launch was replayed from
  `manifest.json`, not started by Claude.
- Compiled Windows executables (gateway 0.1.3 and earlier) are no longer built
  and were not tested. The 2026-10-14 finding that the gateway fails without
  `NODE_PATH` applied to that layout; run 3 shows the script layout does not
  need it.

## Reproduce

1. Build the Windows bundle and a fixture bundle as above; write a profile
   that selects `practice-kg`.
2. Copy them in with `ops/vm/vm-run.sh copy`, `Expand-Archive` the bundle
   (renamed `.zip`), and put the profile under
   `%LOCALAPPDATA%\beep\practice-gateway\`.
3. Run 1 as a `.cmd` file through `ops/vm/vm-run.sh interactive`.
4. For runs 2 and 3, spawn `mcp_config.command` with `mcp_config.args` and
   `mcp_config.env` from `manifest.json`, substituting `${__dirname}` and
   `${user_config.bundle_dir}`, and write `initialize`,
   `notifications/initialized`, `tools/list` and `tools/call` as JSON lines
   on stdin. The bundle's own `bun.exe` can run that driver.
