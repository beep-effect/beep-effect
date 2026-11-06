# Approved native HTML resource failure

Date: 2026-10-29. Scope: public safety error and private completion guard only.

The human explicitly answered “Approve explicit safety divergence (Recommended)”
to the native HTML resource exhaustion proposal. The authoritative local
[decision record](../../ops/html-safety-exception.json) retains the exact question
identifier, answer, oracle and source audit digest. It supersedes the
[historical hold](./2026-10-29-html-safety-hold.md). This records conversation
provenance; it is not a cryptographic authentication of the human reply.

The public CitationSafetyLimitExceeded schema carries only operation and a
closed resource name. CitationSafetyBudget includes the unchanged 29 policy
fields plus nativeHtmlParserResource. This dependency-owned category adds no
configurable limit. No source text, native message, cause or partial result is
included in the error codec.

The private completeCitationHtml guard decodes sanitized adapter diagnostics
before accessing returned text. An observed depth-limit classification yields
CitationSafetyLimitExceeded for clean/nativeHtmlParserResource. A getter test
proves the partial value is never read. Ordinary diagnostics, including fatal
non-resource Unicode recovery, retain their source output. This classification
is trusted adapter data; it is not a request-controlled failure override.

Focused replay authenticates the unchanged source audit by its complete file
digest. Of 69 cases, three depth-limit completions fail explicitly and the
other 60 successful completions retain exact values. Six source exceptions are
counted separately and are not implemented or proved by this completion guard.
The source-only fixture keeps targetProof and divergenceApproval null: authority
belongs to the separate human decision record. Corruption controls reject
broader scope, changed source evidence and fabricated backend qualification.

The use-cases and server package quality gates cover the new declarations and
focused tests. This proof does not run a target HTML parser. Native parsing,
Unicode and wrapper parity, worker containment, effective policy deadlines,
error translation and linked-library notices remain open. No canonical row or
normalization law is marked complete. Full public failure union, engine service
and live Layer retain their original delivery obligations.
