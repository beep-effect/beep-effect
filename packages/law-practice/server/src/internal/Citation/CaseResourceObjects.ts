/**
 * Live case-resource objects adapted from eyecite 2.7.6 Resource semantics.
 * Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationGroupMember } from "@beep/law-practice-domain/values";
import { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import { makeCitationCaseResourceHash } from "./CaseResourceHash.ts";
import {
  CitationRuntimeDictionaryComparison,
  CitationRuntimeDictionaryFailure,
  CitationRuntimeDictionaryKey,
} from "./RuntimeDictionary.ts";
import type { CitationCaseResourceHashInput } from "./CaseResourceHash.ts";

const $I = $LawPracticeServerId.create("internal/Citation/CaseResourceObjects");
/**
 * Operation-owned resource capability; its numeric slot alone does not grant ownership.
 * @internal
 * @category models
 * @since 0.0.0
 */
export class CitationCaseResourceObject extends S.Opaque<
  CitationCaseResourceObject,
  { readonly brand: unique symbol }
>()(
  S.Struct({ slot: S.Natural }).pipe(
    $I.annoteSchema("CitationCaseResourceObject", {
      description: "Owned live resource handle distinct from its citation and dictionary insertion entries.",
    })
  )
) {}
const Reason = LiteralKit([
  "invalid-input",
  "unknown-object",
  "closed",
  "limit-exceeded",
  "model-failed",
  "missing-page",
  "missing-reporter",
  "missing-edition",
  "identity-unavailable",
  "digest-failed",
]);
/**
 * Redacted resource lifecycle, model or hash failure.
 * @internal
 * @category errors
 * @since 0.0.0
 */
export class CitationCaseResourceObjectFailure extends S.TaggedError<
  CitationCaseResourceObjectFailure,
  { readonly brand: unique symbol }
>($I`CitationCaseResourceObjectFailure`)(
  "CitationCaseResourceObjectFailure",
  { reason: Reason },
  $I.annoteError<CitationCaseResourceObjectFailure>("CitationCaseResourceObjectFailure", {
    description: "Closed resource-object failure without semantic input or nested causes.",
  })
) {}
/**
 * Captured semantic owner and trusted artifact/identity adapter. Read must return
 * current fields. Missing-page identity values remain explicit adapter inputs.
 * @internal
 * @category services
 * @since 0.0.0
 */
export class CitationCaseResourceModels extends Context.Service<
  CitationCaseResourceModels,
  {
    readonly read: (
      reference: CitationGroupMember
    ) => Effect.Effect<CitationCaseResourceHashInput, CitationCaseResourceObjectFailure>;
    readonly step: Effect.Effect<void, CitationCaseResourceObjectFailure>;
  }
>()($I`CitationCaseResourceModels`) {}
/**
 * Fresh object allocation and live hash/equality, ready for the general-key table.
 * All operations capture their environment. Closing revokes retained handles.
 * @internal
 * @category services
 * @since 0.0.0
 */
export class CitationCaseResourceObjects extends Context.Service<
  CitationCaseResourceObjects,
  {
    readonly create: (
      reference: CitationGroupMember
    ) => Effect.Effect<CitationCaseResourceObject, CitationCaseResourceObjectFailure>;
    readonly key: (
      resource: CitationCaseResourceObject
    ) => Effect.Effect<CitationRuntimeDictionaryKey, CitationCaseResourceObjectFailure>;
    readonly referenceOf: (
      resource: CitationCaseResourceObject
    ) => Effect.Effect<CitationGroupMember, CitationCaseResourceObjectFailure>;
    readonly comparison: Context.Service.Shape<typeof CitationRuntimeDictionaryComparison>;
    readonly close: Effect.Effect<void>;
  }
>()($I`CitationCaseResourceObjects`) {}
const failure = (reason: typeof Reason.Type) => CitationCaseResourceObjectFailure.make({ reason });
const ReferenceJson = S.fromJsonString(CitationGroupMember);
const referenceSnapshot = Effect.fn("Citation.caseResourceReference")(
  function* (reference: CitationGroupMember) {
    return yield* S.decodeEffect(ReferenceJson)(yield* S.encodeEffect(ReferenceJson)(reference));
  },
  Effect.mapError(() => failure("invalid-input"))
);
/**
 * Allocate one bounded registry per operation. Each create call makes a new
 * resource even for the same citation. Rehash reads the current semantic owner;
 * no citation fields or content hashes are retained here. The table owns stored
 * insertion hashes and performs pointer checks before invoking comparison.
 * This registry covers case resources only, not arbitrary host keys.
 * @internal
 * @category operations
 * @since 0.0.0
 */
export const makeCitationCaseResourceObjects = Effect.fn("Citation.makeCaseResourceObjects")(function* (
  input: unknown
) {
  const limits = yield* S.decodeUnknownEffect(S.toType(CitationEngineLimits))(input).pipe(
    Effect.mapError(() => failure("invalid-input"))
  );
  const maximum = limits.resolutionIterations;
  const models = yield* CitationCaseResourceModels;
  const crypto = yield* Crypto.Crypto;
  const mutex = yield* Semaphore.make(1);
  const handles = new WeakMap<object, number>();
  let references = HashMap.empty<number, CitationGroupMember>();
  let next = 0;
  let closed = false;
  const alive = Effect.suspend(() => (closed ? Effect.fail(failure("closed")) : Effect.void));
  const byId = Effect.fn("Citation.caseResourceById")(function* (id: number) {
    yield* alive;
    return yield* Effect.fromOption(HashMap.get(references, id), () => failure("unknown-object"));
  });
  const ownedId = Effect.fn("Citation.caseResourceOwnedId")(function* (resource: CitationCaseResourceObject) {
    yield* alive;
    yield* S.decodeEffect(S.toType(CitationCaseResourceObject))(resource).pipe(
      Effect.mapError(() => failure("invalid-input"))
    );
    return yield* Effect.fromOption(O.fromUndefinedOr(handles.get(resource)), () => failure("unknown-object"));
  });
  const hash = Effect.fn("Citation.caseResourceLiveHash")(function* (id: number) {
    const reference = yield* referenceSnapshot(yield* byId(id));
    yield* models.step;
    const current = yield* models.read(reference).pipe(Effect.mapError(() => failure("model-failed")));
    const result = yield* makeCitationCaseResourceHash(current).pipe(
      Effect.provideService(Crypto.Crypto, crypto),
      Effect.mapError((error) => failure(error.reason))
    );
    return result.resourceHash;
  });
  const tableError = (error: CitationCaseResourceObjectFailure) =>
    CitationRuntimeDictionaryFailure.make({
      reason: error.reason === "limit-exceeded" ? "limit-exceeded" : "comparison-failed",
    });
  const comparison = CitationRuntimeDictionaryComparison.of({
    equal: Effect.fn("Citation.caseResourceEqual")((left: number, right: number) =>
      mutex
        .withPermit(
          Effect.gen(function* () {
            const leftHash = yield* hash(left);
            const rightHash = yield* hash(right);
            return leftHash === rightHash;
          })
        )
        .pipe(Effect.mapError(tableError))
    ),
    step: alive.pipe(Effect.andThen(models.step), Effect.mapError(tableError)),
  });
  return CitationCaseResourceObjects.of({
    create: Effect.fn("Citation.caseResourceCreate")((reference: CitationGroupMember) =>
      mutex.withPermit(
        Effect.gen(function* () {
          yield* alive;
          yield* models.step;
          if (next >= maximum) return yield* failure("limit-exceeded");
          const snapshot = yield* referenceSnapshot(reference);
          const resource = CitationCaseResourceObject.make({ slot: next });
          references = HashMap.set(references, next, snapshot);
          handles.set(resource, next);
          next += 1;
          return resource;
        })
      )
    ),
    key: Effect.fn("Citation.caseResourceKey")((resource: CitationCaseResourceObject) =>
      mutex.withPermit(
        Effect.gen(function* () {
          const objectId = yield* ownedId(resource);
          return CitationRuntimeDictionaryKey.make({ objectId, hash: yield* hash(objectId) });
        })
      )
    ),
    referenceOf: Effect.fn("Citation.caseResourceReferenceOf")((resource: CitationCaseResourceObject) =>
      mutex.withPermit(
        Effect.gen(function* () {
          return yield* referenceSnapshot(yield* byId(yield* ownedId(resource)));
        })
      )
    ),
    comparison,
    close: mutex.withPermit(
      Effect.sync(() => {
        closed = true;
        references = HashMap.empty();
      })
    ),
  });
});
