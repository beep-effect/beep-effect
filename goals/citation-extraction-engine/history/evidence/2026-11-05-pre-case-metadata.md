# Pre-case metadata source parity

The private PreCaseMetadata adapter ports the pinned eyecite 2.7.6
helpers.add_pre_citation behavior. Existing plaintiff/defendant values skip
before word/context processing. Otherwise it searches backward with the exact
PRE_FULL_CITATION_REGEX, cleans the pin with the existing native cleaner, and
returns only the antecedent, pin and source-start updates. No-match and early
skip return no patch. A missing raw pin preserves the previous pin-span start.
Source span overrides can produce negative starts; these remain unverified
model-state integers and never become verified mention spans.

## Existing Effect owners

The adapter reuses shared metadata operation admission, captured timing,
invocation text budgets, pattern snapshots, native context matching and fresh
Scope ownership. The worker remains the existing typed Effect RPC/process
implementation, including independently acknowledged retirement. Returned
methods have R = never. No scheduler, transport or regex runtime is added.

Law, journal and pre-case stages share the context-origin schema/builder and
owned capture matcher. The native pin cleaner is independently reusable;
parenthetical/year processing retains its existing behavior. Test fixtures
share the native Unicode carrier and closed-lifetime assertion. Scope.close
requires Effect's Closeable scope type; the helper now declares that exact type.

## Original source observations

probe-pre-case-metadata.py authenticates the clean oracle at commit
04d82c032ad5fd0f9ab72a61c87110c46ee8f52e, tree
a35a58fac03400f71a93a93485b77f1d56f2b02f, Python 3.11.15 and pinned regex V0.
The actual source helper runs on actual FullCaseCitation instances. A search
spy delegates to the original implementation and verifies wrapper and flags.
The corpus crosses 27 vectors, five plaintiff/defendant states, two source
starts and two prior pin-span states: 540 observations, 324 searches and 216
early skips. Independent assertions retain untouched end/year/name fields.

Vectors include pin labels/ranges, Unicode decimals, native surrogate states,
mixed tokens, paragraph boundaries and the 300-point context boundary. Width
and repetition profiles come from the existing CPython parser probe; actual
V0 compilation checks group identities and the source helper supplies observed
results. This is not an independently walked V0 syntax-tree proof.

Raw PRE_FULL pattern SHA-256:
`d151b7a02a061593bb44bd881eee2dc174fff7f1b5449512f25cc2b98fb315b0`.
Producer SHA-256:
`18c2ed6e9f30b4066a27fc92ec02163a4c7396e05f765d66710d370380868a4c`.
Formatted fixture SHA-256:
`6cfd521369b960f677231e9e5c9ca2981c6dc0ca6c0f7e9edf551f01c3dda4bd`.
Regeneration with PYTHONHASHSEED=139 compares byte-identically after formatting.

## Verification and limits

Nineteen focused tests across five files passed after the shared refactors.
The final four pre-case tests pass again after adding negative-start controls.
Each actual runtime compares 230 source rows (all 216 skips and fourteen
searches), with fourteen independently confirmed worker exits. Fifteen smoke
cases cover both negative-start controls. Complete hosted replay remains
pending: 540 observations and 324 confirmed exits per runtime.

The allocation control independently matches the source capture layout:
22 word units, 51 context units, six raw-pin capture units, eight antecedent
units, six pin receiving units and six cleaned-pin units total 99. A 98-unit
budget refuses without a patch; an enclosing 102-unit budget primed with four
units refuses with 97 used. Repeated calls get fresh budgets. Mutation of
caller pattern/year buffers after installation does not affect later output.
Known names skip invalid word/span inputs without allocation or child creation.
Closed lifetime and a captured deadline refuse before spawning.

Scoped server lint/type checks, Oxlint, Effect-test/schema-first policy checks,
deterministic regeneration and new-only Fallow pass. No quality floor, raw
pattern ceiling, exclusion or semantic waiver changes. Broad local aggregate
proof and head-install preflight are deferred under the operator's hosted-CI
publication instruction; normal commit and push hooks remain enabled.

Hosted Check job 127529995931 on 7bd1163fd2 reported six remaining
yieldInCallArgument diagnostics in CitationEngineLimits, CitationOracleArtifact
and CitationSafetyFailure tests. Each effect now binds its result before the
assertion/decoder call. All nine affected tests pass and the use-cases package's
scoped lint/type checks pass. The reviewer check's draft-status concern is
reconciled in GOAL.md with the operator's later explicit ready-for-review
instruction, without changing completion or merge authorization.

Post-case/court/name/HTML metadata, complete case composition and corrected
rendering remain open, alongside the public engine/Layer, document mapping,
references/filtering, custom protocols, fresh-process hashing, whole-engine
accounting, exhaustive dispositions and 110 family safety/scaling reviews.
This private helper does not close the goal's acceptance gates.
