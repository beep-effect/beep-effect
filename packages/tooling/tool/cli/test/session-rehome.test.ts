import { Git } from "@beep/git/Git";
import { sessionCommand } from "@beep/repo-cli";
import {
  CheckoutRepository,
  CheckoutRepositorySlug,
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
  renderSessionRehomeReport,
  rulingsFileName,
  SessionLedger,
  SessionLedgerRow,
  SessionPresence,
  SessionPresenceStore,
  SessionRehomeReport,
  SessionRehomeRequest,
  SessionRehomeStorePlan,
  sessionLedgerFileName,
  sessionPresenceFileName,
} from "@beep/repo-cli/test/Session";
import { checkoutRepositoryStateKey } from "@beep/repo-cli/test/SharedInternals";
import { fleetRepositoryKey } from "@beep/repo-cli/test/Worktree";
import { fcRuns } from "@beep/test-utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
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
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import type { CheckoutRepositoryKey } from "@beep/repo-cli/test/SharedInternals";

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

const StoreSuffix = S.Literals(["", ".presence", ".rulings"]);

const storeFileName = (suffix: typeof StoreSuffix.Type) =>
  suffix === ".presence" ? sessionPresenceFileName : suffix === ".rulings" ? rulingsFileName : sessionLedgerFileName;

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

  it("keys repositories apart where an underscore could blur the __ delimiter", () => {
    const key = (owner: string, name: string) =>
      checkoutRepositoryStateKey({ host: "gitlab.example.com", owner, name });
    expect(key("team__app", "repo")).toBe("gitlab.example.com__team%5F%5Fapp__repo");
    expect(key("team", "app__repo")).toBe("gitlab.example.com__team__app%5F%5Frepo");
    expect(key("team_", "_api")).toBe("gitlab.example.com__team%5F__%5Fapi");
    expect(key("team", "__api")).toBe("gitlab.example.com__team__%5F%5Fapi");
    expect(key("beep-effect", "beep_effect")).toBe("gitlab.example.com__beep-effect__beep_effect");
    const split = CheckoutRepository.make({ host: "gitlab.example.com", owner: "team__app", name: "repo" });
    const joined = CheckoutRepository.make({ host: "gitlab.example.com", owner: "team", name: "app__repo" });
    expect(sessionLedgerFileName(split)).not.toBe(sessionLedgerFileName(joined));
    expect(sessionPresenceFileName(split)).not.toBe(sessionPresenceFileName(joined));
    expect(fleetRepositoryKey(split)).toBe(checkoutRepositoryStateKey(split));
  });

  it("keeps a repository named like a store suffix out of its sibling's variant file", () => {
    const repo = CheckoutRepository.make({ host: "gitlab.example.com", owner: "team", name: "repo" });
    const presenceNamed = CheckoutRepository.make({ host: "gitlab.example.com", owner: "team", name: "repo.presence" });
    const rulingsNamed = CheckoutRepository.make({ host: "gitlab.example.com", owner: "team", name: "repo.rulings" });
    expect(sessionLedgerFileName(presenceNamed)).toBe("gitlab.example.com__team__repo%2Epresence.jsonl");
    expect(sessionPresenceFileName(repo)).toBe("gitlab.example.com__team__repo.presence.jsonl");
    expect(sessionPresenceFileName(presenceNamed)).toBe("gitlab.example.com__team__repo%2Epresence.presence.jsonl");
    expect(sessionPresenceFileName(presenceNamed)).not.toBe(sessionPresenceFileName(repo));
    expect(rulingsFileName(rulingsNamed)).toBe("gitlab.example.com__team__repo%2Erulings.rulings.jsonl");
    expect(registerFileName(rulingsNamed)).toBe("gitlab.example.com__team__repo%2Erulings.jsonl");
    expect(rulingsFileName(repo)).toBe("gitlab.example.com__team__repo.rulings.jsonl");
    expect(checkoutRepositoryStateKey({ host: "gitlab.example.com", owner: "team", name: "repo.presenced" })).toBe(
      "gitlab.example.com__team__repo.presenced"
    );
  });

  it.effect.prop(
    "gives two store files in one directory one name only for the same repository and store",
    [CheckoutRepository, CheckoutRepository, StoreSuffix, StoreSuffix, StoreSuffix, StoreSuffix],
    ([left, right, leftNameSuffix, rightNameSuffix, leftStore, rightStore]) =>
      Effect.sync(() => {
        const named = (repository: CheckoutRepositoryKey, suffix: string) =>
          CheckoutRepository.make({ ...repository, name: `${repository.name}${suffix}` });
        const leftRepository = named(left, leftNameSuffix);
        const rightRepository = named(right, rightNameSuffix);
        const sameRepository =
          leftRepository.host === rightRepository.host &&
          leftRepository.owner === rightRepository.owner &&
          leftRepository.name === rightRepository.name;
        expect(storeFileName(leftStore)(leftRepository) === storeFileName(rightStore)(rightRepository)).toBe(
          sameRepository && leftStore === rightStore
        );
      }),
    { arbitrary: fcRuns(200) }
  );

  it.effect.prop(
    "gives two repositories one state key only when they are the same repository",
    [CheckoutRepository, CheckoutRepository],
    ([left, right]) =>
      Effect.sync(() => {
        const sameRepository = left.host === right.host && left.owner === right.owner && left.name === right.name;
        expect(checkoutRepositoryStateKey(left) === checkoutRepositoryStateKey(right)).toBe(sameRepository);
      }),
    { arbitrary: fcRuns(200) }
  );

  it.effect.prop(
    "round-trips any lower-cased repository through its slug",
    [CheckoutRepository],
    ([repository]) =>
      Effect.gen(function* () {
        const lowered = CheckoutRepository.make({
          host: repository.host,
          owner: Str.toLowerCase(repository.owner),
          name: Str.toLowerCase(repository.name),
        });
        const slug = yield* S.encodeEffect(CheckoutRepositorySlug)(lowered);
        const decoded = yield* S.decodeEffect(CheckoutRepositorySlug)(slug);
        expect(decoded).toEqual(lowered);
      }),
    { arbitrary: fcRuns(100) }
  );

  it.effect("round-trips a repository slug and refuses one without an owner", () =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(CheckoutRepositorySlug)(gitlab);
      const decoded = yield* S.decodeEffect(CheckoutRepositorySlug)(" GitLab.Example.com/Team/Beep-Effect-Private ");
      expect(encoded).toBe("gitlab.example.com/team/beep-effect-private");
      expect(decoded).toEqual(gitlab);
      assertNone(S.decodeOption(CheckoutRepositorySlug)("github.com"));
    })
  );

  it("renders an applied rehome with the copied total", () => {
    const plan = (store: "ledger" | "presence", newRows: number) =>
      SessionRehomeStorePlan.make({
        store,
        sourceFile: "/state/a.jsonl",
        sourceRows: 2,
        targetFile: "/state/b.jsonl",
        targetRows: 1,
        newRows,
      });
    const report = SessionRehomeReport.make({
      from: github,
      to: gitlab,
      applied: true,
      stores: [plan("ledger", 1), plan("presence", 2)],
    });
    expect(renderSessionRehomeReport(report)).toBe(
      A.join(
        [
          "[session] rehome github.com/beep-effect/beep-effect-private -> gitlab.example.com/team/beep-effect-private",
          "- ledger: 2 row(s) in /state/a.jsonl -> /state/b.jsonl (1 already there, 1 copied)",
          "- presence: 2 row(s) in /state/a.jsonl -> /state/b.jsonl (1 already there, 2 copied)",
          "[session] copied 3 row(s); the source files stay in place as the backup.",
        ],
        "\n"
      )
    );
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

    it.effect("rehomes between a repository and one named like its store suffix in both directions", () =>
      withStateRoot(({ sessions, orchestrator }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const repo = CheckoutRepository.make({ host: "gitlab.example.com", owner: "team", name: "repo" });
          const presenceNamed = CheckoutRepository.make({ ...repo, name: "repo.presence" });
          const rulingsNamed = CheckoutRepository.make({ ...repo, name: "repo.rulings" });
          const pairs: ReadonlyArray<readonly [CheckoutRepository, CheckoutRepository]> = [
            [repo, presenceNamed],
            [presenceNamed, repo],
            [repo, rulingsNamed],
            [rulingsNamed, repo],
          ];
          const seed = Effect.fnUntraced(function* (repository: CheckoutRepository) {
            const ledger = yield* SessionLedger;
            const presence = yield* SessionPresenceStore;
            const register = yield* OrchestratorRegister;
            const rulings = yield* OrchestratorRulings;
            yield* ledger.append(ledgerRow(repository, "seed"));
            yield* presence.append(presenceRow(repository));
            yield* register.append(registerRow(repository));
            yield* rulings.append(rulingRow(repository));
          });
          yield* Effect.forEach(
            pairs,
            ([from, to]) =>
              Effect.gen(function* () {
                yield* seed(from).pipe(withStores);
                const dryRun = yield* rehomeSessionStores(SessionRehomeRequest.make({ from, to, apply: false })).pipe(
                  withStores
                );
                const sourceFiles = A.map(dryRun.stores, (plan) => plan.sourceFile);
                const targetFiles = A.map(dryRun.stores, (plan) => plan.targetFile);
                expect(A.intersection(sourceFiles, targetFiles)).toEqual([]);
                const before = yield* Effect.forEach(sourceFiles, readText, { concurrency: 1 });
                yield* rehomeSessionStores(SessionRehomeRequest.make({ from, to, apply: true })).pipe(withStores);
                const after = yield* Effect.forEach(sourceFiles, readText, { concurrency: 1 });
                expect(after).toEqual(before);
              }),
            { concurrency: 1 }
          );
          const sessionFiles = yield* fs.readDirectory(sessions);
          const orchestratorFiles = yield* fs.readDirectory(orchestrator);
          expect(A.sort(sessionFiles, Str.Order)).toEqual([
            "gitlab.example.com__team__repo%2Epresence.jsonl",
            "gitlab.example.com__team__repo%2Epresence.presence.jsonl",
            "gitlab.example.com__team__repo%2Erulings.jsonl",
            "gitlab.example.com__team__repo%2Erulings.presence.jsonl",
            "gitlab.example.com__team__repo.jsonl",
            "gitlab.example.com__team__repo.presence.jsonl",
          ]);
          expect(A.sort(orchestratorFiles, Str.Order)).toEqual([
            "gitlab.example.com__team__repo%2Epresence.jsonl",
            "gitlab.example.com__team__repo%2Epresence.rulings.jsonl",
            "gitlab.example.com__team__repo%2Erulings.jsonl",
            "gitlab.example.com__team__repo%2Erulings.rulings.jsonl",
            "gitlab.example.com__team__repo.jsonl",
            "gitlab.example.com__team__repo.rulings.jsonl",
          ]);
          const presenceNamedLedger = yield* Effect.gen(function* () {
            const ledger = yield* SessionLedger;
            return yield* ledger.list(presenceNamed);
          }).pipe(withStores);
          expect(A.every(presenceNamedLedger, (row) => row.repository.name === "repo.presence")).toBe(true);
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
          expect(same.message).toBe("--from and --to name the same repository partition; nothing to rehome.");
          const sameCli = yield* runSession([
            "rehome",
            "--from",
            "github.com/beep-effect/beep-effect-private",
            "--to",
            "GitHub.com/beep-effect/beep-effect-private",
          ]).pipe(Effect.flip);
          expect(sameCli.message).toBe(
            "[session] --from and --to name the same repository partition; nothing to rehome."
          );
          const malformed = yield* runSession(["rehome", "--from", "beep-effect/beep-effect", "--to", "a/b/c"]).pipe(
            Effect.flip
          );
          expect(malformed.message).toBe('[session] --from must be host/owner/name; got "beep-effect/beep-effect".');
        })
      )
    );

    it.effect("fails typed when no state root resolves", () =>
      withStateRoot(() =>
        Effect.gen(function* () {
          const error = yield* rehomeSessionStores(
            SessionRehomeRequest.make({ from: github, to: gitlab, apply: false })
          ).pipe(
            Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env: {} })),
            withStores,
            Effect.flip
          );
          expect(error.message).toBe("Failed to resolve the session state directory.");
        })
      )
    );
  });
});
