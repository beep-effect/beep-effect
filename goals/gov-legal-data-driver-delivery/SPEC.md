# Gov/Legal Data Driver Delivery Spec

## Objective

Finish the four gov/legal data drivers on the rails proven by
`goals/gov-legal-data-driver-codegen` (the substrate packet):

1. **`@beep/ecfr`** grown from 2 operations to the full 15-operation official
   surface (admin, search, versioner) — including growing the committed
   `openapi.json`, today a hand-maintained 2-operation subset, to cover all
   15.
2. **`@beep/federal-register`** built skeleton→finished keyless driver (14
   operations) in the exact ecfr shape.
3. **`@beep/dol`** built skeleton→finished keyed driver (6 operations,
   `X-API-KEY` family) — **gated** on the data/source-terms matrix.
4. **`@beep/courtlistener`** built skeleton→finished keyed driver at **full
   parity with the current official CourtListener v4 OpenAPI schema**
   (donor baseline: 53 operations) — **gated** on the data/source-terms
   matrix.

The result is observable when each driver builds and checks **network-free**
from its committed spec + `src/_generated/*`, its operation-descriptor count
matches the committed spec, offline fake-`HttpClient` tests exercise every
endpoint group plus the driver's auth family, and Stream-based pagination
helpers walk each API's scheme (page/per_page, limit/offset+tail-metadata,
cursor) without live credentials.

The packet's P0 also delivers the **per-upstream data/source-terms matrix**
that unlocks the gated drivers (predecessor Q8 default-deny).

## Non-Goals

- **`gov-legal-mcp` sibling server** — named follow-on goal (predecessor Q3),
  not this packet.
- **PatentsView / patents work** — routes to `uspto-patent-driver-depth`.
- **XML/CSV payload parsing** — eCFR full-title XML and DOL xml/csv responses
  ship as typed raw-string payloads in v1; structured parsing is a follow-on.
- **Browser-safe `/browser` entrypoints** — no current client consumer.
- **Restarting `@beep/govinfo` or `@beep/api-transport`** — no rewrites;
  the needed `ApiAuth` branches already exist and only get wired/exercised.
- **A generic cross-driver pagination abstraction in v1** — helpers stay
  driver-local until a common shape emerges across ≥2 drivers (D5).

## Source Hierarchy

1. User objective that created this packet (finish the four drivers).
2. `AGENTS.md`, `CLAUDE.md`, and required skills
   (`/effect-first-development`, `/schema-first-development`,
   `/jsdoc-annotation-specialist` rubric).
3. Governing architecture/package standards:
   `standards/architecture/03-driver-boundaries.md`,
   `standards/architecture/07-non-slice-families.md`,
   `standards/architecture/09-errors-across-boundaries.md`,
   `packages/drivers/acp/AGENTS.md` (offline-build law).
4. This `SPEC.md` (including inherited predecessor decisions below).
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/drivers/ecfr` — endpoint breadth (2→15) + Stream helpers.
- `packages/drivers/federal-register` — full keyless driver.
- `packages/drivers/dol` — full keyed driver (gated).
- `packages/drivers/courtlistener` — full keyed driver (gated).
- `packages/foundation/capability/api-transport` — wire and exercise the
  existing, currently-unexercised `TokenHeaderAuth` and
  `ApiKeyHeaderAuth`/`ApiKeyQueryAuth` branches of `ApiAuth` (implemented in
  predecessor Q5); extend the union only if the P0-verified DOL mechanism
  requires a shape none of the four existing branches covers.
- CI codegen-drift lane — extend the `beep ci lane codegen` step list in
  `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts` (+ its test
  `packages/tooling/tool/cli/test/ci-lane.test.ts`) to cover the three new
  generating packages; `.github/workflows/check.yml` only dispatches this
  lane.
- This packet directory; cross-link edits in
  `goals/gov-legal-data-driver-codegen` (PLAN/README/manifest supersession
  notes only).

## Locked Decisions

Resolved in the 2026-07-11 grilled design session (provenance:
`ops/manifest.json`). D-numbers are this packet's; Q-numbers refer to the
predecessor's SPEC Decision Log, which stays binding except where a dated
entry below supersedes it.

| # | Decision |
| --- | --- |
| D1 | **Delivery packet shape.** This packet is the delivery follow-on to `gov-legal-data-driver-codegen`; the predecessor closes as substrate-complete and its P2 (authed drivers) is superseded by this packet's P3–P5. Manifest `dependencies` names the predecessor. |
| D2 | **Data/source-terms matrix = P0 deliverable.** Authored at `research/data-source-terms-matrix.md` with one row per upstream (Federal Register, eCFR, DOL, CourtListener, govinfo) covering: data license, API ToS, commercial-use limits, caching/retention permission, redistribution/fixture rules, attribution, source-of-authority caveat. DOL (P3) and CourtListener (P4–P5) remain default-deny until it exists. Operative terms MUST propagate into per-driver READMEs, fixture metadata, and cache-policy config — never silently dropped (inherits Q8). |
| D3 | **Coverage = full upstream parity.** federal-register 14, ecfr 15, dol 6, courtlistener **full parity with the current official v4 OpenAPI schema** (donor baseline 53 operations). Caveat: endpoints the upstream marks deprecated (e.g. SCOTUS visualizations, per predecessor research caution) are excluded with a recorded delta in `research/`, not generated. |
| D4 | **Codegen = per-driver bespoke renderer over committed specs.** Copy/adapt ecfr's `scripts/generate.ts` per driver (package-local, runpod-style; no shared renderer package). Commit official upstream specs where published (FedReg developer API, CourtListener `/api/schema/`); the donor's MIT specs are bootstrap/diff references (DOL) with provenance in `research/SOURCES.md`. Output is `$I`-annotated effect/Schema value models + operation descriptors into `src/_generated/*` only; raw `HttpClient.mapRequest` path for all four. **Supersedes the predecessor Q1 assumption** that CourtListener/DOL have no usable OpenAPI (dated 2026-07-11): working specs exist (donor MIT commits + CL's official schema endpoint); the tiered-renderer decision itself stands, with the bespoke renderer as the chosen tier for all four. |
| D5 | **Pagination = per-driver Stream helpers.** Each driver exposes Stream-based `*All` helpers (`Stream.paginateChunkEffect`) beside raw typed calls: cursor walking (CL), limit/offset with array-tail metadata (DOL), page/per_page (FedReg, eCFR search). Driver-local; promote a common shape into `@beep/api-transport` only when it demonstrably emerges across ≥2 drivers (incubate→promote, per `07-non-slice-families`). |
| D6 | **Phase order** (consistency-derived): P0 matrix+specs → P1 ecfr breadth → P2 federal-register → P3 dol → P4 CL core → P5 CL long tail → P6 close. DOL/CL last (inherits Q4 ordering); CL split into two PRs for reviewability. Each phase is its own mergeable PR via `/yeet`. |
| D7 | **Non-goals** (consistency-derived): `gov-legal-mcp`, PatentsView, XML/CSV parsing, `/browser` entrypoints — see Non-Goals above. |

**Inherited, still binding (predecessor SPEC):**

- **Q2 generated boundary** — codegen never emits transport: no
  `effect/unstable/http`, `Config`, `Context`, `Cache`, `Schedule`,
  `transformClient`, `mapRequest`, `withRateLimiter`, `retryTransient`, or
  auth-header symbols under `src/_generated/*` (ripgrep-verified).
- **Q5 auth families** — CourtListener `Authorization: Token <key>` (literal
  Token, DRF-style, not Bearer); DOL `X-API-KEY` (**mechanism — header vs
  query param — is contradicted across predecessor SPEC vs research; P0
  verifies against developer.dol.gov and records the fact**); secrets via
  `Config.redacted` (`COURTLISTENER_API_TOKEN`, `DOL_API_KEY`), modeled as
  redacted Options with govinfo's graceful-omission pattern; never log keys.
- **Q7 offline build law + determinism** — download is codegen-only;
  committed spec + `src/_generated/*` keep build/check network-free;
  per-driver `scripts/generate.ts`; regenerate is byte-deterministic; CI
  `git diff --exit-code` drift check per generating package.
- **Q8 data-terms propagation** — CL caching in-process/ephemeral only; no
  committed fixtures containing real third-party (PACER/RECAP) content —
  test fixtures for CL are synthetic; FedReg outputs preserve source/status
  metadata and reconcile to GovInfo (FedReg is the "unofficial prototype";
  GovInfo is official).

## Constraints

- **Binding sequencing (no exceptions).** Within every phase:
  schema/data-model → `Context.Service` contract → implementation → verify.
  Role-file order: `.config.ts`/`.errors.ts`/`_generated` schemas →
  service shape/contract → live layer + helpers → tests. Helpers are
  extracted only after schema + contract are fixed.
- **Skills are law.** `/effect-first-development` and
  `/schema-first-development` govern all code; typed errors are
  `TaggedErrorClass` with `LiteralKit` reason domains; match helpers over
  conditional chains; effect helper modules over native.
- **Annotation rubric.** Every exported symbol: `@since`, `@category`, and a
  runnable `@example` importing from the public `@beep/<driver>` path;
  `$I.annote`/`$I.annoteSchema` identity annotations throughout (including
  generated output); docgen proof green per package.
- **Driver doctrine.** No product vocabulary; no slice imports; technical
  config only in `.config.ts`; driver errors die at server adapters
  (`03-driver-boundaries.md`, `09-errors-across-boundaries.md`).
- **Exemplar conformance.** New drivers mirror the ecfr package shape:
  deps (`@beep/api-transport`, `@beep/identity`, `@beep/schema`,
  `@beep/utils`, `effect`; dev `@beep/test-utils`), tsconfig `references`,
  `"./_generated/*": null` + `"./internal/*": null` exports, `generate` +
  `codegen` scripts, `Context.Service` with `static makeLayer(config)` +
  `static layer` (provides `FetchHttpClient.layer` +
  `RateLimiter.layerStoreMemory`), existing identity composers
  (`$FederalRegisterId`, `$DolId`, `$EcfrId`, `$CourtlistenerId`).
- **Testing.** Offline fake-`HttpClient` (`Context.Service` test double with
  request capture) + FastCheck property round-trips via `S.toArbitrary` +
  `fcRuns`; auth-family branches asserted offline (header/param presence,
  no secret leakage); live round-trips are optional manual checks when keys
  are present, never required verification.
- **Donor discipline.** `us-legal-tools` is MIT: port patterns and specs
  with attribution in `research/SOURCES.md`; never port the
  Orval/axios/zod runtime. AGPL upstreams (courtlistener, mike) remain
  clean-room pattern references only.
- **Changesets.** Every phase branch carries its own committed non-empty
  changeset listing the changed packages.
- **Scoped diffs.** Changed files confined to Target Surfaces + this packet
  (+ the named predecessor cross-links); no formatting-only churn.

## Acceptance Criteria

Each criterion is falsifiable and maps to a Verification Matrix row.

- [ ] **AC#1 — matrix exists and gates.** `research/data-source-terms-matrix.md`
      exists with all five upstream rows and the D2 columns, is registered in
      manifest `currentSourceOfTruth[]`, and P3–P5 work is observably absent
      until it lands (no CL/DOL deps, exports, fixtures, or generated code).
- [ ] **AC#2 — ecfr parity.** The committed `@beep/ecfr` spec is grown from
      today's 2-operation subset to the full 15-operation official surface,
      operation descriptors match it; offline tests cover every endpoint
      group; `bun run check --filter @beep/ecfr` green offline.
- [ ] **AC#3 — federal-register finished.** 14 operations generated from a
      committed official spec; keyless (`ApiAuth.NoAuth`); ecfr-shape
      conformant; builds network-free; source/status metadata preserved on
      document models.
- [ ] **AC#4 — dol finished (gated).** 6 operations; verified auth mechanism
      recorded in P0 and exercised offline via its `ApiAuth` branch;
      `filter_object` DSL modeled as tagged-union schemas; limit/offset +
      tail-metadata pagination helper tested offline.
- [ ] **AC#5 — courtlistener finished (gated).** Full parity with the
      committed official v4 schema (deprecated-endpoint deltas recorded);
      literal `Authorization: Token` auth branch exercised offline; cursor
      Stream helper tested offline; fixtures synthetic-only; cache
      in-process/ephemeral only.
- [ ] **AC#6 — pagination helpers.** Each driver exposes Stream-based `*All`
      helpers for its list endpoints, each with an offline multi-page test
      (fake client returns successive pages/cursors).
- [ ] **AC#7 — generated boundary.** The Q2 ripgrep ban-set finds no matches
      under any `packages/drivers/{ecfr,federal-register,dol,courtlistener}/src/_generated/*`.
- [ ] **AC#8 — determinism + CI drift.** Re-running each driver's
      `generate` produces no diff; the `beep ci lane codegen` step list
      (`packages/tooling/tool/cli/src/commands/Ci/CiLane.ts`, dispatched by
      `.github/workflows/check.yml`) covers all four generating packages.
- [ ] **AC#9 — annotation/docgen.** Docgen proof green for all four packages;
      exported symbols meet the annotation rubric.
- [ ] **AC#10 — no churn.** Scoped `git diff --stat` per phase confined to
      Target Surfaces + packet dir.

## Verification Matrix

| AC | Check | Command or evidence | Required result |
| --- | --- | --- | --- |
| AC#1 | matrix present + registered | `test -f goals/gov-legal-data-driver-delivery/research/data-source-terms-matrix.md` + `jq '.currentSourceOfTruth' ops/manifest.json` | Exists, registered |
| AC#1 | gate observable | before matrix: `rg -l -e COURTLISTENER_API_TOKEN -e DOL_API_KEY packages/drivers/{dol,courtlistener}/src` | No matches pre-matrix |
| AC#2 | ecfr parity | descriptor count in `packages/drivers/ecfr/src/_generated` vs committed spec paths; `bun run check --filter @beep/ecfr` | 15/15, green offline |
| AC#3 | fedreg parity + shape | descriptor count vs spec; `bun run check --filter @beep/federal-register`; `rg -n "ApiAuth.NoAuth" packages/drivers/federal-register/src` | 14/14, green, keyless |
| AC#4 | dol parity + auth | descriptor count vs spec; offline auth-branch test asserts verified mechanism; `bun run check --filter @beep/dol` | 6/6, green |
| AC#5 | CL parity + policy | descriptor count vs committed official schema + recorded deltas; `rg -n "Token " packages/drivers/courtlistener/src`; fixture audit (synthetic only) | Parity, literal Token, clean |
| AC#6 | Stream helpers | `rg -n -e paginateChunkEffect -e "Stream\." packages/drivers/{ecfr,federal-register,dol,courtlistener}/src` + multi-page offline tests | Present + tested |
| AC#7 | generated boundary | ripgrep Q2 ban-set over the four `src/_generated/*` | No matches |
| AC#8 | determinism + CI | per-driver `bun run generate` then `git diff --exit-code`; `rg -n "exit-code" packages/tooling/tool/cli/src/commands/Ci/CiLane.ts` lists all four driver paths; `bun run beep ci lane codegen` exits 0 | No drift; lane covers all four |
| AC#9 | docgen | `bun run docgen:local` (edit loops) / package docgen proof | Green |
| AC#10 | scoped diff | `git diff --stat` per phase branch | In-scope only |
| ops | launcher size | `test "$(wc -m < goals/gov-legal-data-driver-delivery/GOAL.md)" -le 4000` | Passes |
| ops | manifest JSON | `jq . goals/gov-legal-data-driver-delivery/ops/manifest.json` | Passes |
| ops | whitespace | `git diff --check -- goals/gov-legal-data-driver-delivery` | Passes |
| ops | reflection at P6 | `bun run beep lint reflection-artifacts` | Passes |

## Stop Conditions

- The data/source-terms matrix reveals prohibitive terms for an upstream:
  record the finding, halt that driver's phase, and report — do not work
  around the terms.
- P3/P4/P5 work is reached before the matrix exists (Q8 default-deny).
- A committed spec drifts beyond what the bespoke renderer can express:
  record the delta and the fallback decision under `research/` before
  extending the renderer.
- Verification would require live credentials, cost, destructive side
  effects, or policy approval not named in this spec.
- Required source files are missing or materially contradictory.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
