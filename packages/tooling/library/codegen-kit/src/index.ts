/**
 * Shared deterministic OpenAPI and JSON Schema generation pipeline.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Command-line helpers for package-specific generators.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export * from "./CodegenKit.cli.ts";
/**
 * Typed failures produced by the generation pipeline.
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./CodegenKit.errors.ts";
/**
 * Configuration and result models for deterministic code generation.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./CodegenKit.models.ts";
/**
 * Shared code-generation service and extension contracts.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./CodegenKit.service.ts";
