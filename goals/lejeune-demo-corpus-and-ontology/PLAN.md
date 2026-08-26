# LeJeune Demo Corpus and Ontology Plan

## Status

Status: `pending`

Start only on Benjamin's signal. This packet owns the day 1-3 data outcomes and provides
`lejeune/demo-corpus-and-ontology` to the lab packet.

## Phases

Phase ids and titles match `ops/manifest.json`.

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Fixture and ontology freeze proof | pending | Freeze the two RFQ pairs, 12 classes, three cited rules, golden expectations, and data boundary. | Fixture manifest, source hashes, exact expected spans, missing fields, synthetic labels, and rule citations are reviewed; one live provider path is proven or a same-day fallback is selected. |
| P1 Bundle build (parse -> spans -> projections) | pending | Build the immutable replay bundle and deterministic PGlite, DuckDB, and bounded Oxigraph projections. | Both layouts extract exact spans; projection rebuild returns committed results; raw corpus payloads remain machine-local. |
| P2 Rule checks, citations, and replay recording | pending | Prove the three rule checks and capture the provider outputs required for offline replay. | Positive and refusal fixtures pass; every result opens evidence; network-off replay matches the golden bundle. |
| P3 Close | pending | Complete repository proof, PR delivery, reflection, and packet state flip. | Completion gate is met; evidence and 2026-09-30 disposition are recorded; reflection validates; packet is `completed-retained`. |

## Five-Day Walking-Skeleton Schedule

The split is ratified in the exploration
[`MAP.md`](../../explorations/lejeune-bolt-agentic-demo/MAP.md#five-day-schedule). The lab packet
owns the screen from day 1; this packet owns data outcomes through day 3.

| Day | This packet owns | Handoff to the lab |
| --- | --- | --- |
| 1 | Freeze fixture manifest, ontology, cited rules, bundle skeleton, and live provider path. | Stable stub contract and identifiers for the screen scaffold. |
| 2 | Implement parsers, expected spans, normalized records, replay envelope, and projection interfaces. | Complete fixture-shaped stub payload for the clickable 30-minute story. |
| 3 | Swap in real extraction for both layouts, rule results, citations, uncertainty, and deterministic projections. | Versioned bundle capability replacing the UI stubs. |
| 4 | Support the lab's veteran correction, synthetic offer, quote, and receipt integration without adding data scope. | Stable bundle queries and replay data. |
| 5 | Freeze bundle metadata and support the recorded offline rehearsal; no new corpus feature. | Immutable rehearsal input and disposition metadata. |

## P0 Fixture and Ontology Freeze Proof

1. Confirm the proposed `lejeune-bolt-workbench` lab (under `apps/labs/`) is the only package
   target. Coordinate its one-time generator creation with the lab packet; never hand-mint or
   create a sibling data package.
2. Define a fixture manifest for the Outlook-table/XLSX and prose-email/PDF pairs, including
   source identities, hashes, split facts, one or more missing fields, and expected exact spans.
3. Define the 12 schema-first domain classes and only the relations needed by the fixed story.
4. Record the matched-assembly, DTI-strength, and A490-HDG rule sources and expected positive,
   mismatch, and refusal cases.
5. Seed timestamped supplier offers and certificates with structural `SYNTHETIC` labels.
6. Make one live `@beep/anthropic` extraction over public or synthetic data. If it fails, prove
   `openai-compat`, `venice-ai`, or `xai` that day and record the outcome without secrets.

## P1 Bundle Build: Parse → Spans → Projections

1. Parse the supported email bodies, XLSX takeoff, and text-layer PDF schedule.
2. Decode structured extraction and align every source-backed value through
   `@beep/langextract`; a missing value stays missing.
3. Persist application and review state in PGlite and the corpus/full-text projection in
   DuckDB, following the practice-KG projection pattern.
4. Build a bounded RDF projection in in-memory Oxigraph for the committed queries and
   validation. Treat it as derived, not durable state.
5. Rebuild all projections from the normalized fixture stream and compare stable query results
   and bundle metadata.

## P2 Rule Checks, Citations, and Replay Recording

1. Run each fixed rule against its positive and mismatch or refusal fixtures.
2. Persist source, revision or access date, matched facts, exact span, disposition,
   uncertainty, and stop point with each result.
3. Record successful provider responses needed by the golden run without credentials or
   prohibited payloads.
4. Disable provider and network access, replay the complete bundle, and compare normalized
   records, rule results, citations, queries, and bundle identity.
5. Hand the versioned capability to the lab packet for days 3-5 integration.

## Closeout Checklist

Before marking the packet closed:

1. Confirm every `SPEC.md` acceptance criterion and the manifest capability edge.
2. Archive fixture, extraction, projection, rule, provider-smoke, and replay evidence under
   `history/`.
3. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` and run the reflection-artifact lint.
4. Drive the implementation PR to `merge-ready: yes` through `/yeet`.
5. Update `README.md`, this plan, and `ops/manifest.json` in the closeout PR.

## Execution Notes

- Preserve unrelated worktree changes and attribute failures before repairing.
- Design schema → service contract → Layer; decode every external boundary.
- Keep immutable replay content separate from mutable approvals and claims.
- A live provider result is day-1 proof, not the lunch runtime.
- Record any friction immediately in the active packet's opportunities ledger, sanitized for
  this public repository.

## Verification Commands

```sh
test "$(wc -m < goals/lejeune-demo-corpus-and-ontology/GOAL.md)" -le 4000
jq . goals/lejeune-demo-corpus-and-ontology/ops/manifest.json
rg -n "lejeune-demo-corpus-and-ontology|GOAL.md|agentLaunchers|packetAnchorDocument" goals/lejeune-demo-corpus-and-ontology
git diff --check -- goals/lejeune-demo-corpus-and-ontology
bun run beep goals index --check
bun run beep goals doctor
bun run beep lint reflection-artifacts
bun run beep yeet verify
```
