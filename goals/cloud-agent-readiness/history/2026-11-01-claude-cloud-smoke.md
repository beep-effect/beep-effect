# Claude cloud smoke: setup cwd fix — 2026-11-01

Two Claude Code cloud sessions on the same per-account environment, both at
`main` HEAD `352bac46790dbf005e41b6c63cb7875d199e8e18` (effect 4.1.1 bump,
#2481). This is evidence for the Claude cloud bootstrap surface only. It does
not complete P2–P6, qualify Codex or Cursor cloud, or complete the readiness
goal.

## Prior smoke (2026-11-01): setup failed, SessionStart recovered

| Step | Result |
| --- | --- |
| Dashboard setup script `bash scripts/cloud/bootstrap.sh` | Exit 127: the setup script runs with a working directory outside the clone, so the relative path did not resolve; the session showed `setup-script-failed` |
| Repo SessionStart hook (same bootstrap via `$CLAUDE_PROJECT_DIR`) | Installed the toolchain and dependencies; session usable |
| `bun run beep --help` | Exit 0 |
| `bun run beep quality package-verify @beep/types --quick` | Exit 0 |

The package proof passing does not make the setup script pass. SessionStart
recovery hid a broken dashboard entry, and the cached-setup benefit (the
environment snapshot) was lost because setup failed.

## Fresh smoke (2026-11-02 UTC): corrected setup

Saved setup script:

```bash
#!/bin/bash
set -euo pipefail
cd "$HOME/beep-effect"
BEEP_CLOUD_VENDOR=claude BEEP_CLOUD_SKIP_OP=1 bash scripts/cloud/bootstrap.sh
```

Environment variables present in the session (names only): `BEEP_AGENT_HOST`
(`cloud`), `BEEP_CLOUD_SKIP_OP` (`1`), `BASH_DEFAULT_TIMEOUT_MS` (`600000`),
`BASH_MAX_TIMEOUT_MS` (`1800000`).

| Step | Result |
| --- | --- |
| Setup script | Completed; no `setup-script-failed` notice. Bootstrap stamps `node_modules/.beep-cloud-bootstrap.{lock,prepare}.sha256` were written about three minutes after container start and before the session began |
| SessionStart hook | `dependencies already match bun.lock; skipping install`, `tsgo patch already matches its inputs; skipping prepare`, `ready: bun 1.4.4, node v24.22.1, portless 0.15.13, op missing` |
| Manual re-run of the saved setup command | Exit 0, same no-op output |
| Pins | Bun 1.4.4 (`.bun-version`, `packageManager`), Node v24.22.1 (`.nvmrc`), effect 4.1.1 (installed `node_modules/effect`) |
| `bun run beep --help` | Exit 0 |
| `bun run beep quality package-verify @beep/types --quick` | Exit 0 in 33 s wall: `ok lint 30.5s`, `ok check 3.0s` |

`op missing` is expected: `BEEP_CLOUD_SKIP_OP=1` skips the optional 1Password
CLI, and this lane is secret-free. Setting the variable in the environment
(not only as a setup-script prefix) is what lets SessionStart skip it too.

## Optional MCP limitations

Three `.mcp.json` servers failed to connect; none is needed by the bootstrap,
the CLI or the package proof:

- `beep-m365-outbox`: launcher needs `op`, absent by design here.
- `phoenix-docs`, `stately`: the cloud proxy refused the tunnel (403).

Treat these as expected cloud limitations, not bootstrap failures. Allowlisting
the two hosts is a per-account network decision and was not made here.

## Publish

No native Yeet closeout in the VM. Published through the D4 handoff: owned
files committed, the assigned cloud branch pushed, a draft PR opened through
the session's GitHub integration with `ready-for-heavy` and operator-side
closeout requested in its body.
