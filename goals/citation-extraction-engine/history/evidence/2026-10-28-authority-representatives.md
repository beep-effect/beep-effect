# General authority representatives

Date: 2026-10-28. Structural adaptation for canonical custom resources;
custom resolver execution and key-policy proof remain unfinished.

## Source requirement

The pinned observations in `2026-10-28-custom-resolution-contract.md` show
resources introduced by short, supra, reference and Id. callbacks without a
full citation in the input. The provisional full-only authority representative
cannot express their output. This is canonical source behavior, not a donor
extension or a reason to create a synthetic full citation.

## Change and ownership

`CitationAuthority` now owns `representativeMentionId`, replacing the unshipped
`fullMentionId`. Both runtime documents and structural receipts require that
the representative exists and resolves to the authority. They retain unique
IDs, one outcome per mention, closed chosen/candidate/warning references,
source/engine coherence and membership derived from resolution edges.

Representative kind is unrestricted. Its identity and the group's resource
key remain separate from legal classification and structural graph coherence.
The schema does not certify that callbacks ran, that a particular grouping is
correct, or that an authority token was issued by a trusted adapter.

The default resolver still chooses its first full member and produces the same
resource IDs and memberships. Its constructor now uses the general field.
No other package source consumer of the retired field was found by a live
`packages`/`apps` scan. No compatibility alias or duplicate representative field
is retained. The package is private; `.changeset/README.md` forbids changeset
notes naming live private workspaces, so the schema replacement is recorded
here and in the decision log without a release note. Historical evidence
describes its then-current schema; this note supersedes that structural
restriction.

## Persistence boundary

The current persistence implementation verifies default authority keys only.
After the structural generalization, skipping a non-full group would allow an
unchecked authority through. Projection and restoration therefore explicitly
require a verified full-member key witness for every group. A group without
such a witness fails with the sanitized private reason
`authority-key-unavailable`. The representative itself may still be non-full;
its kind does not determine which identity proof is available. Both paths
continue to recompute every resolved full member's default key, including
members other than the representative.

This guard is transitional implementation work, not a final supported-mode
decision or an approved divergence. Custom key descriptors and their trusted
adapter must replace it before custom callback parity can be claimed. The
receipt cannot authorize its own key policy. Existing verified source/anchor
capabilities, occurrence revalidation, source hashing and snapshot behavior
are unchanged.

## Proof and limits

Domain tests construct graphs with two resolved non-full mentions for each of
the four callback families and round-trip their structural receipts. These
tests use format-only IDs to isolate graph coherence from private digest
production; they assert no extraction or callback execution. Existing tests
still reject a dangling, ambiguous or wrongly resolved representative.

Server persistence tests use a genuine verified Id. mention and valid
occurrence token, then require explicit rejection in both projection and
restoration until a custom identity adapter is supplied. A separate positive
test changes the representative to an existing Id. member while retaining full
identity witnesses; projection and restoration preserve that representative
and the checked authority ID. Existing default
resolver and persistence suites remain regression gates for the full path.

The goal, P0/P1, all custom-resource target rows and complete parity remain
open. No donor disposition, safety family or canonical accounting row is
promoted by this structural change.

The final domain package gate passes (audit 9.1 seconds, docgen 10.6 seconds).
The final server package gate passes (audit 32.7 seconds, docgen 10.8 seconds),
including the independent representative/key test, rejection controls and the
unchanged nine-test default resolver suite. Both gates include build/type
checks, tests, lint and documentation. The ten-component evidence audit and
local goal index pass; goals doctor reports no new blocking findings. New-note
and README Markdown checks pass. Complete target parity remains pending.
Verification logs use the `representative-` cache prefix.
