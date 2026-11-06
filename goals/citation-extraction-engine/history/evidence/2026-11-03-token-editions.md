# Token edition-set merge and nominative choice

The target edition adapter reuses the existing CPython RuntimeSet for the two
fresh sets created by CitationToken.merge. Candidate occurrences are processed
in concatenation order; equal aliases collapse while retaining the source
representative and bucket order. Exact and variation sets remain separate.
Effect HashMap owns immutable captured binding facts, and Effect HashSet
implements the pinned nine-name nominative reporter membership test. The first
exact candidate takes precedence; the first variation candidate is used only
when exact candidates are absent. Both empty lists fail closed, corresponding
to the source's missing-first-candidate error.

The private adapter captures decoded policy, timing and trusted edition hash/
equality/name facts. Candidate occurrences are bounded before deduplication,
including duplicates; each set uses the existing bounded probe work guard.
Bindings are copied before asynchronous work, and methods have R = never.
Unknown and duplicate edition identities fail closed. The current binding
population is bounded by the canonical source's 2,533 immutable editions;
custom populations and dynamic hash/equality protocols remain open.

## Runtime hashes and existing normalization

Two fresh pinned Python processes with PYTHONHASHSEED=0 produced different
hash(None) and different hashes for an otherwise identical Edition whose dates
are None. This is consistent with the packet's existing edition-order finding
in research/OPPORTUNITIES.md. The existing normalized candidate-bag
rule is unchanged. Intermediate order is not silently normalized: this adapter
uses explicit captured runtime hash facts. It does not claim to produce fresh
Python object/None/date hashes or to establish universal intermediate order.

The producer first executes actual CitationToken.merge and actual nominative
classification using real Edition/Reporter objects, capturing their source
hashes. Fourteen bindings include an equal alias and a distinct edition under
the same reporter. Eighty-nine sequences cover empty, duplicate, alias,
permutation, resize and repeated-list cases. Forty-two additional actual source
classification cases cover every reporter, variation fallback and exact-list
preference, including lowercase/combining-mark near-misses.

A separate profile replay verifies immutable metadata against actual source
objects, then explicitly supplies the captured hash parameters to the same
source edition class. Actual source equality, CitationToken.merge and
nominative classification still run. Replaying that frozen profile is
byte-identical after formatting. A fresh unparameterized capture is allowed to
differ; conditional replay must not be presented as fresh-process hash proof.

All 89 exact and variation target results and all 42 classification results
match. Four focused edition/assembly tests pass, including the prior 407 mixed
assembly cases. Captured policy/metadata ownership, occurrence exhaustion,
unknown identity and duplicate identity controls pass. Quick server lint/type
checks, scoped Oxlint and zero-finding new-only Fallow pass. Full latest-head
hosted proof remains pending.

Producer SHA-256:
93b10f22675e44e7f1a20871dec7d8ecac31e0e3168734285c236fc79ddeae1a.
Expanded fixture SHA-256:
b42419aa8c06a5ccb3a15ea6e46650219e1f50445dbd827224b4d771e9f2932c.
The original runtime capture before classification expansion had SHA-256
18d3df5208a1c89eb465b8ecadb4d397d5e5e571030709faa2068cb480124035;
expansion/replay retains the same fourteen captured hash facts.

Concrete token construction, group equality, token host mutation, primitive
edition hash production, native gap ownership/aggregate reservation, complete
regex/tokenizer connection and public engine integration remain open. No full
tokenizer completion or semantic waiver is asserted.
