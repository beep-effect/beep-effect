/**
 * `@beep/technical-drawing` — product-neutral hidden-line figure sets on
 * 37 CFR 1.84 sheets: geometry and view domain, sheet composition, filing
 * validator, render manifest, and the ports an adapter implements.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Pure confirmation verification for sheet-set approval.
 *
 * @since 0.0.0
 * @category approval
 */
export * from "./Approval.rules.ts";
/**
 * Sheet-set approval domain.
 *
 * @since 0.0.0
 * @category approval
 */
export * from "./Approval.schemas.ts";
/**
 * Sheet-set approval service.
 *
 * @since 0.0.0
 * @category approval
 */
export * from "./Approval.service.ts";
/**
 * Figure-set renderer and validator service.
 *
 * @since 0.0.0
 * @category services
 */
export * from "./FigureSet.service.ts";
/**
 * Geometry vocabulary: model, primitives, cameras, projected segments.
 *
 * @since 0.0.0
 * @category geometry
 */
export * from "./Geometry.schemas.ts";
/**
 * Canonical segment forms for view comparison.
 *
 * @since 0.0.0
 * @category geometry
 */
export * from "./Geometry.segments.ts";
/**
 * Render manifest schemas.
 *
 * @since 0.0.0
 * @category manifest
 */
export * from "./Manifest.schemas.ts";
/**
 * Sheet composition.
 *
 * @since 0.0.0
 * @category sheets
 */
export * from "./Sheet.compose.ts";
/**
 * Sheet rules and options.
 *
 * @since 0.0.0
 * @category sheets
 */
export * from "./Sheet.schemas.ts";
/**
 * Typed errors.
 *
 * @since 0.0.0
 * @category errors
 */
export * from "./TechnicalDrawing.errors.ts";
/**
 * Ports an adapter implements.
 *
 * @since 0.0.0
 * @category ports
 */
export * from "./TechnicalDrawing.ports.ts";
/**
 * Pure filing rules.
 *
 * @since 0.0.0
 * @category validation
 */
export * from "./Validation.rules.ts";
/**
 * Validator inputs and outputs.
 *
 * @since 0.0.0
 * @category validation
 */
export * from "./Validation.schemas.ts";
/**
 * View domain and figure-set spec.
 *
 * @since 0.0.0
 * @category views
 */
export * from "./View.schemas.ts";
