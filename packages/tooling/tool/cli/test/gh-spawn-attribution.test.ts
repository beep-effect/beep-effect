import { runRepoCommandCapture } from "@beep/repo-cli/test/RepoRun";
import {
  GhSpawnSink,
  GithubBudgetLedger,
  GithubLedgerRow,
  GithubLedgerStore,
  ghOutput,
  HostLabel,
  LedgerRange,
  layerGithubBudgetLedger,
  layerGithubLedgerStoreMemory,
} from "@beep/repo-cli/test/SharedInternals";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as PlatformError from "effect/PlatformError";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Str from "effect/String";
import { scriptedSpawner } from "./support/GithubLedgerFakes.ts";

const ledger = layerGithubBudgetLedger({ host: HostLabel.make("hub") }).pipe(
  Layer.provideMerge(layerGithubLedgerStoreMemory)
);

const spawnRows = GithubLedgerStore.use((store) =>
  store.rows(LedgerRange.make({ from: DateTime.makeUnsafe(-1), to: DateTime.makeUnsafe(3_600_000) }))
).pipe(Effect.map(A.filter(GithubLedgerRow.guards.GhSpawn)));

// Bind the repo-run sink to the ledger, as the CLI root does.
const withLedgerSink = <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R | GithubBudgetLedger> =>
  GithubBudgetLedger.use((bound) => Effect.provideService(effect, GhSpawnSink, bound.ghSink));

const failingSpawner = ChildProcessSpawner.make(() =>
  Effect.fail(
    PlatformError.systemError({
      _tag: "NotFound",
      module: "ChildProcess",
      method: "spawn",
      description: "gh is not installed",
    })
  )
);

const ghFailure = (failure: { readonly _tag: string }) => failure._tag;

describe("gh spawn attribution", () => {
  it.layer(Layer.mergeAll(ledger, SecureRandom.layerWebCrypto), { timeout: "30 seconds" })((it) => {
    it.effect("records one GhSpawn row per gh child, reduced to subcommand and resource", () =>
      Effect.gen(function* () {
        const { spawner } = scriptedSpawner({ "gh pr view --json x": { stdout: "{}", exitCode: 0 } });
        const result = yield* runRepoCommandCapture("gh", ["pr", "view", "--json", "x"], ".").pipe(
          withLedgerSink,
          Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)
        );
        expect(result.exitCode).toBe(0);
        const rows = yield* spawnRows;
        expect(A.map(rows, (row) => [row.subcommand, row.resource, row.exitCode])).toStrictEqual([
          ["pr view", "graphql", 0],
        ]);
      })
    );
  });

  it.layer(Layer.mergeAll(ledger, SecureRandom.layerWebCrypto), { timeout: "30 seconds" })((it) => {
    it.effect("records ghOutput's nonzero exit and its spawn failure as -1", () =>
      Effect.gen(function* () {
        const { spawner } = scriptedSpawner({ "gh run list": { stdout: "", exitCode: 4 } });
        const nonzero = yield* Effect.flip(
          ghOutput({ args: ["run", "list"], cwd: ".", label: "gh run list", onFailure: ghFailure }).pipe(
            withLedgerSink,
            Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)
          )
        );
        expect(nonzero).toBe("nonzero-exit");
        const spawnFailed = yield* Effect.flip(
          ghOutput({ args: ["issue", "list"], cwd: ".", label: "gh issue list", onFailure: ghFailure }).pipe(
            withLedgerSink,
            Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, failingSpawner)
          )
        );
        expect(spawnFailed).toBe("spawn");
        const rows = yield* spawnRows;
        expect(A.map(rows, (row) => [row.subcommand, row.resource, row.exitCode])).toStrictEqual([
          ["run list", "core", 4],
          ["issue list", "graphql", -1],
        ]);
      })
    );
  });

  it.layer(Layer.mergeAll(ledger, SecureRandom.layerWebCrypto), { timeout: "30 seconds" })((it) => {
    it.effect("records nothing for a non-gh command and never persists an api path", () =>
      Effect.gen(function* () {
        const { spawner } = scriptedSpawner({
          "git status": { stdout: "" },
          "gh api repos/o/r/rules/branches/main": { stdout: "[]" },
        });
        yield* runRepoCommandCapture("git", ["status"], ".").pipe(
          withLedgerSink,
          Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)
        );
        const none = yield* spawnRows;
        expect(none).toHaveLength(0);
        yield* runRepoCommandCapture("gh", ["api", "repos/o/r/rules/branches/main"], ".").pipe(
          withLedgerSink,
          Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)
        );
        const rows = yield* spawnRows;
        expect(A.map(rows, (row) => [row.subcommand, row.resource])).toStrictEqual([["api rest", "core"]]);
        expect(A.some(rows, (row) => Str.includes("repos/")(row.subcommand))).toBe(false);
      })
    );
  });

  it.layer(SecureRandom.layerWebCrypto, { timeout: "30 seconds" })((it) => {
    it.effect("changes nothing without a sink binding", () =>
      Effect.gen(function* () {
        const { spawner } = scriptedSpawner({ "gh pr view": { stdout: "ok", exitCode: 0 } });
        const result = yield* runRepoCommandCapture("gh", ["pr", "view"], ".").pipe(
          Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)
        );
        expect([result.exitCode, result.output]).toStrictEqual([0, "ok"]);
        // A dying sink never changes the spawn's result.
        const dying = yield* runRepoCommandCapture("gh", ["pr", "view"], ".").pipe(
          Effect.provideService(GhSpawnSink, { record: () => Effect.die("sink exploded") }),
          Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)
        );
        expect(dying.exitCode).toBe(0);
      })
    );
  });
});
