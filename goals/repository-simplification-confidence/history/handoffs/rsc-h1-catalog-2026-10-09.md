lane: rsc-h1-catalog
head: bc2529b3557f61b81d407da3c2afb81f3f50dbdc (main-sync/report base; local proof head 18fdc60e50a82ba49b22d290b3035a4702a774ed)
PR: #1562 (wave 1 OSV: #1562; tsgo ratchet: SPEC Decision Log row "H1 tsgo ratchet deferral")
package-verify: not applicable (no workspace package source or manifest edited)
hosted-parity: test-tsgo: pass; docgen local: pass (noop); jsdoc-ratchet: pass; knowledge refs: fail (two inherited observations, owner lane C); fallow audit: pass; fallow health: pass; coverage read: pass (no measured source touched); Security (OSV): pass locally and hosted at 18fdc60e50, new exact-head hosted result pending after report push
handoff: goals/repository-simplification-confidence/history/handoffs/rsc-h1-catalog-2026-10-09.md
open items: all three OSV exceptions renewed through 2026-10-30 with proven-fixed-release/dependency-removal exits; inherited knowledge-reference repair; A Knip merge before catalog/register; compatibility PR follows catalog/register; tsgo deferral owned by this lane; no effected-port notice needed for OSV wave because trial lockfile change was fully reverted, confirmation required before later lockfile/scratchpad pushes.

## Done

- Followed Mechanics step 0: fetched/merged main, then the packet branch
  because the packet was absent; merged updated main again before handoff.
- Published OSV wave #1562. Renewed each exact-artifact exception and its
  Bun-audit mirror from 2026-10-16 to 2026-10-30, with advisory, consumer,
  owner and exit condition. No package.json, bun.lock or scratchpad delta.
- Tried http-cache-semantics 4.3.0: OSV version query was clean, but synthetic
  private-cache/max-stale proof failed. Restored the override/lockfile trial.
  Braces and sprintf-js still have no fixed npm release. Linked upstream
  issues and the behavioral proof in the receipt.
- Prepared the sixteen-candidate census and derived pdfjs-dist row; confirmed
  the three live effect-ontology consumers. No removals yet; recheck after A.
- Verified current Fallow schema lacks the proposed unused-catalog per-entry
  ignore; recorded evidence for the next wave's consumer-check alternative.
- Added packet evidence, lane status, sequencing decision and explicit tsgo
  deferral. No unrelated source changes or formatting churn.

## Evidence

Full commands, outputs, source links and preparation census:
`history/receipts/stage-4-h1-catalog.md`.

- Local parity through `beep-heavy`: OSV, test-tsgo, bounded docgen, fresh
  JSDoc ratchet, Fallow audit and health pass. Knowledge refs exits 1.
- Hosted Security passed at implementation head `18fdc60e50`:
  https://github.com/beep-effect/beep-effect/actions/runs/37955008259/job/113903184755
- Yeet cheap-gates and head-install preflight passed. Publication created
  #1562, pushed `18fdc60e50`, then monitor submission failed due to the absent
  user-bus environment. Re-submission succeeded: job
  `f8d5ad78-1177-409e-b399-2baea41d1ddf`, bounded to 45 minutes.
- Scoped coverage baseline read: no source owned by a coverage row touched.
- Logs/command status: `.beep/rsc-h1/parity.tsv` and per-command logs.

## Blockers and remaining work

1. Knowledge refs: `explorations/build-pipeline-simplification/RESEARCH.md:194`
   is inherited from main `d1e8350670`; SPEC.md:374 is inherited from the
   packet head `3dbf109066`. Lane C owns baseline/portability repair; merge
   its shared repair and rerun. No suppression or duplicate fix in H1.
2. Orchestrator merges OSV #1562 first (before 2026-10-16), then follows S6.
   A's Knip removal must merge before the catalog/register PR (R73).
3. After that, rerun the candidate census, remove 14 catalog lines and eight
   scratchpad declarations plus inert Jaeger override/ignore; regenerate lock;
   notify through orchestrator and wait for effected-port confirmation before
   any lockfile/scratchpad push (S5). Write the full hold register, ONNX exact
   pin and syncpack update. Implement the detector schema -> service -> code
   with paired fixtures if Fallow's missing support remains confirmed.
4. Compatibility proofs run in their own following PR (R74), including six
   range-satisfied overrides, brace/minimatch, OTel, XML, jsdom/Vitest, Biome.
5. Separate seven-pin tsgo ratchet 0.47.2 -> 0.51.1 after hold-exit merges.
   Explicit owner/reason/reversal: SPEC Decision Log "H1 tsgo ratchet deferral".
6. Full H1 acceptance and A's stage-5 contributions remain open. This report
   is an OSV-wave handoff with blockers, not full H1 completion or merge-ready.

## Recovery

Revert the OSV wave PR. The register and removals have not yet been shipped.
Do not merge or retire this lane from the worker; the orchestrator owns both
instructions under the brief. No notification is pending for the retained
OSV wave because there is no shared dependency-file delta.
