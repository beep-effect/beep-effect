# yeet babysit design tree (grill prep, 2026-09-15)

## Verified facts (live checkout, main @ 988cdc9077 lineage)

Modes today (`packages/tooling/tool/cli/src/commands/Yeet/`):
- plain `yeet monitor`: `gh pr checks --watch --fail-fast` behind a registration backoff
  (`MonitorChecks.ts` awaitYeetCheckRegistration). Exits non-zero on the first red, optional
  checks included (memory: exits 1 while printing `merge-ready: yes`).
- `--watch [--until-event]` (`WatchMode.ts`, 10 s): NDJSON `YeetWatchEvent` rows; ends on
  all-terminal / pr-merged / pr-closed / poll-error / event; registration patience = 10 empty
  polls per head; exit failure = `failing > 0` where `countYeetWatchFailures` counts EVERY
  fail outcome and ignores `YeetWatchCheck.required` → optional Vercel reds make it exit 1 and
  make `--until-event` fire instantly.
- `--until-merged` (`MonitorLoop.ts`, 30 s): re-reads `yeet status --remote`, prints the
  merge-ready gate each poll, reruns fingerprinted flakes once per job per SHA, ends ONLY on
  MERGED (then sweeps) or CLOSED. No "ready" terminal, no closeout.
- `yeet closeout`: separate read-first command; writes `.beep/yeet/runs/<branch>/pr-closeout.json`
  bound to `reviewedHeadSha`; the `closeout-run` criterion is false until it runs for the
  current head. Nothing composes "checks settled → closeout → read".

Merge-ready (`Status.ts` ~L1150-1190, `Verdict.ts` YeetMergeReadyCriteria), protocol order:
prOpen, notDraft, closeoutRun, requiredChecksGreen (from `gh pr checks --required`, non-empty
and all pass), threadsResolved, mergeable == MERGEABLE, mergeStateAcceptable ∈ {BEHIND, CLEAN,
HAS_HOOKS, UNSTABLE}, reviewDecisionAcceptable (none/empty/APPROVED). Greptile display-only.
=> readiness ALREADY tolerates optional reds (UNSTABLE accepted, required-only census). The
defects are exit codes, the missing "ready" terminal, and the closeout coupling.

Settle inputs: the ruleset (`gh api repos/<o>/<r>/rules/branches/main`) lists 17 required
contexts; `gh pr checks --required` lists the registered subset. Two ruleset contexts (`Lint`,
`Test Unit`) do not match the matrix job names (`Lint (lint-a)`, `Test Unit (unit-a)`) and never
appear in `--required` rows on #1142 → an expected-set settle rule must tolerate unmatched
contexts or the rule never settles.

Detachment: ttc B5 (rulings 35–40, lane in flight in `beep-effect21-worktrees/ttc-b5`,
uncommitted): `--detach` on verify|publish|closeout|monitor|repair → `systemd-run --user`
service `beep-proof-<jobId>`, `yeet job wait|status|cancel|finalize`, one `proof-job-finished`
inbox row (P2 green / P1 red or terminated), `observed` ack resolution. Not merged yet.

Idle wake already available to a Claude session: (1) a Bash `run_in_background` tool call that
blocks on `yeet job wait <id>` → one completion notification; (2) desktop PR bar
(`ccd_pr` bind + `auto_fix`) → `<ci-monitor-event>` on CI failures, conflicts, comments (no
green/ready event; #1142 is bound, auto_fix off); (3) `.claude/hooks/yeet-inbox.sh` tool-boundary
injection (P1) and Stop gate (P0); (4) cross-session `send_message`.

## External evidence (grok deep-research salvage, spot-checked by the orchestrator)

Report: `grok-deep-research-report.md` (Partial: Plan + Research done, Verify/Report cancelled
when the grok agent ended its turn; claims sourced, not workflow-verified).
- `gh pr checks`: `--watch` polls until Pending == 0, `--fail-fast` breaks on the first failure,
  exit 8 pending / 1 fail / 0 pass; "no checks reported" errors immediately even under `--watch`
  (cli/cli #7401 closed not-planned, verified via gh api); `--required` only keeps already-reported
  contexts with isRequired, and `--watch` exits when the visible required set has no pending, so
  unreported required checks are never waited for (cli/cli #8855 open, verified).
- GitHub: UNSTABLE = mergeable with non-passing commit status; required checks pass on
  success/skipped/neutral; the BLOCKED-vs-UNSTABLE mapping for required-vs-optional reds is
  community knowledge, not documented; `mergeable` null/UNKNOWN while recomputing.
- Bots: bors-ng preflight waits until every configured status has reported and is not running
  (prerun_timeout_sec 1800); GitHub merge queue waits for required checks on the merge_group and
  treats unreported checks as failed after the status-check timeout; Kodiak waits on missing
  required checks; Mergify checks_timeout + max_checks_retries. Settle = expected set reported and
  terminal, bounded by a timeout, is the norm.
- Event source: webhooks cannot target localhost; `gh webhook forward` is testing-only, one
  forwarder per repo; REST conditional GETs returning 304 are free of the primary rate limit;
  polling stays the right transport for a local CLI.
- systemd: `systemd-run --user` transient service is the survive-logout primitive; nohup/setsid
  do not survive KillUserProcesses; `OnSuccess=` via `-p`. Matches B5 rulings 35–40.
- Claude Code hooks (verified against code.claude.com/docs/en/hooks): `FileChanged` runs a hook
  when a watched file changes on disk whatever wrote it (matcher = literal filenames in cwd,
  `watchPaths` dynamic, no decision control); command hooks accept `asyncRewake: true` (runs in
  the background, exit code 2 wakes Claude with stderr as a system reminder). Their composition
  as an inbox-driven idle wake is plausible but not demonstrated in the docs → needs a spike.
  Desktop app polls PR checks via gh, shows a CI bar, can auto-fix, and notifies when CI
  finishes. Cross-session messaging can `notify_when_idle`.

## Doctrine drift found

AGENTS.md ("PR closeout: run `bun run beep yeet monitor` until it reports `merge-ready: yes`")
and the yeet skill step 6 ("arm `yeet monitor --watch --until-event` as the babysit loop")
describe recipes the code does not deliver: plain monitor exits 1 on optional reds while
printing `merge-ready: yes`, `--until-event` fires instantly on standing optional reds, and
neither waits for closeout. Classification: current drift from the documented operator
protocol (not architecture doctrine); owning surfaces are AGENTS.md Quality Operator, the yeet
skill, and the ttc goal packet's decisions log.

## Decision tree

Root: `yeet monitor` becomes the only babysit path; the scratchpad watcher is retired.

Frontier round 1 (independent of each other):
- D1 Home: ttc goal item B7 (bounded impl, rulings in research/decisions.md) vs advance the
  pr-event-awareness packet. Rec: B7 in ttc; packet gets a trail line + cross-link; webhooks
  stay out of scope.
- D2 Terminal: add `--until-ready`: exit 0 the first poll merge-ready == yes; exit non-zero on
  required red after the flake budget, pr-closed, poll-error budget; keep polling through
  pending/registration; optional reds never touch the exit code. Rec: yes, as a third loop
  policy sharing `pollUntilMerged`; `--until-merged` also announces readiness once.
- D3 Closeout composition: when the required census settles for a head with no current
  closeout artifact, the loop runs the read-first closeout itself (never the write flags).
  Rec: yes, automatic, head-keyed, idempotent.
- D4 Settle rule: (a) patience only (existing), (b) ruleset expected-set ⊆ registered required
  and none pending, with unmatched-context tolerance, (c) fixed count. Rec: (b) with (a) as
  fallback when the ruleset read fails; expose the wait reason in the gate line.
- D5 Delivery: canonical = `--until-ready --detach` + `yeet job wait` in a background tool call
  (after B5); plus a `merge-ready` inbox row (P2, observed-ack) so a session that missed the
  wait learns at its next boundary. Desktop auto_fix optional. Rec: as stated; no webhooks.
- D6 Sequencing vs B5: land after B5 merges (attached `--until-ready` is still useful before).
  Rec: two PRs: PR1 attached loop + settle + closeout + exit codes + docs (no B5 dependency);
  PR2 the detach recipe + job row once B5 is on main.
- D7 Plain monitor exit code: follow readiness (exit 0 when merge-ready yes despite optional
  reds) vs leave. Rec: follow readiness; the red-wave exit stays for required reds.
- D8 `--watch` failure count: count required-only for the exit code and `--until-event`
  trigger, keep emitting optional transitions. Rec: yes (bug fix, memory 09-09).

Round 2 (after round 1): flag name; inbox row kind + id; JSON/NDJSON shape of the ready
event; exit-code table; skill/AGENTS.md recipe text; measurement (record wall-clock from push
to ready for the C4 economics); test plan (route deps stubs, ruleset fixture).
