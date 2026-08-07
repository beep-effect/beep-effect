# @beep/repo-ai-metrics

Schema-first metrics, transcript-ingest, scorecard, install, mirror, and
retention models for repo-local AI-agent analytics.

This is a tooling library, not product runtime language. It owns developer
operational concepts such as Codex/Claude/OpenClaw transcript ingestion,
benchmark scorecards, local/tailnet install specs, generated local Phoenix
compose smoke targets, redacted OTLP span projections, structured labels,
recorded benchmark runs, and weekly config-impact reports. Product usage
records in `agents` or `epistemic` should map to this package only
through explicit adapter code when a proof benchmark needs to compare the two
worlds.

P3 keeps backend-specific clients out of this package. Phoenix, Langfuse, Opik,
and PostHog are install/export targets until a backend-specific API is needed;
runtime OTLP wiring stays in `@beep/observability`.

P4 keeps scorecard artifacts deploy-safe: task metadata is hash-only, benchmark
prompts are stored by hash/reference only, label notes are redacted before
storage, and reports use coverage-aware neutral scoring while model/token/cost
enrichment remains sparse.

P5a keeps installer workflows contract-first: `plan`, `doctor`, and
dry-run-only `apply` use typed schemas, stdout/JSON output, Phoenix-only
concrete deployment steps, and no local or remote mutation. P5b keeps real
dankserver mutation in `@beep/infra`, where Pulumi remote commands deploy
Phoenix to the dedicated tailnet URL
`https://dankserver.tailc7c348.ts.net:8447`.

P6 keeps `forwarder run --otlp` additive: the forwarder still persists
encrypted raw archive objects plus derived DuckDB/Parquet outputs first, then
attempts a derived OTLP export for the same ingest run. The forwarder JSON
contains `otlpExport` only when OTLP is requested, with a tagged `exported` or
`failed` status so local collection evidence remains readable even when the
backend export fails.

P7a keeps production mirroring deploy-safe with sanitized derived bundles. Raw
encrypted transcript archives remain workstation-local; mirror bundles contain a
manifest, status report, and Parquet exports from an explicit safe table
allowlist. Raw archive object rows, local source paths, archive paths,
transcript bodies, prompt/output text, and secret-shaped fields are omitted or
hashed before export.

P7b keeps retention workflows operator-led and local-first. Inventory and
restore drills can prove retained encrypted archive objects without printing
transcript text, while real delete and compact operations require an explicit
time window and confirmation token. Provider/model/tool/token/cost enrichment
and dashboard expansion remain later P7 slices.

## Data root

The canonical store lives outside every clone. `resolveAiMetricsDataRoot`
resolves it by precedence, and there is no clone-relative fallback anywhere in
the package:

| Rung | Condition | Resolved root | `source` |
| --- | --- | --- | --- |
| 1 | `--data-root` supplied and non-blank | that value, used verbatim apart from a trailing-slash trim | `flag` |
| 2 | `BEEP_AI_METRICS_DATA_ROOT` set and non-blank | same treatment | `environment` |
| 3 | `target: dankserver` | `/srv/data/ai-metrics` | `target-default` |
| 4 | otherwise | `${XDG_STATE_HOME:-$HOME/.local/state}/beep/ai-metrics` | `xdg-state-home` |

`aiMetricsStateRoot` mirrors `agentEvidenceRoot` from the hook-pulse ledger, so
`beep/ai-metrics` and `beep/agent-evidence` are provable siblings and neither can
nest inside the other.

Resolution never absolutizes a relative value against the working directory —
rungs 1 and 2 hand back what they were given. Absoluteness is a separate,
explicit gate: anything rendered into a systemd unit or persisted into the store
goes through `requireAbsoluteAiMetricsDataRoot` (and, for install specs,
`requireInstallDataRoot`) first, where a relative root is *refused*. Silently
rebasing it onto whatever directory the process inherited is precisely how the
store escaped into a clone in the first place, so the resolver keeps such a root
recognisably relative for those guards to reject. `makeAiMetricsInstallSpec`
fails with `AiMetricsInstallConfigurationError` when the root cannot be resolved
from its input rather than guessing one.

Rung 4 is the only rung that can come up empty, so `resolveAiMetricsDataRoot`
returns an `Option`: with no `XDG_STATE_HOME` and no non-blank home directory
there is no root to name, and `Option.none()` says so instead of interpolating a
blank home into `/.local/state/beep/ai-metrics` — an absolute path that every
downstream absolute-path guard would wave through. Every schema input that
carries a data root (`AiMetricsRetentionSelector`,
`AiMetricsMirrorBundleInput`, `AgentEffectivenessDoctorInput`, and the plan and
sync inputs nested above it) requires the root outright for the same reason.

## Identity registry

Every run records the canonical root it wrote from at
`${dataRoot}/identity/registry.json` (`upsertAiMetricsIdentityRegistry`). Each
row carries clone, repository, worktree, and revision identity derived from the
filesystem alone — `.git`, the common git directory's `config`, `HEAD`, loose
refs, and `packed-refs`; no subprocess is spawned. `cloneIdHash` is
byte-identical to the `repoRootHash` the forwarder writes into DuckDB, so derived
rows join to registry rows without a migration. Linked worktrees are independent
roots: they carry `parentRootId`, are flagged `excludedFromParentSnapshot`, and
are skipped by the parent's config-snapshot walk.

## Bounded config snapshots

`makeAiMetricsConfigSnapshot` stops at every nested git root it meets and lists
it in `bounds.excludedNestedRootPaths` instead of walking into it. Depth,
file-count, per-file byte, and total byte budgets (`AiMetricsConfigSnapshotBudget`,
defaulting to depth 8, 1000 files, 512 KiB per file, and 8 MiB total) bound the
rest, and `bounds.truncationReason` names whichever bound fired. Each included
file is tagged `session` or `baseline`, with `sessionHash` and `baselineHash`
alongside the unchanged `configHash`, and `stageTimings` reports the cost of the
enumerate, read, hash, diff, and write stages.

The first bounded snapshot taken after an unbounded one reports every file the
old walk wrongly included as removed and produces a new `configHash`. That is the
bound landing, not data loss.

Snapshot self-pruning: `forwarder run` defaults `--parquet-mode snapshot`, which
writes a full per-run export to `derived/parquet/forwarder-<epochMillis>/`. To
keep the data root from growing unbounded, the local `run` command now
always enforces retention after a successful run, keeping the newest
`--max-snapshot-exports` exports (default 5) and pruning the rest via
`enforceAiMetricsRetentionPolicy`. Each export is a full cumulative dump of the
derived DuckDB tables, so older snapshots are redundant subsets of the newest.
To reclaim accumulated snapshots manually, run
`ai-metrics retention enforce --max-snapshot-exports <keep> --confirm p7-retention-window`
(omit `--confirm` for a dry-run preview).
