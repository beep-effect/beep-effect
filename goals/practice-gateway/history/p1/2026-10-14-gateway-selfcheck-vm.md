# Evidence — practice-gateway self-check on Windows (2026-10-14)

- **VM:** clean snapshot (`ops/vm/snapshot.sh revert clean`), Windows NT
  10.0.26300.0, harness SSH up 20 s after boot.
- **Build:** `bun run --cwd apps/practice-gateway package:mcpb:windows`
  (commit `592e2d4da9`), `practice-gateway-windows-x64.mcpb` (59 MB:
  `practice-gateway.exe`, `manifest.json`, DuckDB win32 sidecars).
- **Run:** extracted the bundle, then in the interactive session
  (`ops/vm/vm-run.sh interactive`) with the manifest's `NODE_PATH`:
  `practice-gateway.exe --self-check`, exit 0.

```
0 of 3 checks pass.
You need to: Install Claude Desktop from claude.ai/download, then open it.
You need to: Open Claude and sign in with your Claude account.
You need to: Ask your IT administrator to turn on BitLocker for drive C:.
```

The three workstation probes ran against the real machine: no Claude Desktop
for the account, no signed-in Claude session calling the gateway, BitLocker
off on C:. Human steps arrive batched and in plain language, which matches
the doctor contract.

## Findings

- Without `NODE_PATH` the binary fails at startup:
  `Cannot find module '@duckdb/node-bindings-win32-x64/duckdb.node'`. Claude
  Desktop supplies `NODE_PATH` from the manifest, so installs work, but the
  gateway loads DuckDB even when the profile does not select practice-kg.
  Follow-up: import the practice-kg provider lazily so a missing or broken
  sidecar only disables that provider. (Owner: this goal, P1.)
- `Expand-Archive` refuses the `.mcpb` extension; harness copies to `.zip`
  before extracting. Claude Desktop installs `.mcpb` directly.
