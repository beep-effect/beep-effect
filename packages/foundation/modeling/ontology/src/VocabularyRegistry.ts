/**
 * Pinned lookups for committed docketing, party-kind and legal-role vocabulary.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $OntologyId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as S from "effect/Schema";
import { VocabularyError, VocabularyPin } from "./Vocabulary.models.ts";
import { DocketingVocabulary, LegalRoleVocabulary, PartyKindVocabulary } from "./Vocabulary.seed.ts";
import type { VocabularyConcept, VocabularySeed } from "./Vocabulary.models.ts";

const $I = $OntologyId.create("VocabularyRegistry");

/**
 * Loads an explicit committed version and resolves exact notations within its scheme.
 *
 * **Details**
 *
 * No dates, legal consequences, holder identity or role assignments are computed.
 * Missing versions fail closed; labels never establish concept identity.
 *
 * **Example** (Resolve a pinned trademark obligation)
 * ```ts
 * import { VocabularyRegistry } from "@beep/ontology/VocabularyRegistry"
 * import * as Effect from "effect/Effect"
 * const program = VocabularyRegistry.use((registry) => registry.resolve(
 *   { kind: "docketing", version: "1.0.0" }, "StatementOfUseDeadline"
 * )).pipe(Effect.provide(VocabularyRegistry.layer))
 * console.log(program)
 * ```
 * @category services
 * @since 0.0.0
 */
export class VocabularyRegistry extends Context.Service<
  VocabularyRegistry,
  {
    readonly load: (pin: typeof VocabularyPin.Encoded) => Effect.Effect<VocabularySeed, VocabularyError>;
    readonly resolve: (
      pin: typeof VocabularyPin.Encoded,
      notation: string
    ) => Effect.Effect<VocabularyConcept, VocabularyError>;
  }
>()($I`VocabularyRegistry`) {
  /**
   * Supplies the committed versioned schemes without external I/O.
   *
   * **Example** (Load the role scheme)
   * ```ts
   * import { VocabularyRegistry } from "@beep/ontology/VocabularyRegistry"
   * import * as Effect from "effect/Effect"
   * const program = VocabularyRegistry.use((registry) => registry.load({ kind: "legal-roles", version: "1.0.0" }))
   * console.log(program.pipe(Effect.provide(VocabularyRegistry.layer)))
   * ```
   * @category layers
   * @since 0.0.0
   */
  static readonly layer = Layer.sync(VocabularyRegistry, () => ({ load, resolve }));
}

const load = Effect.fn("VocabularyRegistry.load")(function* (requested: typeof VocabularyPin.Encoded) {
  const pin = yield* S.decodeEffect(VocabularyPin)(requested).pipe(
    Effect.mapError(() => VocabularyError.make({ reason: "invalid-pin", detail: "Explicit kind and version required" }))
  );
  return yield* Effect.filterOrFail(
    Effect.succeed(
      Match.value(pin.kind).pipe(
        Match.when("docketing", () => DocketingVocabulary),
        Match.when("party-kinds", () => PartyKindVocabulary),
        Match.when("legal-roles", () => LegalRoleVocabulary),
        Match.exhaustive
      )
    ),
    (seed) => seed.version === pin.version,
    () => VocabularyError.make({ reason: "version-unpinned", detail: `${pin.kind} ${pin.version}` })
  );
});
const resolve = Effect.fn("VocabularyRegistry.resolve")(function* (
  pin: typeof VocabularyPin.Encoded,
  notation: string
) {
  const seed = yield* load(pin);
  const index = HashMap.fromIterable(
    A.map(seed.concepts, (concept): readonly [string, VocabularyConcept] => [concept.notation, concept])
  );
  return yield* Effect.fromOption(HashMap.get(index, notation), () =>
    VocabularyError.make({ reason: "concept-not-found", detail: notation })
  );
});
