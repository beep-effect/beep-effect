# Fleet Mirror

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Derive a read-only view of every checkout sharing this origin — duplicate work,
stale bases, and moved policy paths — so an agent learns about a collision before
it pays for one, without any agent posting anything.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/fleet-mirror/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - back-links into the exploration.
6. [`history/`](./history/) - evidence and closeouts, if present.

## Scope Boundary — read before starting

This packet is **rung 1: derivation only**. The command exists, the three signals
are correct, and a human runs it.

**Rung 2 — ambient delivery through `AgentBrief.fleet` — is not in this packet
and cannot start here.** That field ships in speed-loop PR-I; re-verified against
`main` at `b4a06cefa3` (2026-08-06, after PR-E landed as #569), `AgentBrief`,
`OwnershipClaim`, and `beep agent report list` still have **zero source
references**. Everything rung 1 needs — `worktree doctor`, `git merge-tree`,
`/proc` — is already on `main`.

## Current Phase

**P1 Implement** — next. P0 is complete. Next concrete action: author the
`FleetCheckout` schema as a sibling class in `Worktree.command.ts` (not an
extension of `WorktreeDoctorEntry`), with liveness as a three-member `LiteralKit`
domain and every derived field expressible as `unknown`.

## Latest Evidence

[`research/p0-policy-surface-measurement.md`](./research/p0-policy-surface-measurement.md)
(2026-08-06) — 26 paths measured over 300 first-parent `main` commits.

**The P0 finding worth carrying into P1:** back-tested against the three Mode B
specimens actually observed this week, the config-only surface the design assumed
would have fired on **zero of three**. Every real specimen was a change to shared
*behavior* — the operator command every agent runs, the skills that drive it, the
patterns that govern authoring — not to a lint or CI config file. The recommended
surface adds a narrow, individually-low-frequency shared-behavior set and fires on
three of three, at 23.7% of commits (~1.9 bulletins/day). Sample is n=3 and
biased toward events that produced visible failures.

## Notes

- **The binding law is "measured or `unknown`."** It was derived twice in the
  exploration from two independent defects, and a falsely-`clean` or
  falsely-`dormant` field is a silent miss — worse than an absent one. If a
  signal cannot be made correct without inferring from a proxy, that is a stop
  condition, not a judgment call.
- **The proof is a test, not a feature.** Reconstruct the #551 shape: `main`
  moves onto a measured policy path while a checkout holds an in-flight branch
  that never touched the changed file. Signal 3 must fire; signals 1 and 2 must
  stay *silent*, because that collision produces no textual conflict. A mirror
  that cannot tell those apart is not carrying Mode B.
- **Do not touch `Yeet/internal/*`.** Pre-push wiring, the staleness guard, and
  the #551 regression are speed-loop's (PR-E/PR-G), handed off in
  [`HANDOFF-2`](../../explorations/fleet-coordination/research/HANDOFF-2-pre-push-and-guard.md)
  and dispositioned in
  [`AMENDMENTS`](../../explorations/fleet-coordination/research/AMENDMENTS-from-beep-effect3.md)
  A6–A10.
- **The #551 publish regression is fixed** — PR-E landed as #569 on 2026-08-06
  with the empty-monitor guard (`Handler.ts:680`) and a regression test
  (`packages/tooling/tool/cli/test/yeet-monitor-phase-empty.test.ts`).
  `yeet publish` without `--monitor` no longer exits 1 after a successful
  publish. Recorded here because this packet's proof test reconstructs that
  bug's *shape*, which stands independently of the fix.
