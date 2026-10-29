/**
 * Ordered callback session adapted from eyecite 2.7.6 resolve.py.
 * Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  Citation,
  CitationDetached,
  CitationDetachedId,
  CitationGroupMember,
  CitationMention,
  FullCitation,
} from "@beep/law-practice-domain/values";
import { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import { SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { LiteralKit, Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as Tuple from "effect/Tuple";
import { PreparedCitationResolution, prepareCitationResolution } from "./ResolutionInput.ts";
import { CitationResourceIdentity, makeCitationResourceAuthorityId } from "./ResourceIdentity.ts";
import type { CitationMentionId } from "@beep/law-practice-domain/values";

const $I = $LawPracticeServerId.create("internal/Citation/CallbackSession");
/**
 * Normalized adapter resource. Identity, truthiness and presentation are
 * independent. Unhashable falsy values may remain in prior-full state until
 * an operation actually attempts to hash them, as in the source.
 * @internal
 * @category models
 * @since 0.0.0
 */
export const CitationCallbackResource = S.TaggedUnion({
  None: {},
  Hashable: { identity: CitationResourceIdentity, truthy: S.Boolean, value: S.Json },
  Unhashable: { truthy: S.Boolean, value: S.Json },
}).pipe(
  $I.annoteSchema("CitationCallbackResource", {
    description:
      "Private adapter resource with explicit hashing and truth semantics; presentation is not an equality key.",
  })
);
/**
 * Schema-derived normalized resource.
 * @internal
 * @category models
 * @since 0.0.0
 */
export type CitationCallbackResource = typeof CitationCallbackResource.Type;
/**
 * Prior-full context references either a verified occurrence or a detached semantic object.
 * @internal
 * @category models
 * @since 0.0.0
 */
export const CitationCallbackFull = S.Struct({
  citation: CitationGroupMember,
  resource: CitationCallbackResource,
}).pipe(
  $I.annoteSchema("CitationCallbackFull", {
    description:
      "Private semantic object/resource pair with explicit mention-versus-detached reference and falsy resource values.",
  })
);
/**
 * Schema-derived prior-full entry.
 * @internal
 * @category models
 * @since 0.0.0
 */
export type CitationCallbackFull = typeof CitationCallbackFull.Type;
/**
 * Callback-visible resource groups before final document projection.
 * Empty groups and explicit mutation are retained at this private stage.
 * @internal
 * @category models
 * @since 0.0.0
 */
export const CitationCallbackGroup = S.Struct({
  resource: CitationCallbackResource,
  members: S.Array(CitationGroupMember),
  listSlot: S.Natural,
}).pipe(
  $I.annoteSchema("CitationCallbackGroup", {
    description:
      "Private dictionary snapshot preserving first key presentation, member order and operation-local list identity.",
  })
);
/**
 * Schema-derived callback group.
 * @internal
 * @category models
 * @since 0.0.0
 */
export type CitationCallbackGroup = typeof CitationCallbackGroup.Type;
/**
 * Prior-full callback input; mutations return through the transition protocol.
 * @internal
 * @category models
 * @since 0.0.0
 */
export const CitationFullsCallbackInput = S.Struct({
  mention: CitationMention,
  fulls: S.Array(CitationCallbackFull),
}).pipe(
  $I.annoteSchema("CitationFullsCallbackInput", {
    description: "Current genuine mention and ordered prior-full state supplied to a captured callback.",
  })
);
/**
 * Schema-derived callback input.
 * @internal
 * @category models
 * @since 0.0.0
 */
export type CitationFullsCallbackInput = typeof CitationFullsCallbackInput.Type;
/**
 * Explicit replacement of the shared prior-full list and callback result.
 * @internal
 * @category models
 * @since 0.0.0
 */
export const CitationFullsCallbackOutput = S.Struct({
  resource: CitationCallbackResource,
  fulls: S.Array(CitationCallbackFull),
}).pipe(
  $I.annoteSchema("CitationFullsCallbackOutput", {
    description: "Callback result and replacement shared list, applied before the next dispatch.",
  })
);
/**
 * Schema-derived callback transition.
 * @internal
 * @category models
 * @since 0.0.0
 */
export type CitationFullsCallbackOutput = typeof CitationFullsCallbackOutput.Type;
/**
 * Id. callbacks see the actual last result and dictionary before append.
 * @internal
 * @category models
 * @since 0.0.0
 */
export const CitationIdCallbackInput = S.Struct({
  mention: CitationMention,
  last: CitationCallbackResource,
  groups: S.Array(CitationCallbackGroup),
}).pipe(
  $I.annoteSchema("CitationIdCallbackInput", {
    description: "Current Id. occurrence, actual prior result including falsy values, and pre-append resource groups.",
  })
);
/**
 * Schema-derived Id. callback input.
 * @internal
 * @category models
 * @since 0.0.0
 */
export type CitationIdCallbackInput = typeof CitationIdCallbackInput.Type;
/**
 * Id. callback result; mutations use the operation-owned dictionary service.
 * @internal
 * @category models
 * @since 0.0.0
 */
export const CitationIdCallbackOutput = S.Struct({
  resource: CitationCallbackResource,
}).pipe(
  $I.annoteSchema("CitationIdCallbackOutput", {
    description: "Current Id. result; dictionary mutation uses the captured operation-owned service.",
  })
);
/**
 * Schema-derived Id. transition.
 * @internal
 * @category models
 * @since 0.0.0
 */
export type CitationIdCallbackOutput = typeof CitationIdCallbackOutput.Type;
const Reason = LiteralKit([
  "invalid-input",
  "evidence-failed",
  "limit-exceeded",
  "callback-failed",
  "identity-failed",
  "unhashable-resource",
]).pipe(
  $I.annoteSchema("Reason", { description: "Finite private callback-session failure reasons without caller values." })
);
/**
 * Private redacted callback/session failure.
 * @internal
 * @category errors
 * @since 0.0.0
 */
export class CitationCallbackFailure extends S.TaggedError<CitationCallbackFailure, { readonly brand: unique symbol }>(
  $I`CitationCallbackFailure`
)(
  "CitationCallbackFailure",
  { reason: Reason },
  $I.annoteError<CitationCallbackFailure>("CitationCallbackFailure", {
    description: "Callback resolution failed without resource presentation, source text or nested causes.",
  })
) {}
/**
 * Per-operation work accounting shared by dispatch and captured defaults.
 * @internal
 * @category services
 * @since 0.0.0
 */
export class CitationResolutionWork extends Context.Service<
  CitationResolutionWork,
  {
    readonly maximum: CitationEngineLimits["resolutionIterations"];
    readonly step: Effect.Effect<void, CitationCallbackFailure>;
  }
>()($I`CitationResolutionWork`) {}
/**
 * Allocate fresh work state. Never reuse it across resolution operations.
 * @internal
 * @category operations
 * @since 0.0.0
 */
export const makeCitationResolutionWork = Effect.fn("Citation.makeResolutionWork")(function* (input: unknown) {
  const limits = yield* S.decodeUnknownEffect(S.toType(CitationEngineLimits))(input).pipe(
    Effect.mapError(() => CitationCallbackFailure.make({ reason: "invalid-input" }))
  );
  const maximum = limits.resolutionIterations;
  let iterations = 0;
  return CitationResolutionWork.of({
    maximum,
    step: Effect.suspend(() => {
      if (iterations >= maximum) return Effect.fail(CitationCallbackFailure.make({ reason: "limit-exceeded" }));
      iterations += 1;
      return Effect.void;
    }),
  });
});
/**
 * Captured private callbacks; callable behavior is a service, never request
 * data. Every callback captures its dependencies and returns R = never.
 * Prior-full transitions remain explicit. The captured dictionary service
 * preserves known-input list aliases and retained dictionary mutation.
 * Detached semantic objects use closed references without source capabilities.
 * General host/model mutation and public ports stay open.
 * @internal
 * @category services
 * @since 0.0.0
 */
export class CitationResolutionCallbacks extends Context.Service<
  CitationResolutionCallbacks,
  {
    readonly full: (mention: CitationMention) => Effect.Effect<CitationCallbackResource, CitationCallbackFailure>;
    readonly shortCase: (
      input: CitationFullsCallbackInput
    ) => Effect.Effect<CitationFullsCallbackOutput, CitationCallbackFailure>;
    readonly supra: (
      input: CitationFullsCallbackInput
    ) => Effect.Effect<CitationFullsCallbackOutput, CitationCallbackFailure>;
    readonly reference: (
      input: CitationFullsCallbackInput
    ) => Effect.Effect<CitationFullsCallbackOutput, CitationCallbackFailure>;
    readonly id: (input: CitationIdCallbackInput) => Effect.Effect<CitationIdCallbackOutput, CitationCallbackFailure>;
  }
>()($I`CitationResolutionCallbacks`) {}
const SessionState = S.Struct({
  ...PreparedCitationResolution.fields,
  fulls: S.Array(CitationCallbackFull),
  groups: S.Array(CitationCallbackGroup),
  last: CitationCallbackResource,
  detachedCitations: S.Array(CitationDetached),
}).pipe(
  $I.annoteSchema("SessionState", {
    description: "Private post-dispatch state; not a final document or grouping correctness proof.",
  })
);
const ResourceJson = S.fromJsonString(CitationCallbackResource);
const FullsJson = S.fromJsonString(CitationFullsCallbackOutput);
const IdJson = S.fromJsonString(CitationIdCallbackOutput);
const isFull = S.is(FullCitation);
const invalid = () => CitationCallbackFailure.make({ reason: "invalid-input" });
const callbackFailed = (error: CitationCallbackFailure) => CitationCallbackFailure.make({ reason: error.reason });
const limit = () => CitationCallbackFailure.make({ reason: "limit-exceeded" });

/**
 * Operation-owned list handle. Structural decoding cannot register a handle in
 * the dictionary owner's private capability table.
 * @internal
 * @category models
 * @since 0.0.0
 */
export class CitationCallbackList extends S.Opaque<CitationCallbackList, { readonly brand: unique symbol }>()(
  S.Struct({ slot: S.Natural }).pipe(
    $I.annoteSchema("CitationCallbackList", {
      description: "Private list handle; only its issuing dictionary accepts it.",
    })
  )
) {}
/**
 * Stable per-operation dictionary service. Callbacks may retain this instance
 * and list handles; snapshots remain ordinary schema data. Every method is
 * captured with R = never. No service or function enters an engine request.
 * @internal
 * @category services
 * @since 0.0.0
 */
export class CitationCallbackDictionary extends Context.Service<
  CitationCallbackDictionary,
  {
    readonly registerDetached: (citation: Citation) => Effect.Effect<CitationGroupMember, CitationCallbackFailure>;
    readonly citationOf: (reference: CitationGroupMember) => Effect.Effect<Citation, CitationCallbackFailure>;
    readonly detachedCitations: Effect.Effect<ReadonlyArray<CitationDetached>, CitationCallbackFailure>;
    readonly owner: PreparedCitationResolution;
    readonly work: Context.Service.Shape<typeof CitationResolutionWork>;
    readonly start: Effect.Effect<void, CitationCallbackFailure>;
    readonly close: Effect.Effect<void>;
    readonly read: Effect.Effect<ReadonlyArray<CitationCallbackGroup>, CitationCallbackFailure>;
    readonly clear: Effect.Effect<void, CitationCallbackFailure>;
    readonly get: (resource: CitationCallbackResource) => Effect.Effect<CitationCallbackList, CitationCallbackFailure>;
    readonly allocate: (
      members: ReadonlyArray<CitationGroupMember>
    ) => Effect.Effect<CitationCallbackList, CitationCallbackFailure>;
    readonly write: (
      list: CitationCallbackList,
      members: ReadonlyArray<CitationGroupMember>
    ) => Effect.Effect<void, CitationCallbackFailure>;
    readonly set: (
      resource: CitationCallbackResource,
      list: CitationCallbackList
    ) => Effect.Effect<void, CitationCallbackFailure>;
    readonly remove: (
      resource: CitationCallbackResource
    ) => Effect.Effect<O.Option<CitationCallbackList>, CitationCallbackFailure>;
    readonly appendCurrent: (
      resource: CitationCallbackResource,
      id: CitationMentionId
    ) => Effect.Effect<void, CitationCallbackFailure>;
  }
>()($I`CitationCallbackDictionary`) {}
const DictionaryEntry = S.Struct({ key: S.String, resource: CitationCallbackResource, slot: S.Natural }).pipe(
  $I.annoteSchema("DictionaryEntry", { description: "Private ordered key entry referencing an owned list node." })
);
const MembersJson = CitationGroupMember.pipe(S.Array, S.fromJsonString);
const CitationJson = S.fromJsonString(Citation);
const DetachedJson = CitationDetached.pipe(S.Array, S.fromJsonString);
const DetachedKey = S.fromJsonString(
  S.Tuple([S.tag("citation-detached/v1"), SourceTextIdentity, Sha256Hex, S.Natural])
).pipe(
  $I.annoteSchema("DetachedKey", {
    description:
      "Document-local object slot namespace, distinct from occurrence/evidence identity; not a content-equality digest.",
  })
);
const DetachedScope = S.Struct({ source: SourceTextIdentity, engineArtifact: Sha256Hex }).pipe(
  $I.annoteSchema("DetachedScope", {
    description:
      "Captured document identity scope for operation-local semantic object slots; no source evidence is issued.",
  })
);
const DetachedScopeJson = S.fromJsonString(DetachedScope);
const encoder = new TextEncoder();

/**
 * Allocate a fresh stable dictionary and owned list capability registry. Clear
 * removes keys, retaining list nodes for callbacks that still hold handles.
 * A completed/failed session closes the owner; later operations reject reuse.
 * @internal
 * @category operations
 * @since 0.0.0
 */
export const makeCitationCallbackDictionary = Effect.fn("Citation.makeCallbackDictionary")(function* (
  prepared: PreparedCitationResolution
) {
  const limitsCodec = S.fromJsonString(CitationEngineLimits);
  const limits = yield* S.decodeEffect(limitsCodec)(
    yield* S.encodeEffect(limitsCodec)(prepared.limits).pipe(Effect.mapError(invalid))
  ).pipe(Effect.mapError(invalid));
  const scope = yield* S.decodeEffect(DetachedScopeJson)(
    yield* S.encodeEffect(DetachedScopeJson)({ source: prepared.source, engineArtifact: prepared.engineArtifact }).pipe(
      Effect.mapError(invalid)
    )
  ).pipe(Effect.mapError(invalid));
  const crypto = yield* Crypto.Crypto;
  const work = yield* CitationResolutionWork;
  if (work.maximum !== limits.resolutionIterations) return yield* invalid();
  const known = HashMap.fromIterable(A.map(prepared.mentions, (mention) => Tuple.make(mention.id, mention.citation)));
  let detached = HashMap.empty<CitationDetachedId, CitationDetached>();
  const detachedObjects = new WeakMap<object, CitationDetachedId>();
  let detachedOrder = A.empty<CitationDetached>();
  let detachedSlot = 0;
  const handles = new WeakMap<object, number>();
  let bySlot = HashMap.empty<number, CitationCallbackList>();
  const mutex = yield* Semaphore.make(1);
  let entries = A.empty<typeof DictionaryEntry.Type>();
  let lists = HashMap.empty<number, ReadonlyArray<CitationGroupMember>>();
  let nextSlot = 0;
  let started = false;
  let closed = false;
  const alive = Effect.suspend(() => (closed || !started ? Effect.fail(invalid()) : Effect.void));
  const membersSnapshot = Effect.fn("Citation.dictionaryMembers")(function* (
    members: ReadonlyArray<CitationGroupMember>
  ) {
    if (A.length(members) > limits.resolutionEdges) return yield* limit();
    const snapshot = yield* S.decodeEffect(MembersJson)(
      yield* S.encodeEffect(MembersJson)(members).pipe(Effect.mapError(invalid))
    ).pipe(Effect.mapError(invalid));
    if (
      !A.every(snapshot, (reference) =>
        CitationGroupMember.match(reference, {
          Mention: (reference) => HashMap.has(known, reference.mentionId),
          Detached: (reference) => HashMap.has(detached, reference.detachedId),
        })
      )
    )
      return yield* invalid();
    return snapshot;
  });
  const slotOf = Effect.fn("Citation.dictionaryListSlot")(function* (handle: CitationCallbackList) {
    return yield* Effect.fromOption(O.fromUndefinedOr(handles.get(handle)), invalid);
  });
  const listOf = Effect.fn("Citation.dictionaryList")(function* (slot: number) {
    return yield* Effect.fromOption(HashMap.get(lists, slot), invalid);
  });
  const fingerprint = Effect.fn("Citation.dictionaryKey")(function* (input: CitationCallbackResource) {
    const resource = yield* S.decodeEffect(ResourceJson)(
      yield* S.encodeEffect(ResourceJson)(input).pipe(Effect.mapError(invalid))
    ).pipe(Effect.mapError(invalid));
    if (resource._tag === "Unhashable") return yield* CitationCallbackFailure.make({ reason: "unhashable-resource" });
    const key =
      resource._tag === "None"
        ? "none"
        : yield* makeCitationResourceAuthorityId(resource.identity).pipe(
            Effect.provideService(Crypto.Crypto, crypto),
            Effect.mapError(() => CitationCallbackFailure.make({ reason: "identity-failed" }))
          );
    return { key, resource };
  });
  const find = Effect.fn("Citation.dictionaryFind")(function* (key: string) {
    for (const entry of entries) {
      yield* work.step;
      if (entry.key === key) return O.some(entry);
    }
    return O.none<typeof DictionaryEntry.Type>();
  });
  const issue = (slot: number) => {
    const handle = CitationCallbackList.make({ slot });
    handles.set(handle, slot);
    bySlot = HashMap.set(bySlot, slot, handle);
    return handle;
  };
  const allocate = Effect.fn("Citation.dictionaryAllocate")(function* (members: ReadonlyArray<CitationGroupMember>) {
    const snapshot = yield* membersSnapshot(members);
    // Retained detached lists consume the same bounded edge/node budget.
    if (
      nextSlot >= limits.resolutionIterations ||
      A.reduce(
        lists.pipe(HashMap.values, A.fromIterable),
        A.length(snapshot),
        (count, list) => count + A.length(list)
      ) > limits.resolutionEdges
    )
      return yield* limit();
    const slot = nextSlot;
    nextSlot += 1;
    lists = HashMap.set(lists, slot, snapshot);
    return issue(slot);
  });
  const write = Effect.fn("Citation.dictionaryWrite")(function* (
    handle: CitationCallbackList,
    members: ReadonlyArray<CitationGroupMember>
  ) {
    const slot = yield* slotOf(handle);
    const snapshot = yield* membersSnapshot(members);
    if (
      A.reduce(
        lists.pipe(HashMap.entries, A.fromIterable),
        0,
        (count, [id, list]) => count + (id === slot ? A.length(snapshot) : A.length(list))
      ) > limits.resolutionEdges
    )
      return yield* limit();
    if (
      A.reduce(
        entries,
        0,
        (count, entry) =>
          count +
          (entry.slot === slot
            ? A.length(snapshot)
            : O.getOrElse(O.map(HashMap.get(lists, entry.slot), A.length), () => 0))
      ) > limits.resolutionEdges
    )
      return yield* limit();
    lists = HashMap.set(lists, slot, snapshot);
  });
  const get = Effect.fn("Citation.dictionaryGet")(function* (input: CitationCallbackResource) {
    const value = yield* fingerprint(input);
    const existing = yield* find(value.key);
    if (O.isSome(existing)) return yield* Effect.fromOption(HashMap.get(bySlot, existing.value.slot), invalid);
    if (A.length(entries) >= limits.authorities) return yield* limit();
    const handle = yield* allocate([]);
    entries = A.append(entries, { ...value, slot: yield* slotOf(handle) });
    return handle;
  });
  const set = Effect.fn("Citation.dictionarySet")(function* (
    input: CitationCallbackResource,
    handle: CitationCallbackList
  ) {
    const slot = yield* slotOf(handle);
    const value = yield* fingerprint(input);
    const existing = yield* find(value.key);
    if (O.isNone(existing) && A.length(entries) >= limits.authorities) return yield* limit();
    const updated = O.isNone(existing)
      ? A.append(entries, { ...value, slot })
      : A.map(entries, (entry) => (entry.key === value.key ? { ...entry, slot } : entry));
    if (
      A.reduce(
        updated,
        0,
        (count, entry) => count + O.getOrElse(O.map(HashMap.get(lists, entry.slot), A.length), () => 0)
      ) > limits.resolutionEdges
    )
      return yield* limit();
    entries = updated;
  });
  const citationOf = Effect.fn("Citation.callbackCitationOf")(function* (reference: CitationGroupMember) {
    yield* alive;
    const decoded = yield* S.decodeEffect(S.toType(CitationGroupMember))(reference).pipe(Effect.mapError(invalid));
    const citation = yield* Effect.fromOption(
      CitationGroupMember.match(decoded, {
        Mention: (reference) => HashMap.get(known, reference.mentionId),
        Detached: (reference) => O.map(HashMap.get(detached, reference.detachedId), (object) => object.citation),
      }),
      invalid
    );
    return yield* S.decodeEffect(CitationJson)(
      yield* S.encodeEffect(CitationJson)(citation).pipe(Effect.mapError(invalid))
    ).pipe(Effect.mapError(invalid));
  });
  const registerDetached = Effect.fn("Citation.registerDetached")(function* (input: Citation) {
    yield* alive;
    yield* work.step;
    const decoded = yield* S.decodeEffect(S.toType(Citation))(input).pipe(Effect.mapError(invalid));
    const existing = O.fromUndefinedOr(detachedObjects.get(input));
    if (O.isSome(existing)) return CitationGroupMember.cases.Detached.make({ detachedId: existing.value });
    if (HashMap.size(known) + detachedSlot >= limits.mentions) return yield* limit();
    const citation = yield* S.decodeEffect(CitationJson)(
      yield* S.encodeEffect(CitationJson)(decoded).pipe(Effect.mapError(invalid))
    ).pipe(Effect.mapError(invalid));
    const preimage = yield* S.encodeEffect(DetachedKey)([
      "citation-detached/v1",
      scope.source,
      scope.engineArtifact,
      detachedSlot,
    ]).pipe(Effect.mapError(invalid));
    const digest = yield* S.decodeEffect(Sha256HexFromBytes)(encoder.encode(preimage)).pipe(
      Effect.provideService(Crypto.Crypto, crypto),
      Effect.mapError(() => CitationCallbackFailure.make({ reason: "identity-failed" }))
    );
    const id = CitationDetachedId.make(`cd1:${digest}`);
    detachedSlot += 1;
    const object = CitationDetached.make({ id, citation });
    detached = HashMap.set(detached, id, object);
    detachedOrder = A.append(detachedOrder, object);
    const reference = CitationGroupMember.cases.Detached.make({ detachedId: id });
    detachedObjects.set(input, id);
    return reference;
  });
  const api = CitationCallbackDictionary.of({
    registerDetached,
    citationOf,
    detachedCitations: alive.pipe(
      Effect.andThen(
        Effect.suspend(() =>
          Effect.gen(function* () {
            const values = detachedOrder;
            return yield* S.decodeEffect(DetachedJson)(yield* S.encodeEffect(DetachedJson)(values));
          }).pipe(Effect.mapError(invalid))
        )
      )
    ),
    owner: prepared,
    work,
    start: Effect.suspend(() =>
      started || closed
        ? Effect.fail(invalid())
        : Effect.sync(() => {
            started = true;
          })
    ),
    close: Effect.sync(() => {
      closed = true;
      entries = [];
      lists = HashMap.empty();
      bySlot = HashMap.empty();
      detached = HashMap.empty();
      detachedOrder = [];
    }),
    read: alive.pipe(
      Effect.andThen(
        Effect.suspend(() =>
          Effect.gen(function* () {
            const snapshot = yield* Effect.forEach(
              entries,
              (entry) =>
                listOf(entry.slot).pipe(
                  Effect.map((members) => ({ resource: entry.resource, listSlot: entry.slot, members }))
                ),
              { concurrency: 1 }
            );
            const codec = CitationCallbackGroup.pipe(S.Array, S.fromJsonString);
            return yield* S.decodeEffect(codec)(
              yield* S.encodeEffect(codec)(snapshot).pipe(Effect.mapError(invalid))
            ).pipe(Effect.mapError(invalid));
          })
        )
      )
    ),
    clear: alive.pipe(
      Effect.andThen(work.step),
      Effect.andThen(
        Effect.sync(() => {
          entries = [];
        })
      )
    ),
    allocate: Effect.fn("Citation.callbackAllocate")((members: ReadonlyArray<CitationGroupMember>) =>
      alive.pipe(Effect.andThen(work.step), Effect.andThen(allocate(members)))
    ),
    get: Effect.fn("Citation.callbackGet")((resource: CitationCallbackResource) =>
      alive.pipe(Effect.andThen(work.step), Effect.andThen(get(resource)))
    ),
    write: Effect.fn("Citation.callbackWrite")(
      (list: CitationCallbackList, members: ReadonlyArray<CitationGroupMember>) =>
        alive.pipe(Effect.andThen(work.step), Effect.andThen(write(list, members)))
    ),
    set: Effect.fn("Citation.callbackSet")((resource: CitationCallbackResource, list: CitationCallbackList) =>
      alive.pipe(Effect.andThen(work.step), Effect.andThen(set(resource, list)))
    ),
    remove: Effect.fn("Citation.dictionaryRemove")(function* (resource: CitationCallbackResource) {
      yield* alive;
      yield* work.step;
      const value = yield* fingerprint(resource);
      const existing = yield* find(value.key);
      entries = A.filter(entries, (entry) => entry.key !== value.key);
      return O.flatMap(existing, (entry) => HashMap.get(bySlot, entry.slot));
    }),
    appendCurrent: Effect.fn("Citation.dictionaryAppendCurrent")(function* (
      resource: CitationCallbackResource,
      id: CitationMentionId
    ) {
      yield* alive;
      const handle = yield* get(resource);
      const members = yield* listOf(yield* slotOf(handle));
      yield* write(handle, A.append(members, CitationGroupMember.cases.Mention.make({ mentionId: id })));
    }),
  });
  return CitationCallbackDictionary.of({
    ...api,
    registerDetached: Effect.fn("Citation.serialRegisterDetached")((citation: Citation) =>
      mutex.withPermit(api.registerDetached(citation))
    ),
    citationOf: Effect.fn("Citation.serialCitationOf")((reference: CitationGroupMember) =>
      mutex.withPermit(api.citationOf(reference))
    ),
    detachedCitations: mutex.withPermit(api.detachedCitations),
    start: mutex.withPermit(api.start),
    close: mutex.withPermit(api.close),
    clear: mutex.withPermit(api.clear),
    read: mutex.withPermit(api.read),
    allocate: Effect.fn("Citation.serialAllocate")((members: ReadonlyArray<CitationGroupMember>) =>
      mutex.withPermit(api.allocate(members))
    ),
    get: Effect.fn("Citation.serialGet")((resource: CitationCallbackResource) => mutex.withPermit(api.get(resource))),
    write: Effect.fn("Citation.serialWrite")(
      (list: CitationCallbackList, members: ReadonlyArray<CitationGroupMember>) =>
        mutex.withPermit(api.write(list, members))
    ),
    set: Effect.fn("Citation.serialSet")((resource: CitationCallbackResource, list: CitationCallbackList) =>
      mutex.withPermit(api.set(resource, list))
    ),
    remove: Effect.fn("Citation.serialRemove")((resource: CitationCallbackResource) =>
      mutex.withPermit(api.remove(resource))
    ),
    appendCurrent: Effect.fn("Citation.serialAppend")((resource: CitationCallbackResource, id: CitationMentionId) =>
      mutex.withPermit(api.appendCurrent(resource, id))
    ),
  });
});

/**
 * Execute source-order callback dispatch over independently verified mentions.
 * Full results enter the prior-full list even when falsy. Callback updates
 * precede current-result grouping; equal keys retain the first presentation.
 * This private session result is not yet the final CitationDocument projection.
 * @internal
 * @category operations
 * @since 0.0.0
 */
export const runPreparedCitationCallbackSession = Effect.fn("Citation.runPreparedCallbackSession")(function* (
  prepared: PreparedCitationResolution
): Effect.fn.Return<typeof SessionState.Type, CitationCallbackFailure, Crypto.Crypto | CitationResolutionCallbacks> {
  const callbacks = yield* CitationResolutionCallbacks;
  let fulls: ReadonlyArray<CitationCallbackFull> = [];

  let last: CitationCallbackResource = CitationCallbackResource.cases.None.make({});
  const shared = yield* Effect.serviceOption(CitationResolutionWork);
  const work = O.isSome(shared) ? shared.value : yield* makeCitationResolutionWork(prepared.limits);
  if (work.maximum !== prepared.limits.resolutionIterations) return yield* invalid();
  const step = work.step;
  const suppliedDictionary = yield* Effect.serviceOption(CitationCallbackDictionary);
  const dictionary = O.isSome(suppliedDictionary)
    ? suppliedDictionary.value
    : yield* makeCitationCallbackDictionary(prepared).pipe(Effect.provideService(CitationResolutionWork, work));
  if (dictionary.owner !== prepared || dictionary.work !== work) return yield* invalid();
  return yield* Effect.acquireUseRelease(
    dictionary.start,
    () =>
      Effect.gen(function* () {
        for (const mention of prepared.mentions) {
          yield* step;
          if (isFull(mention.citation)) {
            const result = yield* callbacks.full(mention).pipe(Effect.mapError(callbackFailed));
            last = yield* S.decodeEffect(ResourceJson)(
              yield* S.encodeEffect(ResourceJson)(result).pipe(Effect.mapError(invalid))
            ).pipe(Effect.mapError(invalid));
            fulls = A.append(fulls, {
              citation: CitationGroupMember.cases.Mention.make({ mentionId: mention.id }),
              resource: last,
            });
          } else if (mention.citation.type === "id") {
            const groups = yield* dictionary.read;
            const result = yield* callbacks.id({ mention, last, groups }).pipe(Effect.mapError(callbackFailed));
            const snapshot = yield* S.decodeEffect(IdJson)(
              yield* S.encodeEffect(IdJson)(result).pipe(Effect.mapError(invalid))
            ).pipe(Effect.mapError(invalid));
            last = snapshot.resource;
          } else if (mention.citation.type === "unknown") last = CitationCallbackResource.cases.None.make({});
          else {
            const callback =
              mention.citation.type === "shortFormCase"
                ? callbacks.shortCase
                : mention.citation.type === "supra"
                  ? callbacks.supra
                  : callbacks.reference;
            const result = yield* callback({ mention, fulls }).pipe(Effect.mapError(callbackFailed));
            if (A.length(result.fulls) > prepared.limits.mentions) return yield* limit();
            const snapshot = yield* S.decodeEffect(FullsJson)(
              yield* S.encodeEffect(FullsJson)(result).pipe(Effect.mapError(invalid))
            ).pipe(Effect.mapError(invalid));
            fulls = snapshot.fulls;
            last = snapshot.resource;
          }
          if (A.length(fulls) > prepared.limits.mentions) return yield* limit();
          yield* Effect.forEach(fulls, (entry) => dictionary.citationOf(entry.citation), {
            discard: true,
            concurrency: 1,
          });
          const groups = yield* dictionary.read;
          if (mention.citation.type === "id") yield* Effect.forEach(groups, () => step, { discard: true });

          if (last._tag !== "None" && last.truthy) yield* dictionary.appendCurrent(last, mention.id);
          const finalGroups = yield* dictionary.read;
          if (
            A.reduce(finalGroups, 0, (count, group) => count + A.length(group.members)) >
            prepared.limits.resolutionEdges
          )
            return yield* limit();
        }
        const groups = yield* dictionary.read;

        return yield* S.decodeEffect(S.toType(SessionState))({
          ...prepared,
          fulls,
          groups,
          last,
          detachedCitations: yield* dictionary.detachedCitations,
        }).pipe(Effect.mapError(invalid));
      }),
    () => dictionary.close
  );
});

/**
 * Verify raw server inputs once, then execute the captured callback session.
 * @internal
 * @category operations
 * @since 0.0.0
 */
export const runCitationCallbackSession = Effect.fn("Citation.runCallbackSession")(function* (input: unknown) {
  const prepared = yield* prepareCitationResolution(input).pipe(
    Effect.mapError((error) => CitationCallbackFailure.make({ reason: error.reason }))
  );
  return yield* runPreparedCitationCallbackSession(prepared);
});
