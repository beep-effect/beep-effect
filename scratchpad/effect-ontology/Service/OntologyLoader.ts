/**
 * Compatibility service exposing ontology class search.
 *
 * The v4 port keeps ontology loading, indexing, and search in the canonical
 * `OntologyService`; this adapter preserves the former loader service surface.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Context, Effect, Layer } from "effect";
import { OntologyService } from "./Ontology.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/OntologyLoader");

const makeOntologyLoader = Effect.gen(function* () {
  const ontology = yield* OntologyService;
  return {
      searchClasses: ontology.searchClasses,
    };
});

export class OntologyLoader extends Context.Service<OntologyLoader>()($I`OntologyLoader`, {
  make: makeOntologyLoader,
}) {
  static readonly Default = Layer.effect(this, this.make).pipe(Layer.provide(OntologyService.Default));
}
