# Native context matching checkpoint — 2026-11-03

The private `ContextMatcher.ts` composes the existing native token context
planner and Effect RPC regex worker. It captures the source pattern, flags,
policy, Clock, runtime, descriptor registry and native admission. Calls require
no services. It preserves `^(?:pattern)` and `(?:pattern)$`, both executed using
search, as in the original `helpers.match_on_tokens`. Results own native context
bytes and complete source-point capture ranges, including group zero, empty
participating groups, unmatched groups and named ordinals. These are internal
positions, not verified document spans or public extraction results.

## Independent source evidence

Producer `ops/probe-context-matches.py` checks the clean oracle commit
`04d82c032ad5fd0f9ab72a61c87110c46ee8f52e` and tree
`a35a58fac03400f71a93a93485b77f1d56f2b02f`, Python 3.11.15 and regex
2023.12.25 V0. The original helper executes unchanged; a recording wrapper around
its final search delegates to the original search rather than replacing its
result. Wrapped profiles come from the pinned regex engine's parser.

Eight patterns include the actual POST_LAW_CITATION_REGEX and YEAR_REGEX,
named optional/unmatched captures, a participating empty group, verbose syntax,
and greedy/lazy nullable optional captures. Eighteen configurations per pattern
produce 144 observations: 136 search calls, eight source IndexErrors and 82
successful matches. They retain forward/backward anchoring, token stops,
prefixes, negative indices, 300-point slicing, scalar versus literal-surrogate
words and oversized standalone prefixes. This finite corpus does not claim
exhaustive helper grammar or extraction parity.

Producer SHA-256:
`2ab68a752308b5b4a0a1fa8b01ff066223b7f335705ca8b40b866e31c39d0980`.
Formatted context-matches.json SHA-256:
`4b91de078a8cd6fedcd2c01fb98f3ef525497d207340265f4ff1318b5cea564d`.
Regeneration and formatting compare byte-identical.

## Fidelity correction

The real law pattern exposed native JavaScript's discarded captures from a
nullable optional iteration: Python's pin_cite capture participates with an
empty range where the native optional quantifier reports unmatched. The
compiler now lowers a nullable capturing body repeated zero or one times to
ordered noncapturing alternation. Greedy bodies precede the empty alternative;
lazy bodies follow it. Source group identities, profiles and raw fingerprints
remain unchanged. The additional bounded structural tokens are preflighted.
No divergence or source fixture adjustment hides this mismatch.

## Allocation and lifecycle

The context plan reports its retained-input-plus-output text units and output
units. The matcher checks the worker's additional context copy against the same
produced-text ceiling before native acquisition. The boundary test rejects
three input units plus two three-unit copies at limit eight, spawns nothing,
recovers on a fresh empty call and accepts exactly nine. Mutating a returned
buffer does not affect the next result. Mutating the installation input pattern
after capture does not change matching. Pattern and transport ceilings remain
separate existing bounds; this is not a complete physical-memory proof.

The shared actual-runtime fixture uses Effect Clock, native process admission,
ChildProcessSpawner, scoped directories and the existing observed exit helper.
No new process protocol or lifecycle implementation is introduced.

## Validation and limits

Twelve focused tests in four files pass: CitationContextMatcher,
CitationTokenContext, CitationRegexNullable and CitationRegexVerbose. The new
matcher smoke observes forty spawned and forty independently confirmed exits
under each actual runtime, plus the allocation/ownership controls. Native
admission returns to zero without quarantine. Server quick package verification
passes lint and source/test type checks.

Hosted integration replays all 144 observations, requiring exactly 136 spawned
and confirmed exits per runtime. That new-head proof is pending publication;
local smoke is not substituted for it. Metadata assignment, year bounds,
remaining helper syntax, full extraction/document integration, nullable
finditer, family safety/scaling and all other open goal duties remain open.

Scoped Oxlint, schema-first and Effect/Vitest policy checks, new-only Fallow
audit and the portable divergence audit pass. No new policy exception or
quality-floor adjustment is introduced.
