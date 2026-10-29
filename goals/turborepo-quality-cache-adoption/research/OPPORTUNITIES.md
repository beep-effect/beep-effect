# Friction and opportunities

Record friction as it occurs: work, minimum command/error/file evidence,
impact, prevention and owner/disposition.
Redact secrets, use portable paths, omit machine/session IDs and keep raw logs
in bounded artifacts.

Historical leads remain in the [exploration ledger](../../../explorations/turborepo-quality-cache/research/OPPORTUNITIES.md)
and [opportunity disposition](../../../explorations/turborepo-quality-cache/research/opportunity-disposition.md).
Refresh historical claims before treating them as current.

## 2026-10-28: current population exceeds the retained handoff

`cache census` observes 190 workspaces and 2,571 executable computations,
compared with 145 and 1,984 in the retained qualification handoff. Of the
current computations, 638 have no node in the retained population and 1,923
retain the same command text. Matching command text does not renew the old
runtime or semantic review. The current register preserves the prior review
leads and keeps every final disposition open. Owner: this goal.

## 2026-10-28: native client inference can invalidate a comparison

Launching the published canary binary from this checkout without
`--skip-infer` reports the installed stable version. With that flag, the
integrity-verified binary reports its pinned canary version. The existing pilot
already owns this control. All refreshed probes use that same selection rather
than treating two stable executions as a stable/canary comparison. Owner: this
goal; resolved for the refreshed pin observation, runtime comparisons pending.

## 2026-10-28: workstation timers are not cloud-enforced burst expiry

The earlier temporary runner cap was scheduled to return from eight to two at
12:54:43 UTC. Its local guard recorded restoration at 15:16:41 UTC, 2h21m58s
late. A fresh AWS read confirms cap two. The earlier 3.5-hour compute estimate
is not an actual billing receipt. Do not reuse this local-only procedure as a
hard expiry guarantee; prepare an independently available expiry control before
another bounded burst. Runner-cap control belongs to CI operations, not cache
qualification. The restored cap and original private launch receipts are retained.

### Refresh after source integration

Review found that the population receipt still held pre-integration census
source hashes. Re-ran the existing census and refresh recipe after main
integration; all retained census-source digests now match. Counts remain190
workspaces and2571 executable computations. The recipe now reads explicit UTF-8
and writes UTF-8 with LF under an ASCII locale. Source refresh is inventory
maintenance and grants no qualification or adoption.


## 2026-10-29: Census-source drift survived a later proxy repair

Review on PR #2352 found the population snapshot still retained an earlier
proxy digest. A proof that current census inputs are internally consistent did
not establish that the checked-in derived population had been regenerated.
Re-ran the canonical census and retained refresh recipe, verified every retained
source digest, and compared all population counts. Counts and qualification
states are unchanged. Future source-changing waves must regenerate the derived
population as well as inspecting a newly emitted private census.
