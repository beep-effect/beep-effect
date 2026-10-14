# gov-legal-data-driver-codegen — Brief

<!--
Stage 3. The shaped pitch (Shape Up anatomy). Fat-marker fidelity: concrete
enough to evaluate and decompose, rough enough to leave design latitude to
the implementing goal packets. Shaped at the 2026-06-29 grill (all 8 ALIGN
questions resolved); see DECISIONS.md for the Q1–Q8 record.
-->

## Problem

The repo carries four bare gov/legal driver skeletons — `@beep/courtlistener`,
`@beep/ecfr`, `@beep/dol`, `@beep/federal-register` — that export nothing but
`VERSION = "0.0.0"`, plus a partially-scaffolded `@beep/govinfo` (domain value
models + a `Search` HttpApi contract, but no client / auth / transport). No goal
or exploration owns their implementation. What's actually missing is not five
hand-written clients — it's the *substrate* underneath them: an OpenAPI→Effect-SDK
codegen path that emits Schema value models + operation descriptors, and one
shared auth / retry / cache / rate-limit transport they all sit on. The repo
already owns the primitives and precedents (runpod bespoke renderer, acp
`@effect/openapi-generator`, box `.d.ts` parser; native Effect v4 rate-limit /
retry / cache; two MCP servers). Port that architecture — do **not** reach for
the donor stack's Orval / axios / Zod.

## Appetite

A bounded driver-**substrate** bet, not a five-driver delivery. Prove the
substrate end-to-end on `govinfo` (keyed, the official legal-edition source) plus
one keyless driver (eCFR or FedReg). That pair exercises both client seams and
the full codegen → transport → determinism loop with the auth surface minimized.
CourtListener and DOL are explicitly **out** of this appetite — they carry the
unresolved blockers (no clean spec, disputed auth enforcement, the 2026-05-07
rate cliff, open data-terms) and come later on the proven rails. The budget buys
the rails and two reference verticals, not breadth.

## Solution sketch

Fat-marker, keyed to the resolved decisions:

- **Tiered codegen (Q1).** No single global generator. Use `@effect/openapi-generator`
  (MIT, pinned `4.0.0-beta.91`, the acp path) where a clean spec exists — GovInfo,
  and eCFR's Swagger-2.0 *behind a generator spike*. Use the runpod-style bespoke
  renderer over a checked-in spec for CourtListener / DOL (no clean OpenAPI). The
  box `.d.ts` parser is the third fallback. Never Orval / axios / Zod; never vendor
  MPL `openapi-to-effect`.
- **Hand-authored transport boundary (Q2).** Codegen emits **only** effect/Schema
  value models + operation descriptors into package-private `src/_generated/*`. All
  transport — auth, retry, cache, rate-limit, `Context.Service` — stays
  hand-authored on `effect/http`, mirroring runpod's `Runpod.generated.ts`
  vs `Runpod.service.ts` split. No first-party OpenAPI→MCP-Toolkit generator in v1.
- **One shared transformer / three auth families (Q5, Q6).** A single
  auth+retry+cache+rate-limit transformer over three auth families — CourtListener
  Token-header (`Authorization: Token <key>`), api.data.gov `api_key` query param
  (GovInfo), agency-native `X-API-KEY` (DOL) — applied via `HttpApiClient.make`'s
  `transformClient` (govinfo) and `HttpClient.mapRequest` (raw drivers), on native
  primitives (`HttpClient.withRateLimiter`, `HttpClient.retryTransient` with
  `Schedule.exponential` ⊕ jittered, `Cache.makeWith({ timeToLive })`). Secrets via
  `Config.redacted` per driver. **Incubate it inside the govinfo driver first;
  promote to `foundation/capability/<name>` only when the 2nd driver imports it**
  (README promotion record naming ≥2 consumers — the `07-non-slice-families` gate).
  No `drivers/_shared`.
- **govinfo first (Q4).** Finish `@beep/govinfo`, do **not** restart — add
  client / config / auth / retry / cache on top of the existing Search contract +
  value models, and repair the manifest (it imports `@beep/identity` / `@beep/schema`
  but declares only `effect`). Slice 2 is the keyless driver.
- **Per-package determinism (Q7).** Generate-first audit + a CI
  `git diff --exit-code` drift check; pin exact versions in each codegen template;
  per-driver raw-request escape hatch. No global `build → codegen` turbo edge in v1.

## Rabbit holes

- **eCFR Swagger-2.0 normalization spike.** `@effect/openapi-generator` *claims* to
  normalize Swagger 2.0, but the path is unproven. Run the spike and record dialect
  warnings before betting eCFR on the acp path; fall back to the bespoke renderer if
  it's lossy.
- **The MCP server (Q3).** A new `packages/drivers/gov-legal-mcp` sibling
  (`m365-mcp` / `nlp-mcp` precedent) is **deferred** to a named follow-on goal gated
  behind ≥2 proven drivers — not v1. It carries the mandatory generated-tool-name
  collision contract (driver-prefixed stable names, safe-character normalization +
  length cap, duplicate detection with a checked-in collision report, integration
  tests against the Effect MCP JSON schemas). Don't let it leak into the substrate
  slice.
- **CourtListener data-terms matrix (Q8).** A per-upstream data/source-terms matrix
  (license, ToS, commercial-use limits, caching/retention permission,
  redistribution/fixture rules, attribution, source-of-authority caveat) is a
  *required pre-shape research item* for the CourtListener / DOL slices. Default-deny
  until it exists.
- **`@effect/openapi-generator` lossy `httpclient` format (open bug #1978).** Keeps
  only the first JSON representation per status and emits streaming-only variants for
  binary success. Validate any endpoint returning both `application/problem+json` and
  `application/json` on one status — and this is *why* the bespoke renderer stays in
  the toolkit rather than betting everything on the generator.

## No-gos

- Orval / axios / Zod — port the donor *pattern*, never the runtime.
- PatentsView — any patents work is ODP-only and routes to
  `uspto-patent-driver-depth`, out of this cluster.
- A global `build → codegen` turbo edge in v1.
- Vendoring or copying MPL-2.0 `fortanix/openapi-to-effect`.
- Building a first-party OpenAPI→MCP-Toolkit generator in v1.
- Restarting `govinfo` — finish it; the Search contract + value models already exist.
- Shipping CourtListener caching or third-party-content fixtures before the
  data-terms matrix exists.
