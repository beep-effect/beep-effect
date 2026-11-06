/**
 * Cleaner text allocation adapted from CPython 3.11.15 SRE substitution,
 * Unicode substring and join behavior. Python Software Foundation, PSF-2.0;
 * see THIRD_PARTY_NOTICES.md. Runtime reference issuance remains separate.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineAbsoluteMaxima } from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $LawPracticeServerId.create("internal/Citation/CleanerTextIdentity");
/** @internal @category models @since 0.0.0 */
export const CitationCleanerTextAllocation = LiteralKit(["unchanged", "empty", "space", "fresh"]).pipe(
  $I.annoteSchema("CitationCleanerTextAllocation", {
    description: "Reuse exact plain input/flatten a subclass, share empty/space, or issue fresh nonempty text.",
  })
);
/** @internal @category models @since 0.0.0 */
export type CitationCleanerTextAllocation = typeof CitationCleanerTextAllocation.Type;
/** @internal @category models @since 0.0.0 */
export const CitationCleanerTextSubtype = LiteralKit(["plain", "subclass"]).pipe(
  $I.annoteSchema("CitationCleanerTextSubtype", {
    description: "Exact text or a captured text subclass, without coercion hooks.",
  })
);
/** @internal @category models @since 0.0.0 */
export type CitationCleanerTextSubtype = typeof CitationCleanerTextSubtype.Type;
/** @internal @category models @since 0.0.0 */
export class CitationCleanerTextDescriptor extends S.Opaque<
  CitationCleanerTextDescriptor,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    text: S.String.check(S.isMaxLength(CitationEngineAbsoluteMaxima.producedTextUtf16)),
    subtype: CitationCleanerTextSubtype,
  }).pipe(
    $I.annoteSchema("CitationCleanerTextDescriptor", {
      description: "Immutable text content/type snapshot; decoding never issues runtime identity.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationCleanerTextOutput extends S.Opaque<CitationCleanerTextOutput, { readonly brand: unique symbol }>()(
  S.Struct({ text: CitationCleanerTextDescriptor.fields.text, allocation: CitationCleanerTextAllocation }).pipe(
    $I.annoteSchema("CitationCleanerTextOutput", {
      description: "Complete text plus a source allocation instruction; not an ownership or spending receipt.",
    })
  )
) {}

/** HTML joins XPath smart strings into fresh plain text, sharing only empty.
 * @internal @category operations @since 0.0.0
 */
export const citationCleanerHtmlTextOutput = (text: string): CitationCleanerTextOutput =>
  CitationCleanerTextOutput.make({ text, allocation: Str.length(text) === 0 ? "empty" : "fresh" });
