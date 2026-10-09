lane: rsc-h1-catalog
head: 3dbf109066 (base; OSV wave currently uncommitted)
PR: none (wave 1 OSV: proofs pending; tsgo ratchet: follows hold-exit merges)
package-verify: no workspace package edited in OSV wave
hosted-parity: test-tsgo, docgen local, jsdoc-ratchet, knowledge refs, fallow audit+health, Security (OSV): pending admitted run; coverage read: pending
handoff: goals/repository-simplification-confidence/history/handoffs/rsc-h1-catalog-2026-10-09.md
open items: OSV parity queued; no lockfile or scratchpad edit remains, so no effected-port notification needed for wave 1. Catalog/register waits for A Knip merge (R73); compatibility proofs follow in separate PR (R74); tsgo ratchet follows hold-exit merges (R76).

The OSV wave renews all three exact-artifact exceptions through 2026-10-30.
A trial override of http-cache-semantics 4.3.0 passed the OSV version query,
but failed the private-cache/max-stale behavioral proof; the trial was fully
reverted. Braces and sprintf-js have no fixed npm release. Each exception
records its consumer, owner, advisory and proven-fixed-release or dependency
removal exit. See the receipt for commands and the failing output.

Recovery: revert the OSV wave commit. No manifest or lockfile delta remains.
No merge or lane retirement by this worker.
