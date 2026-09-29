# R45 partial reconciliation

R45 ran against source `224222d138` and main `dcf64397ec98`. Eight lanes executed.
Seven completed and are independently reconciled: foundation-primitive,
capability, modeling-rest, schema-a-m, schema-n-z, ui and drivers-a-f.
drivers-g-m failed and 19 lanes were not executed. The round is incomplete
and earns no dry-round, P3, ratification or implementation credit. The dry
streak stays at zero.

drivers-g-m exited zero, but its stderr carried one ERROR-level tool error.
The lane had called `search_replace` on its own report with identical empty
old and new strings, and the tool rejected the call. The split-stream runner
refused on that diagnostic (`unexpected-diagnostic-level`) and stopped
dispatch. The attribution is scanner report-tool misuse, not source drift or
network failure. The failure is preserved and not retroactively accepted.

After termination, all 4,167 frozen inputs matched the R45 source. This
closeout re-verified them read-only against the source commit's git objects.

## Inventory

Inventory stays at **726 rows: 108 qualified, 618 disqualified, zero
applied**. No row changed. Six reconciled reports are empty. The capability
report's two raw records restate existing qualified ids with corrected
cardinality or anchor. They are not new owners.

## Deferred remediation

These reviewed candidates are listed in `integration.json` but not
installed. Their contracts were not re-reviewed here.

- **CAP-1 / CAP-2:** capability cardinality and anchor corrections. Reviewed;
  there is no separate parent remediation acceptance.
- **AM-3:** re-anchoring of the invariant-enforcement-channels design.
- **DAF-2:** re-anchoring of the duckdb transaction design.

UI-1 was withdrawn by an owner-disposition review, with no census addition.
No design or product source was changed.

## Runtime scope

The schema-a-m lane listed a runtime isolation directory outside the
checkout. It got entry names only and read no file content outside the
checkout. The historical report evidence is retained. Read-scope hardening
belongs to the future runtime, not to this closeout.

## Superseded by source change

Main `f590617f15` was merged into branch `587d11c142`. The merge
changed 23 frozen inputs, 7 of them corpus files:

- `packages/foundation/modeling/nlp/src/Core/Document.ts`: r45-foundation-modeling-rest (reconciled)
- `packages/foundation/modeling/nlp/src/Core/Sentence.ts`: r45-foundation-modeling-rest (reconciled)
- `packages/foundation/modeling/nlp/src/Core/Token.ts`: r45-foundation-modeling-rest (reconciled)
- `packages/foundation/modeling/schema/src/Thunk.ts`: r45-foundation-schema-n-z (reconciled)
- `packages/foundation/modeling/schema/src/URL.ts`: r45-foundation-schema-n-z (reconciled)
- `packages/shared/domain/src/entity/EntityId.ts`: r45-shared-documents (not-executed)
- `packages/shared/domain/src/entity/PublicEntityId.ts`: r45-shared-documents (not-executed)

The reconciled lanes cover the R45 source only. They do not establish
current-source coverage, including for the changed files inside reconciled
lanes. The pending R45 recovery was not launched and is superseded. The
current source needs a fresh, independently admitted full census. No partial
coverage is inherited.

## Evidence handling

Public receipts are restated summaries. They contain no home paths, run or
session identifiers, usage accounting or provider telemetry. Full independent
reviews, parent acceptances, transcripts and runtime logs stay private and are
bound by sha256 in `lane-reconciliation.json` and the sanitized execution
summary. The artifact index binds the final public bytes.
