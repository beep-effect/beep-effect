/**
 * P0 spike (goals/alchemy-vault-sync-slice): what the kernel hands a Platform
 * driver, observed by wrapping `Domain.InMemory`.
 *
 * Findings this test pins:
 * - every `AggregateStore.send` receives `SendMeta.context`, the encoded request
 *   context (principal, source kind) the Session middleware provided, so a driver
 *   can persist provenance beside the event without the kernel envelope changing;
 * - the kernel envelope carries id, stream, seq, at, commandId, correlationId (and
 *   trace) only.
 */
import * as Domain from "@alchemy.run/domain";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import type * as Aggregate from "@alchemy.run/domain/Aggregate";
import type * as Platform from "@alchemy.run/domain/Platform";

const AccountId = S.String.pipe(S.brand("AccountId"));
const Actor = S.Struct({ principal: S.String, sourceKind: S.Literals(["user", "system"]) });
class CurrentActor extends Domain.RequestContext<CurrentActor>()("Spike/CurrentActor", Actor) {}
class AccountOpened extends Domain.Event("AccountOpened", { owner: S.String }) {}
class OpenAccount extends Domain.Command("OpenAccount", {
  target: AccountId,
  input: { owner: S.String },
  events: [AccountOpened],
}) {}
const State = S.Union([S.TaggedStruct("Unopened", {}), S.TaggedStruct("Open", { owner: S.String })]);
class Account extends Domain.Aggregate("Account", {
  id: AccountId,
  state: State,
  initial: { _tag: "Unopened" },
  commands: [OpenAccount],
  decide: { OpenAccount: (_state, command) => [AccountOpened.make({ owner: command.owner })] },
  evolve: { AccountOpened: (_state, event) => ({ _tag: "Open" as const, owner: event.owner }) },
}) {}
class Spike extends Domain.Model("Spike", { aggregates: [Account] }) {}

interface Seen {
  readonly meta: Aggregate.SendMeta;
  readonly stored: ReadonlyArray<Platform.StoredEvent>;
}

/** What the kernel handed the wrapped platform, in send order. */
const seen: Array<Seen> = [];

/** A platform that delegates to the ambient one and records every aggregate `send`. */
const Recording = Layer.effect(Domain.Platform)(
  Effect.gen(function* () {
    const inner = yield* Domain.Platform;
    const wrapStore = (store: Platform.AggregateStore): Platform.AggregateStore => ({
      ...store,
      send: (id, command, meta) =>
        Effect.tap(store.send(id, command, meta), () =>
          Effect.map(store.events === undefined ? Effect.succeed([]) : store.events(id), (stored) =>
            seen.push({ meta, stored })
          )
        ),
    });
    const wrapHost = (host: Platform.ModelHost): Platform.ModelHost => ({
      ...host,
      aggregate: (aggregate, kit) => Effect.map(host.aggregate(aggregate, kit), wrapStore),
    });
    const model = Effect.fn("Domain.Platform.model")((hosted: Platform.HostedModel) =>
      Effect.map(inner.model(hosted), wrapHost)
    );
    return Domain.Platform.of({ model });
  })
);

const SpikeLive = Spike.layer(Layer.empty).pipe(Layer.provide(Recording.pipe(Layer.provideMerge(Domain.InMemory))));

describe("alchemy beta.85 platform send metadata (P0 spike)", () => {
  it.layer(SpikeLive)("hosted on a recording InMemory platform", (it) => {
    it.effect("hands the driver the encoded request context with every send", () =>
      Effect.gen(function* () {
        const accounts = yield* Account;
        const receipt = yield* accounts
          .send(AccountId.make("a-1"), OpenAccount.make({ owner: "sam" }))
          .pipe(Effect.provideService(CurrentActor, { principal: "user_123", sourceKind: "user" }));
        expect(receipt.stream).toBe("Account/a-1");
        expect(receipt.version).toBe(1);

        expect(seen).toHaveLength(1);
        const first = A.headNonEmpty(seen as A.NonEmptyArray<Seen>);
        expect(first.meta.context).toEqual({ "Spike/CurrentActor": { principal: "user_123", sourceKind: "user" } });
        expect(first.meta.correlationId).toBe(first.meta.commandId);
        expect(first.stored).toHaveLength(1);
        const stored = A.headNonEmpty(first.stored as A.NonEmptyReadonlyArray<Platform.StoredEvent>);
        expect(stored.envelope).toEqual({
          id: "a-1",
          stream: "Account/a-1",
          seq: 1,
          commandId: first.meta.commandId,
          correlationId: first.meta.commandId,
          at: expect.any(Number),
          trace: expect.objectContaining({ traceId: expect.any(String) }),
        });
        expect(stored.event).toEqual({ _tag: "AccountOpened", owner: "sam" });
      })
    );
  });
});
