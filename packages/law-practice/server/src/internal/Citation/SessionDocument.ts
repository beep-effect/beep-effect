/**
 * Document/expectation production from an issued callback execution snapshot.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationAmbiguous,
  CitationAuthority,
  CitationDocument,
  CitationMemberList,
  CitationMemberListId,
  CitationResolved,
  CitationResourceGroup,
  CitationResourceGroupId,
  CitationUnresolved,
} from "@beep/law-practice-domain/values";
import { SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import * as A from "effect/Array";
import * as Chunk from "effect/Chunk";
import * as Context from "effect/Context";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { CitationCallbackFailure, readCapturedCitationSession } from "./CallbackSession.ts";
import { projectCitationDocumentReceipt } from "./Document.ts";
import {
  CitationResourceBinding,
  CitationResourceIdentity,
  makeCitationResourceAuthorityId,
} from "./ResourceIdentity.ts";
import type { CitationAuthorityId, CitationMentionId, CitationResolution } from "@beep/law-practice-domain/values";
import type { CitationCallbackResource } from "./CallbackResource.ts";

const CitationResourceIdentityType = S.toType(CitationResourceIdentity);
const CitationDocumentType = S.toType(CitationDocument);

const $I = $LawPracticeServerId.create("internal/Citation/SessionDocument");
/**
 * Trusted descriptor port selected by the server composition. It reads final
 * resource data without invoking native truth/hash/equality. Arbitrary native
 * identity production is not supplied by this projector or by request fields.
 * @internal
 * @category services
 * @since 0.0.0
 */
export class CitationSessionResourceDescriptors extends Context.Service<
  CitationSessionResourceDescriptors,
  {
    readonly describe: (
      resource: CitationCallbackResource
    ) => Effect.Effect<CitationResourceIdentity, CitationCallbackFailure>;
  }
>()($I`CitationSessionResourceDescriptors`) {}
const Node = S.fromJsonString(
  S.Tuple([S.tag("citation-session-node/v1"), SourceTextIdentity, Sha256Hex, S.Literals(["entry", "list"]), S.Natural])
);
const failed = () => CitationCallbackFailure.make({ reason: "identity-failed" });
const invalid = () => CitationCallbackFailure.make({ reason: "invalid-input" });
const limit = () => CitationCallbackFailure.make({ reason: "limit-exceeded" });
/**
 * Capture Crypto and a trusted pure descriptor port. The returned method has
 * R = never, consumes only an issued session, and produces both the document
 * and out-of-band expectations from the same sealed execution history.
 * None uses issued default branch observations when available; custom None
 * results without evidence retain callback-unresolved. Historical candidate
 * counts cannot certify that final descriptor labels remain distinct.
 * @internal
 * @category operations
 * @since 0.0.0
 */
export const makeCitationSessionDocumentProjector = Effect.fn("Citation.makeSessionDocumentProjector")(function* () {
  const crypto = yield* Digest.Digest;
  const descriptors = yield* CitationSessionResourceDescriptors;
  return {
    project: Effect.fn("Citation.projectCapturedSession")(
      function* (input: unknown) {
        const state = yield* readCapturedCitationSession(input);
        let authorities = Chunk.empty<CitationAuthority>();
        let identities = HashMap.empty<CitationAuthorityId, CitationResourceIdentity>();
        let decisionSets = HashMap.empty<CitationAuthorityId, Chunk.Chunk<CitationMentionId>>();
        let candidateSets = HashMap.empty<
          CitationAuthorityId,
          Chunk.Chunk<NonNullable<CitationResourceBinding["candidates"]>[number]>
        >();
        let groupSets = HashMap.empty<CitationAuthorityId, Chunk.Chunk<CitationResourceBinding["groups"][number]>>();
        let order = Chunk.empty<CitationAuthorityId>();
        let resolutions = Chunk.empty<CitationResolution>();
        let candidateEdges = 0;
        let memberLists = Chunk.empty<CitationMemberList>();
        let lists = HashMap.empty<number, CitationMemberList>();
        let groups = Chunk.empty<CitationResourceGroup>();
        let registered = HashMap.empty<string, CitationAuthorityId>();
        const membersEquivalent = S.toEquivalence(CitationMemberList.fields.members);
        const resolve = Effect.fn("Citation.projectResourceDescriptor")(function* (resource: CitationCallbackResource) {
          const reference =
            resource._tag === "Registered" ? O.some(`${resource.scope}:${resource.slot}`) : O.none<string>();
          const cached = O.flatMap(reference, (key) => HashMap.get(registered, key));
          if (O.isSome(cached)) return cached.value;
          const citationResult1 = yield* descriptors
            .describe(resource)
            .pipe(Effect.mapError((error) => (error.reason === "limit-exceeded" ? limit() : failed())));
          const identity = yield* S.decodeEffect(CitationResourceIdentityType)(citationResult1).pipe(
            Effect.mapError(failed)
          );
          const id = yield* makeCitationResourceAuthorityId(identity).pipe(Effect.mapError(failed));
          if (!HashMap.has(identities, id)) {
            if (Chunk.size(authorities) >= state.limits.authorities) return yield* limit();
            identities = HashMap.set(identities, id, identity);
            decisionSets = HashMap.set(decisionSets, id, Chunk.empty());
            candidateSets = HashMap.set(candidateSets, id, Chunk.empty());
            groupSets = HashMap.set(groupSets, id, Chunk.empty());
            order = Chunk.append(order, id);
            authorities = Chunk.append(authorities, CitationAuthority.make({ id, representative: O.none() }));
          }
          if (O.isSome(reference)) registered = HashMap.set(registered, reference.value, id);
          return id;
        });
        const nodeDigest = Effect.fn("Citation.projectSessionNode")(function* (kind: "entry" | "list", slot: number) {
          const text = yield* S.encodeEffect(Node)([
            "citation-session-node/v1",
            state.source,
            state.engineArtifact,
            kind,
            slot,
          ]).pipe(Effect.mapError(invalid));
          return yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(text)).pipe(
            Effect.mapError(failed),
            Effect.catchDefect(() => Effect.fail(failed()))
          );
        });
        const appendAmbiguous = Effect.fn("Citation.projectAmbiguousDecision")(function* (
          mentionId: CitationMentionId,
          resources: ReadonlyArray<CitationCallbackResource>
        ) {
          let seen = HashSet.empty<CitationAuthorityId>();
          let candidates = Chunk.empty<CitationAuthorityId>();
          const candidate = Effect.fn("Citation.projectAmbiguousCandidate")(function* (
            resource: CitationCallbackResource
          ) {
            const id = yield* resolve(resource);
            if (HashSet.has(seen, id)) return;
            if (candidateEdges >= state.limits.resolutionEdges) return yield* limit();
            candidateEdges += 1;
            seen = HashSet.add(seen, id);
            candidates = Chunk.append(candidates, id);
          });
          for (const resource of resources) yield* candidate(resource);
          // Final descriptors must support distinct authorities. A historical
          // native count cannot certify distinct final descriptor labels.
          if (Chunk.size(candidates) < 2) return yield* failed();
          for (const [id, position] of A.map(A.fromIterable(candidates), (id, position) => [id, position] as const)) {
            const positions = yield* Effect.fromOption(HashMap.get(candidateSets, id), failed);
            candidateSets = HashMap.set(candidateSets, id, Chunk.append(positions, { mentionId, position }));
          }
          resolutions = Chunk.append(
            resolutions,
            CitationAmbiguous.make({
              mentionId,
              candidateAuthorityIds: A.fromIterable(candidates),
              confidence: O.none(),
            })
          );
        });
        const unresolvedReason = (decision: (typeof state.decisions)[number]) => {
          if (decision.callback === "unknown") return "unsupported-citation";
          const observation = decision.observation;
          return O.isSome(observation) && observation.value._tag === "Unresolved"
            ? observation.value.reason
            : "callback-unresolved";
        };
        const appendDecision = Effect.fn("Citation.projectSessionDecision")(function* (
          decision: (typeof state.decisions)[number]
        ) {
          if (decision.resource._tag === "None") {
            const observation = decision.observation;
            if (O.isSome(observation) && observation.value._tag === "Ambiguous") {
              yield* appendAmbiguous(decision.mentionId, observation.value.resources);
              return;
            }
            resolutions = Chunk.append(
              resolutions,
              CitationUnresolved.make({
                mentionId: decision.mentionId,
                reason: unresolvedReason(decision),
              })
            );
            return;
          }
          const id = yield* resolve(decision.resource);
          const decisions = yield* Effect.fromOption(HashMap.get(decisionSets, id), failed);
          decisionSets = HashMap.set(decisionSets, id, Chunk.append(decisions, decision.mentionId));
          resolutions = Chunk.append(
            resolutions,
            CitationResolved.make({ mentionId: decision.mentionId, authorityId: id, confidence: O.none() })
          );
        });
        const appendGroup = Effect.fn("Citation.projectSessionGroup")(function* (
          entry: (typeof state.groups)[number],
          position: number
        ) {
          const id = yield* resolve(entry.resource);
          let list = HashMap.get(lists, entry.listSlot);
          if (O.isSome(list) && !membersEquivalent(list.value.members, entry.members)) return yield* invalid();
          if (O.isNone(list)) {
            if (Chunk.size(memberLists) >= state.limits.authorities) return yield* limit();
            const citationResult2 = yield* nodeDigest("list", entry.listSlot);
            const created = CitationMemberList.make({
              id: CitationMemberListId.make(`cl1:${citationResult2}`),
              members: entry.members,
            });
            list = O.some(created);
            lists = HashMap.set(lists, entry.listSlot, created);
            memberLists = Chunk.append(memberLists, created);
          }
          const value = yield* Effect.fromOption(list, failed);
          const citationResult3 = yield* nodeDigest("entry", entry.entrySlot);
          const group = CitationResourceGroup.make({
            id: CitationResourceGroupId.make(`cg1:${citationResult3}`),
            authorityId: id,
            memberListId: value.id,
          });
          groups = Chunk.append(groups, group);
          const expected = yield* Effect.fromOption(HashMap.get(groupSets, id), failed);
          groupSets = HashMap.set(groupSets, id, Chunk.append(expected, { position, id: group.id, list: value }));
        });
        for (const decision of state.decisions) yield* appendDecision(decision);
        for (const [position, entry] of A.map(state.groups, (entry, position) => [position, entry] as const))
          yield* appendGroup(entry, position);
        if (
          candidateEdges + A.reduce(A.fromIterable(memberLists), 0, (count, list) => count + A.length(list.members)) >
          state.limits.resolutionEdges
        )
          return yield* limit();
        const resourceBindings = yield* Effect.forEach(
          order,
          Effect.fnUntraced(function* (id) {
            const identity = yield* Effect.fromOption(HashMap.get(identities, id), failed);
            const decisions = yield* Effect.fromOption(HashMap.get(decisionSets, id), failed);
            const expected = yield* Effect.fromOption(HashMap.get(groupSets, id), failed);
            const citationResult4 = yield* Effect.fromOption(HashMap.get(candidateSets, id), failed);
            return CitationResourceBinding.make({
              identity,
              decisions: A.fromIterable(decisions),
              candidates: A.fromIterable(citationResult4),
              groups: A.fromIterable(expected),
            });
          })
        );
        const document = yield* S.decodeUnknownEffect(CitationDocumentType)({
          source: state.source,
          engineArtifact: state.engineArtifact,
          mentions: state.mentions,
          authorities: A.fromIterable(authorities),
          resolutions: A.fromIterable(resolutions),
          groups: A.fromIterable(groups),
          memberLists: A.fromIterable(memberLists),
          detachedCitations: state.detachedCitations,
        }).pipe(Effect.mapError(invalid));
        const receipt = yield* projectCitationDocumentReceipt({
          document,
          editions: state.editions,
          resourceBindings,
        }).pipe(Effect.mapError(failed));
        return { document, receipt, resourceBindings };
      },
      Effect.provideService(Digest.Digest, crypto)
    ),
  };
});
