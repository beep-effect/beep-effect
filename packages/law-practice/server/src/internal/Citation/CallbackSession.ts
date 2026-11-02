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
  CitationComponentAnchor,
  CitationDetached,
  CitationDetachedId,
  CitationFootnoteZone,
  CitationGroupMember,
  CitationMention,
  CitationMentionId,
  CitationMentionReceipt,
  FullCitation,
} from "@beep/law-practice-domain/values";
import { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import { SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as Tuple from "effect/Tuple";
import {
  CitationCallbackFailure,
  CitationCallbackResource,
  CitationCallbackResourceOrigin,
} from "./CallbackResource.ts";

export { CitationCallbackFailure, CitationCallbackResource } from "./CallbackResource.ts";

import { CitationAuthorityIdentityInput } from "./AuthorityIdentity.ts";
import { CitationDefaultObservation, readCitationDefaultObservation } from "./CallbackObservations.ts";
import { CitationCallbackRuntimeIndexFactory } from "./CallbackRuntimeIndex.ts";
import { captureCitationMentionReceiptData } from "./Mention.ts";
import { PreparedCitationResolution, prepareCitationResolution } from "./ResolutionInput.ts";
import { CitationResourceIdentity, makeCitationResourceAuthorityId } from "./ResourceIdentity.ts";
import type { CitationCallbackRuntimeIndex } from "./CallbackRuntimeIndex.ts";

const $I = $LawPracticeServerId.create("internal/Citation/CallbackSession");
/**
 * Prior-full context references either a verified occurrence or a detached semantic object.
 * @internal
 * @category models
 * @since 0.0.0
 */
export const CitationCallbackFull = S.Struct({
  pairSlot: S.Natural,
  citation: CitationGroupMember,
  resource: CitationCallbackResource,
}).pipe(
  $I.annoteSchema("CitationCallbackFull", {
    description:
      "Immutable registered pair node with operation-local identity, explicit semantic reference and falsy resource values.",
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
 * Exact insertion entry selected by a dispatcher append. The stored key may
 * differ from the callback result; later mutations may remove this entry.
 * @internal
 * @category models
 * @since 0.0.0
 */
export const CitationCallbackAssignment = S.Struct({
  entrySlot: S.Natural,
  resource: CitationCallbackResource,
  listSlot: S.Natural,
}).pipe(
  $I.annoteSchema("CitationCallbackAssignment", {
    description: "Captured append destination; no repeated lookup or claim of final membership.",
  })
);
/**
 * Schema-derived append destination.
 * @internal
 * @category models
 * @since 0.0.0
 */
export type CitationCallbackAssignment = typeof CitationCallbackAssignment.Type;
/**
 * One actual dispatcher result and optional successful append destination.
 * An unlisted falsy resource remains a result; decisions are not memberships.
 * @internal
 * @category models
 * @since 0.0.0
 */
export const CitationCallbackDecision = S.Struct({
  mentionId: CitationMentionId,
  callback: S.Literals(["full", "shortCase", "supra", "reference", "id", "unknown"]),
  resource: CitationCallbackResource,
  assignment: S.OptionFromNullOr(CitationCallbackAssignment),
  observation: S.OptionFromNullOr(CitationDefaultObservation),
}).pipe(
  $I.annoteSchema("CitationCallbackDecision", {
    description: "Source-order callback result and actual append history, independent of final dictionary contents.",
  })
);
/**
 * Schema-derived dispatch decision.
 * @internal
 * @category models
 * @since 0.0.0
 */
export type CitationCallbackDecision = typeof CitationCallbackDecision.Type;
/**
 * Final dictionary entry with identity separate from its key and list.
 * @internal
 * @category models
 * @since 0.0.0
 */
export const CitationCallbackEntry = S.Struct({ ...CitationCallbackGroup.fields, entrySlot: S.Natural }).pipe(
  $I.annoteSchema("CitationCallbackEntry", {
    description: "Identity-bearing final insertion entry, including repeated resource-object keys.",
  })
);
/**
 * Schema-derived final insertion entry.
 * @internal
 * @category models
 * @since 0.0.0
 */
export type CitationCallbackEntry = typeof CitationCallbackEntry.Type;
/**
 * Prior-full callback input; schema views come from the shared operation owner.
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
 * Context callback result; prior-full state lives in the captured owner.
 * @internal
 * @category models
 * @since 0.0.0
 */
export const CitationFullsCallbackOutput = S.Struct({
  resource: CitationCallbackResource,
}).pipe(
  $I.annoteSchema("CitationFullsCallbackOutput", {
    description: "Context callback result; prior-full mutations use the captured operation owner.",
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
 * Prior-full pairs and list state belong to the captured owner. Its service
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
  groups: S.Array(CitationCallbackEntry),
  decisions: S.Array(CitationCallbackDecision),
  resourceOrigins: S.Array(CitationCallbackResourceOrigin),
  last: CitationCallbackResource,
  detachedCitations: S.Array(CitationDetached),
})
  .check(
    S.makeFilter(
      (state) => {
        const originKeys = HashSet.fromIterable(
          A.map(state.resourceOrigins, (origin) => `${origin.scope}:${origin.slot}`)
        );
        const resources = [
          state.last,
          ...A.map(state.fulls, (full) => full.resource),
          ...A.map(state.groups, (group) => group.resource),
          ...A.flatMap(state.decisions, (decision) => [
            decision.resource,
            ...O.getOrElse(
              O.map(decision.observation, (observation) =>
                observation._tag === "Ambiguous" ? observation.resources : []
              ),
              A.empty<CitationCallbackResource>
            ),
            ...O.toArray(O.map(decision.assignment, (assignment) => assignment.resource)),
          ]),
        ];
        return (
          HashSet.size(originKeys) === A.length(state.resourceOrigins) &&
          A.every(
            resources,
            (resource) =>
              resource._tag !== "Registered" || HashSet.has(originKeys, `${resource.scope}:${resource.slot}`)
          ) &&
          A.length(state.decisions) === A.length(state.mentions) &&
          A.every(
            A.zip(state.decisions, state.mentions),
            ([decision, mention]) =>
              decision.mentionId === mention.id &&
              (decision.resource._tag !== "None" || O.isNone(decision.assignment)) &&
              (O.isNone(decision.observation) ||
                O.exists(
                  decision.observation,
                  (observation) => observation.mentionId === mention.id && decision.resource._tag === "None"
                ))
          ) &&
          HashSet.size(HashSet.fromIterable(A.map(state.groups, (group) => group.entrySlot))) === A.length(state.groups)
        );
      },
      $I.annote("SessionDecisionCoherence", {
        description:
          "Exactly one ordered decision per occurrence; None has no append, final insertion and registered origin identities are unique, all registered references have owned origins, and removed destinations need not survive.",
      })
    )
  )
  .pipe(
    $I.annoteSchema("SessionState", {
      description: "Private post-dispatch state; not a final document or grouping correctness proof.",
    })
  );
const CapturedData = S.Struct({ ...SessionState.fields, mentions: S.Array(CitationMentionReceipt) });
const CapturedJson = S.fromJsonString(CapturedData);
const NativeAnchors = S.Struct({
  anchor: CitationMention.fields.anchor,
  components: S.Array(CitationComponentAnchor.fields.anchor),
  footnote: S.Option(CitationFootnoteZone.fields.anchor),
});
const Issued = S.Struct({ json: S.String, anchors: S.Array(NativeAnchors) });
const issuedSessions = new WeakMap<object, typeof Issued.Type>();
/**
 * Read the immutable issued snapshot, not mutable fields on its outward view.
 * Copies and receipts cannot issue this operation-local capability. Native
 * anchor capabilities remain separately captured; no structural proof is minted.
 * @internal
 * @category capabilities
 * @since 0.0.0
 */
export const readCapturedCitationSession = Effect.fn("Citation.readCapturedSession")(function* (input: unknown) {
  if (typeof input !== "object" || input === null)
    return yield* CitationCallbackFailure.make({ reason: "identity-failed" });
  const sealed = issuedSessions.get(input);
  if (sealed === undefined) return yield* CitationCallbackFailure.make({ reason: "identity-failed" });
  const data = yield* S.decodeEffect(CapturedJson)(sealed.json).pipe(
    Effect.mapError(() => CitationCallbackFailure.make({ reason: "identity-failed" }))
  );
  const mentions = yield* Effect.forEach(data.mentions, (mention, index) =>
    Effect.gen(function* () {
      const anchors = A.getUnsafe(sealed.anchors, index);
      const components = A.map(mention.components, (component, componentIndex) =>
        CitationComponentAnchor.make({ name: component.name, anchor: A.getUnsafe(anchors.components, componentIndex) })
      );
      const footnote = O.isNone(mention.footnote)
        ? O.none<CitationFootnoteZone>()
        : O.some(
            CitationFootnoteZone.make({ label: mention.footnote.value.label, anchor: O.getOrThrow(anchors.footnote) })
          );
      return yield* S.decodeUnknownEffect(S.toType(CitationMention))({
        ...mention,
        anchor: anchors.anchor,
        components,
        footnote,
      });
    })
  ).pipe(Effect.mapError(() => CitationCallbackFailure.make({ reason: "identity-failed" })));
  return yield* S.decodeEffect(S.toType(SessionState))({ ...data, mentions }).pipe(
    Effect.mapError(() => CitationCallbackFailure.make({ reason: "identity-failed" }))
  );
});
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
    readonly currentResource: (
      resource: CitationCallbackResource
    ) => Effect.Effect<CitationCallbackResource, CitationCallbackFailure>;
    readonly hostResource: (input: unknown) => Effect.Effect<CitationCallbackResource, CitationCallbackFailure>;
    readonly isTruthy: (resource: CitationCallbackResource) => Effect.Effect<boolean, CitationCallbackFailure>;
    readonly validateResource: (resource: CitationCallbackResource) => Effect.Effect<void, CitationCallbackFailure>;
    readonly canonicalResource: (
      reference: CitationGroupMember
    ) => Effect.Effect<CitationCallbackResource, CitationCallbackFailure>;
    readonly uniqueResourceCount: (
      resources: ReadonlyArray<CitationCallbackResource>
    ) => Effect.Effect<number, CitationCallbackFailure>;
    readonly resourceKey: (resource: CitationCallbackResource) => Effect.Effect<string, CitationCallbackFailure>;
    readonly readListNodes: Effect.Effect<ReadonlyArray<ReadonlyArray<CitationGroupMember>>, CitationCallbackFailure>;
    readonly readList: (
      list: CitationCallbackList
    ) => Effect.Effect<ReadonlyArray<CitationGroupMember>, CitationCallbackFailure>;
    readonly writeCitation: (
      reference: CitationGroupMember,
      citation: Citation
    ) => Effect.Effect<void, CitationCallbackFailure>;
    readonly readMentions: Effect.Effect<ReadonlyArray<CitationMention>, CitationCallbackFailure>;
    readonly readFulls: Effect.Effect<ReadonlyArray<CitationCallbackFull>, CitationCallbackFailure>;
    readonly createFullPair: (
      citation: CitationGroupMember,
      resource: CitationCallbackResource
    ) => Effect.Effect<CitationCallbackFull, CitationCallbackFailure>;
    readonly writeFulls: (pairs: ReadonlyArray<CitationCallbackFull>) => Effect.Effect<void, CitationCallbackFailure>;
    readonly appendFullCurrent: (
      citation: CitationGroupMember,
      resource: CitationCallbackResource
    ) => Effect.Effect<void, CitationCallbackFailure>;
    readonly registerDetached: (citation: Citation) => Effect.Effect<CitationGroupMember, CitationCallbackFailure>;
    readonly citationOf: (reference: CitationGroupMember) => Effect.Effect<Citation, CitationCallbackFailure>;
    readonly detachedCitations: Effect.Effect<ReadonlyArray<CitationDetached>, CitationCallbackFailure>;
    readonly owner: PreparedCitationResolution;
    readonly work: Context.Service.Shape<typeof CitationResolutionWork>;
    readonly start: Effect.Effect<void, CitationCallbackFailure>;
    readonly close: Effect.Effect<void>;
    readonly read: Effect.Effect<ReadonlyArray<CitationCallbackGroup>, CitationCallbackFailure>;
    readonly resourceOrigins: Effect.Effect<ReadonlyArray<CitationCallbackResourceOrigin>, CitationCallbackFailure>;
    readonly readEntries: Effect.Effect<ReadonlyArray<CitationCallbackEntry>, CitationCallbackFailure>;
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
    ) => Effect.Effect<CitationCallbackAssignment, CitationCallbackFailure>;
  }
>()($I`CitationCallbackDictionary`) {}
const DictionaryEntry = S.Struct({
  entrySlot: S.Natural,
  key: S.String,
  resource: CitationCallbackResource,
  slot: S.Natural,
}).pipe(
  $I.annoteSchema("DictionaryEntry", { description: "Private ordered key entry referencing an owned list node." })
);
const PairsJson = CitationCallbackFull.pipe(S.Array, S.fromJsonString);
const pairValueEquivalent = S.toEquivalence(CitationCallbackFull);
const memberEquivalent = S.toEquivalence(CitationGroupMember);
const pairEquivalent = (left: CitationCallbackFull, right: CitationCallbackFull) =>
  left.resource._tag === "Registered" && right.resource._tag === "Registered"
    ? left.pairSlot === right.pairSlot &&
      memberEquivalent(left.citation, right.citation) &&
      left.resource.scope === right.resource.scope &&
      left.resource.slot === right.resource.slot
    : pairValueEquivalent(left, right);
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
  const crypto = yield* Digest.Digest;
  const work = yield* CitationResolutionWork;
  const runtimeFactory = yield* Effect.serviceOption(CitationCallbackRuntimeIndexFactory);
  let runtime: O.Option<CitationCallbackRuntimeIndex> = O.none();
  if (work.maximum !== limits.resolutionIterations) return yield* invalid();
  const semanticEntries = yield* Effect.forEach(
    prepared.mentions,
    (mention) =>
      Effect.gen(function* () {
        const citation = yield* S.decodeEffect(CitationJson)(yield* S.encodeEffect(CitationJson)(mention.citation));
        return Tuple.make(mention.id, citation);
      }).pipe(Effect.mapError(invalid)),
    { concurrency: 1 }
  );
  let known = HashMap.fromIterable(semanticEntries);
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
  let nextEntrySlot = 0;
  let nextPairSlot = 0;
  let pairs = HashMap.empty<number, CitationCallbackFull>();
  let fulls = A.empty<CitationCallbackFull>();
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
    if (resource._tag === "Registered") return yield* invalid();
    if (resource._tag === "Unhashable") return yield* CitationCallbackFailure.make({ reason: "unhashable-resource" });
    const key =
      resource._tag === "None"
        ? "none"
        : yield* makeCitationResourceAuthorityId(resource.identity).pipe(
            Effect.provideService(Digest.Digest, crypto),
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
  const refreshRuntime = Effect.suspend(() =>
    O.isNone(runtime)
      ? Effect.void
      : runtime.value.read.pipe(
          Effect.map((values) => {
            entries = A.map(values, (entry) => ({
              entrySlot: entry.entryId,
              key: `entry:${entry.entryId}`,
              resource: entry.resource,
              slot: entry.slot,
            }));
          })
        )
  );
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
      nextSlot + nextPairSlot >= limits.resolutionIterations ||
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
  const reserveEntrySlot = Effect.suspend(() =>
    nextEntrySlot >= limits.resolutionIterations ? Effect.fail(limit()) : Effect.succeed(nextEntrySlot++)
  );
  const getLocated = Effect.fn("Citation.dictionaryGetLocated")(function* (input: CitationCallbackResource) {
    if (O.isSome(runtime)) {
      let selected = yield* runtime.value.get(input);
      let handle: CitationCallbackList;
      if (O.isSome(selected)) handle = yield* Effect.fromOption(HashMap.get(bySlot, selected.value.slot), invalid);
      else {
        if (A.length(entries) >= limits.authorities) return yield* limit();
        handle = yield* allocate([]);
        selected = O.some(yield* runtime.value.set(input, yield* slotOf(handle)));
        yield* refreshRuntime;
      }
      const entry = yield* Effect.fromOption(selected, invalid);
      return {
        handle,
        entry: { entrySlot: entry.entryId, key: `entry:${entry.entryId}`, resource: entry.resource, slot: entry.slot },
      };
    }
    const value = yield* fingerprint(input);
    const existing = yield* find(value.key);
    if (O.isSome(existing))
      return {
        handle: yield* Effect.fromOption(HashMap.get(bySlot, existing.value.slot), invalid),
        entry: existing.value,
      };
    if (A.length(entries) >= limits.authorities) return yield* limit();
    const handle = yield* allocate([]);
    const entry = { ...value, entrySlot: yield* reserveEntrySlot, slot: yield* slotOf(handle) };
    entries = A.append(entries, entry);
    return { handle, entry };
  });
  const get = Effect.fn("Citation.dictionaryGet")((input: CitationCallbackResource) =>
    getLocated(input).pipe(Effect.map((located) => located.handle))
  );
  const set = Effect.fn("Citation.dictionarySet")(function* (
    input: CitationCallbackResource,
    handle: CitationCallbackList
  ) {
    const slot = yield* slotOf(handle);
    if (O.isSome(runtime)) {
      yield* runtime.value.set(input, slot);
      yield* refreshRuntime;
      return;
    }
    const value = yield* fingerprint(input);
    const existing = yield* find(value.key);
    if (O.isNone(existing) && A.length(entries) >= limits.authorities) return yield* limit();
    const updated = O.isNone(existing)
      ? A.append(entries, { ...value, entrySlot: nextEntrySlot, slot })
      : A.map(entries, (entry) => (entry.key === value.key ? { ...entry, slot } : entry));
    if (
      A.reduce(
        updated,
        0,
        (count, entry) => count + O.getOrElse(O.map(HashMap.get(lists, entry.slot), A.length), () => 0)
      ) > limits.resolutionEdges
    )
      return yield* limit();
    if (O.isNone(existing)) yield* reserveEntrySlot;
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
  if (O.isSome(runtimeFactory))
    runtime = O.some(
      yield* runtimeFactory.value.build({
        read: citationOf,
        step: work.step,
        limits,
        checkSet: Effect.fn("Citation.runtimeListBudget")((current, previous, slot) =>
          Effect.suspend(() => {
            const total = A.reduce(
              current,
              O.isNone(previous) ? O.getOrElse(O.map(HashMap.get(lists, slot), A.length), () => 0) : 0,
              (count, entry) =>
                count +
                O.getOrElse(
                  O.map(
                    HashMap.get(
                      lists,
                      O.isSome(previous) && entry.entryId === previous.value.entryId ? slot : entry.value
                    ),
                    A.length
                  ),
                  () => 0
                )
            );
            return total > limits.resolutionEdges ? Effect.fail(limit()) : Effect.void;
          })
        ),
      })
    );
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
      Effect.provideService(Digest.Digest, crypto),
      Effect.mapError(() => CitationCallbackFailure.make({ reason: "identity-failed" })),
      Effect.catchDefect(() => Effect.fail(CitationCallbackFailure.make({ reason: "identity-failed" })))
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
  const currentResource = Effect.fn("Citation.callbackCurrentResource")(function* (resource: CitationCallbackResource) {
    yield* alive;
    if (resource._tag !== "Registered") return resource;
    if (O.isNone(runtime)) return yield* invalid();
    return yield* runtime.value.view(resource);
  });
  const validateResource = Effect.fn("Citation.callbackValidateResource")(function* (
    resource: CitationCallbackResource
  ) {
    yield* alive;
    if (resource._tag !== "Registered") return;
    if (O.isNone(runtime)) return yield* invalid();
    yield* runtime.value.validate(resource);
  });
  const createFullPair = Effect.fn("Citation.createFullPair")(function* (
    citation: CitationGroupMember,
    resource: CitationCallbackResource
  ) {
    yield* alive;
    const reference = yield* S.decodeEffect(S.fromJsonString(CitationGroupMember))(
      yield* S.encodeEffect(S.fromJsonString(CitationGroupMember))(citation).pipe(Effect.mapError(invalid))
    ).pipe(Effect.mapError(invalid));
    yield* citationOf(reference);
    if (nextPairSlot + nextSlot + nextPairSlot >= limits.resolutionIterations) return yield* limit();
    const snapshot = yield* S.decodeEffect(ResourceJson)(
      yield* S.encodeEffect(ResourceJson)(resource).pipe(Effect.mapError(invalid))
    ).pipe(Effect.mapError(invalid));
    yield* validateResource(snapshot);
    const pair = CitationCallbackFull.make({ pairSlot: nextPairSlot, citation: reference, resource: snapshot });
    nextPairSlot += 1;
    pairs = HashMap.set(pairs, pair.pairSlot, pair);
    // The returned data cannot mutate the registered immutable pair.
    return yield* S.decodeEffect(S.fromJsonString(CitationCallbackFull))(
      yield* S.encodeEffect(S.fromJsonString(CitationCallbackFull))(pair).pipe(Effect.mapError(invalid))
    ).pipe(Effect.mapError(invalid));
  });
  const writeFulls = Effect.fn("Citation.writeFulls")(function* (input: ReadonlyArray<CitationCallbackFull>) {
    yield* alive;
    if (A.length(input) > limits.mentions) return yield* limit();
    const snapshot = yield* S.decodeEffect(PairsJson)(
      yield* S.encodeEffect(PairsJson)(input).pipe(Effect.mapError(invalid))
    ).pipe(Effect.mapError(invalid));
    if (
      !A.every(snapshot, (pair) => O.exists(HashMap.get(pairs, pair.pairSlot), (owned) => pairEquivalent(owned, pair)))
    )
      return yield* invalid();
    for (const pair of snapshot) yield* validateResource(pair.resource);
    fulls = A.fromIterable(snapshot);
  });
  const writeCitation = Effect.fn("Citation.writeCallbackCitation")(function* (
    reference: CitationGroupMember,
    input: Citation
  ) {
    yield* alive;
    yield* work.step;
    const refCodec = S.fromJsonString(CitationGroupMember);
    const target = yield* S.decodeEffect(refCodec)(
      yield* S.encodeEffect(refCodec)(reference).pipe(Effect.mapError(invalid))
    ).pipe(Effect.mapError(invalid));
    const current = yield* citationOf(target);
    const citation = yield* S.decodeEffect(CitationJson)(
      yield* S.encodeEffect(CitationJson)(input).pipe(Effect.mapError(invalid))
    ).pipe(Effect.mapError(invalid));
    if (target._tag === "Mention") {
      // cm1 includes the semantic discriminant; no stale ID or fake proof.
      if (citation.type !== current.type) return yield* invalid();
      known = HashMap.set(known, target.mentionId, citation);
    } else {
      const object = CitationDetached.make({ id: target.detachedId, citation });
      detached = HashMap.set(detached, target.detachedId, object);
      detachedOrder = A.map(detachedOrder, (entry) => (entry.id === target.detachedId ? object : entry));
    }
  });
  const api = CitationCallbackDictionary.of({
    currentResource,
    resourceOrigins: alive.pipe(
      Effect.andThen(
        Effect.suspend(() =>
          O.isSome(runtime) ? runtime.value.origins : Effect.succeed(A.empty<CitationCallbackResourceOrigin>())
        )
      )
    ),
    hostResource: Effect.fn("Citation.callbackHostResource")(function* (input: unknown) {
      yield* alive;
      if (O.isNone(runtime)) return yield* invalid();
      return yield* runtime.value.createHost(input);
    }),
    isTruthy: Effect.fn("Citation.callbackTruthy")(function* (resource: CitationCallbackResource) {
      yield* alive;
      if (O.isSome(runtime)) return yield* runtime.value.isTruthy(resource);
      if (resource._tag === "Registered") return yield* invalid();
      return resource._tag !== "None" && resource.truthy;
    }),
    validateResource,
    canonicalResource: Effect.fn("Citation.callbackCanonicalResource")(function* (reference: CitationGroupMember) {
      yield* alive;
      if (O.isSome(runtime)) return yield* runtime.value.create(reference);
      const citation = yield* citationOf(reference);
      if (!isFull(citation) || reference._tag !== "Mention") return yield* invalid();
      const selected = citation.publication.selectedEdition;
      const edition = O.flatMap(selected, (ref) =>
        A.findFirst(prepared.editions, (edition) => edition.edition === ref)
      );
      if (O.isSome(selected) && O.isNone(edition))
        return yield* CitationCallbackFailure.make({ reason: "identity-failed" });
      return CitationCallbackResource.cases.Hashable.make({
        identity: CitationResourceIdentity.cases.Canonical.make({
          authority: CitationAuthorityIdentityInput.make({
            citation,
            mentionId: reference.mentionId,
            selectedEdition: edition,
          }),
        }),
        truthy: true,
        value: { kind: "default", mentionId: reference.mentionId },
      });
    }),
    uniqueResourceCount: Effect.fn("Citation.callbackUniqueResourceCount")(function* (
      resources: ReadonlyArray<CitationCallbackResource>
    ) {
      yield* alive;
      if (O.isSome(runtime)) return yield* runtime.value.uniqueCount(resources);
      const keys = yield* Effect.forEach(
        resources,
        (resource) =>
          work.step.pipe(
            Effect.andThen(fingerprint(resource)),
            Effect.map((value) => value.key)
          ),
        { concurrency: 1 }
      );
      return A.length(A.dedupe(keys));
    }),
    resourceKey: Effect.fn("Citation.callbackResourceKey")(function* (resource: CitationCallbackResource) {
      yield* alive;
      if (O.isSome(runtime)) return yield* runtime.value.equalityKey(resource);
      return (yield* fingerprint(resource)).key;
    }),
    readListNodes: alive.pipe(
      Effect.andThen(
        Effect.suspend(() =>
          Effect.forEach(
            nextSlot === 0 ? A.empty<number>() : A.makeBy(nextSlot, (slot) => slot),
            (slot) => listOf(slot).pipe(Effect.flatMap(membersSnapshot)),
            {
              concurrency: 1,
            }
          )
        )
      )
    ),
    readList: Effect.fn("Citation.callbackReadList")(function* (handle: CitationCallbackList) {
      yield* alive;
      return yield* membersSnapshot(yield* listOf(yield* slotOf(handle)));
    }),
    writeCitation,
    readMentions: alive.pipe(
      Effect.andThen(
        Effect.suspend(() =>
          Effect.forEach(
            prepared.mentions,
            (mention) =>
              citationOf(CitationGroupMember.cases.Mention.make({ mentionId: mention.id })).pipe(
                Effect.map((citation) => CitationMention.make({ ...mention, citation }))
              ),
            { concurrency: 1 }
          )
        )
      )
    ),
    readFulls: alive.pipe(
      Effect.andThen(
        Effect.suspend(() =>
          Effect.gen(function* () {
            const values = yield* Effect.forEach(
              fulls,
              (pair) => currentResource(pair.resource).pipe(Effect.map((resource) => ({ ...pair, resource }))),
              { concurrency: 1 }
            );
            return yield* S.decodeEffect(PairsJson)(yield* S.encodeEffect(PairsJson)(values));
          }).pipe(Effect.mapError(invalid))
        )
      )
    ),
    createFullPair: Effect.fn("Citation.callbackCreateFullPair")(
      (citation: CitationGroupMember, resource: CitationCallbackResource) =>
        alive.pipe(Effect.andThen(work.step), Effect.andThen(createFullPair(citation, resource)))
    ),
    writeFulls: Effect.fn("Citation.callbackWriteFulls")((input: ReadonlyArray<CitationCallbackFull>) =>
      alive.pipe(Effect.andThen(work.step), Effect.andThen(writeFulls(input)))
    ),
    appendFullCurrent: Effect.fn("Citation.appendFullCurrent")(function* (
      citation: CitationGroupMember,
      resource: CitationCallbackResource
    ) {
      const pair = yield* createFullPair(citation, resource);
      yield* writeFulls(A.append(fulls, pair));
    }),
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
    close: Effect.gen(function* () {
      closed = true;
      if (O.isSome(runtime)) yield* runtime.value.close;
      entries = [];
      lists = HashMap.empty();
      bySlot = HashMap.empty();
      detached = HashMap.empty();
      detachedOrder = [];
      pairs = HashMap.empty();
      fulls = [];
    }),
    read: alive.pipe(
      Effect.andThen(
        Effect.suspend(() =>
          Effect.gen(function* () {
            const snapshot = yield* Effect.forEach(
              entries,
              (entry) =>
                listOf(entry.slot).pipe(
                  Effect.flatMap((members) =>
                    currentResource(entry.resource).pipe(
                      Effect.map((resource) => ({ resource, listSlot: entry.slot, members }))
                    )
                  )
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
    readEntries: Effect.suspend(() =>
      api.read.pipe(
        Effect.flatMap((groups) =>
          S.decodeEffect(S.toType(CitationCallbackEntry).pipe(S.Array))(
            A.map(groups, (group, index) => ({ ...group, entrySlot: A.getUnsafe(entries, index).entrySlot }))
          ).pipe(Effect.mapError(invalid))
        )
      )
    ),
    clear: alive.pipe(
      Effect.andThen(work.step),
      Effect.andThen(
        Effect.gen(function* () {
          if (O.isSome(runtime)) yield* runtime.value.clear;
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
      if (O.isSome(runtime)) {
        const removed = yield* runtime.value.remove(resource);
        yield* refreshRuntime;
        return O.flatMap(removed, (entry) => HashMap.get(bySlot, entry.slot));
      }
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
      const located = yield* getLocated(resource);
      const members = yield* listOf(yield* slotOf(located.handle));
      yield* write(located.handle, A.append(members, CitationGroupMember.cases.Mention.make({ mentionId: id })));
      return {
        entrySlot: located.entry.entrySlot,
        resource: yield* currentResource(located.entry.resource),
        listSlot: located.entry.slot,
      };
    }),
  });
  return CitationCallbackDictionary.of({
    ...api,
    readEntries: mutex.withPermit(api.readEntries),
    resourceOrigins: mutex.withPermit(api.resourceOrigins),
    currentResource: Effect.fn("Citation.serialCurrentResource")((resource: CitationCallbackResource) =>
      mutex.withPermit(api.currentResource(resource))
    ),
    hostResource: Effect.fn("Citation.serialHostResource")((input: unknown) =>
      mutex.withPermit(api.hostResource(input))
    ),
    isTruthy: Effect.fn("Citation.serialTruthy")((resource: CitationCallbackResource) =>
      mutex.withPermit(api.isTruthy(resource))
    ),
    validateResource: Effect.fn("Citation.serialValidateResource")((resource: CitationCallbackResource) =>
      mutex.withPermit(api.validateResource(resource))
    ),
    canonicalResource: Effect.fn("Citation.serialCanonicalResource")((reference: CitationGroupMember) =>
      mutex.withPermit(api.canonicalResource(reference))
    ),
    uniqueResourceCount: Effect.fn("Citation.serialUniqueResourceCount")(
      (resources: ReadonlyArray<CitationCallbackResource>) => mutex.withPermit(api.uniqueResourceCount(resources))
    ),
    resourceKey: Effect.fn("Citation.serialResourceKey")((resource: CitationCallbackResource) =>
      mutex.withPermit(api.resourceKey(resource))
    ),
    readListNodes: mutex.withPermit(api.readListNodes),
    readList: Effect.fn("Citation.serialReadList")((list: CitationCallbackList) =>
      mutex.withPermit(api.readList(list))
    ),
    writeCitation: Effect.fn("Citation.serialWriteCitation")((reference: CitationGroupMember, citation: Citation) =>
      mutex.withPermit(api.writeCitation(reference, citation))
    ),
    readMentions: mutex.withPermit(api.readMentions),
    readFulls: mutex.withPermit(api.readFulls),
    createFullPair: Effect.fn("Citation.serialCreateFullPair")(
      (citation: CitationGroupMember, resource: CitationCallbackResource) =>
        mutex.withPermit(api.createFullPair(citation, resource))
    ),
    writeFulls: Effect.fn("Citation.serialWriteFulls")((input: ReadonlyArray<CitationCallbackFull>) =>
      mutex.withPermit(api.writeFulls(input))
    ),
    appendFullCurrent: Effect.fn("Citation.serialAppendFullCurrent")(
      (citation: CitationGroupMember, resource: CitationCallbackResource) =>
        mutex.withPermit(api.appendFullCurrent(citation, resource))
    ),
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
): Effect.fn.Return<typeof SessionState.Type, CitationCallbackFailure, Digest.Digest | CitationResolutionCallbacks> {
  const callbacks = yield* CitationResolutionCallbacks;

  let decisions = A.empty<CitationCallbackDecision>();
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
        for (const original of prepared.mentions) {
          yield* step;
          const citation = yield* dictionary.citationOf(
            CitationGroupMember.cases.Mention.make({ mentionId: original.id })
          );
          const mention = CitationMention.make({ ...original, citation });
          let observation = O.none<CitationDefaultObservation>();
          if (isFull(mention.citation)) {
            const result = yield* callbacks.full(mention).pipe(Effect.mapError(callbackFailed));
            last = yield* S.decodeEffect(ResourceJson)(
              yield* S.encodeEffect(ResourceJson)(result).pipe(Effect.mapError(invalid))
            ).pipe(Effect.mapError(invalid));
            yield* dictionary.appendFullCurrent(
              CitationGroupMember.cases.Mention.make({ mentionId: mention.id }),
              last
            );
          } else if (mention.citation.type === "id") {
            const groups = yield* dictionary.read;
            const result = yield* callbacks
              .id({ mention, last: yield* dictionary.currentResource(last), groups })
              .pipe(Effect.mapError(callbackFailed));
            observation = yield* readCitationDefaultObservation(result, mention.id);
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
            const result = yield* callback({ mention, fulls: yield* dictionary.readFulls }).pipe(
              Effect.mapError(callbackFailed)
            );
            observation = yield* readCitationDefaultObservation(result, mention.id);
            const snapshot = yield* S.decodeEffect(FullsJson)(
              yield* S.encodeEffect(FullsJson)(result).pipe(Effect.mapError(invalid))
            ).pipe(Effect.mapError(invalid));
            last = snapshot.resource;
          }
          const groups = yield* dictionary.read;
          if (mention.citation.type === "id") yield* Effect.forEach(groups, () => step, { discard: true });

          last = yield* dictionary.currentResource(last);
          yield* dictionary.validateResource(last);
          const assignment = (yield* dictionary.isTruthy(last))
            ? O.some(yield* dictionary.appendCurrent(last, mention.id))
            : O.none<CitationCallbackAssignment>();
          decisions = A.append(decisions, {
            mentionId: mention.id,
            callback: isFull(mention.citation)
              ? "full"
              : mention.citation.type === "shortFormCase"
                ? "shortCase"
                : mention.citation.type,
            resource: last,
            assignment,
            observation: last._tag === "None" ? observation : O.none(),
          });
          const finalGroups = yield* dictionary.read;
          if (
            A.reduce(finalGroups, 0, (count, group) => count + A.length(group.members)) >
            prepared.limits.resolutionEdges
          )
            return yield* limit();
        }
        const groups = yield* dictionary.readEntries;
        decisions = yield* Effect.forEach(
          decisions,
          (decision) =>
            Effect.gen(function* () {
              const resource = yield* dictionary.currentResource(decision.resource);
              const assignment = O.isNone(decision.assignment)
                ? O.none<CitationCallbackAssignment>()
                : O.some({
                    ...decision.assignment.value,
                    resource: yield* dictionary.currentResource(decision.assignment.value.resource),
                  });
              const observation =
                O.isSome(decision.observation) && decision.observation.value._tag === "Ambiguous"
                  ? O.some({
                      ...decision.observation.value,
                      resources: yield* Effect.forEach(
                        decision.observation.value.resources,
                        dictionary.currentResource
                      ),
                    })
                  : decision.observation;
              return { ...decision, resource, assignment, observation };
            }),
          { concurrency: 1 }
        );

        const result = yield* S.decodeEffect(S.toType(SessionState))({
          ...prepared,
          mentions: yield* dictionary.readMentions,
          fulls: yield* dictionary.readFulls,
          groups,
          decisions,
          resourceOrigins: yield* dictionary.resourceOrigins,
          last: yield* dictionary.currentResource(last),
          detachedCitations: yield* dictionary.detachedCitations,
        }).pipe(Effect.mapError(invalid));
        const json = yield* S.encodeEffect(CapturedJson)({
          ...result,
          mentions: A.map(result.mentions, captureCitationMentionReceiptData),
        }).pipe(Effect.mapError(invalid));
        issuedSessions.set(result, {
          json,
          anchors: A.map(result.mentions, (mention) => ({
            anchor: mention.anchor,
            components: A.map(mention.components, (component) => component.anchor),
            footnote: O.map(mention.footnote, (zone) => zone.anchor),
          })),
        });
        return result;
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
