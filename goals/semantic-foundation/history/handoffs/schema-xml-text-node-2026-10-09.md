# Shared XML reader repair — 2026-10-09

Lane: `schema-xml-text-node`, branch `fix/schema-xml-text-node`.
Base: `4e82f6d942`; source repair: `288f402edf2c0a77c6c729e8bfd6f411086a444a`.

The reader uses reserved `#text` content keys. ISO 4217 and IANA media-type
consumers decode and read that key. One regression preserves outer and nested
`text` elements, attributes, entity-decoded content, and a builder/reparse
round-trip. Encoding through `XmlTextToUnknown` retains its unsupported contract.

Both packages are private on current main. The requested schema patch changeset
failed the release graph guard and was removed under the private-package
exemption. `SPEC.md` records the decision and reversal; `OPPORTUNITIES.md`
records the stale brief premise and the builder declaration/runtime mismatch.
The builder is an explicit test dependency on already-locked version 1.3.1.

Full package verification passed for schema (audit 10.3s, docgen 5.3s) and CLI
(audit 922.0s, docgen 31.5s). The introduced audit P0 was repaired and acknowledged
against the source commit. Proofs run through `beep-heavy`, five slots, 32G cap,
`TURBO_CONCURRENCY=2`; the lane unit has MemoryHigh 36G / MemoryMax 40G.
Receipts are retained in `.beep/schema-xml-text-node/`.

The orchestrator owns merge and retirement. Final PR, head, and review state are
in its gate report; this worker never merges or retires the lane.

The initial canonical full docgen passed. Initial CLI coverage passed all
5,834 tests (5 skipped), but its ratchet failed on three untouched files; the
ledger records the exact drops. New main was integrated and both package
verifiers passed again before publication. The final-head parity replay and
PR state are recorded in the orchestrator report.
