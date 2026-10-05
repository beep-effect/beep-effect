# ciops-ontology-pipeline — decisions

Ruling log for this goal. Each entry records the question, the ruling, the rationale and the
rejected options, in the house style of the prior log. Rulings are the steward's; the
orchestrator proposes and records. Entries are append-only, newest last.

## Prior log

The exploration this goal graduated from keeps its full ruling history:
[`explorations/beep-ci-operational-ontology/DECISIONS.md`](../../../explorations/beep-ci-operational-ontology/DECISIONS.md).
It ends with two 2026-10-01 entries that found this goal:

- "2026-10-01 — admission-journal snapshot (one ruling, steward: Benjamin)": the snapshot at
  `explorations/beep-ci-operational-ontology/research/evidence/journal-snapshot-2026-10-01/`,
  digest-only as ruled; the PR #1386 review addendum at the end of that file adds a committed
  redacted projection (`journal.redacted.ndjson`) that W3 reads by path and sha256.
- "2026-10-01 — graduation sitting (11 rulings, steward: Benjamin)": Rulings 1–11. This
  packet's SPEC, PLAN and manifest cite them as "graduation Ruling n".

Older ruling numbers in that log name their series (run-3, S7, time-to-certainty) wherever
they could be confused. Those entries stay where they are and are never copied here; the
ontology tree and `research/scripts/**` they govern stay under the exploration, owned by this
goal by back-link (graduation Ruling 7).

## Rulings

None yet. The first entry lands here, not in the exploration log.

## 2026-10-05 — P0 sitting (steward: Benjamin)

**Ruling 1 — W2 seat launcher not chosen.** Auditor run 4 seats run on Opus 5.5 by
launch-entry deviation from skill v15 (graduation Ruling 4); no v16 model-agnostic launcher,
no new self-test family, no new pinned digests. Rationale: the 2026-10-01 model defaults pin
`claude-opus-5-5` on every seat, so a model-agnostic launcher has no consumer at run 4, and
validator v15 already accepts the deviation (a non-blank `agents.<role>.model` and
`agents.<role>.effort`). Rejected: build v16 first (a workstream with no run-4 need that
reopens the pinned-digest family for a launcher nobody exercises).

**Ruling 2 — graduation Ruling 6's hosted clause amended: the same mechanisms on the hosted
tier.** The admission criterion now reads: a row records a change to admission, ordering, gate
selection or early stop, Turbo/cache task inputs, or lane assembly or sharding on any tier, plus
hosted-runner capacity on the hosted tier; instrumentation-only and shadow-only changes stay
excluded. Rationale: hosted episode time-to-certainty is set by Heavy Admission gating,
skip-satisfied verdicts and lane sharding as much as by fleet size, and rows are observational
seed data that partition only their own tier's series (KPI law v1.1 tiers). The first W1 pass
refuted #982, #1064, #1155, #1165, #1195 and #1384 on the hosted clause alone; they are admitted
under this ruling. Rejected: capacity only (leaves the hosted series untagged at its gating and
sharding instants).

**Ruling 3 — contested local rows, and a check step inside a lane is gate selection.** Admit
#1102, #1112 and #1269 (the criterion refuter upheld each; only cites were corrected). Exclude
#882, #913, #967 and #1143 (the criterion refuter showed no decision changed). A new check step
added inside an existing lane is gate selection, because it adds a predicate that can turn the
lane red; #1098 stays and #1029 is admitted on the same rule. Rejected: steps never count
(drops #1098 and leaves a lint:policy gate addition untagged); admit every contested row with
a flag (rows without a criterion verdict).

**Ruling 4 — #1068 and #1269 promoted to rows; the iv-1006 caveat rewritten; the
`mechanismChanged` vocabulary ratified.** Each qualifies on its own (#1068: the cache-policy
gate joins the repo-sanity and cheap-gate lanes and lint cache turns off for two packages;
#1269: a seed row moves `quality:cache-policy` to rank 19), and caveat prose never becomes a
CQ-016 partition point. The third iv-1006 caveat becomes the cross-reference list of later
ladder edits; its "changes its early stop" for #1269 was wrong (the lane is stop-after-red
before and after; only its rank changed). `mechanismChanged` stays scalar over the closed set
admission, ordering, gate-selection, early-stop, turbo-cache-inputs, lane-assembly, sharding,
hosted-runner-capacity; co-mechanisms at the same instant are named in a CONFOUNDED caveat.
Rejected: keep them as caveats; leave the known error in iv-1006.

**Ruling 5 — the W1 query widened and run twice.** The first pass (four path families, 155
PRs) missed the hosted-capacity lever itself (`infra/` Pulumi fleet: #1050, #1141, #1364) and
parsed PR numbers only from `(#N)` squash subjects (dropping `Merge pull request #N`: #891,
#892, #893, #894). The families now also cover `scripts/systemd`, every tracked `turbo.json`,
`internal/cli/{TurboCache,EnvConfig}.ts`, the cache-qualification store, `commands/Lint`,
`commands/Docgen/internal`, `internal/package-scripts`, `vitest.shared.ts`, the
`setup-monorepo-ci` action and CI profile scripts, the fleet infra and runner runbooks: 190
PRs, 35 new, classified in a second pass under Rulings 2–4 (with #952 and #989 re-reviewed
under the rule that admitted #1182). Workspace `package.json` scripts are not a family: they
are generated by `internal/package-scripts`, which is.

**Ruling 6 — `landedAt` for fleet changes applied outside the repository.** When a
hosted-capacity lever is applied outside the repository at an instant the runner runbooks
record, the row's `landedAt` is that recorded instant and the PR is the record; GitHub's
`mergedAt` stays in the row's evidence line. The fleet changes when the apply lands, not when
the source merges: iv-1050 (the scale-up Lambda changed at 2026-09-09T09:13:51Z, 64 minutes
before the merge) and iv-1364 (the Pulumi apply ended 2026-10-01T12:05Z, after a merge that
deployed nothing). A live change with no clock time on record keeps the merge instant and marks
the mixed window in a caveat (iv-1141). Rejected: `mergedAt` everywhere (iv-1364 would
partition the hosted series two hours before the pool changed).

**Ruling 7 — pass-2 contested rows, a third pass, and the commit with no PR.** Confirmed on
the Ruling 3 pattern: #1053 and #1141 become rows (criterion upheld, facts corrected); #984
(local resource control on `agent-runs.slice`, outside the vocabulary), #1085 (a docgen
discovery guard with no realized target change at landing) and #1375 (the runbook record of
#1364's apply, so that event has one row) are excluded. `#1232` and `#1233` file under
`turbo-cache-inputs` and `#891`/`#894` under `admission`, as the ratified vocabulary reads.
The query gains two paths, `.envrc` (turbo-cache: which shells share the cache store) and the
git pathspec `:(glob)**/docgen.json` (lane-assembly: the Docgen aggregation set, deletions
included), and a bounded third pass
classifies the PRs the extension surfaces together with the three pass-1 exclusions whose
widened-family hunks looked like levers (#1055 Spot allocation strategy, #1061 docgen JSDoc
metadata check, #1389 the `packages/tooling/tool` shard split); the remaining pass-1
exclusions stay as classified, under the screen recorded in `w1-lever-query.md`. The one
first-parent commit without a PR (`8ef3213cbf`, 2026-09-03, an out-of-band correction of 27
checkouts' Turbo remote-read token references) is classified like a PR from its diff and
message; if it qualifies it is recorded as a dated caveat on iv-953, not as a row, because
rows carry a PR number and the correction happened outside the repository. Rejected: a local
capacity vocabulary value now (a run-4 question); re-reviewing all 42 pass-1 exclusions; a
row with an empty `pr`.
