# Cloud environments

## Purpose

How beep-effect runs inside vendor-hosted agent VMs: Claude Code cloud sessions
(`claude.ai/code`, `claude --cloud`), Codex cloud (`chatgpt.com/codex`,
`codex cloud exec`), and Cursor Cloud Agents. One repo-owned bootstrap,
[`scripts/cloud/bootstrap.sh`](../../scripts/cloud/bootstrap.sh), prepares every
VM; each vendor dashboard carries only a one-line setup script that calls it.
Environments are per account on Claude and Codex, so a fleet of subscriptions
means one dashboard entry per account, each pasted from this page.

Packet of record: [`explorations/cloud-environment-fanout`](../../explorations/cloud-environment-fanout/README.md).

## What the bootstrap does

`scripts/cloud/bootstrap.sh` is idempotent and snapshot-safe. It installs the
pinned Bun from `.bun-version` (checksum from `.bun-linux-x64.sha256`), Node
from `.nvmrc` (nvm when the image ships it, otherwise the official tarball),
`portless`, and a GPG-verified 1Password CLI; then runs
`bun install --frozen-lockfile --ignore-scripts` and `bun run prepare` (the
Effect tsgo patch). Downloads run in parallel so a cold run stays inside the
Claude five-minute setup-cache window. A lockfile stamp under `node_modules/`
turns a re-run on a cached VM into a sub-second no-op, which is why the same
file is safe as both a cached setup script and a per-session hook.

Without a cloud marker (`CLAUDE_CODE_REMOTE=true`, a `CODEX_ENV_*` variable, or
an explicit `BEEP_CLOUD_VENDOR`) the script exits 0 immediately, so the
SessionStart hook in `.claude/settings.json` is inert on workstations.
`BEEP_CLOUD_FORCE=1` with a scratch `HOME` runs it locally for testing.

## Vendor matrix

| | Claude cloud (Pro/Max) | Codex cloud (Plus/Pro) | Cursor Cloud Agent |
| --- | --- | --- | --- |
| Where configured | Environment dialog at claude.ai/code | Settings → Codex Cloud → Environments | Saved personal/team config, else `.cursor/environment.json` (committed) |
| Scope | Personal per account; UI only, no API | Per ChatGPT account; UI only, no API | Repo-wide default; saved personal/team configs take precedence |
| Base image | Ubuntu 24.04, Node 20–22, bun present | codex-universal: Node 22, no bun | Ubuntu 24.04 |
| Setup script | Cached when it finishes in ~5 min | Cached container, 12 h; maintenance script on resume | `install` in `environment.json` |
| Agent-phase network | Trusted allowlist by default | Off by default | Sandbox allowlist |
| Secrets | API credentials attached by proxy, never visible to the session | Secrets visible only during setup | Environment secret |
| VM | 4 vCPU, 30 GB disk | Plus VMs are half-size | Default |
| Hooks the VM runs | Repo `.claude/settings.json` (one-repo sessions) | `.codex/hooks.json` | `.cursor/hooks.json` (command hooks only) |

Facts verified 2026-10-05 against the vendor docs linked under Sources;
Claude setup re-smoked in a fresh session and Cursor precedence rechecked
2026-11-01/02.

## Claude cloud: per-account setup

Repeat once per Claude account. The environment is personal to the account, so
nothing here can be shared or exported.

1. Open [claude.ai/code](https://claude.ai/code) → environment selector → **Add
   cloud environment**. Name it `beep-effect`.
2. **Network access**: `Custom`, keep the defaults, and add these hosts. The
   Trusted list already covers `github.com` release assets (Bun download),
   `nodejs.org`, `registry.npmjs.org`, and `*.amazonaws.com` (the Turbo remote
   cache API); it does not cover the `@buf` registry scope in `bunfig.toml` or
   the 1Password CLI download.

   ```text
   buf.build
   cache.agilebits.com
   downloads.1password.com
   ```

3. **Setup script**. The dashboard setup script does not start inside the
   clone, so `cd` into it explicitly before calling the shared bootstrap; a bare
   relative `bash scripts/cloud/bootstrap.sh` exits 127 because the path does
   not resolve. The clone sits directly under the container home, so `$HOME` reaches it:

   ```bash
   #!/bin/bash
   set -euo pipefail
   cd "$HOME/beep-effect"
   BEEP_CLOUD_VENDOR=claude BEEP_CLOUD_SKIP_OP=1 bash scripts/cloud/bootstrap.sh
   ```

   `BEEP_CLOUD_SKIP_OP=1` skips the optional 1Password CLI download. Claude
   cloud lanes are secret-free (no service-account token ever reaches the VM),
   so `op` has nothing to do there. Drop the variable only on an environment
   that deliberately needs the `op` binary.

4. **Environment variables** (`.env` format):

   ```text
   BEEP_AGENT_HOST=cloud
   BEEP_CLOUD_SKIP_OP=1
   BASH_DEFAULT_TIMEOUT_MS=600000
   BASH_MAX_TIMEOUT_MS=1800000
   ```

   The setup-script prefix covers only the setup run. The repo SessionStart
   hook in `.claude/settings.json` calls the same bootstrap at every session
   start and resume, and it sees only the environment variables, so set
   `BEEP_CLOUD_SKIP_OP=1` here too or SessionStart retries the optional `op`
   fetch. `BEEP_AGENT_HOST=cloud` is the explicit host marker hooks and docs key
   off (packet decision D3). The two timeouts lift the Bash tool's default to
   10 minutes and its ceiling to 30 minutes, so long installs and package
   proofs are not cut off.

   Add the read-only Turbo remote-cache quad (`TURBO_API`, `TURBO_TEAM`,
   `TURBO_TOKEN`, `TURBO_CACHE`) from the `BEEP_SECRETS` item when the lane
   should reuse hosted cache artifacts; see
   [`standards/turbo-remote-cache.md`](../../standards/turbo-remote-cache.md).
   Never paste a 1Password service-account token here: environment variables
   are readable by the session.
5. **API credentials** (Pro/Max only): add the Anthropic key with host
   `api.anthropic.com` when a lane runs `apps/professional-desktop` or another
   consumer of `AI_ANTHROPIC_API_KEY`. The proxy attaches it after requests
   leave the VM; the session never sees it.
6. Save, then on the workstation signed into the same account run `/remote-env`
   in `claude` and pick `beep-effect` so `claude --cloud` targets it.
7. Smoke test (first session on that account; it also builds the cache):

   ```text
   claude --cloud "Run bun run beep quality package-verify @beep/types --quick and report the result"
   ```

   A passing smoke has three parts: the setup script finished without a
   `setup-script-failed` notice (the bootstrap stamps under `node_modules/`
   predate the session and SessionStart logs `skipping install`), `bun run beep
   --help` exits 0, and the package proof exits 0. A setup failure that
   SessionStart later repaired still counts as a failed setup script: fix the
   dashboard entry. Evidence:
   [`2026-11-01-claude-cloud-smoke`](../../goals/cloud-agent-readiness/history/2026-11-01-claude-cloud-smoke.md).

Known gotchas:

- Bun has documented fetch problems behind the Claude security proxy. The
  bootstrap retries `bun install` three times and fails loud; if it fails on
  every attempt in a fresh session, record the error in the packet and fall
  back to a setup script of `npm install -g bun@<pin>` plus `bun install` with
  `HTTPS_PROXY` honoured, or run that lane on Codex instead.
- A denied required download host (`github.com` for Bun, `nodejs.org` for
  Node) exits `78` before anything is placed or installed, with one line
  naming each denied host and the remedy: add it to the environment's allowed
  domains. "Denied" means a proxy `403` (tunnel or response) or a host that
  does not resolve or connect; a timeout, `404`, `5xx` or checksum mismatch
  stays a plain exit `1`. The optional 1Password CLI host only warns. Install
  registries (`registry.npmjs.org`, `buf.build`) are not classified yet: their
  denial still surfaces as the `bun install` failure above.
- The `enabledPlugins` and `extraKnownMarketplaces` blocks in
  `.claude/settings.json` do not install in the cloud, and user-level
  `~/.claude` settings never reach the VM. Anything a cloud lane needs must be
  committed under the repo's `.claude/`.
- SessionStart hooks run on every start and resume; the bootstrap's lockfile
  stamp keeps that cheap.
- `.mcp.json` servers that need `op`, a workstation binary or a non-allowlisted
  host fail to connect in the VM (observed: `beep-m365-outbox` without `op`;
  `phoenix-docs` and `stately` refused by the proxy). They are optional; the
  session continues without them and nothing in the bootstrap or package proof
  depends on them.
- Publishing follows the packet's D4 handoff: commit, push the assigned branch,
  open a draft PR through the session's GitHub integration with the proof
  output in the body, and request `ready-for-heavy` plus the Yeet closeout
  there. `monitor --until-ready`, the label and `sweep --retire` stay
  operator-side.

## Codex cloud: per-account setup

Repeat once per ChatGPT account. `codex cloud exec` needs the environment id,
so record each id when you create it.

1. [chatgpt.com/codex](https://chatgpt.com/codex) → **Settings → Codex Cloud →
   Environments → Create environment**, connect the `beep-effect/beep-effect`
   repository.
2. **Container**: keep `universal`. Under package versions pin Node to `24`
   (the bootstrap installs the exact `.nvmrc` version itself, but the pin keeps
   the image's default `node` from shadowing it).
3. **Setup script**:

   ```bash
   BEEP_CLOUD_VENDOR=codex bash scripts/cloud/bootstrap.sh
   ```

4. **Maintenance script** (runs when a cached container resumes on a newer
   commit):

   ```bash
   BEEP_CLOUD_VENDOR=codex bash scripts/cloud/bootstrap.sh
   ```

5. **Agent internet access**: `On`, preset **Common dependencies**, plus the
   same three extra domains as Claude. Restrict methods to `GET, HEAD, OPTIONS`
   unless the lane must push through something other than the Codex git
   integration.
6. **Secrets** are visible only during setup on Codex, so `OP_SERVICE_ACCOUNT_TOKEN`
   cannot reach the agent phase as a secret. Lanes that need provider keys at
   run time are Claude or Cursor lanes; Codex lanes stay secret-free.
7. Record the environment id in `.beep/cloud-envs.local.json` (git-ignored
   under `.beep/`) as `{ "codex": { "<account label>": "<env id>" } }` so an
   orchestrator can submit:

   ```bash
   codex cloud exec --env <env id> --branch <branch> "<task>"
   ```

8. Smoke test with the same package-verify task as Claude.

## Cursor Cloud Agent

The repo default is committed: [`.cursor/environment.json`](../../.cursor/environment.json)
points `install` at [`.cursor/install.sh`](../../.cursor/install.sh), which is a
thin caller of the shared bootstrap. Sandbox and hook behaviour is documented in
[agent-pools](./agent-pools.md).

The committed file is not the whole story. Cursor's setup docs (checked
2026-11-01) give saved personal and team environment configurations precedence
over `.cursor/environment.json`, so check the Cursor dashboard on each account
and team for a saved configuration for this repo before relying on the
committed one. A saved config that does not call the shared bootstrap silently
replaces it. This note corrects the earlier claim that nothing per account is
needed; it does not qualify Cursor Cloud Agents, which still need their own
smoke.

## Routing work to the cloud

Cloud lanes follow the pool doctrine in [`AGENTS.md`](../../AGENTS.md) and
[agent-pools](./agent-pools.md). They land as draft PRs through Yeet like any
other lane; `claude --cloud` clones the pushed branch, so push before
delegating. Credits and limits per vendor are account state, not repo state:
check `Settings → Usage` on each Claude account and the Codex usage page before
fanning out.

## Sources

- Claude: [Configure cloud environments](https://code.claude.com/docs/en/cloud-environments),
  [Use Claude Code in the cloud](https://code.claude.com/docs/en/claude-code-on-the-web).
- Codex: [Cloud environment configuration](https://learn.chatgpt.com/docs/environments/cloud-environment),
  [Reusable cloud environments (2026-09-29)](https://siliconangle.com/2026/09/29/openais-codex-gets-reusable-cloud-environments-that-follow-developers-across-devices/).
- Cursor: [Cloud environment setup](https://cursor.com/docs/cloud-agent/setup).
