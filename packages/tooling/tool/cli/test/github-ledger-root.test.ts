import { RateLimitSink } from "@beep/github/Resilience";
import {
  GhSpawnSink,
  GithubBudgetLedger,
  GithubLedgerCommand,
  GithubLedgerError,
  GithubRateLimitSampler,
  layerGithubBudgetLedgerLive,
  withGithubLedger,
} from "@beep/repo-cli/test/SharedInternals";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";

const root = Command.make("beep").pipe(
  Command.withSubcommands([Command.make("yeet").pipe(Command.withSubcommands([Command.make("monitor")]))])
);

const probe = Effect.gen(function* () {
  const ledger = yield* Effect.serviceOption(GithubBudgetLedger);
  const sampler = yield* Effect.serviceOption(GithubRateLimitSampler);
  const sink = yield* RateLimitSink;
  const ghSink = yield* GhSpawnSink;
  const command = yield* GithubLedgerCommand;
  return {
    bound: O.isSome(ledger),
    sampled: O.isSome(sampler),
    sinkIsLedger: O.exists(ledger, (value) => value.sink.record === sink.record),
    ghSinkIsLedger: O.exists(ledger, (value) => value.ghSink.record === ghSink.record),
    command,
  };
});

const run = Effect.fnUntraced(function* (
  env: Record<string, string>,
  layer?: Layer.Layer<GithubBudgetLedger, GithubLedgerError>
) {
  const fs = yield* FileSystem.FileSystem;
  const stateRoot = yield* fs.makeTempDirectoryScoped({ prefix: "github-ledger-root-" });
  return yield* probe.pipe(
    withGithubLedger({ argv: ["yeet", "monitor", "--until-ready"], root, ...(layer === undefined ? {} : { layer }) }),
    Effect.provideService(
      ConfigProvider.ConfigProvider,
      ConfigProvider.fromUnknown({ BEEP_GITHUB_LEDGER_STATE_ROOT: stateRoot, ...env })
    )
  );
});

describe("withGithubLedger", () => {
  it.layer(NodeServices.layer, { timeout: "30 seconds" })((it) => {
    it.effect("binds the ledger's sinks and the tree-derived command label", () =>
      Effect.gen(function* () {
        const value1 = yield* run({});
        expect(value1).toStrictEqual({
          bound: true,
          sampled: true,
          sinkIsLedger: true,
          ghSinkIsLedger: true,
          command: "yeet monitor",
        });
      })
    );

    it.effect("stays off under CI and with BEEP_GITHUB_LEDGER=off", () =>
      Effect.gen(function* () {
        const off = { bound: false, sampled: false, sinkIsLedger: false, ghSinkIsLedger: false, command: "beep" };
        const value2 = yield* run({ CI: "true" });
        expect(value2).toStrictEqual(off);
        const value3 = yield* run({ BEEP_GITHUB_LEDGER: "off" });
        expect(value3).toStrictEqual(off);
      })
    );

    it.effect("runs the program without a ledger when the ledger fails or dies while building", () =>
      Effect.gen(function* () {
        const off = { bound: false, sampled: false, sinkIsLedger: false, ghSinkIsLedger: false, command: "beep" };
        const failing = Layer.effect(
          GithubBudgetLedger,
          Effect.fail(GithubLedgerError.make({ reason: "state-dir", detail: "no state directory" }))
        );
        const dying = Layer.effect(GithubBudgetLedger, Effect.die("broken ledger"));
        const value4 = yield* run({}, failing);
        expect(value4).toStrictEqual(off);
        const value5 = yield* run({}, dying);
        expect(value5).toStrictEqual(off);
        // The live layer itself builds without touching the disk.
        expect(Layer.isLayer(layerGithubBudgetLedgerLive())).toBe(true);
      })
    );
  });
});
