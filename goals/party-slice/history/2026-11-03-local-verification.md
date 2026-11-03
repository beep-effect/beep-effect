# Local verification — 2026-11-03

This is an in-progress local receipt. The initiative is active; there is no
published-head readiness, merge or completion-refresh claim in this document.

## Implementation status

The scratch implementation and five legacy test files were removed after the
[competency comparison](2026-11-03-competency-migration.md). Executable scripts
use the packages and the unchanged review page uses a script-only compatibility
adapter. Package READMEs explain source provenance, provisional identity, explicit
review validity and instance-local memory storage.

## Passed checks

- Domain package verification after adding exact hierarchy findings, graph node
  and edge counts, selector hop distances, reporting-cycle/Mermaid output and
  missing schema boundaries.
- Party server package verification after hoisting repeated schema codecs to
  module scope; law-practice server package verification after the same repair.
- Scratch type checking and all three retained review-page adapter tests after
  mirror removal.
- `bun run beep lint schema-catalog --write`: refreshed the five affected shards.
- Root `bun run lint:oxlint`: passed after five inline schema compilation fixes.
- `bun run beep docgen check --package <pkg>` for all three party packages.
- `bun run audit:github repo-sanity`: all nine checks passed after sorting
  dependency entries in the four changed manifests.
- All five SPEC boundary scans: no forbidden imports or manifest dependencies.

- Cache audit: zero blocking findings after a reviewed baseline update for `//`,
  law-practice server and the three party packages. Scope/profile/epoch are
  unchanged; the review basis and exact-byte request are retained in `research/`.
- Reflection artifact lint: zero blocking or advisory findings for the prepared
  closeout reflection.
- Domain package verification passed again after documentation cleanup and the
  three missing runtime schema aliases were added.

The first regenerated documentation ratchet found ten additional multi-paragraph
leads, 77 trailing-blank findings and three missing runtime schema aliases. The
comments and aliases were repaired; the fresh regenerated ratchet passed all 21
tracked metrics with zero increases and zero legacy findings.
The final content audit, committed-head verification, publication, review, merge
and completion refresh remain required. Main was six commits ahead and was merged locally in `551a84dcc5`, after
implementation checkpoint `07904cb62f`. The two conflicts were generated cache
and Fallow inventories; both were regenerated from merged inputs. Frozen-lockfile
installation passed, the merged cache audit has zero blocking findings, and
schema catalog regeneration reports no additional shard drift.

## Scope

No private corpus was read. `scratchpad/party/scripts/ReviewPage.ts` is unchanged.
No persistent party tables, clients, UI or cross-slice edge projection were added.

## First publication gate — remediation in progress

Yeet created local commit `183945bd50`, then refused publication. Nothing was
pushed. Its committed-head cheap-gates verdict found four failing lanes:

- Fallow health: five complexity findings in mail adaptation, ledger batch
  validation, review application, contact collision classification and the
  law-practice boundary test's AST visitor.
- Fallow audit: those five findings plus twelve duplicate blocks. Ten clone
  groups concern slice-specific foundation factory bindings; two concern source
  assertion construction and the intentionally narrowed mail-recipient boundary.
  These need semantic review and remediation, not a broad threshold increase.
- Schema-first: two exported interface candidates and five codec-test property
  coverage advisories. The source service shape is now inline in its service
  contract, and IdentityView is an annotated opaque model with an explicitly
  in-memory callable. Property-coverage findings remain to be addressed.
- Effect Vitest: 68 assertion/helper and layer-timeout findings. The assertion
  changes preserve the original Boolean polarity and expected Option payloads;
  the exact detector rerun is still required.

The regenerated JSDoc ratchet, schema catalog, cache policy, root oxlint,
configuration, goal checks, and the other cheap lanes passed at that committed
head. Further source changes invalidate any claim that this is final-head proof.

The first complexity refactor extracts batch validation, contact classification,
review grouping status and static/dynamic module-specifier recognition. Party
server and law-practice server package verification passed after that first
refactor. Subsequent assertion and IdentityView changes are being verified.
The large mail adapter and duplication findings remain open. Publication, hosted
readiness and completion remain unproven.

### Publish-gate remediation follow-up

- The six nominal factory facades and header recipient wire projection now carry
  reasoned duplication annotations, with review triggers and reversal recorded
  in SPEC. The repeated claim-envelope algorithm is extracted into the internal
  `claimFromAssertion` helper instead. Fallow audit confirms no duplication
  findings; its second run retained one mail-header complexity finding, now
  split into internet-recipient collection and awaiting the final rerun.
- Schema-first passes with zero findings, including zero arbitrary-test
  advisories. The five flagged tests now use schema-derived `it.prop` / `it.effect.prop`
  properties whose harness reports falsification and exhaustion.
- Domain package verification passed (audit and docgen). Direct suites pass:
  domain 62 tests / 7 files, server 76 tests / 11 files. Server verification is
  rerunning after moving per-property ledger construction into a scoped layer
  build to preserve independent state without nested Layer provision.
- Full Effect Vitest lint is still pending. No publication or hosted readiness
  is claimed by these local results.

The final Fallow audit rerun reports zero findings. Server package verification
passes after the property harness migration; the final domain rerun follows the
removal of an unused import. Both direct suites still pass (62 / 76). Effect
Vitest's row scan found only a redundant whole-property scope; the canonical
property harness already supplies that scope, so it was removed. Main's
owner-readiness merge fix (#2655) was merged without conflicts; no party source
behavior changed in that sync. The publish gates will revalidate the resulting
committed head.

Before the second publish attempt, domain package verification passed again
(audit 14.3s, docgen 3.9s) and server verification passed after the final scope
cleanup (audit 16.0s, docgen 3.4s). The server's 76 tests pass on that source.
Root oxlint passes. Schema catalog regeneration updates the party-domain shard
for IdentityView; no unrelated shard changed. All remaining gate proof is
provided by the second publish's committed-head cheap-gates run, not inferred
from these scoped checks.
