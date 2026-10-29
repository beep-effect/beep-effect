import { fileURLToPath } from "node:url";
import {
  Citation,
  CitationComponentAnchor,
  CitationFootnoteZone,
  CitationGroupMember,
  CitationMention,
} from "@beep/law-practice-domain/values";
import {
  CitationCallbackRuntimeIndexFactory,
  makeCitationCallbackRuntimeIndexFactory,
} from "@beep/law-practice-server/_test/Citation/CallbackRuntimeIndex";
import {
  CitationCallbackDictionary,
  CitationCallbackFailure,
  CitationCallbackResource,
  CitationResolutionCallbacks,
  CitationResolutionWork,
  makeCitationCallbackDictionary,
  makeCitationResolutionWork,
  runPreparedCitationCallbackSession,
} from "@beep/law-practice-server/_test/Citation/CallbackSession";
import { makeDefaultCitationResolutionCallbacks } from "@beep/law-practice-server/_test/Citation/DefaultCallbacks";
import { restoreCitationDocument } from "@beep/law-practice-server/_test/Citation/Document";
import {
  CitationFrozenEditions,
  makeCitationFrozenEditions,
} from "@beep/law-practice-server/_test/Citation/FrozenEditions";
import {
  CitationHostResource,
  CitationHostResourceAdapterFactory,
} from "@beep/law-practice-server/_test/Citation/HostResources";
import { prepareCitationResolution } from "@beep/law-practice-server/_test/Citation/ResolutionInput";
import { CitationResourceIdentity } from "@beep/law-practice-server/_test/Citation/ResourceIdentity";
import {
  CitationSessionHostResourceDescriptors,
  makeCitationRegisteredSessionDescriptors,
} from "@beep/law-practice-server/_test/Citation/SessionDescriptors";
import {
  CitationSessionResourceDescriptors,
  makeCitationSessionDocumentProjector,
} from "@beep/law-practice-server/_test/Citation/SessionDocument";
import { Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { CitationCallbackObservation, prepareCallbackObservation } from "./CitationCallbackSession.fixtures.ts";
import { loadCitationFrozenEditionFixtures } from "./CitationFrozenEditions.fixtures.ts";
import type { CitationHostComparisonOperand } from "@beep/law-practice-server/_test/Citation/HostResources";

const HostState = S.Struct({
  hashRaw: S.String,
  mode: S.Literals(["token", "false", "not-implemented", "normalized", "citation"]),
  token: S.String,
  truth: S.Boolean,
  truthAfterHash: S.NullOr(S.Boolean),
  failHash: S.Boolean,
  failEq: S.Boolean,
  failBool: S.Boolean,
});
const Operation = S.Union([
  S.Struct({ kind: S.Literals(["set"]), key: S.Natural, value: S.Natural }),
  S.Struct({ kind: S.Literals(["get", "remove", "alias"]), key: S.Natural }),
  S.Struct({ kind: S.Literals(["append"]), key: S.Natural, member: S.Natural }),
  S.Struct({ kind: S.Literals(["clear"]) }),
  S.Struct({ kind: S.Literals(["page"]), value: S.String }),
  S.Struct({ kind: S.Literals(["truth"]), host: S.Natural, value: S.Boolean }),
  S.Struct({ kind: S.Literals(["hashRaw", "token"]), host: S.Natural, value: S.String }),
  S.Struct({
    kind: S.Literals(["flag"]),
    host: S.Natural,
    field: S.Literals(["failHash", "failEq", "failBool"]),
    value: S.Boolean,
  }),
]);
const Corpus = S.fromJsonString(
  S.Struct({
    normalizedHashes: S.Record(S.String, S.String),
    cases: S.Array(
      S.Struct({
        name: S.String,
        hosts: S.Array(HostState),
        keys: S.Array(
          S.Union([S.Struct({ kind: S.Literal("canonical") }), S.Struct({ kind: S.Literal("host"), host: S.Natural })])
        ),
        events: S.Array(
          S.Struct({
            operation: Operation,
            outcome: S.Json,
            entries: S.Array(S.Json),
            lists: S.Natural.pipe(S.Array, S.Array),
            trace: S.Array(S.Json),
            priorPresentation: S.Json,
          })
        ),
      })
    ),
    callbacks: S.Array(
      S.Struct({ name: S.String, host: HostState, trace: S.Array(S.Json), groups: S.Natural.pipe(S.Array, S.Array) })
    ),
  })
);
const bad = () => CitationCallbackFailure.make({ reason: "callback-failed" });

// Deliberately controlled adapter: normalized hashes are actual Python observations,
// not a claimed general implementation of Python's numeric/object protocol.
const harness = (initial: ReadonlyArray<typeof HostState.Type>, normalized: Readonly<Record<string, string>>) => {
  const states = A.map(initial, (state) => ({ ...state }));
  const handles = A.map(states, (_, slot) => CitationHostResource.make({ slot }));
  let trace = A.empty<S.Json>();
  let closed = false;
  const emit = (event: S.Json) => {
    trace = A.append(trace, event);
  };
  const owned = Effect.fn("HostTest.owned")(function* (handle: CitationHostResource) {
    if (closed || A.getUnsafe(handles, handle.slot) !== handle) return yield* bad();
    return A.getUnsafe(states, handle.slot);
  });
  const rawHash = Effect.fn("HostTest.rawHash")(function* (handle: CitationHostResource) {
    const state = yield* owned(handle);
    emit({ kind: "hash", slot: handle.slot, raw: state.hashRaw });
    if (state.failHash) return yield* bad();
    if (state.truthAfterHash !== null) state.truth = state.truthAfterHash;
    return BigInt(state.hashRaw);
  });
  const hash = Effect.fn("HostTest.hash")(function* (handle: CitationHostResource) {
    yield* rawHash(handle);
    return BigInt(yield* Effect.fromOption(R.get(normalized, (yield* owned(handle)).hashRaw), bad));
  });
  const operandView = (operand: CitationHostComparisonOperand): S.Json =>
    operand._tag === "Canonical"
      ? { kind: "canonical", slot: operand.slot }
      : { kind: "host", slot: operand.handle.slot };
  const factory = CitationHostResourceAdapterFactory.of({
    build: Effect.fn("HostTest.build")(function* (canonical) {
      const method = Effect.fn("HostTest.method")(function* (
        left: CitationHostComparisonOperand,
        right: CitationHostComparisonOperand
      ) {
        if (left._tag === "Canonical") {
          emit({ kind: "resource-eq", slot: left.slot, other: operandView(right) });
          const a = yield* canonical.hash(left.slot);
          const b = right._tag === "Canonical" ? yield* canonical.hash(right.slot) : yield* rawHash(right.handle);
          return O.some(a === b);
        }
        const state = yield* owned(left.handle);
        emit({ kind: "eq", slot: left.handle.slot, other: operandView(right) });
        if (state.failEq) return yield* bad();
        if (state.mode === "false") return O.some(false);
        if (state.mode === "not-implemented") return O.none<boolean>();
        if (state.mode === "normalized") {
          const a = yield* hash(left.handle);
          const b = right._tag === "Canonical" ? yield* canonical.hash(right.slot) : yield* hash(right.handle);
          return O.some(a === b);
        }
        if (state.mode === "citation") {
          if (right._tag !== "Canonical") return O.none<boolean>();
          const wire = yield* S.encodeEffect(Citation)(yield* canonical.citation(right.slot)).pipe(
            Effect.mapError(bad)
          );
          return O.some(O.getOrNull(R.get(wire.components, "page")) === state.token);
        }
        return right._tag === "Host" ? O.some(state.token === (yield* owned(right.handle)).token) : O.none<boolean>();
      });
      return {
        capture: Effect.fn("HostTest.capture")(function* (input: unknown) {
          const slot = yield* Effect.fromOption(
            A.findFirstIndex(states, (state) => state === input),
            bad
          );
          const handle = A.getUnsafe(handles, slot);
          yield* owned(handle);
          return handle;
        }),
        presentation: Effect.fn("HostTest.presentation")(function* (handle: CitationHostResource) {
          return { kind: "host", slot: handle.slot, token: (yield* owned(handle)).token };
        }),
        truthy: Effect.fn("HostTest.truthy")(function* (handle: CitationHostResource) {
          const state = yield* owned(handle);
          emit({ kind: "bool", slot: handle.slot, result: state.truth });
          if (state.failBool) return yield* bad();
          return state.truth;
        }),
        hash,
        compare: Effect.fn("HostTest.compare")(function* (
          left: CitationHostComparisonOperand,
          right: CitationHostComparisonOperand
        ) {
          const first = yield* method(left, right);
          return O.isSome(first) ? first.value : O.getOrElse(yield* method(right, left), () => false);
        }),
        close: Effect.sync(() => {
          closed = true;
        }),
      };
    }),
  });
  return {
    states,
    factory,
    trace: () => trace,
    reset: () => {
      trace = A.empty();
    },
  };
};
const prepare = Effect.fn("HostTest.prepare")(function* (
  name: string,
  kinds: ReadonlyArray<"case" | "id" | "unknown"> = ["case", "id"]
) {
  const input = yield* prepareCallbackObservation(
    CitationCallbackObservation.make({
      name,
      kinds,
      pages: {},
      bindings: {},
      events: [],
      outcome: { status: "value", groups: [] },
    })
  );
  const mentions = yield* Effect.forEach(input.mentions, (mention, index) =>
    Effect.gen(function* () {
      const wire = yield* S.encodeEffect(Citation)(mention.citation);
      const citation = yield* S.decodeUnknownEffect(Citation)({
        ...wire,
        components:
          wire.type === "case" ? { volume: "1", reporter: "U.S.", page: index === 0 ? "1" : "2" } : wire.components,
        metadata: { ...wire.metadata, pinCite: wire.type === "case" ? null : "2" },
      });
      return CitationMention.make({ ...mention, citation });
    })
  );
  return yield* prepareCitationResolution({ ...input, mentions });
});
const load = Effect.fn("HostTest.load")(function* () {
  const raw = yield* (yield* FileSystem.FileSystem).readFileString(
    fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/host-resources.json", import.meta.url))
  );
  expect(yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(raw))).toBe(
    "2eaf20a0492da410f793712cb7f3b5728bb6e912b9fc7659a07764fd24bdf43f"
  );
  return yield* S.decodeEffect(Corpus)(raw);
});
it.layer(Layer.merge(BunCrypto.layer, BunFileSystem.layer))("captured host resources", (it) => {
  it.effect("classifies deceptive default-looking presentation by owned host origin and requires a host port", () =>
    Effect.gen(function* () {
      const row = A.getUnsafe((yield* load()).callbacks, 0);
      const prepared = yield* prepare("deceptive-default-presentation");
      const host = harness([row.host], { [row.host.hashRaw]: row.host.hashRaw });
      const deceptive = CitationHostResourceAdapterFactory.of({
        build: Effect.fn("DescriptorOriginTest.build")(function* (canonical) {
          const adapter = yield* host.factory.build(canonical);
          return {
            ...adapter,
            presentation: Effect.fn("DescriptorOriginTest.presentation")(() =>
              Effect.succeed({ kind: "default", mentionId: A.getUnsafe(prepared.mentions, 0).id })
            ),
          };
        }),
      });
      const frozen = yield* makeCitationFrozenEditions((yield* loadCitationFrozenEditionFixtures()).bundle);
      const factory = yield* makeCitationCallbackRuntimeIndexFactory().pipe(
        Effect.provideService(CitationFrozenEditions, frozen),
        Effect.provideService(CitationHostResourceAdapterFactory, deceptive)
      );
      const work = yield* makeCitationResolutionWork(prepared.limits);
      const owner = yield* makeCitationCallbackDictionary(prepared).pipe(
        Effect.provideService(CitationResolutionWork, work),
        Effect.provideService(CitationCallbackRuntimeIndexFactory, factory)
      );
      const defaults = yield* makeDefaultCitationResolutionCallbacks(prepared).pipe(
        Effect.provideService(CitationResolutionWork, work),
        Effect.provideService(CitationCallbackDictionary, owner)
      );
      const state = yield* runPreparedCitationCallbackSession(prepared).pipe(
        Effect.provideService(CitationResolutionWork, work),
        Effect.provideService(CitationCallbackDictionary, owner),
        Effect.provideService(
          CitationResolutionCallbacks,
          CitationResolutionCallbacks.of({
            ...defaults,
            full: Effect.fn("DescriptorOriginTest.full")(() => owner.hostResource(A.getUnsafe(host.states, 0))),
          })
        )
      );
      expect(A.map(state.resourceOrigins, (origin) => origin._tag)).toEqual(["Host"]);
      const descriptors = yield* makeCitationRegisteredSessionDescriptors(state).pipe(
        Effect.provideService(CitationFrozenEditions, frozen)
      );
      const resource = A.getUnsafe(state.groups, 0).resource;
      expect((yield* Effect.flip(descriptors.describe(resource))).reason).toBe("identity-failed");
      const identity = CitationResourceIdentity.cases.External.make({
        scope: prepared.engineArtifact,
        key: prepared.engineArtifact,
      });
      const explicit = yield* makeCitationRegisteredSessionDescriptors(state).pipe(
        Effect.provideService(CitationFrozenEditions, frozen),
        Effect.provideService(
          CitationSessionHostResourceDescriptors,
          CitationSessionHostResourceDescriptors.of({
            describe: Effect.fn("DescriptorOriginTest.explicitHost")(() => Effect.succeed(identity)),
          })
        )
      );
      expect(yield* explicit.describe(resource)).toEqual(identity);
      expect(host.trace()).toEqual(row.trace);
    })
  );
  it.effect("captures actual returned objects and append destinations independently of surviving groups", () =>
    Effect.gen(function* () {
      const raw = yield* (yield* FileSystem.FileSystem).readFileString(
        fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/dispatch-decisions.json", import.meta.url))
      );
      expect(yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(raw))).toBe(
        "88efa991758699d739ddac709f20efce4ba086da9eb17bca5bb9170e03a79c36"
      );
      const corpus = yield* S.decodeEffect(
        S.fromJsonString(
          S.Struct({
            cases: S.Array(
              S.Struct({
                name: S.String,
                kinds: S.Array(S.Literals(["case", "id", "unknown"])),
                action: S.Literals([
                  "equal",
                  "falsy",
                  "truth-change",
                  "clear-new",
                  "clear-same",
                  "unknown",
                  "none",
                  "presentation-change",
                ]),
                hosts: S.Array(HostState),
                decisions: S.Array(S.Json),
                groups: S.Array(
                  S.Struct({ entrySlot: S.Natural, listSlot: S.Natural, resource: S.Json, members: S.Array(S.Natural) })
                ),
                trace: S.Array(S.Json),
              })
            ),
          })
        )
      )(raw);
      expect(corpus.cases).toHaveLength(8);
      const frozen = yield* makeCitationFrozenEditions((yield* loadCitationFrozenEditionFixtures()).bundle);
      const present = (resource: CitationCallbackResource): S.Json =>
        resource._tag === "None" ? { kind: "none" } : resource._tag === "Registered" ? resource.value : null;
      let count = 0;
      for (const row of corpus.cases) {
        const host = harness(row.hosts, { "7": "7" });
        const factory = yield* makeCitationCallbackRuntimeIndexFactory().pipe(
          Effect.provideService(CitationFrozenEditions, frozen),
          Effect.provideService(CitationHostResourceAdapterFactory, host.factory)
        );
        const base = yield* prepare(row.name, row.kinds);
        const prepared =
          row.action === "equal"
            ? {
                ...base,
                mentions: A.map(base.mentions, (mention) =>
                  CitationMention.make({
                    ...mention,
                    components: [CitationComponentAnchor.make({ name: "token", anchor: mention.anchor })],
                    footnote: O.some(CitationFootnoteZone.make({ label: O.some("n1"), anchor: mention.anchor })),
                  })
                ),
              }
            : base;
        const work = yield* makeCitationResolutionWork(prepared.limits);
        const owner = yield* makeCitationCallbackDictionary(prepared).pipe(
          Effect.provideService(CitationResolutionWork, work),
          Effect.provideService(CitationCallbackRuntimeIndexFactory, factory)
        );
        const defaults = yield* makeDefaultCitationResolutionCallbacks(prepared).pipe(
          Effect.provideService(CitationResolutionWork, work),
          Effect.provideService(CitationCallbackDictionary, owner)
        );
        const indexOf = (id: (typeof prepared.mentions)[number]["id"]) =>
          O.getOrElse(
            A.findFirstIndex(prepared.mentions, (mention) => mention.id === id),
            () => -1
          );
        const callbacks = CitationResolutionCallbacks.of({
          ...defaults,
          full: Effect.fn("DispatchDecisionTest.full")(function* (mention: CitationMention) {
            if (row.action === "none") return CitationCallbackResource.cases.None.make({});
            return yield* owner.hostResource(
              A.getUnsafe(host.states, row.action === "equal" ? indexOf(mention.id) : 0)
            );
          }),
          id: Effect.fn("DispatchDecisionTest.id")(function* (input) {
            if (indexOf(input.mention.id) === 1 && (row.action === "clear-new" || row.action === "clear-same")) {
              yield* owner.clear;
              return {
                resource: yield* owner.hostResource(A.getUnsafe(host.states, row.action === "clear-new" ? 1 : 0)),
              };
            }
            if (row.action === "presentation-change") {
              A.getUnsafe(host.states, 0).token = "changed";
              return { resource: yield* owner.hostResource(A.getUnsafe(host.states, 0)) };
            }
            return yield* defaults.id(input);
          }),
        });
        const result = yield* runPreparedCitationCallbackSession(prepared).pipe(
          Effect.provideService(CitationResolutionWork, work),
          Effect.provideService(CitationCallbackDictionary, owner),
          Effect.provideService(CitationResolutionCallbacks, callbacks)
        );
        expect(
          A.map(result.decisions, (decision) => ({
            mention: indexOf(decision.mentionId),
            callback: decision.callback,
            resource: present(decision.resource),
            assignment: O.getOrNull(
              O.map(decision.assignment, (assignment) => ({ ...assignment, resource: present(assignment.resource) }))
            ),
          })),
          row.name
        ).toEqual(row.decisions);
        expect(
          A.map(result.groups, (group) => ({
            entrySlot: group.entrySlot,
            listSlot: group.listSlot,
            resource: present(group.resource),
            members: A.map(group.members, (member) => (member._tag === "Mention" ? indexOf(member.mentionId) : -1)),
          })),
          row.name
        ).toEqual(row.groups);
        const crypto = yield* Crypto.Crypto;
        let described = 0;
        const descriptors = CitationSessionResourceDescriptors.of({
          describe: Effect.fn("SessionProjectionTest.describe")(
            function* (resource: CitationCallbackResource) {
              described += 1;
              if (resource._tag !== "Registered") return yield* bad();
              const value = yield* S.decodeUnknownEffect(S.Struct({ token: S.String }))(resource.value).pipe(
                Effect.mapError(bad)
              );
              const key = yield* S.decodeEffect(Sha256HexFromBytes)(
                new TextEncoder().encode(`controlled-host-token/v1:${value.token}`)
              ).pipe(Effect.mapError(bad));
              return CitationResourceIdentity.cases.External.make({ scope: prepared.engineArtifact, key });
            },
            Effect.provideService(Crypto.Crypto, crypto)
          ),
        });
        const projector = yield* makeCitationSessionDocumentProjector().pipe(
          Effect.provideService(CitationSessionResourceDescriptors, descriptors)
        );
        expect((yield* Effect.flip(projector.project({ ...result }))).reason).toBe("identity-failed");
        expect(described).toBe(0);
        const output = yield* projector.project(result);
        expect(described).toBe(
          A.length(
            A.dedupe(
              A.getSomes(
                A.map(result.decisions, (decision) =>
                  decision.resource._tag === "Registered" ? O.some(decision.resource.slot) : O.none<number>()
                )
              )
            )
          )
        );
        const nativeIndex = (member: CitationGroupMember) =>
          member._tag === "Mention" ? indexOf(member.mentionId) : -1;
        const listById = (id: (typeof output.document.memberLists)[number]["id"]) =>
          O.getOrThrow(A.findFirst(output.document.memberLists, (list) => list.id === id));
        expect(
          A.map(output.document.groups, (group) => A.map(listById(group.memberListId).members, nativeIndex)),
          row.name
        ).toEqual(A.map(row.groups, (group) => group.members));
        expect(
          A.map(output.document.resolutions, (resolution) => resolution.status),
          row.name
        ).toEqual(
          A.map(result.decisions, (decision) => (decision.resource._tag === "None" ? "Unresolved" : "Resolved"))
        );
        for (const resolution of output.document.resolutions)
          if (resolution.status === "Unresolved")
            expect(resolution.reason).toBe(
              A.getUnsafe(result.decisions, indexOf(resolution.mentionId)).callback === "unknown"
                ? "unsupported-citation"
                : "callback-unresolved"
            );
        const restored = yield* restoreCitationDocument({
          receipt: output.receipt,
          editions: [],
          resourceBindings: output.resourceBindings,
          expectedSource: prepared.source,
          expectedEngineArtifact: prepared.engineArtifact,
          sourceText: A.join("")(A.map(prepared.mentions, (_, index) => `witness-${index}; `)),
        });
        expect(restored.groups).toEqual(output.document.groups);
        expect(restored.memberLists).toEqual(output.document.memberLists);
        expect(restored.resolutions).toEqual(output.document.resolutions);
        if (row.action === "equal") {
          expect(A.getUnsafe(output.document.mentions, 0).anchor).toBe(A.getUnsafe(prepared.mentions, 0).anchor);
          expect(A.getUnsafe(A.getUnsafe(output.document.mentions, 0).components, 0).anchor).toBe(
            A.getUnsafe(prepared.mentions, 0).anchor
          );
          expect(O.getOrThrow(A.getUnsafe(output.document.mentions, 0).footnote).label).toEqual(O.some("n1"));
        }
        if (row.action === "equal") {
          const opaque = CitationSessionResourceDescriptors.of({
            describe: Effect.fn("SessionProjectionTest.opaqueIdentity")(
              function* (resource: CitationCallbackResource) {
                if (resource._tag !== "Registered") return yield* bad();
                const value = yield* S.decodeUnknownEffect(S.Struct({ slot: S.Natural }))(resource.value).pipe(
                  Effect.mapError(bad)
                );
                const key = yield* S.decodeEffect(Sha256HexFromBytes)(
                  new TextEncoder().encode(`controlled-host-object/v1:${value.slot}`)
                ).pipe(Effect.mapError(bad));
                return CitationResourceIdentity.cases.External.make({ scope: prepared.engineArtifact, key });
              },
              Effect.provideService(Crypto.Crypto, crypto)
            ),
          });
          const opaqueProjector = yield* makeCitationSessionDocumentProjector().pipe(
            Effect.provideService(CitationSessionResourceDescriptors, opaque)
          );
          const distinct = yield* opaqueProjector.project(result);
          expect(distinct.document.authorities).toHaveLength(2);
          const first = A.getUnsafe(distinct.document.resolutions, 0);
          const second = A.getUnsafe(distinct.document.resolutions, 1);
          expect(
            first.status === "Resolved" && second.status === "Resolved" && first.authorityId !== second.authorityId
          ).toBe(true);
          expect(
            first.status === "Resolved" && A.getUnsafe(distinct.document.groups, 0).authorityId === first.authorityId
          ).toBe(true);
          expect(A.getUnsafe(distinct.document.memberLists, 0).members).toHaveLength(2);
          const restoredDistinct = yield* restoreCitationDocument({
            receipt: distinct.receipt,
            editions: [],
            resourceBindings: distinct.resourceBindings,
            expectedSource: prepared.source,
            expectedEngineArtifact: prepared.engineArtifact,
            sourceText: A.join("")(A.map(prepared.mentions, (_, index) => `witness-${index}; `)),
          });
          expect(restoredDistinct.resolutions).toEqual(distinct.document.resolutions);
        }
        if (row.action === "equal") {
          const sensitive = CitationCallbackFailure.make({ reason: "callback-failed" });
          Reflect.set(sensitive, "message", "private-source-sentinel");
          Reflect.set(sensitive, "detail", "private-source-sentinel");
          const failedProjector = yield* makeCitationSessionDocumentProjector().pipe(
            Effect.provideService(
              CitationSessionResourceDescriptors,
              CitationSessionResourceDescriptors.of({
                describe: Effect.fn("SessionProjectionTest.failedDescriptor")(() => Effect.fail(sensitive)),
              })
            )
          );
          const sanitized = yield* Effect.flip(failedProjector.project(result));
          expect(sanitized.reason).toBe("identity-failed");
          expect("detail" in sanitized).toBe(false);
          expect(sanitized.message).not.toContain("private-source-sentinel");
        }
        const before = output.receipt;
        Reflect.set(result, "decisions", []);
        Reflect.set(result, "groups", []);
        const again = yield* projector.project(result);
        expect(again.receipt, row.name).toEqual(before);
        expect(host.trace(), row.name).toEqual(row.trace);
        count += A.length(output.document.resolutions);
      }
      expect(count).toBe(19);
    })
  );
  it.effect("matches the source's truth/hash call order through full and default Id callbacks", () =>
    Effect.gen(function* () {
      const corpus = yield* load();
      const frozen = yield* makeCitationFrozenEditions((yield* loadCitationFrozenEditionFixtures()).bundle);
      for (const row of corpus.callbacks) {
        const host = harness([row.host], corpus.normalizedHashes);
        const factory = yield* makeCitationCallbackRuntimeIndexFactory().pipe(
          Effect.provideService(CitationFrozenEditions, frozen),
          Effect.provideService(CitationHostResourceAdapterFactory, host.factory)
        );
        const prepared = yield* prepare(row.name);
        const work = yield* makeCitationResolutionWork(prepared.limits);
        const owner = yield* makeCitationCallbackDictionary(prepared).pipe(
          Effect.provideService(CitationResolutionWork, work),
          Effect.provideService(CitationCallbackRuntimeIndexFactory, factory)
        );
        const defaults = yield* makeDefaultCitationResolutionCallbacks(prepared).pipe(
          Effect.provideService(CitationResolutionWork, work),
          Effect.provideService(CitationCallbackDictionary, owner)
        );
        const callbacks = CitationResolutionCallbacks.of({
          ...defaults,
          full: Effect.fn("HostTest.full")(() => owner.hostResource(A.getUnsafe(host.states, 0))),
        });
        const result = yield* runPreparedCitationCallbackSession(prepared).pipe(
          Effect.provideService(CitationResolutionWork, work),
          Effect.provideService(CitationCallbackDictionary, owner),
          Effect.provideService(CitationResolutionCallbacks, callbacks)
        );
        expect(host.trace(), row.name).toEqual(row.trace);
        expect(
          A.map(result.groups, (group) =>
            A.map(group.members, (member) =>
              O.getOrElse(
                A.findFirstIndex(
                  prepared.mentions,
                  (mention) => member._tag === "Mention" && mention.id === member.mentionId
                ),
                () => -1
              )
            )
          ),
          row.name
        ).toEqual(row.groups);
      }
    })
  );
  it.effect("matches source set uniqueness and exact hooks through default short, supra and reference callbacks", () =>
    Effect.gen(function* () {
      const raw = yield* (yield* FileSystem.FileSystem).readFileString(
        fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/runtime-set.json", import.meta.url))
      );
      expect(yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(raw))).toBe(
        "58ca087e488c94d2db5b6dfef2dfe1d0280f18228b6088a61b14b227d536adfa"
      );
      const corpus = yield* S.decodeEffect(
        S.fromJsonString(
          S.Struct({
            callbacks: S.Array(
              S.Struct({
                name: S.String,
                kind: S.Literals(["short", "supra", "reference"]),
                fullNames: S.Array(S.String),
                antecedentGuess: S.NullOr(S.String),
                hosts: S.Array(HostState),
                returns: S.Array(S.Natural),
                trace: S.Array(S.Json),
                groups: S.Natural.pipe(S.Array, S.Array),
              })
            ),
          })
        )
      )(raw);
      expect(corpus.callbacks).toHaveLength(12);
      const frozen = yield* makeCitationFrozenEditions((yield* loadCitationFrozenEditionFixtures()).bundle);
      for (const row of corpus.callbacks) {
        const host = harness(row.hosts, { "7": "7" });
        const factory = yield* makeCitationCallbackRuntimeIndexFactory().pipe(
          Effect.provideService(CitationFrozenEditions, frozen),
          Effect.provideService(CitationHostResourceAdapterFactory, host.factory)
        );
        const input = yield* prepareCallbackObservation(
          CitationCallbackObservation.make({
            name: row.name,
            kinds: ["case", "case", row.kind],
            pages: {},
            bindings: {},
            events: [],
            outcome: { status: "value", groups: [] },
          })
        );
        const mentions = yield* Effect.forEach(input.mentions, (mention, index) =>
          Effect.gen(function* () {
            const wire = yield* S.encodeEffect(Citation)(mention.citation);
            const citation = yield* S.decodeUnknownEffect(Citation)({
              ...wire,
              components:
                wire.type === "case" || wire.type === "shortFormCase"
                  ? { volume: "1", reporter: "U.S.", page: index === 0 ? "1" : "2" }
                  : wire.components,
              metadata: {
                ...wire.metadata,
                ...(wire.type === "case"
                  ? { plaintiff: A.getUnsafe(row.fullNames, index) }
                  : wire.type === "reference"
                    ? { plaintiff: "Alpha" }
                    : {}),
                ...(wire.type === "shortFormCase" || wire.type === "supra"
                  ? { antecedentGuess: row.antecedentGuess }
                  : {}),
                pinCite: index < 2 ? null : "2",
              },
            });
            return CitationMention.make({ ...mention, citation });
          })
        );
        const prepared = yield* prepareCitationResolution({ ...input, mentions });
        const work = yield* makeCitationResolutionWork(prepared.limits);
        const owner = yield* makeCitationCallbackDictionary(prepared).pipe(
          Effect.provideService(CitationResolutionWork, work),
          Effect.provideService(CitationCallbackRuntimeIndexFactory, factory)
        );
        const defaults = yield* makeDefaultCitationResolutionCallbacks(prepared).pipe(
          Effect.provideService(CitationResolutionWork, work),
          Effect.provideService(CitationCallbackDictionary, owner)
        );
        const callbacks = CitationResolutionCallbacks.of({
          ...defaults,
          full: Effect.fn("HostSetTest.full")(function* (mention: CitationMention) {
            const index = O.getOrElse(
              A.findFirstIndex(prepared.mentions, (candidate) => candidate.id === mention.id),
              () => -1
            );
            return yield* owner.hostResource(A.getUnsafe(host.states, A.getUnsafe(row.returns, index)));
          }),
        });
        const result = yield* runPreparedCitationCallbackSession(prepared).pipe(
          Effect.provideService(CitationResolutionWork, work),
          Effect.provideService(CitationCallbackDictionary, owner),
          Effect.provideService(CitationResolutionCallbacks, callbacks)
        );
        expect(host.trace(), row.name).toEqual(row.trace);
        expect(
          A.map(result.groups, (group) =>
            A.map(group.members, (member) =>
              O.getOrElse(
                A.findFirstIndex(
                  prepared.mentions,
                  (mention) => member._tag === "Mention" && mention.id === member.mentionId
                ),
                () => -1
              )
            )
          ),
          row.name
        ).toEqual(row.groups);
      }
    })
  );
  it.effect("matches all directional comparison, mutation, alias and error histories without observer hooks", () =>
    Effect.gen(function* () {
      const corpus = yield* load();
      const frozen = yield* makeCitationFrozenEditions((yield* loadCitationFrozenEditionFixtures()).bundle);
      for (const row of corpus.cases) {
        const host = harness(row.hosts, corpus.normalizedHashes);
        const factory = yield* makeCitationCallbackRuntimeIndexFactory().pipe(
          Effect.provideService(CitationFrozenEditions, frozen),
          Effect.provideService(CitationHostResourceAdapterFactory, host.factory)
        );
        const prepared = yield* prepare(row.name);
        const work = yield* makeCitationResolutionWork(prepared.limits);
        const owner = yield* makeCitationCallbackDictionary(prepared).pipe(
          Effect.provideService(CitationResolutionWork, work),
          Effect.provideService(CitationCallbackRuntimeIndexFactory, factory)
        );
        const members = A.map(prepared.mentions, (mention) =>
          CitationGroupMember.cases.Mention.make({ mentionId: mention.id })
        );
        const ref = A.getUnsafe(members, 0);
        const memberIndex = (member: CitationGroupMember) =>
          O.getOrElse(
            A.findFirstIndex(members, (candidate) => S.toEquivalence(CitationGroupMember)(candidate, member)),
            () => -1
          );
        yield* Effect.acquireUseRelease(
          owner.start,
          () =>
            Effect.gen(function* () {
              let keys = yield* Effect.forEach(row.keys, (key) =>
                key.kind === "canonical"
                  ? owner.canonicalResource(ref)
                  : owner.hostResource(A.getUnsafe(host.states, key.host))
              );
              const lists = yield* Effect.forEach(
                A.makeBy(4, (i) => i),
                () => owner.allocate([])
              );
              const prior = yield* owner.hostResource(A.getUnsafe(host.states, 0));
              yield* owner.writeFulls([yield* owner.createFullPair(ref, prior)]);
              const action = Effect.fn("HostTest.action")(function* (
                op: typeof Operation.Type
              ): Effect.fn.Return<number | null, CitationCallbackFailure> {
                switch (op.kind) {
                  case "set":
                    yield* owner.set(A.getUnsafe(keys, op.key), A.getUnsafe(lists, op.value));
                    return null;
                  case "get":
                    return (yield* owner.get(A.getUnsafe(keys, op.key))).slot;
                  case "remove":
                    return O.getOrNull(O.map(yield* owner.remove(A.getUnsafe(keys, op.key)), (list) => list.slot));
                  case "clear":
                    yield* owner.clear;
                    return null;
                  case "alias": {
                    const key = A.getUnsafe(keys, op.key);
                    const alias = yield* owner.hostResource(A.getUnsafe(host.states, 0));
                    keys = A.append(keys, alias);
                    if (key._tag !== "Registered") return yield* bad();
                    return key.slot;
                  }
                  case "append": {
                    const key = A.getUnsafe(keys, op.key);
                    if (yield* owner.isTruthy(key))
                      yield* owner.appendCurrent(key, A.getUnsafe(prepared.mentions, op.member).id);
                    return null;
                  }
                  case "page": {
                    const wire = yield* S.encodeEffect(Citation)(yield* owner.citationOf(ref)).pipe(
                      Effect.mapError(bad)
                    );
                    yield* owner.writeCitation(
                      ref,
                      yield* S.decodeEffect(Citation)({
                        ...wire,
                        components: { ...wire.components, page: op.value },
                      }).pipe(Effect.mapError(bad))
                    );
                    return null;
                  }
                  case "truth":
                    A.getUnsafe(host.states, op.host).truth = op.value;
                    return null;
                  case "hashRaw":
                    A.getUnsafe(host.states, op.host).hashRaw = op.value;
                    return null;
                  case "token":
                    A.getUnsafe(host.states, op.host).token = op.value;
                    return null;
                  case "flag":
                    A.getUnsafe(host.states, op.host)[op.field] = op.value;
                    return null;
                }
              });
              for (const [index, event] of A.map(row.events, (event, index) => [index, event] as const)) {
                const label = `${row.name}:${index}`;
                host.reset();
                const result = yield* Effect.result(action(event.operation));
                if (Result.isFailure(result)) {
                  expect(
                    S.is(S.Struct({ status: S.Literal("error") }))(event.outcome),
                    `${label}:${result.failure.reason}`
                  ).toBe(true);
                  const expected = yield* S.decodeUnknownEffect(
                    S.Struct({ status: S.Literal("error"), operation: S.Literals(["hash", "bool", "compare"]) })
                  )(event.outcome);
                  expect(result.failure.reason, label).toBe(
                    expected.operation === "compare" ? "identity-failed" : "callback-failed"
                  );
                } else expect({ status: "value", result: result.success }, label).toEqual(event.outcome);
                const entries = yield* owner.read;
                expect(
                  A.map(entries, (group) => {
                    const resource = group.resource;
                    if (resource._tag !== "Registered") throw new Error("unregistered");
                    return {
                      objectId: resource.slot,
                      slot: group.listSlot,
                      presentation: S.is(S.Struct({ kind: S.Literal("host") }))(resource.value)
                        ? resource.value
                        : { kind: "canonical", slot: resource.slot },
                    };
                  }),
                  label
                ).toEqual(event.entries);
                expect(
                  A.map(yield* owner.readListNodes, (list) => A.map(list, memberIndex)),
                  label
                ).toEqual(event.lists);
                const pairs = yield* owner.readFulls;
                const resource = A.getUnsafe(pairs, 0).resource;
                expect(resource._tag === "Registered" ? resource.value : null, label).toEqual(event.priorPresentation);
                yield* owner.writeFulls(pairs);
                expect(host.trace(), label).toEqual(event.trace);
              }
            }),
          () => owner.close
        );
      }
    })
  );
});
