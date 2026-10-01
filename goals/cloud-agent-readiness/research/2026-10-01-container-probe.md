# Container probe — 2026-10-01

Freshness: 2026-10-01. A Claude Code cloud session (hosted ephemeral Linux
container, repo cloned fresh at `8a46aa34`, outbound HTTPS through the
environment's agent proxy) tried to reach a green `bun install` and a working
`bun run beep`. Every row is a command that was actually run in that container.
Absolute home paths are written as `~`; no session or machine identifiers are
kept.

## Findings

| # | Surface | Command | Result | Consequence |
| --- | --- | --- | --- | --- |
| F1 | bun version | `bun --version` vs `.bun-version` | container ships `1.3.14`; repo pins `1.4.2` (`package.json` `packageManager`, `mise.toml` reads `.bun-version`) | `bun install --frozen-lockfile` prints `Unknown lockfile version` at `bun.lock:2` (`lockfileVersion: 3`), then `lockfile had changes, but lockfile is frozen`; nothing installs. |
| F2 | bun installer host | `curl -fsSL https://bun.sh/install \| bash -s "bun-v1.4.2"` | `curl: (22) The requested URL returned error: 403` | The official installer is denied by the environment's network policy. |
| F3 | bun from GitHub releases | `curl -fsSL -o bun-linux-x64.zip https://github.com/oven-sh/bun/releases/download/bun-v1.4.2/bun-linux-x64.zip && unzip && ./bun-linux-x64/bun --version` | `1.4.2`; `sha256sum bun-linux-x64.zip` equals the tracked `.bun-linux-x64.sha256` (`36368fae…d422a913`) | Works, and the archive is verifiable against a digest the repo already tracks (CI's baked-runner fast path compares the same file), so a setup script can refuse an unexpected binary. |
| F4 | bun from npm | `npm install bun@1.4.2 && ./node_modules/.bin/bun --version` | `1.4.2` (node 22 and npm are present; `registry.npmjs.org` is on the proxy's no-proxy list) | Works as a second route. |
| F5 | replacing the system bun | `cp bun ~/.bun/bin/bun` | `cp: cannot create regular file: Text file busy` | A hook or MCP server already holds the old binary; a setup script must rename over it (`mv`) or prepend its own directory to `PATH`, never `cp` in place. |
| F6 | dependency install with the pinned bun | `PATH=<bun 1.4.2>:$PATH bun install --frozen-lockfile` | `error: GET https://pkg.pr.new/Effect-TS/effect/<pkg>@b5a2d4c1d6… - 403` for every Effect snapshot package; the command still reports a populated `node_modules/.bin` (144 entries) | **The install is silently incomplete.** `node_modules/effect`, `@effect/sql-pg`, `@effect/platform-browser`, `@effect/opentelemetry`, `@effect/ai-openai`, `@effect/sql-sqlite-bun` are all absent. `bun.lock` carries 34 `pkg.pr.new` references (the Effect `4.0.0` snapshot `b5a2d4c1d6`, PR #1368). |
| F7 | repo CLI | `bun run beep --help` | `error: Cannot find module 'effect/Function' from 'packages/foundation/modeling/utils/src/index.ts'` | Every `bun run beep …` command, every typecheck, every vitest run, and the `goals doctor` / `yeet` lanes are unavailable until F6 is fixed. |
| F8 | GitHub CLI | `gh auth status` | `Failed to log in to github.com using token (GH_TOKEN)` — `The token in GH_TOKEN is invalid` | Yeet's `gh`-based publish, monitor, job-log reads and the `--until-ready` loop cannot run. GitHub reads and writes work through the session's GitHub MCP tools instead. |
| F9 | systemd user manager | `systemctl --user status` | `Failed to connect to bus: No medium found` | `yeet … --detach`, `beep-proof-<jobId>.service`, `agent-run-<ticket>.scope`, and every timer installer are unavailable; only attached modes can run. |
| F10 | 1Password | `which op` | not found | `op://`-backed env files, `op run`, and `op-doctor` are unavailable; any packet whose proof needs a secret is outside the cloud lane. |
| F11 | MCP servers at session start | `.mcp.json` | `fallow` → `ENOENT ./node_modules/.bin/fallow-mcp` (no deps yet); `nlp` → connection closed (needs `effect`); `phoenix-docs` → proxy `403` to its Mintlify host; `serena`, `webstorm`, `phoenix` (tailnet) are workstation-only by construction | Three failures are reported at every cloud session start. The pool doctrine and skills reference tools that cannot exist here. |
| F12 | SessionStart hooks | `.claude/settings.json` | `packet-projections.sh` runs `bun run beep goals index --write` (fails silently, non-blocking); `graft-hooks.cjs session-start` runs without a `graft/` index; `hook-pulse.sh` is armed with `BEEP_HOOK_PULSE_NOTIFIER_REV=desktop-ntfy-1` (a desktop notifier) | Non-blocking, but every cloud session pays for workstation assumptions and produces no projection or pulse value. |
| F13 | reference workspace | `scripts/setup-effect-ref.sh` expects `$HOME/YeeBois/references/effect` (`BEEP_REFERENCES_ROOT` override) | `.repos/effect` absent | The Effect v3↔v4 validation rule in `AGENTS.md` cannot be honored from a cloud session without provisioning the reference checkout. |
| F14 | disk | `df -h /home/user` | 252G total, ~30G available | Enough for the install and build artifacts. |
| F15 | git hooks | `git commit` after the partial install | lefthook `v2.1.14` runs `pre-commit`; `biome` passes; `gitleaks` and `typos` steps fail with `sh: 1: gitleaks: not found` / `typos: not found` (`exit status 127`) and the commit is refused | The repo's commit gate assumes two workstation binaries that `bun install` does not provide. A cloud session cannot commit until they are provisioned (both ship as GitHub release archives) or the hook is told to skip them; the setup script must install them, not skip them, so the gate keeps running. |

## What a cloud session can do today, unaided

- Read and edit the tree; run `rg`, `git`, `jq`, `python3`, `node 22`, `npm`.
- Fetch the pinned bun from GitHub releases or npm (F3, F4).
- Commit and push to a branch; open and review PRs through the GitHub MCP tools.
- Nothing that imports `effect` (F6, F7).

## Remedies proven or implied by the probe

1. **Toolchain bootstrap** (repo-side): an idempotent `scripts/cloud-session-setup.sh` that installs the pinned bun from GitHub releases (verified against `.bun-linux-x64.sha256`) or npm, prepends it to `PATH` or renames it over the busy binary, then runs `bun install --frozen-lockfile` with CI's three-attempt retry and fails fast when `node_modules/effect` is still missing.
2. **Network allowlist** (environment-side, operator): `pkg.pr.new` must be reachable; `github.com` release downloads already are. `bun.sh` is optional once route F3 or F4 exists. The setup script's `--check` mode names the denied host so the operator can fix the environment's Network access setting.
3. **Harness host awareness**: an explicit `BEEP_AGENT_HOST=cloud` environment variable, read by hooks and documented for MCP expectations; no heuristics.
4. **Publish handoff**: a documented end state for cloud sessions (pushed branch, PR opened through the API, proof output in the PR body) and the operator-side yeet closeout that follows, until yeet can run without `gh` and systemd.
5. **Commit-gate tools** (repo-side, in the same setup script): `gitleaks` at the version CI pins (`v8.30.1`, `check.yml`) and `typos-cli` at CI's pin (`1.44.0`, `heavy.yml`), both fetched as GitHub release archives into `~/.cache/beep/tools/bin`. Proven 2026-10-01: with both on `PATH`, lefthook's pre-commit and commit-msg hooks ran green (gitleaks, typos, biome, commitlint) and the commit landed (F15).
6. **Doctrine**: an `AGENTS.md` cloud-sessions section and a runbook, so the next cloud session does not rediscover F1–F15.
