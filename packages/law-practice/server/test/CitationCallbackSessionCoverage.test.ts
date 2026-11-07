import { Citation, CitationGroupMember } from "@beep/law-practice-domain/values";
import { CitationCallbackResult } from "@beep/law-practice-server/internal/Citation/CallbackResource";
import {
  CitationCallbackDictionary,
  CitationCallbackFailure,
  CitationResolutionCallbacks,
  CitationResolutionWork,
  makeCitationCallbackDictionary,
  makeCitationResolutionWork,
  runPreparedCitationCallbackSession,
} from "@beep/law-practice-server/internal/Citation/CallbackSession";
import { prepareCitationResolution } from "@beep/law-practice-server/internal/Citation/ResolutionInput";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import {
  callbackNoneResource as none,
  prepareCallbackObservation,
  CitationCallbackObservation as Row,
  normalizeCallbackFixtureResource as resource,
} from "./CitationCallbackSession.fixtures.ts";
import type { CitationMentionId } from "@beep/law-practice-domain/values";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";

const member = (mentionId: CitationMentionId) => CitationGroupMember.cases.Mention.make({ mentionId });
const exceeded = (limit: NonNullable<CitationCallbackFailure["limit"]>) =>
  CitationCallbackFailure.make({ reason: "limit-exceeded", limit });
const emptyResult = () => Effect.succeed(CitationCallbackResult.make({ resource: none() }));
const prepareControls = Effect.fn("CallbackCoverageTest.prepare")(function* (
  limits: (base: CitationEngineLimits) => Partial<CitationEngineLimits>
) {
  const input = yield* prepareCallbackObservation(
    Row.make({
      name: "callback-coverage",
      kinds: ["id", "id"],
      pages: {},
      bindings: {},
      events: [],
      outcome: { status: "value", groups: [] },
    })
  );
  return yield* prepareCitationResolution({ ...input, limits: { ...input.limits, ...limits(input.limits) } });
});
// Free steps isolate the dictionary's own slot ceilings from the shared work budget.
const unmeteredDictionary = Effect.fn("CallbackCoverageTest.unmetered")(function* (iterations: number) {
  const prepared = yield* prepareControls(() => ({ resolutionIterations: iterations }));
  const work = CitationResolutionWork.of({ maximum: iterations, step: Effect.void });
  const dictionary = yield* makeCitationCallbackDictionary(prepared).pipe(
    Effect.provideService(CitationResolutionWork, work)
  );
  yield* dictionary.start;
  return dictionary;
});

it.layer(Layer.mergeAll(BunCrypto.layer, BunFileSystem.layer))("callback session ceilings", (it) => {
  it.effect("bounds detached list allocation by the resolution iteration ceiling", () =>
    Effect.gen(function* () {
      const dictionary = yield* unmeteredDictionary(2);
      yield* dictionary.allocate([]);
      yield* dictionary.allocate([]);
      const refused = yield* dictionary.allocate([]).pipe(Effect.flip);
      deepStrictEqual(refused, exceeded("resolutionIterations"));
      const nodes = yield* dictionary.readListNodes;
      deepStrictEqual(nodes, [[], []]);
      yield* dictionary.close;
    })
  );

  it.effect("bounds new dictionary keys aliasing one list by the iteration ceiling without publishing them", () =>
    Effect.gen(function* () {
      const dictionary = yield* unmeteredDictionary(2);
      const list = yield* dictionary.allocate([]);
      const first = yield* resource("entry-first");
      const second = yield* resource("entry-second");
      const third = yield* resource("entry-third");
      yield* dictionary.set(first, list);
      yield* dictionary.set(second, list);
      const refused = yield* dictionary.set(third, list).pipe(Effect.flip);
      deepStrictEqual(refused, exceeded("resolutionIterations"));
      const groups = yield* dictionary.read;
      strictEqual(A.length(groups), 2);
      const nodes = yield* dictionary.readListNodes;
      deepStrictEqual(nodes, [[]]);
      yield* dictionary.close;
    })
  );

  it.effect("rewrites one detached citation in place and keeps its siblings and order", () =>
    Effect.gen(function* () {
      const prepared = yield* prepareControls(() => ({}));
      const work = yield* makeCitationResolutionWork(prepared.limits);
      const dictionary = yield* makeCitationCallbackDictionary(prepared).pipe(
        Effect.provideService(CitationResolutionWork, work)
      );
      yield* dictionary.start;
      const wire = yield* S.encodeEffect(Citation)(A.getUnsafe(prepared.mentions, 0).citation);
      const model = yield* S.decodeEffect(Citation)(wire);
      const sibling = yield* S.decodeEffect(Citation)(wire);
      const replacement = yield* S.decodeUnknownEffect(Citation)({
        ...wire,
        metadata: { ...wire.metadata, pinCite: "9" },
      });
      const first = yield* dictionary.registerDetached(model);
      const second = yield* dictionary.registerDetached(sibling);
      yield* dictionary.writeCitation(first, replacement);
      const objects = yield* dictionary.detachedCitations;
      deepStrictEqual(
        A.map(objects, (object) => CitationGroupMember.cases.Detached.make({ detachedId: object.id })),
        [first, second]
      );
      const rewritten = yield* dictionary.citationOf(first);
      const rewrittenWire = yield* S.encodeEffect(Citation)(rewritten);
      strictEqual(rewrittenWire.metadata.pinCite, "9");
      const kept = yield* dictionary.citationOf(second);
      const keptWire = yield* S.encodeEffect(Citation)(kept);
      deepStrictEqual(keptWire, wire);
      yield* dictionary.close;
    })
  );

  it.effect("refuses a supplied dictionary whose published groups exceed the edge ceiling", () =>
    Effect.gen(function* () {
      const prepared = yield* prepareControls(() => ({ resolutionEdges: 2 }));
      const work = yield* makeCitationResolutionWork(prepared.limits);
      const owned = yield* makeCitationCallbackDictionary(prepared).pipe(
        Effect.provideService(CitationResolutionWork, work)
      );
      // The owned dictionary stays within budget; its supplied view repeats each group.
      const inflated = CitationCallbackDictionary.of({
        ...owned,
        read: owned.read.pipe(Effect.map((groups) => A.appendAll(groups, groups))),
      });
      const base = yield* resource("inflated-base");
      const members = A.map(prepared.mentions, (mention) => member(mention.id));
      let calls = 0;
      let ownedEdges = 0;
      const callbacks = CitationResolutionCallbacks.of({
        full: Effect.fn("CallbackCoverageTest.full")(() => Effect.succeed(none())),
        shortCase: Effect.fn("CallbackCoverageTest.short")(emptyResult),
        supra: Effect.fn("CallbackCoverageTest.supra")(emptyResult),
        reference: Effect.fn("CallbackCoverageTest.reference")(emptyResult),
        id: Effect.fn("CallbackCoverageTest.id")(function* () {
          calls += 1;
          const list = yield* owned.get(base);
          yield* owned.write(list, members);
          const groups = yield* owned.read;
          ownedEdges = A.reduce(groups, 0, (count, group) => count + A.length(group.members));
          return CitationCallbackResult.make({ resource: none() });
        }),
      });
      const refused = yield* runPreparedCitationCallbackSession(prepared).pipe(
        Effect.provideService(CitationResolutionWork, work),
        Effect.provideService(CitationCallbackDictionary, inflated),
        Effect.provideService(CitationResolutionCallbacks, callbacks),
        Effect.flip
      );
      deepStrictEqual(refused, exceeded("resolutionEdges"));
      strictEqual(calls, 1);
      strictEqual(ownedEdges, 2);
      const closed = yield* owned.read.pipe(Effect.flip);
      strictEqual(closed.reason, "invalid-input");
    })
  );
});

const CitationType = S.toType(Citation);
const CitationJson = Citation.pipe(S.toCodecJson, S.fromJsonString);
const citationEquivalent = S.toEquivalence(CitationType);
it.effect.prop(
  "preserves detached citation values through their JSON wire form",
  { value: Arbitrary.schema(CitationType) },
  ({ value }) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(CitationJson)(value);
      const decoded = yield* S.decodeEffect(CitationJson)(encoded);
      assertTrue(citationEquivalent(value, decoded));
    }),
  { arbitrary: fcRuns(50) }
);
