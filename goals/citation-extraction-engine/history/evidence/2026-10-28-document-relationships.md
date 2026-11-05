# Document-owned resolution relationships

Date: 2026-10-28. Local P1 checkpoint; P0/P1 and the goal remain open.

## Applied model

`CitationResolution` is the required tagged union of `Resolved`, `Ambiguous`
and `Unresolved`. Resolved edges name one authority ID. Ambiguous outcomes
retain at least two distinct candidate IDs and choose no membership. Both
assertions permit optional unit-interval confidence. Unresolved outcomes carry
a finite diagnostic derived from the pinned resolver's branches: missing
antecedent, no matching authority, no previous resolution, invalid Id. pincite
or unsupported citation. Actual diagnostic emission and normalization still
need target resolver proof; the oracle returns None for these branches.

`CitationAuthority` contains only its ca1 ID and the full mention representing
its resource. It contains no embedded citation copy or member array.
`CitationDocument` owns ordered verified mentions, authority records and
resolution edges. Every mention has exactly one outcome. Resolved edges are
the sole encoded authority membership; `citationAuthorityMembers` projects
member IDs in mention order. Candidate references do not count as membership.
Reordering relationship arrays cannot change the projection's mention order.

The shared graph check requires unique mention, authority and resolution IDs;
exact outcome coverage; existing target/candidate/warning references; no
self-referencing overlap warning; coherent source/engine identity; and full
representatives resolved to their own authority. It builds private immutable
HashMaps for linear reference checks. No array-position identities or recursive
citation copies return. An empty document remains valid with explicit source
and engine identity and empty relationships.

These are data-coherence checks, not proof of legal classification, resolution
correctness, digest authenticity or mention chronology. The domain does not
compute authority IDs or certify selected-edition adapter data. The future
engine must connect the verified mention/authority producers to the resolver.
Parallel/string/history relationships remain subject to canonical/donor proof;
no unproved extension stub is added by this checkpoint.

## Persistence boundary

`CitationDocumentReceipt` owns structural mention receipts and the same
relationship schemas/check. It carries `citation-document-receipt/v1` and
round-trips through an explicit JSON codec. Its data cannot be decoded into
a runtime document with genuine anchor proofs. Document-wide projection and
canonical-source restoration are still server integration work. Persisted
receipts are not authentication or durable source authority.

Both runtime and receipt documents reuse the existing semantic Citation union.
Persisted entity identity is unchanged. Source evidence remains owned by the
public verified-span prerequisite; no coordinate/locator primitive is copied.
Operational limits, stage deadlines and interruption belong to the live engine
policy, not a duplicated domain policy in these schemas.

## Verification scope

Nine focused tests include a 25-run schema-generated bounded-confidence
receipt property. They use actual prerequisite-issued anchor proofs and
explicitly synthetic format-only IDs, keeping graph proof separate from digest
proof. Tests cover receipt JSON round-trip and runtime-proof rejection;
member projection under independent mention/edge ordering; duplicates/missing
outcomes; dangling references; invalid/non-full representatives; cross-source
and engine drift; missing/self warning references; empty documents; invalid
ambiguity and out-of-range confidence. Canonical resolution/extraction outputs
are not asserted by these composition fixtures.

The domain package gate passes (audit 7.8 seconds, docgen 9.8 seconds), as do
the downstream use-case gate (8.6/8.9 seconds) and server gate (37.8/13.2
seconds). The full checks include builds, types/tests, lint and documentation.
The ten-component evidence audit, goals index/doctor and new-note/README
Markdown checks pass. Cache logs use the `document-` prefix. Initial checks
caught a literal-helper example, property-test option and incomplete unknown
fixture metadata; the final gate and focused suite pass after correction.

Reproduce with:

```sh
bun run beep quality package-verify @beep/law-practice-domain
bun run beep quality package-verify @beep/law-practice-use-cases
bun run beep quality package-verify @beep/law-practice-server
bun run --cwd packages/law-practice/use-cases citation:parity-check --audit
```

No canonical, donor, divergence or safety row is promoted. Full target parity,
Bluebook transforms, relationship detection and bounded runtime proof remain
unfinished. The packet lifecycle remains active and no phase is complete.
