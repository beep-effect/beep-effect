# Resolution coverage from committed operation observations

Date: 2026-10-28. Semantic default-resolver proof; full parity remains open.

## Source coverage and binding

The existing operation corpus contains exactly 30 resolve_citations calls from
two source sites and 94 input mentions. Every call uses all five pinned default
callback identities. All eight canonical citation families occur. There are
no repeated member indices in these observations. No source row is filtered
out as an unsupported/custom case.

The test decodes the original 17 MB corpus through the public test-only
CitationOracleOperations codec. It asserts the exact file SHA-256:

```text
ae441000ddc90537864e3fdd4a9dfc4aa81af37a65818b48ce9bf37d95d1eeb1
```

It checks every selected observation's exact payload digest, validates all five
default callback bindings and resolves selected immutable edition artifacts
through their content hashes. Existing public vocabulary mapping data supplies
case ReporterIds; law/journal publications receive no invented case identity.
Expected group membership comes directly from the source resolutionGroups
member indices. There is no second copied expected-output fixture.

The test requires 30 unique observation IDs, two sites, 94 mentions and eight
families. The source selector uses every resolve_citations row; a new row or
callback identity cannot silently disappear. The new test covers the same
pinned source observations that the independent operation auditor validates.

## Semantic witness projection

Several upstream tests resolve citations extracted from separate strings, so
their original offsets overlap. The test adapter constructs a separate witness
text by joining the original matched tokens, assigning disjoint UTF-16 ranges.
It preserves legal components, nullable/missing keys, textual metadata,
publication candidates, selected edition and source group order.

The original corpus and its original spans remain unchanged. Constructed
witnesses verify the ordered semantic-resolution inputs; they do not assert
extraction or original-source anchor parity. The target re-verifies their
actual source/anchor capabilities and IDs before running the resolver. Remaining
coordinate/projection families and extraction tests still require their own
proof against original source evidence.

Metadata projection maps every canonical semantic field into the existing
Citation codec rather than adding a parallel wire hierarchy. Shared test
context construction also serves the prior 46 focused scenarios. Source corpus
reading and field projection occur only in test helpers; production resolver
code gains no filesystem, Python, donor or fixture dependency.

## Result and limits

All 30 operation contexts match their original resource memberships and order.
Combined with the prior focused corpus, the resolver now passes 76 contexts
covering 210 mention observations. No production resolver behavior change was
needed. The suite now contains nine focused tests, including source-operation
coverage and the prior state, identity and budget controls.

This closes a coverage gap between the focused scenes and the committed
operation observations. It does not close the whole resolution capability row,
custom callbacks/resource-key policy, helper/assertion coverage, runtime safety,
public service integration, or the complete target parity comparator. All
canonical/donor/divergence/safety rows retain their existing unfinished state.
P0/P1 and the goal remain in progress.

The complete server package gate passes (audit 40.9 seconds, docgen 16.0
seconds), including build/type checks, all tests, lint and documentation. The
nine-test resolver suite includes the new operation-context lane and the prior
focused scenarios/controls. The ten-component evidence audit and goals
index/doctor pass; the target parity entrypoint remains pending. New-note and
README Markdown checks pass. Logs use the `resolve-operation-` cache prefix.

Reproduce with:

```sh
bun run beep quality package-verify @beep/law-practice-server
bun run --cwd packages/law-practice/use-cases citation:parity-check --audit
```
