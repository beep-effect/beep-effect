I'll review the named github-actions files against the port decisions and the pinned upstream oracle, and report findings only.The port ledger records no deviations for these files. I'll read each one against the pinned upstream source.The comparison is done. I am checking the exact lines for the unrecorded contract changes before I write the findings.### grok-1-1
- file: scratchpad/effected/github-actions/CacheKey.ts:366
- class: law   severity: required
- standard: D9, section 14, effect-laws-v1 law 7   evidence: Upstream `CacheKey.ts:352` throws `new RangeError(\`A digest length must be an integer between 1 and 64, got ${length}\`)`, and upstream `__test__/CacheKey.test.ts:237` asserts `RangeError`. The lab throws `InvalidDigestLengthError.make` with that same message, and `scratchpad/test/github-actions/CacheKey.test.ts:249` asserts `InvalidDigestLengthError`. README Port notes say `Deviations: None`; ledger `w5-github-actions.deviations` is `[]`. The class is not on `index.ts`.
- failure: `CacheKey.digest` on a length outside `1..64`, or a fractional length, no longer throws `RangeError`. Callers that catch `RangeError` miss it. Law 7 forces the tagged error; the contract change is unrecorded.
- fix: Record `law:7` in README Port notes → Deviations and in the ledger `deviations` entry, citing the retargeted upstream test. Do not restore `RangeError`.

### grok-1-2
- file: scratchpad/effected/github-actions/CheckState.ts:98
- class: law   severity: backlog
- standard: D9, section 14, effect-laws-v1 law 7   evidence: Upstream `CheckState.ts:99` throws `new Error(\`Unhandled CheckState: ${String(unhandled)}\`)`. The lab throws `UnhandledCheckStateError` with the same message. `Match.orElse` is typed `never` after the seven `CheckState` literals, and `CheckState.test.ts` never hits it. README and ledger record no deviation.
- failure: A value outside the vocabulary changes thrown class (`UnhandledCheckStateError` versus `Error`). The message is unchanged, and no in-domain call reaches the branch.
- fix: Record `law:7` next to grok-1-1. Do not restore `new Error`.

### grok-1-3
- file: scratchpad/effected/github-actions/ManagedDocument.ts:291
- class: law   severity: backlog
- standard: D9, section 14, effect-laws-v1 law 7   evidence: Upstream `ManagedDocument.ts:280` throws `new Error("ManagedDocument: the region dialect rejected its own comment style")`. The lab throws `RejectedRegionDialectError` with that same string. The comment at line 289 marks the branch unreachable because every declared section uses the dialect's own comment style. No test asserts the class. README and ledger record no deviation.
- failure: The unreachable `unknownCommentStyle` branch throws a different class. The message is the same.
- fix: Record `law:7` with grok-1-1. Do not restore `new Error`.

### grok-1-4
- file: scratchpad/effected/github-actions/DetachedProcess.ts:346
- class: law   severity: backlog
- standard: D9, section 14, effect-laws-v1 law 7   evidence: Upstream `DetachedProcess.ts:329` throws `new Error(\`"${options.command}" produced no process id\`)` inside `Effect.try`, whose `catch` wraps it as `DetachedSpawnFailedError`. The lab throws `MissingProcessIdError` with the same message into the same wrapper (`DetachedProcess.ts:353`). Upstream and lab tests assert `DetachedSpawnFailedError` only. README and ledger record no deviation. The class is not on `index.ts`.
- failure: `spawn`'s public failure tag is unchanged. The wrapped `cause` is `MissingProcessIdError` rather than `Error`, so a cause-class check diverges. The cause message matches.
- fix: Record `law:7` with grok-1-1. Do not restore `new Error`.

### grok-1-5
- file: scratchpad/effected/github-actions/BlobStore.ts:36
- class: schema   severity: backlog
- standard: D9, section 14, tsgo `schemaNumber`   evidence: `S.Number` accepts `NaN` and `±Infinity`. These fields are now `S.Finite`: `BlobStoreError.status` (`BlobStore.ts:36`), `OidcTokenError.status` (`OidcTokenIssuer.ts:37`), `TokenEnvelope.count` (`OidcTokenIssuer.ts:94`), `ManagedDocumentError.line` (`ManagedDocument.ts:70`), `DetachedSignalFailedError.pid` (`DetachedProcess.ts:89`). `RestoreDepth` (`CacheKey.ts:101`) already rejected non-finite values via `isInt`. HTTP `response.status` and JSON numbers are finite, and `reap` only builds `DetachedSignalFailedError` for a positive integer pid. README and ledger record no deviation.
- failure: Direct construction or decode with `NaN` or `Infinity` now fails on those fields. The live HTTP and JSON paths do not produce those values. `RestoreDepth` still rejects the same depths; only the issue text for a non-finite depth may differ.
- fix: Record one `law:schemaNumber` deviation for the narrowed numeric fields. Do not restore `S.Number`; the gate rejects it.

REQUIRED: 1
BACKLOG: 4
