/**
 * Parenthetical-type value object: the signal-word classification for an
 * explanatory parenthetical, keyed off the leading gerund/verb form in the
 * parenthetical text (`(holding that ...)`, `(quoting ...)`, ...).
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";

const $I = $LawPracticeDomainId.create("values/ParentheticalType/ParentheticalType.model");

/**
 * Signal-word classification for explanatory parentheticals.
 *
 * Based on the leading gerund/verb form in the parenthetical text. Backed by a
 * {@link LiteralKit} so callers get the schema plus derived helpers:
 * `ParentheticalType.Enum` for typed literal access, `ParentheticalType.is` for
 * per-literal guards, and `ParentheticalType.Options` for the full literal
 * list.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { ParentheticalType } from "@beep/law-practice-domain"
 * import * as S from "effect/Schema"
 *
 * const kind = S.decodeUnknownSync(ParentheticalType)("holding")
 * console.log(kind) // "holding"
 * console.log(ParentheticalType.Enum.quoting) // "quoting"
 * console.log(ParentheticalType.is.citing("citing")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ParentheticalType = LiteralKit([
  "holding",
  "finding",
  "stating",
  "noting",
  "explaining",
  "quoting",
  "citing",
  "discussing",
  "describing",
  "recognizing",
  "applying",
  "rejecting",
  "adopting",
  "requiring",
  "other",
]).pipe(
  $I.annoteSchema("ParentheticalType", {
    description: "Signal-word classification for explanatory parentheticals based on the leading gerund/verb form.",
  })
);

/**
 * The decoded literal type for {@link ParentheticalType} — a union of every
 * supported parenthetical signal word (`"holding" | "finding" | "stating" |
 * ...`).
 *
 * **Example**
 *
 * @example
 * ```ts
 * import type { ParentheticalType } from "@beep/law-practice-domain"
 *
 * const kind: ParentheticalType = "explaining"
 * console.log(kind) // "explaining"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ParentheticalType = typeof ParentheticalType.Type;
