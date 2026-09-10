# Instance

- id: `docgen-subject-collection-outcome`
- exact source SHA: `93217d998f851e2e93d9864e2b5315552eaa58a7`
- corpus `origin/main`: `d1b4d769fbaffddd55717f3b1ba461897dd545c5`
- file:line: `packages/tooling/tool/cli/src/commands/Docgen/internal/quality/Quality.subjects.ts:910`
- symbol: `PackageSubjectCandidateResult`
- members: `timedOut`, `status`, `error`
- evidence: E1 at `Quality.subjects.ts:966-971`, `:1004-1009`.
- cardinality: 12 representable / 2 legal; stored; internal; Tier 1.
- refresh receipt: `../data/design-refresh-2026-09-09-r28-docgen-files-impact.md`
- prior design: `../history/designs/2026-09-09-pre-main-d1b4d7/docgen-subject-collection-outcome.md`

P2 design only. Short source paths are relative to
`packages/tooling/tool/cli/src/commands/Docgen/internal/quality/`.

# Current shape

The exported internal collector class at `Quality.subjects.ts:903-915` stores
candidates, nullable string error, shared three-literal
`DocgenQualityPackageStatus`, and timedOut Boolean. The collector returns plain
objects satisfying that Type: partial/true/message at the budget check
`:965-971`, completed/false/null at `:1004-1009`. Exceptions fail the Effect
through `DomainError.newCause` at `:1011`; no failed status is emitted here.
`Quality.service.ts:275-293` is its sole production result consumer.

The latest source refactors declaration collection into helpers at
`Quality.subjects.ts:423-583`; it does not change the outcome or its two writes.
Preserve assignment/local-export/direct-statement collection order, overload
filtering, default export names/anchors, raw JSDoc attachment, module-specifier
and alias exclusions, and final name/declaration deduplication. These are
source-analysis rules, not additional outcome states.

# Cardinality gap

Three status literals times two timedOut values times null/string error
presence yields 12 tuples. Two are legitimate: completed/false/null and
partial/true/string. Failed exits through the Effect and becomes a failed
package report later, not a third collector case. Candidates remain the complete
required array on either arm, including empty/partially accumulated arrays.
Do not count array emptiness, string content, or duration as invented axes.

# Target schema

Keep the owner in `Quality.subjects.ts`. Reuse the existing
`DocgenQualityPackageStatus` literal family at `Quality.schemas.ts:160`: derive
the completed/partial subset with its `pickOptions` and LiteralKit. Define
annotated `PackageSubjectCollectionCompleted` (completed, candidates) and
`PackageSubjectCollectionTimedOut` (partial, candidates, required string error)
classes. Assemble through the subset kit's `mapMembers` and
`S.toTaggedUnion("status")`, retaining `PackageSubjectCandidateResult` as the
schema/derived Type. Do not retain timedOut or completed.error getters.

The package report has different payload ownership and a failed arm. Do not
reuse its whole union or merge its separate Tier-2 design into this collector
change. Construct cases directly at both writes; no legacy JSON decode is
needed for known producers.

# Migration inventory

| Current source | Required change |
| --- | --- |
| `Quality.subjects.ts:883-915` | Replace class and `.make` example with annotated cases/union. Preserve candidates schema and full error string. |
| `Quality.subjects.ts:966-971`, `:1004-1009` | Replace plain-object satisfying returns with case construction, preserving partial candidates, timeout message, source order, and exception mapping. |
| `Quality.service.ts:275-284` | Finalize all candidates, dedupe by stable identity, sort, and attach snippets before determining final package outcome. |
| `Quality.service.ts:285-293` | Match collector status: partial forwards its required error and timedOut=true; completed checks the later budget once and selects completed/null/false or partial/new timeout message/true. Project into current package-report options. |
| `Quality.service.ts:295-309` | Preserve outer Effect failure conversion to failed/error/timedOut=false, including finalization/snippet failures following a partial collection. |
| package `package.json:60`, `:130` | Preserve blocked Docgen internal subpaths. This exported internal schema is absent from the public facade; do not broaden exports for its old example imports. |
| `test/docgen.test.ts:2190`, `:2256`, `:2398`, `:2538`, `:2604`, `:2773`, `:2846`, `:2905` | Preserve internal-tag, overload, local/default export, re-export, timeout and exclusion fixtures; add outcome and later-budget cases. |

The named-symbol/result-member searches found only this collector and
`analyzePackageQuality` consuming its result, plus its constructor example.
No independent persisted writer, codec, or direct named test constructor was
found. Test changes must use allowed package/test entry points; no new public
internal-subpath export is required.

# Guard-deletion accounting

- Delete collector timedOut and completed's nullable error slot.
- Delete collector-derived OR at `Quality.service.ts:285`, status
  reconstruction at `:286`, and nullable-error fallback at `:287`. One status
  match forwards partial's required message; completed checks later expiry.
- Keep `budgetExceeded` at collection `Quality.subjects.ts:965` and after
  finalization. The original OR skips the later check for already timed-out
  collection; preserve that behavior. Completed collection can expire later.
- Keep package-report legacy projection until its separate design lands.
  No removal of report fields, runtime timing, source filters, or Effect error
  conversion is claimed here.

# Encoded-side impact

No independently encoded collector contract. Downstream
`DocgenQualityPackageReport` keeps its completed, partial, and failed triples,
schema version, summaries, subjects, reviews, timings, and error strings.
`Quality.service.ts:288-305` remains the adapter for this flow. Do not serialize
the collector tagged object or change package-report JSON as a side effect.
Coordinate with the report's separate Tier-2 design if applied concurrently.

# Test impact

Cover completed empty/nonempty candidates, timeout before the first source and
after retained candidates, exact timeout text, and collector exceptions. Cover
completed collection followed by expiry during finalization/snippet attachment,
partial collection's message retention, and finalization failure producing the
same failed package report. Assert the report's legacy triple separately from
the internal union.

Keep `test/docgen.test.ts:2604-2771`'s updated default-export fixture: upstream
adds assignment JSDoc, a literal default export, and export-equals exclusion;
four default subjects are expected at `:2748`. Keep timeout JSON assertions at
`:2846-2903` (schema version two, partial/true/message) and exclusions at `:2905`.
These protect extraction behavior while constructors and the result adapter
move. Do not add tests merely to mirror helper names or count required arrays.

At implementation run focused Docgen tests and full `@beep/repo-cli` package
verification. This design-only refresh ran neither.

# Risk and sequencing

Tier 1; it does not depend on generation's now-Tier-2 JSON change landing first.
Coordinate with the package-report Tier-2 migration to avoid competing edits
in `Quality.service.ts`. Preserve traversal, partial data, exact messages,
later-budget semantics, and error mapping. Independent P3 must review this
current-source design before implementation; this audit is not P3.
