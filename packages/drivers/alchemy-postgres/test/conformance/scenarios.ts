/**
 * Platform conformance suite (goals/alchemy-vault-sync-slice, PR 2a): the same
 * aggregate and policy scenarios run against `Domain.InMemory` (the reference)
 * and the Postgres driver, so the driver is held to the upstream semantics.
 *
 * Scenarios run with the live clock: the platforms fire scheduled commands and
 * drain deliveries on their own clocks, in background fibers the tests do not own.
 */
import * as Domain from "@alchemy.run/domain";
import { Internals } from "@alchemy.run/domain/Model";
import { describe, expect, layer } from "@effect/vitest";
import { assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import type * as DomainPlatform from "@alchemy.run/domain/Platform";

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

/** Policy runs by source account id, across every build in this test file. */
const policyRuns = MutableHashMap.empty<string, number>();
const countRun = (id: string) => {
  const run = O.getOrElse(MutableHashMap.get(policyRuns, id), () => 0) + 1;
  MutableHashMap.set(policyRuns, id, run);
  return run;
};
const runsOf = (id: string) => O.getOrElse(MutableHashMap.get(policyRuns, id), () => 0);

class LedgerProvisioning extends Domain.Policy("LedgerProvisioning", { from: Account, on: [AccountOpened] }) {}
const LedgerProvisioningLive = LedgerProvisioning.toLayer(
  Effect.gen(function* () {
    const ledgers = yield* Ledger;
    return Effect.fn(function* ({ source, event }) {
      const run = countRun(source.id);
      // The first run for a `flaky-*` account dies: a platform that redelivers runs it again.
      if (Str.startsWith("flaky-")(source.id) && run === 1) return yield* Effect.die("flaky policy run");
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
  /** Whether a second build sees what the first committed, and two builds share one store. */
  readonly durable: boolean;
  readonly name: string;
  /** Builds a fresh platform instance on the shared backing storage. */
  readonly platform: Layer.Layer<Domain.Platform, PE, R>;
  /** Whether a delivery whose policy run failed is delivered again (InMemory logs and drops it). */
  readonly redelivers: boolean;
  /** Reads a scheduled command's stored status, for platforms that expose their storage. */
  readonly scheduleStatus?: (aggregate: string, id: string, commandId: string) => Effect.Effect<string, never, R>;
}

/** The built model's store of one aggregate. */
const storeOf = Effect.fnUntraced(function* (aggregate: string) {
  const internals = yield* Internals;
  return yield* Effect.fromOption(O.fromUndefinedOr(internals.aggregates.get(aggregate)));
});

const eventsOf = (store: DomainPlatform.AggregateStore, id: string) =>
  O.match(O.fromUndefinedOr(store.events), {
    onNone: () => Effect.succeed<ReadonlyArray<DomainPlatform.StoredEvent>>([]),
    onSome: (events) => events(id),
  });

const user = { principal: "user_1", sourceKind: "user" } as const;
const asUser = Effect.provideService(CurrentActor, user);

/** Poll until `predicate` holds, failing after `limit`. */
const eventually = <A, E, R>(effect: Effect.Effect<A, E, R>, predicate: (value: A) => boolean) =>
  effect.pipe(
    Effect.repeat({ until: predicate, schedule: Schedule.spaced(Duration.millis(20)) }),
    Effect.timeout(Duration.seconds(3))
  );

/** Command ids that the wrapped kit rejects, standing in for a decide that refuses at fire time. */
const refusedPrefix = "refused-";

/**
 * Wrap a platform so every command whose id starts with {@link refusedPrefix}
 * is rejected by the kernel. Scheduled commands cannot declare rejections, so
 * this is how a scenario reaches a scheduled command whose commit is rejected.
 */
const refusing = <E, R>(platform: Layer.Layer<Domain.Platform, E, R>) =>
  Layer.effect(Domain.Platform)(
    Effect.gen(function* () {
      const inner = yield* Domain.Platform;
      const refuse = (kit: DomainPlatform.AggregateKit): DomainPlatform.AggregateKit =>
        // The models here have no views or projections, so the kit's `targets` is final when copied.
        ({
          ...kit,
          handle: (input) =>
            Str.startsWith(refusedPrefix)(input.commandId)
              ? Effect.succeed({ _tag: "Rejected", rejection: { _tag: "Refused" } })
              : kit.handle(input),
        });
      return Domain.Platform.of({
        model: Effect.fn("test.refusing.model")(function* (hosted: DomainPlatform.HostedModel) {
          const host = yield* inner.model(hosted);
          return {
            ...host,
            aggregate: (definition: Domain.Aggregate.Any, kit: DomainPlatform.AggregateKit) =>
              host.aggregate(definition, refuse(kit)),
          };
        }),
      });
    })
  ).pipe(Layer.provide(platform));

const isOpen = (state: typeof AccountState.Type) => state._tag === "Open";

/** Register every conformance scenario for one platform. */
export const conformance = <R, E, PE>(target: ConformanceTarget<R, E, PE>) => {
  const hosted = Conformance.layer(LedgerProvisioningLive).pipe(
    Layer.provideMerge(refusing(target.platform)),
    Layer.provideMerge(target.base)
  );
  describe(`Platform conformance: ${target.name}`, () => {
    // Sequential: several scenarios build a second platform on the same store, whose workers
    // would otherwise deliver or fire another scenario's rows while it runs.
    layer(hosted, { timeout: "30 seconds", excludeTestServices: true, concurrent: false })("scenarios", (it) => {
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

          // Due at a point in time rather than after a delay: it fires the same way.
          const now = yield* DateTime.now;
          const soon = DateTime.add(now, { milliseconds: 100 });
          yield* accounts.schedule(id, Remind.make({}), { at: soon, commandId: "remind-at" });
          yield* eventually(accounts.state(id), (state) => state._tag === "Open" && state.reminders >= 2);

          yield* accounts.schedule(id, Remind.make({}), { after: "100 millis", commandId: "remind-3" });
          yield* accounts.unschedule(id, "remind-3");
          yield* Effect.sleep(Duration.millis(400));
          const state6 = yield* accounts.state(id);
          deepStrictEqual(state6, { _tag: "Open", owner: "fay", balance: 0, reminders: 2 });
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
                // Refusing as well: while it is open, this build's workers fire the suite's schedules too.
                Conformance.layer(LedgerProvisioningLive).pipe(
                  Layer.provide(target.platform.pipe(refusing, Layer.fresh))
                )
              );
              return yield* Context.get(context, Account).state(id);
            }).pipe(Effect.scoped);
            deepStrictEqual(
              rebuilt,
              target.durable ? { _tag: "Open", owner: "gus", balance: 7, reminders: 0 } : { _tag: "Unopened" }
            );
          })
      );

      it.effect("a scheduled command sent early under its command id does not run again", () =>
        Effect.gen(function* () {
          const accounts = yield* Account;
          const id = AccountId.make("sent-early");
          yield* accounts.send(id, OpenAccount.make({ owner: "jay" })).pipe(asUser);
          yield* accounts.schedule(id, Remind.make({}), { after: "100 millis", commandId: "early" });
          yield* accounts.send(id, Remind.make({}), { commandId: "early" }).pipe(asUser);
          yield* Effect.sleep(Duration.millis(400));
          const state = yield* accounts.state(id);
          deepStrictEqual(state, { _tag: "Open", owner: "jay", balance: 0, reminders: 1 });
          const executed = yield* accounts.unschedule(id, "early").pipe(Effect.flip);
          strictEqual(executed._tag, "AlreadyExecuted");
        })
      );

      it.effect("a scheduled command whose commit is rejected frees its command id", () =>
        Effect.gen(function* () {
          const accounts = yield* Account;
          const id = AccountId.make("refused");
          const commandId = `${refusedPrefix}remind`;
          yield* accounts.send(id, OpenAccount.make({ owner: "kim" })).pipe(asUser);
          yield* accounts.schedule(id, Remind.make({}), { after: "50 millis", commandId });
          yield* Effect.sleep(Duration.millis(400));
          const state = yield* accounts.state(id);
          deepStrictEqual(state, { _tag: "Open", owner: "kim", balance: 0, reminders: 0 });
          if (target.scheduleStatus !== undefined) {
            const status = yield* target.scheduleStatus("Account", id, commandId);
            strictEqual(status, "rejected");
          }
          // No receipt was written: nothing to cancel, and the id can be scheduled again.
          const nothing = yield* accounts.unschedule(id, commandId).pipe(Effect.flip);
          strictEqual(nothing._tag, "NotScheduled");
          const again = yield* accounts.schedule(id, Remind.make({}), { after: "1 hour", commandId });
          strictEqual(again.commandId, commandId);
          yield* accounts.unschedule(id, commandId);
        })
      );

      it.effect(
        target.redelivers
          ? "a policy run that fails is delivered again and its command applies once"
          : "a policy run that fails is dropped",
        () =>
          Effect.gen(function* () {
            const accounts = yield* Account;
            const ledgers = yield* Ledger;
            const id = AccountId.make("flaky-ledger");
            yield* accounts.send(id, OpenAccount.make({ owner: "lee" })).pipe(asUser);
            if (target.redelivers) {
              const ledger = yield* eventually(ledgers.state(id), (state) => state._tag === "Created");
              deepStrictEqual(ledger, { _tag: "Created", owner: "lee" });
              yield* Effect.sleep(Duration.millis(200));
              strictEqual(runsOf(id), 2);
            } else {
              yield* Effect.sleep(Duration.millis(300));
              strictEqual(runsOf(id), 1);
            }
            const store = yield* storeOf("Ledger");
            const events = yield* eventsOf(store, id);
            strictEqual(A.length(events), target.redelivers ? 1 : 0);
          })
      );

      if (target.durable) {
        it.effect("two platform builds on one store run each policy delivery once", () =>
          Effect.gen(function* () {
            const here = yield* Account;
            const ledgers = yield* Ledger;
            const context = yield* Layer.build(
              Conformance.layer(LedgerProvisioningLive).pipe(Layer.provide(target.platform.pipe(refusing, Layer.fresh)))
            );
            const there = Context.get(context, Account);
            const ids = A.map(A.range(1, 12), (n) => AccountId.make(`burst-${n}`));
            yield* Effect.forEach(
              ids,
              (id, n) => (n % 2 === 0 ? here : there).send(id, OpenAccount.make({ owner: "mo" })).pipe(asUser),
              { concurrency: "unbounded", discard: true }
            );
            yield* Effect.forEach(ids, (id) => eventually(ledgers.state(id), (state) => state._tag === "Created"), {
              discard: true,
            });
            yield* Effect.sleep(Duration.millis(300));
            deepStrictEqual(
              A.map(ids, runsOf),
              A.map(ids, () => 1)
            );
          }).pipe(Effect.scoped)
        );
      }

      it.effect("seeded events build state and never trigger policies", () =>
        Effect.gen(function* () {
          const accounts = yield* Account;
          const ledgers = yield* Ledger;
          const internals = yield* Internals;
          const store = yield* storeOf("Account");
          const seed = yield* Effect.fromOption(O.fromUndefinedOr(store.seed));
          const id = AccountId.make("seeded");
          const opened = yield* internals.kernel.encodeEvent(AccountOpened.make({ owner: "nia" }));
          yield* seed(id, [opened]);
          const state = yield* accounts.state(id);
          deepStrictEqual(state, { _tag: "Open", owner: "nia", balance: 0, reminders: 0 });
          const events = yield* eventsOf(store, id);
          deepStrictEqual(
            A.map(events, ({ envelope }) => [envelope.seq, envelope.commandId]),
            [[1, "seed:seeded:0"]]
          );
          yield* Effect.sleep(Duration.millis(200));
          const ledger = yield* ledgers.state(id);
          deepStrictEqual(ledger, { _tag: "None" });
          strictEqual(runsOf(id), 0);
        })
      );

      it.effect("changes and tail stream what is stored, then what commits next", () =>
        Effect.gen(function* () {
          const accounts = yield* Account;
          const store = yield* storeOf("Account");
          const id = AccountId.make("streamed");
          yield* accounts.send(id, OpenAccount.make({ owner: "oli" })).pipe(asUser);
          const current = yield* Stream.runCollect(store.changes(id).pipe(Stream.take(1)));
          deepStrictEqual(
            A.map(current, ({ version }) => version),
            [1]
          );
          const changes = yield* Stream.runCollect(store.changes(id).pipe(Stream.take(2))).pipe(Effect.forkChild);
          const tail = yield* Stream.runCollect(store.tail(id, 0).pipe(Stream.take(2))).pipe(Effect.forkChild);
          yield* Effect.sleep(Duration.millis(100));
          yield* accounts.send(id, Deposit.make({ amount: 4 })).pipe(asUser);
          const versions = yield* Fiber.join(changes);
          const events = yield* Fiber.join(tail);
          deepStrictEqual(
            A.map(versions, ({ version }) => version),
            [1, 2]
          );
          deepStrictEqual(
            A.map(events, ({ envelope }) => envelope.seq),
            [1, 2]
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
