/**
 * Repo AI-agent metrics models and helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

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
 * Recursive file inventory traversal shared by AI metrics storage workflows.
 * Examples live on the owning declarations in `./file-inventory.ts`.
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "./file-inventory.ts";
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
 * OTLP span projection and export: the allowlisted attribute surface and the
 * exporter that ships it. Examples live on the owning declarations in
 * `./otlp.ts`.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./otlp.ts";
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
