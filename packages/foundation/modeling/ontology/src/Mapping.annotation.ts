/**
 * The repository-owned mapping set from the annotation structure kinds to
 * DoCO and NIF.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Registry from "@beep/identity/Registry";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { MappingSet } from "./Mapping.ts";
import type { RegistryCurie } from "@beep/identity/Registry";
import type * as Result from "effect/Result";

const annotationMappingSetVersion = "1.0.0";

const curatedExactMatch = ([subject, object]: readonly [RegistryCurie, RegistryCurie]) => ({
  subject: Registry.iri(subject),
  predicate: "skos:exactMatch",
  object: Registry.iri(object),
  justification: "semapv:ManualMappingCuration",
  confidence: { _tag: "Absent", reason: "not-assessed" },
});

const annotationMappingSetRows = {
  id: Registry.mint("annotation", "mapping-set", "doco-nif", annotationMappingSetVersion),
  version: annotationMappingSetVersion,
  license: "Apache-2.0",
  mappings: A.map(
    [
      ["annotation:Section", "doco:Section"],
      ["annotation:Paragraph", "doco:Paragraph"],
      ["annotation:Title", "doco:Title"],
      ["annotation:Figure", "doco:Figure"],
      ["annotation:Sentence", "nif:Sentence"],
      ["annotation:Word", "nif:Word"],
    ] as const,
    curatedExactMatch
  ),
};

const decodeMappingSet = S.decodeUnknownResult(MappingSet);

/**
 * The annotation structure-kind mapping set: each kind `skos:exactMatch` its
 * DoCO or NIF class, curated by hand with no assessed confidence.
 *
 * **Details**
 *
 * The `Sentence` and `Word` rows name the NIF classes the OA codec writes for
 * those kinds. None of the terms carries a gUFO typing, so the coherence check
 * on this set proves consistency only.
 *
 * **Example** (Read the annotation mapping set)
 *
 * ```ts
 * import { annotationMappingSet } from "@beep/ontology/Mapping.annotation"
 * import * as HashSet from "effect/HashSet"
 * import * as Result from "effect/Result"
 *
 * const set = Result.getOrThrow(annotationMappingSet())
 * console.log(HashSet.size(set.mappings))
 * ```
 *
 * @returns The decoded mapping set, or the schema error that refused it.
 * @category constructors
 * @since 0.0.0
 */
export const annotationMappingSet = (): Result.Result<MappingSet, S.SchemaError> =>
  decodeMappingSet(annotationMappingSetRows);
