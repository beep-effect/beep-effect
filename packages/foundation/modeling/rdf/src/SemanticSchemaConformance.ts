/**
 * RDF projection adapters for shared conformance metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Conformance from "@beep/schema/Conformance";
import { A } from "@beep/utils";
import * as O from "effect/Option";
import { SemanticSchemaSpecification, SemanticSchemaSpecificationDisposition } from "./SemanticSchemaMetadata/index.ts";

const specificationDisposition: (role: Conformance.SpecificationSourceRole) => SemanticSchemaSpecificationDisposition =
  Conformance.SpecificationSourceRole.$match({
    primarySpecification: SemanticSchemaSpecificationDisposition.thunk.normative,
    normativeDependency: SemanticSchemaSpecificationDisposition.thunk.normative,
    conformanceCorpus: SemanticSchemaSpecificationDisposition.thunk.informative,
    bestPractice: SemanticSchemaSpecificationDisposition.thunk.informative,
    implementationReference: SemanticSchemaSpecificationDisposition.thunk.informative,
    registry: SemanticSchemaSpecificationDisposition.thunk.informative,
  });

/**
 * Project the registered authorities in a conformance annotation into RDF metadata specifications.
 *
 * **Details**
 *
 * Primary specifications and normative dependencies become normative RDF
 * references. Corpora, best-practice guidance, implementation references, and
 * registries remain informative. The projection retains every source field:
 * source identifier and role, structured revision, canonical URL, content
 * hash, license, and scope. The derived version label is discriminator-aware
 * and collision-resistant across revision variants.
 *
 * **Example** (Project a specification source)
 *
 * ```ts import.meta.vitest name="Project a specification source"
 * import { semanticSpecificationsFromConformance } from "@beep/rdf/SemanticSchemaConformance"
 * import { makeAnnotation } from "@beep/schema/Conformance"
 *
 * const annotation = makeAnnotation({
 *   sources: [{
 *     id: "example-spec",
 *     title: "Example Specification",
 *     role: "primarySpecification",
 *     canonicalUrl: "https://example.com/spec",
 *     revision: { kind: "release", version: "1.0" },
 *     contentSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 *   }],
 *   profiles: [{
 *     id: "example",
 *     title: "Example",
 *     version: "1.0",
 *     description: "Example conformance profile.",
 *     sourceIds: ["example-spec"],
 *     invariantIds: ["example.rule"]
 *   }],
 *   invariants: [{
 *     id: "example.rule",
 *     title: "Example rule",
 *     statement: "The value satisfies the rule.",
 *     strength: "must",
 *     scope: "value",
 *     decidability: "localRuntime",
 *     enforcement: [{ kind: "runtime", validator: "Example.validate" }],
 *     references: [{ sourceId: "example-spec" }]
 *   }]
 * })
 *
 * const specifications = semanticSpecificationsFromConformance(annotation)
 * specifications[0]?.name // => "Example Specification"
 * ```
 *
 * @param annotation - Validated conformance annotation whose sources are projected.
 * @returns RDF semantic-schema specification records in source declaration order.
 * @invariant The output preserves source order, source count, and all conformance provenance fields.
 * @category projections
 * @since 0.0.0
 */
export const semanticSpecificationsFromConformance = (
  annotation: Conformance.Annotation
): ReadonlyArray<SemanticSchemaSpecification> =>
  A.map(annotation.sources, (source) =>
    SemanticSchemaSpecification.make({
      name: source.title,
      version: O.some(Conformance.revisionLabel(source.revision)),
      section: O.none(),
      url: O.some(source.canonicalUrl),
      localRef: O.none(),
      disposition: specificationDisposition(source.role),
      sourceId: O.some(source.id),
      sourceRole: O.some(source.role),
      revision: O.some(source.revision),
      contentSha256: O.some(source.contentSha256),
      license: source.license,
      scope: source.scope,
    })
  );
