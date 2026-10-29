import { fileURLToPath } from "node:url";
import { Citation, CitationComponents, CitationMentionId } from "@beep/law-practice-domain/values";
import { CitationAuthorityIdentityInput } from "@beep/law-practice-server/_test/Citation/AuthorityIdentity";
import {
  CitationCallbackFailure,
  CitationCallbackResource,
  CitationResolutionCallbacks,
  runCitationCallbackSession,
} from "@beep/law-practice-server/_test/Citation/CallbackSession";
import {
  hasInvalidCitationPinCite,
  stripCitationAntecedentPunctuation,
} from "@beep/law-practice-server/_test/Citation/ResolverText";
import {
  CitationResourceIdentity,
  makeCitationResourceAuthorityId,
} from "@beep/law-practice-server/_test/Citation/ResourceIdentity";
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
import { CitationResolutionContext, prepareCitationResolutionContext as prepare } from "./CitationResolve.fixtures.ts";
import type {
  CitationCallbackFull,
  CitationCallbackGroup,
  CitationFullsCallbackInput,
  CitationIdCallbackInput,
} from "@beep/law-practice-server/_test/Citation/CallbackSession";

const Row = S.Struct({
  name: S.NonEmptyString,
  kinds: S.Array(S.Literals(["case", "law", "journal", "short", "supra", "reference", "id", "unknown"])),
  pages: S.Record(S.String, S.Natural),
  bindings: S.Record(S.String, S.Json),
  events: S.Array(S.Json),
  outcome: S.Union([
    S.Struct({ status: S.tag("value"), groups: S.Array(S.Struct({ resource: S.Json, members: S.Array(S.Natural) })) }),
    S.Struct({ status: S.tag("error"), kind: S.String }),
  ]).pipe(S.toTaggedUnion("status")),
});
const Corpus = S.Struct({ schemaVersion: S.tag("citation-custom-resolution-observations/v1"), cases: S.Array(Row) });
const Json = S.fromJsonString(S.Json);
const scope = Sha256Hex.make(Str.repeat(64)("a"));
const none = () => CitationCallbackResource.cases.None.make({});
const fail = () => CitationCallbackFailure.make({ reason: "callback-failed" });
const presentation = (resource: CitationCallbackResource): S.Json =>
  resource._tag === "None" ? { kind: "NoneType", value: null } : resource.value;
const key = Effect.fn("CallbackTest.key")(function* (resource: CitationCallbackResource) {
  if (resource._tag === "None") return "none";
  if (resource._tag === "Unhashable") return yield* fail();
  return yield* makeCitationResourceAuthorityId(resource.identity);
});
// Focused fixture adapter, not a production Python hashable implementation.
const resource = Effect.fn("CallbackTest.resource")(function* (
  raw: S.Json
): Effect.fn.Return<CitationCallbackResource, S.SchemaError, Crypto.Crypto> {
  if (raw === null) return none();
  if (A.isArray(raw) && A.length(raw) > 0)
    return CitationCallbackResource.cases.Unhashable.make({ truthy: true, value: { kind: "list", value: raw } });
  let token: S.Json;
  let value: S.Json;
  let truthy: boolean;
  if (P.isBoolean(raw)) {
    token = ["numeric", raw ? 1 : 0];
    value = { kind: "bool", value: raw };
    truthy = raw;
  } else if (P.isNumber(raw)) {
    token = ["numeric", raw];
    value = { kind: "int", value: raw };
    truthy = raw !== 0;
  } else if (P.isString(raw)) {
    token = ["str", raw];
    value = { kind: "str", value: raw };
    truthy = Str.isNonEmpty(raw);
  } else {
    token = ["tuple", []];
    value = { kind: "tuple", value: [] };
    truthy = false;
  }
  const key = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(yield* S.encodeEffect(Json)(token)));
  return CitationCallbackResource.cases.Hashable.make({
    identity: CitationResourceIdentity.cases.External.make({ scope, key }),
    truthy,
    value,
  });
});
const templates = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const raw = yield* fs.readFileString(
    fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/default-resolution-cases.json", import.meta.url))
  );
  const data = yield* S.decodeEffect(S.fromJsonString(S.Struct({ cases: S.Array(CitationResolutionContext) })))(raw);
  return HashMap.fromIterable(
    A.flatMap(data.cases, (row) =>
      A.map(row.mentions, (mention) => Tuple.make(mention.citation.type, mention.citation))
    )
  );
});
const kinds = {
  case: "case",
  law: "law",
  journal: "journal",
  short: "shortFormCase",
  supra: "supra",
  reference: "reference",
  id: "id",
  unknown: "unknown",
} satisfies Record<string, Citation["type"]>;
const context = Effect.fn("CallbackTest.context")(function* (row: typeof Row.Type) {
  const models = yield* templates;
  let text = "";
  let mentions = A.empty<CitationResolutionContext["mentions"][number]>();
  for (const [index, kind] of A.map(row.kinds, (kind, index) => Tuple.make(index, kind))) {
    const tag = yield* Effect.fromOption(R.get(kinds, kind));
    const template = yield* Effect.fromOption(HashMap.get(models, tag));
    const wire = yield* S.encodeEffect(Citation)(template);
    const indexKey = yield* S.encodeEffect(S.FiniteFromString)(index);
    const page = yield* S.encodeEffect(S.FiniteFromString)(O.getOrElse(R.get(row.pages, indexKey), () => 1));
    let metadata: S.JsonObject = wire.metadata;
    if (wire.type === "case") metadata = { ...metadata, plaintiff: "Smith", defendant: null };
    if (wire.type === "supra" || wire.type === "shortFormCase") metadata = { ...metadata, antecedentGuess: "Smith" };
    if (wire.type === "id") metadata = { ...metadata, pinCite: "2" };
    const publication =
      "publication" in wire ? { ...wire.publication, editions: [], selectedEdition: null } : undefined;
    const citation = yield* S.decodeUnknownEffect(Citation)({
      ...wire,
      components: { volume: "1", reporter: "U.S.", page },
      metadata,
      ...(publication === undefined ? {} : { publication }),
    });
    const quote = `witness-${index}`;
    const start = Str.length(text);
    text += `${quote}; `;
    mentions = A.append(mentions, { citation, start, end: start + Str.length(quote), quote });
  }
  return yield* prepare(
    CitationResolutionContext.make({
      name: row.name,
      text,
      editions: [],
      mentions,
      outcome: { status: "value", groups: [] },
    })
  );
});

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
    "matches all 18 source dispatch/state observations using explicit test adapters",
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
          const crypto = yield* Crypto.Crypto;
          const byId = HashMap.fromIterable(
            A.map(input.mentions, (mention, index) => Tuple.make(mention.id, { mention, index }))
          );
          const indexOf = (id: CitationMentionId) =>
            O.getOrElse(
              O.map(HashMap.get(byId, id), (entry) => entry.index),
              () => -1
            );
          const mentionOf = (id: CitationMentionId) =>
            Effect.fromOption(O.map(HashMap.get(byId, id), (entry) => entry.mention));
          const groupValue = (group: CitationCallbackGroup): S.Json => ({
            resource: presentation(group.resource),
            members: A.map(group.members, indexOf),
          });
          let events = A.empty<S.Json>();
          const choose = Effect.fn("CallbackTest.choose")(function* (fulls: ReadonlyArray<CitationCallbackFull>) {
            const keys = yield* Effect.forEach(fulls, (full) => key(full.resource), { concurrency: 1 });
            return A.length(A.dedupe(keys)) === 1 ? A.getUnsafe(fulls, 0).resource : none();
          });
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
              let candidates = A.empty<CitationCallbackFull>();
              for (const full of arg.fulls) {
                const prior = (yield* mentionOf(full.mentionId)).citation;
                const current = arg.mention.citation;
                if (prior.type !== "case") continue;
                if (current.type === "shortFormCase") {
                  const priorComponents = yield* S.encodeEffect(CitationComponents)(prior.components);
                  const currentComponents = yield* S.encodeEffect(CitationComponents)(current.components);
                  if (
                    R.get(priorComponents, "volume").pipe(O.getOrNull) ===
                      R.get(currentComponents, "volume").pipe(O.getOrNull) &&
                    R.get(priorComponents, "reporter").pipe(O.getOrNull) ===
                      R.get(currentComponents, "reporter").pipe(O.getOrNull)
                  )
                    candidates = A.append(candidates, full);
                } else if (current.type === "supra") {
                  const guess = O.map(current.metadata.antecedentGuess, stripCitationAntecedentPunctuation);
                  if (
                    O.isSome(guess) &&
                    (O.exists(prior.metadata.plaintiff, Str.includes(guess.value)) ||
                      O.exists(prior.metadata.defendant, Str.includes(guess.value)))
                  )
                    candidates = A.append(candidates, full);
                }
              }
              return { resource: yield* choose(candidates), fulls: arg.fulls };
            });
          const short = fullsCallback("shortcase");
          const supra = fullsCallback("supra");
          const reference = fullsCallback("reference");
          const callbacks = CitationResolutionCallbacks.of({
            full: Effect.fn("CallbackTest.full")(
              function* (mention: (typeof input.mentions)[number]) {
                const action = yield* behavior("full", mention.id, { slot: "full", mention: indexOf(mention.id) });
                if (action !== "default") return yield* resource(action);
                const authority = yield* S.decodeUnknownEffect(S.toType(CitationAuthorityIdentityInput))({
                  citation: mention.citation,
                  mentionId: mention.id,
                  selectedEdition: O.none(),
                });
                return CitationCallbackResource.cases.Hashable.make({
                  identity: CitationResourceIdentity.cases.Canonical.make({ authority }),
                  truthy: true,
                  value: { kind: "default", representative: indexOf(mention.id) },
                });
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
                if (arg.last._tag === "None" || !arg.last.truthy) return { resource: none(), groups: arg.groups };
                const id = yield* key(arg.last);
                const matches = yield* Effect.filter(arg.groups, (group) =>
                  Effect.map(key(group.resource), (value) => value === id)
                );
                const group = A.getUnsafe(matches, 0);
                const first = yield* mentionOf(A.getUnsafe(group.members, 0));
                const invalid = yield* hasInvalidCitationPinCite({
                  fullCitation: first.citation,
                  idCitation: arg.mention.citation,
                });
                return { resource: invalid ? none() : arg.last, groups: arg.groups };
              },
              Effect.provideService(Crypto.Crypto, crypto),
              Effect.mapError(fail)
            ),
          });
          const result = yield* runCitationCallbackSession(input).pipe(
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
