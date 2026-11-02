/**
 * Registered default dispatch and issued document projection in one operation.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import {
  CitationCallbackRuntimeIndexFactory,
  makeCitationCallbackRuntimeIndexFactory,
} from "./CallbackRuntimeIndex.ts";
import { CitationCallbackFailure, CitationResolutionWork, makeCitationResolutionWork } from "./CallbackSession.ts";
import { runPreparedDefaultCitationCallbackSession } from "./DefaultCallbacks.ts";
import { CitationFrozenEditions } from "./FrozenEditions.ts";
import { prepareCitationResolution } from "./ResolutionInput.ts";
import { makeCitationRegisteredSessionDescriptors } from "./SessionDescriptors.ts";
import { CitationSessionResourceDescriptors, makeCitationSessionDocumentProjector } from "./SessionDocument.ts";

/**
 * Capture trusted editions, Crypto and optional operation identity/host adapters.
 * Every resolve allocates fresh callback state, verifies input, executes default
 * dispatch and produces the receipt plus exact bindings. Returned methods have
 * R = never. Missing native identities remain explicit failures; extraction and
 * the public engine Layer are separate integration work.
 * @internal
 * @category operations
 * @since 0.0.0
 */
export const makeCitationRegisteredResolver = Effect.fn("Citation.makeRegisteredResolver")(function* () {
  const crypto = yield* Digest.Digest;
  const editions = yield* CitationFrozenEditions;
  const factory = yield* makeCitationCallbackRuntimeIndexFactory();
  return {
    resolve: Effect.fn("Citation.resolveRegistered")(
      function* (input: unknown) {
        const prepared = yield* prepareCitationResolution(input).pipe(
          Effect.mapError((error) => CitationCallbackFailure.make({ reason: error.reason }))
        );
        const work = yield* makeCitationResolutionWork(prepared.limits);
        const session = yield* runPreparedDefaultCitationCallbackSession(prepared).pipe(
          Effect.provideService(CitationCallbackRuntimeIndexFactory, factory),
          Effect.provideService(CitationResolutionWork, work)
        );
        const descriptors = yield* makeCitationRegisteredSessionDescriptors(session).pipe(
          Effect.provideService(CitationResolutionWork, work)
        );
        const projector = yield* makeCitationSessionDocumentProjector().pipe(
          Effect.provideService(CitationSessionResourceDescriptors, descriptors)
        );
        return yield* projector.project(session);
      },
      Effect.provideService(Digest.Digest, crypto),
      Effect.provideService(CitationFrozenEditions, editions)
    ),
  };
});
