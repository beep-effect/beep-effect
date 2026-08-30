/**
 * Service: Inheritance Service
 *
 * **Details**
 *
 * Resolves inherited properties and class ancestry.
 * Handles the "Inheritance Gap" by computing effective properties (own + inherited).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Chunk, Context, Effect, Layer, MutableHashMap, MutableHashSet } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import type { PropertyDefinition } from "../Domain/Model/Ontology.ts";
import { OntologyService } from "./Ontology.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/Inheritance");

/**
 * Resolves inherited properties and class ancestry from ontology context.
 *
 * **Gotchas**
 *
 * The service caches the ontology context from {@link OntologyService}; a later
 * ontology reload is not visible until this service is reconstructed.
 *
 * **Example** (Look up inherited properties)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { InheritanceService } from "@effect-ontology/Service/Inheritance"
 *
 * const program = Effect.gen(function* () {
 *   const inheritance = yield* InheritanceService
 *   return yield* inheritance.getEffectiveProperties("https://example.org/Person")
 * }).pipe(Effect.provide(InheritanceService.Default))
 *
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class InheritanceService extends Context.Service<InheritanceService>()($I`InheritanceService`, {
  make: Effect.gen(function* () {
    const ontologyService = yield* OntologyService;

    // Cache the ontology context to avoid repeated lookups
    // usage of cached 'ontology' from OntologyService ensures we share the same instance
    const getContext = ontologyService.ontology;

    /**
     * Get all ancestor IRIs for a given class
     *
     * @param classIri - The IRI of the class
     * @returns Array of ancestor IRIs (transitive closure)
     */
    const getAncestors = Effect.fn("getAncestors")(function* (classIri: string) {
      const context = yield* getContext;
      const hierarchy = context.hierarchy;
      const visited = MutableHashSet.empty<string>();
      const ancestors: Array<string> = [];
      const visit = (iri: string) => {
        if (MutableHashSet.has(visited, iri)) return;
        MutableHashSet.add(visited, iri);
        const parents = hierarchy[iri] || [];
        for (const parent of parents) {
          visit(parent);
          if (!ancestors.includes(parent)) {
            ancestors.push(parent);
          }
        }
      };
      visit(classIri);
      return Chunk.fromIterable(ancestors);
    });

    /**
     * Get effective properties for a class (own + inherited)
     *
     * @param classIri - The IRI of the class
     * @returns Array of PropertyDefinitions
     */
    const getEffectiveProperties = Effect.fn("getEffectiveProperties")(function* (classIri: string) {
      const context = yield* getContext;
      const ancestors = yield* getAncestors(classIri);
      const propertyMap = MutableHashMap.empty<string, PropertyDefinition>();
      for (const p of context.properties) {
        MutableHashMap.set(propertyMap, p.id, p);
      }
      const effectivePropertyIds = MutableHashSet.empty<string>();
      const ownClass = context.classes.find((c) => c.id === classIri);
      if (P.isNotUndefined(ownClass)) {
        for (const p of ownClass.properties) {
          MutableHashSet.add(effectivePropertyIds, p);
        }
      }
      for (const ancestorIri of ancestors) {
        const ancestorClass = context.classes.find((c) => c.id === ancestorIri);
        if (P.isNotUndefined(ancestorClass)) {
          for (const p of ancestorClass.properties) {
            MutableHashSet.add(effectivePropertyIds, p);
          }
        }
      }
      const effectiveProperties: Array<PropertyDefinition> = [];
      for (const pid of effectivePropertyIds) {
        const def = MutableHashMap.get(propertyMap, pid);
        if (O.isSome(def)) {
          effectiveProperties.push(def.value);
        }
      }
      return Chunk.fromIterable(effectiveProperties);
    });

    return {
      getAncestors,
      getEffectiveProperties,
      isSubclass: Effect.fn("InheritanceService.isSubclass")(function* (childIri: string, parentIri: string) {
        if (childIri === parentIri) return true;
        const ancestors = yield* getAncestors(childIri);
        return Chunk.toReadonlyArray(ancestors).includes(parentIri);
      }),
    };
  }),
}) {
  static readonly Default = Layer.effect(this, this.make).pipe(Layer.provide([OntologyService.Default]));
}
