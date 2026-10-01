# Cloud Agent Readiness Plan

## Status

Status: `in-progress` — P0 and P1 complete 2026-10-01 (PR #1378); P2 is next.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Probe a fresh cloud container and record every failure with its command. | [`research/2026-10-01-container-probe.md`](./research/2026-10-01-container-probe.md) (F1–F15) exists; decisions D1–D7 are written into `SPEC.md`. |
| P1 Toolchain bootstrap | complete | `scripts/cloud-session-setup.sh`: pinned bun (D1), preflight for denied hosts (D2), frozen install with CI's retry, post-install assertion. | Acceptance rows 1–3 pass; `shellcheck` clean; the script runs green on a workstation and in the cloud once `pkg.pr.new` is allowed. |
| P2 Harness host awareness | pending | `BEEP_AGENT_HOST=cloud` guards in `.claude/hooks/*` and `graft-hooks.cjs`; MCP expectations recorded (D3, D7). | Acceptance row 4 passes; pulse conformance green if a literal was added. |
| P3 Publish handoff | pending | Document and exercise the D4 end state from a cloud session: proof → push → PR via API → `ready-for-heavy` requested in the body; operator closeout steps named. | A dated `history/` note shows the loop on one package (acceptance row 6). |
| P4 Doctrine | pending | `AGENTS.md` "Cloud sessions" section, a new `cloud-sessions.md` runbook under `docs/runbooks/`, cross-links, roadmap accelerator row, fourth meter in `agent-pools.md` (D6). | Acceptance row 5 passes; docs cross-link check green. |
| P5 Yeet: PR to mergeable | pending | Publish through yeet (operator-side per D4) and drive the PR to mergeable: required checks green, review threads answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P6 Close | pending | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

Phase ids here match `ops/manifest.json` `phases[]` exactly.

## P1 — Toolchain bootstrap, in detail

1. Read `.bun-version`; if `bun --version` already matches, skip to step 4.
2. Download `https://github.com/oven-sh/bun/releases/download/bun-v<ver>/bun-linux-x64.zip`
   into `~/.cache/beep/bun/<ver>/`; verify `sha256sum` against
   `.bun-linux-x64.sha256`; on mismatch, fail (stop condition). If the download
   is denied, fall back to `npm install --prefix ~/.cache/beep/bun-npm bun@<ver>`
   (F4). If both are denied, exit `78` naming `github.com` and `registry.npmjs.org`.
3. Put the binary on `PATH` for the rest of the script and print the
   `export PATH=…` line the caller sources. When `~/.bun/bin/bun` exists and is
   busy (F5), rename the new binary over it (`mv`), never `cp`.
4. Preflight `pkg.pr.new`: a `GET` of one real snapshot URL from
   `package.json` through the proxy (the site root is never probed); any
   non-2xx/3xx status exits `78` with the remedy line. `--check` stops here and reports every probe
   (bun version, bun route, `pkg.pr.new`, `gh auth status`, user bus, `op`).
5. `bun install --frozen-lockfile`, three attempts with the same backoff CI uses
   (`.github/actions/setup-monorepo-ci/action.yml`).
6. Assert every catalog package pinned to `pkg.pr.new` in `package.json` is
   present under `node_modules/` and `bun run beep --help` exits `0`;
   otherwise exit non-zero naming the missing packages (never report success
   on a silent partial install, F6).
7. Write `BEEP_AGENT_HOST=cloud` into the env file only when `--host cloud`
   was passed; never infer it. Binaries land in `~/.bun/bin` only when the
   caller's `bun` already lives there (so the caller's PATH needs no change);
   with no `bun`, or a mise-managed or otherwise relocated one, they land in
   `~/.cache/beep/bin` and the caller sources the env file, which the script's
   final line says.

Optional extension, not acceptance: `--with-effect-ref` runs
`scripts/setup-effect-ref.sh` with `BEEP_REFERENCES_ROOT=~/.cache/beep/references`
so the v3↔v4 validation rule can be honored in the cloud (F13).

## P2 — Harness host awareness, in detail

- `hook-pulse.sh`: when `BEEP_AGENT_HOST=cloud`, skip the desktop notifier and
  keep writing rows. Check `HookPulseV1` for a host field; add the `cloud`
  literal only if the writer would otherwise fail its conformance test.
- `graft-hooks.cjs session-start` / `stop`: exit `0` immediately when
  `BEEP_AGENT_HOST=cloud` and `graft/` is absent.
- `packet-projections.sh`: already non-blocking; leave it, but make it skip
  when `node_modules/effect` is absent so it does not spend the SessionStart
  timeout on a known failure.
- Research whether `.claude/settings.json` can scope `.mcp.json` servers per
  host; if not, D7's runbook table is the answer.

## P3 — Publish handoff, in detail

The cloud session that proves this packet is the evidence: run the setup
script, run `bun run beep quality package-verify @beep/repo-ai-metrics --quick`
(or the package P2 touched), quote the output in the PR body, push, open the
PR through the GitHub API, and record the note under `history/`. The operator
then runs the yeet closeout from a workstation (`monitor --until-ready`,
`ready-for-heavy`, `sweep --retire`), per D4.

## P6 Closeout Checklist

Before marking the packet closed (and `status` → `completed-retained`):

1. Write a closeout reflection via the `/reflect` skill (or copy
   `_template/history/reflections/_TEMPLATE.md`) to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Critique the repo **tooling**
   (what worked, what didn't, what was frustrating, what you wished existed), the
   **implementation** (improvement opportunities), and the **goal/prompt** (would
   you revise it to be clearer/easier/more efficient?). Capture TODOs worth
   codifying. Its YAML frontmatter must validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts` (this packet has
   `reflectionRequired: true`, so a missing/invalid reflection blocks closeout).
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status`.

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Record friction receipts in the active research packet's ledger the moment
  they happen (repo law), redacted for a public repo.

## Verification Commands

```sh
test "$(wc -m < goals/cloud-agent-readiness/GOAL.md)" -le 4000
jq . goals/cloud-agent-readiness/ops/manifest.json
rg -n "cloud-agent-readiness|GOAL.md|agentLaunchers|packetAnchorDocument" goals/cloud-agent-readiness
git diff --check -- goals/cloud-agent-readiness
shellcheck scripts/cloud-session-setup.sh
bash scripts/cloud-session-setup.sh --check
bun run beep lint reflection-artifacts
```
