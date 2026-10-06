# Research

<!--
Stage 1. Ground the capture in reality. Two halves: what exists outside the
repo (cited), and what exists inside it (so we compose bricks instead of
rebuilding them). Date sections; research goes stale.
-->

## External Landscape

### 2026-10-05 — Claude Code cloud sessions

Source: [Configure cloud environments](https://code.claude.com/docs/en/cloud-environments)
and [Use Claude Code in the cloud](https://code.claude.com/docs/en/claude-code-on-the-web).

- Available on Pro, Max, Team, Enterprise. Environments are **personal to the
  account**; organization-shared environments exist only on Team/Enterprise.
  Created, edited, and archived only in the environment selector at
  claude.ai/code — no API or CLI creates one. `/remote-env` in the CLI picks
  the default for `claude --cloud` (stored as `remote.defaultEnvironmentId` in
  user settings; a repo project setting can override it, but ids differ per
  account so the repo cannot carry one).
- Network access levels: None, Trusted (default allowlist), Full, Custom.
  GitHub goes through a separate proxy regardless. The Trusted allowlist covers
  `github.com` + `release-assets.githubusercontent.com`, `nodejs.org`,
  `registry.npmjs.org`, Docker Hub, `*.amazonaws.com`, `archive.ubuntu.com`.
  It does **not** list `buf.build` (the `@buf` registry scope in `bunfig.toml`),
  `cache.agilebits.com`, or `downloads.1password.com`.
- VM: Ubuntu 24.04 x86_64, 4 vCPU, 30 GB disk. Node 20/21/22 preinstalled
  (22 on PATH), bun installed but with **known proxy compatibility issues for
  package fetching**. Setup scripts run as root; a setup script is cached only
  when it finishes in roughly five minutes. SessionStart hooks run every
  start/resume (600 s default cancel). Idle VMs pause, then may be reclaimed.
- What carries over: repo `.claude/settings.json` hooks/permissions, `.claude/
  rules|skills|agents|commands`, `.mcp.json`. What does not: `enabledPlugins`
  and `extraKnownMarketplaces`, any `~/.claude` user settings, user-scope MCP,
  transport env keys. `CLAUDE_CODE_REMOTE=true` marks the VM;
  `$CLAUDE_ENV_FILE` persists variables from a SessionStart hook.
- API credentials (Pro/Max only): a key stored on the environment and attached
  by Anthropic's proxy to requests for listed hosts; the session never sees it.
- Billing: docs say cloud sessions share the account's rate limits with no
  separate compute charge; in practice each account also shows an included
  **$250 cloud session credit expiring 2026-11-05** (observed in Settings →
  Usage, see CAPTURE.md) that is consumed before plan usage.

### 2026-10-05 — Codex cloud

Sources: [Codex cloud environment configuration](https://learn.chatgpt.com/docs/environments/cloud-environment),
[Codex cloud environments deep-dive (May 2026)](https://codex.danielvaughan.com/2026/05/31/codex-cloud-environments-setup-scripts-caching-secrets-codex-universal/),
[OpenAI's Codex gets reusable cloud environments (2026-09-29)](https://siliconangle.com/2026/09/29/openais-codex-gets-reusable-cloud-environments-that-follow-developers-across-devices/).

- Rolling out to ChatGPT Plus and Pro plus Business/Enterprise/Edu workspaces.
  Environments are created in the Codex UI (Settings → Codex Cloud →
  Environments) per account; sharing exists only inside a ChatGPT workspace.
  There is no CLI or API to create or modify an environment; `codex cloud exec
  --env <id>` submits tasks against an existing one (confirmed locally with
  codex-cli 0.160.1: `cloud exec|status|list|apply|diff`).
- Container: `universal` image (Ubuntu 24.04; Node 22 with pnpm/yarn; **no
  bun**). Runtime versions pin through the package-versions setting or
  `CODEX_ENV_*` variables. Setup script runs once with internet; optional
  maintenance script runs when a cached container resumes; the two run in
  separate shells from the agent, so exported PATH must be persisted via
  `~/.bashrc`. Container cache lasts up to 12 h and invalidates when scripts,
  variables, or secrets change.
- Agent-phase internet is **off by default**; presets None / Common
  dependencies (80+ registry domains) / All, with optional method restriction
  to GET/HEAD/OPTIONS. Secrets are available **only during setup** and are
  removed before the agent phase; environment variables live for the whole
  task.
- Plus VMs run with half the CPU and memory of higher tiers. Pro accounts that
  used cloud tasks recently were granted $200 of cloud credits valid until
  2026-11-20.

### 2026-10-05 — Cursor Cloud Agents

Source: [Cloud environment setup](https://cursor.com/docs/cloud-agent/setup);
repo PRs #885 and #887.

- `.cursor/environment.json` is config-as-code committed to the repo and shared
  by every agent launched against it (fields: name, user, install, start,
  terminals, ports, repositoryDependencies, snapshot, build). Nothing per
  account is needed.
- Cloud Agents load only repo command hooks (`.cursor/hooks.json`), no
  sessionStart/sessionEnd; `.cursor/*.json` is write-protected in the sandbox.

## In-Repo Capability Inventory

| Brick | Path | Disposition |
| --- | --- | --- |
| Cursor Cloud Agent bootstrap | `.cursor/install.sh`, `.cursor/environment.json` | **extend** → generalized into `scripts/cloud/bootstrap.sh`; `.cursor/install.sh` becomes a thin caller |
| Pinned toolchain inputs | `.bun-version`, `.bun-linux-x64.sha256`, `.nvmrc`, `mise.toml` | reuse |
| CI install recipe (retry loop, `--frozen-lockfile`) | `.github/actions/setup-monorepo-ci/action.yml` | reuse the pattern |
| Turbo remote-cache read-only quad | `scripts/enable-turbo-remote-reads.sh`, `standards/turbo-remote-cache.md` | reuse as environment variables |
| Repo hooks that must survive a fresh VM | `.claude/settings.json` SessionStart (`packet-projections.sh`, `yeet-inbox.sh`, graft loader, `hook-pulse.sh`) | reuse; all already fail open (`\|\| true`, `exit 0`), so an unprovisioned VM degrades to no projections rather than a blocked session |
| Pool doctrine and lane recipes | `goals/agent-pool-doctrine`, `docs/runbooks/agent-pools.md` | reuse; cloud lanes are the cloud sibling of the Cursor lane |
| 1Password agent shim doctrine | `AGENTS.md` § 1Password, `docs/runbooks/onepassword-beep-secrets-layout.md` | reuse; Codex cannot hold the service-account token at agent phase |
| Cloud environment runbook | `docs/runbooks/cloud-environments.md` | NET-NEW (this packet) |
| Repo-neutral bootstrap | `scripts/cloud/bootstrap.sh` | NET-NEW (this packet), composed from the Cursor installer |
| Programmatic environment creation | — | NOT FOUND, and not possible: neither Claude nor Codex exposes an API |

## Constraints Discovered

- **Eight manual UI setups** are unavoidable (4 Claude + 4 Codex). The repo can
  only shrink each to a one-line paste plus a short allowlist.
- **Claude five-minute setup cache**: cold `bun install` on hosted CI runs
  60–120 s warm; bun + node + op downloads must run in parallel to stay inside
  the window, or the environment is never cached and every session pays full
  install.
- **Bun behind Claude's security proxy** is a documented failure class; the
  first smoke session per account decides whether the bootstrap's retry loop is
  enough or a fallback (npm-installed bun, or routing that lane to Codex) is
  needed.
- **Custom allowlist on Claude** is mandatory for `buf.build` and the 1Password
  CLI download; Trusted alone breaks `bun install`.
- **Codex secrets end at setup**, so Codex lanes cannot use `op run` at agent
  time; provider-key work is a Claude (API credentials) or Cursor lane.
- **Node 24**: neither vendor image ships it; the bootstrap installs the
  `.nvmrc` version itself (nvm on Cursor, official tarball elsewhere).
- **Deadlines**: Claude credits expire 2026-11-05, Codex 2026-11-20 — Claude
  environments go first.
