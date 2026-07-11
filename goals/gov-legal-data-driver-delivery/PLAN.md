# Gov/Legal Data Driver Delivery Plan

## Status

Status: `in-progress`

Current phase: **P1** — ecfr breadth (2→15 operations). P0 completed
2026-07-11: data/source-terms matrix authored (all five upstreams
ALLOW-WITH-CONDITIONS, none prohibitive; P3–P5 unlocked subject to the
recorded propagation obligations),
official FedReg spec (14 ops) + CourtListener official machine-readable
capture committed under `research/specs/`, DOL auth mechanism verified
(query-param `X-API-KEY` → `ApiKeyQueryAuth`), CL deltas recorded (no
official OpenAPI endpoint — dated D4 correction in `SPEC.md`; SCOTUS
visualizations deprecated → excluded).

## Binding Sequencing

Every phase follows the binding order:
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
constraints. Every phase branch carries its own committed changeset.

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 research: matrix + specs | complete (2026-07-11) | Author `research/data-source-terms-matrix.md` (Federal Register, eCFR, DOL, CourtListener, govinfo rows; D2 columns). Commit official upstream specs for federal-register and courtlistener (CL `/api/schema/`); record the DOL donor spec (MIT) as bootstrap with attribution. Verify the DOL auth mechanism (header vs query `X-API-KEY`) against developer.dol.gov and record it. Record CL deprecated-endpoint deltas (e.g. SCOTUS visualizations). Cross-link the predecessor packet (P2 superseded-by note). | Matrix committed + registered in manifest `currentSourceOfTruth[]`; specs committed with provenance rows in `research/SOURCES.md`; DOL auth fact + CL deltas recorded; predecessor cross-links landed; AC#1 gate observable. |
| P1 ecfr breadth | pending | Grow the committed `packages/drivers/ecfr/openapi.json` from today's hand-maintained 2-operation subset to the full 15-operation official surface (ecfr.gov v1 docs as authority; donor `v1-openapi3.json` as diff reference; record conversion/trim provenance in `research/SOURCES.md`), then regenerate via the existing `scripts/generate.ts` + descriptor pattern (admin corrections, search family, versioner ancestry/full/structure/versions). Full-title XML as typed raw-string payload (D7). Add Stream `*All` helpers for paginated search results (D5). | AC#2: committed spec at 15 operations + 15/15 descriptor parity; offline tests per endpoint group + multi-page search test; `bun run check --filter @beep/ecfr` green offline; codegen deterministic; docgen green. |
| P2 federal-register | pending | Build `@beep/federal-register` skeleton→finished keyless driver in the exact ecfr shape: deps + tsconfig refs, committed official spec + adapted `scripts/generate.ts` → `src/_generated/*`, `FederalRegister.config.ts`/`.errors.ts`/`.service.ts`, `ApiAuth.NoAuth`, 14 operations, page/per_page Stream helpers, source/status metadata preserved (Q8: FedReg is unofficial-prototype; reconcile to GovInfo). Agency-slug domain (LiteralKit vs branded string) decided in-phase against the ~470-slug enum. | AC#3: 14/14 parity; network-free build/check; offline tests incl. multi-page; CI drift lane extended; changeset; docgen green. |
| P3 dol (GATED on matrix) | pending | Build `@beep/dol`: 6 operations from the committed spec; wire the existing `ApiAuth` branch matching the P0-verified mechanism (`ApiKeyHeaderAuth` header vs `ApiKeyQueryAuth` query — both already implemented in `@beep/api-transport`); `Config.redacted("DOL_API_KEY")` with graceful-omission Option pattern; `filter_object` DSL as tagged-union schemas; limit/offset + array-tail-metadata pagination Stream helper; xml/csv operations as typed raw-string payloads. | Matrix row cleared; AC#4: 6/6 parity; auth branch exercised offline (header/param presence, no secret leakage); DSL schemas round-trip under FastCheck; check green offline; docgen green. |
| P4 courtlistener core (GATED on matrix) | pending | Build `@beep/courtlistener` core: wire the existing `TokenHeaderAuth` branch (literal `Authorization: Token`, `Config.redacted("COURTLISTENER_API_TOKEN")`); committed official v4 schema + adapted renderer; core resources — search, citation-lookup (POST), opinions, clusters, dockets, courts, people + positions; cursor Stream helper; `RateLimitError`/`wait_until` modeled; synthetic-only fixtures; in-process/ephemeral cache only. | Matrix row cleared; core descriptor parity; Token branch exercised offline (literal `Token`, not Bearer); cursor multi-page test; fixture audit clean; check green offline. |
| P5 courtlistener long tail | pending | Extend to full parity with the committed official schema: financial-disclosure family, RECAP family, alerts/docket-alerts, audio, remaining people/judge resources, processing-queue, etc. Deprecated endpoints excluded per recorded P0 deltas. | AC#5: full parity minus recorded deltas; AC#6/AC#7/AC#8 across all four drivers; check green offline; docgen green. |
| P6 close | pending | Write closeout reflection via `/reflect`; update statuses; mark the predecessor packet's P2 superseded-closed and its initiative status consistent with D1. | AC#9/AC#10 confirmed; `bun run beep lint reflection-artifacts` green; both packets' README + manifest statuses consistent. |

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
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status`.
4. Confirm the predecessor packet (`goals/gov-legal-data-driver-codegen`)
   records P2 as superseded by this packet and its lifecycle is consistent.

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative; update it only when the contract changes (dated
  superseding entries in the Locked Decisions table).
- Do NOT start P3/P4/P5 before the data/source-terms matrix exists (D2/Q8).
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
