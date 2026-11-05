# Positive capture witnesses for every captured source extractor

A separate pinned CPython 3.11.15 / Unicode 14 producer constructs one bounded
positive witness for each of the 13,610 identity-ordered source extractor
instances. It reads the existing hash-authenticated source artifacts and checks
the exact clean eyecite commit/tree. The frozen parsed-feature builder produces
input data only: it chooses a short literal/branch/repetition witness and
rejects unseen opcodes, anchors or scoped flags. CPython re independently
compiles the original source pattern and decides every match and capture.
The pinned source TokenExtractor.compiled_regex uses re.compile and its
get_matches uses compiled_regex.finditer (eyecite/models.py:832,844-848).

Every constructed witness matches in CPython. Two copies are placed after one
astral scalar and two literal surrogate words, yielding 27,216 total source
matches. The producer also independently confirms that all 13,610 extractors
return no matches on empty input. All captures, including structural and
unmatched groups, retain Python source-point coordinates. The complete source
is stored as little-endian native words in base64, never as a JavaScript string
that could collapse the scalar/literal-surrogate distinction. Source point and
UTF-16 lengths are recorded independently.

The fixture binds source hashes, producer/reader hashes, oracle license,
identity order, a complete capture vector and sixteen exact range hashes.
Two complete generations are byte-identical. Current artifact SHA-256:
5967ecb29a91966896395287932688b4bfbc91f15d2d0b8231911aa517f48060.
Each case occupies one producer-owned line, as with the descriptor catalog;
Biome delegates only that authenticated generated JSON artifact to its producer.

Extend the existing hosted program shards to use the actual isolated-child
RegexWorkerEvaluation implementation. Each source descriptor is rebound and
freshly compiled, the original native source words are prepared, and every
returned group span is compared to the CPython matrix. A second call on empty
input uses remaining-match quota zero and requires a complete zero-match result.
The parent requires all original aggregates plus exactly 13,610 witness cases,
27,216 matches and 13,610 empty-input cases. No source instance or prior scalar,
alphabet or controlled-capture assertion is removed.

The existing sixteen shards and baseline remain bounded at concurrency two,
90 seconds per child, 2,048 reply bytes, empty environment and independent exit
acknowledgement. No production safety policy changes. A separate explicit
--witness-smoke mode selects fixed indices 0,6800,13609; it cannot satisfy the
full hosted parent's exact counts and does not substitute for the full run.

Local verification: the fixed smoke uses the production evaluator and passes
three positive cases/six exact capture matches plus three zero-quota no-match
cases; its bounded child exits successfully. Server test compilation, subject
bundling, scoped lint and new-only Fallow pass. The pinned Python producer is
run with a 30-second parent watchdog. Full target matching is hosted proof
pending its new run; it is not executed in the responsive parent.

This is positive and empty-input evidence for every captured extractor, not
exhaustive matching, static family review, adversarial scaling, complete Python
feature support, routing or public engine approval. All 110 family obligations
and the full goal completion audit remain open.
