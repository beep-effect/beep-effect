# Practice Office Provisioning

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `graduate`
Status: `graduated`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Tom's solo IP practice needs its office estate provisioned production-grade:
historical emails searchable in Outlook, Box as the document system of record
with client/matter organization and versioning, contacts created from
extracted client entities, and walkthrough artifacts teaching the process.
The corpus chain restores the past; this packet gives the practice a present.

## Next Open Question

None — the packet graduated 2026-08-30. Four promised-now goals own the
work (`goals/practice-box-provisioning`, `goals/practice-m365-contacts`,
`goals/practice-mail-backfill`, `goals/freshbooks-driver`); the five VERIFY
items carry into their P0 phases. Two gated candidates remain as re-entry
points in [`MAP.md`](./MAP.md) (`practice-sign-invoice-flow`,
`practice-walkthroughs`) — a fired gate reopens this packet at `decompose`.

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
5. [`BRIEF.md`](./BRIEF.md) - shaped pitch (stage 3).
6. [`MAP.md`](./MAP.md) - decomposition: promised-now goals, gated
   re-entries, sequencing, first vertical slice, inherited risks (stage 4).

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
- 2026-08-30 (PR #909 closeout): #909 merged with all required checks green;
  its ten review threads triaged and fixed — appetite carve-outs named in
  the no-gos (PST import + contact-CSV seeding), Box driver managers scoped
  to the stay-on-Business posture, the write-verbs goal cut to
  contacts-only (no approved Graph mail-write lane), Box Sign
  attorney-context and external-collaborator economics added to decisions,
  FreshBooks invoice-endpoint validation gate + single-use refresh-token
  rotation added, r2 AzCopy command carries `--recursive=true`, citation
  registry count clarified. The yeet-inbox hook fences were narrowed on
  main mid-session (PR #912) after three regression classes hit this
  session.
- 2026-08-30 (graduation): operator confirmed the BRIEF and green-lit
  execution; `MAP.md` landed (four promised-now goals, two gated
  re-entries, sequencing, first vertical slice). Scaffolded
  `goals/practice-box-provisioning`, `goals/practice-m365-contacts`,
  `goals/practice-mail-backfill`, and `goals/freshbooks-driver`, each
  carrying the exploration's source ledger and back-linked decisions.
  Status flipped to `graduated`; the five VERIFY items moved into the
  owning goals' P0 phases.
