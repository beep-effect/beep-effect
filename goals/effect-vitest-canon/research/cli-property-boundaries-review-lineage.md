# Final parent acceptance addendum — 2026-10-06

Parent accepts all six source-bound R2 dispositions at source `5ba9351314`.
R1-004 is now fixed by the later full package receipt: exit zero, stable fifteen
hashes, audit 726.2s and docgen 25.2s. Independent R2 report SHA-256:
`183a09258b9537018bc9910e2a0fc724cde968ef5fff81c9363a0e84912b5cae`.
Independent findings SHA-256:
`7a709e9ba7eb22f98cd498d70827a609dd2b2ebb39d90d3ace6a23c96fff0483`.
The reviewer did not execute the later package proof. R2-001 remains the accepted
private-path-rewrite qualification, not an omitted source finding. The complete
lineage binds exact review, parent-acceptance and package receipt hashes.

## Historical preparation review summary

# C4 independent review lineage — preparation, 2026-10-06

This sanitized summary describes private independent Grok R1/R2 source-bound
reviews. It is a draft evidence summary, not parent acceptance or goal closure.
The reviewers read snapshots, installed helper contracts and existing receipts;
they did not rerun the package proof or independently reproduce all tests.

| Review row | Historical observation | R2 disposition / remaining gate |
| --- | --- | --- |
| R1-001, P0 | One-argument assertFailure produced a real failure and compiler diagnostic. | Fixed in current lab 612f85a9… with two arguments and exact formatted issues. |
| R1-002, P1 | Interim instance-only SchemaError oracle accepted wrong fields. | Fixed; three private wrong-field/diagnostic cases fail the exact assertion on Node/Bun. |
| R1-003, P2 | A report names pre-D5 docgen bytes. | Current qualification uses D5 304eb9eb…; the earlier report remains historical. |
| R1-004, P2 | Full package had no terminal success receipt. | Tracked follow-up; both exit-130 interrupted attempts remain incomplete. |
| R1-005, P3 | Nonempty baseline and hosted acceptance must remain. | Unchanged; no acceptance claim. |
| R2-001, P3 | Private controls also rewrite three paths for loading. | Tracked qualification: executed oracle is preserved; copies are not operand-only bytes. |

Current lab 612f85a9… and the other fourteen source hashes match the R2 after
snapshot. R1 snapshots and earlier one-argument/interim receipts remain separate.
The future reconciliation guard requires a full actual source commit, stable
exit-zero exact package receipt, and explicit accepted dispositions binding the
independent review bytes. Source findings marked fixed by R2 do not bypass those
gates. The draft proof records the known controls and their limits.
