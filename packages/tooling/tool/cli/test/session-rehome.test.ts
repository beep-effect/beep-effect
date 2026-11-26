import { Git } from "@beep/git/Git";
import { sessionCommand } from "@beep/repo-cli";
import {
  CheckoutRepository,
  ClaudePeerRoute,
  makeOrchestratorRegisterLive,
  makeOrchestratorRulingsLive,
  makeSessionLedgerLive,
  makeSessionPresenceStoreLive,
  noteSession,
  OrchestratorRegister,
  OrchestratorRulings,
  RegisterRow,
  RulingRow,
  registerFileName,
  rehomeSessionStores,
  rulingsFileName,
  SessionLedger,
  SessionLedgerRow,
  SessionPresence,
  SessionPresenceStore,
  SessionRehomeRequest,
  sessionLedgerFileName,
  sessionPresenceFileName,
} from "@beep/repo-cli/test/Session";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";

const github = CheckoutRepository.make({ host: "github.com", owner: "beep-effect", name: "beep-effect-private" });
const gitlab = CheckoutRepository.make({ host: "gitlab.example.com", owner: "team", name: "beep-effect-private" });

const testLayer = Layer.provideMerge(
  Git.layer,
  Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, TestConsole.layer)
);
const withStores = Effect.fnUntraced(function* <A, E, R>(effect: Effect.Effect<A, E, R>) {
  const ledger = yield* makeSessionLedgerLive();
  const presence = yield* makeSessionPresenceStoreLive();
  const register = yield* makeOrchestratorRegisterLive();
  const rulings = yield* makeOrchestratorRulingsLive();
  return yield* effect.pipe(
    Effect.provideService(SessionLedger, ledger),
    Effect.provideService(SessionPresenceStore, presence),
    Effect.provideService(OrchestratorRegister, register),
    Effect.provideService(OrchestratorRulings, rulings)
  );
});

const runSession = Command.runWith(sessionCommand, { version: "0.0.0" });

const runGit = Effect.fn("SessionRehomeTest.runGit")(function* (cwd: string, args: ReadonlyArray<string>) {
  const handle = yield* ChildProcess.make("git", [...args], {
    cwd,
    stdin: "ignore",
    stdout: "ignore",
    stderr: "inherit",
  });
  const exitCode = yield* handle.exitCode;
  expect(exitCode).toBe(0);
});

const withStateRoot = Effect.fnUntraced(function* <A, E, R>(
  use: (root: { tmp: string; sessions: string; orchestrator: string }) => Effect.Effect<A, E, R>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const tmp = yield* fs.makeTempDirectoryScoped({ prefix: "session-rehome-test-" });
  const sessions = path.join(tmp, "sessions");
  const orchestrator = path.join(tmp, "orchestrator");
  return yield* use({ tmp, sessions, orchestrator }).pipe(
    Effect.provideService(
      ConfigProvider.ConfigProvider,
      ConfigProvider.fromEnv({
        env: {
          BEEP_SESSION_STATE_ROOT: sessions,
          BEEP_ORCHESTRATOR_STATE_ROOT: orchestrator,
          HOME: tmp,
          CODEX_THREAD_ID: "thread-1",
        },
      })
    )
  );
});

const ledgerRow = (repository: CheckoutRepository, next: string) =>
  SessionLedgerRow.make({
    schemaVersion: "session-ledger/v1",
    repository,
    clone: "/work/clone",
    checkout: "/work/clone",
    lane: "clone",
    branch: "main",
    state: "open",
    next,
    summary: O.none(),
    pr: O.some(7),
    harness: "codex",
    sessionId: O.some("thread-1"),
    recordedAt: DateTime.makeUnsafe(1_000),
  });

const presenceRow = (repository: CheckoutRepository) =>
  SessionPresence.make({
    schemaVersion: "session-presence/v1",
    repository,
    harness: "claude-code",
    entrypoint: "cli",
    sessionId: "5f0c2b8e",
    routes: [ClaudePeerRoute.make({ sessionId: "5f0c2b8e", nameHint: O.none() })],
    checkout: "/work/clone",
    branch: "main",
    recordedAt: DateTime.makeUnsafe(2_000),
  });

const registerRow = (repository: CheckoutRepository) =>
  RegisterRow.make({
    schemaVersion: "orchestrator-register/v1",
    repository,
    kind: "codex-lane",
    address: "PR #7",
    name: O.none(),
    owns: ["PR #7"],
    state: "active",
    waitingOnOrchestrator: O.none(),
    lastContact: O.none(),
    orphanPlan: "read the PR first",
    note: O.none(),
    recordedBy: O.none(),
    recordedAt: DateTime.makeUnsafe(3_000),
  });

const rulingRow = (repository: CheckoutRepository) =>
  RulingRow.make({
    schemaVersion: "orchestrator-ruling/v1",
    repository,
    id: "only-money-escalates",
    date: "2026-10-06",
    verbatim: "only money escalates",
    source: "AGENTS.md Autonomy",
    state: "in-force",
    supersededBy: O.none(),
    note: O.none(),
    recordedBy: O.none(),
    recordedAt: DateTime.makeUnsafe(4_000),
  });

const seedSource = Effect.gen(function* () {
  const ledger = yield* SessionLedger;
  const presence = yield* SessionPresenceStore;
  const register = yield* OrchestratorRegister;
  const rulings = yield* OrchestratorRulings;
  yield* ledger.append(ledgerRow(github, "first"));
  yield* ledger.append(ledgerRow(github, "second"));
  yield* presence.append(presenceRow(github));
  yield* register.append(registerRow(github));
  yield* rulings.append(rulingRow(github));
});

const readText = Effect.fnUntraced(function* (file: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readFileString(file);
});

const captureOutput = Effect.fnUntraced(function* <A, E, R>(effect: Effect.Effect<A, E, R>) {
  const current = yield* Console.Console;
  let output: ReadonlyArray<unknown> = [];
  yield* effect.pipe(
    Effect.provideService(Console.Console, {
      ...current,
      log: (...values: ReadonlyArray<unknown>) => {
        output = A.appendAll(output, values);
      },
      error: (...values: ReadonlyArray<unknown>) => {
        output = A.appendAll(output, values);
      },
    })
  );
  return A.join(A.map(output, String), "\n");
});

describe("checkout repository partitions", () => {
  it("keeps every GitHub store file name byte-identical", () => {
    const repository = CheckoutRepository.make({ host: "github.com", owner: "beep-effect", name: "beep-effect" });
    expect(sessionLedgerFileName(repository)).toBe("github.com__beep-effect__beep-effect.jsonl");
    expect(sessionPresenceFileName(repository)).toBe("github.com__beep-effect__beep-effect.presence.jsonl");
    expect(registerFileName(repository)).toBe("github.com__beep-effect__beep-effect.jsonl");
    expect(rulingsFileName(repository)).toBe("github.com__beep-effect__beep-effect.rulings.jsonl");
  });

  it.layer(Layer.fresh(testLayer), { timeout: "30 seconds" })((it) => {
    it.effect("writes a GitLab-origin checkout's note to its own partition", () =>
      withStateRoot(({ tmp, sessions }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const clone = path.join(tmp, "clone");
          yield* fs.makeDirectory(clone);
          yield* runGit(clone, ["init", "-b", "main"]);
          yield* runGit(clone, ["config", "user.email", "session-rehome-test@example.com"]);
          yield* runGit(clone, ["config", "user.name", "Session Rehome Test"]);
          yield* runGit(clone, ["config", "commit.gpgsign", "false"]);
          yield* runGit(clone, ["commit", "--allow-empty", "-m", "init"]);
          yield* runGit(clone, ["remote", "add", "origin", "git@GitLab.example.com:Team/beep-effect-private.git"]);
          yield* runGit(clone, [
            "remote",
            "set-url",
            "--push",
            "origin",
            "git@github.com:beep-effect/beep-effect-private.git",
          ]);
          const ledger = yield* makeSessionLedgerLive();
          const row = yield* noteSession({
            cwd: clone,
            state: "open",
            next: "resume",
            summary: O.none(),
            pr: O.none(),
          }).pipe(Effect.provideService(SessionLedger, ledger));
          expect(row.repository).toEqual(gitlab);
          const names = yield* fs.readDirectory(sessions);
          expect(names).toEqual(["gitlab.example.com__team__beep-effect-private.jsonl"]);
          const rows = yield* ledger.list(gitlab);
          expect(A.map(rows, (value) => value.next)).toEqual(["resume"]);
          const githubRows = yield* ledger.list(github);
          expect(githubRows).toEqual([]);
        })
      )
    );
  });
});

describe("session rehome", () => {
  it.layer(Layer.fresh(testLayer), { timeout: "30 seconds" })((it) => {
    it.effect("dry run reports every store and writes nothing", () =>
      withStateRoot(({ sessions, orchestrator }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          yield* seedSource.pipe(withStores);
          const output = yield* captureOutput(
            runSession([
              "rehome",
              "--from",
              "github.com/beep-effect/beep-effect-private",
              "--to",
              "GitLab.example.com/team/beep-effect-private",
            ])
          );
          expect(Str.split(output, "\n")).toEqual([
            "[session] rehome github.com/beep-effect/beep-effect-private -> gitlab.example.com/team/beep-effect-private (dry run; pass --apply to copy)",
            `- ledger: 2 row(s) in ${path.join(sessions, "github.com__beep-effect__beep-effect-private.jsonl")} -> ${path.join(sessions, "gitlab.example.com__team__beep-effect-private.jsonl")} (0 already there, 2 to copy)`,
            `- presence: 1 row(s) in ${path.join(sessions, "github.com__beep-effect__beep-effect-private.presence.jsonl")} -> ${path.join(sessions, "gitlab.example.com__team__beep-effect-private.presence.jsonl")} (0 already there, 1 to copy)`,
            `- register: 1 row(s) in ${path.join(orchestrator, "github.com__beep-effect__beep-effect-private.jsonl")} -> ${path.join(orchestrator, "gitlab.example.com__team__beep-effect-private.jsonl")} (0 already there, 1 to copy)`,
            `- rulings: 1 row(s) in ${path.join(orchestrator, "github.com__beep-effect__beep-effect-private.rulings.jsonl")} -> ${path.join(orchestrator, "gitlab.example.com__team__beep-effect-private.rulings.jsonl")} (0 already there, 1 to copy)`,
            "[session] dry run: nothing written.",
          ]);
          const targetLedger = yield* fs.exists(
            path.join(sessions, "gitlab.example.com__team__beep-effect-private.jsonl")
          );
          expect(targetLedger).toBe(false);
          const targetRulings = yield* fs.exists(
            path.join(orchestrator, "gitlab.example.com__team__beep-effect-private.rulings.jsonl")
          );
          expect(targetRulings).toBe(false);
        })
      )
    );

    it.effect("apply copies rewritten rows, leaves the source untouched and is idempotent", () =>
      withStateRoot(({ sessions, orchestrator }) =>
        Effect.gen(function* () {
          const path = yield* Path.Path;
          yield* seedSource.pipe(withStores);
          const sourceFiles = [
            path.join(sessions, "github.com__beep-effect__beep-effect-private.jsonl"),
            path.join(sessions, "github.com__beep-effect__beep-effect-private.presence.jsonl"),
            path.join(orchestrator, "github.com__beep-effect__beep-effect-private.jsonl"),
            path.join(orchestrator, "github.com__beep-effect__beep-effect-private.rulings.jsonl"),
          ];
          const before = yield* Effect.forEach(sourceFiles, readText, { concurrency: 1 });
          const request = SessionRehomeRequest.make({ from: github, to: gitlab, apply: true });
          const first = yield* rehomeSessionStores(request).pipe(withStores);
          expect(A.map(first.stores, (plan) => [plan.store, plan.sourceRows, plan.targetRows, plan.newRows])).toEqual([
            ["ledger", 2, 0, 2],
            ["presence", 1, 0, 1],
            ["register", 1, 0, 1],
            ["rulings", 1, 0, 1],
          ]);
          const after = yield* Effect.forEach(sourceFiles, readText, { concurrency: 1 });
          expect(after).toEqual(before);
          const copied = yield* Effect.gen(function* () {
            const ledger = yield* SessionLedger;
            const presence = yield* SessionPresenceStore;
            const register = yield* OrchestratorRegister;
            const rulings = yield* OrchestratorRulings;
            return {
              ledger: yield* ledger.list(gitlab),
              presence: yield* presence.list(gitlab),
              register: yield* register.list(gitlab),
              rulings: yield* rulings.list(gitlab),
            };
          }).pipe(withStores);
          expect(copied.ledger).toEqual([ledgerRow(gitlab, "first"), ledgerRow(gitlab, "second")]);
          expect(copied.presence).toEqual([presenceRow(gitlab)]);
          expect(copied.register).toEqual([registerRow(gitlab)]);
          expect(copied.rulings).toEqual([rulingRow(gitlab)]);
          const targetLedger = path.join(sessions, "gitlab.example.com__team__beep-effect-private.jsonl");
          const targetBefore = yield* readText(targetLedger);
          const second = yield* rehomeSessionStores(request).pipe(withStores);
          expect(A.map(second.stores, (plan) => [plan.store, plan.targetRows, plan.newRows])).toEqual([
            ["ledger", 2, 0],
            ["presence", 1, 0],
            ["register", 1, 0],
            ["rulings", 1, 0],
          ]);
          const targetAfter = yield* readText(targetLedger);
          expect(targetAfter).toBe(targetBefore);
        })
      )
    );

    it.effect("apply appends only the rows an existing target lacks", () =>
      withStateRoot(() =>
        Effect.gen(function* () {
          yield* seedSource.pipe(withStores);
          const ledgerRows = yield* Effect.gen(function* () {
            const ledger = yield* SessionLedger;
            yield* ledger.append(ledgerRow(gitlab, "first"));
            yield* ledger.append(ledgerRow(gitlab, "already-home"));
            yield* rehomeSessionStores(SessionRehomeRequest.make({ from: github, to: gitlab, apply: true }));
            return yield* ledger.list(gitlab);
          }).pipe(withStores);
          expect(A.map(ledgerRows, (row) => row.next)).toEqual(["first", "already-home", "second"]);
        })
      )
    );

    it.effect("refuses identical repositories and a malformed slug", () =>
      withStateRoot(() =>
        Effect.gen(function* () {
          const same = yield* rehomeSessionStores(
            SessionRehomeRequest.make({ from: github, to: github, apply: true })
          ).pipe(withStores, Effect.flip);
          expect(same._tag).toBe("SessionLedgerError");
          expect(same.message).toBe("--from and --to name the same repository; nothing to rehome.");
          const sameCli = yield* runSession([
            "rehome",
            "--from",
            "github.com/beep-effect/beep-effect-private",
            "--to",
            "GitHub.com/beep-effect/beep-effect-private",
          ]).pipe(Effect.flip);
          expect(sameCli.message).toBe("[session] --from and --to name the same repository; nothing to rehome.");
          const malformed = yield* runSession(["rehome", "--from", "beep-effect/beep-effect", "--to", "a/b/c"]).pipe(
            Effect.flip
          );
          expect(malformed.message).toBe('[session] --from must be host/owner/name; got "beep-effect/beep-effect".');
        })
      )
    );
  });
});
