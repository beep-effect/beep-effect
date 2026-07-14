# Gov/Legal Data Driver Codegen

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

Graduated from [`explorations/gov-legal-data-driver-codegen`](../../explorations/gov-legal-data-driver-codegen)
on 2026-06-29 (all 8 ALIGN questions resolved; see `SPEC.md` Decision Log).

## Mission

Stand up the gov/legal driver **substrate** — a tiered OpenAPI→Effect-Schema
codegen path plus one shared hand-authored auth/retry/cache/rate-limit transport
transformer — and prove it on two reference verticals: finish `@beep/govinfo`
(keyed) and build one keyless driver (eCFR or FedReg). CourtListener and DOL come
last, on the proven rails.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/gov-legal-data-driver-codegen/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth (incl. the Q1–Q8 Decision Log).
3. [`PLAN.md`](./PLAN.md) - terminal execution record (P0–P3).
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/`](./research/) - back-links to the source exploration's research.
6. [`history/`](./history/) - evidence and closeouts, if present.

## Source material

This goal graduated from
[`explorations/gov-legal-data-driver-codegen`](../../explorations/gov-legal-data-driver-codegen)
— that exploration's `RESEARCH.md` / `DECISIONS.md` / `research/*.md` remain the
primary research ledger. The mined gold nuggets (upstream repo + `file:line`),
upstream licenses + port discipline, external citations, and the `@beep/*` bricks
this packet composes are joined in
[`research/SOURCES.md`](./research/SOURCES.md). Read it before porting any
upstream pattern — licenses are load-bearing (AGPL = clean-room reimplement;
unknown-license = reimplement-don't-copy).

## Current Phase

**Terminal: substrate delivered (P0 + P1 + P3 complete); P2 superseded.** As of
2026-07-14, P2 delivery scope is owned by
[`goals/gov-legal-data-driver-delivery`](../gov-legal-data-driver-delivery),
which retains the completed data/source-terms matrix and per-driver restart
points. No implementation or close bookkeeping remains in this packet.

## Latest Evidence

2026-06-30 (claude, Opus 4.8):

- **P0** — `@beep/govinfo` finished: manifest declares `@beep/identity` +
  `@beep/schema` (+ `@beep/utils`); hand-authored `Govinfo.config`/`errors`/`service`
  on the existing `Search` contract + value models; shared transformer applied via
  `HttpApiClient.make`'s `transformClient`; api.data.gov `api_key` query-param auth
  via `Config.redacted`. Offline test proves `X-RateLimit-*` parse + observable
  snapshot + cache-hit-on-repeat (transport call-count == 1) + keyless-safe, no live
  creds. `check`/`lint`/`test` green.
- **P1** — keyless `@beep/ecfr` driver built on `HttpClient.mapRequest` (2nd
  transformer consumer); committed Swagger-2.0 `openapi.json` + bespoke
  `scripts/generate.ts` + package-private `src/_generated/*`; builds network-free.
  eCFR `@effect/openapi-generator` Swagger-2.0 spike recorded with dialect warnings
  + bespoke-renderer fallback decision in
  [`research/2026-06-30-ecfr-generator-spike.md`](./research/2026-06-30-ecfr-generator-spike.md).
- **P3** — codegen-drift lane wired in committed CI (`.github/workflows/check.yml`,
  `git diff --exit-code`); codegen regenerate is byte-deterministic; the transformer
  promoted to `@beep/api-transport` (`packages/foundation/capability/api-transport`)
  with a README ≥2-consumer record (`@beep/govinfo` + `@beep/ecfr`, both
  grep-verified). Closeout reflection at
  [`history/reflections/2026-06-30-claude.md`](./history/reflections/2026-06-30-claude.md);
  `bun run beep lint reflection-artifacts` passes.

## Notes

- Do **not** restart `govinfo` — finish it (Q4).
- The shared transformer **incubates inside govinfo** and only promotes to
  `foundation/capability/<name>` once a 2nd driver imports it (Q6; the
  `07-non-slice-families` ≥2-consumer gate).
- P2 is superseded into the delivery packet; its completed matrix and deferred
  per-driver restart points preserve the Q8 default-deny decision.
- The `gov-legal-mcp` sibling server is a deferred follow-on goal, not v1 (Q3).
