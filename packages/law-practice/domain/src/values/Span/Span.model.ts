/**
 * Span value-object schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import { NonNegativeInt } from "@beep/schema";
import { HashMap } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { SegmentMap } from "../SegmentMap/index.ts";

const $I = $LawPracticeDomainId.create("values/Span/Span.model");

/**
 * Represents a text span with positions tracked through transformations.
 *
 * **Details**
 *
 * During text cleaning (HTML removal, whitespace normalization), positions
 * shift. Span tracks BOTH cleaned positions (for parsing) and original
 * positions (for user-facing results).
 *
 * **Example** (Creating a basic Span)
 *
 * ```ts
 * import { Span } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const span = Span.make({
 *   cleanEnd: NonNegativeInt.make(10),
 *   cleanStart: NonNegativeInt.make(0),
 *   originalEnd: NonNegativeInt.make(10),
 *   originalStart: NonNegativeInt.make(0),
 * })
 *
 * console.log(span.cleanStart)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Span extends S.Class<Span>($I`Span`)(
  {
    cleanStart: NonNegativeInt.annotateKey({
      description: "Start position in cleaned/tokenized text used during parsing",
    }),
    cleanEnd: NonNegativeInt.annotateKey({
      description: "End position in cleaned/tokenized text used during parsing",
    }),
    originalStart: NonNegativeInt.annotateKey({
      description: "Start position in original input text returned to user",
    }),
    originalEnd: NonNegativeInt.annotateKey({
      description: "End position in original input text returned to user",
    }),
  },
  $I.annote("Span", {
    description: "Represents a text span with positions tracked through transformations.",
  })
) {
  /**
   * Build a Span for a regex capture group using match.indices (ES2022 `d` flag).
   *
   * **Example** (Building Span from group index)
   *
   * ```ts
   * import { SegmentMap, Span, TransformationMap } from "@beep/law-practice-domain"
   * import { NonNegativeInt } from "@beep/schema"
   * import * as HashMap from "effect/HashMap"
   * import * as O from "effect/Option"
   *
   * const positions = HashMap.empty<NonNegativeInt, NonNegativeInt>()
   * const map = TransformationMap.make({
   *   cleanToOriginal: positions,
   *   cleanToOriginalSegments: O.some(SegmentMap.identity(10)),
   *   originalToClean: positions,
   * })
   *
   * const span = Span.fromGroupIndex(0, [1, 3], map)
   * console.log(span.cleanStart)
   * ```
   *
   * @param tokenCleanStart - The token's cleanStart position in the document
   * @param indices - match.indices[n] for the capture group
   * @param map - TransformationMap for clean-to-original resolution
   * @returns Span with both clean and original coordinates
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromGroupIndex = (
    tokenCleanStart: number,
    indices: readonly [number, number],
    map: TransformationMap
  ): Span => {
    const cleanStart = NonNegativeInt.make(tokenCleanStart + indices[0]);
    const cleanEnd = NonNegativeInt.make(tokenCleanStart + indices[1]);
    const { originalEnd, originalStart } = Span.resolveOriginal({ cleanEnd, cleanStart }, map);

    return Span.make({ cleanEnd, cleanStart, originalEnd, originalStart });
  };

  /**
   * Resolve cleaned-text span positions against the original input text.
   *
   * **Example** (Resolving original span positions)
   *
   * ```ts
   * import { SegmentMap, Span, TransformationMap } from "@beep/law-practice-domain"
   * import { NonNegativeInt } from "@beep/schema"
   * import * as HashMap from "effect/HashMap"
   * import * as O from "effect/Option"
   *
   * const positions = HashMap.empty<NonNegativeInt, NonNegativeInt>()
   * const map = TransformationMap.make({
   *   cleanToOriginal: positions,
   *   cleanToOriginalSegments: O.some(SegmentMap.identity(10)),
   *   originalToClean: positions,
   * })
   *
   * const resolved = Span.resolveOriginal(
   *   { cleanEnd: NonNegativeInt.make(5), cleanStart: NonNegativeInt.make(0) },
   *   map,
   * )
   * console.log(resolved.originalStart)
   * ```
   *
   * @category statics
   * @since 0.0.0
   */
  static readonly resolveOriginal: {
    (
      span: { readonly cleanStart: NonNegativeInt; readonly cleanEnd: NonNegativeInt },
      map: TransformationMap
    ): { readonly originalStart: NonNegativeInt; readonly originalEnd: NonNegativeInt };
    (
      map: TransformationMap
    ): (span: { readonly cleanStart: NonNegativeInt; readonly cleanEnd: NonNegativeInt }) => {
      readonly originalStart: NonNegativeInt;
      readonly originalEnd: NonNegativeInt;
    };
  } = dual(
    2,
    (
      span: { readonly cleanStart: NonNegativeInt; readonly cleanEnd: NonNegativeInt },
      map: TransformationMap
    ): { readonly originalStart: NonNegativeInt; readonly originalEnd: NonNegativeInt } =>
      O.match(map.cleanToOriginalSegments, {
        onNone: () => ({
          originalEnd: HashMap.get(map.cleanToOriginal, span.cleanEnd).pipe(O.getOrElse(() => span.cleanEnd)),
          originalStart: HashMap.get(map.cleanToOriginal, span.cleanStart).pipe(O.getOrElse(() => span.cleanStart)),
        }),
        onSome: (segmentMap) => ({
          originalEnd: NonNegativeInt.make(segmentMap.lookup(span.cleanEnd)),
          originalStart: NonNegativeInt.make(segmentMap.lookup(span.cleanStart)),
        }),
      })
  );
}

/**
 * Maps positions between cleaned and original text.
 *
 * **Details**
 *
 * Built during text transformation to track how character positions shift
 * when HTML entities are removed, whitespace is normalized, etc.
 *
 * **Example** (Creating empty TransformationMap)
 *
 * ```ts
 * import { TransformationMap } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 * import * as HashMap from "effect/HashMap"
 * import * as O from "effect/Option"
 *
 * const positions = HashMap.empty<NonNegativeInt, NonNegativeInt>()
 * const map = TransformationMap.make({
 *   cleanToOriginal: positions,
 *   cleanToOriginalSegments: O.none(),
 *   originalToClean: positions,
 * })
 *
 * console.log(map.cleanToOriginalSegments)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TransformationMap extends S.Class<TransformationMap>($I`TransformationMap`)(
  {
    cleanToOriginal: S.HashMap(NonNegativeInt, NonNegativeInt).annotateKey({
      description: "Maps cleaned text position to original text position",
    }),
    originalToClean: S.HashMap(NonNegativeInt, NonNegativeInt).annotateKey({
      description: "Maps original text position to cleaned text position",
    }),
    cleanToOriginalSegments: S.OptionFromOptionalKey(SegmentMap).annotateKey({
      description: "Compressed segment-based clean-to-original mapping for logarithmic lookup",
    }),
  },
  $I.annote("TransformationMap", {
    description: "Maps cleaned text positions to original text positions.",
  })
) {}
