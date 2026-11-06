# Literal-space plain-text token planning

The pinned Tokenizer.append_text splits only on ASCII space. Nonempty parts
are followed by a space token, empty parts add a space, and the final extra
space is removed. Empty input therefore produces no tokens. Tabs, line breaks,
nonbreaking spaces and other Unicode whitespace remain within a word.

The private TokenText planner expresses this behavior as half-open Python
source-point spans over an owned native storage snapshot. Every original
source word is retained, including literal surrogate pairs distinct from an
astral scalar. A later assembly adapter must materialize or consume these
spans without losing that distinction. The planner does not issue verified
citation spans or public token results.

Effect MutableList provides bounded result assembly, Schema owns decoded
limits/models, and the existing Unicode and timing adapters provide immutable
preparation, captured Clock, yield points and deadline enforcement. There is
no replacement text codec, splitter library or resource manager. A preflight
counts all output slots and rejects token exhaustion before building the
result list. Source UTF-16 ceilings are enforced after validated native
preparation. The caller still owns cumulative token/produced-text reservations
across all gaps and the surrounding extraction operation.

## Independent evidence

The producer requires the exact clean oracle commit/tree and Python 3.11.15.
It invokes the actual pinned Tokenizer.append_text and derives spans by
consuming its returned parts, requiring exact reconstruction of the original
Python string. It exhausts lengths zero through four over six symbols: ASCII
letter, ASCII space, tab, line break, lone surrogate and astral scalar. Six
additional cases cover literal surrogate pairs versus scalars, non-ASCII
whitespace, leading/trailing/repeated spaces, NUL, long words and long spaces.
All 1,561 target results match exact source boundaries and original native
storage. Tests also prove captured policy ceilings, equality at each ceiling,
the first excess output slot, ownership after caller mutation and the captured
extraction deadline despite a disabled caller Clock. All three focused tests,
quick package lint/type checks, scoped Oxlint and zero-finding new-only Fallow
pass. The planner separates token-count preflight from span collection.

Repeat generation is byte-identical after the standard formatter.
Producer SHA-256:
c1ff04ea89ad4c471556bf229c94963eaa93cfcb74343aa48abf0bc3a49894b6.
Fixture SHA-256:
76cfb8e56b7aa6aecf6c42420d06fae86e2c6a754ad6ffb0ffd2efcef36b53bf.

Mixed citation/plain-text assembly, source token construction, stable match
sorting, merge mutation, nominative-reporter overlap handling and full public
tokenizer integration remain open. Full hosted proof remains required. No
completion accounting or semantic waiver is advanced by this private stage.
