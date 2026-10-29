import { fileURLToPath } from "node:url";
import { Citation, CitationDetachedId, CitationGroupMember, CitationMentionId } from "@beep/law-practice-domain/values";
import {
  CitationCallbackDictionary,
  CitationCallbackFailure,
  CitationCallbackList,
  CitationResolutionCallbacks,
  CitationResolutionWork,
  makeCitationCallbackDictionary,
  makeCitationResolutionWork,
  runCitationCallbackSession,
  runPreparedCitationCallbackSession,
} from "@beep/law-practice-server/_test/Citation/CallbackSession";
import { makeDefaultCitationResolutionCallbacks } from "@beep/law-practice-server/_test/Citation/DefaultCallbacks";
import { prepareCitationResolution } from "@beep/law-practice-server/_test/Citation/ResolutionInput";
import { Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Crypto from "effect/Crypto";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import {
  prepareCallbackObservation as context,
  callbackNoneResource as none,
  callbackResourcePresentation as presentation,
  CitationCallbackObservation as Row,
  normalizeCallbackFixtureResource as resource,
} from "./CitationCallbackSession.fixtures.ts";
import type {
  CitationCallbackGroup,
  CitationFullsCallbackInput,
  CitationIdCallbackInput,
} from "@beep/law-practice-server/_test/Citation/CallbackSession";

const Corpus = S.Struct({ schemaVersion: S.tag("citation-custom-resolution-observations/v1"), cases: S.Array(Row) });
const member = (mentionId: CitationMentionId) => CitationGroupMember.cases.Mention.make({ mentionId });
const staleId = () => CitationMentionId.make(`cm1:${Str.repeat(64)("f")}`);
const fail = () => CitationCallbackFailure.make({ reason: "callback-failed" });
const emptyCallbacks = CitationResolutionCallbacks.of({
  full: Effect.fn("CallbackTest.emptyFull")(() => Effect.succeed(none())),
  shortCase: Effect.fn("CallbackTest.emptyShort")(() => Effect.succeed({ resource: none() })),
  supra: Effect.fn("CallbackTest.emptySupra")(() => Effect.succeed({ resource: none() })),
  reference: Effect.fn("CallbackTest.emptyReference")(() => Effect.succeed({ resource: none() })),
  id: Effect.fn("CallbackTest.emptyId")(() => Effect.succeed({ resource: none() })),
});
const controls = () =>
  context(
    Row.make({
      name: "callback-controls",
      kinds: ["id", "id"],
      pages: {},
      bindings: {},
      events: [],
      outcome: { status: "value", groups: [] },
    })
  );

it.layer(Layer.mergeAll(BunCrypto.layer, BunFileSystem.layer))("private callback session", (it) => {
  it.effect("verifies evidence before invoking a callback and enforces exact dispatch budgets", () =>
    Effect.gen(function* () {
      const input = yield* controls();
      let calls = 0;
      const callbacks = CitationResolutionCallbacks.of({
        ...emptyCallbacks,
        id: Effect.fn("CallbackTest.count")(() =>
          Effect.sync(() => {
            calls += 1;
            return { resource: none() };
          })
        ),
      });
      const invalid = yield* Effect.flip(
        runCitationCallbackSession({ ...input, engineArtifact: Sha256Hex.make(Str.repeat(64)("b")) }).pipe(
          Effect.provideService(CitationResolutionCallbacks, callbacks)
        )
      );
      expect(invalid.reason).toBe("evidence-failed");
      expect(calls).toBe(0);
      const limits = { ...input.limits, resolutionIterations: 2 };
      expect(
        (yield* runCitationCallbackSession({ ...input, limits }).pipe(
          Effect.provideService(CitationResolutionCallbacks, callbacks)
        )).groups
      ).toEqual([]);
      expect(calls).toBe(2);
      calls = 0;
      const exceeded = yield* Effect.flip(
        runCitationCallbackSession({ ...input, limits: { ...limits, resolutionIterations: 1 } }).pipe(
          Effect.provideService(CitationResolutionCallbacks, callbacks)
        )
      );
      expect(exceeded.reason).toBe("limit-exceeded");
      expect(calls).toBe(1);
    })
  );

  it.effect("rejects callback state references outside the verified input without leaking payloads", () =>
    Effect.gen(function* () {
      const input = yield* controls();
      const prepared = yield* prepareCitationResolution(input);
      const work = yield* makeCitationResolutionWork(prepared.limits);
      const dictionary = yield* makeCitationCallbackDictionary(prepared).pipe(
        Effect.provideService(CitationResolutionWork, work)
      );
      const callbacks = CitationResolutionCallbacks.of({
        ...emptyCallbacks,
        id: Effect.fn("CallbackTest.invalid")(function* () {
          yield* dictionary.allocate([member(CitationMentionId.make(`cm1:${Str.repeat(64)("f")}`))]);
          return { resource: none() };
        }),
      });
      const rejected = yield* Effect.flip(
        runPreparedCitationCallbackSession(prepared).pipe(
          Effect.provideService(CitationResolutionCallbacks, callbacks),
          Effect.provideService(CitationResolutionWork, work),
          Effect.provideService(CitationCallbackDictionary, dictionary)
        )
      );
      expect(rejected.reason).toBe("invalid-input");
      expect("cause" in rejected).toBe(false);
      expect("groups" in rejected).toBe(false);
    })
  );

  it.effect("owns stable list handles, preserves aliases and retained lists, and serializes concurrent appends", () =>
    Effect.gen(function* () {
      const prepared = yield* prepareCitationResolution(yield* controls());
      const work = yield* makeCitationResolutionWork(prepared.limits);
      const firstId = A.getUnsafe(prepared.mentions, 0).id;
      const first = member(firstId);
      const secondId = A.getUnsafe(prepared.mentions, 1).id;
      const second = member(secondId);
      const dictionary = yield* makeCitationCallbackDictionary(prepared).pipe(
        Effect.provideService(CitationResolutionWork, work)
      );
      const otherOwner = yield* makeCitationCallbackDictionary(prepared).pipe(
        Effect.provideService(CitationResolutionWork, work)
      );
      yield* dictionary.start;
      yield* otherOwner.start;
      const base = yield* resource("base");
      const other = yield* resource("other");
      const list = yield* dictionary.get(base);
      expect(yield* dictionary.get(base)).toBe(list);
      const forged = CitationCallbackList.make({ slot: list.slot });
      expect((yield* Effect.flip(dictionary.write(forged, [first]))).reason).toBe("invalid-input");
      expect((yield* Effect.flip(otherOwner.set(base, list))).reason).toBe("invalid-input");
      yield* dictionary.write(list, [first]);
      yield* dictionary.set(other, list);
      expect(yield* dictionary.get(other)).toBe(list);
      Reflect.set(list, "slot", 999);
      yield* dictionary.appendCurrent(base, secondId);
      const snapshot = yield* dictionary.read;
      expect(A.map(snapshot, (group) => group.members)).toEqual([
        [first, second],
        [first, second],
      ]);
      expect(A.map(snapshot, (group) => group.listSlot)).toEqual([0, 0]);
      Reflect.set(A.getUnsafe(snapshot, 0).members, "0", staleId());
      Reflect.set(A.getUnsafe(snapshot, 0).resource, "value", "changed snapshot");
      expect(A.getUnsafe(yield* dictionary.read, 0).members).toEqual([first, second]);
      expect(A.getUnsafe(yield* dictionary.read, 0).resource).toEqual(base);
      yield* dictionary.clear;
      yield* dictionary.set(other, list);
      expect(A.getUnsafe(yield* dictionary.read, 0).members).toEqual([first, second]);
      const fresh = yield* dictionary.get(base);
      expect(fresh).not.toBe(list);
      yield* Effect.all([dictionary.appendCurrent(base, firstId), dictionary.appendCurrent(base, secondId)], {
        concurrency: "unbounded",
      });
      expect(A.getUnsafe(yield* dictionary.read, 1).members).toEqual([first, second]);
      expect(A.getUnsafe(yield* dictionary.read, 0).listSlot).not.toBe(A.getUnsafe(yield* dictionary.read, 1).listSlot);
      yield* dictionary.close;
      yield* otherOwner.close;
      expect((yield* Effect.flip(dictionary.read)).reason).toBe("invalid-input");
      expect((yield* Effect.flip(dictionary.get(base))).reason).toBe("invalid-input");
    })
  );

  it.effect("bounds aliased reference multiplicity atomically and closes the dictionary after callback failure", () =>
    Effect.gen(function* () {
      const input = yield* controls();
      const prepared = yield* prepareCitationResolution({ ...input, limits: { ...input.limits, resolutionEdges: 2 } });
      const work = yield* makeCitationResolutionWork(prepared.limits);
      const dictionary = yield* makeCitationCallbackDictionary(prepared).pipe(
        Effect.provideService(CitationResolutionWork, work)
      );
      const base = yield* resource("base");
      const other = yield* resource("other");
      const firstId = A.getUnsafe(prepared.mentions, 0).id;
      const first = member(firstId);
      let calls = 0;
      const callbacks = CitationResolutionCallbacks.of({
        ...emptyCallbacks,
        id: Effect.fn("CallbackTest.boundedFailure")(function* () {
          calls += 1;
          const list = yield* dictionary.get(base);
          yield* dictionary.write(list, [first, first]);
          const aliasFailure = yield* Effect.result(dictionary.set(other, list));
          expect(aliasFailure._tag).toBe("Failure");
          if (aliasFailure._tag === "Failure") expect(aliasFailure.failure.reason).toBe("limit-exceeded");
          expect(yield* dictionary.read).toHaveLength(1);
          const writeFailure = yield* Effect.result(dictionary.write(list, [first, first, first]));
          expect(writeFailure._tag).toBe("Failure");
          if (writeFailure._tag === "Failure") expect(writeFailure.failure.reason).toBe("limit-exceeded");
          expect(A.getUnsafe(yield* dictionary.read, 0).members).toEqual([first, first]);
          return yield* fail();
        }),
      });
      const run = runPreparedCitationCallbackSession(prepared).pipe(
        Effect.provideService(CitationResolutionWork, work),
        Effect.provideService(CitationCallbackDictionary, dictionary),
        Effect.provideService(CitationResolutionCallbacks, callbacks)
      );
      const wrongWork = yield* makeCitationResolutionWork(prepared.limits);
      const mismatch = yield* Effect.flip(
        runPreparedCitationCallbackSession(prepared).pipe(
          Effect.provideService(CitationResolutionWork, wrongWork),
          Effect.provideService(CitationCallbackDictionary, dictionary),
          Effect.provideService(CitationResolutionCallbacks, callbacks)
        )
      );
      expect(mismatch.reason).toBe("invalid-input");
      expect(calls).toBe(0);
      expect((yield* Effect.flip(run)).reason).toBe("callback-failed");
      expect((yield* Effect.flip(dictionary.read)).reason).toBe("invalid-input");
      expect((yield* Effect.flip(run)).reason).toBe("invalid-input");
      expect(calls).toBe(1);
    })
  );

  it.effect("closes retained dictionary capabilities when a running callback is interrupted", () =>
    Effect.gen(function* () {
      const prepared = yield* prepareCitationResolution(yield* controls());
      const work = yield* makeCitationResolutionWork(prepared.limits);
      const dictionary = yield* makeCitationCallbackDictionary(prepared).pipe(
        Effect.provideService(CitationResolutionWork, work)
      );
      const entered = yield* Deferred.make<void>();
      const callbacks = CitationResolutionCallbacks.of({
        ...emptyCallbacks,
        id: Effect.fn("CallbackTest.interrupt")(function* () {
          yield* Deferred.succeed(entered, undefined);
          return yield* Effect.never;
        }),
      });
      const fiber = yield* runPreparedCitationCallbackSession(prepared).pipe(
        Effect.provideService(CitationResolutionWork, work),
        Effect.provideService(CitationCallbackDictionary, dictionary),
        Effect.provideService(CitationResolutionCallbacks, callbacks),
        Effect.forkChild
      );
      yield* Deferred.await(entered);
      yield* Fiber.interrupt(fiber);
      expect((yield* Effect.flip(dictionary.read)).reason).toBe("invalid-input");
      expect((yield* Effect.flip(dictionary.start)).reason).toBe("invalid-input");
    })
  );

  it.effect("keeps detached object identity separate from semantic equality and snapshots before hashing", () =>
    Effect.gen(function* () {
      const input = yield* context(
        Row.make({
          name: "detached-ownership",
          kinds: ["case", "id"],
          pages: {},
          bindings: {},
          events: [],
          outcome: { status: "value", groups: [] },
        })
      );
      const prepared = yield* prepareCitationResolution(input);
      const work = yield* makeCitationResolutionWork(prepared.limits);
      const codec = S.fromJsonString(Citation);
      const sourceCitation = A.getUnsafe(prepared.mentions, 0).citation;
      const wire = yield* S.encodeEffect(codec)(sourceCitation);
      const model = yield* S.decodeEffect(codec)(wire);
      const equalModel = yield* S.decodeEffect(codec)(wire);
      const crypto = yield* Crypto.Crypto;
      let hashes = 0;
      const dictionary = yield* makeCitationCallbackDictionary(prepared).pipe(
        Effect.provideService(CitationResolutionWork, work),
        Effect.provideService(
          Crypto.Crypto,
          Crypto.make({
            randomBytes: (size) => new Uint8Array(size),
            digest: (algorithm, bytes) =>
              Effect.suspend(() => {
                hashes += 1;
                if (hashes === 1 && model.type === "case")
                  Reflect.set(model.metadata, "plaintiff", O.some("changed during hash"));
                return crypto.digest(algorithm, bytes);
              }),
          })
        )
      );
      yield* dictionary.start;
      const first = yield* dictionary.registerDetached(model);
      const same = yield* dictionary.registerDetached(model);
      const second = yield* dictionary.registerDetached(equalModel);
      expect(first).toEqual(same);
      expect(second).not.toEqual(first);
      expect(hashes).toBe(2);
      expect(yield* S.encodeEffect(codec)(yield* dictionary.citationOf(first))).toBe(wire);
      expect(yield* S.encodeEffect(codec)(yield* dictionary.citationOf(second))).toBe(wire);
      const objects = yield* dictionary.detachedCitations;
      expect(objects).toHaveLength(2);
      expect(A.map(objects, (object) => CitationGroupMember.cases.Detached.make({ detachedId: object.id }))).toEqual([
        first,
        second,
      ]);
      expect(A.every(objects, (object) => !("anchor" in object) && !("mentionId" in object))).toBe(true);
      Reflect.set(A.getUnsafe(objects, 0), "citation", A.getUnsafe(prepared.mentions, 1).citation);
      expect(yield* S.encodeEffect(codec)(yield* dictionary.citationOf(first))).toBe(wire);
      const unknown = CitationGroupMember.cases.Detached.make({
        detachedId: CitationDetachedId.make(`cd1:${Str.repeat(64)("f")}`),
      });
      expect((yield* Effect.flip(dictionary.citationOf(unknown))).reason).toBe("invalid-input");
      expect((yield* Effect.flip(dictionary.allocate([unknown]))).reason).toBe("invalid-input");
      yield* dictionary.close;
      expect((yield* Effect.flip(dictionary.citationOf(first))).reason).toBe("invalid-input");
      expect((yield* Effect.flip(dictionary.registerDetached(equalModel))).reason).toBe("invalid-input");
    })
  );

  it.effect("charges detached objects against the shared node ceiling without fabricating physical mentions", () =>
    Effect.gen(function* () {
      const input = yield* controls();
      const prepared = yield* prepareCitationResolution({ ...input, limits: { ...input.limits, mentions: 3 } });
      const work = yield* makeCitationResolutionWork(prepared.limits);
      const dictionary = yield* makeCitationCallbackDictionary(prepared).pipe(
        Effect.provideService(CitationResolutionWork, work)
      );
      yield* dictionary.start;
      const model = A.getUnsafe(prepared.mentions, 0).citation;
      const codec = S.fromJsonString(Citation);
      const copy = yield* S.decodeEffect(codec)(yield* S.encodeEffect(codec)(model));
      const reference = yield* dictionary.registerDetached(model);
      expect(yield* dictionary.registerDetached(model)).toEqual(reference);
      expect((yield* Effect.flip(dictionary.registerDetached(copy))).reason).toBe("limit-exceeded");
      expect(yield* dictionary.detachedCitations).toHaveLength(1);
      expect(prepared.mentions).toHaveLength(2);
      const resourceValue = yield* resource("detached");
      yield* dictionary.set(resourceValue, yield* dictionary.allocate([reference, reference]));
      expect(A.getUnsafe(yield* dictionary.read, 0).members).toEqual([reference, reference]);
      yield* dictionary.close;
    })
  );

  it.effect(
    "matches all 18 source dispatch/state observations with production defaults and captured custom adapters",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const raw = yield* fs.readFileString(
          fileURLToPath(
            new URL("../../use-cases/test/fixtures/eyecite/custom-resolution-observations.json", import.meta.url)
          )
        );
        const data = yield* S.decodeEffect(S.fromJsonString(Corpus))(raw);
        expect(yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(raw))).toBe(
          "19ce5a31fbcae943e71a0d580145d499a9fb911cd8fe5cf16226dc08a686a7af"
        );
        expect(A.length(data.cases)).toBe(18);
        expect(A.length(A.dedupe(A.map(data.cases, (row) => row.name)))).toBe(18);
        expect(A.reduce(data.cases, 0, (count, row) => count + A.length(row.kinds))).toBe(56);
        expect(A.reduce(data.cases, 0, (count, row) => count + A.length(row.events))).toBe(53);
        for (const row of data.cases) {
          const input = yield* context(row);
          const prepared = yield* prepareCitationResolution(input);
          const work = yield* makeCitationResolutionWork(prepared.limits);
          const dictionary = yield* makeCitationCallbackDictionary(prepared).pipe(
            Effect.provideService(CitationResolutionWork, work)
          );
          const defaults = yield* makeDefaultCitationResolutionCallbacks(prepared).pipe(
            Effect.provideService(CitationCallbackDictionary, dictionary),
            Effect.provideService(CitationResolutionWork, work)
          );
          const crypto = yield* Crypto.Crypto;
          const byId = HashMap.fromIterable(
            A.map(input.mentions, (mention, index) => Tuple.make(mention.id, { mention, index }))
          );
          const indexOf = (id: CitationMentionId) =>
            O.getOrElse(
              O.map(HashMap.get(byId, id), (entry) => entry.index),
              () => -1
            );
          const groupValue = (group: CitationCallbackGroup): S.Json => ({
            resource: presentation(group.resource),
            members: A.map(group.members, (reference) =>
              reference._tag === "Mention" ? indexOf(reference.mentionId) : -1
            ),
          });
          let events = A.empty<S.Json>();
          const behavior = Effect.fn("CallbackTest.behavior")(function* (
            slot: string,
            id: CitationMentionId,
            event: S.Json
          ) {
            const binding = R.get(row.bindings, slot);
            if (O.isNone(binding)) return "default";
            events = A.append(events, event);
            const value = binding.value;
            if (P.isObject(value) && !A.isArray(value)) {
              const record = yield* S.decodeUnknownEffect(S.JsonObject)(value);
              return O.getOrElse(R.get(record, yield* S.encodeEffect(S.FiniteFromString)(indexOf(id))), () => null);
            }
            return value;
          });
          const fullsCallback = (slot: string) =>
            Effect.fn("CallbackTest.fulls")(function* (arg: CitationFullsCallbackInput) {
              const action = yield* behavior(slot, arg.mention.id, {
                slot,
                mention: indexOf(arg.mention.id),
                fulls: A.map(arg.fulls, (entry) => ({
                  mention: entry.citation._tag === "Mention" ? indexOf(entry.citation.mentionId) : -1,
                  resource: presentation(entry.resource),
                })),
              });
              if (action === "raise") return yield* fail();
              if (action === "clear-fulls") {
                yield* dictionary.writeFulls([]);
                return { resource: none() };
              }
              if (action !== "default") return { resource: yield* resource(action) };
              if (slot === "shortcase") return yield* defaults.shortCase(arg);
              if (slot === "supra") return yield* defaults.supra(arg);
              return yield* defaults.reference(arg);
            });
          const short = fullsCallback("shortcase");
          const supra = fullsCallback("supra");
          const reference = fullsCallback("reference");
          const callbacks = CitationResolutionCallbacks.of({
            full: Effect.fn("CallbackTest.full")(
              function* (mention: (typeof input.mentions)[number]) {
                const action = yield* behavior("full", mention.id, { slot: "full", mention: indexOf(mention.id) });
                if (action !== "default") return yield* resource(action);
                return yield* defaults.full(mention);
              },
              Effect.provideService(Crypto.Crypto, crypto),
              Effect.mapError(fail)
            ),
            shortCase: Effect.fn("CallbackTest.short")((arg: CitationFullsCallbackInput) =>
              short(arg).pipe(Effect.provideService(Crypto.Crypto, crypto), Effect.mapError(fail))
            ),
            supra: Effect.fn("CallbackTest.supra")((arg: CitationFullsCallbackInput) =>
              supra(arg).pipe(Effect.provideService(Crypto.Crypto, crypto), Effect.mapError(fail))
            ),
            reference: Effect.fn("CallbackTest.reference")((arg: CitationFullsCallbackInput) =>
              reference(arg).pipe(Effect.provideService(Crypto.Crypto, crypto), Effect.mapError(fail))
            ),
            id: Effect.fn("CallbackTest.id")(
              function* (arg: CitationIdCallbackInput) {
                const action = yield* behavior("id", arg.mention.id, {
                  slot: "id",
                  mention: indexOf(arg.mention.id),
                  last: presentation(arg.last),
                  groups: A.map(arg.groups, groupValue),
                });
                if (action !== "default") return { resource: yield* resource(action) };
                return yield* defaults.id(arg);
              },
              Effect.provideService(Crypto.Crypto, crypto),
              Effect.mapError(fail)
            ),
          });
          const result = yield* runPreparedCitationCallbackSession(prepared).pipe(
            Effect.provideService(CitationResolutionWork, work),
            Effect.provideService(CitationCallbackDictionary, dictionary),
            Effect.provideService(CitationResolutionCallbacks, callbacks),
            Effect.result
          );
          if (row.outcome.status === "error") {
            expect(result._tag, row.name).toBe("Failure");
            if (result._tag === "Failure")
              expect(result.failure.reason).toBe(
                row.outcome.kind === "TypeError" ? "unhashable-resource" : "callback-failed"
              );
          } else {
            if (result._tag !== "Success") return yield* result.failure;
            expect(A.map(result.success.groups, groupValue), row.name).toEqual(row.outcome.groups);
          }
          expect(events, row.name).toEqual(row.events);
        }
      }),
    { timeout: 30_000 }
  );
});
