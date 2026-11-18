import { describe, it } from "@alchemy.run/test";
import * as Effect from "effect/Effect";
import { twoRunnerHost } from "./two-runner-host.ts";
import { Account, AccountId, Deposit, hosted, logOf, Transfer, TransferMoney } from "./two-runner-model.ts";

const a = AccountId.make("probe-from");
const b = AccountId.make("probe-to");

describe("probe", { tags: ["unit"] }, () => {
  it.live("a decision whose primary commit is fenced", () =>
    Effect.gen(function* () {
      let moved = false;
      const sim = twoRunnerHost({
        fenced: true,
        intercept: (call, run) => {
          if (call.method === "txPrepare" && !moved) {
            moved = true;
            sim.serveFrom(1);
          }
          return run;
        },
      });
      yield* Effect.gen(function* () {
        const accounts = yield* Account;
        const transfer = yield* Transfer;
        yield* accounts.send(new Deposit({ accountId: a, amount: 100, stall: false }));
        const exit = yield* Effect.exit(
          transfer.send(new TransferMoney({ from: a, to: b, amount: 30 }), { commandId: "t-1" }),
        );
        const show = (label: string) =>
          Effect.logWarning(
            `PROBE ${label}: a=${JSON.stringify(logOf(sim, a))} a.meta=${JSON.stringify(sim.rowsOf("VersionCheckBank.AccountAggregate/probe-from").get("meta"))} b.meta=${JSON.stringify(sim.rowsOf("VersionCheckBank.AccountAggregate/probe-to").get("meta"))} committers a=${JSON.stringify(sim.committers("VersionCheckBank.AccountAggregate/probe-from"))} b=${JSON.stringify(sim.committers("VersionCheckBank.AccountAggregate/probe-to"))}`,
          );
        yield* Effect.logWarning(`PROBE send exit: ${JSON.stringify(exit).slice(0, 600)}`);
        yield* show("right after");
        yield* Effect.sleep("3 seconds");
        yield* show("after 3 s");
        const again = yield* Effect.exit(
          transfer.send(new TransferMoney({ from: a, to: b, amount: 30 }), { commandId: "t-1" }),
        );
        yield* Effect.logWarning(`PROBE same command id again: ${JSON.stringify(again).slice(0, 400)}`);
        const next = yield* Effect.exit(
          accounts.send(new Deposit({ accountId: a, amount: 1, stall: false })),
        );
        yield* Effect.logWarning(`PROBE next deposit on a: ${JSON.stringify(next).slice(0, 300)}`);
        yield* show("end");
        yield* Effect.logWarning(`PROBE balances a=${JSON.stringify(yield* accounts.get(a))} b=${JSON.stringify(yield* accounts.get(b))}`);
      }).pipe(Effect.provide(hosted(sim)), Effect.ensuring(sim.close));
    }),
  { timeout: 30_000 });
});
