import { fileURLToPath } from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  Citation,
  CitationAuthority,
  CitationDetached,
  CitationDetachedId,
  CitationDocument,
  CitationDocumentReceipt,
  CitationGroupMember,
  CitationMemberList,
  CitationMemberListId,
  CitationMention,
  CitationResourceGroup,
  CitationUnresolved,
  citationAuthorityMembers,
} from "@beep/law-practice-domain/values";
import {
  CitationCallbackDictionary,
  CitationCallbackFailure,
  CitationResolutionCallbacks,
  CitationResolutionWork,
  makeCitationCallbackDictionary,
  makeCitationResolutionWork,
  runPreparedCitationCallbackSession,
} from "@beep/law-practice-server/_test/Citation/CallbackSession";
import { makeDefaultCitationResolutionCallbacks } from "@beep/law-practice-server/_test/Citation/DefaultCallbacks";
import { projectCitationDocumentReceipt } from "@beep/law-practice-server/_test/Citation/Document";
import { prepareCitationResolution } from "@beep/law-practice-server/_test/Citation/ResolutionInput";
import {
  CitationResourceBinding,
  CitationResourceIdentity,
  makeCitationResourceAuthorityId,
} from "@beep/law-practice-server/_test/Citation/ResourceIdentity";
import { LiteralKit, Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import {
  CitationCallbackObservation,
  callbackNoneResource as none,
  prepareCallbackObservation,
  callbackResourcePresentation as presentation,
  normalizeCallbackFixtureResource as resource,
} from "./CitationCallbackSession.fixtures.ts";
import type {
  CitationCallbackGroup,
  CitationCallbackResource,
  CitationFullsCallbackInput,
  CitationIdCallbackInput,
} from "@beep/law-practice-server/_test/Citation/CallbackSession";

const $I = $LawPracticeServerId.create("test/CitationCallbackMutations");
const KnownMutation = LiteralKit([
  "create-empty",
  "clear-groups",
  "move-members",
  "reverse-members",
  "duplicate-prior",
  "copy-to-second",
  "falsy-key",
  "none-key",
  "insert-current",
  "read-missing-default",
  "alias-member-lists",
  "dictionary-identity",
  "retained-dictionary-full",
  "detached-member",
  "append-detached-full",
  "replace-detached-full",
]).pipe(
  $I.annoteSchema("KnownMutation", {
    description: "Sixteen focused dictionary/list/detached scenes; general host/model mutation remains separate.",
  })
);
type KnownMutation = typeof KnownMutation.Type;
const Member = S.Union([
  S.Struct({ kind: S.tag("input"), index: S.Natural }),
  S.Struct({ kind: S.tag("detached"), slot: S.Natural }),
]).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("Member", {
    description: "Source object reference, without inventing evidence for a detached citation.",
  })
);
const Group = S.Struct({ resource: S.Json, listSlot: S.Natural, members: S.Array(Member) }).pipe(
  $I.annoteSchema("Group", {
    description: "Source group with explicit test-local list identity and ordered member references.",
  })
);
const Row = S.Struct({
  name: S.NonEmptyString,
  family: S.Literals(["known-group", "alias", "detached-member", "detached-prior-full"]),
  kinds: S.Array(S.Literals(["case", "id", "supra"])),
  events: S.Array(S.Json),
  detachedObjects: S.Array(
    S.Struct({
      slot: S.Natural,
      citationType: S.Literal("FullCaseCitation"),
      groups: S.Struct({ volume: S.String, reporter: S.String, page: S.String }),
      metadata: S.Struct({ plaintiff: S.String }),
    })
  ),
  outcome: S.Struct({ status: S.tag("value"), groups: S.Array(Group) }),
}).pipe(
  $I.annoteSchema("Row", { description: "Pinned source mutation scene; only the stated family is target-tested here." })
);
const Corpus = S.Struct({
  schemaVersion: S.tag("citation-callback-mutation-observations/v1"),
  cases: S.Array(Row),
}).pipe(
  $I.annoteSchema("Corpus", { description: "All sixteen mutation scenes retained independently of target coverage." })
);
const invalid = () => CitationCallbackFailure.make({ reason: "invalid-input" });

it.layer(Layer.mergeAll(BunCrypto.layer, BunFileSystem.layer))("callback mutation group values", (it) => {
  it.effect("preserves all sixteen dictionary/list/detached observations and complete callback event traces", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const raw = yield* fs.readFileString(
        fileURLToPath(
          new URL("../../use-cases/test/fixtures/eyecite/callback-mutation-observations.json", import.meta.url)
        )
      );
      expect(yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(raw))).toBe(
        "26e81eae9bfcd03ef2370be5d22f7241d96eea18591df602cced8dbc12540a63"
      );
      const data = yield* S.decodeEffect(S.fromJsonString(Corpus))(raw);
      expect(A.length(data.cases)).toBe(16);
      expect(A.reduce(data.cases, 0, (count, row) => count + A.length(row.kinds))).toBe(38);
      const rows = data.cases;
      expect(A.length(rows)).toBe(16);
      expect(A.length(A.filter(data.cases, (row) => row.family === "alias"))).toBe(3);
      expect(A.length(A.filter(data.cases, (row) => row.family === "detached-member"))).toBe(1);
      expect(A.length(A.filter(data.cases, (row) => row.family === "detached-prior-full"))).toBe(2);
      expect(
        A.sort(
          A.map(rows, (row) => row.name),
          Order.String
        )
      ).toEqual(A.sort(KnownMutation.literals, Order.String));
      for (const row of rows) {
        const action = yield* S.decodeUnknownEffect(KnownMutation)(row.name);
        let input = yield* prepareCallbackObservation(
          CitationCallbackObservation.make({
            name: `mutation-${row.name}`,
            kinds: row.kinds,
            pages: {},
            bindings: {},
            events: [],
            outcome: { status: "value", groups: [] },
          })
        );
        if (row.family === "detached-prior-full") {
          const mentions = yield* Effect.forEach(input.mentions, (mention) =>
            Effect.gen(function* () {
              const wire = yield* S.encodeEffect(Citation)(mention.citation);
              if (wire.type !== "supra") return mention;
              const citation = yield* S.decodeEffect(Citation)({
                ...wire,
                metadata: { ...wire.metadata, antecedentGuess: "Detached" },
              });
              return CitationMention.make({ ...mention, citation });
            })
          );
          input = { ...input, mentions };
        }
        const prepared = yield* prepareCitationResolution(input);
        const work = yield* makeCitationResolutionWork(prepared.limits);
        const dictionary = yield* makeCitationCallbackDictionary(prepared).pipe(
          Effect.provideService(CitationResolutionWork, work)
        );
        let retained: O.Option<typeof dictionary> = O.none();
        let dictionaries = A.empty<typeof dictionary>();
        const dictionarySlot = (value: typeof dictionary) => {
          const found = A.findFirstIndex(dictionaries, (entry) => entry === value);
          if (O.isSome(found)) return found.value;
          const slot = A.length(dictionaries);
          dictionaries = A.append(dictionaries, value);
          return slot;
        };
        let events = A.empty<S.Json>();
        const indexOf = (id: (typeof prepared.mentions)[number]["id"]) =>
          A.findFirstIndex(prepared.mentions, (mention) => mention.id === id).pipe(O.getOrElse(() => -1));
        const member = (mentionId: (typeof prepared.mentions)[number]["id"]) =>
          CitationGroupMember.cases.Mention.make({ mentionId });
        let detachedReferences = A.empty<CitationGroupMember>();
        const memberView = (reference: CitationGroupMember): typeof Member.Type =>
          reference._tag === "Mention"
            ? Member.cases.input.make({ index: indexOf(reference.mentionId) })
            : Member.cases.detached.make({
                slot: O.getOrElse(
                  A.findFirstIndex(
                    detachedReferences,
                    (value) => value._tag === "Detached" && value.detachedId === reference.detachedId
                  ),
                  () => -1
                ),
              });
        const groupView = (groups: ReadonlyArray<CitationCallbackGroup>) =>
          A.map(groups, (group) => ({
            resource: presentation(group.resource),
            listSlot: group.listSlot,
            members: A.map(group.members, memberView),
          }));
        const defaults = yield* makeDefaultCitationResolutionCallbacks(prepared).pipe(
          Effect.provideService(CitationCallbackDictionary, dictionary),
          Effect.provideService(CitationResolutionWork, work)
        );
        const baseResource = yield* resource("base");
        const emptyResource = yield* resource("empty");
        const movedResource = yield* resource("moved");
        const otherResource = yield* resource("other");
        const zeroResource = yield* resource(0);
        const unusedResource = yield* resource("unused");
        const foreignResource = yield* resource("foreign");
        const originalWire = yield* S.encodeEffect(Citation)(A.getUnsafe(prepared.mentions, 0).citation);
        if (originalWire.type !== "case") return yield* invalid();
        const detachedModel = yield* S.decodeEffect(Citation)({
          ...originalWire,
          components: { volume: "9", reporter: "U.S.", page: "9" },
          metadata: { ...originalWire.metadata, plaintiff: "Detached" },
        });
        const registerDetached = Effect.fn("MutationTest.detached")(function* () {
          const reference = yield* dictionary.registerDetached(detachedModel);
          if (!A.contains(detachedReferences, reference)) detachedReferences = A.append(detachedReferences, reference);
          return reference;
        });
        const callbacks = CitationResolutionCallbacks.of({
          ...defaults,
          full: Effect.fn("MutationTest.full")(function* (mention: (typeof prepared.mentions)[number]) {
            let event: S.Json = { slot: "full", mention: { kind: "input", index: indexOf(mention.id) } };
            if (action === "retained-dictionary-full" && O.isSome(retained)) {
              yield* retained.value.clear;
              event = {
                slot: "full",
                mention: { kind: "input", index: indexOf(mention.id) },
                clearedDictionarySlot: dictionarySlot(retained.value),
              };
            }
            events = A.append(events, event);
            return baseResource;
          }),
          supra: Effect.fn("MutationTest.supra")(function* (arg: CitationFullsCallbackInput) {
            const before = A.map(arg.fulls, (entry) => ({
              citation: memberView(entry.citation),
              resource: presentation(entry.resource),
            }));
            const reference = yield* registerDetached();
            const fulls =
              action === "append-detached-full"
                ? A.append(arg.fulls, { citation: reference, resource: foreignResource })
                : [{ citation: reference, resource: baseResource }];
            const output = yield* defaults.supra({ ...arg, fulls });
            events = A.append(events, {
              slot: "supra",
              mention: { kind: "input", index: indexOf(arg.mention.id) },
              before,
              after: A.map(output.fulls, (entry) => ({
                citation: memberView(entry.citation),
                resource: presentation(entry.resource),
              })),
            });
            return output;
          }),
          id: Effect.fn("MutationTest.id")(function* (arg: CitationIdCallbackInput) {
            const before = groupView(arg.groups);
            const base = yield* Effect.fromOption(A.head(arg.groups), invalid);
            const first = member(A.getUnsafe(prepared.mentions, 0).id);
            const baseList = yield* dictionary.get(baseResource);
            let result: CitationCallbackResource = none();
            const apply = Match.type<KnownMutation>().pipe(
              Match.when("create-empty", () => dictionary.get(emptyResource).pipe(Effect.asVoid)),
              Match.when("clear-groups", () => dictionary.clear),
              Match.when("move-members", () =>
                Effect.gen(function* () {
                  yield* dictionary.remove(baseResource);
                  yield* dictionary.set(movedResource, baseList);
                  result = movedResource;
                })
              ),
              Match.when("reverse-members", () =>
                dictionary.write(baseList, A.reverse(base.members)).pipe(
                  Effect.andThen(
                    Effect.sync(() => {
                      result = baseResource;
                    })
                  )
                )
              ),
              Match.when("duplicate-prior", () =>
                dictionary.write(baseList, A.append(base.members, first)).pipe(
                  Effect.andThen(
                    Effect.sync(() => {
                      result = baseResource;
                    })
                  )
                )
              ),
              Match.when("copy-to-second", () =>
                Effect.gen(function* () {
                  yield* dictionary.set(otherResource, yield* dictionary.allocate([first]));
                  result = baseResource;
                })
              ),
              Match.when("falsy-key", () => dictionary.get(zeroResource).pipe(Effect.asVoid)),
              Match.when("none-key", () =>
                Effect.gen(function* () {
                  yield* dictionary.set(none(), yield* dictionary.allocate([first]));
                })
              ),
              Match.when("insert-current", () =>
                dictionary.write(baseList, A.append(base.members, member(arg.mention.id))).pipe(
                  Effect.andThen(
                    Effect.sync(() => {
                      result = baseResource;
                    })
                  )
                )
              ),
              Match.when("read-missing-default", () =>
                Effect.gen(function* () {
                  yield* dictionary.get(unusedResource);
                  result = (yield* defaults.id({ ...arg, groups: yield* dictionary.read })).resource;
                })
              ),
              Match.when("alias-member-lists", () =>
                dictionary.set(otherResource, baseList).pipe(
                  Effect.andThen(
                    Effect.sync(() => {
                      result = baseResource;
                    })
                  )
                )
              ),
              Match.when(
                Match.is(
                  "dictionary-identity",
                  "retained-dictionary-full",
                  "append-detached-full",
                  "replace-detached-full"
                ),
                () =>
                  Effect.gen(function* () {
                    result = (yield* defaults.id(arg)).resource;
                  })
              ),
              Match.when("detached-member", () =>
                Effect.gen(function* () {
                  const reference = yield* registerDetached();
                  yield* dictionary.set(otherResource, yield* dictionary.allocate([reference]));
                })
              ),
              Match.exhaustive
            );
            yield* apply(action);
            const common = {
              slot: "id",
              mention: { kind: "input", index: indexOf(arg.mention.id) },
              last: presentation(arg.last),
              dictionarySlot: dictionarySlot(dictionary),
              before,
              after: groupView(yield* dictionary.read),
            };
            if (action === "dictionary-identity" || action === "retained-dictionary-full") {
              events = A.append(events, {
                ...common,
                retainedDictionaryMatches: O.isNone(retained) ? null : retained.value === dictionary,
              });
              retained = O.some(dictionary);
            } else events = A.append(events, common);
            return { resource: result };
          }),
        });
        const result = yield* runPreparedCitationCallbackSession(prepared).pipe(
          Effect.provideService(CitationResolutionWork, work),
          Effect.provideService(CitationCallbackDictionary, dictionary),
          Effect.provideService(CitationResolutionCallbacks, callbacks)
        );
        expect(groupView(result.groups), row.name).toEqual(row.outcome.groups);
        expect(events, row.name).toEqual(row.events);
        const detachedObjects = yield* Effect.forEach(result.detachedCitations, (object) =>
          Effect.gen(function* () {
            const reference = CitationGroupMember.cases.Detached.make({ detachedId: object.id });
            const view = memberView(reference);
            const wire = yield* S.encodeEffect(Citation)(object.citation);
            expect(wire.type).toBe("case");
            expect("anchor" in object).toBe(false);
            expect("mentionId" in object).toBe(false);
            return {
              slot: "slot" in view ? view.slot : -1,
              citationType: "FullCaseCitation",
              groups: wire.components,
              metadata: { plaintiff: "plaintiff" in wire.metadata ? wire.metadata.plaintiff : null },
            };
          })
        );
        expect(detachedObjects, row.name).toEqual(row.detachedObjects);
      }
    })
  );
  it.effect(
    "encodes all sixteen source group snapshots including list aliases and detached nodes without claiming callback execution",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const raw = yield* fs.readFileString(
          fileURLToPath(
            new URL("../../use-cases/test/fixtures/eyecite/callback-mutation-observations.json", import.meta.url)
          )
        );
        const data = yield* S.decodeEffect(S.fromJsonString(Corpus))(raw);
        expect(data.cases).toHaveLength(16);
        for (const row of data.cases) {
          const input = yield* prepareCallbackObservation(
            CitationCallbackObservation.make({
              name: `codec-${row.name}`,
              kinds: row.kinds,
              pages: {},
              bindings: {},
              events: [],
              outcome: { status: "value", groups: [] },
            })
          );
          const prepared = yield* prepareCitationResolution(input);
          // IDs here encode source fixture slots, not a production alias issuer.
          const listId = (slot: number) => CitationMemberListId.make(`cl1:${Str.padStart(64, "0")(`${slot}`)}`);
          const detachedId = (slot: number) => CitationDetachedId.make(`cd1:${Str.padStart(64, "0")(`${slot}`)}`);
          const toMember = (value: typeof Member.Type) =>
            Member.match(value, {
              input: (value) =>
                CitationGroupMember.cases.Mention.make({ mentionId: A.getUnsafe(prepared.mentions, value.index).id }),
              detached: (value) => CitationGroupMember.cases.Detached.make({ detachedId: detachedId(value.slot) }),
            });
          const detachedCitations = yield* Effect.forEach(row.detachedObjects, (object) =>
            Effect.gen(function* () {
              const wire = yield* S.encodeEffect(Citation)(A.getUnsafe(prepared.mentions, 0).citation);
              if (wire.type !== "case") return yield* invalid();
              const citation = yield* S.decodeEffect(Citation)({
                ...wire,
                components: object.groups,
                metadata: { ...wire.metadata, plaintiff: object.metadata.plaintiff },
              });
              return CitationDetached.make({ id: detachedId(object.slot), citation });
            })
          );
          const nodes = yield* Effect.forEach(row.outcome.groups, (group, index) =>
            Effect.gen(function* () {
              const key = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(`${row.name}:${index}`));
              const identity = CitationResourceIdentity.cases.External.make({ scope: prepared.engineArtifact, key });
              const id = yield* makeCitationResourceAuthorityId(identity);
              const list = CitationMemberList.make({
                id: listId(group.listSlot),
                members: A.map(group.members, toMember),
              });
              return {
                authority: CitationAuthority.make({ id, representative: O.none() }),
                group: CitationResourceGroup.make({ authorityId: id, memberListId: list.id }),
                list,
                binding: CitationResourceBinding.make({ identity, decisions: [], group: O.some(list) }),
              };
            })
          );
          const document = CitationDocument.make({
            source: prepared.source,
            engineArtifact: prepared.engineArtifact,
            mentions: prepared.mentions,
            authorities: A.map(nodes, (node) => node.authority),
            groups: A.map(nodes, (node) => node.group),
            memberLists: A.dedupeWith(
              A.map(nodes, (node) => node.list),
              (left, right) => left.id === right.id
            ),
            detachedCitations,
            resolutions: A.map(prepared.mentions, (mention) =>
              CitationUnresolved.make({ mentionId: mention.id, reason: "unsupported-citation" })
            ),
          });
          // Decisions are explicit placeholders: this lane proves representability,
          // not resolution inference or live dictionary/list mutation fidelity.
          const receipt = yield* projectCitationDocumentReceipt({
            document,
            editions: [],
            resourceBindings: A.map(nodes, (node) => node.binding),
          });
          const codec = S.fromJsonString(CitationDocumentReceipt);
          const restored = yield* S.decodeEffect(codec)(yield* S.encodeEffect(codec)(receipt));
          expect(restored.groups, row.name).toEqual(document.groups);
          expect(restored.memberLists, row.name).toEqual(document.memberLists);
          expect(restored.detachedCitations, row.name).toEqual(detachedCitations);
          for (const [index, node] of A.map(nodes, (node, index) => Tuple.make(index, node))) {
            expect(citationAuthorityMembers(restored, node.authority.id), row.name).toEqual(
              A.map(A.getUnsafe(row.outcome.groups, index).members, toMember)
            );
            expect(
              citationAuthorityMembers({ ...restored, mentions: A.reverse(restored.mentions) }, node.authority.id),
              row.name
            ).toEqual(node.list.members);
          }
        }
      })
  );
});
