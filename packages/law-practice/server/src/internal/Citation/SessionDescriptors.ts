/**
 * Default canonical descriptors from authenticated issued-session origins.
 * eyecite 2.7.6 Resource hash semantics; BSD-2-Clause attribution in notices.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { FullCitation } from "@beep/law-practice-domain/values";
import { Sha256HexFromBytes } from "@beep/schema";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { CitationCallbackResourceOrigin } from "./CallbackResource.ts";
import { CitationCallbackFailure, CitationResolutionWork, readCapturedCitationSession } from "./CallbackSession.ts";
import { CitationFrozenEditions } from "./FrozenEditions.ts";
import { CitationResourceIdentity } from "./ResourceIdentity.ts";
import {
  CitationResourceModelInput,
  CitationResourceModels,
  CitationResourceObjectFailure,
  makeCitationResourceObjects,
} from "./ResourceObjects.ts";
import { CitationSessionResourceDescriptors } from "./SessionDocument.ts";
import type { CitationGroupMember } from "@beep/law-practice-domain/values";
import type { CitationCallbackResource } from "./CallbackResource.ts";

const $I = $LawPracticeServerId.create("internal/Citation/SessionDescriptors");
/**
 * Optional pure descriptor service for registry-classified host resources.
 * It is never selected by presentation shape or a request function field.
 * @internal
 * @category services
 * @since 0.0.0
 */
export class CitationSessionHostResourceDescriptors extends Context.Service<
  CitationSessionHostResourceDescriptors,
  Context.Service.Shape<typeof CitationSessionResourceDescriptors>
>()($I`CitationSessionHostResourceDescriptors`) {}
const Scope = S.fromJsonString(
  S.Tuple([
    S.tag("citation-canonical-resource-descriptor/v1"),
    S.tag("eyecite/2.7.6"),
    S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
  ])
);
const Key = S.fromJsonString(S.Tuple([S.tag("eyecite-resource-current-hash/v1"), S.BigIntFromString]));
const failed = () => CitationCallbackFailure.make({ reason: "identity-failed" });
const modelFailed = () => CitationResourceObjectFailure.make({ reason: "model-failed" });
const mapped = (error: { readonly reason: string }) =>
  CitationCallbackFailure.make({ reason: error.reason === "limit-exceeded" ? "limit-exceeded" : "identity-failed" });
/**
 * Derive canonical descriptors from final immutable semantics and authenticated
 * edition payloads. No dispatch key, host hash, equality or truth method runs.
 * Current Resource hashes are the pinned class's equality domain, including
 * order-sensitive publication payloads. Null-page native identity allocation
 * comes from the captured trusted identity adapter; absent data fails closed.
 * @internal
 * @category operations
 * @since 0.0.0
 */
export const makeCitationRegisteredSessionDescriptors = Effect.fn("Citation.makeRegisteredSessionDescriptors")(
  function* (input: unknown) {
    const state = yield* readCapturedCitationSession(input);
    const crypto = yield* Crypto.Crypto;
    const editions = yield* CitationFrozenEditions;
    const host = yield* Effect.serviceOption(CitationSessionHostResourceDescriptors);
    const origins = HashMap.fromIterable(
      A.map(state.resourceOrigins, (origin) => [`${origin.scope}:${origin.slot}`, origin] as const)
    );
    const identityHashes = HashMap.fromIterable(
      A.map(
        A.filter(state.resourceOrigins, CitationCallbackResourceOrigin.guards.Canonical),
        (origin) =>
          [
            origin.reference._tag === "Mention"
              ? `Mention:${origin.reference.mentionId}`
              : `Detached:${origin.reference.detachedId}`,
            origin.missingPageIdentityHash,
          ] as const
      )
    );
    const mentions = HashMap.fromIterable(A.map(state.mentions, (mention) => [mention.id, mention.citation] as const));
    const detached = HashMap.fromIterable(
      A.map(state.detachedCitations, (object) => [object.id, object.citation] as const)
    );
    const sharedWork = yield* Effect.serviceOption(CitationResolutionWork);
    if (O.isSome(sharedWork) && sharedWork.value.maximum !== state.limits.resolutionIterations)
      return yield* CitationCallbackFailure.make({ reason: "invalid-input" });
    let work = 0;
    const localStep = Effect.suspend(() =>
      work++ >= state.limits.resolutionIterations
        ? Effect.fail(CitationResourceObjectFailure.make({ reason: "limit-exceeded" }))
        : Effect.void
    );
    const step = O.isSome(sharedWork)
      ? sharedWork.value.step.pipe(
          Effect.mapError(() => CitationResourceObjectFailure.make({ reason: "limit-exceeded" }))
        )
      : localStep;
    const models = CitationResourceModels.of({
      step,
      read: Effect.fn("Citation.sealedCanonicalModel")(function* (reference: CitationGroupMember) {
        const citation = yield* Effect.fromOption(
          reference._tag === "Mention"
            ? HashMap.get(mentions, reference.mentionId)
            : HashMap.get(detached, reference.detachedId),
          modelFailed
        );
        if (!S.is(FullCitation)(citation)) return yield* modelFailed();
        const key =
          reference._tag === "Mention" ? `Mention:${reference.mentionId}` : `Detached:${reference.detachedId}`;
        return CitationResourceModelInput.make({
          citation,
          missingPageIdentityHash: O.flatten(HashMap.get(identityHashes, key)),
        });
      }),
    });
    const objects = yield* makeCitationResourceObjects(state.limits).pipe(
      Effect.provideService(CitationResourceModels, models),
      Effect.provideService(CitationFrozenEditions, editions),
      Effect.mapError(mapped)
    );
    const scopeText = yield* S.encodeEffect(Scope)([
      "citation-canonical-resource-descriptor/v1",
      "eyecite/2.7.6",
      "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e",
    ]).pipe(Effect.mapError(failed));
    const scope = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(scopeText)).pipe(
      Effect.mapError(failed)
    );
    let cache = HashMap.empty<string, CitationResourceIdentity>();
    return CitationSessionResourceDescriptors.of({
      describe: Effect.fn("Citation.describeRegisteredSessionResource")(
        function* (resource: CitationCallbackResource) {
          if (resource._tag === "Hashable") return resource.identity;
          if (resource._tag !== "Registered") return yield* failed();
          const id = `${resource.scope}:${resource.slot}` as const;
          const origin = yield* Effect.fromOption(HashMap.get(origins, id), failed);
          if (origin._tag === "Host") {
            if (O.isNone(host)) return yield* failed();
            return yield* host.value.describe(resource).pipe(Effect.mapError(failed));
          }
          const found = HashMap.get(cache, id);
          if (O.isSome(found)) return found.value;
          const object = yield* objects.create(origin.reference).pipe(Effect.mapError(mapped));
          const hash = (yield* objects.key(object).pipe(Effect.mapError(mapped))).hash;
          const text = yield* S.encodeEffect(Key)(["eyecite-resource-current-hash/v1", hash]).pipe(
            Effect.mapError(failed)
          );
          const key = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(text)).pipe(
            Effect.mapError(failed)
          );
          const identity = CitationResourceIdentity.cases.External.make({ scope, key });
          cache = HashMap.set(cache, id, identity);
          return identity;
        },
        Effect.provideService(Crypto.Crypto, crypto)
      ),
    });
  }
);
