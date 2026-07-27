# P0 evidence — R1 spike Attempt B completion (Windows x64) + wine probe run

Date: 2026-07-27 · Phase: P0 Packet + spike · Continues:
[`2026-07-27-r1-spike-notes.md`](./2026-07-27-r1-spike-notes.md) (Codex spike;
its Attempt B failed only on sandbox network, flagged unverified-not-disproven)

## What ran (network-capable host, same spike project)

1. `@duckdb/node-bindings-win32-x64@1.5.5-r.1` fetched from the npm registry
   (matches the repo catalog pin) and extracted under its package path. Note:
   `bun add` on a linux host records but does not link the win32 platform
   package — the registry tarball was extracted manually. Ship list:
   `duckdb.node` (1.1 MB), `duckdb.dll` (36.7 MB), `package.json`, `LICENSE`,
   `README.md`.
2. The spike's exact final Windows build command (all native addon subpaths
   `--external`, `--asset-naming='[name].[ext]'`, PGlite assets as
   `with { type: "file" }` imports):
   `bundle 187 modules → compile dist-windows/practice-kg-mcp.exe
   bun-windows-x64-v1.3.14` — **PASS**, 116,410,880 bytes.
3. Wine smoke run of the produced .exe with the DuckDB sidecar dir
   (`node_modules/@duckdb/node-bindings-win32-x64/` beside the exe):

```text
PGLITE_OK path=Z:\tmp\wine-pglite result=1
DUCKDB_OK path=Z:\tmp\wine-test.duckdb result=42
```

Both database probes **PASS on the Windows binary**: PGlite's three assets are
embedded in the .exe and initialize a fresh data dir on an NTFS-style path;
the DuckDB native addon resolves `duckdb.dll` from its own directory (Windows
module search order — no $ORIGIN issue on this platform).

The stdio JSON-RPC leg errored under wine with `EBADF` in bun's readline
stdin setup — a known wine piped-console emulation quirk, not a packaging
failure: the identical loop passed in the compiled linux sibling, and the
compiled `uspto-mcp` binary (real effect MCP stdio layer) answered
`initialize` + `tools/list` correctly (see
[`2026-07-27-quickwin-uspto-compile.md`](./2026-07-27-quickwin-uspto-compile.md)).

## R1 verdict — GO

- **.mcpb layout locked:** single `practice-kg-mcp.exe` (PGlite embedded) +
  `node_modules/@duckdb/node-bindings-win32-x64/{duckdb.node,duckdb.dll,package.json}`
  beside it. No bun.exe-plus-app-folder fallback needed.
- Residual (small): one real-Windows confirmation of the stdio loop rides the
  first P4 install on a Windows machine; SmartScreen behavior for the unsigned
  exe observed at the same time.
- Build flags for the real host package are recorded verbatim in the spike
  NOTES (§A4/§B) — reuse them in the P4 build script.
