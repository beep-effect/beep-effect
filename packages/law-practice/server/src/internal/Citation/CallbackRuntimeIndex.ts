/**
 * Registered canonical callback resources and their exact runtime table.
 * eyecite 2.7.6 / CPython adaptations: see THIRD_PARTY_NOTICES.md.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { FullCitation } from "@beep/law-practice-domain/values";
import { Sha256HexFromBytes } from "@beep/schema";
import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { CitationCallbackFailure, CitationCallbackResource } from "./CallbackResource.ts";
import { CitationFrozenEditions } from "./FrozenEditions.ts";
import {
  CitationResourceModelInput,
  CitationResourceModels,
  CitationResourceObjectFailure,
  makeCitationResourceObjects,
} from "./ResourceObjects.ts";
import { CitationRuntimeDictionaryComparison, makeCitationRuntimeDictionary } from "./RuntimeDictionary.ts";
import type { Citation, CitationGroupMember } from "@beep/law-practice-domain/values";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { CitationResourceObject } from "./ResourceObjects.ts";

const $I = $LawPracticeServerId.create("internal/Citation/CallbackRuntimeIndex");
const Entry = S.Struct({ entryId: S.Natural, resource: CitationCallbackResource, slot: S.Natural });
const bad = () => CitationCallbackFailure.make({ reason: "identity-failed" });
/**
 * Captured index operations, separate from member-list ownership. Host-resource
 * normalization is not supplied by this canonical-only implementation.
 * @internal
 * @category services
 * @since 0.0.0
 */
export class CitationCallbackRuntimeIndexFactory extends Context.Service<
  CitationCallbackRuntimeIndexFactory,
  {
    readonly build: (owner: {
      readonly read: (reference: CitationGroupMember) => Effect.Effect<Citation, CitationCallbackFailure>;
      readonly step: Effect.Effect<void, CitationCallbackFailure>;
      readonly limits: CitationEngineLimits;
    }) => Effect.Effect<
      {
        readonly validate: (resource: CitationCallbackResource) => Effect.Effect<void, CitationCallbackFailure>;
        readonly create: (
          reference: CitationGroupMember
        ) => Effect.Effect<CitationCallbackResource, CitationCallbackFailure>;
        readonly equalityKey: (resource: CitationCallbackResource) => Effect.Effect<string, CitationCallbackFailure>;
        readonly get: (
          resource: CitationCallbackResource
        ) => Effect.Effect<O.Option<typeof Entry.Type>, CitationCallbackFailure>;
        readonly set: (
          resource: CitationCallbackResource,
          slot: number
        ) => Effect.Effect<void, CitationCallbackFailure>;
        readonly remove: (
          resource: CitationCallbackResource
        ) => Effect.Effect<O.Option<typeof Entry.Type>, CitationCallbackFailure>;
        readonly read: Effect.Effect<ReadonlyArray<typeof Entry.Type>, CitationCallbackFailure>;
        readonly clear: Effect.Effect<void>;
        readonly close: Effect.Effect<void>;
      },
      CitationCallbackFailure
    >;
  }
>()($I`CitationCallbackRuntimeIndexFactory`) {}
/**
 * Capture authenticated frozen data and Crypto once; build one registered object
 * owner and one general-key table per operation. Unregistered host resources
 * fail rather than receiving fabricated runtime hashes. No request field selects
 * this internal integration port; legacy adapter migration remains open.
 * @internal
 * @category operations
 * @since 0.0.0
 */
export const makeCitationCallbackRuntimeIndexFactory = Effect.fn("Citation.makeCallbackRuntimeIndexFactory")(
  function* () {
    const frozen = yield* CitationFrozenEditions;
    const crypto = yield* Crypto.Crypto;
    return CitationCallbackRuntimeIndexFactory.of({
      build: Effect.fn("Citation.buildCallbackRuntimeIndex")(function* (owner) {
        const nonce = yield* crypto.randomBytes(32).pipe(Effect.mapError(bad));
        const scope = yield* S.decodeEffect(Sha256HexFromBytes)(nonce).pipe(
          Effect.provideService(Crypto.Crypto, crypto),
          Effect.mapError(bad)
        );
        const models = CitationResourceModels.of({
          read: Effect.fn("Citation.callbackRuntimeSemantic")(function* (reference: CitationGroupMember) {
            const citation = yield* owner
              .read(reference)
              .pipe(Effect.mapError(() => CitationResourceObjectFailure.make({ reason: "model-failed" })));
            if (!S.is(FullCitation)(citation))
              return yield* CitationResourceObjectFailure.make({ reason: "model-failed" });
            return CitationResourceModelInput.make({ citation, missingPageIdentityHash: O.none() });
          }),
          step: owner.step.pipe(
            Effect.mapError(() => CitationResourceObjectFailure.make({ reason: "limit-exceeded" }))
          ),
        });
        const mapped = (error: { readonly reason: string }) =>
          S.is(CitationCallbackFailure)(error)
            ? CitationCallbackFailure.make({ reason: error.reason })
            : CitationCallbackFailure.make({
                reason: error.reason === "limit-exceeded" ? "limit-exceeded" : "identity-failed",
              });
        const objects = yield* makeCitationResourceObjects(owner.limits).pipe(
          Effect.provideService(Crypto.Crypto, crypto),
          Effect.provideService(CitationFrozenEditions, frozen),
          Effect.provideService(CitationResourceModels, models),
          Effect.mapError(mapped)
        );
        const table = yield* makeCitationRuntimeDictionary({
          entries: owner.limits.authorities,
          iterations: owner.limits.resolutionIterations,
        }).pipe(
          Effect.provideService(CitationRuntimeDictionaryComparison, objects.comparison),
          Effect.mapError(mapped)
        );
        let registered = HashMap.empty<
          number,
          { readonly object: CitationResourceObject; readonly resource: CitationCallbackResource }
        >();
        const resourceEquivalent = S.toEquivalence(CitationCallbackResource);
        const objectOf = Effect.fn("Citation.callbackRuntimeObject")(function* (resource: CitationCallbackResource) {
          resource = yield* S.decodeEffect(S.toType(CitationCallbackResource))(resource).pipe(Effect.mapError(bad));
          if (resource._tag === "Unhashable")
            return yield* CitationCallbackFailure.make({ reason: "unhashable-resource" });
          if (resource._tag !== "Registered" || resource.scope !== scope) return yield* bad();
          const found = yield* Effect.fromOption(HashMap.get(registered, resource.slot), bad);
          if (!resourceEquivalent(resource, found.resource)) return yield* bad();
          return found.object;
        });
        const key = Effect.fn("Citation.callbackRuntimeKey")((resource: CitationCallbackResource) =>
          objectOf(resource).pipe(Effect.flatMap(objects.key), Effect.mapError(mapped))
        );
        const entry = Effect.fn("Citation.callbackRuntimeEntry")(function* (value: {
          readonly entryId: number;
          readonly objectId: number;
          readonly value: number;
        }) {
          const found = yield* Effect.fromOption(HashMap.get(registered, value.objectId), bad);
          const codec = S.fromJsonString(CitationCallbackResource);
          const resource = yield* S.decodeEffect(codec)(
            yield* S.encodeEffect(codec)(found.resource).pipe(Effect.mapError(bad))
          ).pipe(Effect.mapError(bad));
          return { entryId: value.entryId, resource, slot: value.value };
        });
        const read = table.read.pipe(Effect.flatMap((values) => Effect.forEach(values, entry, { concurrency: 1 })));
        return {
          validate: Effect.fn("Citation.callbackRuntimeValidate")((resource: CitationCallbackResource) =>
            objectOf(resource).pipe(Effect.asVoid, Effect.mapError(mapped))
          ),
          create: Effect.fn("Citation.callbackRuntimeCreate")(function* (reference: CitationGroupMember) {
            const object = yield* objects.create(reference).pipe(Effect.mapError(mapped));
            const value: S.Json =
              reference._tag === "Mention"
                ? { kind: "default", mentionId: reference.mentionId }
                : { kind: "default", detachedId: reference.detachedId };
            const resource = CitationCallbackResource.cases.Registered.make({
              scope,
              slot: object.slot,
              truthy: true,
              value,
            });
            const codec = S.fromJsonString(CitationCallbackResource);
            const captured = yield* S.decodeEffect(codec)(
              yield* S.encodeEffect(codec)(resource).pipe(Effect.mapError(bad))
            ).pipe(Effect.mapError(bad));
            registered = HashMap.set(registered, object.slot, { object, resource: captured });
            return resource;
          }),
          equalityKey: Effect.fn("Citation.callbackRuntimeEqualityKey")(function* (resource: CitationCallbackResource) {
            return yield* S.encodeEffect(S.BigIntFromString)((yield* key(resource)).hash).pipe(Effect.mapError(bad));
          }),
          get: Effect.fn("Citation.callbackRuntimeGet")(function* (resource: CitationCallbackResource) {
            const hit = yield* table.get(yield* key(resource)).pipe(Effect.mapError(mapped));
            return O.isSome(hit) ? O.some(yield* entry(hit.value)) : O.none();
          }),
          set: Effect.fn("Citation.callbackRuntimeSet")(function* (resource: CitationCallbackResource, slot: number) {
            yield* table.set(yield* key(resource), slot).pipe(Effect.mapError(mapped));
          }),
          remove: Effect.fn("Citation.callbackRuntimeRemove")(function* (resource: CitationCallbackResource) {
            const hit = yield* table.remove(yield* key(resource)).pipe(Effect.mapError(mapped));
            return O.isSome(hit) ? O.some(yield* entry(hit.value)) : O.none();
          }),
          read,
          clear: table.clear,
          close: objects.close.pipe(
            Effect.andThen(table.clear),
            Effect.andThen(
              Effect.sync(() => {
                registered = HashMap.empty();
              })
            )
          ),
        };
      }),
    });
  }
);

/**
 * Captured runtime index shape derived from its factory service.
 * @internal
 * @category models
 * @since 0.0.0
 */
export type CitationCallbackRuntimeIndex = Effect.Success<
  ReturnType<Context.Service.Shape<typeof CitationCallbackRuntimeIndexFactory>["build"]>
>;
