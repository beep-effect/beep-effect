# Verified pin-cite-inclusive occurrence components

Occurrence projection now publishes a spanWithPincite component beside fullSpan.
It follows CitationBase.span_with_pincite from the actual pinned models.py:
the minimum non-null start and maximum non-null end include token endpoints,
explicit model endpoints and pin-cite metadata endpoints. Native Python point
ranges are converted and verified against the canonical source before issue.
An equal primary range reuses its genuine proof. Other ranges reserve the quote
before allocation through the existing text budget. No worker or scheduler is
introduced, and service methods retain their captured dependency behavior.

Invalid pin-cite ranges preserve the semantic citation and primary mention,
omit that component and return an explicit spanWithPincite invalid-span issue.
The diagnostic name schema now distinguishes fullSpan and spanWithPincite.
The existing candidates ceiling still bounds total component issues: refusal
occurs before appending an issue batch that would exceed it. Array/report limits
and all existing policy ceilings remain unchanged; no partial result is returned
on resource exhaustion.

## Independent source observations

The existing extraction-loop producer now calls the original span_with_pincite
method for all eighty pre-filter and seventy-seven returned models. Its v2
fixture retains the same thirty-six documents and eight edition bindings.
All previously recorded values are structurally identical after removing only
the new fields and restoring the producer/schema-version metadata.

All 157 unmodified observations equal their primary spans. To distinguish the
real algorithm from unconditional primary-anchor reuse, the producer also
records sixteen endpoint mutations on actual original models in source cases
4 and 26. They cover null and zero endpoints, extension before/after the token,
inward endpoints ignored by min/max, negative/beyond-source coordinates and
non-BMP Unicode. The target occurrence adapter replays those same mutations and
compares actual source ranges, or requires explicit invalid-span diagnostics.
No target output supplies an expected range.

The source root remains clean at eyecite commit
04d82c032ad5fd0f9ab72a61c87110c46ee8f52e, tree
a35a58fac03400f71a93a93485b77f1d56f2b02f, under CPython 3.11.15 and
PYTHONHASHSEED=0. Exact source/dependency/license pins remain sealed. Fresh
source replay is byte-identical; all eight corruption controls pass.

New corpus SHA-256:
`f068a21141db823055f6dbad6c79d9c0c996f300e7b76258ca26a92009f2f89b`.
New producer SHA-256:
`7a0d7e7e3d2564f52c74aad00aa8e5ef08ee2d27022e78bc99b3bbaff9b12976`.
Source seals and test readers are updated together; this adds independent source
observations rather than adjusting expected behavior to the target.

## Validation and remaining obligations

Nine tests pass in 94.73 seconds across public corpus extraction, private
semantic/occurrence extraction and semantic projection. Bun and Node both
compare primary/full/pin-inclusive anchors and replay all sixteen overrides.
Existing one-unit-short text-budget refusal and malformed full-span controls
remain active; an additional out-of-source pin-cite control preserves fullSpan.
A subsequent two-runtime replay passes in 55.90 seconds with a three-issue
control that refuses under a two-candidate diagnostic ceiling. After the
chained mutation helper gains schema validation, a fresh two-runtime replay
passes in 54.44 seconds with lint/types passing again.
Both affected package lint/types pass; blocking laws and server declarations
pass. Scoped Fallow reports zero introduced findings and nine inherited clone
groups before the separate archive-consumer CI repair.

The public/full private integration entrypoints consume the same stronger
thirty-six-document source fixture. Hosted full replay is still required.
Raw pin-coordinate field reconstruction, retained Document/model protocols,
vocabulary classification/version proof, production identity allocation,
lawful transforms, whole-engine safety/scaling, all source/donor dispositions
and lifecycle acceptance remain open. All eleven representation laws, four
fidelity questions and fifteen unfinished proof rows remain open without waiver.
