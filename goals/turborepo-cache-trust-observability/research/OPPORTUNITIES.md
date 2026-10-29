# Friction and opportunities

No implementation receipts yet. Record friction as it occurs: work, minimum
command/error/file evidence, impact, prevention and owner/disposition.
Redact secrets, use portable paths, omit machine/session IDs and keep raw logs
in bounded artifacts.

Historical leads remain in the [exploration ledger](../../../explorations/turborepo-quality-cache/research/OPPORTUNITIES.md)
and [opportunity disposition](../../../explorations/turborepo-quality-cache/research/opportunity-disposition.md).
Refresh historical claims before treating them as current.

### Complete protocol checks at the supervisor boundary

While preparing accepted receipt import, source review found that
`Cache.protocol.runner.ts` checks transport-failure joins inside its worker but
only reruns the six-case observation validator in the outer supervisor. There
is no accepted importer yet, and promotion remains closed. Extracting the full
relationship validator for worker, supervisor and importer use would prevent
validation rules from diverging and make edited transport evidence testable at
the actual import boundary. This is a source-review finding, not a demonstrated
escape or a new native failure.

## 2026-10-28: real native selection exposed inherited legacy flags

The signed reader fallback passed mocked spawn tests but an isolated real-runtime
control failed during native dry selection. Turbo rejects explicit `--cache`
combined with inherited `TURBO_REMOTE_ONLY` or `TURBO_REMOTE_CACHE_READ_ONLY`, even
for a dry run. Inspection now clears those legacy environment flags; forced local
execution also clears them. The real wrapper controls pass on both pinned native
channels, including a resolved-key remote-request positive control. Prevention:
retain native selection and execution proof alongside metadata/argument tests.
Owner: this goal. No production setting changed.

## 2026-10-28: schema compilation belongs at module scope

The signed-client publication preflight found three introduced
`no-inline-schema-compile` findings in access-mode and legacy-boolean parsing.
Hoisted named literal domains and their schema-derived guards to module scope.
Targeted Oxlint, 147 focused tests, package lint/type checks, and both seven-case
real native controls passed again on the corrected source. The unpublished
commit is corrected before pushing. No rule is waived. Owner: this goal.

### Effective cache mode must drive inferred signing role

Review found that role inference combined an explicit cache directive with an
inherited upload mode, even though the native directive outranks that mode. A
keyless local/read-only request was misclassified as a writer. The new boundary
test failed first; extraction of pre-task cache directives now follows that
precedence. Forwarded task arguments do not participate.148focused tests and
ten real native controls per channel pass; explicit writer/canary declarations
still require their signing key. The full default-root package audit/docgen
passed1125.9s/37.3s on the corrected source.
