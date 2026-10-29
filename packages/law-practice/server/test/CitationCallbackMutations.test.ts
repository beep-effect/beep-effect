import { fileURLToPath } from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationCallbackFailure,
  CitationIdCallbackOutput,
  CitationResolutionCallbacks,
  CitationResolutionWork,
  makeCitationResolutionWork,
  runPreparedCitationCallbackSession,
} from "@beep/law-practice-server/_test/Citation/CallbackSession";
import { makeDefaultCitationResolutionCallbacks } from "@beep/law-practice-server/_test/Citation/DefaultCallbacks";
import { prepareCitationResolution } from "@beep/law-practice-server/_test/Citation/ResolutionInput";
import { LiteralKit, Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
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
]).pipe(
  $I.annoteSchema("KnownMutation", {
    description: "Ten known-input group-value scenes; alias/detached proof is explicitly separate.",
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
  detachedObjects: S.Array(S.Json),
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
  it.effect("preserves all ten known-input group values without claiming alias/detached projection", () =>
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
      const rows = A.filter(data.cases, (row) => row.family === "known-group");
      expect(A.length(rows)).toBe(10);
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
        const input = yield* prepareCallbackObservation(
          CitationCallbackObservation.make({
            name: `mutation-${row.name}`,
            kinds: row.kinds,
            pages: {},
            bindings: {},
            events: [],
            outcome: { status: "value", groups: [] },
          })
        );
        const prepared = yield* prepareCitationResolution(input);
        const work = yield* makeCitationResolutionWork(prepared.limits);
        const defaults = yield* makeDefaultCitationResolutionCallbacks(prepared).pipe(
          Effect.provideService(CitationResolutionWork, work)
        );
        const baseResource = yield* resource("base");
        const emptyResource = yield* resource("empty");
        const movedResource = yield* resource("moved");
        const otherResource = yield* resource("other");
        const zeroResource = yield* resource(0);
        const unusedResource = yield* resource("unused");
        const output = (value: CitationCallbackResource, groups: ReadonlyArray<CitationCallbackGroup>) =>
          CitationIdCallbackOutput.make({ resource: value, groups });
        const callbacks = CitationResolutionCallbacks.of({
          ...defaults,
          full: Effect.fn("MutationTest.full")(() => Effect.succeed(baseResource)),
          id: Effect.fn("MutationTest.id")(function* (arg: CitationIdCallbackInput) {
            const base = yield* Effect.fromOption(A.head(arg.groups), invalid);
            const first = A.getUnsafe(prepared.mentions, 0).id;
            const apply = Match.type<KnownMutation>().pipe(
              Match.when("create-empty", () =>
                Effect.succeed(output(none(), A.append(arg.groups, { resource: emptyResource, members: [] })))
              ),
              Match.when("clear-groups", () => Effect.succeed(output(none(), []))),
              Match.when("move-members", () =>
                Effect.succeed(output(movedResource, [{ resource: movedResource, members: base.members }]))
              ),
              Match.when("reverse-members", () =>
                Effect.succeed(output(base.resource, [{ ...base, members: A.reverse(base.members) }]))
              ),
              Match.when("duplicate-prior", () =>
                Effect.succeed(output(base.resource, [{ ...base, members: A.append(base.members, first) }]))
              ),
              Match.when("copy-to-second", () =>
                Effect.succeed(
                  output(base.resource, A.append(arg.groups, { resource: otherResource, members: [first] }))
                )
              ),
              Match.when("falsy-key", () =>
                Effect.succeed(output(none(), A.append(arg.groups, { resource: zeroResource, members: [] })))
              ),
              Match.when("none-key", () =>
                Effect.succeed(output(none(), A.append(arg.groups, { resource: none(), members: [first] })))
              ),
              Match.when("insert-current", () =>
                Effect.succeed(output(base.resource, [{ ...base, members: A.append(base.members, arg.mention.id) }]))
              ),
              Match.when("read-missing-default", () =>
                defaults.id({ ...arg, groups: A.append(arg.groups, { resource: unusedResource, members: [] }) })
              ),
              Match.exhaustive
            );
            return yield* apply(action);
          }),
        });
        const result = yield* runPreparedCitationCallbackSession(prepared).pipe(
          Effect.provideService(CitationResolutionWork, work),
          Effect.provideService(CitationResolutionCallbacks, callbacks)
        );
        const indices = HashMap.fromIterable(A.map(result.mentions, (mention, index) => Tuple.make(mention.id, index)));
        const actual = A.map(result.groups, (group) => ({
          resource: presentation(group.resource),
          members: A.map(group.members, (id) =>
            Member.cases.input.make({ index: O.getOrElse(HashMap.get(indices, id), () => -1) })
          ),
        }));
        // Source list identity is retained in the fixture but deliberately not
        // asserted by this value-only lane. Alias handling remains an open gate.
        expect(actual, row.name).toEqual(
          A.map(row.outcome.groups, (group) => ({ resource: group.resource, members: group.members }))
        );
      }
    })
  );
});
