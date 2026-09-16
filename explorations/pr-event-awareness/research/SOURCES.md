# PR Event Awareness for Orchestrating Agents — Sources & Provenance

<!--
The provenance ledger for this packet. Started at capture because the
in-repo inventory was verified while the packet opened; §1 and §2 are dropped
until research mines an external corpus. Never fabricate a URL; cite the
CAPTURE/RESEARCH section that carries a claim when none exists on disk.
-->

- **Cluster / origin:** the time-to-certainty C3 closeout session
  (2026-09-12), where the operator was the PR-event notification path for
  PRs #1102, #1126, #1130, and #1131.
- **Provenance:** [`../CAPTURE.md`](../CAPTURE.md) (spark, proposal,
  assessment, live-checkout inventory).

## 3. External research sources

None on disk yet. Claims about `gh webhook forward`, GitHub webhook event
names, and lazy mergeability recomputation live in
[`../CAPTURE.md`](../CAPTURE.md) and are to be cited during research.

## 4. In-repo capability references

All paths under `packages/tooling/tool/cli/src/commands/Yeet/internal/`
unless stated; package `@beep/repo-cli`. Verified 2026-09-12.

| Brick | Path | Role for this packet | Disposition |
|-------|------|----------------------|-------------|
| `YeetWatchEvent` | `WatchStream.ts` | typed PR transition union (check, thread, mergeability, head, comment) | reuse |
| `runYeetWatchStream` | `WatchMode.ts` | 10 s poll, NDJSON transitions, inbox convergence | extend (push source) |
| wave record | `Remediation.ts` | per-head coalescing of check reds; supersede on push (its A4 lease prose is historical) | extend (threads, conflicts, lane dispatch) |
| `YeetInboxRow` | `Inbox.ts` | P0/P1 checkout inbox rows with deterministic ids | extend |
| comment watermarks | `MonitorComments.ts` | REST comment polling cursors | reuse |
| flake fingerprints | `MonitorLoop.ts` | one rerun per job per head; attribution before dispatch | reuse |
| `PrSessionRegistry` | `PrSessionRegistry.ts` | PR → local session rows (append-only, local-only) | reuse |
| `HarnessResumer` | `Resume.ts` | live-session match by pid/session/cwd; resume command | reuse |
| provenance footer | `ProvenanceFooter.ts` | public resume block, concurrent-edit reconcile | reuse |
| inbox hook | `.claude/hooks/yeet-inbox.sh` | tool-boundary delivery, P0 tool denial, Stop gate | reuse |
| webhook receiver / `gh webhook forward` adapter | — | push source | NET-NEW |
| idle-wake bridge (session-manager message) | — | deliver a wave to an idle owning session | NET-NEW |
| per-PR dispatch policy + detached Codex lane launcher | — | one lane per actionable capsule, serialized per PR | NET-NEW |

## 5. Cross-links & provenance

- [`goals/ship-velocity`](../../../goals/ship-velocity/README.md) — live:
  A1 streaming watch + remediate, A2 hook-mutex + ACK inbox, A3 Stop gate,
  A7 monitor hardening (completed-retained). Retired: A4 dead-owner takeover
  + warm fixer, removed by operator PR #921 (2026-08-30) together with the
  published-PR lease, watcher, and mutation fence; only stale `Remediation.ts`
  comments still narrate it.
- [`goals/yeet-pr-resume-footer`](../../../goals/yeet-pr-resume-footer/README.md)
  — the resume footer, session registry, and `yeet resume` (completed-retained;
  PR 2 surfaces still listed in its PLAN).
- [`goals/time-to-certainty/research/OPPORTUNITIES.md`](../../../goals/time-to-certainty/research/OPPORTUNITIES.md)
  — the 2026-09-12 receipt that opened this packet.
- [`explorations/fleet-coordination`](../../fleet-coordination/README.md) —
  routing and lease laws for sibling checkouts.
- This packet: [`../CAPTURE.md`](../CAPTURE.md).
- [`goals/time-to-certainty` B7](../../../goals/time-to-certainty/research/b7-brief.md) —
  the polling half of this packet's gap, built 2026-09-16 as `yeet monitor --until-ready`
  (settle rule, automatic closeout, ready terminal, `pr-merge-ready` row; rulings 41–49).
