/** Original maybe_balance_style_tags from eyecite 2.7.6 utils.py.
 * Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationPythonUnicodeStorage,
  CitationSafetyLimitExceeded,
  CitationTextBudget,
} from "@beep/law-practice-use-cases/server";
import * as Effect from "effect/Effect";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  findCitationPythonLiteral,
  normalizeCitationPythonSlice,
  sliceCitationPythonStorage,
} from "./PythonUnicode.ts";
import type { CitationPythonUnicodeValue } from "./PythonUnicode.ts";

const $I = $LawPracticeServerId.create("internal/Citation/AnnotationStyle");
const Range = S.Struct({ start: S.Int, end: S.Int }).pipe(
  $I.annoteSchema("Range", { description: "Original signed style-span endpoints, before Python slice normalization." })
);
/** Original adjusted coordinates and lossless native span; no verified anchor.
 * @internal @category models @since 0.0.0
 */
export class CitationBalancedStyleSpan extends S.Opaque<CitationBalancedStyleSpan, { readonly brand: unique symbol }>()(
  S.Struct({ ...Range.fields, text: CitationPythonUnicodeStorage }).pipe(
    $I.annoteSchema("CitationBalancedStyleSpan", {
      description: "Completed literal style proximity expansion; XML balance is a separate check.",
    })
  )
) {}
const word = (bytes: ReadonlyArray<number>) =>
  CitationPythonUnicodeStorage.make({ width: 1, bytes: new Uint8Array(bytes) });
const tags = [
  { open: word([60, 105, 62]), close: word([60, 47, 105, 62]) },
  { open: word([60, 101, 109, 62]), close: word([60, 47, 101, 109, 62]) },
  { open: word([60, 98, 62]), close: word([60, 47, 98, 62]) },
];
const expandTag = Effect.fn("Citation.expandAnnotationStyleTag")(function* (
  source: CitationPythonUnicodeValue,
  original: typeof Range.Type,
  current: typeof Range.Type,
  tag: (typeof tags)[number],
  tolerance: number
) {
  // The source deliberately tests the initial span for every tag. It does not
  // refresh this membership view after an earlier tag changes either endpoint.
  const open = yield* findCitationPythonLiteral(source.storage, tag.open, original.start, original.end);
  const close = yield* findCitationPythonLiteral(source.storage, tag.close, original.start, original.end);
  let { start, end } = current;
  if (O.isSome(open) && O.isNone(close)) {
    const extendedEnd = Num.min(end + tag.close.bytes.length + tolerance, source.pythonLength);
    const found = yield* findCitationPythonLiteral(source.storage, tag.close, start, extendedEnd);
    end = O.match(found, { onNone: () => end, onSome: (match) => start + match.end });
  }
  if (O.isNone(open) && O.isSome(close)) {
    const extendedStart = Num.max(start - tag.open.bytes.length - tolerance, 0);
    const found = yield* findCitationPythonLiteral(source.storage, tag.open, extendedStart, end, true);
    start = O.match(found, { onNone: () => start, onSome: (match) => extendedStart + match.start });
  }
  return Range.make({ start, end });
});
/** Capture the enclosing allocation authority. Native source ownership, operation
 * admission and its captured deadline remain with the caller. This implements
 * the exact literal i/em/b proximity helper; it does not pretend that proximity
 * expansion itself proves well-formed XML or implements skip/wrap dispatch.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationStyleTagBalancer = Effect.fn("Citation.makeStyleTagBalancer")(function* () {
  const budget = yield* CitationTextBudget;
  const balance = Effect.fn("Citation.balanceAnnotationStyleSpan")(function* (
    source: CitationPythonUnicodeValue,
    start: number,
    end: number,
    tolerance?: number
  ) {
    const original = normalizeCitationPythonSlice(source.storage, start, end);
    let current = Range.make({ start, end });
    for (const tag of tags) current = yield* expandTag(source, original, current, tag, tolerance ?? 10);
    const bounds = normalizeCitationPythonSlice(source.storage, current.start, current.end);
    const text = yield* sliceCitationPythonStorage(source.storage, bounds.start, bounds.end, (layout) =>
      budget
        .reserve(layout.utf16Units)
        .pipe(
          Effect.mapError((error) => CitationSafetyLimitExceeded.make({ operation: "annotate", limit: error.limit }))
        )
    );
    return CitationBalancedStyleSpan.make({ ...current, text });
  });
  return { balance };
});
