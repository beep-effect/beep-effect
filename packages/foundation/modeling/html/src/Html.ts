/**
 * Staged HTML validation facade over conformance checks and the safety policy.
 *
 * @packageDocumentation \@beep/html/Html
 * @since 0.0.0
 */
import { conform, inspectConformance } from "./Html.conformance.ts";
import { enforceSafeHtml, inspectSafeHtml } from "./Html.policy.ts";
import { readonlyStruct } from "./internal/Html.readonly.ts";
import type * as Effect from "effect/Effect";
import type { ConformantHtml, HtmlConformanceError } from "./Html.conformance.ts";
import type { HtmlRoot } from "./Html.model.ts";
import type { HtmlPolicyError, SafeHtmlAst } from "./Html.policy.ts";

const decodeConformant: (root: HtmlRoot.Type) => Effect.Effect<ConformantHtml, HtmlConformanceError> = conform;
const decodeSafe: (value: ConformantHtml) => Effect.Effect<SafeHtmlAst, HtmlPolicyError> = enforceSafeHtml;

/**
 * Staged HTML validation facade.
 *
 * **Details**
 *
 * `Conformant` admits a structural HTML root and reports HTML-model issues.
 * `Safe` narrows a conformance proof through the canonical output policy. The
 * two stages stay explicit so policy approval can never substitute for tree
 * conformance.
 *
 * **Example** (Conformant then Safe decode)
 *
 * ```ts
 * import { Html } from "@beep/html/Html"
 * import { Fragment } from "@beep/html/Html.model"
 * import * as Effect from "effect/Effect"
 *
 * const program = Html.Conformant.decode(Fragment.make({ children: [] })).pipe(
 *   Effect.flatMap(Html.Safe.decode)
 * )
 * console.log(Effect.runSync(program))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const Html = readonlyStruct({
  Conformant: readonlyStruct({
    decode: decodeConformant,
    issues: inspectConformance,
  }),
  Safe: readonlyStruct({
    decode: decodeSafe,
    issues: inspectSafeHtml,
  }),
});
