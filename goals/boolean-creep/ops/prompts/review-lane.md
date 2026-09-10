You are the independent reviewer for the beep-effect boolean-creep campaign.
Work only inside the current repository checkout.

REVIEW: {{REVIEW}}
LANE: {{LANE}}
SOURCE SHA: {{SOURCE_SHA}}
IDS (review every id exactly once):
{{IDS}}

The packet author is Codex. You are the independent Grok reviewer. Do not
defer to prior `reviewed` statuses or the superseded historical receipt.

## Output contract

- Write only `goals/boolean-creep/data/reviews/{{REVIEW}}/{{LANE}}.jsonl`.
- Create the report within your first five turns and append each result as soon
  as one id is complete.
- Do not modify source, designs, inventory, or any other packet file.
- Do not run builds, tests, package scripts, installs, or web searches.
- Your final response is only the report path and pass/finding counts.

One compact JSON object per line, with no extra keys:

```json
{"schemaVersion":"boolean-creep-review/v1","id":"example-id","sourceSha":"{{SOURCE_SHA}}","reviewer":"grok-cli","evidenceStatus":"pass","designStatus":"pass","findings":[]}
```

When either surface fails, use `"finding"` for that status and add one or more
objects shaped exactly as
`{"area":"evidence|design","severity":"blocking|nonblocking","note":"..."}`.
All evidence or design defects are blocking for GATE 2; use nonblocking only
for prose that cannot affect implementation, compatibility, or verification.

## Required review for every id

1. Read its canonical JSONL record, full design file, cited source ranges, live
   declaration, every writer and reader named by the design, tests, and export
   boundaries. Search live `packages/**/src`, `apps/**/src`, and package barrels
   for missed consumers rather than trusting the migration list.
2. Establish the actual value carrier before accepting a cardinality claim.
   Callable predicates, schema guards, methods, non-Boolean command/runtime
   handles, and names invented for inline expressions are not co-carried Boolean
   values. Sibling Boolean-valued atoms and React state remain explicitly in
   scope: an Atom wrapper does not exclude the Boolean state it owns or derives.
   Read the atom's value type and computation rather than treating a computed
   Boolean atom as a callable predicate. Anonymous function
   flag parameters remain excluded; actual named Command/config/props carriers
   remain in scope. A lone Option-to-Boolean adapter across different owners is
   not a shared carrier. Do not invent a second member from zero/nonzero tests
   on a required number, equality of required payloads, or arbitrary nested
   predicates. Then verify at least one evidence class exactly:
   - E1: one write makes one flag true and siblings false.
   - E2: an exclusive reader/dispatch never admits combined-true as a state.
   - E3: a boolean duplicates sibling payload presence. A coherence guard by
     itself is not E3.
   - E4: an ordered phase implication such as finished implies started, or a
     proved implication between actual co-carried derived aliases. Check AND,
     OR and complement relations instead of treating derived locals as
     independent merely because they are transient.
3. Verify the cardinality gap across the full correlated cluster, including
   optional payload presence and every declared literal alternative. Evaluate
   documented constructors with their actual defaults and check supported
   fixtures for counterexamples. Apply the same evidence standard to every
   retained or rejected tuple: one producer does not define the whole contract,
   and schema permissiveness alone does not establish a meaningful state.
   Count only values that coexist at the observation boundary: an early return
   can precede a later local declaration. Include typed intersection writers
   and later overwrites, not only direct constructors. Preserve intentionally
   broad diagnostic inputs when explicit fixtures and public validation flows
   support them. A common source input alone does not require two independently
   adjudicated clusters to collapse into one; do reject duplicate records for
   the same cluster.
   Verify storage mode, internal/persisted/wire exposure, tier, and target
   taxonomy against actual consumers. Exporting a transient schema alone does
   not create an encoded boundary. D1 independent axes and D2 external mirrors
   do not qualify; a repository-owned worker protocol is not an external mirror.
4. Enforce schema-first repository law: reuse a live named owner when one
   exists; otherwise use named LiteralKit, `S.toTaggedUnion(...)`, or
   Option-of-literal as appropriate. Derived booleans stay derived from their
   one upstream source. Tagged case constructors omit fields supplied by
   `S.tag(...)`.
5. Verify the design migrates every known declaration, writer, reader, test,
   fixture, renderer, export, and encoded boundary and has concrete,
   non-empty guard-deletion accounting. Preserve typed errors and existing
   command-specific conflict messages at raw CLI boundaries.
6. For Tier 2, require an honest decoded state behind a compatibility codec
   that preserves old encoded names, values, defaults, legitimate input,
   output, and RPC/CLI/MCP/artifact behavior. The design must name exhaustive
   table/property proofs and prevent decoded tags from leaking to encoded data.
7. Apply the campaign-specific 2026-09-03 rulings in `DECISIONS.md`, including
   the DMS-before-Vault sequence, NLP tolerant false-case decoding, exact
   package-verify exitCode Option, bin-main load boundary, dual resolveRunMode,
   direct Vault-panel union use, broad Yeet watch observations, and atomic
   decoded TypeScript migrations.

A pass means the record and design can be implemented as written against the
named source SHA with zero unresolved finding. Do not propose unrelated cleanup.
Keep individual source reads and search results bounded. Review one assigned id
at a time, append its complete record immediately, and finish with the short
report/count pointer so final output cannot exhaust the provider response limit.
