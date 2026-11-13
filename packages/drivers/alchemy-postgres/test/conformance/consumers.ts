/**
 * Consumer conformance (goals/alchemy-vault-sync-slice, PR 2b): views,
 * projections, streams, catch-up and upcasting, run against `Domain.InMemory`
 * (the reference) and the Postgres driver from the same module.
 */

import * as Domain from "@alchemy.run/domain";
import { Internals } from "@alchemy.run/domain/Model";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { describe, layer } from "@effect/vitest";
import { deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import type * as DomainPlatform from "@alchemy.run/domain/Platform";

const CustomerId = S.String.pipe(S.brand("ShopCustomerId"));
const OrderId = S.String.pipe(S.brand("ShopOrderId"));

class CustomerJoined extends Domain.Event("CustomerJoined", { name: S.String }) {}
class JoinCustomer extends Domain.Command("JoinCustomer", {
  target: CustomerId,
  input: { name: S.String },
  events: [CustomerJoined],
}) {}
class Customer extends Domain.Aggregate("Customer", {
  id: CustomerId,
  state: S.Union([S.TaggedStruct("Stranger", {}), S.TaggedStruct("Member", { name: S.String })]),
  initial: { _tag: "Stranger" },
  commands: [JoinCustomer],
  decide: { JoinCustomer: (_state, command) => [CustomerJoined.make({ name: command.name })] },
  evolve: { CustomerJoined: (_state, event) => ({ _tag: "Member" as const, name: event.name }) },
}) {}

/** Version 2 added `amount`; a version 1 row reads back with no amount, as 0. */
class OrderPlaced extends Domain.Event("OrderPlaced", { customer: CustomerId, amount: S.Int }) {
  static readonly schemaVersion = 2;
  static readonly upcast = (fromVersion: number, json: unknown): unknown =>
    fromVersion === 1 && P.isObject(json) ? { ...json, amount: 0 } : json;
}
class PlaceOrder extends Domain.Command("PlaceOrder", {
  target: OrderId,
  input: { customer: CustomerId, amount: S.Int },
  events: [OrderPlaced],
}) {}
class Order extends Domain.Aggregate("Order", {
  id: OrderId,
  state: S.Union([S.TaggedStruct("Empty", {}), S.TaggedStruct("Placed", { customer: CustomerId, amount: S.Int })]),
  initial: { _tag: "Empty" },
  commands: [PlaceOrder],
  decide: {
    PlaceOrder: (_state, command) => [OrderPlaced.make({ customer: command.customer, amount: command.amount })],
  },
  evolve: {
    OrderPlaced: (_state, event) => ({ _tag: "Placed" as const, customer: event.customer, amount: event.amount }),
  },
}) {}

class Hidden extends S.TaggedError<Hidden, { readonly brand: unique symbol }>()("Hidden", {}) {}

/** Folds both aggregates' events into one row per customer; a customer named `hidden` is not readable. */
class CustomerTotals extends Domain.View("CustomerTotals", {
  from: [Customer, Order],
  key: Customer,
  rejects: [Hidden],
  state: S.Struct({ name: S.String, total: S.Int, orders: S.Int }),
  initial: { name: "", total: 0, orders: 0 },
  keyOf: { OrderPlaced: ({ event }) => Customer.ref(event.customer) },
  evolve: {
    CustomerJoined: (totals, event) => ({ ...totals, name: event.name }),
    OrderPlaced: (totals, event) => ({ ...totals, total: totals.total + event.amount, orders: totals.orders + 1 }),
  },
}) {}

const CustomerTotalsLive = CustomerTotals.toLayer(
  Effect.succeed(
    Effect.fnUntraced(function* (_request, totals) {
      if (totals?.name === "hidden") return yield* Hidden.make({});
    })
  )
);

class OrderNoted extends Domain.Event("OrderNoted", { order: S.String, amount: S.Int }) {}
class OrderFeed extends Domain.Stream("OrderFeed", { key: Customer, entries: [OrderNoted] }) {}

class OrderLedger extends Domain.Projection("OrderLedger", {
  from: [Order],
  key: Customer,
  on: [OrderPlaced],
  keyOf: { OrderPlaced: ({ event }) => Customer.ref(event.customer) },
  writes: [OrderFeed],
}) {}

/** The projection's port: rows written per event, and the size of every batch handed over. */
class LedgerRows extends Context.Service<
  LedgerRows,
  {
    readonly rows: MutableHashMap.MutableHashMap<string, number>;
    readonly batches: Array<number>;
  }
>()("@beep/alchemy-postgres/test/conformance/consumers/LedgerRows") {}
const LedgerRowsLive = Layer.sync(LedgerRows)(() => ({ rows: MutableHashMap.empty(), batches: [] }));
/** A port of its own, never shared through the suite's memo map. */
const freshRows = Layer.fresh(LedgerRowsLive);

const OrderLedgerLive = OrderLedger.toLayer(
  Effect.gen(function* () {
    const ledger = yield* LedgerRows;
    const feed = yield* OrderFeed;
    return Effect.fn(function* (batch) {
      ledger.batches.push(A.length(batch));
      for (const input of batch) {
        const row = `${input.envelope.stream}:${input.envelope.seq}`;
        MutableHashMap.set(ledger.rows, row, O.getOrElse(MutableHashMap.get(ledger.rows, row), () => 0) + 1);
        yield* feed.append(input, OrderNoted.make({ order: input.envelope.id, amount: input.event.amount }));
      }
    });
  }),
  { batch: { size: 2, wait: "300 millis" } }
);

class Shop extends Domain.Model("Shop", {
  aggregates: [Customer, Order],
  views: [CustomerTotals],
  projections: [OrderLedger],
  streams: [OrderFeed],
}) {}

class ShopApi extends Domain.Api("ShopApi", { model: Shop, views: ["CustomerTotals"] }) {}

/** Before the view: a model of customers alone. */
class ArchiveBefore extends Domain.Model("Archive", { aggregates: [Customer] }) {}
/** The same model with a view added after its events exist: it catches up from history. */
class JoinedNames extends Domain.View("JoinedNames", {
  from: [Customer],
  key: Customer,
  state: S.Struct({ name: S.String }),
  initial: { name: "" },
  evolve: { CustomerJoined: (_names, event) => ({ name: event.name }) },
}) {}
class ArchiveAfter extends Domain.Model("Archive", { aggregates: [Customer], views: [JoinedNames] }) {}
/** The same view reading a second source at the same version: its deploy must fail. */
class JoinedNamesWide extends Domain.View("JoinedNames", {
  from: [Customer, Order],
  key: Customer,
  state: S.Struct({ name: S.String }),
  initial: { name: "" },
  keyOf: { OrderPlaced: ({ event }) => Customer.ref(event.customer) },
  evolve: { CustomerJoined: (_names, event) => ({ name: event.name }), OrderPlaced: (names) => names },
}) {}
class ArchiveWider extends Domain.Model("Archive", { aggregates: [Customer, Order], views: [JoinedNamesWide] }) {}
/** The view rebuilt by bumping its version: it computes names in capitals, from the history. */
class JoinedNamesV1 extends Domain.View("JoinedNames", {
  from: [Customer],
  key: Customer,
  version: 1,
  state: S.Struct({ name: S.String }),
  initial: { name: "" },
  evolve: { CustomerJoined: (_names, event) => ({ name: Str.toUpperCase(event.name) }) },
}) {}
class ArchiveRebuilt extends Domain.Model("Archive", { aggregates: [Customer], views: [JoinedNamesV1] }) {}

/** Orders and customers first; then a two-source view and a projection that reads that view. */
class BacklogBefore extends Domain.Model("Backlog", { aggregates: [Customer, Order] }) {}
class TotalsLedger extends Domain.Projection("TotalsLedger", {
  from: [CustomerTotals],
  key: Customer,
  on: [CustomerJoined, OrderPlaced],
}) {}
const TotalsLedgerLive = TotalsLedger.toLayer(
  Effect.gen(function* () {
    const ledger = yield* LedgerRows;
    return Effect.fn(function* (batch) {
      for (const input of batch) {
        const row = `${input.key.id}:${input.envelope.stream}:${input.envelope.seq}`;
        MutableHashMap.set(ledger.rows, row, O.getOrElse(MutableHashMap.get(ledger.rows, row), () => 0) + 1);
      }
    });
  })
);
class BacklogAfter extends Domain.Model("Backlog", {
  aggregates: [Customer, Order],
  views: [CustomerTotals],
  projections: [TotalsLedger],
}) {}

/** A long history first; then a two-source view added after it. */
class LedgerbookBefore extends Domain.Model("Ledgerbook", { aggregates: [Customer, Order] }) {}
class LedgerbookAfter extends Domain.Model("Ledgerbook", { aggregates: [Customer, Order], views: [CustomerTotals] }) {}

/** One row per order, keyed by its customer; rebuilt by bumping its version on its Layer. */
class OrderCount extends Domain.Projection("OrderCount", {
  from: [Order],
  key: Customer,
  on: [OrderPlaced],
  keyOf: { OrderPlaced: ({ event }) => Customer.ref(event.customer) },
}) {}
const countRows = Effect.gen(function* () {
  const ledger = yield* LedgerRows;
  return (batch: ReadonlyArray<{ readonly envelope: { readonly stream: string; readonly seq: number } }>) =>
    Effect.sync(() => {
      ledger.batches.push(A.length(batch));
      for (const { envelope } of batch) {
        const row = `${envelope.stream}:${envelope.seq}`;
        MutableHashMap.set(ledger.rows, row, O.getOrElse(MutableHashMap.get(ledger.rows, row), () => 0) + 1);
      }
    });
});
const OrderCountLive = OrderCount.toLayer(countRows, { batch: { size: 10, wait: "400 millis" } });
const OrderCountV1Live = OrderCount.toLayer(countRows, { version: 1 });
class Counting extends Domain.Model("Counting", { aggregates: [Customer, Order], projections: [OrderCount] }) {}
class CountingRebuilt extends Domain.Model("Counting", { aggregates: [Customer, Order], projections: [OrderCount] }) {}

/** A long history, then a two-source view whose first build stops mid-backfill. */
class ResumingBefore extends Domain.Model("Resuming", { aggregates: [Customer, Order] }) {}
class ResumingAfter extends Domain.Model("Resuming", { aggregates: [Customer, Order], views: [CustomerTotals] }) {}

/** A view with entries first; then a projection that reads it, added after them. */
class RelayBefore extends Domain.Model("Relay", { aggregates: [Customer], views: [JoinedNames] }) {}
class NameLedger extends Domain.Projection("NameLedger", {
  from: [JoinedNames],
  key: Customer,
  on: [CustomerJoined],
}) {}
const NameLedgerLive = NameLedger.toLayer(countRows);
class RelayAfter extends Domain.Model("Relay", {
  aggregates: [Customer],
  views: [JoinedNames],
  projections: [NameLedger],
}) {}

/** A two-source view whose backfill is cut short, then a model without the view at all. */
class LeavingBefore extends Domain.Model("Leaving", { aggregates: [Customer, Order] }) {}
class LeavingWith extends Domain.Model("Leaving", { aggregates: [Customer, Order], views: [CustomerTotals] }) {}
class LeavingWithout extends Domain.Model("Leaving", { aggregates: [Customer, Order] }) {}

/** Fails the first time it folds a customer named `flaky`: a backfill step that dies once. */
const flakyFolds = MutableHashMap.empty<string, number>();
class FlakyTotals extends Domain.View("FlakyTotals", {
  from: [Customer, Order],
  key: Customer,
  state: S.Struct({ name: S.String, orders: S.Int }),
  initial: { name: "", orders: 0 },
  keyOf: { OrderPlaced: ({ event }) => Customer.ref(event.customer) },
  evolve: {
    CustomerJoined: (totals, event) => {
      const folds = O.getOrElse(MutableHashMap.get(flakyFolds, event.name), () => 0) + 1;
      MutableHashMap.set(flakyFolds, event.name, folds);
      if (Str.startsWith("flaky")(event.name) && folds === 1) throw new Error("flaky fold");
      return { ...totals, name: event.name };
    },
    OrderPlaced: (totals) => ({ ...totals, orders: totals.orders + 1 }),
  },
}) {}
class FlakyBefore extends Domain.Model("Flaky", { aggregates: [Customer, Order] }) {}
class FlakyAfter extends Domain.Model("Flaky", { aggregates: [Customer, Order], views: [FlakyTotals] }) {}

/** The same pair hosted lazily: each key reads its own instance's history before its first answer. */
class LazyBefore extends Domain.Model("Lazy", { aggregates: [Customer] }) {}
class LazyAfter extends Domain.Model("Lazy", { aggregates: [Customer], views: [JoinedNames] }) {}

/** A platform under test, with the layer that provides its requirements once for the suite. */
export interface ConsumerTarget<R, E, PE> {
  readonly base: Layer.Layer<R, E>;
  /** Whether a projection's accepted inputs survive the process that accepted them. */
  readonly durable: boolean;
  /** Writes an `Order` event row at schema version 1, for platforms that keep versions. */
  readonly legacyOrder?: (model: string, id: string, json: unknown) => Effect.Effect<void, never, R>;
  readonly name: string;
  readonly platform: Layer.Layer<Domain.Platform, PE, R>;
}

/** Poll until `predicate` holds, failing after 5 seconds. */
const eventually = <A, E, Req>(effect: Effect.Effect<A, E, Req>, predicate: (value: A) => boolean) =>
  effect.pipe(
    Effect.repeat({ until: predicate, schedule: Schedule.spaced(Duration.millis(25)) }),
    Effect.timeout(Duration.seconds(15))
  );

/** The built model's stores, by name. */
const aggregateStore = Effect.fnUntraced(function* (name: string) {
  const internals = yield* Internals;
  return yield* Effect.fromOption(O.fromUndefinedOr(internals.aggregates.get(name)));
});
const viewStore = Effect.fnUntraced(function* (name: string) {
  const internals = yield* Internals;
  return yield* Effect.fromOption(O.fromUndefinedOr(internals.views.get(name)));
});
const streamStore = Effect.fnUntraced(function* (name: string) {
  const internals = yield* Internals;
  return yield* Effect.fromOption(O.fromUndefinedOr(internals.streams.get(name)));
});
const eventsOf = (name: string, id: string) =>
  Effect.flatMap(aggregateStore(name), (store) =>
    O.match(O.fromUndefinedOr(store.events), {
      onNone: () => Effect.succeed<ReadonlyArray<DomainPlatform.StoredEvent>>([]),
      onSome: (events) => events(id),
    })
  );

/** Register every consumer scenario for one platform. */
export const consumers = <R, E, PE>(target: ConsumerTarget<R, E, PE>) => {
  const hosted = Shop.layer(Layer.merge(OrderLedgerLive, CustomerTotalsLive)).pipe(
    Layer.provideMerge(LedgerRowsLive),
    Layer.provideMerge(target.platform),
    Layer.provideMerge(target.base),
    Layer.provideMerge(NodeCrypto.layer)
  );
  describe(`Consumer conformance: ${target.name}`, () => {
    const scope = Str.toLowerCase(Str.replace(/[^A-Za-z0-9]+/g, "-")(target.name));
    const customerId = (name: string) => CustomerId.make(`${scope}-${name}`);
    const orderId = (name: string) => OrderId.make(`${scope}-${name}`);
    layer(hosted, { timeout: "30 seconds", excludeTestServices: true, concurrent: false })("scenarios", (it) => {
      it.effect("a view folds two aggregates' events and its validate refuses a read", () =>
        Effect.gen(function* () {
          const customers = yield* Customer;
          const orders = yield* Order;
          const totals = yield* CustomerTotals;
          const ada = customerId("ada");
          const hidden = customerId("hidden");
          yield* customers.send(ada, JoinCustomer.make({ name: "ada" }));
          yield* orders.send(orderId("ada-1"), PlaceOrder.make({ customer: ada, amount: 5 }));
          const placed = yield* orders.send(orderId("ada-2"), PlaceOrder.make({ customer: ada, amount: 7 }));
          const folded = yield* totals.get(Customer.ref(ada), { atLeast: placed, timeout: "5 seconds" });
          deepStrictEqual(folded, O.some({ name: "ada", total: 12, orders: 2 }));

          const joined = yield* customers.send(hidden, JoinCustomer.make({ name: "hidden" }));
          const api = yield* ShopApi.clientInProcess;
          yield* totals.get(Customer.ref(hidden), { atLeast: joined, timeout: "5 seconds" });
          const refused = yield* api.CustomerTotals.get(hidden).pipe(Effect.flip);
          strictEqual(refused._tag, "Hidden");
          const allowed = yield* api.CustomerTotals.get(ada);
          deepStrictEqual(allowed, { name: "ada", total: 12, orders: 2 });
        }).pipe(Effect.scoped)
      );

      it.effect("a delivery a view key already applied applies once", () =>
        Effect.gen(function* () {
          const customers = yield* Customer;
          const totals = yield* CustomerTotals;
          const bo = customerId("bo");
          const joined = yield* customers.send(bo, JoinCustomer.make({ name: "bo" }));
          yield* totals.get(Customer.ref(bo), { atLeast: joined, timeout: "5 seconds" });
          const view = yield* viewStore("CustomerTotals");
          const events = yield* eventsOf("Customer", bo);
          const first = yield* Effect.fromOption(A.head(events));
          const before = yield* view.read(bo);
          const again: DomainPlatform.Delivery = {
            target: { kind: "view", name: "CustomerTotals" },
            key: bo,
            source: first.envelope.stream,
            seq: first.envelope.seq,
            origin: "Customer",
            tag: "CustomerJoined",
            event: first.event,
            envelope: first.envelope,
          };
          yield* view.receive(bo, [again]);
          yield* view.receive(bo, [again]);
          const after = yield* view.read(bo);
          deepStrictEqual(after, before);
        })
      );

      it.effect("a projection batches and writes each event through its port once, appending a stream", () =>
        Effect.gen(function* () {
          const orders = yield* Order;
          const ledger = yield* LedgerRows;
          const feed = yield* streamStore("OrderFeed");
          const cy = customerId("cy");
          const placed = yield* Effect.forEach(["cy-1", "cy-2", "cy-3"], (name) =>
            orders.send(orderId(name), PlaceOrder.make({ customer: cy, amount: 1 }))
          );
          const rows = A.map(placed, ({ stream }) => `${stream}:1`);
          yield* eventually(
            Effect.sync(() => A.map(rows, (row) => O.getOrElse(MutableHashMap.get(ledger.rows, row), () => 0))),
            A.every((count) => count >= 1)
          );
          yield* Effect.sleep(Duration.millis(500));
          deepStrictEqual(
            A.map(rows, (row) => O.getOrElse(MutableHashMap.get(ledger.rows, row), () => 0)),
            [1, 1, 1]
          );
          strictEqual(A.reduce(ledger.batches, 0, (sum, size) => sum + size) >= 3, true);
          strictEqual(
            A.every(ledger.batches, (size) => size <= 2),
            true
          );
          strictEqual(
            A.some(ledger.batches, (size) => size === 2),
            true
          );
          const entries = yield* feed.list(cy);
          // InMemory's stamp exactly: id, stream, seq, at and commandId, no correlation id or trace.
          deepStrictEqual(
            A.map(entries, ({ envelope: { at, commandId, ...rest } }) => ({
              ...rest,
              at: P.isNumber(at),
              commandId: P.isString(commandId),
            })),
            A.map([1, 2, 3], (seq) => ({ id: cy, stream: `OrderFeed/${cy}`, seq, at: true, commandId: true }))
          );
        })
      );

      it.effect("a view added after its source's events exist catches up from history", () =>
        Effect.gen(function* () {
          const dee = customerId("dee");
          yield* Effect.gen(function* () {
            const context = yield* Layer.build(ArchiveBefore.layer(Layer.empty));
            yield* Context.get(context, Customer).send(dee, JoinCustomer.make({ name: "dee" }));
          }).pipe(Effect.scoped);
          yield* Effect.gen(function* () {
            const context = yield* Layer.build(ArchiveAfter.layer(Layer.empty));
            const names = Context.get(context, JoinedNames);
            const history = yield* eventually(names.history, ({ complete }) => complete);
            strictEqual(history.complete, true);
            const caught = yield* eventually(names.get(Customer.ref(dee)), O.isSome);
            deepStrictEqual(caught, O.some({ name: "dee" }));
          }).pipe(Effect.scoped);
          // The same consumer reading another source at the same version: the deploy dies, saying to bump it.
          const changed = yield* Layer.build(ArchiveWider.layer(Layer.empty)).pipe(
            Effect.scoped,
            Effect.sandbox,
            Effect.flip,
            Effect.map(Cause.pretty)
          );
          strictEqual(
            Str.includes("view:JoinedNames now reads Customer, Order, but its backfill was started reading Customer")(
              changed
            ),
            true
          );
          // Bumped: every key starts over and is computed again from the history.
          yield* Effect.gen(function* () {
            const context = yield* Layer.build(ArchiveRebuilt.layer(Layer.empty));
            const names = Context.get(context, JoinedNamesV1);
            const rebuilt = yield* eventually(names.get(Customer.ref(dee)), (found) =>
              O.exists(found, ({ name }) => name === "DEE")
            );
            deepStrictEqual(rebuilt, O.some({ name: "DEE" }));
          }).pipe(Effect.scoped);
        })
      );

      it.effect("a lazy view keyed by its one aggregate reads a key's history before its first answer", () =>
        Effect.gen(function* () {
          const eve = customerId("eve");
          yield* Effect.gen(function* () {
            const context = yield* Layer.build(LazyBefore.layer(Layer.empty));
            yield* Context.get(context, Customer).send(eve, JoinCustomer.make({ name: "eve" }));
          }).pipe(Effect.scoped);
          yield* Effect.gen(function* () {
            const context = yield* Layer.build(LazyAfter.layer(Layer.empty, { lazy: ["JoinedNames"] }));
            const names = Context.get(context, JoinedNames);
            // No waiting: the first read itself fills the key from the instance's events.
            const first = yield* names.get(Customer.ref(eve));
            deepStrictEqual(first, O.some({ name: "eve" }));
            const history = yield* names.history;
            strictEqual(history.complete, true);
          }).pipe(Effect.scoped);
        })
      );

      it.effect("a projection's progress waits until it handled a command's events", () =>
        Effect.gen(function* () {
          const orders = yield* Order;
          const ledger = yield* LedgerRows;
          const progress = yield* OrderLedger.Progress;
          const fay = customerId("fay");
          const placed = yield* orders.send(orderId("fay-1"), PlaceOrder.make({ customer: fay, amount: 4 }));
          yield* progress.caughtUp(placed, { timeout: "5 seconds" });
          strictEqual(
            O.getOrElse(MutableHashMap.get(ledger.rows, `${placed.stream}:1`), () => 0),
            1
          );
          const history = yield* progress.history;
          strictEqual(history.complete, true);
        })
      );

      it.effect("view and stream reads stream what is stored, then what commits next", () =>
        Effect.gen(function* () {
          const customers = yield* Customer;
          const orders = yield* Order;
          const totals = yield* CustomerTotals;
          const view = yield* viewStore("CustomerTotals");
          const feed = yield* streamStore("OrderFeed");
          const gus = customerId("gus");
          yield* customers.send(gus, JoinCustomer.make({ name: "gus" }));
          const first = yield* orders.send(orderId("gus-1"), PlaceOrder.make({ customer: gus, amount: 2 }));
          yield* totals.get(Customer.ref(gus), { atLeast: first, timeout: "5 seconds" });
          yield* eventually(feed.list(gus), (entries) => A.length(entries) === 1);
          const versions = yield* Stream.runCollect(view.changes(gus).pipe(Stream.take(2))).pipe(Effect.forkChild);
          const metas = yield* Stream.runCollect(feed.changes(gus).pipe(Stream.take(2))).pipe(Effect.forkChild);
          const entries = yield* Stream.runCollect(feed.tail(gus, 0).pipe(Stream.take(2))).pipe(Effect.forkChild);
          yield* Effect.sleep(Duration.millis(100));
          yield* orders.send(orderId("gus-2"), PlaceOrder.make({ customer: gus, amount: 3 }));
          const snapshots = yield* Fiber.join(versions);
          deepStrictEqual(
            A.map(snapshots, ({ state }) => state),
            [
              { name: "gus", total: 2, orders: 1 },
              { name: "gus", total: 5, orders: 2 },
            ]
          );
          const streamed = yield* Fiber.join(metas);
          deepStrictEqual(
            A.map(streamed, ({ seq }) => seq),
            [1, 2]
          );
          const appended = yield* Fiber.join(entries);
          deepStrictEqual(
            A.map(appended, ({ event }) => event),
            [
              { _tag: "OrderNoted", order: orderId("gus-1"), amount: 2 },
              { _tag: "OrderNoted", order: orderId("gus-2"), amount: 3 },
            ]
          );
          // A key emits an entry per applied event, with its state after it.
          const listed = yield* view.list(gus);
          deepStrictEqual(
            A.map(listed, ({ seq, state }) => [seq, state]),
            [
              [1, { name: "gus", total: 0, orders: 0 }],
              [2, { name: "gus", total: 2, orders: 1 }],
              [3, { name: "gus", total: 5, orders: 2 }],
            ]
          );
          const tailed = yield* Stream.runCollect(view.tail(gus, 1).pipe(Stream.take(2)));
          deepStrictEqual(
            A.map(tailed, ({ seq }) => seq),
            [2, 3]
          );
        })
      );

      it.effect("a two-source view and a projection reading it, added after events exist, catch up", () =>
        Effect.gen(function* () {
          const hal = customerId("hal");
          yield* Effect.gen(function* () {
            const context = yield* Layer.build(BacklogBefore.layer(Layer.empty));
            yield* Context.get(context, Customer).send(hal, JoinCustomer.make({ name: "hal" }));
            yield* Context.get(context, Order).send(orderId("hal-1"), PlaceOrder.make({ customer: hal, amount: 6 }));
            yield* Context.get(context, Order).send(orderId("hal-2"), PlaceOrder.make({ customer: hal, amount: 1 }));
          }).pipe(Effect.scoped);
          yield* Effect.gen(function* () {
            const context = yield* Layer.build(
              BacklogAfter.layer(Layer.merge(TotalsLedgerLive, CustomerTotalsLive)).pipe(
                Layer.provideMerge(LedgerRowsLive)
              )
            );
            const totals = Context.get(context, CustomerTotals);
            const viewHistory = yield* eventually(totals.history, ({ complete }) => complete);
            strictEqual(viewHistory.complete, true);
            const folded = yield* eventually(totals.get(Customer.ref(hal)), (found) =>
              O.exists(found, ({ orders }) => orders === 2)
            );
            deepStrictEqual(folded, O.some({ name: "hal", total: 7, orders: 2 }));
            const progress = Context.get(context, TotalsLedger.Progress);
            const projectionHistory = yield* eventually(progress.history, ({ complete }) => complete);
            strictEqual(projectionHistory.complete, true);
            const ledger = Context.get(context, LedgerRows);
            // The port is the suite's (memoized), so count this customer's rows: one per view entry.
            const rows = yield* eventually(
              Effect.sync(() =>
                ledger.rows.pipe(MutableHashMap.keys, A.fromIterable, A.filter(Str.startsWith(`${hal}:`)))
              ),
              (found) => A.length(found) === 3
            );
            deepStrictEqual(
              A.map(rows, (row) => O.getOrElse(MutableHashMap.get(ledger.rows, row), () => 0)),
              [1, 1, 1]
            );
          }).pipe(Effect.scoped);
        })
      );

      it.effect("a view added after a long history catches up across many pages", () =>
        Effect.gen(function* () {
          const customers = A.map(A.range(1, 6), (n) => customerId(`page-${n}`));
          yield* Effect.gen(function* () {
            const context = yield* Layer.build(LedgerbookBefore.layer(Layer.empty));
            yield* Effect.forEach(
              customers,
              (customer, index) =>
                Effect.gen(function* () {
                  yield* Context.get(context, Customer).send(customer, JoinCustomer.make({ name: `n${index}` }));
                  yield* Effect.forEach(A.range(1, 3), (n) =>
                    Context.get(context, Order).send(
                      orderId(`page-${index}-${n}`),
                      PlaceOrder.make({ customer, amount: n })
                    )
                  );
                }),
              { discard: true }
            );
          }).pipe(Effect.scoped);
          yield* Effect.gen(function* () {
            const context = yield* Layer.build(LedgerbookAfter.layer(CustomerTotalsLive));
            // Commits while the backfill runs: an instance it has not reached yet asks for a reader,
            // and neither the history nor the new events are lost.
            const first = yield* Effect.fromOption(A.head(customers));
            yield* Context.get(context, Order).send(
              orderId("page-late"),
              PlaceOrder.make({ customer: first, amount: 4 })
            );
            const late = customerId("page-late");
            yield* Context.get(context, Customer).send(late, JoinCustomer.make({ name: "late" }));
            const totals = Context.get(context, CustomerTotals);
            const history = yield* eventually(totals.history, ({ complete }) => complete).pipe(
              Effect.timeout(Duration.seconds(20))
            );
            strictEqual(history.complete, true);
            const folded = yield* Effect.forEach(customers, (customer) =>
              eventually(totals.get(Customer.ref(customer)), (found) => O.exists(found, ({ orders }) => orders >= 3))
            );
            deepStrictEqual(
              A.drop(folded, 1),
              A.map(A.range(1, 5), (index) => O.some({ name: `n${index}`, total: 6, orders: 3 }))
            );
            const withLate = yield* eventually(totals.get(Customer.ref(first)), (found) =>
              O.exists(found, ({ orders }) => orders === 4)
            );
            deepStrictEqual(withLate, O.some({ name: "n0", total: 10, orders: 4 }));
            const joinedLate = yield* eventually(totals.get(Customer.ref(late)), O.isSome);
            deepStrictEqual(joinedLate, O.some({ name: "late", total: 0, orders: 0 }));
          }).pipe(Effect.scoped);
        })
      );

      it.effect("a backfill cut short by its process stopping resumes in the next one", () =>
        Effect.gen(function* () {
          const customers = A.map(A.range(1, 5), (n) => customerId(`resume-${n}`));
          yield* Effect.gen(function* () {
            const context = yield* Layer.build(ResumingBefore.layer(Layer.empty));
            yield* Effect.forEach(
              customers,
              (customer) =>
                Effect.andThen(
                  Context.get(context, Customer).send(customer, JoinCustomer.make({ name: customer })),
                  Effect.forEach(A.range(1, 2), (n) =>
                    Context.get(context, Order).send(
                      orderId(`${customer}-${n}`),
                      PlaceOrder.make({ customer, amount: n })
                    )
                  )
                ),
              { discard: true }
            );
          }).pipe(Effect.scoped);
          // Stopped right after it starts: its run, directory, scanner and source jobs are left mid-way.
          yield* Layer.build(ResumingAfter.layer(CustomerTotalsLive)).pipe(Effect.scoped);
          yield* Effect.gen(function* () {
            const context = yield* Layer.build(ResumingAfter.layer(CustomerTotalsLive));
            const totals = Context.get(context, CustomerTotals);
            const history = yield* eventually(totals.history, ({ complete }) => complete).pipe(
              Effect.timeout(Duration.seconds(20))
            );
            strictEqual(history.complete, true);
            const folded = yield* Effect.forEach(customers, (customer) =>
              eventually(totals.get(Customer.ref(customer)), (found) => O.exists(found, ({ orders }) => orders === 2))
            );
            deepStrictEqual(
              folded,
              A.map(customers, (customer) => O.some({ name: customer, total: 3, orders: 2 }))
            );
          }).pipe(Effect.scoped);
        })
      );

      it.effect("a projection rebuilt by bumping its version handles the whole history again", () =>
        Effect.gen(function* () {
          const ivy = customerId("ivy");
          const before = yield* Effect.gen(function* () {
            const context = yield* Layer.build(Counting.layer(OrderCountLive).pipe(Layer.provideMerge(freshRows)));
            const placed = yield* Effect.forEach(["ivy-1", "ivy-2"], (name) =>
              Context.get(context, Order).send(orderId(name), PlaceOrder.make({ customer: ivy, amount: 1 }))
            );
            yield* Effect.forEach(placed, (receipt) =>
              Context.get(context, OrderCount.Progress).caughtUp(receipt, { timeout: "5 seconds" })
            );
            return Context.get(context, LedgerRows).rows.pipe(MutableHashMap.size);
          }).pipe(Effect.scoped);
          strictEqual(before, 2);
          yield* Effect.gen(function* () {
            const context = yield* Layer.build(
              CountingRebuilt.layer(OrderCountV1Live).pipe(Layer.provideMerge(freshRows))
            );
            const history = yield* eventually(
              Context.get(context, OrderCount.Progress).history,
              ({ complete }) => complete
            );
            strictEqual(history.complete, true);
            const ledger = Context.get(context, LedgerRows);
            const rows = yield* eventually(
              Effect.sync(() => ledger.rows.pipe(MutableHashMap.values, A.fromIterable)),
              (counts) => A.length(counts) === 2
            );
            deepStrictEqual(rows, [1, 1]);
          }).pipe(Effect.scoped);
        })
      );

      it.effect("a stream write repeated from the same origin appends nothing", () =>
        Effect.gen(function* () {
          const feed = yield* streamStore("OrderFeed");
          const key = customerId("repeat");
          const write: DomainPlatform.StreamWrite = {
            origin: [1, 0],
            source: `Order/${key}`,
            sourceSeq: 1,
            at: 0,
            commandId: "repeat",
            events: [{ _tag: "OrderNoted", order: "o-1", amount: 1 }],
          };
          yield* feed.append(key, write);
          yield* feed.append(key, write);
          yield* feed.advance(key, { [`Order/${key}`]: 4 });
          const entries = yield* feed.list(key);
          strictEqual(A.length(entries), 1);
          const meta = yield* feed.read(key);
          deepStrictEqual(meta, { seq: 1, origin: [1, 0], checkpoints: { [`Order/${key}`]: 4 } });
        })
      );

      if (target.durable) {
        it.effect("inputs a projection accepted before its process stopped are handled by the next one", () =>
          Effect.gen(function* () {
            const jo = customerId("jo");
            // The batch waits 400 ms to fill; the first runtime stops before it does.
            yield* Effect.gen(function* () {
              const context = yield* Layer.build(Counting.layer(OrderCountLive).pipe(Layer.provideMerge(freshRows)));
              yield* Context.get(context, Order).send(orderId("jo-1"), PlaceOrder.make({ customer: jo, amount: 1 }));
              yield* Effect.sleep(Duration.millis(150));
            }).pipe(Effect.scoped);
            yield* Effect.gen(function* () {
              const context = yield* Layer.build(Counting.layer(OrderCountLive).pipe(Layer.provideMerge(freshRows)));
              const ledger = Context.get(context, LedgerRows);
              const rows = yield* eventually(
                Effect.sync(() => O.getOrElse(MutableHashMap.get(ledger.rows, `Order/${orderId("jo-1")}:1`), () => 0)),
                (count) => count === 1
              );
              strictEqual(rows, 1);
            }).pipe(Effect.scoped);
          })
        );
      }

      it.effect("a projection added after a view has entries catches up from the view", () =>
        Effect.gen(function* () {
          const names = A.map(["kai", "lu"], customerId);
          yield* Effect.gen(function* () {
            const context = yield* Layer.build(RelayBefore.layer(Layer.empty));
            yield* Effect.forEach(names, (customer) =>
              Context.get(context, Customer).send(customer, JoinCustomer.make({ name: customer }))
            );
            // Not read while filling: in beta.85 InMemory, reading a view key before its first
            // delivery keeps it out of the directory, and a later backfill would miss it.
            yield* Effect.sleep(Duration.millis(500));
          }).pipe(Effect.scoped);
          yield* Effect.gen(function* () {
            const context = yield* Layer.build(RelayAfter.layer(NameLedgerLive).pipe(Layer.provideMerge(freshRows)));
            const history = yield* eventually(
              Context.get(context, NameLedger.Progress).history,
              ({ complete }) => complete
            );
            strictEqual(history.complete, true);
            const ledger = Context.get(context, LedgerRows);
            const rows = yield* eventually(
              Effect.sync(() => ledger.rows.pipe(MutableHashMap.keys, A.fromIterable)),
              (keys) => A.length(keys) === 2
            );
            deepStrictEqual(
              A.sort(rows, Str.Order),
              A.map(names, (customer) => `JoinedNames/${customer}:1`)
            );
          }).pipe(Effect.scoped);
        })
      );

      it.effect("a model rebuilt without a view whose backfill was cut short keeps running", () =>
        Effect.gen(function* () {
          const customers = A.map(A.range(1, 4), (n) => customerId(`leaving-${n}`));
          yield* Effect.gen(function* () {
            const context = yield* Layer.build(LeavingBefore.layer(Layer.empty));
            yield* Effect.forEach(
              customers,
              (customer) =>
                Effect.andThen(
                  Context.get(context, Customer).send(customer, JoinCustomer.make({ name: customer })),
                  Context.get(context, Order).send(orderId(`${customer}-o`), PlaceOrder.make({ customer, amount: 1 }))
                ),
              { discard: true }
            );
          }).pipe(Effect.scoped);
          // Built and torn down at once: its backfill run and the jobs it scheduled are left behind.
          yield* Layer.build(LeavingWith.layer(CustomerTotalsLive)).pipe(Effect.scoped);
          yield* Effect.gen(function* () {
            const context = yield* Layer.build(LeavingWithout.layer(Layer.empty));
            // What is left runs against roles that are gone; live commits route only to what is hosted.
            yield* Effect.sleep(Duration.millis(600));
            const late = customerId("leaving-late");
            const receipt = yield* Context.get(context, Customer).send(late, JoinCustomer.make({ name: "late" }));
            strictEqual(receipt.version, 1);
            const placed = yield* Context.get(context, Order).send(
              orderId("leaving-late-o"),
              PlaceOrder.make({ customer: late, amount: 2 })
            );
            strictEqual(placed.version, 1);
            const state = yield* Context.get(context, Customer).get(late);
            deepStrictEqual(state, { _tag: "Member", name: "late" });
          }).pipe(Effect.scoped);
        })
      );

      if (target.durable) {
        it.effect("a backfill step that fails once is retried until the view is complete", () =>
          Effect.gen(function* () {
            const flaky = customerId("flaky");
            yield* Effect.gen(function* () {
              const context = yield* Layer.build(FlakyBefore.layer(Layer.empty));
              yield* Context.get(context, Customer).send(flaky, JoinCustomer.make({ name: "flaky" }));
              yield* Context.get(context, Order).send(
                orderId("flaky-o"),
                PlaceOrder.make({ customer: flaky, amount: 1 })
              );
            }).pipe(Effect.scoped);
            yield* Effect.gen(function* () {
              const context = yield* Layer.build(FlakyAfter.layer(Layer.empty));
              const totals = Context.get(context, FlakyTotals);
              const folded = yield* eventually(totals.get(Customer.ref(flaky)), (found) =>
                O.exists(found, ({ orders }) => orders === 1)
              ).pipe(Effect.timeout(Duration.seconds(15)));
              deepStrictEqual(folded, O.some({ name: "flaky", orders: 1 }));
              strictEqual(O.getOrElse(MutableHashMap.get(flakyFolds, "flaky"), () => 0) >= 2, true);
            }).pipe(Effect.scoped);
          })
        );
      }

      const legacyOrder = target.legacyOrder;
      if (legacyOrder !== undefined) {
        it.effect("an event stored at schema version 1 reads back at version 2", () =>
          Effect.gen(function* () {
            const id = orderId("legacy");
            const customer = customerId("legacy");
            yield* legacyOrder("Shop", id, { _tag: "OrderPlaced", customer });
            const events = yield* eventsOf("Order", id);
            deepStrictEqual(
              A.map(events, ({ event }) => event),
              [{ _tag: "OrderPlaced", customer, amount: 0 }]
            );
          })
        );
      }
    });
  });
};
