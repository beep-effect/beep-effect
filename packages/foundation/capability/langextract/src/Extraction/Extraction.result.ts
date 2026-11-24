/**
 * Extraction result over the verified handoff.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LangExtractId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { ExtractionHandoff } from "../Handoff/Handoff.model.ts";
import { LangExtractDiagnostics } from "./Extraction.model.ts";

const $I = $LangExtractId.create("Extraction/Extraction.result");
/**
 * Provider-neutral extraction result with its verified annotation handoff and diagnostics.
 *
 * **Example** (Build extraction result)
 *
 * ```ts
 * import type { LangExtractResult } from "@beep/langextract/Extraction"
 * const count = (result: LangExtractResult) => result.handoff.candidateCount
 * console.log(typeof count)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LangExtractResult extends S.Opaque<LangExtractResult, { readonly brand: unique symbol }>()(
  S.Struct({ handoff: ExtractionHandoff, diagnostics: LangExtractDiagnostics }).pipe(
    $I.annoteSchema("LangExtractResult", { description: "Verified annotation handoff and extraction counts." })
  )
) {}
