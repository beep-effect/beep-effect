/**
 * Containment: the strict order structure and segmentation annotations form
 * over one capture.
 *
 * **Details**
 *
 * `outer` contains `inner` when both have one target and a containment level,
 * `outer`'s range covers `inner`'s and `outer`'s level is not higher, and
 * strictly lower on equal spans. Ranges are the anchors' `utf16-code-unit`
 * ranges. Extraction kinds, which have no level, and multi-target annotations
 * take part in no containment. A one-sentence paragraph contains its sentence;
 * a word whose range includes a sentence does not.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Anchored } from "@beep/text/Occurrence";
import * as A from "effect/Array";
import { constFalse, dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as R from "effect/Record";
import type { Position } from "@beep/text/OffsetUnit";
import type { AnnotationDocumentView } from "./AnnotationDocument.ts";
import type { AnnotationId } from "./AnnotationId.ts";
import type { KindRegistry } from "./Kind.ts";

// The range and level of an annotation that takes part in containment.
type Located = { readonly range: Position; readonly level: number };

const locate = (kinds: KindRegistry, document: AnnotationDocumentView, id: AnnotationId): O.Option<Located> =>
  O.flatMap(HashMap.get(document.annotations, id), (annotation) =>
    O.all({
      range: annotation.targets.pipe(
        A.fromIterable,
        O.liftPredicate((targets) => targets.length === 1),
        O.flatMap(A.head),
        O.flatMap((target) => HashMap.get(document.anchors, target)),
        O.map(Anchored.range)
      ),
      level: O.flatMap(R.get(kinds, annotation._tag), (kind) => kind.level),
    })
  );

const covers = (outer: Located, inner: Located): boolean => {
  const within = outer.range.start <= inner.range.start && inner.range.end <= outer.range.end;
  const sameSpan = outer.range.start === inner.range.start && outer.range.end === inner.range.end;
  return within && (sameSpan ? outer.level < inner.level : outer.level <= inner.level);
};

/**
 * Whether annotation `outer` contains annotation `inner` in a document.
 *
 * **Details**
 *
 * True when both have one target and a level, `outer`'s range covers
 * `inner`'s, and `outer.level <= inner.level`, strictly on equal spans. An id
 * absent from the document, a kind outside the registry, an extraction kind
 * and a multi-target annotation all give `false`.
 *
 * **Example** (Ask whether a paragraph contains a sentence)
 *
 * ```ts
 * import { contains } from "@beep/annotation/Containment"
 * import { DocumentKinds } from "@beep/annotation/Kinds"
 * import type { AnnotationId } from "@beep/annotation/AnnotationId"
 * import type { TextDocument } from "@beep/annotation/Kinds"
 *
 * const holds = (document: TextDocument, paragraph: AnnotationId, sentence: AnnotationId) =>
 *   contains(DocumentKinds)(document, paragraph, sentence)
 * console.log(typeof holds)
 * ```
 *
 * @param kinds - The kind registry, which supplies the levels.
 * @returns The containment relation over that registry.
 * @category predicates
 * @since 0.0.0
 */
export const contains = (
  kinds: KindRegistry
): {
  (outer: AnnotationId, inner: AnnotationId): (document: AnnotationDocumentView) => boolean;
  (document: AnnotationDocumentView, outer: AnnotationId, inner: AnnotationId): boolean;
} =>
  dual(3, (document: AnnotationDocumentView, outer: AnnotationId, inner: AnnotationId): boolean =>
    O.getOrElse(O.zipWith(locate(kinds, document, outer), locate(kinds, document, inner), covers), constFalse)
  );
