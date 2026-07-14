# Gov/Legal Data Driver Delivery Plan

## Status

Status: `terminal-as-descoped` (P0/P1 accepted; P2–P5 won't-do until a
product feature pulls a named driver, per-driver not batch)

P6 close bookkeeping completed 2026-07-14. P1 completed
2026-07-11: `@beep/ecfr` grown to 15/15 operations (admin + search +
versioner; agencies corrected to the admin family; full-title XML as typed
raw string; `searchResultsAll` Stream helper; 6 offline tests incl.
multi-page streaming; deterministic regenerate; docgen green). P0 completed
2026-07-11: data/source-terms matrix authored (all five upstreams
ALLOW-WITH-CONDITIONS, none prohibitive; P3–P5 unlocked subject to the
recorded propagation obligations),
official FedReg spec (14 ops) + CourtListener official machine-readable
capture committed under `research/specs/`, DOL auth mechanism verified
(query-param `X-API-KEY` → `ApiKeyQueryAuth`), CL deltas recorded (no
official OpenAPI endpoint — dated D4 correction in `SPEC.md`; SCOTUS
visualizations deprecated → excluded). The empty Federal Register, DOL, and
CourtListener package scaffolds are intentional retained stubs and are not part
of this closeout's edit or deletion scope.

## Binding Sequencing

Implemented phases followed the binding order:
**schema/data-model → `Context.Service` contract → implementation → verify.**
Within a driver phase that means: committed spec + generated value models +
`.config.ts`/`.errors.ts` schemas first; then the service shape
(`<Driver>Shape` + `Context.Service` class); then live layer, auth wiring,
and Stream helpers; then offline tests + docgen. Helpers are extracted only
after schema + contract are fixed. A phase may not start until the prior
phase's exit criteria are met, and P3–P5 may not start until the
data/source-terms matrix exists (SPEC D2/Q8).

## Phases

Each phase ships as its own mergeable PR via `/yeet` (`bun run beep yeet`),
normatively bounded by `SPEC.md` decisions D1–D7 and the inherited Q2/Q5/Q7/Q8
constraints. Any product-pulled resume creates a per-driver execution slice;
the deferred phases do not remain active branches of this packet.

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 research: matrix + specs | complete (2026-07-11) | Author `research/data-source-terms-matrix.md` (Federal Register, eCFR, DOL, CourtListener, govinfo rows; D2 columns). Commit official upstream specs for federal-register and courtlistener (CL `/api/schema/`); record the DOL donor spec (MIT) as bootstrap with attribution. Verify the DOL auth mechanism (header vs query `X-API-KEY`) against developer.dol.gov and record it. Record CL deprecated-endpoint deltas (e.g. SCOTUS visualizations). Cross-link the predecessor packet (P2 superseded-by note). | Matrix committed + registered in manifest `currentSourceOfTruth[]`; specs committed with provenance rows in `research/SOURCES.md`; DOL auth fact + CL deltas recorded; predecessor cross-links landed; AC#1 gate observable. |
| P1 ecfr breadth | complete (2026-07-11) | Grow the committed `packages/drivers/ecfr/openapi.json` from today's hand-maintained 2-operation subset to the full 15-operation official surface (ecfr.gov v1 docs as authority; donor `v1-openapi3.json` as diff reference; record conversion/trim provenance in `research/SOURCES.md`), then regenerate via the existing `scripts/generate.ts` + descriptor pattern (admin corrections, search family, versioner ancestry/full/structure/versions). Full-title XML as typed raw-string payload (D7). Add Stream `*All` helpers for paginated search results (D5). | AC#2: committed spec at 15 operations + 15/15 descriptor parity; offline tests per endpoint group + multi-page search test; `bun run check --filter @beep/ecfr` green offline; codegen deterministic; docgen green. |
| P2 federal-register | complete — won't-do-until-product-pull | Resume a Federal Register-only packet from `research/specs/federal-register-openapi.json`; retain the empty package scaffold unchanged until then. | Deferred with committed official spec as the restart point. |
| P3 dol | complete — won't-do-until-product-pull | Resume a DOL-only packet from `research/data-source-terms-matrix.md` and `research/SOURCES.md`; retain the empty package scaffold unchanged until then. | Deferred with terms and auth research as the restart point. |
| P4 courtlistener core | complete — won't-do-until-product-pull | Resume a CourtListener-only packet from the committed API-root capture and `research/courtlistener-deltas.md`; retain the empty package scaffold unchanged until then. | Deferred with committed official machine-readable research as the restart point. |
| P5 courtlistener long tail | complete — won't-do-until-product-pull | Resume only after a product-pulled CourtListener core, using the API-root capture, OPTIONS ledger, and delta report. | Deferred with a per-driver, core-first restart path. |
| P6 close | complete (2026-07-14) | Record the descoped deliverable, per-driver deferrals, retained stubs, successor/predecessor links, and closeout reflection. | Packet surfaces are internally consistent and ready for the later driver-applied status flip. |

## P6 Closeout Checklist

Before marking the packet closed (and `status` → `completed-retained` /
`complete`):

1. Write a closeout reflection via the `/reflect` skill (or copy
   `_template/history/reflections/_TEMPLATE.md`) to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Critique the repo **tooling**
   (what worked, what didn't, what was frustrating, what you wished existed),
   the **implementation** (improvement opportunities), and the **goal/prompt**
   (would you revise it to be clearer/easier/more efficient?). Capture TODOs
   worth codifying. Its YAML frontmatter must validate against
   `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts` (this packet has
   `reflectionRequired: true`, so a missing/invalid reflection blocks
   closeout).
3. Update `README.md` and manifest phase records. The lifecycle/status flip is
   applied separately by the driver.
4. Confirm the predecessor packet (`goals/gov-legal-data-driver-codegen`)
   records P2 as superseded by this packet and its lifecycle is consistent.

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative; update it only when the contract changes (dated
  superseding entries in the Locked Decisions table).
- Do not resume P2–P5 without a named product pull; resume per driver from the
  committed research cited in its phase row.
- If the matrix reveals prohibitive terms for an upstream, stop that driver's
  phase and report — do not work around the terms.
- Reuse, don't rebuild: `packages/drivers/ecfr` (keyless shape + renderer),
  `packages/drivers/govinfo` (keyed config + `mapClientError` patterns),
  `@beep/api-transport` (all four `ApiAuth` branches already exist — wire
  them; extend only on P0 evidence), identity composers in
  `packages/foundation/modeling/identity/src/packages.ts`. The CI drift lane
  extends the `beep ci lane codegen` step list in
  `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts` (+ its test).
- Donor specs live at
  `/home/elpresidank/YeeBois/research/law_stuff/repos/us-legal-tools/packages/*-sdk`
  (MIT; attribution in `research/SOURCES.md`; patterns and specs only — never
  the axios/zod runtime).
- Keep this plan current; archive run outputs under `history/`.

## Verification Commands

```sh
test "$(wc -m < goals/gov-legal-data-driver-delivery/GOAL.md)" -le 4000
jq . goals/gov-legal-data-driver-delivery/ops/manifest.json
rg -n "gov-legal-data-driver-delivery|GOAL.md|agentLaunchers|packetAnchorDocument" goals/gov-legal-data-driver-delivery
git diff --check -- goals/gov-legal-data-driver-delivery
bun run beep lint reflection-artifacts
```
