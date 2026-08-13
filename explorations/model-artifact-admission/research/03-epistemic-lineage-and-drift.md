# Lane B research — epistemic lineage integration and capture drift

Date: 2026-08-13

## Composition with the shipped core

The model-admission domain should own arrangement, qualification-run, evidence,
and disposition schemas. The epistemic core should supply immutable temporal
lineage and as-of query semantics, not absorb model-specific vocabulary.

Proposed mapping:

- an arrangement revision is an immutable domain entity with a content key and
  optional parent revision;
- qualification evidence and human disposition are distinct immutable records;
- epistemic edges may express only the core's existing `supports`, `refutes`,
  and `contradicts` relations
  ([`EdgeRelation.model.ts:13-37`](../../../packages/epistemic/domain/src/values/EdgeRelation/EdgeRelation.model.ts#L13));
  model-specific relations such as “qualifies” must not be smuggled into that
  closed vocabulary;
- a changed arrangement becomes a new version/lineage input; it does not mutate
  the prior evidence or disposition;
- admission state at `(validAt, knownAt)` is obtained through the same half-open
  two-axis semantics used by edge authority
  ([`EdgeAuthority.repo.ts:132-145`](../../../packages/epistemic/server/src/EdgeAuthority/EdgeAuthority.repo.ts#L132)).

The core's `ClaimDisposition` is a precedent for record shape—subject, status,
principal, resolution time, rationale, and evidence—but not a reusable status
type
([`ClaimDisposition.model.ts:69-107`](../../../packages/epistemic/domain/src/entities/ClaimDisposition/ClaimDisposition.model.ts#L69)).
`ModelArrangementDisposition` should be model-admission-local, just as the
core SPEC kept claim disposition epistemic-local and orthogonal to shared claim
lifecycle
([`epistemic-bitemporal-edge-core/SPEC.md:14-31`](../../../goals/epistemic-bitemporal-edge-core/SPEC.md#L14)).

## Lineage rules

- `parentArrangementRevisionKey` records derivation, not qualification transfer.
- `supersedesDispositionId` closes the prior scoped admission only when a human
  disposition explicitly does so; a test run alone never changes eligibility.
- An expired or superseded disposition remains queryable historically.
- Rollback creates a new deployment/adoption event referencing the exact prior
  admitted arrangement; it does not reopen or overwrite the old disposition.
- Contradictory scanner/evaluation evidence may coexist. A human disposition
  records the scoped decision without manufacturing epistemic truth.

## Capture-to-live drift ledger

1. **Anthropic pinning is stronger now.** The capture described a provider
   identifier; live source pins `claude-opus-4-6`, and current Anthropic docs
   guarantee full model-ID stability. The code still permits configuration
   override, so the runtime materialized ID remains the admission input.
2. **ProviderInstance claim verified.** Live source remains token-safe and owns
   metadata/auth snapshots only; no contradiction found.
3. **ProfessionalRuntime claim verified but narrower than admission needs.** It
   has evidence-bearing candidate approval and provider/model usage
   attribution, but no arrangement identity, component digests, qualification
   evidence, or admission disposition.
4. **Epistemic composition remains valid.** The shipped core supplies immutable
   two-axis lineage. Its closed relation vocabulary means admission needs its
   own domain records rather than pretending every lifecycle link is an edge.
5. **Capture language corrected.** “Exact artifact or provider version” is
   defensible only when the provider attests a pinned/resolved version. For an
   alias-only provider, the honest subject is a time-bounded provider-contract
   identity with degraded assurance, never a fabricated artifact digest.

## NOT FOUND

- No live arrangement manifest or arrangement revision key.
- No hosted-model identity-assurance vocabulary.
- No qualification-run or scanner-evidence carrier.
- No model-admission disposition or expiry/supersession path.
- No validated full-versus-delta invalidation algorithm in the four-paper
  corpus.

