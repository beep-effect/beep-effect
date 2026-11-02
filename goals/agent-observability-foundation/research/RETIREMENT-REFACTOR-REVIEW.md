# Independent retirement and export refactor review

On 2026-10-29, the required Astra panel seat reviewed the current four files
below against delivery HEAD `1ed9704cc640a24fe880a5b1dc161b009d1ca1ef`.
Its verdict was bounded acceptance with no actionable semantic regression.
It performed no edits, tests, service changes or provider launches.

The reviewer confirmed that validation, accounting, recovery capture, deletion
and checkpoint writes still run under the original outer transaction and
deadline. Extracted helpers introduce no fork, separate runner or independent
commit. Replay/conflict, minimum age, retained-page refusal, empty-window
handling, work bounds, send quietness, orphan checks and unfinished-launch
handling retain their refusal order. Recovery capture still precedes deletion.

The shared ID visitor retains a per-call cursor, advances it after successful
processing, and propagates read/visit failures. Both queries retain ordered
keyset reads with a 32-row bound. All four launch counters and five delivery
states remain distinct. Byte accounting, native/transcript occurrences, legacy
disposition holds, ownership-digest checks and cumulative overflow validation
are unchanged. The review found no new conversion from unknown to zero.

The shared protobuf helper builds the same envelope, ordered resource
attributes, scope name, caller-specific version and projected spans. Integer
attributes retain decimal-string representation. Hashing still applies SHA-256
to the exact emitted bytes and validates the hexadecimal digest. Both exporters
retain safe `encoding` and `digest` error mappings. The extraction changes no
projection, optional-field omission, event order, identity, timestamp or usage
interpretation, and adds no private-attribute input surface.

| File under `packages/tooling/library/ai-metrics/src/` | Reviewed SHA-256 |
| --- | --- |
| `evidence-retention.ts` | `f05d08e5ac949e2512c7bb4cca8078f8bb2bb7446668d93a8bc990f76ce18257` |
| `internal/native-trace-wire.ts` | `b12dc87522ed91895337cba86e66c562e3e64753fde03d459bbc6b19d5279981` |
| `native-export.ts` | `96d6727eccc6a8e0c3fe0948c5b4baba797728a7f114624eeb6d8ef645ec6f73` |
| `transcript-export.ts` | `aa1ed8cb2cf8805e476f06ea660ff4fd5959e0bd80bb72a6722e458ed3ba0cfb` |

The parent rechecked these hashes after receiving the review. The reviewer
selectively read the five-state accounting, 33-record pagination/restore,
checkpoint-failure rollback, deadline rollback and export tests, but correctly
did not claim their execution. The separate parent-owned
`foundation-retirement-export-verification-v4` subsequently exited zero:
50 focused library tests, seven CLI inventory tests, full AI-metrics audit/docgen,
and CLI lint/type checks passed. Whole-CLI execution, current-source installed
qualification, remaining repository gates and final delivery remain open.
