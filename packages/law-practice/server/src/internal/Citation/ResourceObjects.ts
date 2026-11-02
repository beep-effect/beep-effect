/**
 * Live full-citation resource objects adapted from eyecite 2.7.6 Resource semantics.
 * Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationComponents, CitationGroupMember, FullCitation } from "@beep/law-practice-domain/values";
import { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as Context from "effect/Context";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import { CitationAuthorityEdition } from "./AuthorityIdentity.ts";
import { CitationCaseResourceHashInput, makeCitationCaseResourceHash } from "./CaseResourceHash.ts";
import { CitationFrozenEditions } from "./FrozenEditions.ts";
import {
  CitationPublicationResourceHashInput,
  makeCitationPublicationResourceHash,
} from "./PublicationResourceHash.ts";
import {
  CitationRuntimeDictionaryComparison,
  CitationRuntimeDictionaryFailure,
  CitationRuntimeDictionaryKey,
} from "./RuntimeDictionary.ts";

const $I = $LawPracticeServerId.create("internal/Citation/ResourceObjects");
/**
 * Current full citation plus an explicit null-page identity supplied by the semantic owner.
 * @internal
 * @category models
 * @since 0.0.0
 */
export class CitationResourceModelInput extends S.Opaque<
  CitationResourceModelInput,
  { readonly brand: unique symbol }
>()(
  S.Struct({ citation: FullCitation, missingPageIdentityHash: S.OptionFromNullOr(S.BigIntFromString) }).pipe(
    $I.annoteSchema("CitationResourceModelInput", {
      description: "Live semantic owner snapshot; edition payloads come from the captured frozen adapter.",
    })
  )
) {}

/**
 * Operation-owned resource capability; its numeric slot alone does not grant ownership.
 * @internal
 * @category models
 * @since 0.0.0
 */
export class CitationResourceObject extends S.Opaque<CitationResourceObject, { readonly brand: unique symbol }>()(
  S.Struct({ slot: S.Natural }).pipe(
    $I.annoteSchema("CitationResourceObject", {
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
  "artifact-failed",
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
export class CitationResourceObjectFailure extends S.TaggedError<
  CitationResourceObjectFailure,
  { readonly brand: unique symbol }
>($I`CitationResourceObjectFailure`)(
  "CitationResourceObjectFailure",
  { reason: Reason },
  $I.annoteError<CitationResourceObjectFailure>("CitationResourceObjectFailure", {
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
export class CitationResourceModels extends Context.Service<
  CitationResourceModels,
  {
    readonly read: (
      reference: CitationGroupMember
    ) => Effect.Effect<CitationResourceModelInput, CitationResourceObjectFailure>;
    readonly step: Effect.Effect<void, CitationResourceObjectFailure>;
  }
>()($I`CitationResourceModels`) {}
/**
 * Fresh object allocation and live hash/equality, ready for the general-key table.
 * All operations capture their environment. Closing revokes retained handles.
 * @internal
 * @category services
 * @since 0.0.0
 */
export class CitationResourceObjects extends Context.Service<
  CitationResourceObjects,
  {
    readonly create: (
      reference: CitationGroupMember
    ) => Effect.Effect<CitationResourceObject, CitationResourceObjectFailure>;
    readonly key: (
      resource: CitationResourceObject
    ) => Effect.Effect<CitationRuntimeDictionaryKey, CitationResourceObjectFailure>;
    readonly referenceOf: (
      resource: CitationResourceObject
    ) => Effect.Effect<CitationGroupMember, CitationResourceObjectFailure>;
    readonly comparison: Context.Service.Shape<typeof CitationRuntimeDictionaryComparison>;
    readonly close: Effect.Effect<void>;
  }
>()($I`CitationResourceObjects`) {}
const failure = (reason: typeof Reason.Type) => CitationResourceObjectFailure.make({ reason });
const ReferenceJson = S.fromJsonString(CitationGroupMember);
const referenceSnapshot = Effect.fn("Citation.resourceReference")(
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
 * This registry covers case/law/journal resources, not arbitrary host keys.
 * @internal
 * @category operations
 * @since 0.0.0
 */
export const makeCitationResourceObjects = Effect.fn("Citation.makeResourceObjects")(function* (input: unknown) {
  const limits = yield* S.decodeUnknownEffect(S.toType(CitationEngineLimits))(input).pipe(
    Effect.mapError(() => failure("invalid-input"))
  );
  const maximum = limits.resolutionIterations;
  const models = yield* CitationResourceModels;
  const crypto = yield* Digest.Digest;
  const editions = yield* CitationFrozenEditions;
  const mutex = yield* Semaphore.make(1);
  const handles = new WeakMap<object, number>();
  let references = HashMap.empty<number, CitationGroupMember>();
  let next = 0;
  let closed = false;
  const alive = Effect.suspend(() => (closed ? Effect.fail(failure("closed")) : Effect.void));
  const byId = Effect.fn("Citation.resourceById")(function* (id: number) {
    yield* alive;
    return yield* Effect.fromOption(HashMap.get(references, id), () => failure("unknown-object"));
  });
  const ownedId = Effect.fn("Citation.resourceOwnedId")(function* (resource: CitationResourceObject) {
    yield* alive;
    yield* S.decodeEffect(S.toType(CitationResourceObject))(resource).pipe(
      Effect.mapError(() => failure("invalid-input"))
    );
    return yield* Effect.fromOption(O.fromUndefinedOr(handles.get(resource)), () => failure("unknown-object"));
  });
  const hash = Effect.fn("Citation.resourceLiveHash")(function* (id: number) {
    const reference = yield* referenceSnapshot(yield* byId(id));
    yield* models.step;
    const value = yield* models.read(reference).pipe(Effect.mapError(() => failure("model-failed")));
    const codec = S.fromJsonString(CitationResourceModelInput);
    const current = yield* S.decodeEffect(codec)(
      yield* S.encodeEffect(codec)(value).pipe(Effect.mapError(() => failure("invalid-input")))
    ).pipe(Effect.mapError(() => failure("invalid-input")));
    const citation = current.citation;
    if (citation.type === "case") {
      // Explicit null pages must not evaluate reporter/edition lookup.
      const groups = yield* S.encodeEffect(CitationComponents)(citation.components).pipe(
        Effect.mapError(() => failure("invalid-input"))
      );
      const page = R.get(groups, "page");
      if (O.isNone(page)) return yield* failure("missing-page");
      const nullPage = page.value === null;
      const selected = nullPage ? O.none() : citation.publication.selectedEdition;
      const edition = O.isSome(selected)
        ? O.some(yield* editions.lookup(selected.value, "case").pipe(Effect.mapError(() => failure("artifact-failed"))))
        : O.none();
      const result = yield* makeCitationCaseResourceHash(
        CitationCaseResourceHashInput.make({
          citation,
          selectedEdition: O.map(edition, (edition) =>
            CitationAuthorityEdition.make({ edition: edition.edition, shortName: edition.value.short_name })
          ),
          missingPageIdentityHash: current.missingPageIdentityHash,
        })
      ).pipe(
        Effect.provideService(Digest.Digest, crypto),
        Effect.mapError((error) => failure(error.reason))
      );
      return result.resourceHash;
    }
    const resolved = yield* editions
      .lookupMany(citation.publication.editions, citation.type)
      .pipe(Effect.mapError(() => failure("artifact-failed")));
    const result = yield* makeCitationPublicationResourceHash(
      CitationPublicationResourceHashInput.make({ citation, editions: resolved })
    ).pipe(
      Effect.provideService(Digest.Digest, crypto),
      Effect.mapError((error) => failure(error.reason))
    );
    return result.resourceHash;
  });
  const tableError = (error: CitationResourceObjectFailure) =>
    CitationRuntimeDictionaryFailure.make({
      reason: error.reason === "limit-exceeded" ? "limit-exceeded" : "comparison-failed",
    });
  const comparison = CitationRuntimeDictionaryComparison.of({
    equal: Effect.fn("Citation.resourceEqual")((left: number, right: number) =>
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
  return CitationResourceObjects.of({
    create: Effect.fn("Citation.resourceCreate")((reference: CitationGroupMember) =>
      mutex.withPermit(
        Effect.gen(function* () {
          yield* alive;
          yield* models.step;
          if (next >= maximum) return yield* failure("limit-exceeded");
          const snapshot = yield* referenceSnapshot(reference);
          const resource = CitationResourceObject.make({ slot: next });
          references = HashMap.set(references, next, snapshot);
          handles.set(resource, next);
          next += 1;
          return resource;
        })
      )
    ),
    key: Effect.fn("Citation.resourceKey")((resource: CitationResourceObject) =>
      mutex.withPermit(
        Effect.gen(function* () {
          const objectId = yield* ownedId(resource);
          return CitationRuntimeDictionaryKey.make({ objectId, hash: yield* hash(objectId) });
        })
      )
    ),
    referenceOf: Effect.fn("Citation.resourceReferenceOf")((resource: CitationResourceObject) =>
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
