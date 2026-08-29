/**
 * Canonical source-text resolver service contract.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $FileProcessingId } from "@beep/identity";
import { Context } from "effect";
import type { Effect } from "effect";
import type { SourceTextResolverError } from "./SourceText.errors.ts";
import type { ResolvedSourceText, ResolveSourceTextRequest } from "./SourceText.schema.ts";

const $I = $FileProcessingId.create("SourceText");

/**
 * Service shape implemented by authority-owning source providers.
 *
 * **Example** (Select resolver method key)
 *
 * ```ts
 * import type { SourceTextResolverShape } from "@beep/file-processing/SourceText"
 *
 * type ResolverMethod = keyof SourceTextResolverShape
 * const method: ResolverMethod = "resolve"
 * console.log(method)
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export interface SourceTextResolverShape {
  readonly resolve: (request: ResolveSourceTextRequest) => Effect.Effect<ResolvedSourceText, SourceTextResolverError>;
}

/**
 * Runtime-neutral port for resolving verified canonical source text.
 *
 * **Example** (Read service key)
 *
 * ```ts
 * import { SourceTextResolver } from "@beep/file-processing/SourceText"
 *
 * console.log(SourceTextResolver.key)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class SourceTextResolver extends Context.Service<SourceTextResolver, SourceTextResolverShape>()(
  $I`SourceTextResolver`
) {}
