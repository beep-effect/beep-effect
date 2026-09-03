/**
 * Thread-title derivation schemas for the desktop chat surface.
 *
 * @packageDocumentation
 * @category projections
 * @since 0.0.0
 */
import { $ProfessionalDesktopId } from "@beep/identity/packages";
import { TrimmedNonEmptyText } from "@beep/schema/CommonTextSchemas";
import { flow, identity } from "effect/Function";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Str from "effect/String";

const $I = $ProfessionalDesktopId.create("chat/DerivedThreadTitle");

const DERIVED_THREAD_TITLE_MAX_CHARS = 64;

const DerivedThreadTitleCanonical = S.NonEmptyString.pipe(
  S.check(
    S.isMaxLength(DERIVED_THREAD_TITLE_MAX_CHARS, {
      identifier: $I`DerivedThreadTitleMaxLength`,
      title: "Derived Thread Title Max Length",
      description: "Derived thread titles are capped to the chat sidebar display limit.",
      message: `Expected title to be at most ${DERIVED_THREAD_TITLE_MAX_CHARS} characters`,
    })
  ),
  S.check(
    S.isPattern(/^\S(?:[\s\S]*\S)?$/, {
      identifier: $I`DerivedThreadTitleTrimmed`,
      title: "Derived Thread Title Trimmed",
      description: "Derived thread titles are stored without leading or trailing whitespace.",
      message: "Expected title to be trimmed",
    })
  )
);

/**
 * Normalized title candidate derived from the first non-empty user message line.
 *
 * **Example** (Decode trimmed title candidate)
 *
 * ```ts
 * import { DerivedThreadTitle } from "@/chat/DerivedThreadTitle"
 * import * as S from "effect/Schema"
 *
 * const title = S.decodeUnknownOption(DerivedThreadTitle)("  Draft memo  ")
 * console.log(title._tag) // "Some"
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const DerivedThreadTitle = TrimmedNonEmptyText.pipe(
  S.decodeTo(
    DerivedThreadTitleCanonical,
    SchemaTransformation.transform({
      decode: flow(Str.slice(0, DERIVED_THREAD_TITLE_MAX_CHARS), Str.trim),
      encode: identity,
    })
  ),
  $I.annoteSchema("DerivedThreadTitle", {
    description: "Trimmed, non-empty, sidebar-bounded title derived from user message text.",
  })
);
