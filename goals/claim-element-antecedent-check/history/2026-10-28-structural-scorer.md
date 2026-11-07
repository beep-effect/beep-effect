# Structural scorer verification

The strict-source-map/v1 methodology is declared before positive predictions in research/EVALUATION-PROTOCOL.md. It preserves every selected claim, ignores producer metadata and ordinal path spelling, and uses one family-wide source-node mapping to compare exact element/term content and typed directed edge multisets. Ordered functional text/term parts remain exact. Typed-edge F1 is diagnostic only.

A census of the frozen 60 reference families found zero duplicate claim/kind/span node identities and zero unlabelled edge endpoints. The scorer checks the unique-identity and reference-closure preconditions. An ambiguity produces a typed measurement error instead of selecting different mappings per edge or quietly removing a case. Missing prediction trees remain failed selected claims with their reference edges in the diagnostic denominator.

Seven synthetic regression tests pass: consistent producer/path renaming, changed lexical heads and exact span shifts, missing edges, missing predictions, cross-claim donor identity despite identical quoted spans, functional part ordering, and rejection of ambiguous node identities. Typecheck and full law-practice-server package verification also pass (audit/docgen). These synthetic tests do not supply reference labels, attorney agreement or performance measurements.

No positive benchmark has been executed yet. The next runner must replay pinned native XML through the real adapter and self-check service, verify version hashes, and retain normalization/decomposition failures. Any result before actual attorney adjudication is explicitly provisional and includes the 21 held claims in the 538-claim end-to-end denominator.
