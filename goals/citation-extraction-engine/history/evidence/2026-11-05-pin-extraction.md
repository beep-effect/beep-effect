# Source short/Id./supra pin extraction

The private PinExtraction adapter ports helpers.extract_pin_cite from the pinned
eyecite 2.7.6 source. It resolves the Python list index before matching, searches
forward with POST_SHORT_CITATION_REGEX and the supplied native prefix, cleans
the pin and parenthetical, and returns the original helper tuple plus allocation
usage. The selected built-in token's captured end remains unverified model state.

The source uses len(raw_pin.rstrip(", ")), not the cleaned pin's length or the
whole regex match end. A successful empty match still returns token.end minus
the original prefix length. Prefix subtraction counts Python points, preserving
the distinction between a supplementary scalar and adjacent literal surrogates.
Negative list indices and negative resulting ends remain source data, not
verified mention spans. Out-of-range lookup precedes matching; a selected string
fails at token-end access after matching and parenthetical processing.

## Shared Effect and string owners

The adapter uses existing publication pattern authentication, metadata operation
admission, captured timing, fresh native Scope, context matching, typed worker,
acknowledged retirement and fresh/enclosing invocation text budgets. Its returned
method has R = never. A shared publication-operation installer now serves both
pre-case metadata and pin extraction; its callback is trusted server composition,
never request data. No new worker, transport or scheduler is added.

The existing pin cleaner now exposes CitationPinCiteDetails: its unchanged cleaned
native result and the source right-trim length. Existing cleanPinCite callers
delegate to that same operation without additional native copies. All-stripped
input explicitly has right-trim length zero while retaining the existing empty
slice behavior. Native parenthetical processing and its year matcher are reused.
Shared test installers and lifetime/refusal assertions retain the actual runtime,
captured deadlines, independent exit counters and budget-owner checks.

## Original source corpus

probe-pin-extraction.py verifies the clean oracle commit
04d82c032ad5fd0f9ab72a61c87110c46ee8f52e and tree
a35a58fac03400f71a93a93485b77f1d56f2b02f under CPython 3.11.15 and regex
2023.12.25 V0. Spies delegate to the actual search/match methods, verifying exact
POST_SHORT and YEAR patterns and flags. The actual helper supplies every tuple
or source indexing/token exception; no expected-output stub replaces it.

The corpus has 432 source observations and 453 source regex calls. It crosses
21 tails, five prefixes, two token ends and positive/negative index forms, then
adds twelve token-stop, missing-data, long-context/prefix and error controls.
Nine further source pin details cover null, empty, all-stripped, Unicode and
surrogate input. Native token data and the selected token end are separate
captured built-in fields, not a custom Python-object protocol.

The exact raw pattern fingerprint is
`3d1b06d98647ef244e02b08aee15ff80a0fb3971528a8a9c97854dd35916bb3d`.
Wrapped group names/counts compare with actual V0 compilation. Width/repetition
profiles use the existing CPython parser probe; this is not a separately walked
V0 syntax-tree or family safety/scaling proof. The raw pattern fits existing
policy. No ceiling, exclusion or semantic waiver changes.

Producer SHA-256:
`ef8280a91ea82f96b638064629e0fb4dbf4c0b6b615b3d09730574cb19798117`.
Fixture SHA-256:
`0874170bf716c53337fbb17f75819b2af7ed890b999de4d86b0b585902c82f75`.
The formatted fixture is 317375 bytes. Regeneration under PYTHONHASHSEED values
167 and 173 compares byte-identically after formatting.

## Focused proof and remaining acceptance

Both actual Bun and Node compare 24 smoke observations and confirm 24 worker
exits each, including the source error routes. The nine shared cleaner details
also compare. The exact allocation control uses nine word units, three six-unit
context copies, a six-unit pin capture, six-unit pin receiving copy and five-unit
clean result: 44 units. A 43-unit budget refuses after one confirmed worker exit.
An enclosing 47-unit budget primed with four units refuses with 43 units used.
Repeated calls get fresh budgets and post-install pattern-buffer mutation does
not affect output. Closed lifetime and the captured deadline refuse before a
child is created. Existing pre-case allocation totals remain unchanged.

The final focused wave passes 23 tests in six files across pin extraction,
pre-case, law, full-law, journal and metadata-string processing. Scoped server
lint/type checks, Oxlint, both Effect-test/schema-first policy checks,
deterministic regeneration and new-only Fallow pass with zero introduced
findings. Shared installer, refusal and lifetime helpers remove repeated setup
without suppressions, type assertions or changed quality floors.

Full hosted replay of all 432 observations requires 453 independently confirmed
exits per runtime and remains pending. The full-case post pattern still needs
V0 repeated-name capture support and reaches the current default raw-pattern
budget; this stage does not remove or hide either obligation. Court/name/HTML
metadata, public engine/Layer integration, custom protocols, fresh-process
hashing, whole-engine accounting, dispositions, family safety/scaling reviews,
hosted coverage/quality and exhaustive acceptance remain open. Broad local
aggregate verification and head-install preflight remain deferred under the
operator's hosted-CI publication instruction; normal hooks remain enabled.
