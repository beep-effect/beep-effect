import { $SemanticaId } from "@beep/identity/packages";
import { Context } from "effect";
import type { Effect } from "effect";
import type { SourceDocument } from "@/schema/Document";
import type { ParseOutcome } from "@/schema/Text";

const $I = $SemanticaId.create("services/Parser");

/**
 * Never-failing source parser. Malformed input remains a typed outcome value.
 *
 * @category services
 * @since 0.0.0
 */
interface ParserShape {
  readonly parse: (document: SourceDocument, bytes: Uint8Array) => Effect.Effect<ParseOutcome>;
}

/**
 * App-local parser contract shared by the primary and breaker Layers.
 *
 * **Example** (Read the parser service)
 *
 * ```ts
 * import { Parser } from "@/services/Parser"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(Parser)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Parser extends Context.Service<Parser, ParserShape>()($I`Parser`) {}
