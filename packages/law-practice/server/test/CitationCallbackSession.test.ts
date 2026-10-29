import { fileURLToPath } from "node:url";
import { CitationMentionId } from "@beep/law-practice-domain/values";
import {
  CitationCallbackFailure,
  CitationResolutionCallbacks,
  CitationResolutionWork,
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
import * as Effect from "effect/Effect";
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
const fail = () => CitationCallbackFailure.make({ reason: "callback-failed" });
const emptyCallbacks = CitationResolutionCallbacks.of({
  full: Effect.fn("CallbackTest.emptyFull")(() => Effect.succeed(none())),
  shortCase: Effect.fn("CallbackTest.emptyShort")((arg: CitationFullsCallbackInput) =>
    Effect.succeed({ resource: none(), fulls: arg.fulls })
  ),
  supra: Effect.fn("CallbackTest.emptySupra")((arg: CitationFullsCallbackInput) =>
    Effect.succeed({ resource: none(), fulls: arg.fulls })
  ),
  reference: Effect.fn("CallbackTest.emptyReference")((arg: CitationFullsCallbackInput) =>
    Effect.succeed({ resource: none(), fulls: arg.fulls })
  ),
  id: Effect.fn("CallbackTest.emptyId")((arg: CitationIdCallbackInput) =>
    Effect.succeed({ resource: none(), groups: arg.groups })
  ),
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
        id: Effect.fn("CallbackTest.count")((arg: CitationIdCallbackInput) =>
          Effect.sync(() => {
            calls += 1;
            return { resource: none(), groups: arg.groups };
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
      const callbacks = CitationResolutionCallbacks.of({
        ...emptyCallbacks,
        id: Effect.fn("CallbackTest.invalid")(() =>
          Effect.succeed({
            resource: none(),
            groups: [{ resource: none(), members: [CitationMentionId.make(`cm1:${Str.repeat(64)("f")}`)] }],
          })
        ),
      });
      const rejected = yield* Effect.flip(
        runCitationCallbackSession(input).pipe(Effect.provideService(CitationResolutionCallbacks, callbacks))
      );
      expect(rejected.reason).toBe("invalid-input");
      expect("cause" in rejected).toBe(false);
      expect("groups" in rejected).toBe(false);
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
          const defaults = yield* makeDefaultCitationResolutionCallbacks(prepared).pipe(
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
            members: A.map(group.members, indexOf),
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
                  mention: indexOf(entry.mentionId),
                  resource: presentation(entry.resource),
                })),
              });
              if (action === "raise") return yield* fail();
              if (action === "clear-fulls") return { resource: none(), fulls: [] };
              if (action !== "default") return { resource: yield* resource(action), fulls: arg.fulls };
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
                if (action !== "default") return { resource: yield* resource(action), groups: arg.groups };
                return yield* defaults.id(arg);
              },
              Effect.provideService(Crypto.Crypto, crypto),
              Effect.mapError(fail)
            ),
          });
          const result = yield* runPreparedCitationCallbackSession(prepared).pipe(
            Effect.provideService(CitationResolutionWork, work),
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
