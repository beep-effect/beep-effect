# FreshBooks Driver — Sources & Provenance

- **Source exploration:** `explorations/practice-office-provisioning` —
  primary ledger:
  [`explorations/practice-office-provisioning/research/SOURCES.md`](../../../explorations/practice-office-provisioning/research/SOURCES.md)
  (per-lane URL registry in
  [`SOURCES-lane-citations.md`](../../../explorations/practice-office-provisioning/research/SOURCES-lane-citations.md)).
  This file reproduces the implementation-relevant slice; the exploration's
  ledger stays canonical.
- **Provenance:** operator FreshBooks addenda in the exploration
  `CAPTURE.md` (dev app, 1Password refs, redirect/scopes questions) + the
  r7 Sol Pro gap report §D/§F9, 2026-08-30.

## 1. Mined source corpus

No upstream code is mined or ported. The pattern source is in-repo (§4).

## 2. Upstream repositories & licenses

None — the FreshBooks API is consumed over HTTP with `FetchHttpClient`; no
SDK dependency is planned.

## 3. External research sources

Carried by the exploration artifacts (each with its own Sources section on
disk):

- [`r7-sol-pro-gap-report.md`](../../../explorations/practice-office-provisioning/research/r7-sol-pro-gap-report.md)
  — §D: FreshBooks OAuth mechanics, invoice-PDF endpoint UNVERIFIED, live
  request limits and webhook retry schedule unrecorded; §F9: single-use
  refresh-token rotation as a serialization problem.
- Exploration [`CAPTURE.md`](../../../explorations/practice-office-provisioning/CAPTURE.md)
  — FreshBooks addenda: dev app created, all scopes enabled dev-only,
  redirect = local exact-match HTTPS (localhost acceptable), settings URL
  cosmetic, 1Password credential references.

## 4. In-repo capability references

| Brick | Path | Mark |
|-------|------|------|
| Driver pattern exemplar (`FetchHttpClient` + Schema decode + `LiteralKit` errors + `S.Redacted` config) | `packages/drivers/hubspot` | reuse as template |
| Package scaffolding law | `bun run beep create-package` | reuse |
| Schema-first substrate (`LiteralKit`, tagged unions, `S.Redacted`) | `packages/foundation/modeling/schema` (`@beep/schema`) | reuse |
| The driver package itself | NET-NEW (beside the other drivers) | NET-NEW |

## 5. Cross-links & provenance

- Exploration: [`explorations/practice-office-provisioning`](../../../explorations/practice-office-provisioning/README.md)
  — `DECISIONS.md` (binding: signatures and billing; FreshBooks driver
  goal), `BRIEF.md` (sketch point 4), `MAP.md`.
- Gated dependent (exploration `MAP.md`): `practice-sign-invoice-flow`
  consumes this goal's P0 endpoint verdict and its retrieval verb (or the
  operator-export fallback).
- Sibling goal: [`goals/practice-box-provisioning`](../../practice-box-provisioning/README.md)
  (the client folders that will eventually receive delivered invoices).
- Related packets: `goals/box-driver`, `goals/m365-driver`,
  `goals/openai-driver` — the driver-goal lineage this slug follows.
