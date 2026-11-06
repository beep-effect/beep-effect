/**
 * Platform conformance suite (goals/alchemy-vault-sync-slice, PR 2a): the same
 * aggregate and policy scenarios run against `Domain.InMemory` (the reference)
 * and the Postgres driver, so the driver is held to the upstream semantics.
 *
 * Scenarios run with the live clock: the platforms fire scheduled commands and
 * drain deliveries on their own clocks, in background fibers the tests do not own.
 */
import * as Domain from "@alchemy.run/domain";
import { describe, expect, layer } from "@effect/vitest";
import { assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Order from "effect/Order";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";

const AccountId = S.String.pipe(S.brand("ConformanceAccountId"));
const Actor = S.Struct({ principal: S.String, sourceKind: S.Literals(["user", "system"]) });

/** The request context every scenario sends with; its key is the provenance mapping's `contextKey`. */
class CurrentActor extends Domain.RequestContext<CurrentActor>()("Conformance/CurrentActor", Actor) {}

/** `rejects` takes any tagged error class; a schema one constructs with `make`. */
class NotOpen extends S.TaggedError<NotOpen, { readonly brand: unique symbol }>()("NotOpen", {}) {}
class AccountOpened extends Domain.Event("AccountOpened", { owner: S.String }) {}
class MoneyDeposited extends Domain.Event("MoneyDeposited", { amount: S.Int }) {
  static readonly schemaVersion = 2;
}
class Reminded extends Domain.Event("Reminded", {}) {}

class OpenAccount extends Domain.Command("OpenAccount", {
  target: AccountId,
  input: { owner: S.String },
  events: [AccountOpened],
}) {}
class Deposit extends Domain.Command("Deposit", {
  target: AccountId,
  input: { amount: S.Int },
  events: [MoneyDeposited],
  rejects: [NotOpen],
}) {}
class Remind extends Domain.Command("Remind", { target: AccountId, input: {}, events: [Reminded] }) {}

const AccountState = S.Union([
  S.TaggedStruct("Unopened", {}),
  S.TaggedStruct("Open", { owner: S.String, balance: S.Int, reminders: S.Int }),
]);

class Account extends Domain.Aggregate("Account", {
  id: AccountId,
  state: AccountState,
  initial: { _tag: "Unopened" },
  commands: [OpenAccount, Deposit, Remind],
  decide: {
    OpenAccount: (_state, command) => [AccountOpened.make({ owner: command.owner })],
    Deposit: (state, command) =>
      state._tag === "Open" ? [MoneyDeposited.make({ amount: command.amount })] : NotOpen.make({}),
    Remind: () => [Reminded.make({})],
  },
  evolve: {
    AccountOpened: (_state, event) => ({ _tag: "Open" as const, owner: event.owner, balance: 0, reminders: 0 }),
    MoneyDeposited: (state, event) =>
      state._tag === "Open" ? { ...state, balance: state.balance + event.amount } : state,
    Reminded: (state) => (state._tag === "Open" ? { ...state, reminders: state.reminders + 1 } : state),
  },
}) {}

class LedgerCreated extends Domain.Event("LedgerCreated", { owner: S.String }) {}
class CreateLedger extends Domain.Command("CreateLedger", {
  target: AccountId,
  input: { owner: S.String },
  events: [LedgerCreated],
}) {}
class Ledger extends Domain.Aggregate("Ledger", {
  id: AccountId,
  state: S.Union([S.TaggedStruct("None", {}), S.TaggedStruct("Created", { owner: S.String })]),
  initial: { _tag: "None" },
  commands: [CreateLedger],
  decide: { CreateLedger: (_state, command) => [LedgerCreated.make({ owner: command.owner })] },
  evolve: { LedgerCreated: (_state, event) => ({ _tag: "Created" as const, owner: event.owner }) },
}) {}

class LedgerProvisioning extends Domain.Policy("LedgerProvisioning", { from: Account, on: [AccountOpened] }) {}
const LedgerProvisioningLive = LedgerProvisioning.toLayer(
  Effect.gen(function* () {
    const ledgers = yield* Ledger;
    return Effect.fn(function* ({ source, event }) {
      yield* ledgers.send(AccountId.make(source.id), CreateLedger.make({ owner: event.owner }));
    });
  })
);

class Conformance extends Domain.Model("Conformance", {
  aggregates: [Account, Ledger],
  policies: [LedgerProvisioning],
}) {}

/** Another model under the same name: hosting it next to `Conformance` must fail. */
class Impostor extends Domain.Model("Conformance", { aggregates: [Ledger] }) {}

/** One stored event row's provenance and schema version, as a durable platform keeps it. */
export interface EventAudit {
  readonly context: unknown;
  readonly principal: string | null;
  readonly schemaVersion: number;
  readonly sourceKind: string | null;
  readonly tag: string;
}

/** A platform under test, with the layer that provides its requirements once for the suite. */
export interface ConformanceTarget<R, E, PE> {
  /** Reads the stored event rows of one instance, for platforms that expose their storage. */
  readonly auditEvents?: (aggregate: string, id: string) => Effect.Effect<ReadonlyArray<EventAudit>, never, R>;
  /** Provides the platform's requirements (for example an in-process PGlite database). */
  readonly base: Layer.Layer<R, E>;
  /** Whether a second build sees what the first committed. */
  readonly durable: boolean;
  readonly name: string;
  /** Builds a fresh platform instance on the shared backing storage. */
  readonly platform: Layer.Layer<Domain.Platform, PE, R>;
}

const user = { principal: "user_1", sourceKind: "user" } as const;
const asUser = Effect.provideService(CurrentActor, user);

/** Poll until `predicate` holds, failing after `limit`. */
const eventually = <A, E, R>(effect: Effect.Effect<A, E, R>, predicate: (value: A) => boolean) =>
  effect.pipe(
    Effect.repeat({ until: predicate, schedule: Schedule.spaced(Duration.millis(20)) }),
    Effect.timeout(Duration.seconds(3))
  );

const isOpen = (state: typeof AccountState.Type) => state._tag === "Open";

/** Register every conformance scenario for one platform. */
export const conformance = <R, E, PE>(target: ConformanceTarget<R, E, PE>) => {
  const hosted = Conformance.layer(LedgerProvisioningLive).pipe(
    Layer.provideMerge(target.platform),
    Layer.provideMerge(target.base)
  );
  describe(`Platform conformance: ${target.name}`, () => {
    layer(hosted, { timeout: "30 seconds", excludeTestServices: true })((it) => {
      it.effect("an accepted command commits its events and state", () =>
        Effect.gen(function* () {
          const accounts = yield* Account;
          const id = AccountId.make("accepted");
          const receipt = yield* accounts.send(id, OpenAccount.make({ owner: "ada" })).pipe(asUser);
          strictEqual(receipt.stream, "Account/accepted");
          strictEqual(receipt.version, 1);
          deepStrictEqual(
            A.map(receipt.events, (event) => event._tag),
            ["AccountOpened"]
          );
          const state1 = yield* accounts.state(id);
          deepStrictEqual(state1, { _tag: "Open", owner: "ada", balance: 0, reminders: 0 });
        })
      );

      it.effect("a duplicate commandId returns the same receipt and commits once", () =>
        Effect.gen(function* () {
          const accounts = yield* Account;
          const id = AccountId.make("duplicate");
          yield* accounts.send(id, OpenAccount.make({ owner: "bo" })).pipe(asUser);
          const first = yield* accounts.send(id, Deposit.make({ amount: 5 }), { commandId: "dep-1" }).pipe(asUser);
          const second = yield* accounts.send(id, Deposit.make({ amount: 5 }), { commandId: "dep-1" }).pipe(asUser);
          deepStrictEqual(second, first);
          strictEqual(first.version, 2);
          const state2 = yield* accounts.state(id);
          deepStrictEqual(state2, { _tag: "Open", owner: "bo", balance: 5, reminders: 0 });
        })
      );

      it.effect("a rejection commits nothing", () =>
        Effect.gen(function* () {
          const accounts = yield* Account;
          const id = AccountId.make("rejected");
          const rejection = yield* accounts.send(id, Deposit.make({ amount: 1 })).pipe(asUser, Effect.flip);
          strictEqual(rejection._tag, "NotOpen");
          const state3 = yield* accounts.state(id);
          deepStrictEqual(state3, { _tag: "Unopened" });
          const opened = yield* accounts.send(id, OpenAccount.make({ owner: "cy" })).pipe(asUser);
          strictEqual(opened.version, 1);
        })
      );

      it.effect("concurrent sends to one id serialize without gaps", () =>
        Effect.gen(function* () {
          const accounts = yield* Account;
          const id = AccountId.make("concurrent");
          yield* accounts.send(id, OpenAccount.make({ owner: "di" })).pipe(asUser);
          const receipts = yield* Effect.forEach(
            A.range(1, 10),
            () => accounts.send(id, Deposit.make({ amount: 1 })).pipe(asUser),
            { concurrency: "unbounded" }
          );
          deepStrictEqual(
            A.sort(
              A.map(receipts, ({ version }) => version),
              Order.Number
            ),
            A.range(2, 11)
          );
          const state4 = yield* accounts.state(id);
          deepStrictEqual(state4, { _tag: "Open", owner: "di", balance: 10, reminders: 0 });
        })
      );

      it.effect("a policy reacts to an event and sends a command to another aggregate", () =>
        Effect.gen(function* () {
          const accounts = yield* Account;
          const ledgers = yield* Ledger;
          const id = AccountId.make("policy");
          yield* accounts.send(id, OpenAccount.make({ owner: "eve" })).pipe(asUser);
          const ledger = yield* eventually(ledgers.state(id), (state) => state._tag === "Created");
          deepStrictEqual(ledger, { _tag: "Created", owner: "eve" });
        })
      );

      it.effect("a scheduled command fires once and unschedule fails correctly", () =>
        Effect.gen(function* () {
          const accounts = yield* Account;
          const id = AccountId.make("scheduled");
          yield* accounts.send(id, OpenAccount.make({ owner: "fay" })).pipe(asUser);
          const scheduled = yield* accounts.schedule(id, Remind.make({}), {
            after: "150 millis",
            commandId: "remind-1",
          });
          strictEqual(scheduled.commandId, "remind-1");
          yield* eventually(accounts.state(id), (state) => state._tag === "Open" && state.reminders >= 1);
          yield* Effect.sleep(Duration.millis(300));
          const state5 = yield* accounts.state(id);
          deepStrictEqual(state5, { _tag: "Open", owner: "fay", balance: 0, reminders: 1 });

          const executed = yield* accounts.unschedule(id, "remind-1").pipe(Effect.flip);
          strictEqual(executed._tag, "AlreadyExecuted");
          const again = yield* accounts
            .schedule(id, Remind.make({}), { after: "1 second", commandId: "remind-1" })
            .pipe(Effect.flip);
          strictEqual(again._tag, "AlreadyExecuted");

          yield* accounts.schedule(id, Remind.make({}), { after: "1 hour", commandId: "remind-2" });
          yield* accounts.unschedule(id, "remind-2");
          const cancelled = yield* accounts.unschedule(id, "remind-2").pipe(Effect.flip);
          strictEqual(cancelled._tag, "AlreadyCancelled");
          const never = yield* accounts.unschedule(id, "remind-never").pipe(Effect.flip);
          strictEqual(never._tag, "NotScheduled");

          yield* accounts.schedule(id, Remind.make({}), { after: "100 millis", commandId: "remind-3" });
          yield* accounts.unschedule(id, "remind-3");
          yield* Effect.sleep(Duration.millis(400));
          const state6 = yield* accounts.state(id);
          deepStrictEqual(state6, { _tag: "Open", owner: "fay", balance: 0, reminders: 1 });
        })
      );

      it.effect("hosting another model under the same name fails", () =>
        Effect.gen(function* () {
          const cause = yield* Layer.build(Impostor.layer(Layer.empty)).pipe(
            Effect.scoped,
            Effect.sandbox,
            Effect.flip
          );
          expect(cause.pipe(Cause.pretty)).toContain("Model Conformance is hosted twice on one platform");
        })
      );

      it.effect(
        target.durable
          ? "committed state survives building the model a second time"
          : "a second build starts from empty storage",
        () =>
          Effect.gen(function* () {
            const accounts = yield* Account;
            const id = AccountId.make("durable");
            yield* accounts.send(id, OpenAccount.make({ owner: "gus" })).pipe(asUser);
            yield* accounts.send(id, Deposit.make({ amount: 7 })).pipe(asUser);
            const rebuilt = yield* Effect.gen(function* () {
              const context = yield* Layer.build(
                // Fresh: the suite's memo map would otherwise hand back the platform already built.
                Conformance.layer(LedgerProvisioningLive).pipe(Layer.provide(Layer.fresh(target.platform)))
              );
              return yield* Context.get(context, Account).state(id);
            }).pipe(Effect.scoped);
            deepStrictEqual(
              rebuilt,
              target.durable ? { _tag: "Open", owner: "gus", balance: 7, reminders: 0 } : { _tag: "Unopened" }
            );
          })
      );

      const auditEvents = target.auditEvents;
      if (auditEvents !== undefined) {
        it.effect("event rows hold the request context and each class's schema version", () =>
          Effect.gen(function* () {
            const accounts = yield* Account;
            const id = AccountId.make("audited");
            yield* accounts.send(id, OpenAccount.make({ owner: "hal" })).pipe(asUser);
            yield* accounts
              .send(id, Deposit.make({ amount: 3 }))
              .pipe(Effect.provideService(CurrentActor, { principal: "sync", sourceKind: "system" }));
            const rows = yield* auditEvents("Account", id);
            deepStrictEqual(rows, [
              {
                tag: "AccountOpened",
                schemaVersion: 1,
                principal: "user_1",
                sourceKind: "user",
                context: { "Conformance/CurrentActor": user },
              },
              {
                tag: "MoneyDeposited",
                schemaVersion: 2,
                principal: "sync",
                sourceKind: "system",
                context: { "Conformance/CurrentActor": { principal: "sync", sourceKind: "system" } },
              },
            ]);
            const final = yield* accounts.state(id);
            assertTrue(isOpen(final));
          })
        );
      }
    });
  });
};
