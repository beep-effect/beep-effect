# Fleet cloud setup and progress handoff — 2026-11-01/02

Durable handoff for the 2026-11 cloud setup wave across Claude, Codex and
Cursor cloud environments, plus a read-only health look at the managed Linux
workers. Scope was expanded by the operator to Claude + Codex + Cursor setup
(SPEC D42). Spending is limited to existing, expiring included credits; no
purchases, paid overage, new paid endpoints or plan changes.

This receipt keeps two kinds of evidence apart:

- **Workstation-reported**: verified by the parent orchestrator session from
  vendor dashboards and the workstation, and relayed to this session. This
  session did not observe it directly and records it as reported.
- **Observed in this cloud session**: seen first-hand by the Claude cloud
  session that wrote this note.

Account counts are generic. No account addresses, balances, session ids,
environment ids or configuration ids are recorded.

## Claude cloud (workstation-reported unless marked)

- Four personal `beep-effect` environments were created and saved, each with
  the limited package-manager network policy plus the allowed hosts
  `buf.build`, `pkg.pr.new`, `cache.agilebits.com` and
  `downloads.1password.com`.
- Saved setup script, identical on each:

  ```bash
  cd /home/user/beep-effect
  BEEP_CLOUD_VENDOR=claude BEEP_CLOUD_SKIP_OP=1 bash scripts/cloud/bootstrap.sh
  ```

  The `cd` is the vendor clone path, which the runbook documents; it is not a
  workstation path.
- Saved variables: `BEEP_AGENT_HOST=cloud`, `BEEP_CLOUD_SKIP_OP=1` and the two
  Bash timeouts from `docs/runbooks/cloud-environments.md`.
- Account 1 fresh smoke with the corrected setup is merged in #2486
  (`43d0a511239fe1fabea905e91f3070b414bf7652`): setup completed, `bun run beep
  --help` exit 0, `package-verify @beep/types --quick` exit 0, push, draft PR
  through the GitHub integration. Receipt:
  [`2026-11-01-claude-cloud-smoke.md`](./2026-11-01-claude-cloud-smoke.md).
  This session independently confirmed the merge on GitHub and on
  `origin/main`.
- Account 2 fresh smoke at `cfdddd1dce017f0e778d8103b8e214a5d3f1c73b` passed
  `bun run beep --help` and `package-verify @beep/types --quick` with a clean
  tree.
- Accounts 3 and 4: smoke sessions were launched; their results have not been
  collected. **Four-account qualification is not claimed.**

Observed in this cloud session (one of the accounts, branch
`claude/beep-effect-cloud-admission-78917a`):

- `BEEP_AGENT_HOST=cloud` and `CLAUDE_CODE_REMOTE=true` were set; the VM had
  4 vCPU and about 15 GiB RAM.
- SessionStart ran the shared bootstrap as a no-op (`dependencies already
  match bun.lock`, `ready: bun 1.4.4, node v24.22.1, portless 0.15.13, op
  missing`).
- Three optional `.mcp.json` servers failed to connect, as the runbook
  expects: `beep-m365-outbox` (no `op`, by design) and `phoenix-docs` and
  `stately` (proxy refused the tunnel).
- The D4 handoff worked from this session: branch pushed, draft PR #2487
  opened through the GitHub integration, review threads answered and
  resolved through it. Yeet `final-check`, `ready` and `monitor` were not run
  here and stay operator-side.

## Cursor Cloud Agent (workstation-reported)

- The existing config-as-code saved environment was checked against the
  committed `.cursor/environment.json` and `.cursor/install.sh` route.
- A fresh build on `352bac4` passed: install exit 0, Bun 1.4.4, Node 24.22.1,
  Effect 4.1.1. The environment was activated.
- This proves the bootstrap and snapshot only. No Cursor agent has run a
  package proof, so Cursor is not qualified for agent work.

## Codex cloud (workstation-reported)

- At `352bac4`: bootstrap, a repeat bootstrap, `bun run beep --help` and
  `package-verify @beep/types --quick` passed.
- Install and start instructions and two non-secret host variables were
  saved.
- Publishing the reusable environment configuration failed twice with "Could
  not publish environment", while the UI reported the settings as saved. The
  supported tools expose no retained operation records or publication logs,
  so the root cause is unknown. No secret or network workaround is
  justified. **The Codex configuration is not claimed runnable.**
- The current environment API has no native maintenance-script field. The
  resume command is saved as instructions only.

## Managed Linux workers (workstation-reported, read-only)

Health evidence only. This is not renewed provider, package or fleet
qualification, and it changes none of L0–L4.

- beep-worker and dankserver were reachable with their documented slice
  limits and no forwarded admin agent.
- beep-worker's `main` checkout is stale and carries unrelated local edits;
  they were preserved, not reset.
- tbk-worker guest is offline. The host guard and `libvirtd` are active, but
  the health and latch state are unreadable through the ordinary account.
  The guest was not started and no host or service was changed.

## Task admission state

From [`2026-11-01-cloud-task-admission.md`](./2026-11-01-cloud-task-admission.md):

- T1 (skill-contract-gate-certificates) was selected by the parent and
  launched as a separate cloud job.
- T2 and T3 are not selected or launched; T2 also waits on owner
  confirmation.
- T6 waits on operator review.
- T8's minimal notifier guard is owned by a separate cloud job.

## Phase effect

- **P3 Publish handoff: complete.** Acceptance row 6 is met by #2486
  (setup, `package-verify @beep/types --quick`, push, draft PR through the
  integration), whose merge this session confirmed.
- P2, P4, P5 and P6 stay open, as do the unfinished Linux acceptance rows
  (L2, L4). Lifecycle stays `active`.

## Blockers and next work

| Item | State | Next step |
| --- | --- | --- |
| Claude accounts 3 and 4 smoke | Launched, results not collected | Collect both receipts; record pass or fail per account without identifiers. |
| Codex reusable config publish | Fails twice with "Could not publish environment"; cause unknown | Retry once after a vendor-side change or support answer; no secret or network workaround. Until then Codex is bootstrap-proven only. |
| Codex maintenance step | No native field in the current API | Keep the resume command as instructions; revisit if the API adds the field. |
| Cursor agent package proof | Bootstrap and snapshot only | Run one Cursor Cloud Agent package proof on a small package. |
| P2 host awareness | Missing as specified | The separately owned notifier-guard job (T8) lands the guard; then prove acceptance row 4 with a cloud SessionStart/Stop transcript. |
| P4 doctrine | Partial | Reconcile the AGENTS.md section and agent-pools cross-link and meter against D42 names; owned outside this PR. |
| P5 / P6 | Pending | Packet PR to mergeable, then reflection and closeout. |
| tbk-worker health | Guest offline; health and latch unreadable | Operator-attended read through the guest-only administration route; no start without the D27/D33 pre-start checks. |
| beep-worker checkout | Stale `main` with unrelated edits | Owner decides how to reconcile the preserved edits before any fresh proof. |
