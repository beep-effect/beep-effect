# beep-worker headless portability audit (2026-10-14)

**Scope:** a read-only audit of a disposable checkout at `~/.cache/beep/readiness/audit-checkout`, which is on a detached HEAD at `b43a4098`. I read `AGENTS.md` and the packet's README, `SPEC.md` and the setup receipt `history/2026-10-14-linux-worker-readiness.md`. I used 7 command batches. I installed nothing, edited no tracked file, read no credential store, and started no other agent.

**Side effects:**
- `bun run beep yeet status` wrote a status artifact under `.beep/yeet/runs/HEAD-…/`, which is not tracked by git.
- Plan mode was on, so I also saved a short findings summary to `~/.claude/plans/[audit-plan]`.

## Commands tested and result

| # | Command (sanitized) | Result |
|---|---|---|
| 1 | Where each tool resolves: `bun`, `bunx`, `node`, `git`, `gh`, `op`, `graft`, `systemctl`, `notify-send`, `jq`, `rg`, `cursor-agent`, `grok`, `codex`, `claude`, `docker` | All found except **`bunx` (MISSING)** and **`graft` (MISSING)**. `bun` is `~/.local/bin/bun`; `node`, `codex` and `claude` come from nvm under `~/.nvm/...` |
| 1 | Versions | bun 1.4.2, which equals `.bun-version` and `packageManager`. node v24.21.0, git 2.53.0, gh 2.46.0 (the Ubuntu distro build), op 2.41.0. Ubuntu 26.04.1, kernel 7.0.0-38 |
| 1 | Is the variable set? | `SSH_AUTH_SOCK`: no. `DISPLAY`: no. `XDG_RUNTIME_DIR`: yes. `DBUS_SESSION_BUS_ADDRESS`: yes |
| 2 | `bun run beep --help` | exit 0 |
| 2 | `bun run beep yeet --help` | exit 0 |
| 3 | `beep yeet status` | exit 0. It reports "branch: HEAD", "no verdict artifact", and as its next step suggests `yeet publish --staged-only` |
| 3 | `beep yeet job --help`, `beep yeet inbox --help` | exit 0 |
| 3 | `beep session open` | exit 0, "no live sessions recorded" |
| 4 | `systemctl --user is-system-running` | `running`. `Linger=yes`. `agent-runs.slice` is not installed |
| 4 | `gh api user`, reduced to a true/false | authenticated: **true** |
| 4 | `op vault list >/dev/null 2>&1` | exit **0** |
| 4 | `beep yeet job list`, `beep yeet inbox list` | exit 0, both empty (0 rows) |
| 5–6 | Read `.claude/settings.json` hooks, `.mcp.json` and `scripts/cloud/bootstrap.sh`; `git grep` for workstation paths | Findings below |
| 7 | `beep refs plan` | exit 0. It plans links and clones into `~/YeeBois/references/effect` plus `graft build --deep` |
| 7 | `beep models check` | **exit 1** |

## Friction points

**F1. The audit checkout borrows another clone's `node_modules`.**
- **Evidence:** `node_modules -> ~/YeeBois/projects/beep-effect/node_modules`. Git also lists `?? node_modules` as untracked, because the `.gitignore` rule `node_modules/` (with a trailing slash) does not match a symlink.
- **Effect:** this checkout did not prove a clean install. Everything above that passed ran on another clone's dependency tree, and an agent running `git add -A` here would stage the symlink.
- **Classification:** introduced by how this audit checkout was set up. The ignore-pattern gap is inherited from the repo.
- **Proposed goal addition:** audit and disposable checkouts run their own `bun install --frozen-lockfile` and must not symlink `node_modules`. Change the ignore rule to `/node_modules`.
- **Verification:** `test ! -L node_modules && git status --porcelain | grep -c node_modules` must print `0`.

**F2. `bunx` is not on PATH.**
- **Evidence:** the session reported MCP failures `shadcn (ENOENT): "Executable not found in $PATH: bunx"` and the same for `next-devtools`. `chrome-devtools` also launches through `bunx`. Neither `~/.local/bin/bunx` nor `~/.bun/bin` exists.
- **Cause:** the bun install from the release archive placed only `bun` on PATH; the usual `bunx` symlink is missing.
- **Classification:** host-specific (setup receipt step 6).
- **Proposed goal addition:** the Linux bun install creates `bunx` next to `bun`, and the receipt records `command -v bunx`.
- **Verification:** `bunx --version` must equal `.bun-version`.

**F3. Graft and the Effect reference workspace are missing.**
- **Evidence:**
  - `graft: MISSING`
  - `ls: cannot access '.repos/effect'`
  - `~/YeeBois/references/effect: absent`
  - `refs plan` proposes `graft build --deep`, which `AGENTS.md` forbids agents from running.
- **Effect:** two `AGENTS.md` rules can't be followed on this host: "run `graft ask` before grepping", and "check Effect v3/v4 differences against `.repos/effect`". Sessions fall back to plain `rg`.
- **Classification:** host-specific. The hard-coded `$HOME/YeeBois/...` paths in `AGENTS.md` and four skills are inherited.
- **Proposed goal addition:** install `graft` from an approved source. The operator-side job (not an agent) provisions the reference workspace using the structural `graft build` only. Document which `BEEP_REFERENCES_ROOT` value workers use.
- **Verification:** `command -v graft && test -e .repos/effect && graft ask "Schema.Struct" .repos/effect`.

**F4. The model manifest is missing.**
- **Evidence:** `models: Failed to read the models manifest at ~/.config/beep/models.yaml: NotFound`, exit 1.
- **Effect:** the drift check that `AGENTS.md` names can't run, so model pins on this host are unverified.
- **Classification:** host-specific.
- **Proposed goal addition:** copy the manifest (it holds no secrets) as a receipted host-config step.
- **Verification:** `bun run beep models check` exits 0.

**F5. There is no host-awareness guard, and managed Linux is not a recognized host type.**
- **Evidence:** `rg BEEP_AGENT_HOST` finds nothing in `.claude`, `scripts`, `docs/runbooks` or `AGENTS.md`.
- **Hooks:** every hook runs unconditionally. These include `hook-pulse.sh`, which pins the `desktop-ntfy-1` notifier and builds `claude://` desktop links, and the graft session-start and stop hooks, with no check for a missing `graft` binary.
- **Bootstrap:** `scripts/cloud/bootstrap.sh` exits 0 without doing anything unless it sees a cloud marker (`CLAUDE_CODE_REMOTE`, `CODEX_*`, `CURSOR_AGENT`). On managed Linux the documented bootstrap therefore does nothing.
- **Classification:** inherited (packet decision D3 / phase P2 is not implemented).
- **Proposed goal addition:**
  - Add a host value such as `BEEP_AGENT_HOST=managed-linux`, alongside `cloud`.
  - Make the desktop notifier and graft hooks no-ops when their dependency is missing.
  - Document how managed Linux bootstraps (bootstrap.sh with `BEEP_CLOUD_FORCE=1`, or a separate path).
- **Verification:**
  - `BEEP_AGENT_HOST=managed-linux bash .claude/hooks/hook-pulse.sh </dev/null; echo $?` prints 0 with no error lines.
  - The SessionStart transcript of a headless session is clean.

**F6. Several MCP servers only work on the workstation.**
- **Evidence:** `.mcp.json` points to:
  - `serena` with a JetBrains backend
  - `webstorm` at `http://127.0.0.1:<ide-port>`
  - `phoenix` on dankserver's tailnet hostname
  - `beep-m365-outbox` via `op run --env-file=…outbox.env`
  - three servers launched through `bunx` (F2)
- **Not tested:** whether serena, webstorm, phoenix and chrome-devtools connect. The session did not list them.
- **Classification:** inherited. This is D7, and it was only ever written for cloud.
- **Proposed goal addition:** a table in the runbook marking each server as expected or failing per host class (workstation, managed Linux, cloud).
- **Verification:** the MCP connect status of a headless session matches that table.

**F7. The packet docs point at a deleted script.**
- **Evidence:** the SPEC acceptance criteria and verification matrix cite `scripts/cloud-session-setup.sh` and `shellcheck scripts/cloud-session-setup.sh`. Running `ls` on it gives `No such file or directory`.
- **Stale README:** "Current Phase" still says P2 is next.
- **Classification:** inherited (the replacement was noted only in a banner).
- **Proposed goal addition:** update the matrix to `scripts/cloud/bootstrap.sh` and add a Linux row.
- **Verification:** `rg -n cloud-session-setup goals/cloud-agent-readiness/SPEC.md` returns only lines that are explicitly marked historical.

**F8. Yeet's systemd and headless prerequisites are not proven.**
- **Evidence:** `systemctl --user` reports running and linger is enabled, but the active slices are `app-gnome-session-manager.slice` and `app-org.gnome.Terminal.slice`. The user manager I measured belongs to a GNOME login, not a pure SSH or headless session.
- **`agent-runs.slice`:** not installed (`AGENTS.md` says systemd then falls back to a transient slice).
- **Desktop dependencies in Yeet:** `WaveNotifier.ts` and `ProofJobLauncher.ts` use `systemd-run` and notification paths.
- **Not run (prohibited):** `--detach`, `monitor` and `ready`.
- **Classification:** host-specific, and unproven.
- **Proposed goal addition:**
  - From a fresh non-graphical SSH login (with `XDG_RUNTIME_DIR` set by linger), run one disposable `yeet verify --tier cheap-gates --detach` followed by `yeet job wait`.
  - Install `agent-runs.slice` or record why not.
- **Verification:** `systemctl --user cat agent-runs.slice`, and `yeet job wait <id>` exits 0.

**F9. Yeet on a detached HEAD.**
- **Evidence:** `branch: HEAD … next: … yeet publish --staged-only`. The status run also wrote `.beep/yeet/runs/HEAD-<hash>/status.json`.
- **Effect:** small, but a headless session following that hint from a disposable checkout could try to publish from a detached HEAD. `status` also writes a file, so it is not strictly read-only.
- **Classification:** inherited.
- **Proposed goal addition:** `yeet status` reports "detached HEAD: create a branch first" instead of suggesting publish.
- **Verification:** `git checkout --detach && bun run beep yeet status | grep -i detached`.

## What passed

- The bun pin matches; node is v24.
- `bun run beep --help` and `bun run beep yeet --help` work, as do the Yeet diagnostic commands `status`, `job list`, `inbox list` and `session open`.
- The systemd user manager is reachable and linger is on.
- `gh` is authenticated.
- `op vault list` succeeds through the PATH shim with output suppressed.
- `SSH_AUTH_SOCK` is not set, so there is no forwarded admin agent, as required.
- Docker and the agent CLIs (`cursor-agent`, `grok`, `codex`, `claude`) are on PATH.
- No `/home/<user>` absolute path appears in hooks, `.mcp.json` or the runbooks. The hooks find the repo through `git rev-parse` and `CLAUDE_PROJECT_DIR`.

## What remains unproven

- A clean `bun install --frozen-lockfile` in *this* checkout (F1). The receipt's install on a separate clone is the only evidence.
- Package proof and typecheck in this checkout. I didn't run them, by design.
- Hosted publish, PR creation, the `ready-for-heavy` label, `monitor`, `ready`, `merge` and `sweep --retire`.
- Detached proof jobs and the transient slice in a non-GUI session.
- Whether the agent CLIs (`cursor-agent`, `grok`, `codex`, `claude`) can actually run inference, and model-route parity (F4).
- Whether serena, webstorm, phoenix and chrome-devtools connect; whether `stately` and the claude.ai Google Drive / Spotify connectors work (they need authorization in an interactive session).
- Graft, references and the Effect source lookup (F3).
- How hooks behave in a fresh headless SessionStart (F5).
- That 1Password works for any operation beyond `vault list`.

## Readiness boundary

beep-worker is ready **only** for headless, read-only and help-level beep-effect work: the `beep` and `yeet` CLIs resolve and run, `gh` and `op` are authenticated, and no admin agent leaks into the session. That rests on a `node_modules` borrowed from another clone.

It is **not yet proven** for clean-install development in a disposable checkout, Graft-first or Effect-reference work, model-manifest checks, the bunx-based MCP servers, detached Yeet proof jobs, or any part of the publish-to-merge loop. Before calling the host environment-independent, the `SPEC.md` decision log needs F1–F9 recorded with an owner and the verification commands above.

I couldn't show you the usual step-by-step closeout prompt because the question tool isn't available in this plan-mode session.
