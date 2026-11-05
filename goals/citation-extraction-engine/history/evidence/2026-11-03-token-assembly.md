# Mixed-token assembly control flow

The private assembly stage follows pinned Tokenizer.tokenize: filter only data
None, stable-sort by start ascending/end descending, attempt merge before
overlap handling, replace a nominative reporter when the incoming token is a
citation, append intervening literal-space text parts, and retain the exact
special-token indices. Empty-data tokens remain present but are false for
merge/overlap guards. Equal sorting keys retain extractor/match input order.
Base token merge compares span/class/groups while ignoring data equality;
source host observations include that counterintuitive case.

Effect Array and Order provide stable sorting. Effect MutableList provides
result assembly. Holding one pending token implements source last-token removal
without a custom stack: previous text remains emitted when nominative overlap
replaces only the final token. No partial result escapes a failed operation.
Candidate count includes filtered/discarded input and total output token count
includes both text and special tokens. Existing captured timing is reused.

A typed captured Context.Service supplies current token views, merge truth,
nominative classification and bounded native text-gap planning. Every method
has R = never. Token identities refer to that captured host, not global or
persisted entity IDs. Requests contain schema data rather than callbacks.
This private profile requires immutable spans/data/classes during assembly;
edition state can change through merging. General custom span/data mutation
and the concrete target source-token host are still unimplemented obligations.
The native text planner is exercised by the target protocol replay.

## Independent source evidence

The producer verifies the clean pinned eyecite commit/tree and CPython 3.11.15.
It executes actual Tokenizer.tokenize using actual Token, IdToken and
CitationToken objects and actual source merge/nominative functions. It records
callback decisions without substituting their implementations. The corpus
contains an empty token sequence, every single object and all ordered pairs/triples of
eight configurations, plus repeated aliases and directed controls: 407 cases.
It covers stable ties, null data, empty truth, unequal data merging, overlapping
citation classes, nominative replacement and later text gaps. Native source
regex extraction is replaced only by the explicitly supplied token sequence.

All mixed output items and exact special-token indices match. Target execution
must consume all 1,247 source host events in order: 569 merge, 117 nominative
and 561 text-gap calls. The target host replays source merge/classification
decisions; this proves assembly control flow, not target merge semantics.
A separate control checks candidate exhaustion, total mixed output exhaustion
and propagation of a closed host failure without a result.

Five focused assembly/plain-text tests pass, including every prior 1,561 text
case. Quick server lint/type checks, scoped Oxlint and zero-finding new-only
Fallow pass. Repeat generation
is byte-identical after formatting. Full latest-head hosted proof is pending.
Producer SHA-256:
a88faec194b28e73cdf7d89e671b34a3a46852d3adb12e894d396c6a1239dc58.
Fixture SHA-256:
b6d461dc31b470402b509dba81c39e471ecfcbb4cd1f7b236b201b875ecc5391.

Source token construction, concrete native gap ownership/aggregate reservation,
edition-set merge order and mutation, full regex/tokenizer connection, custom
tokenizer semantics, family/scaling and public engine integration remain open.
No full tokenizer completion or semantic waiver is asserted.
