/**
 * Exact identity, IRI, and CURIE dereferencing contracts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Context, Effect, HashMap, Layer, pipe, Tuple } from "effect";
import * as S from "effect/Schema";
import { $IdentityId } from "./packages.ts";
import type { IdentityComposer } from "./Id.ts";
import type { VocabShape } from "./Vocab.ts";

const $I = $IdentityId.create("IdentityRegistry");

/**
 * The three exact address encodings an {@link IdentityRef} can carry.
 *
 * **Example** (Check an encoding literal)
 *
 * ```ts import.meta.vitest name="Check an encoding literal"
 * import { IdentityEncoding } from "@beep/identity"
 *
 * IdentityEncoding.literals.includes("curie") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const IdentityEncoding = S.Literals(["identity", "iri", "curie"]);

/**
 * Type for {@link IdentityEncoding}.
 *
 * @category schemas
 * @since 0.0.0
 */
export type IdentityEncoding = typeof IdentityEncoding.Type;

const makeIdentityRefMember = <Encoding extends IdentityEncoding>(encoding: S.Literal<Encoding>) =>
  S.Struct({ _tag: S.tag(encoding.literal), value: S.String });

/**
 * Exact registry reference in canonical identity, IRI, or CURIE form.
 *
 * **Example** (Decode an IRI reference)
 *
 * ```ts import.meta.vitest name="Decode an IRI reference"
 * import { IdentityRef } from "@beep/identity"
 * import * as S from "effect/Schema"
 *
 * const ref = S.decodeSync(IdentityRef)({
 *   _tag: "iri",
 *   value: "https://ns.beep.sh/identity/Widget"
 * })
 * ref._tag // => "iri"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const IdentityRef = IdentityEncoding.mapMembers(
  Tuple.evolve([makeIdentityRefMember, makeIdentityRefMember, makeIdentityRefMember])
).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("IdentityRef", {
    description: "Exact identity reference in one of three encodings: identity, IRI, or CURIE.",
  })
);

/**
 * Decoded exact reference accepted by {@link IdentityRegistryShape.resolve}.
 *
 * @see {@link IdentityRef} for the runtime schema and tagged constructors.
 * @category models
 * @since 0.0.0
 */
export type IdentityRef = typeof IdentityRef.Type;

/**
 * Registry row containing all three exact address projections and named string fibers.
 *
 * **Example** (Construct a registry entry)
 *
 * ```ts
 * import { IdentityEntry } from "@beep/identity"
 *
 * const entry = IdentityEntry.make({
 *   identity: "@beep/identity/Widget",
 *   iri: "https://ns.beep.sh/identity/Widget",
 *   curie: "beep:identity/Widget",
 *   fibers: { label: "Widget" }
 * })
 * console.log(entry.curie)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class IdentityEntry extends S.Class<IdentityEntry>("@beep/identity/IdentityRegistry/IdentityEntry")(
  {
    identity: S.String,
    iri: S.String,
    curie: S.String,
    fibers: S.Record(S.String, S.String),
  },
  $I.annote("IdentityEntry", {
    description: "One registered identity with its literal IRI and CURIE projections and named string fiber parts.",
  })
) {
  /**
   * Copies literal address projections from an already-bound identity composer.
   *
   * **Example** (Build an entry from a package composer)
   *
   * ```ts import.meta.vitest name="Build an entry from a package composer"
   * import { $IdentityId, IdentityEntry } from "@beep/identity"
   *
   * const composer = $IdentityId.create("Widget")
   * const entry = IdentityEntry.fromComposer(composer, { label: "Widget" })
   * entry.iri === composer.iri // => true
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromComposer = <
    const Value extends string,
    const Authority extends string,
    const Prefix extends string,
    const Vocab extends VocabShape,
  >(
    composer: IdentityComposer<Value, Authority, Prefix, Vocab>,
    fibers: Readonly<Record<string, string>>
  ): IdentityEntry =>
    IdentityEntry.make({
      identity: composer.identifier,
      iri: composer.iri,
      curie: composer.curie,
      fibers,
    });
}

/**
 * Encoded representation accepted by {@link IdentityEntry}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace IdentityEntry {
  /**
   * Encoded registry row before class decoding.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof IdentityEntry.Encoded;
}

/**
 * Failure returned when no entry matches an exact registry reference.
 *
 * **Example** (Construct a missing-reference failure)
 *
 * ```ts import.meta.vitest name="Construct a missing-reference failure"
 * import { IdentityNotFoundError } from "@beep/identity"
 *
 * const error = IdentityNotFoundError.make({
 *   ref: { _tag: "curie", value: "beep:missing" }
 * })
 * error._tag // => "IdentityNotFoundError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class IdentityNotFoundError extends S.TaggedError<IdentityNotFoundError>(
  "@beep/identity/IdentityRegistry/IdentityNotFoundError"
)(
  "IdentityNotFoundError",
  { ref: IdentityRef },
  $I.annoteError<IdentityNotFoundError>("IdentityNotFoundError", {
    description: "No registered identity matches the exact reference.",
  })
) {}

/**
 * Failure returned while building a local registry whose exact index key is duplicated.
 *
 * **Example** (Construct an identity conflict)
 *
 * ```ts import.meta.vitest name="Construct an identity conflict"
 * import { IdentityRegistryConflictError } from "@beep/identity"
 *
 * const error = IdentityRegistryConflictError.make({
 *   encoding: "identity",
 *   key: "@beep/identity/Widget"
 * })
 * error.encoding // => "identity"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class IdentityRegistryConflictError extends S.TaggedError<IdentityRegistryConflictError>(
  "@beep/identity/IdentityRegistry/IdentityRegistryConflictError"
)(
  "IdentityRegistryConflictError",
  {
    encoding: IdentityEncoding,
    key: S.String,
  },
  $I.annoteError<IdentityRegistryConflictError>("IdentityRegistryConflictError", {
    description: "Two registered entries share the same key in one encoding.",
  })
) {}

/**
 * Exact dereferencing service contract shared by local and downstream store-backed layers.
 *
 * @category services
 * @since 0.0.0
 */
export interface IdentityRegistryShape {
  readonly resolve: (ref: IdentityRef) => Effect.Effect<IdentityEntry, IdentityNotFoundError>;
}

/**
 * Context service for exact identity, IRI, and CURIE dereferencing.
 *
 * **Example** (Provide an empty local registry)
 *
 * ```ts
 * import { IdentityRegistry } from "@beep/identity"
 * import { Effect } from "effect"
 *
 * const program = IdentityRegistry.use((registry) =>
 *   registry.resolve({ _tag: "identity", value: "@beep/missing" })
 * ).pipe(Effect.provide(IdentityRegistry.layerLocal([])))
 *
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class IdentityRegistry extends Context.Service<IdentityRegistry, IdentityRegistryShape>()(
  "@beep/identity/IdentityRegistry"
) {
  /**
   * Builds immutable indexes for all three exact encodings and fails on duplicate keys.
   *
   * **Example** (Create a local registry layer)
   *
   * ```ts
   * import { IdentityEntry, IdentityRegistry } from "@beep/identity"
   *
   * const entry = IdentityEntry.make({
   *   identity: "@beep/identity/Widget",
   *   iri: "https://ns.beep.sh/identity/Widget",
   *   curie: "beep:identity/Widget",
   *   fibers: {}
   * })
   * console.log(IdentityRegistry.layerLocal([entry]))
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layerLocal = (
    entries: ReadonlyArray<IdentityEntry>
  ): Layer.Layer<IdentityRegistry, IdentityRegistryConflictError> =>
    Layer.effect(IdentityRegistry, makeLocalRegistry(entries));
}

const makeLocalRegistry = Effect.fn("IdentityRegistry.layerLocal")(function* (entries: ReadonlyArray<IdentityEntry>) {
  let identityIndex = HashMap.empty<string, IdentityEntry>();
  let iriIndex = HashMap.empty<string, IdentityEntry>();
  let curieIndex = HashMap.empty<string, IdentityEntry>();

  for (const entry of entries) {
    if (HashMap.has(identityIndex, entry.identity)) {
      return yield* IdentityRegistryConflictError.make({ encoding: "identity", key: entry.identity });
    }
    if (HashMap.has(iriIndex, entry.iri)) {
      return yield* IdentityRegistryConflictError.make({ encoding: "iri", key: entry.iri });
    }
    if (HashMap.has(curieIndex, entry.curie)) {
      return yield* IdentityRegistryConflictError.make({ encoding: "curie", key: entry.curie });
    }

    identityIndex = HashMap.set(identityIndex, entry.identity, entry);
    iriIndex = HashMap.set(iriIndex, entry.iri, entry);
    curieIndex = HashMap.set(curieIndex, entry.curie, entry);
  }

  return IdentityRegistry.of({
    resolve: Effect.fn("IdentityRegistry.resolve")(function* (ref) {
      const found = IdentityRef.match(ref, {
        identity: ({ value }) => HashMap.get(identityIndex, value),
        iri: ({ value }) => HashMap.get(iriIndex, value),
        curie: ({ value }) => HashMap.get(curieIndex, value),
      });

      return yield* pipe(
        found,
        Effect.fromOption(() => IdentityNotFoundError.make({ ref }))
      );
    }),
  });
});
