# Cloud Agent Readiness Spec

## Objective

A fresh hosted agent container that holds only this repository's checkout and
the host's default tooling reaches, by running one documented command, a green
`bun install --frozen-lockfile` and a working `bun run beep --help`; its
session hooks and MCP expectations match the host it is on; and a cloud
session has a documented, repeatable end state (pushed branch, PR opened
through the GitHub API, proof output in the PR body) with a named operator-side
closeout. Every known denial (bun installer host, Effect snapshot registry) is
surfaced by a preflight that names the remedy instead of failing silently.

## Non-Goals

- Moving Effect from the `pkg.pr.new` snapshot to a published release, or
  vendoring the snapshot tarballs into the repo.
- Running recorded browser QA (`beep qa record`), the OBS lane, or any
  desktop-gated acceptance from a cloud container.
- Putting secrets into cloud containers: no 1Password service account, no
  `op://` env files, no provider keys.
- Replacing Yeet or adding a GitHub-App token mode to it (recorded as a
  follow-up candidate, D4).
- Cursor and Codex lanes; the volume-pool order in `AGENTS.md` stays as is.
- Provisioning the `.repos/effect` reference workspace in the cloud (tracked
  as an optional P1 extension; not acceptance).

## Source Hierarchy

1. The operator's request of 2026-10-01 that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and the required skills (`yeet`,
   `effect-first-development`).
3. `standards/ARCHITECTURE.md`, `standards/git-worktrees.md`,
   `docs/runbooks/agent-pools.md`, `docs/runbooks/typescript-toolchain.md`.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. `research/` and `history/` in this packet.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `scripts/cloud-session-setup.sh` (new): toolchain bootstrap and preflight.
- `.bun-version`, `.bun-linux-x64.sha256`: read only; never edited here.
- `.claude/settings.json`, `.claude/hooks/*`, `.claude/helpers/graft-hooks.cjs`:
  host-aware guards.
- `.mcp.json`: unchanged unless a host-scoped enable/disable mechanism exists;
  otherwise the runbook records which servers are workstation-only.
- `AGENTS.md`: one new section, "Cloud sessions".
- A new `cloud-sessions.md` runbook under `docs/runbooks/` and a cross-link from
  `docs/README.md` and `docs/runbooks/agent-pools.md`.
- `docs/ROADMAP.md`: one Lane 3 accelerator row for this packet.
- `packages/tooling/library/ai-metrics`: only if a `cloud` host literal is the
  cheapest way to keep pulse rows flowing (D3); otherwise untouched.
- This packet.

## Constraints

- The setup script is idempotent, safe on a workstation, and never modifies a
  tracked file; it writes only under `~/.cache/beep/`, `node_modules/`, and
  bun's own `~/.bun/bin` (only when the caller's bun already lives there;
  never a mise shim or other toolchain-managed directory).
- The pinned bun comes from the repo's own pins: version from `.bun-version`,
  archive digest from `.bun-linux-x64.sha256`. A digest mismatch is a hard
  failure.
- The script never calls `https://bun.sh/install` (denied by the default cloud
  network policy, probe F2) and never `cp`s over a running binary (F5).
- Preflight exit codes are stable and documented; a denied host exits `78`
  (configuration error, the same convention the 1Password shim uses) with the
  host name and the remedy on one line.
- Host detection is explicit: hooks read `BEEP_AGENT_HOST`; nothing guesses
  from paths, hostnames, or proxy files.
- No new MCP server, no new always-loaded prompt surface beyond the one
  `AGENTS.md` section; keep that section under 40 lines (context economy).
- Public repo: the runbook and evidence carry no tokens, session ids, machine
  ids, or absolute home paths.

## Decisions

| Id | Decision | Rationale |
| --- | --- | --- |
| D1 | The pinned bun is provisioned from the GitHub release archive verified against `.bun-linux-x64.sha256`, with `npm install bun@<.bun-version>` as the fallback route. | Both routes were proven on 2026-10-01 (F3, F4); the installer host is denied (F2); the digest is already tracked for CI's baked-runner path. |
| D2 | `pkg.pr.new` reachability is an environment precondition surfaced by preflight, not worked around in the repo. | The snapshot is 34 lockfile entries (F6); vendoring or mirroring is a dependency-policy change outside this packet. A loud, named failure beats a silent partial install (F6, F7). |
| D3 | Hooks and docs key off `BEEP_AGENT_HOST=cloud`, set in the environment's variables; the setup script writes it into `~/.cache/beep/cloud-env.sh` only when invoked with `--host cloud`, never unconditionally. Desktop-only effects (graft session-start, the desktop pulse notifier) no-op under it; pulse rows keep flowing if the writer already tolerates a new host kind, else the literal is added in the same PR. | Heuristics drift; an explicit variable is testable and documented. The evidence loop wants cloud rows, not silence. |
| D4 | A cloud session's end state is: proof commands run and quoted in the PR body, branch pushed, PR opened or updated through the GitHub API, `ready-for-heavy` requested in the PR body. The yeet `monitor --until-ready` loop, the `ready-for-heavy` label, and `sweep --retire` stay operator-side until yeet runs without `gh` and systemd. | `GH_TOKEN` is invalid in the container (F8) and there is no user bus (F9). Recording the handoff is cheaper and safer than a token mode designed under deadline. |
| D5 | No secret enters a cloud container. Packets whose proof requires an `op://` env file or a live external credential are outside the cloud lane and the runbook says so. | F10; `AGENTS.md` 1Password law. |
| D6 | Cloud credits are a fourth meter in the pool runbook (Opus, Cursor, Codex, cloud). The pool order itself is unchanged. | Spending is real and expiring; the runbook is where meters live. |
| D7 | Workstation-only MCP servers (`serena`, `webstorm`, `phoenix`, `phoenix-docs`, `chrome-devtools`) are documented as expected-failing in the cloud unless a host-scoped enable mechanism exists in `.claude/settings.json`; if one does, it is used, and `.mcp.json` is not forked. | F11; keep the tool surface stable within a session (context economy). |

## Acceptance Criteria

- [ ] From a fresh container with the checkout and default tooling only, and
      with `pkg.pr.new` allowed by the environment, `bash scripts/cloud-session-setup.sh`
      exits `0`, after which `bun --version` equals `.bun-version`,
      `node_modules/effect/package.json` exists, and `bun run beep --help`
      exits `0`. When the caller's `bun` is `~/.bun/bin/bun` (the cloud
      container's case) binaries land there and no PATH change is needed. In
      every other case (no `bun`, a mise-managed or otherwise relocated `bun`,
      or `--host cloud` passed) the caller first
      `source ~/.cache/beep/cloud-env.sh` (never the setup script itself),
      and the script's final line says so.
- [ ] `bash scripts/cloud-session-setup.sh --check` on a container that denies
      `pkg.pr.new` exits `78` and prints the denied host and the remedy
      ("add pkg.pr.new to the environment's allowed domains") without changing
      anything.
- [ ] On a workstation that already satisfies the pins, the script is a no-op
      beyond `bun install --frozen-lockfile` and exits `0`.
- [ ] With `BEEP_AGENT_HOST=cloud`, SessionStart and Stop hooks emit no error
      lines, the desktop notifier does not fire, and `graft` session-start is
      skipped; without it, behavior is byte-identical to today.
- [ ] `AGENTS.md` has a "Cloud sessions" section that states the host
      variable, the setup command, the can/cannot rubric (secrets, systemd,
      `gh`, recorded QA, corpora), and the D4 end state; the new `cloud-sessions.md` runbook under `docs/runbooks/`
      carries the operator checklist (environment setup script text, allowed
      domains, variables) and the closeout handoff; `docs/ROADMAP.md` carries
      the accelerator row.
- [ ] One dated note under `history/` records a real cloud session running the
      full loop: setup → `bun run beep quality package-verify <pkg> --quick` on
      one package → push → PR opened through the API.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/cloud-agent-readiness/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/cloud-agent-readiness/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/cloud-agent-readiness scripts AGENTS.md docs .claude` | Passes |
| Script lint | `shellcheck scripts/cloud-session-setup.sh` | No findings |
| Script no-op on satisfied host | `bash scripts/cloud-session-setup.sh && git status --porcelain` | Exit `0`; no tracked changes |
| Preflight on denied host | `bash scripts/cloud-session-setup.sh --check` in the cloud before the allowlist | Exit `78`; names `pkg.pr.new` |
| Full bootstrap in the cloud | `bash scripts/cloud-session-setup.sh --host cloud && source ~/.cache/beep/cloud-env.sh && bun run beep --help` after the allowlist | Exit `0` |
| Hook guard | `BEEP_AGENT_HOST=cloud bash .claude/hooks/hook-pulse.sh < /dev/null; echo $?` and the SessionStart transcript of a cloud session | Exit `0`; no error lines |
| Pulse conformance (only if D3 adds a literal) | `bun run beep quality package-verify @beep/repo-ai-metrics --quick` | Green |
| Reflection artifact | `bun run beep lint reflection-artifacts` | Green |
| Docs cross-links | `rg -n "cloud-sessions.md" docs/README.md docs/runbooks/agent-pools.md AGENTS.md` | Each file links the runbook |

## Stop Conditions

- The environment cannot be configured to allow `pkg.pr.new` (D2): report
  with the preflight output; do not vendor or mirror the snapshot.
- `.bun-linux-x64.sha256` does not match the release archive for the pinned
  version: report; do not relax the digest check.
- The hook guard would require guessing the host (D3): report instead.
- Verification requires a credential, cost, destructive side effect, or policy
  approval not named here.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| Yeet closeout stays operator-side | D4 end state | operator | `gh` token invalid and no user bus in the container (F8, F9) | Yeet gains a `gh`-free, systemd-free publish and monitor path |
