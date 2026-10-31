/**
 * Repo AI-agent metrics models and helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Agent-attribution attribute keys and their closed value domains, declared
 * for the instrumentation catalog. Examples live on the owning declarations in
 * `./AiMetrics.instruments.ts`.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./AiMetrics.instruments.ts";
/**
 * Agent-effectiveness doctor reports and JSDoc annotation plans derived from
 * goal-packet manifests. Examples live on the owning declarations in
 * `./agent-effectiveness.ts`.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./agent-effectiveness.ts";
/**
 * Age-encrypted raw transcript archive envelopes: writing, reading, and
 * decrypting the objects that back the `raw/` tree. Examples live on the owning
 * declarations in `./archive.ts`.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./archive.ts";
/**
 * Machine-wide agent command circuit-breaker schemas and shared state paths.
 * Examples live on the owning declarations in `./circuit-breaker.ts`.
 *
 * @category observability
 * @since 0.0.0
 */
export * from "./circuit-breaker.ts";
/**
 * Docker Compose rendering for the local Phoenix observability backend that
 * receives exported spans. Examples live on the owning declarations in
 * `./compose.ts`.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./compose.ts";
/**
 * Bounded agent-configuration snapshots: the per-root baseline and
 * session-effective split, budgets, and the diff against the previous snapshot.
 * Examples live on the owning declarations in `./config-snapshot.ts`.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./config-snapshot.ts";
/**
 * Canonical data-root precedence: `--data-root`, `BEEP_AI_METRICS_DATA_ROOT`,
 * then the XDG state store. Examples live on the owning declarations in
 * `./data-root.ts`.
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "./data-root.ts";
/**
 * Durable delivery facts and exclusive local event states.
 *
 * **Details**
 *
 * Transport acknowledgment and positive backend visibility remain separate facts.
 *
 * Examples live in `./delivery-ledger.ts`.
 *
 * @category exports
 * @since 0.0.0
 */
export * from "./delivery-ledger.ts";
/**
 * Strict bounded OTLP trace response interpretation.
 *
 * **Details**
 *
 * HTTP 200 with a positive rejected count is partial evidence.
 *
 * Examples live in `./delivery-response.ts`.
 *
 * @category exports
 * @since 0.0.0
 */
export * from "./delivery-response.ts";
/**
 * DuckDB derived-store schema, transcript row projection, and Parquet export.
 * Examples live on the owning declarations in `./derived-storage.ts`.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./derived-storage.ts";
/**
 * Derived-store path shape and the scoped DuckDB connection wrapper every
 * reader shares. Examples live on the owning declarations in `./duckdb.ts`.
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "./duckdb.ts";
/**
 * Atomic retirement of drained evidence epochs with retained uncertainty totals.
 * Examples live in `./evidence-retention.ts`.
 * @category exports
 * @since 0.0.0
 */
export * from "./evidence-retention.ts";
/**
 * Bounded evidence windows and explicit retired-history accounting.
 * Examples live in `./evidence-window.ts`.
 * @category exports
 * @since 0.0.0
 */
export * from "./evidence-window.ts";
/**
 * Recursive file inventory traversal shared by AI metrics storage workflows.
 * Examples live on the owning declarations in `./file-inventory.ts`.
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "./file-inventory.ts";
/**
 * Telemetry-v2 flight records: structurally separate semantic and mechanical
 * inputs, privacy-safe evidence references, and durable invalid/quarantine events.
 * Examples live on the owning declarations in `./flight-record.ts`.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./flight-record.ts";
/**
 * The durable forwarder workflow that discovers sources, ingests transcripts,
 * writes derived storage, and exports spans in one pass. Examples live on the
 * owning declarations in `./forwarder.ts`.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./forwarder.ts";
/**
 * Versioned, bounded Git root observations alongside compatible legacy IDs.
 * Examples live on the declarations in `./git-root-evidence.ts`.
 *
 * @category observability
 * @since 0.0.0
 */
export * from "./git-root-evidence.ts";
/**
 * Harness evidence ledger: context surface ids, harness fingerprints, ledger
 * rows, and the derived harness-edit, budget, staleness, and warm-restart
 * predicates. Examples live on the owning declarations in
 * `./harness-ledger.ts`.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./harness-ledger.ts";
/**
 * Hook-pulse ledger contract: the schema-versioned record emitted once per
 * coding-agent hook event, and the derivation that turns a raw hook payload
 * into it. Examples live on the owning declarations in `./hook-pulse.ts`.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./hook-pulse.ts";
/**
 * Clone, repository, worktree, revision, and source-instance identity, plus the
 * canonical-root registry persisted inside the data root. Examples live on the
 * owning declarations in `./identity-registry.ts`.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./identity-registry.ts";
/**
 * Transcript ingest: turning a discovered transcript file into the privacy-safe
 * summary the derived store persists. Examples live on the owning declarations
 * in `./ingest.ts`.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./ingest.ts";
/**
 * Telemetry-v2 enumerate-before-read denominators and exact final coverage
 * attestations. Examples live on the owning declarations in
 * `./ingest-manifest.ts`.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./ingest-manifest.ts";
/**
 * Install specs and deploy targets: the storage layout, unit text, and operator
 * command plans for a collector deployment. Examples live on the owning
 * declarations in `./install.ts`.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./install.ts";
/**
 * Sanitized mirror bundles: the table exports, privacy proof, and manifest that
 * make a store shareable off-machine. Examples live on the owning declarations
 * in `./mirror.ts`.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./mirror.ts";
/**
 * Canonical AI metrics models shared by every stage of the pipeline, including
 * deploy targets and transcript sources. Examples live on the owning
 * declarations in `./models.ts`.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./models.ts";
/**
 * Single-attempt native sender with durable delivery evidence.
 * Examples live in `./native-delivery.ts`.
 * @category exports
 * @since 0.0.0
 */
export * from "./native-delivery.ts";
/**
 * Canonical native metadata projection and cache-aware OTLP encoding.
 * Examples live in `./native-export.ts`.
 * @category exports
 * @since 0.0.0
 */
export * from "./native-export.ts";
/**
 * Bounded native trace HTTP admission into the local metadata journal.
 *
 * **Details**
 *
 * Responses describe local durable admission, never backend visibility.
 *
 * Examples live in `./native-http.ts`.
 *
 * @category exports
 * @since 0.0.0
 */
export * from "./native-http.ts";
/**
 * Atomic native metadata admission sharing the bounded local intake journal.
 *
 * **Details**
 *
 * Examples live in `./native-intake.ts`.
 * @category exports
 * @since 0.0.0
 */
export * from "./native-intake.ts";
/**
 * Verified native backend observations linked to original send attempts.
 * Examples live in `./native-readback.ts`.
 * @category exports
 * @since 0.0.0
 */
export * from "./native-readback.ts";
/**
 * Bounded restartable native delivery scheduling over durable receipts.
 * Examples live in `./native-schedule.ts`.
 * @category exports
 * @since 0.0.0
 */
export * from "./native-schedule.ts";
/**
 * Positive bounded native OTLP metadata projection before durable intake.
 *
 * **Details**
 *
 * Examples live in `./native-trace.ts`.
 * @category exports
 * @since 0.0.0
 */
export * from "./native-trace.ts";
/**
 * Bounded independent physical snapshots and fresh-destination restoration.
 * Examples live in `./observation-backup.ts`.
 * @category exports
 * @since 0.0.0
 */
export * from "./observation-backup.ts";
export {
  ObservationClaimPopulationError,
  ObservationClaimPopulationEvidence,
  ObservationClaimPopulationReport,
  ObservationClaimPopulationRequest,
  readObservationClaimPopulation,
} from "./observation-claim-population.ts";
/**
 * Shared bounded worker admission, drain and maintenance coordination.
 * Examples live in `./observation-control.ts`.
 * @category exports
 * @since 0.0.0
 */
export * from "./observation-control.ts";
/**
 * Evidence-bound coverage reconciliation. Examples live on the owning declarations.
 * @category services
 * @since 0.0.0
 */
export * from "./observation-coverage.ts";
/**
 * Declared route inventory, independent population denominators, and route health.
 * Examples live in `./observation-inventory.ts`.
 *
 * @category observability
 * @since 0.0.0
 */
export * from "./observation-inventory.ts";
/**
 * Explicit private launch configuration and secret namespace binding.
 * Examples live in `./observation-launch.ts`.
 * @category exports
 * @since 0.0.0
 */
export * from "./observation-launch.ts";
/**
 * Independent durable one-attempt launch claims.
 * @since 0.0.0
 */
export * from "./observation-launch-claims.ts";
/**
 * Owner-only client for exact managed-launch submissions.
 * Examples live in `./observation-launch-client.ts`.
 * @category exports
 * @since 0.0.0
 */
export * from "./observation-launch-client.ts";
/**
 * Durable managed-launch observations. Examples live on the owning declarations.
 * @category services
 * @since 0.0.0
 */
export * from "./observation-launch-facts.ts";
/**
 * Private bounded managed-launch fact transport.
 * Examples live in `./observation-launch-http.ts`.
 * @category exports
 * @since 0.0.0
 */
export * from "./observation-launch-http.ts";
/**
 * Private bounded maintenance for a paused worker.
 * Examples live in `./observation-maintenance-http.ts`.
 * @category exports
 * @since 0.0.0
 */
export * from "./observation-maintenance-http.ts";
/**
 * Bounded declared-root inventory producer and retained observation evidence.
 *
 * **Details**
 *
 * Root probes do not qualify harness coverage.
 *
 * Examples live in `./observation-root-probe.ts`.
 *
 * @category exports
 * @since 0.0.0
 */
export * from "./observation-root-probe.ts";
/**
 * Scoped native scheduling cadence and explicit runtime freshness.
 * Examples live in `./observation-runtime.ts`.
 * @category exports
 * @since 0.0.0
 */
export * from "./observation-runtime.ts";
/**
 * Source traversal/read health with explicit partial, failed and unknown observations.
 * Examples live in `./observation-source-health.ts`.
 * @category exports
 * @since 0.0.0
 */
export * from "./observation-source-health.ts";
/**
 * Paused-by-default composition of the owned observation components.
 * Examples live in `./observation-worker.ts`.
 * @category exports
 * @since 0.0.0
 */
export * from "./observation-worker.ts";
/**
 * OTLP span projection and export: the allowlisted attribute surface and the
 * exporter that ships it. Examples live on the owning declarations in
 * `./otlp.ts`.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./otlp.ts";
/**
 * Verified payload reclamation with durable original receipts and replay identity.
 *
 * **Details**
 *
 * Uncertain delivery and compact evidence expiration remain separate policies.
 *
 * Examples live in `./payload-reclamation.ts`.
 *
 * @category exports
 * @since 0.0.0
 */
export * from "./payload-reclamation.ts";
/**
 * Salted hashing, salt provenance, and the privacy proof that no raw identifier
 * reaches a derived payload. Examples live on the owning declarations in
 * `./privacy.ts`.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./privacy.ts";
/**
 * Retention inventory, restore drills, deletion, and compaction over the raw
 * and derived trees. Examples live on the owning declarations in
 * `./retention.ts`.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./retention.ts";
/**
 * Outcome labels, benchmark cases, and the weekly scorecard report built from
 * derived storage. Examples live on the owning declarations in
 * `./scorecard.ts`.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./scorecard.ts";
/**
 * Content-free sequence-break notification schemas and shared state paths.
 * Examples live on the owning declarations in `./sequence-break.ts`.
 *
 * @category observability
 * @since 0.0.0
 */
export * from "./sequence-break.ts";
/**
 * Telemetry-v2 active-session leases, exact wait transitions, expiry
 * candidates, and source-gated tombstone reconciliation. Examples live on the
 * owning declarations in `./session-lease.ts`.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./session-lease.ts";
/**
 * Shell rendering helpers used to build the operator command strings printed by
 * install plans. Examples live on the owning declarations in `./shell.ts`.
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "./shell.ts";
/**
 * Local AI-agent source discovery: locating Claude and Codex transcript trees
 * and hashing their session lineage. Examples live on the owning declarations
 * in `./source-discovery.ts`.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./source-discovery.ts";
/**
 * Canonical telemetry-v2 lifecycle, phase, wait, outcome, evidence, skip,
 * instrument, and confidentiality vocabularies. Examples live on the owning
 * declarations in `./telemetry-v2.ts`.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./telemetry-v2.ts";
/**
 * Durable telemetry-v2 service: enumerate-before-read ingest sequencing,
 * service-derived flight records, and content-addressed atomic artifacts.
 * Examples live on the owning declarations in `./telemetry-v2-store.ts`.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./telemetry-v2-store.ts";
/**
 * Streaming discovery over declared private roots and bounded intake composition.
 * Examples live in `./transcript-discovery.ts`.
 * @category exports
 * @since 0.0.0
 */
export * from "./transcript-discovery.ts";
/**
 * Metadata-only reconstructed observations with explicit non-additive usage.
 * Examples live in `./transcript-export.ts`.
 * @category exports
 * @since 0.0.0
 */
export * from "./transcript-export.ts";
/**
 * Atomic local acceptance for metadata transcript pages and their source cursors.
 *
 * **Details**
 *
 * Local acceptance remains separate from export and backend evidence.
 *
 * Examples live in `./transcript-intake.ts`.
 *
 * @category exports
 * @since 0.0.0
 */
export * from "./transcript-intake.ts";
/**
 * Incremental metadata-only transcript pages and proposed source cursors.
 *
 * **Details**
 *
 * Source progress must be committed with durable intake, independently of export acknowledgment.
 *
 * Examples live in `./transcript-page.ts`.
 *
 * @category exports
 * @since 0.0.0
 */
export * from "./transcript-page.ts";
/**
 * Fair bounded processing of declared transcript candidates into local intake.
 *
 * **Details**
 *
 * Examples live in `./transcript-sweep.ts`.
 * @category exports
 * @since 0.0.0
 */
export * from "./transcript-sweep.ts";
