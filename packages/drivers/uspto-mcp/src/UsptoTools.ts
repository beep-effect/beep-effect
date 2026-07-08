/**
 * USPTO MCP tool declarations.
 *
 * Two tools prove the kit's core deliverables against `@beep/uspto`:
 * {@link UsptoSearchApplicationsTool} proves the `api_key_required` envelope
 * (Q6) and {@link UsptoGetDocumentsTool} proves progressive field-tier
 * projection (kit deliverable #5) against a `documentBag`-shaped response.
 * Both tools share the same `SourceAuth`-gated credential check.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $UsptoMcpId } from "@beep/identity/packages";
import { ApiKeyRequiredFailure, annotateFourHints, readOnlyToolHints } from "@beep/mcp-kit";
import { LiteralKit, PosInt, SchemaUtils } from "@beep/schema";
import { UsptoApplicationMetadata, UsptoApplicationNumber } from "@beep/uspto";
import * as S from "effect/Schema";
import { Tool, Toolkit } from "effect/unstable/ai";
import { DocumentsProjectionOutput } from "./UsptoDocumentTiers.ts";

const $I = $UsptoMcpId.create("UsptoTools");
const DEFAULT_DOCUMENT_BUDGET_BYTES = PosInt.make(8000);

const UsptoToolErrorReasonBase = LiteralKit([
  "not-found",
  "rate-limited",
  "response-decoding",
  "response-status",
  "transport",
]);

/**
 * Redacted technical failure reasons a USPTO MCP tool can surface once the
 * `api_key_required` gate has passed.
 *
 * @example
 * ```ts
 * import { UsptoToolErrorReason } from "@beep/uspto-mcp/UsptoTools"
 *
 * console.log(UsptoToolErrorReason.Enum.transport)
 * // "transport"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UsptoToolErrorReason = UsptoToolErrorReasonBase.pipe(
  $I.annoteSchema("UsptoToolErrorReason", {
    description: "Redacted technical failure reasons surfaced by a USPTO MCP tool after the credential gate passes.",
  }),
  SchemaUtils.withLiteralKitStatics(UsptoToolErrorReasonBase),
  SchemaUtils.withStatics((schema) => ({
    fromUnknown: S.decodeUnknownSync(schema),
    decodeOption: S.decodeUnknownOption(schema),
  }))
);

/**
 * Type for {@link UsptoToolErrorReason}.
 *
 * @example
 * ```ts
 * import { UsptoToolErrorReason } from "@beep/uspto-mcp/UsptoTools"
 *
 * const reason: UsptoToolErrorReason = "transport"
 * console.log(UsptoToolErrorReason.is.transport(reason))
 * // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type UsptoToolErrorReason = typeof UsptoToolErrorReason.Type;

/**
 * Structured failure returned by USPTO MCP tools once credential resolution
 * has already succeeded (transport, decoding, or upstream status failures).
 *
 * @example
 * ```ts
 * import { UsptoToolError } from "@beep/uspto-mcp/UsptoTools"
 *
 * const failure = UsptoToolError.make({
 *   message: "USPTO searchApplications failed: transport",
 *   reason: "transport",
 *   tool: "uspto_search_applications"
 * })
 * console.log(failure.reason)
 * // "transport"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UsptoToolError extends S.Class<UsptoToolError>($I`UsptoToolError`)(
  {
    message: S.NonEmptyString.annotateKey({
      description: "Human-readable failure message safe to return to an MCP tool caller.",
    }),
    reason: UsptoToolErrorReason.annotateKey({
      description: "Redacted technical failure reason from the underlying @beep/uspto driver call.",
    }),
    tool: S.NonEmptyString.annotateKey({
      description: "MCP tool that returned the failure.",
    }),
  },
  $I.annote("UsptoToolError", {
    description: "Structured USPTO MCP tool failure surfaced after the credential gate has already passed.",
  })
) {}

/**
 * Union of every typed failure a USPTO MCP tool can return: the kit's
 * `api_key_required` envelope (credential absent) or a post-gate
 * {@link UsptoToolError} (driver-level failure).
 *
 * @example
 * ```ts
 * import { UsptoMcpFailure, UsptoToolError } from "@beep/uspto-mcp/UsptoTools"
 *
 * const failure = UsptoToolError.make({
 *   message: "USPTO request failed",
 *   reason: "transport",
 *   tool: "uspto_get_documents"
 * })
 * console.log(UsptoMcpFailure.is(failure))
 * // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UsptoMcpFailure = S.Union([ApiKeyRequiredFailure, UsptoToolError]).pipe(
  $I.annoteSchema("UsptoMcpFailure", {
    description: "Union of the api_key_required envelope and post-gate USPTO driver failures.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link UsptoMcpFailure}.
 *
 * @example
 * ```ts
 * import { UsptoMcpFailure, UsptoToolError } from "@beep/uspto-mcp/UsptoTools"
 *
 * const failure: UsptoMcpFailure = UsptoToolError.make({
 *   message: "USPTO request failed",
 *   reason: "transport",
 *   tool: "uspto_get_documents"
 * })
 * console.log(UsptoMcpFailure.is(failure))
 * // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type UsptoMcpFailure = typeof UsptoMcpFailure.Type;

/**
 * Parameters for {@link UsptoSearchApplicationsTool}.
 *
 * @example
 * ```ts
 * import { UsptoSearchApplicationsParams } from "@beep/uspto-mcp/UsptoTools"
 *
 * const params = UsptoSearchApplicationsParams.make({ query: "applicationMetaData.filingDate:2023-01-01" })
 * console.log(params.query)
 * // "applicationMetaData.filingDate:2023-01-01"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UsptoSearchApplicationsParams extends S.Class<UsptoSearchApplicationsParams>(
  $I`UsptoSearchApplicationsParams`
)(
  {
    query: S.NonEmptyString.annotateKey({
      description: "USPTO Open Data Portal search query expression.",
    }),
  },
  $I.annote("UsptoSearchApplicationsParams", {
    description: "Inputs required to search USPTO applications by an Open Data Portal query expression.",
  })
) {}

/**
 * Searches USPTO applications by an Open Data Portal query expression.
 * Returns the kit's `api_key_required` envelope when `USPTO_API_KEY` is
 * absent (Q6); returns real `@beep/uspto` results when present.
 *
 * @example
 * ```ts
 * import { UsptoSearchApplicationsTool } from "@beep/uspto-mcp/UsptoTools"
 *
 * console.log(UsptoSearchApplicationsTool.name)
 * // "uspto_search_applications"
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const UsptoSearchApplicationsTool = annotateFourHints(
  Tool.make("uspto_search_applications", {
    description: "Search USPTO patent applications with an Open Data Portal query expression.",
    failure: UsptoMcpFailure,
    failureMode: "return",
    parameters: UsptoSearchApplicationsParams,
    success: S.Array(UsptoApplicationMetadata),
  }),
  readOnlyToolHints
);

/**
 * Parameters for {@link UsptoGetDocumentsTool}.
 *
 * @example
 * ```ts
 * import { PosInt } from "@beep/schema"
 * import { UsptoApplicationNumber } from "@beep/uspto"
 * import { UsptoGetDocumentsParams } from "@beep/uspto-mcp/UsptoTools"
 *
 * const params = UsptoGetDocumentsParams.make({
 *   applicationNumber: UsptoApplicationNumber.make("16138242"),
 *   budgetBytes: PosInt.make(8000)
 * })
 * console.log(params.applicationNumber)
 * // "16138242"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UsptoGetDocumentsParams extends S.Class<UsptoGetDocumentsParams>($I`UsptoGetDocumentsParams`)(
  {
    applicationNumber: UsptoApplicationNumber.annotateKey({
      description: "Eight-digit USPTO application number to list file-wrapper documents for.",
    }),
    budgetBytes: PosInt.pipe(SchemaUtils.withKeyDefaults(DEFAULT_DOCUMENT_BUDGET_BYTES)).annotateKey({
      description: "Maximum serialized size, in bytes, the reshaped response must fit within. Defaults to 8000.",
    }),
  },
  $I.annote("UsptoGetDocumentsParams", {
    description: "Inputs required to list and field-tier-project an application's file-wrapper documents.",
  })
) {}

/**
 * Lists an application's file-wrapper documents (`documentBag`-shaped) and
 * reshapes the response to the most complete field tier that fits within
 * budget, per the kit's progressive field-tier projection (deliverable #5).
 * Gated on the same `USPTO_API_KEY` credential as
 * {@link UsptoSearchApplicationsTool}.
 *
 * @example
 * ```ts
 * import { UsptoGetDocumentsTool } from "@beep/uspto-mcp/UsptoTools"
 *
 * console.log(UsptoGetDocumentsTool.name)
 * // "uspto_get_documents"
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const UsptoGetDocumentsTool = annotateFourHints(
  Tool.make("uspto_get_documents", {
    description:
      "List an application's file-wrapper documents, reshaped to the most complete field tier that fits a size budget.",
    failure: UsptoMcpFailure,
    failureMode: "return",
    parameters: UsptoGetDocumentsParams,
    success: DocumentsProjectionOutput,
  }),
  readOnlyToolHints
);

/**
 * The thin USPTO MCP proving-host toolkit: search plus document listing,
 * both gated on the same `USPTO_API_KEY` credential.
 *
 * @example
 * ```ts
 * import { UsptoToolkit } from "@beep/uspto-mcp/UsptoTools"
 *
 * console.log(Object.keys(UsptoToolkit.tools))
 * // ["uspto_search_applications", "uspto_get_documents"]
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const UsptoToolkit = Toolkit.make(UsptoSearchApplicationsTool, UsptoGetDocumentsTool);

/**
 * Type for {@link UsptoToolkit}.
 *
 * @example
 * ```ts
 * import { UsptoToolkit } from "@beep/uspto-mcp/UsptoTools"
 *
 * const toolkit: UsptoToolkit = UsptoToolkit
 * console.log(Object.keys(toolkit.tools).length)
 * // 2
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type UsptoToolkit = typeof UsptoToolkit;
