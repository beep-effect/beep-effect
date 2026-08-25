/**
 * Public exports for the repo-local docgen package.
 *
 * **When to use**
 *
 * Use as the namespace-first entry point for configuring, running, and
 * extending repository documentation generation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * @category validation
 * @since 0.0.0
 */
export * as Checker from "./Checker.ts";
/**
 * @category configuration
 * @since 0.0.0
 */
export * as Configuration from "./Configuration.ts";
/**
 * @category workflows
 * @since 0.0.0
 */
export * as Core from "./Core.ts";
/**
 * @category models
 * @since 0.0.0
 */
export * as Domain from "./Domain.ts";
/**
 * @category parsing
 * @since 0.0.0
 */
export * as Parser from "./Parser.ts";
/**
 * @category formatting
 * @since 0.0.0
 */
export * as Printer from "./Printer.ts";
/**
 * @category workflows
 * @since 0.0.0
 */
export * as ProofManifest from "./ProofManifest.ts";
/**
 * Package version reader used by the CLI banner and proof manifests.
 *
 * @since 0.0.0
 */
export * as Version from "./Version.ts";
