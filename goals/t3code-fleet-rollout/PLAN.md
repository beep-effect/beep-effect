# T3 Code Fleet Rollout Plan

## Status

Status: `in-progress`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Restore a tom-pc-1 access route; record each host's arch, Node and service state; confirm how to disable T3's updater on fork builds. | Required facts and blockers are recorded. |
| P1 Implement | in-progress | DankStation pack and publish; pull timer and `t3 service` on beep-worker, dankserver, tom-pc-1 WSL; Tailscale HTTPS; hub-and-spoke links; runbook and host profiles. | Acceptance criteria are met. |
| P2 Verify | pending | Version parity, reboot survival, a reachability check from DankStation, and one linked-thread turn per host, recorded in `history/`. | Verification is green or blockers are documented. |
| P3 Yeet: PR to mergeable | pending | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | pending | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses and a typed `proposedCloseout` with status `completed-retained`
   and finalPullRequest. Keep `initiative.status` operative until completion
   evidence verifies; do not close the external execution/session ledger from a proposal.

## Execution Notes

- 2026-11-05 P0 facts (live reads over the approved wrappers): beep-worker and
  dankserver each run the official `t3@0.1.5` as `t3code.service` under
  `agent-runs.slice` from `$HOME/.t3/runtime/versions/0.1.5/t3`, linger on, no
  `service.env`; DankStation runs the fork desktop build (`0.1.7` before the
  version stamp). The updater cannot overwrite a fork build once
  `T3CODE_RELEASE_BASE_URL` in `service.env` points at the mirror, because
  `t3 update` and the launcher resolve `v<version>/SHA256SUMS` only there.
  tom-pc-1 access route: still the open P0 item (SSH key auth rejected).
- 2026-11-05 P1: `ops/t3code-fork-publish.sh` (hub) and
  `ops/t3code-fork-pull.sh` + timer units (hosts) written; the sync script
  stamps `<upstream>-fork.<yyyymmdd>.<hhmm>` on hub and archive alike. Runbook:
  `docs/runbooks/t3code-fleet.md`.

- 2026-11-06 P1 (lane `t3code-fleet-p1c`): tom-pc-1 key-auth SSH works again
  (BatchMode `SSH_OK`), which clears the P0 access blocker. The Windows node
  turned out to run a pre-existing Funnel route (a loopback proxy on 8765 that
  is not ours), so the distro joins the tailnet as its own node (decision file).
  Provisioned: distro `t3-agent` (Ubuntu 26.04.1, user `agent`, automount and
  interop verified off, systemd `running`, hostname `tom-pc-1-wsl`), Tailscale
  1.104.5 installed with operator `agent`, linger on, pull script, units, mirror
  config, installer and `~/t3-finish.sh` staged, `T3AgentWSL` keep-alive task
  registered and running (the distro stopped within seconds of the last session
  before it). Same day, after the operator approved the node: T3 installed
  pinned to the published version, service active, Serve on the distro's node,
  linked from the hub with auto access, Claude Code signed in, one delegated
  Opus 5.5 turn completed (receipt `history/2026-11-06-tom-pc-1-wsl.md`). The
  desktop-app pairings for dankserver and tom-pc-1-wsl were handed to the
  operator as app links; the runbook now has that step.

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.

## Verification Commands

```sh
test "$(wc -m < goals/t3code-fleet-rollout/GOAL.md)" -le 4000
jq . goals/t3code-fleet-rollout/ops/manifest.json
rg -n "t3code-fleet-rollout|GOAL.md|agentLaunchers|packetAnchorDocument" goals/t3code-fleet-rollout
git diff --check -- goals/t3code-fleet-rollout
```
