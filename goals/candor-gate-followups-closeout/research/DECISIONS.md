# Decisions and Item Ledger

## Status

P1 implementation and evidence disposition are complete. The package and
end-to-end verification phases remain before packet close.

| Item | Current finding | Intended exit | Status |
| --- | --- | --- | --- |
| Cross-slice promotion consultation | The new `@beep/shared-use-cases/PromotionGate` is law-neutral. Candidate-output acceptance requires and consults it; blocked verdicts become a typed refusal. Law-practice server supplies a fail-closed `CandorPolicy` adapter. The boundary is tested without claiming a nonexistent app composition root. | Shipped behavior with focused shared, agent, and law-server tests. | terminal |
| Examiner-observed quantified set | `CandorPolicy` now evaluates every current recorded event, including examiner-only groups. Examiner events require human disposition exactly as AI observations do. | Shipped behavior pinned by examiner-only, disposed, and supersession tests. | terminal |
| Filing identity authority | Primary sources disprove a deterministic conversion: USPTO series codes span filing years while ST.13 requires a year. ST.13 now requires a non-U.S. office code; exact representations remain distinct. | Primary-authority-backed no-conversion boundary; see `01-identity-authority.md`. | terminal |
| Candor SQL plan | At 10,001 rows per table, all three production-shaped reads use their existing `org_id` index, remove 99 tenant-local rows, and return one row. | No new index; executable evidence and plan receipt in `02-query-plan-evidence.md`. | terminal |
| Shared test Crypto | Seven providers across five files split into real-platform, identity-fixture, concurrency, and deliberate-failure semantics. Only two are exact duplicates and those expose unsafe identity-digest behavior. | No shared layer; promotion bar not met. See `03-test-crypto-audit.md`. | terminal |
| Lint Policy divergence | Local standalone policy is changed-scope; hosted policy is full-scope under `CI=true`. PR #678 omits empty scoped steps while preserving full steps, with focused tests. The trace-less PR #575 incident is non-reproducible rather than speculatively attributed. | Already fixed and historical receipts marked resolved. | terminal |

## Architecture Correction

The predecessor's pending exception named a product-neutral
`foundation/capability` gate. Current `standards/ARCHITECTURE.md` is more
specific: foundation capabilities may carry no product semantics, while a
future `shared/use-cases` package may own ultra-high-bar cross-slice product
ports. This packet follows the current law. The correction is a routing update,
not a deferral of the consultation.
