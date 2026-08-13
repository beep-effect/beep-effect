# Gov/Legal Data Driver Codegen Spec

## Objective

Stand up the gov/legal driver **substrate** — not a five-driver delivery — and
prove it end-to-end on two reference verticals:

1. A **tiered OpenAPI→Effect-Schema codegen** path that emits **only**
   effect/Schema value models + operation descriptors into package-private
   `src/_generated/*`.
2. **One shared, hand-authored transport transformer** (auth + retry + cache +
   rate-limit) over three auth families, on native `effect@4.0.0-beta.91` HTTP
   primitives.
3. **`@beep/govinfo` finished** (keyed, official legal-edition source) on the
   `HttpApiClient.make` `transformClient` seam — do **not** restart it.
4. **One keyless driver** (eCFR or FedReg) built on the raw-client
   (`HttpClient.mapRequest`) path, becoming the 2nd transformer consumer.

The remaining skeleton drivers (`ecfr`, `dol`, `federal-register`,
`courtlistener`) are sequenced behind the substrate; CourtListener + DOL come
**last** on the proven rails. The result is observable when a live govinfo
`Search` round-trips through the existing value models with auth attached,
rate-limit headers honored, and a cache hit on repeat, and a keyless driver
builds network-free from its committed spec + `_generated/` artifact.

## Non-Goals

- **MCP server in v1.** The `packages/drivers/gov-legal-mcp` sibling is a named
  follow-on goal gated behind ≥2 proven drivers — not this packet.
- **CourtListener caching or third-party-content fixtures** before a per-upstream
  data/source-terms matrix exists (default-deny, Q8).
- **Orval / axios / Zod** — port the donor *pattern*, never the runtime.
- **PatentsView** — any patents work is ODP-only and routes to
  `uspto-patent-driver-depth`, out of this cluster.
- **A global `build → codegen` turbo edge** in v1.
- **Restarting `govinfo`** — finish it; the Search contract + value models exist.
- **A first-party OpenAPI→MCP-Toolkit generator** in v1.
- Vendoring or copying MPL-2.0 `fortanix/openapi-to-effect`.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards
   (`standards/architecture/07-non-slice-families.md`,
   `packages/drivers/acp/AGENTS.md` offline-build law).
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

Dated 2026-08-13: `federal-register`, `dol`, and `courtlistener` workspace
packages were deleted. Resume recreates them via
`goals/honest-repo-signal/research/FOLLOW-UPS.md`. Live trees from this list
are `packages/drivers/govinfo` and `packages/drivers/ecfr` only.

- `packages/drivers/govinfo` — finish: repair manifest (`@beep/identity` +
  `@beep/schema`), add `Govinfo.service.ts` / `Govinfo.config.ts`, incubate the
  transformer.
- `packages/drivers/ecfr` — the live keyless reference driver on the
  raw-client path. Recreate `@beep/federal-register` only if a later keyless
  sibling is pulled.
- Recreate `@beep/courtlistener` / `@beep/dol` last, gated, via FOLLOW-UPS.
- The **incubated transformer** — authored inside govinfo, promoted to
  `packages/foundation/capability/<name>` at P3.
- Per-driver `scripts/generate.ts` + committed spec + package-private
  `src/_generated/*` (with `"./_generated/*": null` export).

## Constraints

- **Offline build law.** Download is a **codegen-only** step; the committed spec +
  `_generated/` artifact make build/check **network-free** (per
  `packages/drivers/acp/AGENTS.md`). Per-driver raw-request escape hatch
  (runpod `RunpodRawRequest`) for spec drift.
- **Hand-authored transport boundary (Q2).** Codegen never emits auth, retry,
  cache, rate-limit, or `Context.Service` wiring — those stay hand-authored on
  `effect/unstable/http`, mirroring runpod's `Runpod.generated.ts` vs
  `Runpod.service.ts` split.
- **Official-publisher data sourcing (default rule); NEVER PatentsView.** The
  default is to ingest only from official US-Gov publishers: GovInfo/eCFR/FedReg
  specs are public-domain (17 U.S.C. 105 / CC0) and DOL is an agency-native
  publisher. **CourtListener is the one named exception:** it is *not* a US-Gov
  publisher and may surface PACER/RECAP-sourced third-party content (Q8), so it is
  permitted only as gated repo-original spec work behind the data/source-terms
  matrix (default-deny). "Official sources only" therefore governs *default data
  sourcing*, not an absolute ban — CourtListener/DOL have no clean OpenAPI, so any
  hand-authored spec is original repo work. PatentsView is never in scope (routes
  to `uspto-patent-driver-depth`).
- **License gravity (reimplement, don't copy).** Both donor repos are MIT but
  the constraint is architectural; AVOID vendoring MPL-2.0
  `fortanix/openapi-to-effect`. Code/spec licensing ≠ data/API-use terms — the
  latter is OPEN for CourtListener (default-deny, Q8). Once the data/source-terms
  matrix exists, its per-upstream terms (data license, API ToS, commercial-use
  limits, caching/retention permission, redistribution/fixture rules, attribution,
  source-of-authority caveat) MUST propagate to: fixture metadata, package/driver
  README warnings, cache-policy config, and any exported source/status metadata —
  never silently dropped.
- **Transformer promotion gate.** `foundation/capability/<name>` requires **≥2
  named consumers currently importing** at PR review — the
  `07-non-slice-families` rule. No `drivers/_shared` convention exists.
- **Secrets via `Config.redacted`** per driver (`GOVINFO_API_KEY`,
  `COURTLISTENER_API_TOKEN`, `DOL_API_KEY`); absent key → omit auth gracefully
  (keyless eCFR/FedReg always-on). Never log raw keys.
- **Three auth families, not two:** Token-header (`Authorization: Token <key>`,
  CourtListener — literal, not Bearer); api.data.gov `api_key` query param
  (GovInfo); agency-native `X-API-KEY` (DOL). **Only the api.data.gov `api_key`
  branch (govinfo) is exercised and verified in P0–P1**; the Token-header
  (CourtListener) and `X-API-KEY` (DOL) branches are *designed into* the
  transformer but not exercised or verified until P2 (gated on the
  data/source-terms matrix).
- **Effect v4 beta churn.** Pin exact versions (`effect` +
  `@effect/openapi-generator` at `4.0.0-beta.91`) in each codegen template.

## Acceptance Criteria

Each criterion is falsifiable and maps 1-to-1 to a row in the Verification Matrix.

- [ ] **AC#1 — govinfo live + offline-testable.** `@beep/govinfo` manifest
      declares `@beep/identity` + `@beep/schema`; a `Search` round-trip decodes
      through the value models with api.data.gov `api_key` auth attached.
      "Honored" `X-RateLimit-*` is observable: the limiter parses
      `X-RateLimit-Remaining` / `X-RateLimit-Reset` from the response and updates
      limiter state, and a repeat `Search` is served from cache (asserted by
      transport call-count == 1, **not** a second network round-trip). A
      recorded-response / fake-`HttpClient` test proves the rate-limit + cache
      behavior **without live credentials**; the live round-trip is an optional
      manual check when `GOVINFO_API_KEY` is present.
- [ ] **AC#2 — transformer seam.** The shared transformer is applied via
      `HttpApiClient.make`'s `transformClient` in govinfo and is importable by a
      2nd driver (a static import + type-check from the keyless driver proves
      importability).
- [ ] **AC#3 — keyless raw-client consumer.** One keyless driver (eCFR or FedReg)
      is built on `HttpClient.mapRequest`, consumes the transformer (the
      `mapRequest`/transformer call is present in its `*.service.ts`), and builds
      **network-free** from its committed spec + `src/_generated/*`.
- [ ] **AC#4 — eCFR spike evidence.** The eCFR `@effect/openapi-generator`
      Swagger-2.0 spike is run with recorded dialect warnings under `research/`
      or `history/`; the bespoke-renderer fallback decision is documented. This
      spike is **mandatory even if FedReg is the selected keyless driver**.
- [ ] **AC#5 — generated boundary.** Codegen output under `src/_generated/*` is
      Schema value models + operation descriptors only. Banned set (asserted by
      ripgrep over `src/_generated/*`): imports from `effect/unstable/http`,
      `Config`, `Context`, `Cache`, `Schedule`, and any `transformClient`,
      `mapRequest`, `withRateLimiter`, `retryTransient`, or auth-header symbol.
- [ ] **AC#6 — CI drift wiring.** A CI `git diff --exit-code` codegen-drift check
      is wired **per-package in committed CI config** (grep-able in the
      workflow/turbo config) — not just a local rerun.
- [ ] **AC#7 — promotion record.** At P3, the transformer is promoted to
      `foundation/capability/<name>` with a README promotion record naming ≥2
      current consumers that **actually import it** (named importers are
      grep-verifiable in source).
- [ ] **AC#8 — CL/DOL default-deny.** Until the data/source-terms matrix file
      exists, CourtListener/DOL remain default-deny, observable as: no committed
      CL/DOL fixtures, no persistent CL cache (ephemeral/in-process only), no
      enabled CL/DOL package exports, and the matrix absence visibly gating any
      build/cache work.
- [ ] **AC#9 — no churn.** Changed files are confined to the named Target
      Surfaces + the packet directory; no formatting-only or unrelated-refactor
      churn in other files (reviewed via scoped `git diff`, not just
      `git diff --check` whitespace).

## Verification Matrix

Every Acceptance Criterion (AC#1–AC#9) has a verifier row; packet-operational
checks are listed separately at the bottom.

| AC | Check | Command or evidence | Required result |
| --- | --- | --- | --- |
| AC#1 | rate-limit + cache (offline) | recorded/fake-`HttpClient` test: `X-RateLimit-*` parsed + limiter state updated, repeat `Search` cache-served (transport call-count == 1) | Passes offline |
| AC#1 | govinfo build/check | `bun run check --filter @beep/govinfo` | Passes offline |
| AC#2 | transformer seam + import | `rg -n transformClient packages/drivers/govinfo/src` + keyless driver static import type-checks | Both present |
| AC#3 | keyless raw-client + xform | `rg -n mapRequest packages/drivers/<keyless>/src` + `bun run build --filter <keyless-driver>` | Present, network-free |
| AC#4 | eCFR spike evidence | dialect-warning log + fallback decision under `research/` or `history/` | Recorded |
| AC#5 | generated boundary | ripgrep the AC#5 banned set over `packages/drivers/*/src/_generated/*` | No matches |
| AC#6 | CI drift wiring | `rg -n "git diff --exit-code" .github` (or turbo task) per keyed + keyless package | Wired in CI |
| AC#6 | codegen determinism | re-run `scripts/generate.ts` then `git diff --exit-code` | No drift |
| AC#7 | promotion record | README names ≥2 consumers; `rg` confirms both import the capability | ≥2 importers |
| AC#8 | CL/DOL default-deny | matrix file absent ⇒ no committed CL/DOL fixtures/exports, no persistent CL cache (`rg`/`ls`) | Default-deny |
| AC#9 | scoped diff | `git diff --stat` confined to Target Surfaces + packet dir; `git diff --check -- goals/gov-legal-data-driver-codegen` | In-scope, clean |
| ops | packet launcher size | `test "$(wc -m < goals/gov-legal-data-driver-codegen/GOAL.md)" -le 4000` | Passes |
| ops | manifest JSON | `jq . goals/gov-legal-data-driver-codegen/ops/manifest.json` | Passes |
| ops | reflection at P3 | `bun run beep lint reflection-artifacts` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- The implementation would exceed named scope (MCP server, CourtListener caching
  before the matrix, or a global turbo edge leaking into v1).
- The eCFR Swagger-2.0 normalization is lossy (bug #1978 `httpclient` format or
  dialect warnings) — record and fall back to the bespoke renderer, do not force
  the generator.
- CourtListener/DOL work is reached before the data/source-terms matrix exists.
- Verification requires credentials, cost, destructive side effects, or policy
  approval not named in this spec.
- The same blocker repeats after reasonable investigation.

## Decision Log (Q1–Q8, resolved 2026-06-29 grill)

Seeded from `explorations/gov-legal-data-driver-codegen/DECISIONS.md` — all eight
closed.

| Q | Decision | Resolution |
| --- | --- | --- |
| Q1 | Codegen engine | **Tiered**, not one global generator. `@effect/openapi-generator` (MIT, pinned `4.0.0-beta.91`, the acp path) where a clean spec exists (GovInfo; eCFR Swagger-2.0 **behind a generator spike**); runpod-style bespoke renderer over a checked-in spec for CourtListener/DOL; box `.d.ts` parser as 3rd fallback. NO Orval/axios/Zod; do not vendor MPL `openapi-to-effect`. |
| Q2 | Codegen boundary | Codegen emits **only** effect/Schema value models + operation descriptors into `src/_generated/*`. ALL transport (auth/retry/cache/rate-limit/`Context.Service`) stays **hand-authored** on `effect/unstable/http` (runpod `*.generated` vs `*.service` split). NO first-party OpenAPI→MCP-Toolkit generator in v1. |
| Q3 | MCP target | A new `packages/drivers/gov-legal-mcp` **sibling** (m365-mcp/nlp-mcp precedent) is **DEFERRED** to a named follow-on goal gated behind ≥2 proven drivers — NOT v1. Carries the generated-tool-name collision contract. |
| Q4 | First slice | **Finish `@beep/govinfo` first** (do not restart — Search HttpApi contract + value models exist). Slice 2 = a keyless driver (eCFR or FedReg). CourtListener + DOL **last**. |
| Q5 | Shared client | **ONE** transformer over **THREE** auth families (CourtListener Token-header; api.data.gov `api_key` query param for GovInfo; agency-native `X-API-KEY` for DOL), via `HttpApiClient.make`'s `transformClient` (govinfo) + `HttpClient.mapRequest` (raw drivers), on native primitives (`HttpClient.withRateLimiter`, `HttpClient.retryTransient` with `Schedule.exponential` ⊕ jittered, `Cache.makeWith({ timeToLive })`). Secrets via `Config.redacted` per driver. |
| Q6 | Transformer home | **Incubate** inside the govinfo driver first; **promote** to `foundation/capability/<name>` when the 2nd driver consumes it (README promotion record naming ≥2 consumers — the `07-non-slice-families` gate). No `drivers/_shared`. |
| Q7 | Determinism | Per-package generate-first audit + CI `git diff --exit-code` drift check; pin exact versions in each codegen template; per-driver raw-request escape hatch. NO global `build → codegen` turbo edge in v1. |
| Q8 | Data-terms | **DEFAULT-DENY.** CourtListener caching in-process/ephemeral-only + third-party legal content excluded from committed fixtures until a per-upstream data/source-terms matrix exists (a required pre-shape research item). FedReg outputs preserve source/status metadata + reconcile to GovInfo. |

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |

_Codex gate-2 folded 2026-06-29: 3 blocking + 4 advisory addressed._
