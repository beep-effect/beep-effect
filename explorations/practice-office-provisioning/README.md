# Practice Office Provisioning

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `shape`
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

Review [`BRIEF.md`](./BRIEF.md) with the operator until it matches the
picture in his head, then decompose. The align frontier is fully resolved
(see the align entries in `DECISIONS.md`); what remains open are
verification tasks carried in `ops/manifest.json` `openQuestions` (CSP
quote + license dry-run, Box quote items, CCG platform-app approval on
Business, FreshBooks live limits, the Purview >100 GB support case).

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`DECISIONS.md`](./DECISIONS.md) - the 2026-08-30 decision log: the
   pre-seeded grilling constraints plus the align-round resolutions
   (routing, both mail lanes, Box-as-record, auth-lane split, live-first
   sequencing, versioned provisioning code, EOP2 import rights,
   service-account tree ownership, Box-only documents, Effect-native
   reconciler, …). The log itself is the count of record.
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
- 2026-08-30 (post-merge follow-up): PR #904 merged; align rounds resolved
  the entire frontier (EOP2 import rights, Box-Business-with-visible-blocks,
  service-account tree ownership, M365 doc lane dropped, contacts shape,
  FreshBooks driver goal, walkthrough outline) plus the reconciler-shape
  ratification (Effect-native). PR #904 review findings triaged: ten fixes
  landed (count reconciliation, r2 AzCopy `--recursive` correction, r4
  certificate-first credential correction, lane-citation registry, R6
  reference cleanup, @beep/box brick honesty); the "r7 missing" finding was
  invalid. HubSpot portal facts captured. Stage advanced to `shape`;
  BRIEF.md drafted for operator review.
