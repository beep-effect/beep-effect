# Shared intake boundaries review — 2026-10-29

Independent reviewer: the existing Astra xhigh `review.panel` session
`/root/foundation_panel_astra`, separate from the implementing orchestrator.
All reviews were read-only source comparisons. The reviewer did not run tests,
services or provider launches, and did not certify the orchestrator's run results.

## Exact accepted sources

Paths are relative to the repository root.

| File | Accepted SHA-256 |
| --- | --- |
| `packages/tooling/library/ai-metrics/src/transcript-intake.ts` | `e14066207a7f97dfa0d020376bf1bff77a63628806f4990f40640325e258fb4a` |
| `packages/tooling/library/ai-metrics/src/native-intake.ts` | `9ba382a391631dbd14c854c3dc3c6a86652216453c8136fa744e06b75eaedd6c` |
| `packages/tooling/library/ai-metrics/src/internal/observation-metadata-codecs.ts` | `c680e2b9d6eeef1f349589215904784c36bcc171dbf02cbc2dec4f789a73b9ae` |
| `packages/tooling/library/ai-metrics/src/delivery-ledger.ts` | `a5ee5965ca6eae8ab4bd6012c7a601547899f5c46e798ef638be56756ea030a1` |
| `packages/tooling/library/ai-metrics/src/payload-reclamation.ts` | `20d52585b44f7210867bf0c443b4d42d5bb9cf23e79e9ab79eb4b8bddb0f906c` |
| `packages/drivers/ai-provider-cli/src/AiProviderCliSession.lifecycle.ts` | `2b9da29fd01355e3af972a60195e6ff8ec60b06eb8930c4a6d2f3528fa23c79f` |
| `packages/drivers/ai-provider-cli/src/AiProviderCliSession.claude.service.ts` | `f16338716c1f42444e1fb736e6976f2121c06776469524554cc192630cb2206a` |
| `packages/drivers/ai-provider-cli/src/AiProviderCliSession.stdio.service.ts` | `184baa3bdd69d391b178ae955302a2721e7fac526f9d4623390edfdf80d3bb09` |

Before snapshots and their checksums are retained with the verification receipt.

## Journal initialization and error boundary

No actionable semantic, privacy or Effect API regression was found. The bounded
table query, allowlist and existing configuration check remain before database
changes. The single file-backed main-database check precedes the same PRAGMA
assignments and read-back validations. These PRAGMAs remain outside the schema
initialization transaction, as before; no additional rollback guarantee is claimed.

Within initialization, configuration creation/insertion is immediately followed
by exact singleton verification. Page migration, evidence-window creation, clock,
encoding, checksum, conditional insertion, stored-window validation and remaining
schema creation retain their order and transaction. Helpers share the same SQL
client and introduce no independent commits. Operations from `stats` through the
factory's returned API remain byte-equivalent to the snapshot.

The shared sanitizer returns a known intake error by identity and replaces other
typed failures with content-free storage errors. It retains no source payload or
cause. Both adapters still use `mapError`, leaving defects and interruption outside
this typed-failure conversion. The installed data-last mapError API supports the
new alias, and all extracted startup helpers use generator callbacks.

## Metadata codecs

The three codec expressions and their original models are identical: native
metadata JSON encoding, strict transcript-page JSON decoding with excess-property
rejection, and transcript-frame JSON encoding. No normalization, schema replacement
or changed options were introduced. Caller bodies, checksums, error handling and
transactions are byte-equivalent after removing local codec declarations.

The new module's local dependency closure has no path back to the ledger or
reclaimer; it adds no import cycle or import-time I/O. Its dependencies were
already imported by both consumers. Shared serialization preserves the bytes
used by delivery and reclamation identity checks.

## Managed process observation

The shared lazy generator copies exactly PID, exit-code and running evidence,
passes that restricted object to the observer, and returns the same object.
No stdio or kill capability is exposed. The optional callback executes once under
the unchanged five-second observation wrapper, with no retry or detached work.

Both callers still observe immediately after spawn and before adapter
initialization. Their remaining bodies are byte-equivalent. The existing outer
open scope still closes acquired children on failure or interruption; the helper
adds no scope boundary. Existing ordering, private-error, timeout/interruption and
cleanup assertions were inspected but not executed by the reviewer.

These acceptances cover the exact shared-boundary changes only. Generated gates,
installed proof, complete panel, hosted delivery and real coverage remain separate
requirements. Historical recovery hold and production enrollment limits remain.
