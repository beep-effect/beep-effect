# Party slice continuation — partial implementation

Base: public `origin/main` at `01a399a52f`. Work is isolated on
`feat/party-slice-completion` in the owner's sibling worktree root. The original
checkout and its unrelated IDE changes are preserved. No publication, merge,
completion proposal or completed lifecycle state is claimed.

## Current implementation

- Existing neutral shared PartyId and PartyKey foundation retained.
- `party-use-cases` and `party-server` scaffolded with `beep create-package`;
  generated registrations retained. `tsconfig-sync` updates reference edges.
- Party-owned evidence ids, role-named propositions (including KeyAssignment),
  length-framed logical keys, and `makeClaimEnvelope` binding.
- Resolution uses `effect/Graph`, numeric survivors, all active vetoes before
  merges, numeric knowledge-time and Unicode-code-point id ordering, all
  blocking veto ids, scoped review cases, and key redirects. Previously known
  parties remain present after their last merge expires.
- Memory ledger port and Layer: atomic append, duplicate/predecessor checks,
  integer allocation, immutable stored observations/assertions/versions, derived
  expiration snapshots. Corrections may replace a different proposition. Evidence
  batches validate atomically, including conflicts after earlier categories/rows.
- Party, Communication and Provenance models; admission proofs, hierarchy
  analysis and projections; synthetic Acme fixture and competency tests.
- All seven P1b foundation factory families bound to party ids and schema
  identities, including exact-basis evidence review, contradiction sealing,
  detection snapshots and projection references.
- Domain-neutral ContactSource contract and generic contact ingestion through
  the ledger. Shared normalizers produce stable keys; cards allocate distinct
  integer parties and emit Proposed claims with unknown valid time.
- Graph contacts map through the same contact boundary, with explicit phone
  country context, company-only organization classification and stable identifier
  keys independent of provider metadata. Full server verification passed.
- Whole-record mail adaptation preserves delegated roles and exact field anchors,
  deduplicates participant references while retaining observations, proposes
  same-message DN/SMTP aliases, reports parser hazards and appends observations
  plus real alias assertions atomically. Assertions anchor both matching header
  fields and are qualified by extraction and pair identity. It uses no CLI dependency. Time parsing retains milliseconds and
  rejects calendar rollover and missing timezone. Child message content identity
  is supplied separately from the parent archive and participates in occurrence
  identity. The review loop now consumes the graduated evidence.
- Organization evidence uses shared email normalization, a documented domain
  suffix heuristic, validated inclusive observation spans and review-only leads.
  Known concurrent pairs remain visible alongside undated evidence.
- Identity evidence includes deterministic Graph mailbox components, all five
  collision outcomes, conservative cross-source card proposals and numeric-time
  drift leads. Duplicate evidence cannot invent independent sources or self-merges;
  ambiguity within one source suppresses a candidate. Pairing aggregation counts distinct messages, retains real sampled assertion
  references, honors a zero sample size, and derives bounds from all observed
  times. Pairing claims cite sampled assertions, remain Proposed and bind version
  identity to their evidence, temporal bounds and knowledge time. Inclusive
  observed spans map to half-open millisecond intervals; undated support stays
  Unknown. An adapter-to-proposal test resolves every supporting assertion.
- MailCensus graduated to immutable schema-owned state with persistent evidence
  maps, decode-failure folding and a count-only summary. It retains numeric
  identifier spans and pairing support for review; repeated rows do not inflate
  distinct identifiers, voices or pairing-message support. Tests cover summary
  privacy, delegation, unification, name collisions and histogram buckets.
- ReviewLoop seals canonical evidence with numeric PartyId ordering, verifies
  the digest and exact decision partition, and emits real sourced assertions
  plus accepted candidate versions with explicit validity. Scoped application
  rejects stale, invalid, tied and conflicting decisions before publishing any
  evidence; conflict removal repeats until the settled set is stable.
- Mailbox anchors use a ledger-scoped PartyKey registry and shared integer
  allocation. Repeated and concurrent allocations reuse the anchor without
  asserting identity. The memory Layer does not promise cross-process durability.
- Scratchpad mail-census now consumes the graduated package APIs through Effect
  CLI. It requires explicit child-content enrichment because the legacy index
  omits that digest. Synthetic command checks cover successful/failed rows,
  filtering, help, missing inputs and invalid regex. Workflow documentation
  states partial-summary behavior and the remaining scratchpad migration.
- Review-page demo now uses graduated identifiers, integer mailbox anchors and
  sealed cases through a scratchpad-only compatibility adapter. The page itself
  is unchanged. Readable labels are verified against canonical key bindings;
  page imports require explicit validity/provenance and remain unaccepted until
  applyReviews validates them. Main identity-evidence workflow now uses this bridge.
- Identity-evidence script now uses graduated adapters, census, claim construction,
  review and integer anchors. It exports real source assertions and all candidate
  claim families, never resolves Proposed card matches as accepted identity, and
  suppresses card proposals for identifiers marked shared by any source. Native
  decisions retain their context; page decisions need explicit validity flags.
- Law-practice server maps current and legacy contacts-kg records through the
  exact use-case boundary, retaining role-mailbox flags and client-link source
  anchors. Its Layer exposes the generic ContactSource port.
- Native AST boundary test covers source imports, exports, dynamic imports,
  require/import-equals, mixed imports, suffix packages, quotes and multiline
  syntax; manifest fixtures cover both dependency sections. It runs under Node
  because the native TypeScript transport requires Node stdio handles.
- Law-practice Party renamed LegalPartyReference, including module path,
  public export and schema identity. PartyId and fields retained. Major
  changeset records the breaking API; no persistence table or migration.

## Scoped evidence

- Law-practice domain and server full package verification: audit and docgen passed.
- Party use-cases full package verification: audit and docgen passed.
- Party domain tests: 56 passed (foundation, claims, resolution, admission,
  Acme competencies and all seven factory families).
- Party server tests: 74 passed (scaffold, seven ledger tests, five generic
  contact ingestion tests, two Graph-contact tests, three mail parsing tests,
  ten whole-record mail tests, one cross-adapter equality matrix, eight organization
  evidence tests, nineteen identity-evidence tests, seven census tests and eleven
  review-loop/anchor tests).
- Claim tests prove binding round-trip, foreign id/key rejection, numeric
  symmetric endpoints and framing. Graph cases cover late vetoes, competing
  equal-time merges, cycles, re-enabled edges and non-BMP ordering.
- Ledger tests cover concurrency, duplicate/competing successor rejection,
  immutable prior snapshots, retraction and accepted successor restoration.
- Latest party-server full verification after review and census integration (2026-11-03):
  audit passed (16.0s), docgen passed (3.3s). Updated use-case port full verification:
  audit passed (12.1s), docgen passed (2.6s).
- Full package verification passed for party-domain, party-use-cases and
  party-server (audit and docgen). These are scoped proofs of the current
  partial implementation, not evidence that the full SPEC is implemented.
- The four law-practice adapter and four parser boundary tests passed.
- All five SPEC boundary scans returned no matches after contact integration.
- Scratchpad type check passes after fixing two pre-existing collection-helper
  diagnostics. All 56 scratchpad tests pass; these still include mirrored legacy
  modules and therefore do not prove migration completion.
- Synthetic census smoke: 3 selected rows, 2 decode failures, 1 adapted event;
  filtered-empty output and expected CLI failures verified without corpus access.
- Synthetic review-page demo embeds 3 cases and 7 integer mailbox anchors with
  readable labels and ISO dates. Three adapter tests verify shape preservation,
  binding rejection and explicit decision enrichment.
- Synthetic full identity workflow: Graph/current/legacy cards decoded, five mail
  rows produced two decode failures, one pairing proposal and one unresolved
  case. Every output claim reference resolved to an exported source assertion.
  Page import without validity failed; explicit validity produced one accepted
  sourced claim; changed evidence produced stale-review and zero accepted claims.
  A role-address fixture suppressed the otherwise eligible cross-source proposal.
- Launcher size, manifest JSON and `git diff --check` pass.

## Remaining contract work

This is not full P1 coverage. Remaining work includes all remaining synthetic competency tests and adapter equality scenarios,
scratchpad graduation, package documentation, hosted-only gates, PR
readiness/merge, reflection and completion refresh.

The memory ledger permits one successor per current predecessor. Tests exercise
accepted successors of retractions, including restored vetoes, historical replay,
key redirects returning to original ids, and corrections changing proposition.
The original rows remain immutable. The generic ContactSource workflow now
consumes the port and appends observations, assertions and proposed versions.
Synthetic tests cover this workflow, malformed input/fallback, key stability,
shared addresses, ordering and duplicate-extraction rejection. Actual mail and
contact adapters agree on normalized values, canonical bytes and keys for case,
Unicode composition and IDNA-equivalent domains. The full cross-adapter matrix,
scratchpad mirror removal and competency audit remain outstanding.
