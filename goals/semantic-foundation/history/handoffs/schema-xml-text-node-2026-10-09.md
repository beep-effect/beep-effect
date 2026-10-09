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

Run-1 publication was blocked before push. After base `cb64e0484f` was integrated,
full schema verification passed (audit 11.4s, docgen 4.2s), and full CLI
verification passed (audit 883.8s, docgen 26.5s). Test-tsgo passed again.
Yeet cheap gates failed on inherited Accounts schema inventory/candidates
and 13 Effect Vitest findings in seven unchanged upstream files. No PR was
created; the source and handoff remain committed locally. The cheap-gate P0
is acknowledged as out of this lane's repair scope, without a gate waiver.
Run 1 emitted no S13 final marker. The run-2 ruling below supersedes its
publication hold while preserving the attributed proof limitations.
The original full docgen, JSDoc ratchet, knowledge refs, Fallow audit/health,
and schema coverage passed; initial CLI coverage passed all tests but had
unrelated floor drops recorded in the ledger. Post-integration full docgen
was stopped, and subsequent parity commands were not run. Nothing is merged
or retired. Semantic-m2m3 owns the IPC fixture rerun after integration.

Run-2 publication ruling (2026-10-09T23:12Z): the orchestrator explicitly
ordered an immediate push under the inherited-fence ruling. The branch was
pushed at `2721382e05` and draft PR #1594 opened with `ready-for-heavy`.
The canonical refusal was `github-checks:cheap-gates: failed 2 step(s)`:
`lint:schema-first` and `lint:effect-vitest`, followed by `nothing was pushed`.
The authorized fallback is direct branch push plus `gh pr create`; it does
not claim those inherited gates passed. This note corrects the prior hold.
At content-final the worker runs `yeet ready`, starts the detached 40-minute
readiness monitor, acknowledges observed rows, and emits the S13 gate marker.
Exact final head, monitor id, readiness result, and remaining hosted work are
recorded in the orchestrator gate report. The orchestrator owns merge;
semantic-m2m3 can fetch the branch immediately and owns the IPC fixture rerun.
