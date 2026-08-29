/**
 * Citation-signal value object: the introductory Bluebook signal word that
 * classifies how strongly an authority supports a proposition.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";

const $I = $LawPracticeDomainId.create("values/CitationSignal/CitationSignal.model");

/**
 * Introductory signal word classification for citation support level.
 *
 * **Details**
 *
 * Based on Bluebook signal categories (Rule 1.2). The `, e.g.` combined forms
 * (Rule 1.3) carry distinct meaning ("one of many illustrative authorities")
 * and are tracked separately from the bare signals.
 *
 * **Example** (Decode and check signal)
 *
 * ```ts
 * import { CitationSignal } from "@beep/law-practice-domain"
 * import * as S from "effect/Schema"
 *
 * const signal = S.decodeUnknownSync(CitationSignal)("see also")
 * console.log(signal) // "see also"
 * console.log(CitationSignal.is.compare("compare")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CitationSignal = LiteralKit([
  "see",
  "see also",
  "see generally",
  "cf",
  "but see",
  "but cf",
  "compare",
  "accord",
  "contra",
  "e.g.",
  "see, e.g.",
  "see also, e.g.",
  "but see, e.g.",
  "cf., e.g.",
  "but cf., e.g.",
]).pipe(
  $I.annoteSchema("CitationSignal", {
    description: "Introductory Bluebook signal word classifying citation support level.",
  })
);

/**
 * The decoded literal type for {@link CitationSignal} — a union of every
 * supported Bluebook signal (`"see" | "see also" | "cf" | ...`).
 *
 * **Example** (Assign typed signal literal)
 *
 * ```ts
 * import type { CitationSignal } from "@beep/law-practice-domain"
 *
 * const signal: CitationSignal = "but see"
 * console.log(signal) // "but see"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CitationSignal = typeof CitationSignal.Type;
