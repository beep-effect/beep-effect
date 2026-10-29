/**
 * Ordered callback session adapted from eyecite 2.7.6 resolve.py.
 * Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationMention, CitationMentionId, FullCitation } from "@beep/law-practice-domain/values";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as S from "effect/Schema";
import { PreparedCitationResolution, prepareCitationResolution } from "./ResolutionInput.ts";
import { CitationResourceIdentity, makeCitationResourceAuthorityId } from "./ResourceIdentity.ts";
import type * as Crypto from "effect/Crypto";

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
 * Prior full-list entry references the original verified occurrence.
 * @internal
 * @category models
 * @since 0.0.0
 */
export const CitationCallbackFull = S.Struct({ mentionId: CitationMentionId, resource: CitationCallbackResource }).pipe(
  $I.annoteSchema("CitationCallbackFull", {
    description: "Private prior-full occurrence/resource pair, including falsy resource values.",
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
  members: S.Array(CitationMentionId),
}).pipe(
  $I.annoteSchema("CitationCallbackGroup", {
    description: "Private callback dictionary entry preserving first key presentation and member order.",
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
 * Explicit dictionary mutation plus Id. callback result.
 * @internal
 * @category models
 * @since 0.0.0
 */
export const CitationIdCallbackOutput = S.Struct({
  resource: CitationCallbackResource,
  groups: S.Array(CitationCallbackGroup),
}).pipe(
  $I.annoteSchema("CitationIdCallbackOutput", {
    description: "Replacement shared resource groups and current Id. result.",
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
 * Captured private callbacks; callable behavior is a service, never request
 * data. Every callback captures its dependencies and returns R = never.
 * This protocol covers explicit list/dictionary transitions; arbitrary source
 * model mutation, alias identity and public port publication need more proof.
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
const callbackFailed = () => CitationCallbackFailure.make({ reason: "callback-failed" });
const limit = () => CitationCallbackFailure.make({ reason: "limit-exceeded" });

/**
 * Execute source-order callback dispatch over independently verified mentions.
 * Full results enter the prior-full list even when falsy. Callback updates
 * precede current-result grouping; equal keys retain the first presentation.
 * This private session result is not yet the final CitationDocument projection.
 * @internal
 * @category operations
 * @since 0.0.0
 */
export const runCitationCallbackSession = Effect.fn("Citation.runCallbackSession")(function* (
  input: unknown
): Effect.fn.Return<typeof SessionState.Type, CitationCallbackFailure, Crypto.Crypto | CitationResolutionCallbacks> {
  const prepared = yield* prepareCitationResolution(input).pipe(
    Effect.mapError((error) => CitationCallbackFailure.make({ reason: error.reason }))
  );
  const callbacks = yield* CitationResolutionCallbacks;
  const known = HashSet.fromIterable(A.map(prepared.mentions, (mention) => mention.id));
  const fullIds = HashSet.fromIterable(
    A.map(
      A.filter(prepared.mentions, (mention) => isFull(mention.citation)),
      (mention) => mention.id
    )
  );
  let fulls: ReadonlyArray<CitationCallbackFull> = [];
  let groups: ReadonlyArray<CitationCallbackGroup> = [];
  let last: CitationCallbackResource = CitationCallbackResource.cases.None.make({});
  let iterations = 0;
  const step = Effect.suspend(() => {
    if (iterations >= prepared.limits.resolutionIterations) return Effect.fail(limit());
    iterations += 1;
    return Effect.void;
  });
  const key = Effect.fn("Citation.callbackResourceKey")(function* (resource: CitationCallbackResource) {
    if (resource._tag === "Unhashable") return yield* CitationCallbackFailure.make({ reason: "unhashable-resource" });
    if (resource._tag === "None") return "none";
    return yield* makeCitationResourceAuthorityId(resource.identity).pipe(
      Effect.mapError(() => CitationCallbackFailure.make({ reason: "identity-failed" }))
    );
  });
  for (const mention of prepared.mentions) {
    yield* step;
    if (isFull(mention.citation)) {
      const result = yield* callbacks.full(mention).pipe(Effect.mapError(callbackFailed));
      last = yield* S.decodeEffect(ResourceJson)(
        yield* S.encodeEffect(ResourceJson)(result).pipe(Effect.mapError(invalid))
      ).pipe(Effect.mapError(invalid));
      fulls = A.append(fulls, { mentionId: mention.id, resource: last });
    } else if (mention.citation.type === "id") {
      const result: CitationIdCallbackOutput = yield* callbacks
        .id({ mention, last, groups })
        .pipe(Effect.mapError(callbackFailed));
      if (
        A.length(result.groups) > prepared.limits.authorities ||
        A.reduce(result.groups, 0, (count, group) => count + A.length(group.members)) > prepared.limits.resolutionEdges
      )
        return yield* limit();
      const snapshot: CitationIdCallbackOutput = yield* S.decodeEffect(IdJson)(
        yield* S.encodeEffect(IdJson)(result).pipe(Effect.mapError(invalid))
      ).pipe(Effect.mapError(invalid));
      groups = snapshot.groups;
      let groupKeys = HashSet.empty<string>();
      for (const group of groups) {
        yield* step;
        const id = yield* key(group.resource);
        if (HashSet.has(groupKeys, id)) return yield* invalid();
        groupKeys = HashSet.add(groupKeys, id);
      }
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
    if (A.length(fulls) > prepared.limits.mentions || A.length(groups) > prepared.limits.authorities)
      return yield* limit();
    if (!A.every(fulls, (entry) => HashSet.has(fullIds, entry.mentionId))) return yield* invalid();
    if (!A.every(groups, (group) => A.every(group.members, (id) => HashSet.has(known, id)))) return yield* invalid();
    if (last._tag !== "None" && last.truthy) {
      const id = yield* key(last);
      let found = false;
      let updated = A.empty<CitationCallbackGroup>();
      for (const group of groups) {
        yield* step;
        if ((yield* key(group.resource)) === id) {
          found = true;
          updated = A.append(updated, { ...group, members: A.append(group.members, mention.id) });
        } else updated = A.append(updated, group);
      }
      if (!found) updated = A.append(updated, { resource: last, members: [mention.id] });
      groups = updated;
    }
    if (
      A.length(groups) > prepared.limits.authorities ||
      A.reduce(groups, 0, (count, group) => count + A.length(group.members)) > prepared.limits.resolutionEdges
    )
      return yield* limit();
  }
  return yield* S.decodeEffect(S.toType(SessionState))({ ...prepared, fulls, groups, last }).pipe(
    Effect.mapError(invalid)
  );
});
