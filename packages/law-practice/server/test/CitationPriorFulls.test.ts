import { fileURLToPath } from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { Citation, CitationGroupMember, CitationMention } from "@beep/law-practice-domain/values";
import { Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  CitationCallbackDictionary,
  CitationCallbackFailure,
  CitationResolutionCallbacks,
  CitationResolutionWork,
  makeCitationCallbackDictionary,
  makeCitationResolutionWork,
  runPreparedCitationCallbackSession,
} from "../src/internal/Citation/CallbackSession.ts";
import { makeDefaultCitationResolutionCallbacks } from "../src/internal/Citation/DefaultCallbacks.ts";
import { prepareCitationResolution } from "../src/internal/Citation/ResolutionInput.ts";
import {
  CitationCallbackObservation,
  callbackResourcePresentation,
  normalizeCallbackFixtureResource,
  prepareCallbackObservation,
} from "./CitationCallbackSession.fixtures.ts";
import type {
  CitationCallbackFull,
  CitationCallbackResource,
  CitationFullsCallbackInput,
  CitationIdCallbackInput,
} from "../src/internal/Citation/CallbackSession.ts";

const $I = $LawPracticeServerId.create("test/CitationPriorFulls");
const Row = S.Struct({
  name: S.NonEmptyString,
  kinds: S.Array(S.Literals(["case", "supra", "short", "reference", "id"])),
  events: S.Array(S.Json),
  outcome: S.Struct({
    groups: S.Array(S.Struct({ resource: S.String, members: S.Array(S.Natural) })),
    fulls: S.Array(S.Json),
  }),
}).pipe(
  $I.annoteSchema("Row", {
    description: "Frozen prior-full list and immutable-pair source observation, not extraction proof.",
  })
);
const Corpus = S.Struct({ schemaVersion: S.tag("citation-prior-full-observations/v1"), cases: S.Array(Row) }).pipe(
  $I.annoteSchema("Corpus", { description: "All eight retained prior-full-list scenes." })
);
const Presentation = S.Struct({ kind: S.String, value: S.Json }).pipe(
  $I.annoteSchema("Presentation", {
    description: "Finite fixture resource presentation; not a production host normalizer.",
  })
);
const resourceValue = (resource: CitationCallbackResource): S.Json => {
  const value = callbackResourcePresentation(resource);
  return S.is(Presentation)(value) ? value.value : null;
};
const invalid = () => CitationCallbackFailure.make({ reason: "invalid-input" });

it.layer(Layer.mergeAll(BunCrypto.layer, BunFileSystem.layer))("retained prior-full context", (it) => {
  it.effect("matches all eight source list/pair identity traces and final groups", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const raw = yield* fs.readFileString(
        fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/prior-full-observations.json", import.meta.url))
      );
      expect(yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(raw))).toBe(
        "191b4e7f872ffb886f2532aba1a4fc68f25a5022141df7207197906d49c9b2ac"
      );
      const data = yield* S.decodeEffect(S.fromJsonString(Corpus))(raw);
      expect(data.cases).toHaveLength(8);
      expect(A.reduce(data.cases, 0, (count, row) => count + A.length(row.events))).toBe(31);
      expect(A.map(data.cases, (row) => row.name)).toEqual([
        "list-identity",
        "retained-sees-full-append",
        "retained-clear-from-full",
        "retained-reverse-from-full",
        "retained-insert-current-full",
        "retained-clear-from-id",
        "replace-first-entry",
        "equal-replace-pair",
      ]);
      for (const row of data.cases) {
        const input = yield* prepareCallbackObservation(
          CitationCallbackObservation.make({
            name: `prior-fulls-${row.name}`,
            kinds: row.kinds,
            pages: {},
            bindings: {},
            events: [],
            outcome: { status: "value", groups: [] },
          })
        );
        const mentions = yield* Effect.forEach(input.mentions, (mention) =>
          Effect.gen(function* () {
            const wire = yield* S.encodeEffect(Citation)(mention.citation);
            if (wire.type !== "reference") return mention;
            const citation = yield* S.decodeEffect(Citation)({
              ...wire,
              metadata: {
                pinCite: null,
                parenthetical: null,
                plaintiff: "Smith",
                defendant: null,
                shortCaseName: null,
                caseName: null,
              },
            });
            return CitationMention.make({ ...mention, citation });
          })
        );
        const prepared = yield* prepareCitationResolution({ ...input, mentions });
        const work = yield* makeCitationResolutionWork(prepared.limits);
        const owner = yield* makeCitationCallbackDictionary(prepared).pipe(
          Effect.provideService(CitationResolutionWork, work)
        );
        const defaults = yield* makeDefaultCitationResolutionCallbacks(prepared).pipe(
          Effect.provideService(CitationResolutionWork, work),
          Effect.provideService(CitationCallbackDictionary, owner)
        );
        const base = yield* normalizeCallbackFixtureResource("base");
        const foreign = yield* normalizeCallbackFixtureResource("foreign");
        const indexOf = (id: (typeof prepared.mentions)[number]["id"]) =>
          O.getOrElse(
            A.findFirstIndex(prepared.mentions, (mention) => mention.id === id),
            () => -1
          );
        let pairSlots = A.empty<number>();
        const pairSlot = (value: number) => {
          const found = A.findFirstIndex(pairSlots, (slot) => slot === value);
          if (O.isSome(found)) return found.value;
          const slot = A.length(pairSlots);
          pairSlots = A.append(pairSlots, value);
          return slot;
        };
        let owners = A.empty<typeof owner>();
        const listSlot = (value: typeof owner) => {
          const found = A.findFirstIndex(owners, (entry) => entry === value);
          if (O.isSome(found)) return found.value;
          const slot = A.length(owners);
          owners = A.append(owners, value);
          return slot;
        };
        const pairView = (pair: CitationCallbackFull) => ({
          pairSlot: pairSlot(pair.pairSlot),
          mention: pair.citation._tag === "Mention" ? indexOf(pair.citation.mentionId) : -1,
          resource: resourceValue(pair.resource),
        });
        const fullsView = (fulls: ReadonlyArray<CitationCallbackFull>) => A.map(fulls, pairView);
        let retained: O.Option<typeof owner> = O.none();
        let retainedPair: O.Option<CitationCallbackFull> = O.none();
        let events = A.empty<S.Json>();
        const contextual = Effect.fn("PriorFullTest.contextual")(function* (arg: CitationFullsCallbackInput) {
          const before = fullsView(arg.fulls);
          const retainedListMatches = O.isNone(retained) ? null : retained.value === owner;
          retained = O.some(owner);
          if ((row.name === "replace-first-entry" || row.name === "equal-replace-pair") && O.isNone(retainedPair)) {
            const first = yield* Effect.fromOption(A.head(arg.fulls), invalid);
            retainedPair = O.some(first);
            const replacement = yield* owner.createFullPair(
              first.citation,
              row.name === "replace-first-entry" ? foreign : base
            );
            yield* owner.writeFulls(A.prepend(A.drop(arg.fulls, 1), replacement));
          }
          const fulls = yield* owner.readFulls;
          const current = { ...arg, fulls };
          const output = yield* arg.mention.citation.type === "supra"
            ? defaults.supra(current)
            : arg.mention.citation.type === "shortFormCase"
              ? defaults.shortCase(current)
              : defaults.reference(current);
          const common = {
            slot: A.getUnsafe(row.kinds, indexOf(arg.mention.id)),
            mention: indexOf(arg.mention.id),
            listSlot: listSlot(owner),
            before,
            retainedListMatches,
            after: fullsView(yield* owner.readFulls),
            result: resourceValue(output.resource),
          };
          if (O.isSome(retainedPair)) {
            const first = yield* Effect.fromOption(A.head(fulls), invalid);
            events = A.append(events, {
              ...common,
              retainedPair: pairView(retainedPair.value),
              retainedPairMatchesFirst: retainedPair.value.pairSlot === first.pairSlot,
            });
          } else events = A.append(events, common);
          return output;
        });
        const callbacks = CitationResolutionCallbacks.of({
          ...defaults,
          shortCase: contextual,
          supra: contextual,
          reference: contextual,
          full: Effect.fn("PriorFullTest.full")(function* (mention: (typeof prepared.mentions)[number]) {
            let event: S.Json = { slot: "full", mention: indexOf(mention.id) };
            if (O.isSome(retained)) {
              const before = fullsView(yield* retained.value.readFulls);
              if (row.name === "retained-clear-from-full") yield* retained.value.writeFulls([]);
              if (row.name === "retained-reverse-from-full")
                yield* retained.value.writeFulls(A.reverse(yield* retained.value.readFulls));
              if (row.name === "retained-insert-current-full") {
                const reference = CitationGroupMember.cases.Mention.make({ mentionId: mention.id });
                const pair = yield* retained.value.createFullPair(reference, foreign);
                yield* retained.value.writeFulls(A.append(yield* retained.value.readFulls, pair));
              }
              event = {
                slot: "full",
                mention: indexOf(mention.id),
                retainedListSlot: listSlot(retained.value),
                before,
                after: fullsView(yield* retained.value.readFulls),
              };
            }
            events = A.append(events, event);
            return base;
          }),
          id: Effect.fn("PriorFullTest.id")(function* (arg: CitationIdCallbackInput) {
            const saved = yield* Effect.fromOption(retained, invalid);
            const before = fullsView(yield* saved.readFulls);
            yield* saved.writeFulls([]);
            const output = yield* defaults.id(arg);
            events = A.append(events, {
              slot: "id",
              mention: indexOf(arg.mention.id),
              retainedListSlot: listSlot(saved),
              before,
              after: fullsView(yield* saved.readFulls),
              result: resourceValue(output.resource),
            });
            return output;
          }),
        });
        const result = yield* runPreparedCitationCallbackSession(prepared).pipe(
          Effect.provideService(CitationResolutionWork, work),
          Effect.provideService(CitationCallbackDictionary, owner),
          Effect.provideService(CitationResolutionCallbacks, callbacks)
        );
        expect(events, row.name).toEqual(row.events);
        expect(
          {
            groups: A.map(result.groups, (group) => ({
              resource: resourceValue(group.resource),
              members: A.map(group.members, (reference) =>
                reference._tag === "Mention" ? indexOf(reference.mentionId) : -1
              ),
            })),
            fulls: fullsView(result.fulls),
          },
          row.name
        ).toEqual(row.outcome);
      }
    })
  );
  it.effect(
    "owns immutable pair nodes, preserves duplicate references, and rejects altered or oversized writes atomically",
    () =>
      Effect.gen(function* () {
        const input = yield* prepareCallbackObservation(
          CitationCallbackObservation.make({
            name: "prior-fulls-controls",
            kinds: ["case", "id"],
            pages: {},
            bindings: {},
            events: [],
            outcome: { status: "value", groups: [] },
          })
        );
        const prepared = yield* prepareCitationResolution({ ...input, limits: { ...input.limits, mentions: 2 } });
        const work = yield* makeCitationResolutionWork(prepared.limits);
        const owner = yield* makeCitationCallbackDictionary(prepared).pipe(
          Effect.provideService(CitationResolutionWork, work)
        );
        yield* owner.start;
        const citation = CitationGroupMember.cases.Mention.make({ mentionId: A.getUnsafe(prepared.mentions, 0).id });
        const resource = yield* normalizeCallbackFixtureResource(false);
        const foreign = yield* normalizeCallbackFixtureResource("foreign");
        const pair = yield* owner.createFullPair(citation, resource);
        const equal = yield* owner.createFullPair(citation, resource);
        expect(pair.pairSlot).not.toBe(equal.pairSlot);
        yield* owner.writeFulls([pair, pair]);
        expect(A.map(yield* owner.readFulls, (entry) => entry.pairSlot)).toEqual([pair.pairSlot, pair.pairSlot]);
        const snapshot = yield* owner.readFulls;
        Reflect.set(A.getUnsafe(snapshot, 0), "resource", foreign);
        expect(A.getUnsafe(yield* owner.readFulls, 0).resource).toEqual(resource);
        expect((yield* Effect.flip(owner.writeFulls(snapshot))).reason).toBe("invalid-input");
        expect((yield* Effect.flip(owner.writeFulls([pair, pair, pair]))).reason).toBe("limit-exceeded");
        expect(A.map(yield* owner.readFulls, (entry) => entry.pairSlot)).toEqual([pair.pairSlot, pair.pairSlot]);
        yield* owner.writeFulls([equal]);
        expect(A.getUnsafe(yield* owner.readFulls, 0).pairSlot).toBe(equal.pairSlot);
        expect(pair.resource).toEqual(resource);
        expect(yield* owner.read).toEqual([]);
        yield* owner.close;
        expect((yield* Effect.flip(owner.readFulls)).reason).toBe("invalid-input");
        expect((yield* Effect.flip(owner.writeFulls([]))).reason).toBe("invalid-input");
      })
  );
});
