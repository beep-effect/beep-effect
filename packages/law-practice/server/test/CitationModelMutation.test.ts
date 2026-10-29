import { fileURLToPath } from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { Citation, CitationGroupMember, CitationMention, CitationMentionId } from "@beep/law-practice-domain/values";
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
import { prepareCitationResolution } from "@beep/law-practice-server/_test/Citation/ResolutionInput";
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
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import {
  CitationCallbackObservation,
  callbackResourcePresentation,
  normalizeCallbackFixtureResource,
  prepareCallbackObservation,
} from "./CitationCallbackSession.fixtures.ts";
import type {
  CitationFullsCallbackInput,
  CitationIdCallbackInput,
} from "@beep/law-practice-server/_test/Citation/CallbackSession";

const $I = $LawPracticeServerId.create("test/CitationModelMutation");
const Reference = S.Union([
  S.Struct({ kind: S.tag("input"), index: S.Natural }),
  S.Struct({ kind: S.tag("detached"), slot: S.Natural }),
]).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("Reference", {
    description: "Source-local object reference, never evidence for a detached citation.",
  })
);
const View = S.Struct({
  reference: Reference,
  groups: S.Record(S.String, S.String),
  metadata: S.Struct({
    plaintiff: S.NullOr(S.String),
    antecedent_guess: S.NullOr(S.String),
    pin_cite: S.NullOr(S.String),
  }),
}).pipe(
  $I.annoteSchema("View", { description: "Focused semantic source fields observed before and after callbacks." })
);
const Row = S.Struct({
  name: S.NonEmptyString,
  family: S.Literals(["semantic", "mutable-key"]),
  kinds: S.Array(S.Literals(["case", "supra", "short", "id"])),
  initialObjects: S.Array(View),
  events: S.Array(S.Json),
  objects: S.Array(View),
  detachedObjects: S.Array(View),
  outcome: S.Struct({
    status: S.tag("value"),
    groups: S.Array(S.Struct({ resource: S.Json, members: S.Array(Reference) })),
  }),
}).pipe(
  $I.annoteSchema("Row", {
    description: "Frozen semantic/key mutation scene; the three mutable-key scenes remain source-only requirements.",
  })
);
const Corpus = S.Struct({ schemaVersion: S.tag("citation-model-mutation-observations/v1"), cases: S.Array(Row) }).pipe(
  $I.annoteSchema("Corpus", {
    description: "Eleven source scenes with explicit semantic-versus-mutable-key accounting.",
  })
);
const invalid = () => CitationCallbackFailure.make({ reason: "invalid-input" });

it.layer(Layer.mergeAll(BunCrypto.layer, BunFileSystem.layer))("callback semantic mutations", (it) => {
  it.effect("matches all eight stable-resource source scenes without claiming mutable default-key support", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const raw = yield* fs.readFileString(
        fileURLToPath(
          new URL("../../use-cases/test/fixtures/eyecite/model-mutation-observations.json", import.meta.url)
        )
      );
      expect(yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(raw))).toBe(
        "dca8b55d551d50c6ca0a2917ebce372b20894d4001b7a9738053c7d96d3cf841"
      );
      const data = yield* S.decodeEffect(S.fromJsonString(Corpus))(raw);
      expect(data.cases).toHaveLength(11);
      const rows = A.filter(data.cases, (row) => row.family === "semantic");
      expect(rows).toHaveLength(8);
      expect(A.filter(data.cases, (row) => row.family === "mutable-key")).toHaveLength(3);
      expect(A.map(rows, (row) => row.name)).toEqual([
        "full-rename-current",
        "rename-prior-in-supra",
        "page-prior-in-id",
        "volume-prior-in-short",
        "current-id-pin",
        "current-supra-antecedent",
        "retained-metadata-from-full",
        "detached-alias-metadata",
      ]);
      for (const row of rows) {
        const input = yield* prepareCallbackObservation(
          CitationCallbackObservation.make({
            name: `model-mutation-${row.name}`,
            kinds: row.kinds,
            pages: {},
            bindings: {},
            events: [],
            outcome: { status: "value", groups: [] },
          })
        );
        const mentions = yield* Effect.forEach(input.mentions, (mention, index) =>
          Effect.gen(function* () {
            const source = A.getUnsafe(row.initialObjects, index);
            const wire = yield* S.encodeEffect(Citation)(mention.citation);
            const patched: S.Json = {
              ...wire,
              components: source.groups,
              metadata: {
                ...wire.metadata,
                ...(wire.type === "case" ? { plaintiff: source.metadata.plaintiff } : {}),
                ...(wire.type === "supra" || wire.type === "shortFormCase"
                  ? { antecedentGuess: source.metadata.antecedent_guess }
                  : {}),
                pinCite: source.metadata.pin_cite,
              },
            };
            const citation = yield* S.decodeUnknownEffect(Citation)(patched);
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
        const mentionRef = (mention: CitationMention) =>
          CitationGroupMember.cases.Mention.make({ mentionId: mention.id });
        let detachedRef: O.Option<CitationGroupMember> = O.none();
        const referenceView = (reference: CitationGroupMember): typeof Reference.Type =>
          reference._tag === "Mention"
            ? Reference.cases.input.make({ index: indexOf(reference.mentionId) })
            : Reference.cases.detached.make({ slot: 0 });
        const view = Effect.fn("ModelMutationTest.view")(function* (reference: CitationGroupMember) {
          const wire = yield* S.encodeEffect(Citation)(yield* owner.citationOf(reference));
          const metadata = yield* S.decodeEffect(S.Record(S.String, S.Json))(wire.metadata);
          return {
            reference: referenceView(reference),
            groups: wire.components,
            metadata: {
              plaintiff: O.getOrElse(R.get(metadata, "plaintiff"), () => null),
              antecedent_guess: O.getOrElse(R.get(metadata, "antecedentGuess"), () => null),
              pin_cite: O.getOrElse(R.get(metadata, "pinCite"), () => null),
            },
          };
        }, Effect.mapError(invalid));
        const objects = Effect.fn("ModelMutationTest.objects")(() =>
          Effect.forEach(prepared.mentions, (mention) => view(mentionRef(mention)), { concurrency: 1 })
        );
        const change = Effect.fn("ModelMutationTest.change")(function* (
          reference: CitationGroupMember,
          field: "plaintiff" | "page" | "volume" | "pin" | "antecedent",
          value: string
        ) {
          const wire = yield* S.encodeEffect(Citation)(yield* owner.citationOf(reference)).pipe(
            Effect.mapError(invalid)
          );
          let patched: S.Json;
          if (field === "page" || field === "volume")
            patched = { ...wire, components: { ...wire.components, [field]: value } };
          else
            patched = {
              ...wire,
              metadata: {
                ...wire.metadata,
                [field === "pin" ? "pinCite" : field === "antecedent" ? "antecedentGuess" : "plaintiff"]: value,
              },
            };
          const citation = yield* S.decodeUnknownEffect(Citation)(patched).pipe(Effect.mapError(invalid));
          yield* owner.writeCitation(reference, citation);
        });
        let retained: O.Option<CitationGroupMember> = O.none();
        let events = A.empty<S.Json>();
        const callbacks = CitationResolutionCallbacks.of({
          ...defaults,
          full: Effect.fn("ModelMutationTest.full")(function* (mention: CitationMention) {
            const before = yield* objects();
            if (row.name === "full-rename-current") yield* change(mentionRef(mention), "plaintiff", "Changed");
            if (row.name === "retained-metadata-from-full" && O.isSome(retained))
              yield* change(retained.value, "plaintiff", "Changed");
            events = A.append(events, {
              slot: "full",
              mention: indexOf(mention.id),
              before,
              after: yield* objects(),
              result: callbackResourcePresentation(base),
            });
            return base;
          }),
          supra: Effect.fn("ModelMutationTest.supra")(function* (arg: CitationFullsCallbackInput) {
            const before = yield* Effect.forEach(arg.fulls, (entry) => view(entry.citation), { concurrency: 1 });
            if (O.isNone(retained)) retained = O.some(A.getUnsafe(arg.fulls, 0).citation);
            if (row.name === "rename-prior-in-supra")
              yield* change(A.getUnsafe(arg.fulls, 0).citation, "plaintiff", "Changed");
            if (row.name === "current-supra-antecedent")
              yield* change(mentionRef(arg.mention), "antecedent", "Missing");
            if (row.name === "detached-alias-metadata") {
              if (O.isNone(detachedRef)) {
                const wire = yield* S.encodeEffect(Citation)(
                  yield* owner.citationOf(A.getUnsafe(arg.fulls, 0).citation)
                ).pipe(Effect.mapError(invalid));
                if (wire.type !== "case") return yield* invalid();
                const model = yield* S.decodeEffect(Citation)({
                  ...wire,
                  metadata: { ...wire.metadata, plaintiff: "Detached" },
                }).pipe(Effect.mapError(invalid));
                const reference = yield* owner.registerDetached(model);
                detachedRef = O.some(reference);
                yield* owner.writeFulls(A.append(arg.fulls, yield* owner.createFullPair(reference, foreign)));
              } else yield* change(detachedRef.value, "plaintiff", "Changed");
            }
            const output = yield* defaults.supra({ ...arg, fulls: yield* owner.readFulls });
            events = A.append(events, {
              slot: "supra",
              mention: indexOf(arg.mention.id),
              before,
              after: yield* Effect.forEach(yield* owner.readFulls, (entry) => view(entry.citation), { concurrency: 1 }),
              current: yield* view(mentionRef(arg.mention)),
              result: callbackResourcePresentation(output.resource),
            });
            return output;
          }),
          shortCase: Effect.fn("ModelMutationTest.short")(function* (arg: CitationFullsCallbackInput) {
            const before = yield* Effect.forEach(arg.fulls, (entry) => view(entry.citation), { concurrency: 1 });
            yield* change(A.getUnsafe(arg.fulls, 0).citation, "volume", "2");
            const output = yield* defaults.shortCase(arg);
            events = A.append(events, {
              slot: "short",
              mention: indexOf(arg.mention.id),
              before,
              after: yield* Effect.forEach(yield* owner.readFulls, (entry) => view(entry.citation), { concurrency: 1 }),
              current: yield* view(mentionRef(arg.mention)),
              result: callbackResourcePresentation(output.resource),
            });
            return output;
          }),
          id: Effect.fn("ModelMutationTest.id")(function* (arg: CitationIdCallbackInput) {
            const before = yield* Effect.forEach(
              A.flatMap(arg.groups, (group) => group.members),
              view,
              { concurrency: 1 }
            );
            if (row.name === "page-prior-in-id")
              yield* change(A.getUnsafe(A.getUnsafe(arg.groups, 0).members, 0), "page", "20");
            if (row.name === "current-id-pin") yield* change(mentionRef(arg.mention), "pin", "200");
            const output = yield* defaults.id(arg);
            events = A.append(events, {
              slot: "id",
              mention: indexOf(arg.mention.id),
              before,
              after: yield* Effect.forEach(
                A.flatMap(yield* owner.read, (group) => group.members),
                view,
                { concurrency: 1 }
              ),
              current: yield* view(mentionRef(arg.mention)),
              result: callbackResourcePresentation(output.resource),
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
            status: "value",
            groups: A.map(result.groups, (group) => ({
              resource: callbackResourcePresentation(group.resource),
              members: A.map(group.members, referenceView),
            })),
          },
          row.name
        ).toEqual(row.outcome);
        const finalView = Effect.fn("ModelMutationTest.finalView")(function* (
          reference: CitationGroupMember,
          citation: Citation
        ) {
          const wire = yield* S.encodeEffect(Citation)(citation);
          const metadata = yield* S.decodeEffect(S.Record(S.String, S.Json))(wire.metadata);
          return {
            reference: referenceView(reference),
            groups: wire.components,
            metadata: {
              plaintiff: O.getOrElse(R.get(metadata, "plaintiff"), () => null),
              antecedent_guess: O.getOrElse(R.get(metadata, "antecedentGuess"), () => null),
              pin_cite: O.getOrElse(R.get(metadata, "pinCite"), () => null),
            },
          };
        });
        expect(
          yield* Effect.forEach(result.mentions, (mention) => finalView(mentionRef(mention), mention.citation)),
          row.name
        ).toEqual(row.objects);
        expect(
          yield* Effect.forEach(result.detachedCitations, (object) =>
            finalView(CitationGroupMember.cases.Detached.make({ detachedId: object.id }), object.citation)
          ),
          row.name
        ).toEqual(row.detachedObjects);
        for (const [index, mention] of A.map(result.mentions, (mention, index) => Tuple.make(index, mention))) {
          expect(mention.anchor).toBe(A.getUnsafe(prepared.mentions, index).anchor);
          expect(mention.id).toBe(A.getUnsafe(prepared.mentions, index).id);
        }
      }
    })
  );
  it.effect(
    "preserves source capabilities and rejects stale-kind or unknown-reference semantic writes atomically",
    () =>
      Effect.gen(function* () {
        const input = yield* prepareCallbackObservation(
          CitationCallbackObservation.make({
            name: "model-write-controls",
            kinds: ["case", "id"],
            pages: {},
            bindings: {},
            events: [],
            outcome: { status: "value", groups: [] },
          })
        );
        const prepared = yield* prepareCitationResolution(input);
        const work = yield* makeCitationResolutionWork(prepared.limits);
        const owner = yield* makeCitationCallbackDictionary(prepared).pipe(
          Effect.provideService(CitationResolutionWork, work)
        );
        yield* owner.start;
        const original = A.getUnsafe(prepared.mentions, 0);
        const reference = CitationGroupMember.cases.Mention.make({ mentionId: original.id });
        const wire = yield* S.encodeEffect(Citation)(original.citation);
        if (wire.type !== "case") return yield* invalid();
        const next = yield* S.decodeEffect(Citation)({ ...wire, metadata: { ...wire.metadata, plaintiff: "Changed" } });
        const expected = yield* S.encodeEffect(Citation)(next);
        yield* owner.writeCitation(reference, next);
        if (next.type !== "case") return yield* invalid();
        Reflect.set(next.metadata, "plaintiff", O.some("mutated caller copy"));
        expect(yield* S.encodeEffect(Citation)(yield* owner.citationOf(reference))).toEqual(expected);
        const snapshot = yield* owner.readMentions;
        const changed = A.getUnsafe(snapshot, 0);
        expect(changed.anchor).toBe(original.anchor);
        expect(changed.id).toBe(original.id);
        expect(original.citation).not.toEqual(changed.citation);
        Reflect.set(changed.citation, "components", {});
        expect(yield* S.encodeEffect(Citation)(yield* owner.citationOf(reference))).toEqual(expected);
        expect(
          (yield* Effect.flip(owner.writeCitation(reference, A.getUnsafe(prepared.mentions, 1).citation))).reason
        ).toBe("invalid-input");
        const unknown = CitationGroupMember.cases.Mention.make({
          mentionId: CitationMentionId.make(`cm1:${Str.repeat(64)("f")}`),
        });
        expect((yield* Effect.flip(owner.writeCitation(unknown, original.citation))).reason).toBe("invalid-input");
        expect(yield* S.encodeEffect(Citation)(yield* owner.citationOf(reference))).toEqual(expected);
        yield* owner.close;
        expect((yield* Effect.flip(owner.readMentions)).reason).toBe("invalid-input");
        expect((yield* Effect.flip(owner.writeCitation(reference, original.citation))).reason).toBe("invalid-input");
      })
  );
});
