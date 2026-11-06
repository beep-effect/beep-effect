# Full journal metadata and shared publication composition

The pinned FullJournalCitation.add_metadata calls add_journal_metadata and then
ResourceCitation.add_metadata/guess_edition. The journal helper writes only
pin_cite, parenthetical and raw year, updates full_span_end from the matched
context, and converts a present year with the source import-time ceiling.
Superclass selection uses that resulting year and its distinct live calendar.
The private JournalMetadata adapter preserves that order and publishes the
patch and guess together after success.

## Shared Effect ownership

MetadataComposition extracts the already working law stage's pattern snapshots,
fingerprints, context/capture preparation, pin/parenthetical/year processing,
operation admission, captured Clock, fresh Scope and invocation text budget.
Law and journal keep distinct result schemas and exact source pattern hashes.
An injected stage callback is trusted server composition, never raw request
data. The dependency Context contains the existing Clock, Digest, Spawner and
native-admission owners; it does not retain the installation Scope. The outer
operation lifetime still rejects calls after closure. Each native stage retains
existing acknowledged exit/quarantine ownership. Returned methods have R=never.

Clock is an Effect Context.Reference in the installed Effect version, so it is
captured/provided but is not fabricated as a service requirement in the generic
callback type. An intermediate Clock requirement error exposed that distinction
and was fixed against the installed source, without a type assertion. Shared
schema codecs are hoisted, including the publication configuration codec.

No new worker, transport, scheduler, source protocol, public mode or client API
is introduced. The journal patch omits untouched inherited month/day and pin-span
fields. Its source pattern fingerprint is
1b0484f822d2762ae3517e7a1152feea80d96791582a126e0bd3f8789cb66200;
the exact wrapped profiles come from the independently captured lookahead
corpus. Raw pattern budgets and the captured year-pattern fingerprint remain
unchanged.

## Original source corpus

probe-journal-metadata.py authenticates a clean eyecite 2.7.6 oracle at commit
04d82c032ad5fd0f9ab72a61c87110c46ee8f52e, tree
a35a58fac03400f71a93a93485b77f1d56f2b02f, and Python 3.11.15. It authenticates the
existing law, full-law and lookahead corpora, then executes the actual full
journal method. The corpus has 192 text/year/span inputs and six controlled
canonical-edition configurations, giving 1152 original method observations,
1440 regex calls and 848 edition-year predicate calls. No source helper is
replaced by an expected-output stub; spies delegate to the original methods.

Inputs include all 128 earlier mixed-token law-vector states replayed through
the actual journal method, plus sixteen journal-specific tails crossed with two
prior years and two span-end states. Pin labels/ranges, rejected following text,
Unicode years, year limits, nested/additional parentheticals, native surrogate
points and token stopping behavior participate. Candidate controls retain exact
priority, variation lists, duplicates, prior guesses and filtering. As in the
full-law controls, candidate lists use actual canonical editions across source
families to exercise accepted model state; this is not a claim that the default
tokenizer assigns cross-family editions. The producer independently asserts
that inherited month/day and pin-span-start values remain unchanged.

Producer SHA-256:
b0e9a582bb93ad61956312767d997e731b05bb0af64ad3558d4dec47075ae8f8.
Formatted journal-metadata.json SHA-256:
0ed802a638ba04073c4410ee826a40e463cd1c22b31cb49b895339f232a5aa6f.
Regeneration under PYTHONHASHSEED=127 compares byte-identical after formatting.
The formatted fixture is 345613 bytes, with separate input/control tables to
avoid repeating native text and edition sequences.

## Focused verification and remaining proof

Nineteen focused tests in five files pass across journal, law, full-law,
metadata strings and metadata year. The new journal smoke compares seventeen
complete source patches/guesses and ordered payload reads per actual runtime,
with exactly 21 independently acknowledged child exits per runtime. Shared law
regressions retain their source patches, span behavior, allocation totals,
configuration ownership and full-law superclass selection.

Journal boundary tests prove exact 41-unit allocation, 40-unit refusal without
a patch, fresh repeated-call budgets, and compatible enclosing-budget refusal.
Changing the caller's journal/year buffers and calendar ceiling after install
does not change later results, including the invalid future-year case. Closed
operation lifetime and a captured deadline under a disabled caller Clock refuse
before any child. The journal's four tests pass again after adding mutation
controls. Shared test helpers retain actual retirement/admission assertions and
the explicit frozen source calendar while keeping native sleep/monotonic time.

Scoped package lint/type checks, Oxlint, both policy checks, deterministic
regeneration and new-only Fallow pass. Duplicate source preparation and test
harness fragments were extracted into shared helpers; no suppression, policy
exception, semantic waiver or reduced floor was added. Broad local aggregate
verification and head-install preflight remain deferred under the operator's
hosted-CI instruction; normal commit/push hooks run.

Full hosted replay of all 1152 observations requires 1440 acknowledged child
exits per runtime and remains pending. Complete corrected rendering, case
metadata, custom source protocols, document mapping, references/filtering,
public engine/Layer, 110 regex family safety/scaling reviews and exhaustive goal
accounting/acceptance remain open. This private stage is not completion proof.
