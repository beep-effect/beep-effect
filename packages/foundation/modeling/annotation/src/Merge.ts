/**
 * Merge: the union of two annotation documents over one text capture.
 *
 * **Details**
 *
 * Every table of a document is content-keyed, so the union of two documents
 * is idempotent, commutative and associative. A merge refuses two documents on
 * different captures with `@beep/text`'s `CaptureMismatch`, and a union that
 * would give one (content, activity) pair two times with
 * {@link GenerationTimeConflict}. Both refusals are the same value in either
 * argument order: the captures are ordered by their eight fields, and the
 * least conflict is reported with the earlier time on the left.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $AnnotationId } from "@beep/identity/packages";
import { ActivityId } from "@beep/schema/ContentHash";
import { CaptureMismatch } from "@beep/text/LocatorMap";
import { SourceTextIdentity } from "@beep/text/SourceTextIdentity";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { AnnotationId } from "./AnnotationId.ts";
import type { AnnotationDocumentView } from "./AnnotationDocument.ts";
import type { Generation } from "./Generation.ts";

const $I = $AnnotationId.create("Merge");

const sameCapture = S.toEquivalence(SourceTextIdentity);

/**
 * A merge that would give one (content, activity) pair two generation times,
 * `None` against `Some` included. `left` is the earlier time, `None` first.
 *
 * **Example** (Read the conflicting pair)
 *
 * ```ts import.meta.vitest name="Read the conflicting pair"
 * import { GenerationTimeConflict } from "@beep/annotation/Merge"
 * import { AnnotationId } from "@beep/annotation/AnnotationId"
 * import { ActivityId } from "@beep/schema/ContentHash"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const conflict = GenerationTimeConflict.make({
 *   annotation: AnnotationId.make("sha256:8a816f6d07f571cb31aba23d9650d0cb67c72ce6832c12b6c89f388b6fd9ddb9"),
 *   activity: ActivityId.make("sha256:2a2b259a63e6402ee336c2e1d4f1023b98bee9880bfa586fface844bca277388"),
 *   left: O.none(),
 *   right: O.some(DateTime.makeUnsafe(0)),
 * })
 * O.isNone(conflict.left) // => true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class GenerationTimeConflict extends S.TaggedError<GenerationTimeConflict, { readonly brand: unique symbol }>(
  $I`GenerationTimeConflict`
)(
  "GenerationTimeConflict",
  {
    annotation: AnnotationId,
    activity: ActivityId,
    left: S.OptionFromOptionalKey(S.DateTimeUtcFromMillis),
    right: S.OptionFromOptionalKey(S.DateTimeUtcFromMillis),
  },
  $I.annoteError<GenerationTimeConflict>("GenerationTimeConflict", {
    description: "Two generations of one (content, activity) pair that state different times.",
  })
) {}

const captureOrder: Order.Order<SourceTextIdentity> = Order.mapInput(
  Order.Array(Order.String),
  (capture: SourceTextIdentity) => [
    capture.scopeRef,
    capture.sourceRef,
    capture.locator,
    capture.sourceDigest,
    capture.textDigest,
    capture.extractor.name,
    capture.extractor.version,
    capture.normalizationVersion,
  ]
);

const timeOrder: Order.Order<O.Option<DateTime.Utc>> = O.makeOrder(DateTime.Order);

const conflictOrder: Order.Order<GenerationTimeConflict> = Order.mapInput(
  Order.Array(Order.String),
  (conflict: GenerationTimeConflict) => [conflict.annotation, conflict.activity]
);

const conflictsOfAttributionRow = (generations: HashSet.HashSet<Generation>, annotation: AnnotationId) =>
  A.flatMap(
    R.values(A.groupBy(generations, (generation) => generation.activity)),
    (group): ReadonlyArray<GenerationTimeConflict> =>
      A.match(A.drop(group, 1), {
        onEmpty: A.empty,
        onNonEmpty: () => {
          const times = A.map(group, (generation) => generation.at);
          return [
            GenerationTimeConflict.make({
              annotation,
              activity: A.headNonEmpty(group).activity,
              left: A.min(times, timeOrder),
              right: A.max(times, timeOrder),
            }),
          ];
        },
      })
  );

type Attribution = AnnotationDocumentView["attribution"];

const unionAttribution = (self: Attribution, that: Attribution): Attribution =>
  HashMap.reduce(that, self, (merged, generations, id) =>
    HashMap.set(
      merged,
      id,
      O.match(HashMap.get(merged, id), { onNone: () => generations, onSome: HashSet.union(generations) })
    )
  );

/**
 * Merge two annotation documents over one capture: the union of their
 * anchors, annotations and attribution sets.
 *
 * **Details**
 *
 * Refuses documents on different captures with `CaptureMismatch`, its two
 * captures ordered by their eight fields, and a union that gives one
 * (content, activity) pair two times with the least
 * {@link GenerationTimeConflict} by (annotation id, activity id). So
 * `merge(a, b)` and `merge(b, a)` are the same `Result`, refusals included.
 *
 * **Example** (Merge a document with itself)
 *
 * ```ts
 * import { merge } from "@beep/annotation/Merge"
 * import type { TextDocument } from "@beep/annotation/Kinds"
 *
 * const twice = (document: TextDocument) => merge(document, document)
 * console.log(typeof twice)
 * ```
 *
 * @param self - The first document.
 * @param that - The second document, over the same capture.
 * @returns The merged document, or the refusal.
 * @category combinators
 * @since 0.0.0
 */
export const merge: {
  <Document extends AnnotationDocumentView>(
    that: Document
  ): (self: Document) => Result.Result<Document, CaptureMismatch | GenerationTimeConflict>;
  <Document extends AnnotationDocumentView>(
    self: Document,
    that: Document
  ): Result.Result<Document, CaptureMismatch | GenerationTimeConflict>;
} = dual(
  2,
  <Document extends AnnotationDocumentView>(
    self: Document,
    that: Document
  ): Result.Result<Document, CaptureMismatch | GenerationTimeConflict> => {
    if (!sameCapture(self.text, that.text)) {
      return Result.fail(
        CaptureMismatch.make({
          left: Order.min(captureOrder)(self.text, that.text),
          right: Order.max(captureOrder)(self.text, that.text),
        })
      );
    }
    const attribution = unionAttribution(self.attribution, that.attribution);
    const conflicts = A.flatMap(HashMap.toEntries(attribution), ([id, generations]) =>
      conflictsOfAttributionRow(generations, id)
    );
    return A.match(conflicts, {
      onEmpty: () =>
        Result.succeed({
          ...self,
          anchors: HashMap.union(self.anchors, that.anchors),
          annotations: HashMap.union(self.annotations, that.annotations),
          attribution,
        }),
      onNonEmpty: (found) => Result.fail(A.min(found, conflictOrder)),
    });
  }
);
