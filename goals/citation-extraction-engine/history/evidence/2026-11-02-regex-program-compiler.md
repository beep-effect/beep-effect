# Native-point regex program compiler checkpoint

The private data-only compiler reads canonical native pattern words and emits
bounded structural tokens and canonical atom sets. It preserves capture numbers
and ASCII names, alternatives, greedy/lazy repeat bounds, source-point minimum
width and repeated-capture/nullable-loop profiles. Dot excludes original LF;
Python dollar is lowered using the LF predicate and strict end is separate.
Frozen source categories and reviewed ASCII ignore-case closures are resolved
before class negation. Repeated category escapes merge incrementally.

Program/token codecs own balanced grammar, capture/name bindings, valid atom
references, canonical token fields and the LF predicate used by dollar. Rendering
checks both codecs and equality of the complete original atom descriptors.
Decoded profile metadata is not an execution capability. Unsupported grammar,
non-reviewed non-ASCII case-bearing literals and malformed syntax fail privately
without source-bearing error messages. This is not a complete public engine.

The independent pinned source producer adds a descriptor-vector hash over every
instance identity, capture count, sorted name map and minimum width. It does not
read target compiler code. The fixed hosted child now requires exact vector
agreement and native compilation of all 13,610 rendered programs, followed by
26 controlled capture observations (23 frozen cases plus three native-pattern
astral/surrogate spans). Existing scalar/alphabet checks and retirement controls
remain. This strengthened native branch is pending hosted execution and has not
run locally; historical native receipts do not qualify it.

Five focused suites pass 33 tests, including ten compiler/codec/binding controls,
category interning, escaped ranges, repeated category merging, native pattern
separation, nullable/repeated-capture metadata, invalid grammar, budgets and Clock
capture. Server test compilation, package laws and scoped lint pass. Source
observations are extended with independently produced metadata; no original
observation is changed to obtain a target pass. Family semantics/safety, actual
worker/supervisor, public composition and full source parity remain open. The
existing fidelity questions and target proof rows remain unfinished.
