# Effect Trie extractor selection

## Source contract

The exact clean oracle commit 04d82c032ad5fd0f9ab72a61c87110c46ee8f52e, tree
a35a58fac03400f71a93a93485b77f1d56f2b02f, defines required-string membership in
AhocorasickTokenizer.__post_init__/get_extractors (tokenizers.py 420-443).
Extractors with no required strings are always selected. Case-sensitive strings
match original text; case-insensitive strings and the input are independently
lowercased with Python str.lower(). Any listed string suffices. Matches may
overlap and a longer matching key must not hide its matching prefixes.

This private component returns membership in stable configuration-index order.
It does not claim Python set iteration order. Source TokenExtractor hashing uses
hash(repr(self)); that ordering and tokenizer token merge/overlap behavior remain
separate obligations. The source initializer also reads the module-global
EXTRACTORS; this helper does not define a public custom-tokenizer override.

## Upstream reuse and native words

Effect Trie owns storage and longest-prefix lookup. Effect HashSet owns selected
indices and the seen-key set. The implementation neither copies trie internals
nor builds a separate automaton. Each source-word offset performs one primary
lookup. Each newly matched key is expanded once per selection pass; the next
lookup uses that key's proper prefix. Already seen keys stop prefix expansion.
Thus prefix lookup count is bounded by scanned original/lowercase points plus
newly matched keys, rather than repeatedly expanding identical matches.

Each original Python word becomes exactly two internal UTF-16 units: the high
16 bits (0..16) followed by the low 16 bits. Scans start only at two-unit
boundaries and stored keys contain complete words. No first unit can be a high
surrogate, so native scalar values cannot collide with literal surrogate words.
These strings are private index keys, never source projections or diagnostics.
Python lowercase uses the previously qualified frozen Unicode 14 adapter.

Trusted installation rejects duplicate IDs, empty literal keys and unsupported
flags; source profiles use flags 0/2. Metadata row/key counts are schema-bounded.
Before copying native key buffers, total bytes must fit the existing maximum
pattern-storage envelope (4 * effective patterns * patternUtf16), and each key
must fit the effective per-pattern point/UTF-16 bound. The private installation
profile is not a new raw request or public extension. Native buffers are copied
before asynchronous index construction and only immutable encoded keys remain.

Selection captures the existing minimum extract/operation deadline and Clock,
checks native inputs through the existing Unicode adapter, and yields during
encoding, source scans and long prefix chains. Failures contain closed reasons,
not source words. No partial membership vector is returned. Pattern execution
still requires its independent descriptor, family and physical-worker authority.

## Independent proof and pending hosted replay

The producer uses the exact clean source and CPython 3.11.15 / Unicode 14,
PYTHONHASHSEED=0, and verifies all installed oracle dependency versions against
the frozen operation corpus (including pyahocorasick 2.0.0, reporters-db 3.2.53).
It temporarily supplies sixteen distinct synthetic extractors to the unmodified
source initializer, records 23 membership vectors, and restores module state.
Controls cover unfiltered entries, multiple keys, prefix/substring overlap,
repeated text, insensitive matching, dotted I/contextual sigma, newer Unicode
characters, supplementary points, literal surrogate words and zero bytes.

It also records twelve independent membership vectors for the complete default
configuration: 6,805 extractors, all distinct by source equality. The configuration
payload exactly matches the existing operation artifact
8603461486e165c4cb98f238b58910c269e8d6b59f4a16323c075276e94eec3c.
The producer rejects canonical required strings containing literal surrogate
words before relying on JSON-to-JavaScript string transport for those metadata
keys. Synthetic native-word controls retain those distinctions explicitly.

Hosted integration reads and authenticates the existing operation corpus,
authenticates the exact configuration payload, prepares every canonical key,
installs all 6,805 bindings and compares all twelve default-source membership
vectors. That full installation/replay was not run locally and awaits hosted
proof. It cannot be replaced by the synthetic subset.

Local checks: seven selector/lowercase tests pass, including all 23 synthetic
membership vectors, bounded query counters, duplicate-index rejection, empty
input, installed-buffer immutability, metadata limits and captured deadline
behavior despite a caller Clock override. Server test compilation, quick package
lint/check, scoped Oxlint and zero-finding new-only Fallow pass. Repeat producer
output is byte-identical after formatting. No source family, timing/scaling,
set-order or public engine completion row advances.

Fixture SHA-256: 5ce66c09303e4629f63f75baae41b992913d584b0e95fcd7c8f15b5162b697fc.
Producer SHA-256: 96bd675f5f6f5bf9c7593b7b843157b104102e7cee416afdaff7b19545bbaf8b.
