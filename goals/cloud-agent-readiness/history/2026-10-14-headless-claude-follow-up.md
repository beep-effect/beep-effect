# Claude headless follow-up — 2026-10-14

Orchestrator provenance: fresh native claude-opus-5-5 / medium, plan mode,
360-second timeout and explicit `env -u SSH_AUTH_SOCK`. Corrected run exited
zero, reported no agent error and used the pinned model. Worker Git status
remained clean. Plan mode is a permission profile, not enforced filesystem
isolation: the agent disclosed a temporary-file write and a transient systemd
diagnostic outside the requested read-only/no-job budget. Its findings are
inspection evidence, not proof that every harness limit was respected.

# beep-worker portability audit, wave 2 (2026-10-14)

## Execution profile and source checkout

| Item | Value |
| --- | --- |
| Profile | Claude Code headless, `claude-opus-5-5`, plan mode (read-only), non-root, no sandbox marker set. Network and the user D-Bus were reachable, so this profile did not hit the denials the earlier sandboxed Codex run did. |
| Host | beep-worker, Ubuntu 26.04.1, kernel 7.0.0-38 |
| Checkout | `~/YeeBois/projects/beep-effect`, on `main` at `b43a4098`. I did not switch branches or fetch. `git status --porcelain` showed 0 lines before and after; there are 0 stashes. |
| Dependencies | `node_modules` is a real directory with 1402 entries, not a symlink, so this checkout uses its own installed dependencies. |
| Batches used | 8 command batches plus a read of the packet. |

**Where the documents come from:**
- **Current receipts:** the copied packet at `~/.cache/beep/readiness/portability-wave2/goals/cloud-agent-readiness/`. Its files are dated 2026-10-14 00:55–02:56: README, SPEC (D8–D12 and the Linux acceptance criteria), `history/2026-10-14-headless-claude-audit.md`, `linux-worker-readiness.md` and `research/OPPORTUNITIES.md`.
- **Repo docs:** `AGENTS.md` (`CLAUDE.md` is a symlink to it) and the repo config at HEAD may be older than those receipts. I did not read the repo's own copy of `goals/cloud-agent-readiness`.

**Places I went beyond strictly read-only, disclosed here:**
- Batch 5 wrote one temporary file in `/tmp` and then deleted it.
- I launched one transient `systemd-run --user --wait` unit to see what environment a launched unit inherits.
- I did not run `yeet status`, because the earlier audit (F9) found that it writes a file.

## Commands and results

| # | Command (sanitized) | Result |
| --- | --- | --- |
| 1 | `command -v` for 18 tools | All found except **`serena`** (missing). `bunx` is at `~/.local/bin/bunx`. `graft` is at `~/.nvm/.../bin/graft`. `gh` is now `~/.local/bin/gh`. |
| 1 | Versions | bun 1.4.2, bunx 1.4.2, `.bun-version` 1.4.2. node v24.21.0, git 2.53.0, **gh 2.102.0** (was the 2.46.0 distro build), op 2.41.0, graft 0.21.1. |
| 1 | Env vars, presence only | `SSH_AUTH_SOCK`, `DISPLAY`, `WAYLAND_DISPLAY`, `BEEP_AGENT_HOST`, `BEEP_REFERENCES_ROOT` and `CLAUDE_CODE_REMOTE` are unset. `XDG_RUNTIME_DIR` and `DBUS_SESSION_BUS_ADDRESS` are set. |
| 2 | `bun run beep --help` | exit 0 |
| 2 | `bun run beep yeet --help` | exit 0 |
| 2 | `bun run beep session open` | exit 0, "no live sessions recorded" |
| 2 | `bun run beep refs plan` | exit 0. It plans clones into `~/YeeBois/references/effect` and several `graft build --deep --allow-partial` steps. |
| 2 | `bun run beep models check` | **exit 1**: 8 findings and 5 propose-only candidates (details under R1). |
| 3 | `ls .repos/effect .repos/effect-workspace ~/YeeBois/references/effect graft` | **All absent** |
| 3 | `test -f ~/.config/beep/models.yaml` | present |
| 4 | `systemctl --user is-system-running`, linger | `running`, `Linger=yes` |
| 4 | `systemctl --user cat agent-runs.slice` | **absent** |
| 4 | Active user slices | `app-gnome-session-manager`, `app-org.gnome.Terminal`, `app-t3code`, `app-t3code-agents`, among others |
| 4 | `gh api user >/dev/null` | exit 0 |
| 4 | `op vault list >/dev/null` | exit 0, so I did not need to run `op-doctor` |
| 5 | `systemctl --user show-environment` | **one `SSH_AUTH_SOCK` entry**. It points to an existing socket owned by this user, matching the gnome-keyring/gcr agent path pattern. `gcr-ssh-agent.socket` and `ssh-agent.socket` are both active. |
| 5 | Transient unit sees `SSH_AUTH_SOCK` | unset |
| 6 | Hooks in `.claude/settings.json` | 5 scripts, all present: `hook-pulse`, `law-pulse`, `packet-projections`, `session-ledger`, `yeet-inbox` |
| 6 | Search for `BEEP_AGENT_HOST`, `managed-linux` or `command -v graft` in hooks and `scripts/cloud` | **0 files** |
| 6 | `.mcp.json` | 11 servers (details under R6) |
| 6 | `node_modules/.bin/fallow-mcp` | present |
| 6 | `rg` for `YeeBois` or the home path in `AGENTS.md`, `.claude/skills`, `.claude/hooks`, `scripts` | **192 references in 6 files** |

## Earlier findings now resolved (against the copied 2026-10-14 receipts)

| Earlier finding | Status now | Evidence |
| --- | --- | --- |
| F1: borrowed `node_modules` symlink | Resolved for this checkout | It is a real directory and git status is clean. The `.gitignore` line 3 rule `node_modules/` still would not match a symlink; that gap is inherited and latent. |
| F2: `bunx` missing | Resolved | `bunx --version` prints 1.4.2, matching the pin. I did not prove that the `bunx` MCP servers start cleanly. |
| F3, binary part: graft missing | Resolved | graft 0.21.1 is on PATH. |
| F4: `models.yaml` missing (NotFound) | The NotFound error is gone | The check now runs to completion and reports drift (R1). |
| Earlier sandbox denials on gh, op and the user bus | Not reproduced in this profile | gh and op exit 0 and the user bus answers. This settles the execution-profile question, not the auth question: the auth itself was already proven in the receipts. |
| `gh` distro build 2.46.0 | Replaced | User-local 2.102.0 |

## Remaining findings

**R1. `beep models check` exits 1.**
- **Evidence:**
  - 4 stale literals:
    - `JSDocMigrateTitles.ts` has `grok-4.5` where `grok-4.6` is expected.
    - `Yeet/internal/Provenance.ts` and `Resume.ts` have `gpt-5.4, claude-sonnet-4.5`.
    - `Docgen/internal/QualityWorkerEval.ts` has `qwen3-coder, gpt-5.4-mini`.
  - 3 `missing-locator` generated blocks: `docs/runbooks/graft-local-recovery.md`, `.claude/skills/browser-qa-loop/SKILL.md` and `.../judge-prompt.md`.
  - 1 `missing-locator` on `$HOME/.codex/config.toml`, expected `medium`. I did not read that file.
  - The 5 candidates (`gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-6-astra`, `gpt-6-luna`, `gpt-6-sol`) are propose-only.
- **Classification:** the 7 repo findings are **inherited** (repo source and doc drift that any host would hit). The Codex config effort key is **host-specific**.
- **Proposed goal addition:** split host drift from repo drift. Fix the repo drift once on `main`. Provision the Codex config effort pin as a receipted host step.
- **Verification:** `bun run beep models check; echo $?` prints `0`, or only propose-only candidates remain.

**R2. The Effect references are absent, and `refs plan` proposes forbidden deep builds.**
- **Evidence:** `.repos/effect`, `.repos/effect-workspace` and `~/YeeBois/references/effect` are absent. `refs plan` lists `graft build --deep --allow-partial`, which `AGENTS.md` forbids agents from running.
- **Classification:** the missing references are **host-specific**. The planner-versus-law conflict is **inherited**.
- **Proposed goal addition:** an operator-owned job provisions the references with structural `graft build` only, and `BEEP_REFERENCES_ROOT` is documented for workers.
- **Verification:** `test -e .repos/effect && test -e .repos/effect-workspace && graft --version`.

**R3. No graft graph exists in this checkout.**
- **Evidence:** `graft/` is absent.
- **Effect:** the `AGENTS.md` rule to run graft before grepping can't be followed here. I did not build a graph, per the instructions.
- **Classification:** **host-specific**.
- **Proposed goal addition:** a receipted structural `graft build` per worker checkout.
- **Verification:** `test -d graft && graft map >/dev/null`. Run this only after the build.

**R4. Yeet's systemd surface is unproven for headless use.**
- **Evidence:** `agent-runs.slice` is absent. The user manager is the one started by the GNOME login.
- **Classification:** **host-specific, unproven**.
- **Proposed goal addition:** from a fresh non-graphical SSH login, run one disposable `yeet verify --tier cheap-gates --detach` followed by `yeet job wait`. Either install `agent-runs.slice` or record why not.
- **Verification:** `systemctl --user cat agent-runs.slice` succeeds and `yeet job wait <id>` exits 0.

**R5. The user-manager environment still exports `SSH_AUTH_SOCK`.**
- **Evidence:** it points to a live, user-owned socket matching the gcr/gnome-keyring agent pattern, not the sshd forwarded-agent pattern. The transient unit saw it unset, and the session environment has it unset.
- **Classification:** **host-specific**.
- **Why it matters:** there is no sign of a forwarded admin agent. I did not verify which keys that local agent holds, because listing keys was out of scope. D11 hygiene is therefore unproven.
- **Proposed goal addition:**
  - Either `systemctl --user unset-environment SSH_AUTH_SOCK`, plus a drop-in for agent units, or document that the gcr agent holds no admin keys.
  - Extend the existing T3 `UnsetEnvironment` drop-in to every agent-facing unit.
- **Verification:** `systemctl --user show-environment | grep -c ^SSH_AUTH_SOCK=` prints `0`, or a receipted key-count check shows zero.

**R6. There are no host-class guards in hooks or bootstrap.**
- **Evidence:**
  - 0 files reference `BEEP_AGENT_HOST`, `managed-linux` or a graft guard.
  - `hook-pulse.sh:204` pins `desktop-ntfy-1`, and `:785/:790` build `claude://` links.
  - `scripts/cloud/bootstrap.sh:50` is a no-op unless a cloud vendor marker or `BEEP_CLOUD_FORCE=1` is set.
- **Classification:** **inherited** (packet D3/P2 is not implemented).
- **Proposed goal addition:** add `BEEP_AGENT_HOST=managed-linux`, guard the desktop notifier on that, and document the managed-Linux bootstrap path.
- **Verification:** `BEEP_AGENT_HOST=managed-linux bash .claude/hooks/hook-pulse.sh </dev/null; echo $?` prints `0` with no error output.

**R7. MCP servers that only work on the workstation.**
- **Evidence:**
  - `serena` is missing from PATH.
  - `webstorm`, `stately`, `phoenix` and `phoenix-docs` are HTTP endpoints on the IDE, an external service or the tailnet.
  - `beep-m365-outbox` runs through `op run`.
  - 3 servers launch through `bunx`.
  - I did not test any connections.
- **Classification:** **inherited** (D7 was written for cloud only), with the missing `serena` being **host-specific**.
- **Proposed goal addition:** a runbook matrix marking each MCP server as required, optional or not applicable per host class.
- **Verification:** the MCP connect status of a fresh headless session matches the matrix.

**R8. Hard-coded absolute workstation paths.**
- **Evidence:** 192 references across 6 files in `AGENTS.md`, skills, hooks and scripts.
- **Classification:** **inherited**. They resolve on this host only because the directory layout matches.
- **Proposed goal addition:** replace them with `$HOME` or `BEEP_REFERENCES_ROOT`, or document the layout as a required invariant.
- **Verification:** `rg -c '/home/[a-z]+' AGENTS.md .claude scripts` prints 0 matches.

## What remains unproven

- **Yeet:** whether `yeet status` still suggests publish on a detached HEAD or writes artifacts (F9). It was not run.
- **Detached jobs:** whether detached Yeet jobs work under a non-GNOME SSH-only login.
- **MCP startup:** whether the `bunx`-launched MCP servers actually start, and whether any HTTP or tailnet MCP server connects.
- **Project trust:** Claude project-trust enrollment. I did not inspect private trust state, and this session showed no trust warning I could cite.
- **Secrets beyond vault listing:** only `op vault list` was tested. `op run` with the lane env files, and the 1Password quota under fan-out, were not.
- **Write access:** GitHub push and PR permissions (only `gh api user` was tested), private registry pulls and provider inference.
- **Package proof:** a representative package proof or frozen reinstall on this checkout. Per the instructions I did not run tests.
- **The gcr agent:** which keys the local agent socket holds (R5).
- **Other hosts:** dankserver and the tbk isolated guest, which this audit did not cover.

beep-worker is **not** fully ready. The audit shows that `bun run beep` and `yeet --help` work, the dependency tree is independent, and gh/op authentication works. Graft and references (R2–R3), model drift (R1), headless Yeet/systemd (R4), socket hygiene (R5) and the inherited host-class guards (R6–R8) remain open.
