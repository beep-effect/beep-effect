/**
 * Frozen GovInfo and eCFR MCP tool declarations.
 *
 * Exactly four read-only tools are exposed. Every non-empty input and every
 * output schema comes directly from the public driver barrels; only the
 * no-argument eCFR title-list operation owns a package-local empty boundary
 * schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  EcfrDatedTitleParams,
  EcfrError,
  EcfrSearchParams,
  getStructureOperation,
  listTitlesOperation,
  SearchResultsResponse,
  StructureNode,
  searchResultsOperation,
  TitlesResponse,
} from "@beep/ecfr";
import { GovinfoError, Search } from "@beep/govinfo";
import { $GovLegalMcpId } from "@beep/identity/packages";
import { annotateFourHints, readOnlyToolHints } from "@beep/mcp-kit";
import * as S from "effect/Schema";
import { Tool, Toolkit } from "effect/unstable/ai";
import { ProductionToolNameCollisionReport } from "./ToolNames.ts";

const $I = $GovLegalMcpId.create("Tools");
void ProductionToolNameCollisionReport;

/**
 * Empty object accepted by the upstream `listTitles` operation.
 *
 * @example
 * ```ts
 * import { EcfrListTitlesParams } from "@beep/gov-legal-mcp/Tools"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownResult(EcfrListTitlesParams)({})
 * console.log(decoded._tag)
 * // "Success"
 * ```
 *
 * @category tool-schemas
 * @since 0.0.0
 */
export class EcfrListTitlesParams extends S.Class<EcfrListTitlesParams>($I`EcfrListTitlesParams`)(
  {},
  $I.annote("EcfrListTitlesParams", {
    description: "Empty MCP parameter object for the no-argument eCFR listTitles operation.",
  })
) {}

/**
 * Search GovInfo's official corpus with the public `Search.Payload` contract.
 * Preserves upstream operationId `search` in the tool description.
 *
 * @example
 * ```ts
 * import { GovinfoSearchTool } from "@beep/gov-legal-mcp/Tools"
 *
 * console.log(GovinfoSearchTool.name)
 * // "govinfo_search"
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const GovinfoSearchTool = annotateFourHints(
  Tool.make("govinfo_search", {
    description: "Search GovInfo's official corpus. Upstream operationId: search.",
    failure: GovinfoError,
    failureMode: "return",
    parameters: Search.Payload,
    success: Search.Success,
  }),
  readOnlyToolHints
);

/**
 * List the official CFR title catalog through eCFR operationId `listTitles`.
 *
 * @example
 * ```ts
 * import { EcfrListTitlesTool } from "@beep/gov-legal-mcp/Tools"
 *
 * console.log(EcfrListTitlesTool.name)
 * // "ecfr_list_titles"
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const EcfrListTitlesTool = annotateFourHints(
  Tool.make("ecfr_list_titles", {
    description: `List the official CFR title catalog. Upstream operationId: ${listTitlesOperation.operationId}.`,
    failure: EcfrError,
    failureMode: "return",
    parameters: EcfrListTitlesParams,
    success: TitlesResponse,
  }),
  readOnlyToolHints
);

/**
 * Search paginated eCFR content through operationId `searchResults`.
 *
 * @example
 * ```ts
 * import { EcfrSearchResultsTool } from "@beep/gov-legal-mcp/Tools"
 *
 * console.log(EcfrSearchResultsTool.name)
 * // "ecfr_search_results"
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const EcfrSearchResultsTool = annotateFourHints(
  Tool.make("ecfr_search_results", {
    description: `Search paginated eCFR content. Upstream operationId: ${searchResultsOperation.operationId}.`,
    failure: EcfrError,
    failureMode: "return",
    parameters: EcfrSearchParams,
    success: SearchResultsResponse,
  }),
  readOnlyToolHints
);

/**
 * Fetch a dated CFR title hierarchy through operationId `getStructure`.
 *
 * @example
 * ```ts
 * import { EcfrGetStructureTool } from "@beep/gov-legal-mcp/Tools"
 *
 * console.log(EcfrGetStructureTool.name)
 * // "ecfr_get_structure"
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const EcfrGetStructureTool = annotateFourHints(
  Tool.make("ecfr_get_structure", {
    description: `Fetch a dated CFR title hierarchy. Upstream operationId: ${getStructureOperation.operationId}.`,
    failure: EcfrError,
    failureMode: "return",
    parameters: EcfrDatedTitleParams,
    success: StructureNode,
  }),
  readOnlyToolHints
);

/**
 * Hard-gated GovInfo toolkit containing only the official search operation.
 *
 * @example
 * ```ts
 * import { GovinfoToolkit } from "@beep/gov-legal-mcp/Tools"
 *
 * console.log(GovinfoToolkit.tools.govinfo_search.name)
 * // "govinfo_search"
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const GovinfoToolkit = Toolkit.make(GovinfoSearchTool);

/**
 * Type for {@link GovinfoToolkit}.
 *
 * @example
 * ```ts
 * import { GovinfoToolkit } from "@beep/gov-legal-mcp/Tools"
 * import type { GovinfoToolkit as GovinfoToolkitType } from "@beep/gov-legal-mcp/Tools"
 *
 * const toolkit: GovinfoToolkitType = GovinfoToolkit
 * console.log(toolkit.tools.govinfo_search.name)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type GovinfoToolkit = typeof GovinfoToolkit;

/**
 * Always-mounted eCFR toolkit containing the three frozen keyless operations.
 *
 * @example
 * ```ts
 * import { EcfrToolkit } from "@beep/gov-legal-mcp/Tools"
 *
 * console.log(EcfrToolkit.tools.ecfr_list_titles.name)
 * // "ecfr_list_titles"
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const EcfrToolkit = Toolkit.make(EcfrListTitlesTool, EcfrSearchResultsTool, EcfrGetStructureTool);

/**
 * Type for {@link EcfrToolkit}.
 *
 * @example
 * ```ts
 * import { EcfrToolkit } from "@beep/gov-legal-mcp/Tools"
 * import type { EcfrToolkit as EcfrToolkitType } from "@beep/gov-legal-mcp/Tools"
 *
 * const toolkit: EcfrToolkitType = EcfrToolkit
 * console.log(toolkit.tools.ecfr_get_structure.name)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EcfrToolkit = typeof EcfrToolkit;
