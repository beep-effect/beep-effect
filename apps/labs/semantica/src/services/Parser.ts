import { $SemanticaId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
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
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(Parser)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Parser extends Context.Service<Parser, ParserShape>()($I`Parser`) {}
