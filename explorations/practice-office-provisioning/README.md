# Practice Office Provisioning

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `align`
Status: `active`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Tom's solo IP practice needs its office estate provisioned production-grade:
historical emails searchable in Outlook, Box as the document system of record
with client/matter organization and versioning, contacts created from
extracted client entities, and walkthrough artifacts teaching the process.
The corpus chain restores the past; this packet gives the practice a present.

## Next Open Question

Align round 1 over the seven-item frontier in `ops/manifest.json`
`openQuestions` — lead with the two money decisions (EOP2 seat vs Purview
Suite for the PST-import rights; Box Governance quote and upgrade triggers)
and the ownership/collaboration topology, which gates the reconciler's
adopt-vs-foreign semantics.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`DECISIONS.md`](./DECISIONS.md) - pre-seeded 2026-08-30 grilling log: ten
   ratified constraints (routing, both mail lanes, Box-as-record, auth-lane
   split, live-first sequencing, versioned provisioning code, …).
4. [`RESEARCH.md`](./RESEARCH.md) - prior art + capability inventory (stage 1, if present).
5. [`BRIEF.md`](./BRIEF.md) - shaped pitch (stage 3, if present).
6. [`MAP.md`](./MAP.md) - decomposition (stage 4, if present).

## Trail

- 2026-08-30: packet opened at `research` from a /grill-with-docs session:
  capture landed with the original scratch prompt + operator addenda,
  DECISIONS.md pre-seeded with ten ratified constraints, five research lanes
  (R1–R5) defined and launched (Grok web lanes, Sol xhigh Graph/driver lanes,
  Sol medium preflight lane).
- 2026-08-30: R2 report landed at
  `research/r2-purview-pst-import.md` (network-upload mechanics, Business-SKU
  vs bulk-import user-rights gap, 100 GB archive-import vs auto-expand doc
  conflict, `/Historical-PST` runbook). R5 already on disk; R1/R3/R4 still
  open. Stage remains `research`.
- 2026-08-30 (later): all lanes closed — R3/R4/R5 complete; the original R1
  grok lane crashed at turn 167 (stream cutoff) and was replaced by a codex
  salvage distillation over its evidence log. Live tenant probes landed
  (SKU = Business Premium + M365 Copilot ×2, Box metadata-greenfield,
  per-user staging drop invisible to Tom); the operator-run Sol Pro gap
  report arrived same day (`research/r7-sol-pro-gap-report.md`: EOP2-seat
  default for PST rights, Purview-Suite-for-BP alternative, Box watermarking
  correction, App RBAC over ApplicationAccessPolicy). RESEARCH.md distilled;
  eleven decisions pre-ratified in DECISIONS.md; stage advanced to `align`
  on a seven-item frontier. FreshBooks dev app + creds captured; Azure CLI
  access established.
