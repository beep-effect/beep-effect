# Research intake 2026-11

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Run and mine the library's third intake: Box nightlies, the Nov-5 aggregation (papers, link list, VidBee bundles, private DM archive) at hop 0, hop 1 in full, gated hop 2; T1/T2/T3 mining into CiTO-typed, SKOS-routed findings; deep-research per gap cluster; per-hop coverage; routing amendments. Box legal-ontology pile: download, dedupe, T1 only.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/research-intake-2026-11/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/`](./research/) - supporting research, if present.
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

Closed: `completed-retained`, final
[#2963](https://github.com/beep-effect/beep-effect/pull/2963), the third goals-only
re-final (merged 2026-11-08, `de54b37982b`). It merged through a ruleset bypass
while Heavy / Check, Heavy / Test Integration, Heavy / Docgen and Heavy / Doctest
were queued, and GitHub then cancelled them;
[`decisions/2026-11-13-final-2963-attributed-reds.md`](decisions/2026-11-13-final-2963-attributed-reds.md)
attributes each one with its fix PR. The
[batch migration](../goal-closeout-hosted-verification/history/migration-2026-11-13.md)
adopted the legacy proposal.

## Latest Evidence

- Prerequisite `research-library-routes` landed and adopted (#2868, #2882,
  #2883); this lane added `mine`, private inputs, PDF text, referenced media,
  hop-scope and scale fixes, and a bounded hop-2 gate.
- November intake: 368 files (148 private), 240 hop-0 documents, 2,116 hop-1
  identities all readable or reviewed, 75,918 hop-2 catalogued and 400 admitted
  (303 readable). Legal pile: 449 PDFs, own private intake, T1 only.
- Mining: 1,737 T1, 1,235 T2, 12,330 span-checked CiTO findings; 8,472 routed to
  90 live packets, 22 amendments; three `/deep-research` runs; `/adhd`
  portfolio. See [`research/COVERAGE.md`](./research/COVERAGE.md) and
  [`research/ROUTING.md`](./research/ROUTING.md).

## Notes

<Record high-signal constraints or resume notes that do not belong in the
normative spec.>
