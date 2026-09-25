# GOAL: make `yeet monitor --until-ready` deliver bad news

Repo root: the current working directory (the `beep-effect` checkout you are
in). Use repo-relative paths.

Outcome: every PR event that matters (required red, base conflict, review
thread, human comment) lands as an attributed, per-head-coalesced inbox row
from the canonical detached babysit; the owning session gets it whether it
is blocked in `job wait`, idle, or dead; push → row → ack is measured.

Compact `/goal` launcher. The packet files are the contract:

- `goals/yeet-pr-events/README.md`
- `goals/yeet-pr-events/SPEC.md`
- `goals/yeet-pr-events/PLAN.md`
- `goals/yeet-pr-events/ops/manifest.json`
- `goals/yeet-pr-events/research/SOURCES.md`

Read them first, then `AGENTS.md`, `CLAUDE.md`, and the standards `SPEC.md`
names. Repo instructions outrank packet prose when they conflict.

Scope:

- In: `packages/tooling/tool/cli/src/commands/Yeet/internal/` (Status,
  WatchMode, MonitorLoop, MonitorPolicy, MonitorComments, Settle, Inbox,
  InboxView, Ack, Remediation, ProofJob, ProofJobLauncher, new
  `Converge.ts`), their tests, `.claude/hooks/yeet-inbox.sh` plus two new
  shell workers beside it, the law text named in `SPEC.md`, packet docs.
- Out: any launcher or auto-dispatched fixer, cadence changes, a webhook
  receiver, owner takeover, cross-checkout delivery, a new drivers
  package, glossary or architecture-log entries, settings-level opt-ins,
  `sequence-break-notifier.sh` / `hook-pulse.sh` invariants,
  `.claude/settings.json` (operator-only), ack pruning.

Workflow:

1. Confirm the packet is `active`; inspect ownership and current changes on
   every target file; preserve unrelated work.
2. Slice 1, one PR, W1→W6: check fidelity + first-seen stamps; `Converge.ts`
   + non-terminal reds/conflicts + `job wait` exit 2 `wave` (rows unacked);
   `base-conflict` P0 row + `cleared` ack; `pr-comment` P1 rows with a
   per-consumer watermark and the submit-time backlog window;
   `YeetInboxWaveExemptRowKind` + hook literal + parity test; two allowlist
   names + law text. Prove it on this PR's own babysit (`SPEC.md` first slice).
3. Slice 2: W7 socket probe first (three senders, one accepted frame, one
   refusal, delivery matrix into a bypass session, written to
   `explorations/pr-event-awareness/research/`).
   Only if it delivers, W8: the idempotent SessionStart-spawned shell tail
   with a `/proc` start-identity reap and a retire-fence regression. A
   failed probe closes the slice as cut.
4. Slice 3: W9 pr-wave notifier, monitor-side, notify-send + ntfy, unknown
   liveness escalates.
5. W10 only after the W1 timeline names which chain to collapse.
6. Run the `SPEC.md` verification matrix. Publish each slice through
   `/yeet`, push fixes as soon as finished, monitor to `merge-ready: yes`,
   resolve every review thread, then close at P13.

Acceptance:

- [ ] Every `SPEC.md` acceptance criterion for the shipped slices passes.
- [ ] `--until-ready` rows match the watch's field for field.
- [ ] A P0 row clears only by a new head, a `cleared` ack, or an attributed ack.
- [ ] Each PR is merge-ready through `/yeet`.
- [ ] No unrelated refactors or formatting churn.

Stop and report if the probe fails (close slice 2), the retire fence rejects
the tail, the legacy `status.json` fixture stops decoding, the hook's 2 s
budget is exceeded, the work needs `.claude/settings.json` edits, or an
unnamed dependency, credential, cost, destructive effect, or policy approval.
