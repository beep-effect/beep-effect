# P1 mid-window sampling-power checkpoint

Executed 2026-08-10 (scheduled 2026-08-09 in the README's open-risk paragraph;
2026-08-09 was a near-dark day — 171 rows total — so the one-day slip cost no
signal). This note records what the baseline window has actually captured at
roughly day 4 of the ≥7-day wall-clock window that opened `2026-08-06T13:12:30Z`,
and what that means for the p95 the window was expected to produce. The
instrument itself was not touched: `notifierRev` is `log-only-0` on every
in-window row.

## Method

`jq` over the live ledger at
`${XDG_STATE_HOME:-$HOME/.local/state}/beep/agent-evidence/hook-events`,
restricted to rows with `ts >= 2026-08-06T13:12:30Z` (the operator-salt
namespace; pre-cutover rows are verification data and were excluded). Wait
brackets were joined with the amendment-4 two-hop rule — `PermissionRequest`
rows carry `toolUseId: null`, so each was closed against the nearest subsequent
`PostToolUse` for the same session and tool, with the amendment-3 execution
subtraction (`durationMs`) applied. Per the recorded hazard, stratification
keys on the `PermissionRequest` row's `permissionMode`, never the terminal
event's. This note deliberately contains counts, durations, enums, and tool
names only — never a pseudonym digest, and never anything that could pair a
digest with a cleartext path.

## Results (measured 2026-08-10, ~day 4 of ≥7)

- **Volume**: 46,057 in-window rows across 79 sessions, all
  `agentKind: claude-code`. Daily rows: 17,355 (Aug 6, partial day) /
  12,287 (Aug 7) / 13,746 (Aug 8) / 171 (Aug 9) / 2,500-and-counting (Aug 10).
- **Plan approvals: zero — and stronger than the risk as written.** The README
  flagged zero *organic* plan-approval `PermissionRequest` rows. At mid-window
  there are zero `ExitPlanMode` rows in **any** hook event (`PreToolUse`,
  `PermissionRequest`, `PostToolUse` alike). Plan mode has not been used at all
  inside the window; the headline wait class has no organic sample, not even an
  open bracket.
- **`tool-permission` is the live wait class**: 36 `PermissionRequest` rows —
  35 `AskUserQuestion` plus one MCP tool gate
  (`mcp__ccd_session_mgmt__archive_session`, `permissionMode: auto`,
  2026-08-08).
- **All 35 `AskUserQuestion` brackets close** under the two-hop join (100%
  closure; no abandoned brackets). True waits, seconds, sorted:
  3, 3, 3, 3, 4, 5, 5, 5, 6, 19, 19, 19, 20, 32, 35, 36, 54, 59, 94, 111,
  162, 164, 166, 187, 195, 243, 289, 344, 567, 721, 806, 1361, 1521, 1598,
  2549. Headline stats: **p50 = 59 s, p90 ≈ 22.7 min (1361 s), p95 ≈ 26.6 min
  (1598 s), max ≈ 42.5 min (2549 s)**. The distribution is strongly bimodal:
  a fast mode (9 waits ≤ 6 s — questions answered while watching) and a
  long tail (7 waits > 9 min — questions that sat while the operator was
  elsewhere).
- **Mode stratification** (keyed on the `PermissionRequest` row): 31 of 36
  under `bypassPermissions`, 5 under `auto`. Session-level mode mix across all
  79 sessions: 27 sessions saw `bypassPermissions`, 9 saw `auto`, 1 saw
  `default` — consistent with the pre-window observation that ordinary tool
  gates almost never fire on this workstation.

## Verdict

The open risk **materialized, in its stronger form**. As constructed, this
window will not produce a plan-approval p95 — n = 0, and nothing about the
remaining ~3 days suggests otherwise, because the operator's working style in
the window simply does not include plan mode. What the window *will* produce is
a defensible `AskUserQuestion` wait distribution (n = 35 at day 4, on pace for
~60–70 by close) with a stable shape: short-median, heavy-tailed, p95 in the
tens of minutes.

The p95-105-min plan-approval figure from the July audit therefore cannot be
re-measured from this baseline; it remains sourced to the audit's transcript
archaeology only.

## Decision — deferred to window close, on purpose

The instrument-before-treat law says nothing gets changed mid-window, and
nothing was. The call that must be made **at window close (≥ 2026-08-13T13:12:30Z)**:

1. **Re-scope the baseline deliverable** to the waits the window actually
   measured (`AskUserQuestion` + the observed mode mix), and treat
   plan-approval as *unmeasured in baseline* — meaning any P8 paired trial on
   plan-approval waits needs either an induced-sample protocol (scripted
   plan-mode sessions, clearly labeled as induced) or a longer accrual window
   before a before/after comparison is honest; **or**
2. **Extend the window** past the 7-day minimum in the hope of organic
   plan-mode use — weak, since absence is structural (working style), not
   variance; **or**
3. Re-scope P1's treatment target to the wait class that dominates the
   *observed* evidence (`AskUserQuestion` long tail: 7 waits over 9 minutes in
   4 days) and demote plan-approval to a later phase with its own instrument
   plan.

Option 1 or 3 fits the evidence; option 2 spends wall-clock against a
structural absence. The choice lands in the window-close analysis, not here.
