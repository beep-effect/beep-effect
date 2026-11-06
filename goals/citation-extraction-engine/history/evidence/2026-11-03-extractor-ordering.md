# Static source extractor introductions and set iteration

The private required-string selector now returns each extractor's first match
introduction in pinned pyahocorasick order: case-sensitive scan first, then the
independently Python-lowered scan; within each scan, increasing match end,
decreasing matched-key length, then source key-member registration order.
Effect Trie still supplies all prefix matching. Effect HashMap retains only
one earliest event per extractor; Effect Order and Array sort those events.
Repeated occurrences do not create an unbounded event log. Native-word keys
preserve Python scalar/surrogate distinctions. Existing metadata, captured
Clock, deadline, yield and input checks remain in force.

ExtractorOrdering connects these introductions to the existing CPython
RuntimeSet compatibility adapter. It constructs the source unfiltered set,
copies it for each input, adds introductions and reads source bucket order.
Effect services, persistent collections, serialization and timing remain the
shared machinery. No new trie, automaton, process manager or generic set
implementation is introduced. CPython set iteration is a source-specific
compatibility obligation that ordinary Effect HashSet does not promise.

This is a private frozen configuration profile. Hashes and equality classes
at each installed hash are trusted oracle metadata, not raw request authority.
It does not implement dynamic extractor mutation or general source repr.
Source equality can disagree with source repr hashes: equal extra dictionaries
with different insertion order produce different repr hashes and may both
survive the source set. Equal configurations at the same hash collapse. The
observations and target tests retain both behaviors.

## Independent observations and proof

The producer verifies the exact clean eyecite commit/tree, CPython 3.11.15,
Unicode 14.0.0, 64-bit siphash13, hash seed zero, pinned dependencies and the
existing complete extractor-configuration payload. It separately records
actual source get_extractors iteration and automaton introductions. Twenty-two
synthetic bindings and 25 cases cover aliases, unfiltered duplicates, repr/hash
quirks, prefixes, overlaps, casing, contextual lowercase, native surrogate
words and end-order inversions. The target recomputes all 22 synthetic repr
hashes and matches all 25 introduction and final iteration vectors. The prior
23 membership cases and all RuntimeSet copy controls remain required.

Nine focused tests across selector, ordering and RuntimeSet pass after the main
merge. Quick server lint/type checks and scoped Oxlint pass. Repeat generation
with the pinned interpreter is byte-identical after the standard formatter.
The fixture SHA-256 is
92e8c85c63b1efca7bdfc99f12cc5e343fb4ff88a534188e98ffaff545723950.
The producer SHA-256 is
67e9136c263dc7e7307a698b11bcd932d31ad7f5d0fa29f0835d98a411e6b7f0.

Hosted integration now additionally requires every one of the 6,805 canonical
extractor bindings and twelve independent exact membership, introduction and
set iteration vectors. The canonical configuration remains bound to SHA-256
8603461486e165c4cb98f238b58910c269e8d6b59f4a16323c075276e94eec3c.
Canonical source hash/equality metadata is authenticated through the fixture;
canonical repr construction is not claimed from a stored vector digest.
Full installation and canonical replay have not run locally and remain pending
hosted proof. This does not advance full tokenizer, regex family/scaling or
public engine completion. Token construction, merging/overlap, dynamic host
objects and all remaining goal obligations remain open without a scope waiver.
