# #1869 Telemetry storage completeness and stamp qualification: record

Lane `residue-telemetry-completeness`, branch `feat/residue-telemetry-completeness`
off `main` `a33ad8bed3`, 2026-10-18. Route: ruling S39, a Claude-originated residue
lane worked by a `claude-opus-5-5` child. Source evidence: finding H3-R3-001 in the
[H3 handoff](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/goals/repository-simplification-confidence/history/handoffs/rsc-h3-telemetry-2026-10-15.md),
the round-2 and round-3 sections of the
[H3 receipt](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/goals/repository-simplification-confidence/history/receipts/stage-4-h3-telemetry.md),
and the PR #1590 review thread on `derived-storage.ts` that H3-R3-001 tracks.

## Finding

Round 2 of H3 added one boolean, `session_stamp_collection_complete`, written as
"a stamp was retained AND hook collection was complete AND no refusal record was
rejected". It answered two questions at once. A `false` could mean "no stamp
qualified" or "the evidence could not be read", and nothing told them apart.

`ai_metrics_sessions` rows are content-addressed and every forwarder run rewrote
them with `INSERT OR REPLACE`. A later run that could not read `hook-events`
retained no stamp and replaced a previously verified `session_harness_hash` with
`NULL`. An unconditional `COALESCE` would not fix this. It would also hide a
complete contrary result, such as an intersecting event-loss refusal, which must
clear the stamp.

## Design

The design order was schema, then contract, then implementation.

### Schema

`@beep/repo-ai-metrics/derived-storage` gains three `LiteralKit` domains. Two are stored; the third is the per-record join outcome:

| Domain | Members | Meaning |
| --- | --- | --- |
| `AiMetricsSessionStampCompleteness` | `complete`, `partial`, `unknown` | Whether every hook shard, the shard listing, the refusal records and the disarm evidence were read and decoded for this verdict. |
| `AiMetricsSessionStampJoin` | `retained`, `contradicted`, `unresolved`, `unsupported` | How one transcript joined this run's evidence. `contradicted` means the session's own evidence rules a stamp out in a way more evidence cannot undo: more than one stamp or an unstamped start, more than one session identity or a foreign one, or a valid gap that starts inside the transcript's own span. `unresolved` means no stamp was retained without such a contradiction. |
| `AiMetricsSessionStampQualification` | `qualified`, `unqualified`, `unsupported`, `unknown` | `qualified`: a stamp passed every gate. `unqualified`: the gates reached a negative verdict (a contradiction, or complete collection found no qualifying stamp). `unsupported`: no hook adapter (OpenClaw). `unknown`: collection was partial and the session's own evidence neither retained nor contradicted a stamp, so the gates could not evaluate it; also the historical default. |

`AiMetricsDerivedTranscriptRecord` replaces `sessionStampCollectionComplete` with
`sessionStampCompleteness` and `sessionStampQualification`. Both use
`withConstructorDefault` and `withDecodingDefaultKey` set to `unknown`, so an
encoded record without the keys (including a round-2 record that carried only the
old boolean) decodes as `unknown`/`unknown`. A value outside a domain fails
decoding with `SchemaError`. `unqualified` is documented as a gate verdict and
never as evidence that a harness was unused.

### Contract

Derived storage has no `Context.Service`. Its contract is the record schema, the
exported Effect functions and the OTLP attribute allowlist:

- `aiMetricsSessionStampCompletenessFor(hookCollectionComplete, stampGapCollectionComplete)`
  depends only on collection status.
- `aiMetricsSessionStampQualificationFor(join, completeness)` maps `retained`,
  `contradicted` and `unsupported` directly, whatever the completeness. Only an
  `unresolved` join consults completeness: `complete` makes it `unqualified`,
  anything else makes it `unknown`.

  Completeness never derives from qualification. Qualification is not determined
  by completeness either: partial collection reaches `qualified`, `unqualified`,
  `unsupported` and `unknown`, and complete collection reaches all but `unknown`.
  Both functions are `dual`, and the completeness derivation never returns
  `unknown`.
- `writeAiMetricsDerivedStorage` resolves the session row's stamp verdict instead
  of replacing it (rule below).
- `rollbackAiMetricsSessionStampEvidence` is the tested down path for the
  migration.
- The OTLP allowlist replaces `ai_metrics.session_stamp_collection_complete` with
  `ai_metrics.session_stamp_completeness` and `ai_metrics.session_stamp_qualification`
  on both the session and turn spans. The repository had no other consumer of the
  old attribute or column (checked with `git grep`).

### Implementation

- `forwarder.ts` computes completeness once per run from `hookCollectionComplete`
  and `stampGapCollectionComplete`. It classifies each record's join with the pure
  helper `sessionStampJoinFor`, which uses only that session's own hook entries and
  the loaded gaps, and derives qualification from that join. The fail-closed join
  gates are unchanged.
- `ai_metrics_source_files` rows are per ingest run, so each row records the run's
  own observation.
- `ai_metrics_sessions` now uses `INSERT ... ON CONFLICT (agent_session_id) DO
  UPDATE`. Every descriptive column takes the new value. The stamp verdict
  (`session_harness_hash`, both new columns and the legacy marker) keeps the stored
  values together only when the new verdict is `unknown` and a stamp is already
  stored. Any reached verdict replaces it: a complete run that finds no stamp, a
  session whose own evidence contradicts a stamp under any completeness, and any
  run that retains its own stamp.
- `otlp.ts` reads both columns with `COALESCE(..., 'unknown')` and decodes them
  through the `LiteralKit` schemas at the DuckDB boundary.
- The legacy `session_stamp_collection_complete` column is still written. Its value
  is `completeness = complete AND qualification = qualified`, exactly its round-2
  meaning, so code from before this change reads the same conservative value after
  a revert. No current reader consults it.

## Migration and historical rows

Additive columns `session_stamp_completeness` and `session_stamp_qualification`
(`VARCHAR DEFAULT 'unknown'`) are added to both tables. Transactional migration
`ai-metrics-session-stamp-evidence-v1` runs once through the existing ledger. It
backfills `NULL` to `unknown` and applies one exact translation: a row whose legacy
marker is `TRUE` and whose hash is present becomes `complete`/`qualified`, because
round 2 wrote `TRUE` only in that case. A `FALSE` or `NULL` marker stays
`unknown`/`unknown`, with or without a hash. Absence never becomes `unqualified`,
and neither field is inferred from the other.

Down path: `rollbackAiMetricsSessionStampEvidence` drops the two columns from both
tables and deletes the ledger row in one transaction. It leaves the legacy marker
and the hashes untouched. A later ensure reapplies the migration and reproduces the
same translation. Rows written after this change and then rolled back keep only the
legacy projection, so a `partial`/`qualified` row reads back as `unknown`/`unknown`
after a rollback and reapply. It never reads as verified.

## Fixtures

All fixtures are paired tests in `@beep/repo-ai-metrics`.

| Case | Where | Result |
| --- | --- | --- |
| Complete stamped | forwarder matrix `qualified`, `closed-before-refusal`; storage run 1 | `complete`/`qualified`, legacy `true` |
| Complete unstamped | forwarder matrix `missing`, `unknown`, `mixed`, `late`, `reused`, `mismatch`, `prefix`; storage run 6 | `complete`/`unqualified`, hash `NULL` |
| Partial stamped | forwarder matrix `corrupt` (malformed shard), `unreadable` (unreadable shard), `rejected-refusal` (malformed refusal record beside a non-intersecting refusal); storage run 5 | `partial`/`qualified` |
| Partial, contradicted by a refusal | forwarder matrix `mixed-refusal` (malformed record beside a refusal inside the transcript span) | `partial`/`unqualified` |
| Partial, unevaluable | forwarder matrix `empty-sentinel` and `custom-sentinel` (undecodable disarm sentinels, so gap evidence fails to load and nothing in the session's own evidence contradicts a stamp) | `partial`/`unknown` |
| Complete refusal or disarm gap | forwarder matrix `refused`, `trailing-refusal`, `disarmed`, `future-sentinel` | `complete`/`unqualified`; the gap withholds the stamp |
| Unrelated malformed line, no own evidence (review case b) | forwarder `qualified` lifecycle: own shard parked, one undecodable line in an unrelated shard; storage run 2 | stored stamp kept; that run's source-file row is `partial`/`unknown` |
| `hook-events` offline (review case c) | forwarder `qualified` lifecycle | stored stamp kept, run row `partial`/`unknown`; restored complete evidence re-qualifies |
| Unrelated malformed line plus a second own stamp (review case a) | forwarder `qualified` lifecycle: undecodable unrelated line, own shard with two stamps; storage run 3 | stored stamp cleared, `partial`/`unqualified` |
| Complete collection clears a stored stamp | storage run 6 (`complete`/`unqualified`) | hash `NULL` |
| Historical-default record never clears a stamp | storage run 9 (`unknown`/`unknown`, no hash) | stored stamp kept |
| Historical rows | migration test: five legacy rows (`TRUE`+hash, `FALSE`+hash, `FALSE` without hash, `NULL` without hash, `NULL`+hash) | only `TRUE`+hash becomes `complete`/`qualified`; every other row is `unknown`/`unknown`; ensure is idempotent |
| Historical record decode | record without the keys plus the old boolean; record with `sessionStampCompleteness: "done"` | `unknown`/`unknown`; `SchemaError` |
| Down path | migration test | columns and ledger row removed, legacy marker and hashes intact, reapply reproduces the translation |
| Independence | property test over both collection booleans and every join outcome; a reachability test showing each completeness admits several qualifications and that every non-`unresolved` join gives the same verdict under either completeness; record codec property over every pairing; the forwarder matrix produces five pairings (`complete`/`qualified`, `complete`/`unqualified`, `partial`/`qualified`, `partial`/`unqualified`, `partial`/`unknown`) | neither field determines the other |

The forwarder matrix also asserts both OTLP attributes on every session and turn
span, and asserts that the old attribute is absent.

## Review round 1 (PR #1912)

The beep-reviewer P2 on `derived-storage.ts` found that the first design kept a
stored stamp whenever the run was `partial` and retained none. Completeness is
computed per run and the hook ledger is append-only, so one truncated line in any
shard would leave every later run `partial` forever. That run would then keep a
stale stamp even for a session whose own evidence disqualifies it (a second stamp,
an identity mismatch or an intersecting gap). Before #1869, `INSERT OR REPLACE`
cleared such a stamp.

Preservation now keys on the record's own verdict. The new
`AiMetricsSessionStampJoin` domain separates evidence that contradicts a stamp,
which is monotone and cannot be undone by unread evidence, from an unresolved
join. A stored stamp is kept only for `unknown`, meaning partial collection and an
unresolved join. A contradiction clears the stamp under any completeness. The
coordinator proposed "the session has its own hook entries" as the decisive test.
This refinement uses the narrower monotone contradiction test instead. Own entries
alone can fail a gate for a reason that missing evidence could reverse; for
example, a missing `SessionStart` or `SessionEnd` that sat in an unreadable shard.
A gap counts only when its start lies inside the transcript's own span, which unread
hook evidence cannot move.

## Verification

Commands ran in the lane worktree against the uncommitted tree. Heavy commands ran
through `beep-heavy`.

| Command | Result |
| --- | --- |
| `bunx vitest run` in `packages/tooling/library/ai-metrics` (Node) | 31 files, 442 tests pass |
| `bunx --bun vitest run` in the same package (Bun) | 31 files, 442 tests pass |
| `bunx vitest run --coverage` (package, json-summary) | total lines 90.94 / statements 90.95 / branches 82.15 / functions 80.15 against the 90.78 / 90.78 / 81.87 / 79.92 floors. `derived-storage.ts` 94.47 / 94.7 / 100 / 83.87 (floors 94.15 / 94.3 / 100 / 80.85); `forwarder.ts` and `otlp.ts` at or above their floors. The only per-file metric under a floor is `privacy.ts` functions, 92.15 against 92.3, a file this change does not touch: its uncovered-function count (4) equals the baseline and only the local function total differs (51 against 52). Attribution: environment-only measurement difference. |
| `bun run beep lint effect-vitest` | `introduced=0` (`resolved=66` predates this lane) |
| `bun run beep lint schema-first` | parity ratchet ok, `introduced=0` |
| `bun run beep quality effect-diagnostics --filter repo-ai-metrics` | check and test overlays, 0 errors, 0 warnings |
| `bunx oxlint <changed source and test files>` | exit 0 |
| `bunx biome check .` (package) | clean |
| `bunx turbo run check --filter=@beep/repo-ai-metrics` | 16 of 16 tasks pass |
| `bun run beep quality package-verify @beep/repo-ai-metrics` | audit and docgen ok |
| `bun run beep observability catalog --check` | current after `--write`; the owner shard gains one conforming span, `AiMetrics.rollbackAiMetricsSessionStampEvidence` |
| `bun run beep lint schema-catalog` | current after `--write`; the owner shard gains the two `LiteralKit` entries and an updated record description |
| `bun run beep quality fallow audit --base origin/main --check` | exit 0, 0 findings |
| `bun run beep laws retired-effect-paths` | 0 findings |
| `bun run beep quality changeset-graph` | 0 missing references |
| `bun run beep goals doctor` | 0 blocking findings |
| `bun run beep quality jsdoc-inventory ...` then `jsdoc-ratchet --inventory ...` | `increased=0` (two unrelated totals decreased; baseline not rewritten) |

Knowledge refs, goals doctor and changeset status read the committed tree, so the
driver reruns them after committing. `@beep/repo-ai-metrics` is `private: true` and
`privatePackages.version` is `false`, so the change needs no changeset.

No baseline, inventory, exception or suppression row is added (S31). The two
generated shards change only through their owner commands.

## Reversal

Revert the PR. The added columns are additive and code from before this change
ignores them. The legacy marker keeps its round-2 meaning, so that code reads the
same conservative values. To restore the exact prior table shape on a store, run
`rollbackAiMetricsSessionStampEvidence` before reverting. It is transactional and
covered by the migration test.
