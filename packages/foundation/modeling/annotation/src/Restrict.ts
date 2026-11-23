/**
 * Restriction: the part of an annotation document that holds a closed set of
 * kinds.
 *
 * **Details**
 *
 * A kind set is closed when every kind its kinds' bodies may reference is in
 * it. {@link restrict} keeps the annotations of a closed set, the anchors
 * their targets use and their attribution, and refuses an open set with
 * {@link RestrictionNotClosed} instead of dropping a dependent or widening.
 * {@link restrictToOa} narrows a text document to the five OA kinds.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $AnnotationId } from "@beep/identity/packages";
import { CanonicalHashSet } from "@beep/schema/CanonicalHashSet";
import * as A from "effect/Array";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { DocumentKinds, OaDocument, OaKinds } from "./Kinds.ts";
import type { OccurrenceId } from "@beep/text/Occurrence";
import type { AnnotationDocumentView } from "./AnnotationDocument.ts";
import type { KindName, KindRegistry } from "./Kind.ts";
import type { TextDocument } from "./Kinds.ts";

const $I = $AnnotationId.create("Restrict");

/**
 * A restriction to a kind set that is not closed under body references:
 * `missing` is what the set must add.
 *
 * **Example** (Read the missing kinds)
 *
 * ```ts import.meta.vitest name="Read the missing kinds"
 * import { RestrictionNotClosed } from "@beep/annotation/Restrict"
 * import * as HashSet from "effect/HashSet"
 *
 * HashSet.has(RestrictionNotClosed.make({ missing: HashSet.make("Mention") }).missing, "Mention") // => true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class RestrictionNotClosed extends S.TaggedError<RestrictionNotClosed, { readonly brand: unique symbol }>(
  $I`RestrictionNotClosed`
)(
  "RestrictionNotClosed",
  { missing: CanonicalHashSet(S.NonEmptyString) },
  $I.annoteError<RestrictionNotClosed>("RestrictionNotClosed", {
    description: "The kinds a restriction must add to be closed under body references.",
  })
) {}

/**
 * The least superset of a kind set that is closed under each kind's
 * `references`.
 *
 * **Example** (Close a relation over its Mentions)
 *
 * ```ts import.meta.vitest name="Close a relation over its Mentions"
 * import type { KindName } from "@beep/annotation/Kind"
 * import { DocumentKinds } from "@beep/annotation/Kinds"
 * import { closure } from "@beep/annotation/Restrict"
 * import * as HashSet from "effect/HashSet"
 *
 * const relations: ReadonlyArray<KindName<typeof DocumentKinds>> = ["RelationCandidate"]
 * HashSet.has(closure(DocumentKinds)(HashSet.fromIterable(relations)), "Mention") // => true
 * ```
 *
 * @param kinds - The kind registry.
 * @returns The closure over that registry.
 * @category combinators
 * @since 0.0.0
 */
export const closure = <const Kinds extends KindRegistry>(kinds: Kinds) => {
  const names = R.keys(kinds);
  const close = (kept: HashSet.HashSet<KindName<Kinds>>): HashSet.HashSet<KindName<Kinds>> => {
    const next = HashSet.union(
      kept,
      HashSet.fromIterable(
        A.filter(names, (name) =>
          HashSet.some(kept, (keptName) =>
            O.exists(R.get(kinds, keptName), (kind) => A.contains(kind.references, name))
          )
        )
      )
    );
    return HashSet.size(next) === HashSet.size(kept) ? kept : close(next);
  };
  return close;
};

/**
 * Restrict a document to a closed kind set: the annotations of the kept
 * kinds, the anchors their targets use, and their attribution.
 *
 * **Details**
 *
 * The kept names are registered kind names by type. A set that is not closed
 * under body references is refused with {@link RestrictionNotClosed}; the
 * restriction never drops a dependent and never widens the set.
 *
 * **Example** (Keep the Mentions of a document)
 *
 * ```ts
 * import { DocumentKinds } from "@beep/annotation/Kinds"
 * import type { TextDocument } from "@beep/annotation/Kinds"
 * import type { KindName } from "@beep/annotation/Kind"
 * import { restrict } from "@beep/annotation/Restrict"
 * import * as HashSet from "effect/HashSet"
 *
 * const keep: ReadonlyArray<KindName<typeof DocumentKinds>> = ["Mention"]
 * const mentions = (document: TextDocument) => restrict(DocumentKinds)(HashSet.fromIterable(keep))(document)
 * console.log(typeof mentions)
 * ```
 *
 * @param kinds - The kind registry of the document.
 * @returns The restriction to a kept kind set.
 * @category combinators
 * @since 0.0.0
 */
export const restrict = <const Kinds extends KindRegistry>(kinds: Kinds) => {
  const close = closure(kinds);
  return (keep: HashSet.HashSet<KindName<Kinds>>) => {
    const missing = HashSet.difference(close(keep), keep);
    const kept: HashSet.HashSet<string> = keep;
    return <Document extends AnnotationDocumentView>(
      document: Document
    ): Result.Result<Document, RestrictionNotClosed> => {
      if (!HashSet.isEmpty(missing)) {
        return Result.fail(RestrictionNotClosed.make({ missing }));
      }
      const annotations = HashMap.filter(document.annotations, (annotation) => HashSet.has(kept, annotation._tag));
      const used = HashMap.reduce(annotations, HashSet.empty<OccurrenceId>(), (targets, annotation) =>
        HashSet.union(targets, annotation.targets)
      );
      return Result.succeed({
        ...document,
        anchors: HashMap.filter(document.anchors, (_, id) => HashSet.has(used, id)),
        annotations,
        attribution: HashMap.filter(document.attribution, (_, id) => HashMap.has(annotations, id)),
      });
    };
  };
};

const restrictToOaKinds = restrict(DocumentKinds)(HashSet.fromIterable(R.keys(OaKinds)));

const toOaDocument = S.decodeUnknownResult(S.toType(OaDocument));

/**
 * Narrow a text document to the five OA kinds: {@link restrict} to their
 * names, then a decode of the result's type side through `OaDocument`.
 *
 * **Details**
 *
 * The OA kinds reference no kind, so the restriction cannot refuse, and every
 * annotation it keeps is of an OA kind, so the decode cannot fail. Either
 * failure would be a defect and throws. An `ExtractionDocument` widens to a
 * `TextDocument` first.
 *
 * **Example** (Narrow a document for the OA encoder)
 *
 * ```ts
 * import type { TextDocument } from "@beep/annotation/Kinds"
 * import { restrictToOa } from "@beep/annotation/Restrict"
 *
 * const forExport = (document: TextDocument) => restrictToOa(document)
 * console.log(typeof forExport)
 * ```
 *
 * @param document - A text document.
 * @returns Its OA part.
 * @category combinators
 * @since 0.0.0
 */
export const restrictToOa = (document: TextDocument): OaDocument =>
  restrictToOaKinds(document).pipe(Result.flatMap(toOaDocument), Result.getOrThrow);
