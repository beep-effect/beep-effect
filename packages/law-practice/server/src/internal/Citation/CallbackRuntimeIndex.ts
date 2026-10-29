/**
 * Registered canonical/custom callback resources and their exact runtime table.
 * eyecite 2.7.6 / CPython adaptations: see THIRD_PARTY_NOTICES.md.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationComponents, CitationGroupMember, FullCitation } from "@beep/law-practice-domain/values";
import { Sha256HexFromBytes } from "@beep/schema";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import {
  CitationCallbackFailure,
  CitationCallbackResource,
  CitationCallbackResourceOrigin,
} from "./CallbackResource.ts";
import { CitationFrozenEditions } from "./FrozenEditions.ts";
import {
  CitationHostComparisonOperand,
  CitationHostResource,
  CitationHostResourceAdapterFactory,
} from "./HostResources.ts";
import {
  CitationResourceModelInput,
  CitationResourceModels,
  CitationResourceObject,
  CitationResourceObjectFailure,
  makeCitationResourceObjects,
} from "./ResourceObjects.ts";
import {
  CitationRuntimeDictionaryComparison,
  CitationRuntimeDictionaryFailure,
  CitationRuntimeDictionaryKey,
  makeCitationRuntimeDictionary,
} from "./RuntimeDictionary.ts";
import { makeCitationRuntimeSet } from "./RuntimeSet.ts";
import type { Citation } from "@beep/law-practice-domain/values";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { CitationHostResourceAdapter } from "./HostResources.ts";
import type { CitationRuntimeDictionaryEntry } from "./RuntimeDictionary.ts";

const $I = $LawPracticeServerId.create("internal/Citation/CallbackRuntimeIndex");
const Entry = S.Struct({ entryId: S.Natural, resource: CitationCallbackResource, slot: S.Natural });
const bad = () => CitationCallbackFailure.make({ reason: "identity-failed" });
/**
 * Trusted semantic-object identity reads within one operation. The provider
 * supplies the source identity integer; citation content never substitutes it.
 * @internal
 * @category services
 * @since 0.0.0
 */
export class CitationMissingPageIdentities extends Context.Service<
  CitationMissingPageIdentities,
  { readonly read: (reference: CitationGroupMember) => Effect.Effect<bigint, CitationCallbackFailure> }
>()($I`CitationMissingPageIdentities`) {}
/**
 * Allocate an independent identity adapter per runtime owner. No request field
 * selects this optional server service, and no native address is inferred.
 * @internal
 * @category services
 * @since 0.0.0
 */
export class CitationMissingPageIdentityFactory extends Context.Service<
  CitationMissingPageIdentityFactory,
  {
    readonly build: Effect.Effect<Context.Service.Shape<typeof CitationMissingPageIdentities>, CitationCallbackFailure>;
  }
>()($I`CitationMissingPageIdentityFactory`) {}
const referenceKey = (reference: CitationGroupMember) =>
  reference._tag === "Mention" ? `Mention:${reference.mentionId}` : `Detached:${reference.detachedId}`;

/**
 * Captured index operations, separate from member-list ownership. Custom resources require a captured host adapter; automatic primitive
 * normalization and reentrant comparison remain separate work.
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
      readonly checkSet?: (
        entries: ReadonlyArray<CitationRuntimeDictionaryEntry>,
        previous: O.Option<CitationRuntimeDictionaryEntry>,
        value: number
      ) => Effect.Effect<void, CitationCallbackFailure>;
    }) => Effect.Effect<
      {
        readonly createHost: (input: unknown) => Effect.Effect<CitationCallbackResource, CitationCallbackFailure>;
        readonly view: (
          resource: CitationCallbackResource
        ) => Effect.Effect<CitationCallbackResource, CitationCallbackFailure>;
        readonly isTruthy: (resource: CitationCallbackResource) => Effect.Effect<boolean, CitationCallbackFailure>;
        readonly validate: (resource: CitationCallbackResource) => Effect.Effect<void, CitationCallbackFailure>;
        readonly create: (
          reference: CitationGroupMember
        ) => Effect.Effect<CitationCallbackResource, CitationCallbackFailure>;
        readonly uniqueCount: (
          resources: ReadonlyArray<CitationCallbackResource>
        ) => Effect.Effect<number, CitationCallbackFailure>;
        readonly equalityKey: (resource: CitationCallbackResource) => Effect.Effect<string, CitationCallbackFailure>;
        readonly get: (
          resource: CitationCallbackResource
        ) => Effect.Effect<O.Option<typeof Entry.Type>, CitationCallbackFailure>;
        readonly set: (
          resource: CitationCallbackResource,
          slot: number
        ) => Effect.Effect<typeof Entry.Type, CitationCallbackFailure>;
        readonly remove: (
          resource: CitationCallbackResource
        ) => Effect.Effect<O.Option<typeof Entry.Type>, CitationCallbackFailure>;
        readonly read: Effect.Effect<ReadonlyArray<typeof Entry.Type>, CitationCallbackFailure>;
        readonly origins: Effect.Effect<ReadonlyArray<CitationCallbackResourceOrigin>, CitationCallbackFailure>;
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
    const hostFactory = yield* Effect.serviceOption(CitationHostResourceAdapterFactory);
    const identityFactory = yield* Effect.serviceOption(CitationMissingPageIdentityFactory);
    return CitationCallbackRuntimeIndexFactory.of({
      build: Effect.fn("Citation.buildCallbackRuntimeIndex")(function* (owner) {
        const nonce = yield* crypto.randomBytes(32).pipe(Effect.mapError(bad));
        const scope = yield* S.decodeEffect(Sha256HexFromBytes)(nonce).pipe(
          Effect.provideService(Crypto.Crypto, crypto),
          Effect.mapError(bad)
        );
        const identities = O.isSome(identityFactory)
          ? O.some(yield* identityFactory.value.build.pipe(Effect.mapError(bad)))
          : O.none();
        let identityHashes = HashMap.empty<string, bigint>();
        const models = CitationResourceModels.of({
          read: Effect.fn("Citation.callbackRuntimeSemantic")(function* (reference: CitationGroupMember) {
            const citation = yield* owner
              .read(reference)
              .pipe(Effect.mapError(() => CitationResourceObjectFailure.make({ reason: "model-failed" })));
            if (!S.is(FullCitation)(citation))
              return yield* CitationResourceObjectFailure.make({ reason: "model-failed" });
            let missingPageIdentityHash = O.none<bigint>();
            if (citation.type === "case") {
              const groups = yield* S.encodeEffect(CitationComponents)(citation.components).pipe(
                Effect.mapError(() => CitationResourceObjectFailure.make({ reason: "model-failed" }))
              );
              if (O.exists(R.get(groups, "page"), (page) => page === null)) {
                const key = referenceKey(reference);
                missingPageIdentityHash = HashMap.get(identityHashes, key);
                if (O.isNone(missingPageIdentityHash) && O.isSome(identities)) {
                  const identityReference =
                    reference._tag === "Mention"
                      ? CitationGroupMember.cases.Mention.make({ mentionId: reference.mentionId })
                      : CitationGroupMember.cases.Detached.make({ detachedId: reference.detachedId });
                  const hash = yield* identities.value.read(identityReference).pipe(
                    Effect.flatMap(S.decodeEffect(S.BigInt)),
                    Effect.mapError(() => CitationResourceObjectFailure.make({ reason: "identity-unavailable" }))
                  );
                  identityHashes = HashMap.set(identityHashes, key, hash);
                  missingPageIdentityHash = O.some(hash);
                }
              }
            }
            return CitationResourceModelInput.make({ citation, missingPageIdentityHash });
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
        const Record = S.TaggedUnion({
          Canonical: {
            object: CitationResourceObject,
            resource: CitationCallbackResource,
            reference: CitationGroupMember,
          },
          Host: { handle: CitationHostResource, resource: CitationCallbackResource },
        });
        let registered = HashMap.empty<number, typeof Record.Type>();
        let hostSlots = HashMap.empty<number, number>();
        let nextSlot = 0;
        let closed = false;
        const recordAt = Effect.fn("Citation.callbackRecordAt")((slot: number) =>
          closed ? Effect.fail(bad()) : Effect.fromOption(HashMap.get(registered, slot), bad)
        );
        const canonicalHash = Effect.fn("Citation.callbackCanonicalHash")(function* (slot: number) {
          const record = yield* recordAt(slot);
          if (record._tag !== "Canonical") return yield* bad();
          return (yield* objects.key(record.object).pipe(Effect.mapError(mapped))).hash;
        });
        const canonicalCitation = Effect.fn("Citation.callbackCanonicalCitation")(function* (slot: number) {
          const record = yield* recordAt(slot);
          if (record._tag !== "Canonical") return yield* bad();
          const ref = yield* objects.referenceOf(record.object).pipe(Effect.mapError(mapped));
          const citation = yield* owner.read(ref);
          if (!S.is(FullCitation)(citation)) return yield* bad();
          return citation;
        });
        const host: O.Option<CitationHostResourceAdapter> = O.isSome(hostFactory)
          ? O.some(yield* hostFactory.value.build({ hash: canonicalHash, citation: canonicalCitation }))
          : O.none();
        const comparisonError = (error: CitationCallbackFailure) =>
          CitationRuntimeDictionaryFailure.make({
            reason: error.reason === "limit-exceeded" ? "limit-exceeded" : "comparison-failed",
          });
        const operand = (slot: number, record: typeof Record.Type): CitationHostComparisonOperand =>
          record._tag === "Canonical"
            ? CitationHostComparisonOperand.cases.Canonical.make({ slot })
            : { _tag: "Host", handle: record.handle };
        const comparison = CitationRuntimeDictionaryComparison.of({
          step: objects.comparison.step,
          equal: Effect.fn("Citation.callbackMixedEqual")(function* (left: number, right: number) {
            const a = yield* recordAt(left).pipe(Effect.mapError(comparisonError));
            const b = yield* recordAt(right).pipe(Effect.mapError(comparisonError));
            if (a._tag === "Canonical" && b._tag === "Canonical")
              return yield* objects.comparison.equal(a.object.slot, b.object.slot);
            if (O.isNone(host)) return yield* comparisonError(bad());
            return yield* host.value
              .compare(operand(left, a), operand(right, b))
              .pipe(Effect.mapError(comparisonError));
          }),
          beforeSet: Effect.fn("Citation.callbackBeforeSet")((entries, previous, value) =>
            owner.checkSet === undefined
              ? Effect.void
              : owner.checkSet(entries, previous, value).pipe(Effect.mapError(comparisonError))
          ),
        });
        const table = yield* makeCitationRuntimeDictionary({
          entries: owner.limits.authorities,
          iterations: owner.limits.resolutionIterations,
        }).pipe(Effect.provideService(CitationRuntimeDictionaryComparison, comparison), Effect.mapError(mapped));
        const issueSlot = Effect.suspend(() => {
          if (closed || nextSlot >= owner.limits.resolutionIterations)
            return Effect.fail(CitationCallbackFailure.make({ reason: closed ? "identity-failed" : "limit-exceeded" }));
          return Effect.succeed(nextSlot++);
        });
        const resourceEquivalent = S.toEquivalence(CitationCallbackResource);
        const objectOf = Effect.fn("Citation.callbackRuntimeObject")(function* (resource: CitationCallbackResource) {
          resource = yield* S.decodeEffect(S.toType(CitationCallbackResource))(resource).pipe(Effect.mapError(bad));
          if (resource._tag === "Unhashable")
            return yield* CitationCallbackFailure.make({ reason: "unhashable-resource" });
          if (resource._tag !== "Registered" || resource.scope !== scope) return yield* bad();
          const found = yield* Effect.fromOption(HashMap.get(registered, resource.slot), bad);
          if (found._tag === "Canonical" && !resourceEquivalent(resource, found.resource)) return yield* bad();
          return { record: found, slot: resource.slot };
        });
        const key = Effect.fn("Citation.callbackRuntimeKey")(function* (resource: CitationCallbackResource) {
          const found = yield* objectOf(resource);
          let hash: bigint;
          if (found.record._tag === "Canonical") hash = yield* canonicalHash(found.slot);
          else {
            if (O.isNone(host)) return yield* bad();
            yield* owner.step;
            hash = yield* host.value.hash(found.record.handle);
          }
          return yield* S.decodeUnknownEffect(S.toType(CitationRuntimeDictionaryKey))({
            objectId: found.slot,
            hash,
          }).pipe(Effect.mapError(bad));
        });
        const resourceView = Effect.fn("Citation.callbackResourceView")(function* (record: typeof Record.Type) {
          const codec = S.fromJsonString(CitationCallbackResource);
          if (record._tag === "Canonical")
            return yield* S.decodeEffect(codec)(
              yield* S.encodeEffect(codec)(record.resource).pipe(Effect.mapError(bad))
            ).pipe(Effect.mapError(bad));
          if (O.isNone(host) || record.resource._tag !== "Registered") return yield* bad();
          const value = yield* S.decodeEffect(S.Json)(yield* host.value.presentation(record.handle)).pipe(
            Effect.mapError(bad)
          );
          return CitationCallbackResource.cases.Registered.make({ scope, slot: record.resource.slot, value });
        });
        const entry = Effect.fn("Citation.callbackRuntimeEntry")(function* (value: {
          readonly entryId: number;
          readonly objectId: number;
          readonly value: number;
        }) {
          const found = yield* Effect.fromOption(HashMap.get(registered, value.objectId), bad);
          const resource = yield* resourceView(found);
          return { entryId: value.entryId, resource, slot: value.value };
        });
        const read = table.read.pipe(Effect.flatMap((values) => Effect.forEach(values, entry, { concurrency: 1 })));
        return {
          view: Effect.fn("Citation.callbackCurrentResource")(function* (resource: CitationCallbackResource) {
            return yield* resourceView((yield* objectOf(resource)).record);
          }),
          createHost: Effect.fn("Citation.callbackHostCreate")(function* (input: unknown) {
            if (closed || O.isNone(host)) return yield* bad();
            yield* owner.step;
            // Validate without decoding: a structural decoder can copy an issuer-owned
            // handle and invalidate its native object identity.
            const handle = yield* host.value.capture(input);
            if (!S.is(CitationHostResource)(handle)) return yield* bad();
            const existing = HashMap.get(hostSlots, handle.slot);
            if (O.isSome(existing)) return yield* resourceView(yield* recordAt(existing.value));
            const slot = yield* issueSlot;
            const value = yield* S.decodeEffect(S.Json)(yield* host.value.presentation(handle)).pipe(
              Effect.mapError(bad)
            );
            const resource = CitationCallbackResource.cases.Registered.make({ scope, slot, value });
            registered = HashMap.set(registered, slot, { _tag: "Host", handle, resource });
            hostSlots = HashMap.set(hostSlots, handle.slot, slot);
            return resource;
          }),
          isTruthy: Effect.fn("Citation.callbackRuntimeTruthy")(function* (resource: CitationCallbackResource) {
            if (resource._tag === "None") return false;
            if (resource._tag !== "Registered") return resource.truthy;
            const found = yield* objectOf(resource);
            if (found.record._tag === "Canonical") return true;
            if (O.isNone(host)) return yield* bad();
            yield* owner.step;
            return yield* host.value.truthy(found.record.handle);
          }),
          validate: Effect.fn("Citation.callbackRuntimeValidate")((resource: CitationCallbackResource) =>
            objectOf(resource).pipe(Effect.asVoid, Effect.mapError(mapped))
          ),
          create: Effect.fn("Citation.callbackRuntimeCreate")(function* (reference: CitationGroupMember) {
            const slot = yield* issueSlot;
            const object = yield* objects.create(reference).pipe(Effect.mapError(mapped));
            const ownedReference = yield* objects.referenceOf(object).pipe(Effect.mapError(mapped));
            const value: S.Json =
              ownedReference._tag === "Mention"
                ? { kind: "default", mentionId: ownedReference.mentionId }
                : { kind: "default", detachedId: ownedReference.detachedId };
            const resource = CitationCallbackResource.cases.Registered.make({
              scope,
              slot,
              value,
            });
            const codec = S.fromJsonString(CitationCallbackResource);
            const captured = yield* S.decodeEffect(codec)(
              yield* S.encodeEffect(codec)(resource).pipe(Effect.mapError(bad))
            ).pipe(Effect.mapError(bad));
            registered = HashMap.set(registered, slot, {
              _tag: "Canonical",
              object,
              resource: captured,
              reference: ownedReference,
            });
            return resource;
          }),
          uniqueCount: Effect.fn("Citation.callbackRuntimeUniqueCount")(function* (
            resources: ReadonlyArray<CitationCallbackResource>
          ) {
            if (closed) return yield* bad();
            const set = yield* makeCitationRuntimeSet({
              entries: owner.limits.authorities,
              iterations: owner.limits.resolutionIterations,
            }).pipe(Effect.provideService(CitationRuntimeDictionaryComparison, comparison), Effect.mapError(mapped));
            for (const resource of resources) {
              yield* owner.step;
              yield* set.add(yield* key(resource)).pipe(Effect.mapError(mapped));
            }
            return A.length(yield* set.read);
          }),
          equalityKey: Effect.fn("Citation.callbackRuntimeEqualityKey")(function* (resource: CitationCallbackResource) {
            if ((yield* objectOf(resource)).record._tag !== "Canonical") return yield* bad();
            return yield* S.encodeEffect(S.BigIntFromString)((yield* key(resource)).hash).pipe(Effect.mapError(bad));
          }),
          get: Effect.fn("Citation.callbackRuntimeGet")(function* (resource: CitationCallbackResource) {
            const hit = yield* table.get(yield* key(resource)).pipe(Effect.mapError(mapped));
            return O.isSome(hit) ? O.some(yield* entry(hit.value)) : O.none();
          }),
          set: Effect.fn("Citation.callbackRuntimeSet")(function* (resource: CitationCallbackResource, slot: number) {
            return yield* entry(yield* table.set(yield* key(resource), slot).pipe(Effect.mapError(mapped)));
          }),
          remove: Effect.fn("Citation.callbackRuntimeRemove")(function* (resource: CitationCallbackResource) {
            const hit = yield* table.remove(yield* key(resource)).pipe(Effect.mapError(mapped));
            return O.isSome(hit) ? O.some(yield* entry(hit.value)) : O.none();
          }),
          read,
          origins: Effect.suspend(() =>
            closed
              ? Effect.fail(bad())
              : Effect.succeed(
                  A.map(registered.pipe(HashMap.entries, A.fromIterable), ([slot, record]) =>
                    record._tag === "Canonical"
                      ? CitationCallbackResourceOrigin.cases.Canonical.make({
                          scope,
                          slot,
                          reference: record.reference,
                          missingPageIdentityHash: HashMap.get(identityHashes, referenceKey(record.reference)),
                        })
                      : CitationCallbackResourceOrigin.cases.Host.make({ scope, slot })
                  )
                )
          ),
          clear: table.clear,
          close: Effect.sync(() => {
            closed = true;
          }).pipe(
            Effect.andThen(O.isSome(host) ? host.value.close : Effect.void),
            Effect.andThen(objects.close),
            Effect.andThen(table.clear),
            Effect.andThen(
              Effect.sync(() => {
                registered = HashMap.empty();
                hostSlots = HashMap.empty();
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
