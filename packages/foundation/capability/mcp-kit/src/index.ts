/**
 * `@beep/mcp-kit` — reusable MCP host-construction kit.
 *
 * Curated barrel for the seven kit deliverables: the {@link SourceAuth}
 * credential-gate registry, {@link ToolkitComposition} credential-keyed
 * layer composition, the {@link ApiKeyRequired} envelope, the
 * {@link TierGate} dispatch wrapper, {@link FieldTier} progressive
 * projection, the {@link SanitizedSpan} wrapper, and
 * {@link ToolAnnotations}' four-hint helper. See the package README for the
 * consumer plan.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * The `api_key_required` envelope: a typed `failureMode: "return"` tool
 * failure for sources whose credential is absent at call time.
 *
 * @since 0.0.0
 * @category errors
 */
export * from "./ApiKeyRequired.ts";
/**
 * Progressive field-tier projector and columnar reshaper: named
 * minimal/balanced/complete Schema tiers, null-stripping, columnar
 * reshaping, and fetchable handles for oversized payloads.
 *
 * @since 0.0.0
 * @category schemas
 */
export * from "./FieldTier.ts";
/**
 * Request-local initialized MCP caller identity populated during toolkit dispatch.
 *
 * @since 0.0.0
 * @category services
 */
export * from "./McpCaller.ts";
/**
 * Sanitized-span wrapper: suppresses raw tool `parameters` from reaching
 * span attributes.
 *
 * @since 0.0.0
 * @category observability
 */
export * from "./SanitizedSpan.ts";
/**
 * Source authentication gate registry: schema-first per-source registration
 * records (name, envVar, gate, signupUrl) plus credential resolution and
 * mount/vanish decisions.
 *
 * @since 0.0.0
 * @category configuration
 */
export * from "./SourceAuth.ts";
/**
 * Tier-gate dispatch wrapper: the fail-closed, refusal-as-value security
 * boundary for `tools/call`, plus its `EnabledWhen` list-filter helper and
 * sanitized audit record schema.
 *
 * @since 0.0.0
 * @category policies
 */
export * from "./TierGate.ts";
/**
 * Four-hint annotation helper: applies `readOnly`/`destructive`/`idempotent`/
 * `openWorld` MCP tool hints in one call.
 *
 * @since 0.0.0
 * @category utilities
 */
export * from "./ToolAnnotations.ts";
/**
 * Credential-keyed toolkit composition: folds gated layers, vanishing
 * `hard`-gated sources at composition time when their credential is absent.
 *
 * @since 0.0.0
 * @category layers
 */
export * from "./ToolkitComposition.ts";
export { VERSION } from "./Version.ts";
