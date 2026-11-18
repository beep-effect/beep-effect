import * as Effect from "effect/Effect"
import { LiteralKit } from "@beep/schema/LiteralKit"
import * as S from "effect/Schema"

/**
 * How far a signal's source is trusted.
 *
 * @category models
 * @since 0.0.0
 */
export const Trust = LiteralKit(["low", "normal", "high"])
/**
 * @category models
 * @since 0.0.0
 */
export type Trust = typeof Trust.Type;

/**
 * One piece of evidence for a claim: what a source said, and how far the
 * source is trusted. Two signals from the same `source` are one source for
 * an admission gate.
 *
 * **Details**
 *
 * Its stored form changed in phase 3, converted on read (D22): `quote` was
 * `excerpt` and is still stored under that key, and `trust`, absent from
 * older signals, reads as `"normal"`. No stored byte is rewritten.
 *
 * **Example** (A signal from a mailbox)
 * ```ts
 * import { EvidenceSignal } from "@proto/party-contract/Evidence";
 *
 * const signal = EvidenceSignal.make({ source: "mailbox:intake", quote: "Dana Smith, also d.smith@acme" });
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EvidenceSignal = S.Struct({
  // A signal names the source it came from: an empty source is no source.
  source: S.NonEmptyString,
  quote: S.String,
  trust: Trust.pipe((self) => {
      const defaultValue = Effect.succeed(Trust.Enum.normal)
      return self.pipe(
        S.withDecodingDefaultKey(defaultValue),
        S.withConstructorDefault(defaultValue)
      )
    }
  )
}).pipe(S.encodeKeys({ quote: "excerpt" }))
/**
 * @category models
 * @since 0.0.0
 */
export type EvidenceSignal = typeof EvidenceSignal.Type;
