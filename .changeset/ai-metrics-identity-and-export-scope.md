---
"@beep/repo-ai-metrics": patch
---

Content-address `agent_session_id` and drop the inert `--ingest-run` flag.

**Session identity.** `agent_session_id` still embedded `ingestRunId`, so a transcript that
grew between runs minted a fresh session row every run and its turns scattered across all
of them — the same defect `turn_id` shed earlier, and the last place an ingest run was
still doing duty as identity. It now keys on `[sourceKind, sourcePathHash]`.

`source_role` is deliberately **not** in the key. `turn_id` does not carry it, and turns are
`INSERT OR IGNORE`, so a turn's session pointer freezes at the first run that saw its line.
Because `source_role` is derived from transcript content — codex subagent detection — a
transcript that later reveals subagent metadata would flip role and mint a second session
row while the already-ingested turns kept pointing at the first. That is the fragmentation
being removed, only rarer. Under a two-part key a role flip merely rewrites the row's
descriptive column.

Existing turns keep the per-run session id written by the run that first saw them, so
nothing self-heals: `ai-metrics-agent-session-id-v2` repoints turns onto the
content-addressed id, drops the duplicate session rows, then rewrites the survivors.
Ordering is load-bearing — turns are repointed while the legacy rows still exist, because
the mapping is computed from those rows. Unlike the agent-task rewrite it models, this
collapse is many-to-one, so the duplicates must be dropped before the rewrite or it
violates the primary key on any store that ingested a transcript twice.

**Retention.** A session row is upserted with `OR REPLACE`, so its `ingest_run_id` now names
the run that *last* saw the transcript rather than the run that created it. Pruning sessions
by run id alone could therefore delete a row whose turns from other runs survive, and the
exporter joins `ai_metrics_sessions` INNER — those turns would leave every future export
silently, watermark still open. Retention now refuses to delete a session that still has
turns. Reachable through out-of-order ingest or clock skew, not under strictly monotonic
runs, but the invariant it relied on no longer holds.

**`--ingest-run` removed.** It advertised run-scoped export while selecting nothing: the
drain has been watermark-based since the at-least-once change. `AiMetricsOtlpExportInput`,
`AiMetricsOtlpSpanProjectionBatch`, and `AiMetricsOtlpExportResult` lose their `ingestRunId`,
`readAiMetricsOtlpSpanProjections` becomes a plain effect, and the export result reports
counts instead of a run it never scoped to. The forwarder's own `ingestRunId` is untouched —
that is real lineage, and `AiMetricsForwarderOtlpExported` now sources it from the forwarder
run rather than from the export result. The `ai_metrics.ingest_run_id` span attribute is
likewise untouched.

One visible Phoenix effect: `session.id` stops depending on which drain a turn landed in, so
a session span and its turn spans finally agree on it.
