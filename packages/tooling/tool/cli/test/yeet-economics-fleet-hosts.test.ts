// PERIL-11 slice 3 admission gate: `yeet economics --fleet-hosts` reads fleet
// hosts' attempt journals read-only over their existing SSH wrappers. Every
// shell here is a fake: `fakeShell` answers only the exact read-only command
// built for the configured roots and dies on any other command line, and the
// live shell runs against a scripted spawner. No test opens an SSH connection
// or reads a real machine; the state directory and checkout live on an
// in-memory volume.
import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import { repoRunArtifactId } from "@beep/repo-cli/test/RepoRun";
import { HostLabel, UUID } from "@beep/repo-cli/test/SharedInternals";
import {
  classifyFleetHostJournalPath,
  EconomicsScopeRequest,
  FleetHostEntry,
  FleetHostReadCommand,
  FleetHostReadReceipt,
  FleetHostRoot,
  FleetHostShell,
  FleetHostShellError,
  FleetHostShellOutput,
  FleetHostsDocument,
  FleetHostsRead,
  fleetHostReadCommand,
  isReadOnlyFleetHostCommand,
  parseFleetHostReadOutput,
  runYeetEconomics,
  YeetAttemptJournalEvent,
  YeetAttemptStarted,
  YeetAttemptTerminated,
  YeetEconomicsOptions,
  YeetEconomicsReportJson,
  YeetEconomicsSource,
  YeetFleetHostSource,
  YeetReviewLaneSource,
} from "@beep/repo-cli/test/Yeet";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome, assertTrue, deepStrictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Digest from "effect/crypto/Digest";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import * as TestConsole from "effect/testing/TestConsole";
import { provideSpawner } from "./support/ScriptedProcess.ts";
import type { FleetHostRoute, FleetHostShellShape } from "@beep/repo-cli/test/Yeet";

const ORIGIN = "git@github.com:beep-effect/beep-effect.git";
const REPO_KEY = "github.com__beep-effect__beep-effect";
const CLONE = "/projects/beep-effect";
const FLEET_STATE = "/state/fleet";
const ENV = { BEEP_FLEET_STATE_ROOT: FLEET_STATE, BEEP_YEET_STATE_ROOT: "/state/yeet", HOME: "/home/operator" };
const HEAD_SHA = Str.repeat(40)("e");

const encodeEvent = S.encodeUnknownEffect(S.fromJsonString(YeetAttemptJournalEvent));
const encodeHosts = S.encodeUnknownEffect(S.fromJsonString(FleetHostsDocument));
const isReadCommand = S.is(FleetHostReadCommand);

const attemptId = (suffix: number): UUID => UUID.make(`2b7d9e4f-6a1c-4d3e-8f5a-${Str.padStart(12, "0")(`${suffix}`)}`);
const root = (path: string): FleetHostRoot => FleetHostRoot.make(path);

// One interrupted attempt; `host` and `seat` set as this revision writes them, or absent as before it.
const attemptLines = Effect.fnUntraced(function* (id: UUID, origin: O.Option<string>) {
  const started = YeetAttemptStarted.make({
    schemaVersion: "yeet-attempt-journal/v1",
    _tag: "attempt-started",
    attemptId: id,
    runId: "remote-run",
    branch: "main",
    base: "origin/main",
    head: HEAD_SHA,
    mode: "verify",
    startedAt: "2026-11-14T00:00:00.000Z",
    host: O.map(origin, HostLabel.make),
    seat: O.as(origin, "codex"),
  });
  const terminated = YeetAttemptTerminated.make({
    schemaVersion: "yeet-attempt-journal/v1",
    _tag: "attempt-terminated",
    attemptId: id,
    recordedAt: "2026-11-14T00:03:00.000Z",
    reason: "interrupted",
  });
  return yield* Effect.forEach([started, terminated], (event) => encodeEvent(event));
});

const journalText = Effect.fnUntraced(function* (attempts: ReadonlyArray<readonly [UUID, O.Option<string>]>) {
  const lines = yield* Effect.forEach(attempts, ([id, origin]) => attemptLines(id, origin));
  return `${A.join(A.flatten(lines), "\n")}\n`;
});

// What GNU `tail -v` prints for one invocation: a header per file, a newline between files.
const tailOutput = (files: ReadonlyArray<readonly [string, string]>): string =>
  A.join(
    A.map(files, ([path, contents]) => `==> ${path} <==\n${contents}`),
    "\n"
  );

const writeClone = Effect.fnUntraced(function* (clone: string, origin: string) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.makeDirectory(`${clone}/.git`, { recursive: true });
  yield* fs.writeFileString(`${clone}/.git/config`, `[core]\n\tbare = false\n[remote "origin"]\n\turl = ${origin}\n`);
});

const writeHosts = Effect.fnUntraced(function* (hosts: ReadonlyArray<FleetHostEntry>) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.makeDirectory(`${FLEET_STATE}/${REPO_KEY}`, { recursive: true });
  const text = yield* encodeHosts(FleetHostsDocument.make({ schemaVersion: "fleet-hosts/v1", hosts }));
  yield* fs.writeFileString(`${FLEET_STATE}/${REPO_KEY}/hosts.json`, text);
});

const host = (label: string, route: FleetHostRoute, roots: A.NonEmptyReadonlyArray<string>): FleetHostEntry =>
  FleetHostEntry.make({ host: HostLabel.make(label), route, roots: A.map(roots, root) });

type ShellAnswer = Effect.Effect<FleetHostShellOutput, FleetHostShellError>;

interface ShellCall {
  readonly command: string;
  readonly route: FleetHostRoute;
}

// The fake SSH executor: it records each call, answers only the exact read-only command for
// the route's configured roots, and dies on any other command line, so a test fails the moment
// the source sends anything that is not the journal read.
const fakeShell = (
  hosts: ReadonlyArray<FleetHostEntry>,
  answers: HashMap.HashMap<FleetHostRoute, ShellAnswer>,
  calls: Ref.Ref<ReadonlyArray<ShellCall>>
): FleetHostShellShape => {
  const expected = HashMap.fromIterable(A.map(hosts, (entry) => [entry.route, fleetHostReadCommand(entry.roots)]));
  return FleetHostShell.of({
    run: Effect.fn("FakeFleetHostShell.run")(function* (route: FleetHostRoute, command: FleetHostReadCommand) {
      yield* Ref.update(calls, A.append({ route, command }));
      const readOnly = isReadCommand(command) && O.contains(HashMap.get(expected, route), command);
      return yield* readOnly
        ? O.getOrElse(HashMap.get(answers, route), () => Effect.die(`no answer scripted for ${route}`))
        : Effect.die(`fake shell refused a non-read-only command on ${route}: ${command}`);
    }),
  });
};

const output = (exitCode: number, stdout: string, truncated = false): ShellAnswer =>
  Effect.succeed(FleetHostShellOutput.make({ exitCode, stdout, truncated }));
const shellFailure = (reason: FleetHostShellError["reason"]): ShellAnswer =>
  Effect.fail(FleetHostShellError.make({ reason, message: reason }));
const answer = (route: FleetHostRoute, reply: ShellAnswer): readonly [FleetHostRoute, ShellAnswer] => [route, reply];

const Platform = Layer.mergeAll(MemoryFileSystem.layer, Path.layer, Digest.layerWebCrypto);

const withEnv = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env: ENV })));

const readHosts = Effect.fnUntraced(function* (
  shell: FleetHostShellShape,
  request: Partial<{ readonly fleetHosts: boolean; readonly branch: O.Option<string> }> = {}
) {
  const source = yield* YeetFleetHostSource.make.pipe(Effect.provideService(FleetHostShell, shell));
  return yield* withEnv(
    source.read(
      EconomicsScopeRequest.make({
        repoRoot: CLONE,
        branch: request.branch ?? O.none(),
        fleet: true,
        fleetHosts: request.fleetHosts ?? true,
      })
    )
  );
});

const BEEP_WORKER = host("beep-worker", "ssh-beep-worker-yubi", [
  "YeeBois/projects",
  ".local/state/beep/yeet/attempts",
]);
const TBK_WORKER = host("tbk-worker", "ssh-tbk-worker", ["YeeBois/projects"]);
const DANKSERVER = host("dankserver", "ssh-dankserver-worker", ["YeeBois/projects"]);
const TOM_PC = host("tom-pc-1-wsl", "ssh-tom-pc-1-wsl", ["YeeBois/projects"]);
const GROK_BOT = host("grok-bot", "ssh-grok-bot", ["workspace"]);
const FLEET = [BEEP_WORKER, TBK_WORKER, DANKSERVER, TOM_PC, GROK_BOT];

// beep-worker's read: two live checkouts, its store's partition for this fleet (one attempt a
// live journal also holds), another repository's partition and a deeper pattern match (both
// skipped), and the main checkout's journal printed twice, as two overlapping roots would.
const beepWorkerOutput = Effect.fnUntraced(function* () {
  const mainRun = yield* repoRunArtifactId("main");
  const laneRun = yield* repoRunArtifactId("feat/lane");
  const main = yield* journalText([
    [attemptId(1), O.some("beep-worker")],
    [attemptId(2), O.none()],
  ]);
  const lane = yield* journalText([[attemptId(3), O.some("beep-worker")]]);
  const stored = yield* journalText([
    [attemptId(1), O.some("beep-worker")],
    [attemptId(4), O.some("beep-worker")],
  ]);
  const foreign = yield* journalText([[attemptId(5), O.none()]]);
  const mainPath = `YeeBois/projects/beep-effect/.beep/yeet/runs/${mainRun}/attempts.ndjson`;
  return tailOutput([
    [mainPath, main],
    [`YeeBois/projects/beep-effect-worktrees/lane/.beep/yeet/runs/${laneRun}/attempts.ndjson`, lane],
    [mainPath, main],
    [`YeeBois/projects/junk/runs/${mainRun}/deeper/attempts.ndjson`, foreign],
    [`.local/state/beep/yeet/attempts/${REPO_KEY}/runs/${mainRun}/attempts.ndjson`, stored],
    [`.local/state/beep/yeet/attempts/github.com__acme__other/runs/${mainRun}/attempts.ndjson`, foreign],
  ]);
});

const fleetAnswers = Effect.fnUntraced(function* () {
  const tomRun = yield* repoRunArtifactId("main");
  const tom = yield* journalText([[attemptId(6), O.some("tom-pc-1-wsl")]]);
  const beepWorker = yield* beepWorkerOutput();
  return HashMap.fromIterable([
    answer("ssh-beep-worker-yubi", output(0, beepWorker)),
    answer("ssh-tbk-worker", shellFailure("timeout")),
    answer("ssh-dankserver-worker", output(255, "")),
    answer(
      "ssh-tom-pc-1-wsl",
      output(1, tailOutput([[`YeeBois/projects/beep-effect/.beep/yeet/runs/${tomRun}/attempts.ndjson`, tom]]))
    ),
    answer("ssh-grok-bot", output(0, "==> partial", true)),
  ]);
});

const receiptRows = (read: FleetHostsRead) =>
  A.map(read.receipts, (receipt) => [
    receipt.host,
    receipt.status,
    O.getOrNull(receipt.unreachableReason),
    O.getOrNull(receipt.exitCode),
    receipt.journals,
    receipt.attempts,
    receipt.skippedFiles,
  ]);

describe("the read-only remote command", () => {
  it("is find over the roots and the fixed tail suffix, every token quoted", () => {
    expect(fleetHostReadCommand([root("YeeBois/projects"), root(".local/state/beep/yeet/attempts")])).toBe(
      "'find' 'YeeBois/projects' '.local/state/beep/yeet/attempts' '-maxdepth' '8' '(' '-name' 'node_modules' '-o' '-name' '.git' ')' '-prune' '-o' '-type' 'f' '-path' '*/runs/*/attempts.ndjson' '-exec' 'tail' '-v' '-c' '+1' '--' '{}' '+'"
    );
  });

  it("accepts only that command and refuses every write, extra program or unsafe root", () => {
    const read = fleetHostReadCommand([root("YeeBois/projects")]);
    expect(isReadOnlyFleetHostCommand(read)).toBe(true);
    const refused = [
      "'mkdir' '-p' '.cache'",
      Str.replace("'find'", "'rm'")(read),
      Str.replace("'tail' '-v'", "'tee' '-a'")(read),
      Str.replace("'+'", "'+' '-delete'")(read),
      `${read} > out`,
      Str.replace("'YeeBois/projects'", "'YeeBois/../projects'")(read),
      Str.replace("'YeeBois/projects'", "'/etc'")(read),
      Str.replace("'YeeBois/projects' ", "")(read),
      Str.replace("'YeeBois/projects'", "YeeBois/projects")(read),
      "",
    ];
    deepStrictEqual(
      A.map(refused, isReadOnlyFleetHostCommand),
      A.map(refused, () => false)
    );
  });

  it("decodes only the existing ordinary SSH wrappers and distinct, home-relative roots", () => {
    const decode = S.decodeUnknownOption(FleetHostsDocument);
    const entry = (route: string, roots: ReadonlyArray<string>) => ({ host: "beep-worker", route, roots });
    assertSome(
      O.map(
        decode({ schemaVersion: "fleet-hosts/v1", hosts: [entry("ssh-beep-worker-yubi", ["YeeBois/projects"])] }),
        (document) => A.length(document.hosts)
      ),
      1
    );
    assertNone(decode({ schemaVersion: "fleet-hosts/v1", hosts: [entry("ssh", ["YeeBois/projects"])] }));
    assertNone(
      decode({ schemaVersion: "fleet-hosts/v1", hosts: [entry("ssh-dankserver-yubi", ["YeeBois/projects"])] })
    );
    assertNone(decode({ schemaVersion: "fleet-hosts/v1", hosts: [entry("ssh-tbk-worker", ["~/projects"])] }));
    assertNone(decode({ schemaVersion: "fleet-hosts/v1", hosts: [entry("ssh-tbk-worker", [])] }));
    assertNone(
      decode({
        schemaVersion: "fleet-hosts/v1",
        hosts: [entry("ssh-tbk-worker", ["a"]), entry("ssh-beep-worker-yubi", ["b"])],
      })
    );
  });
});

// A path segment that can never be `.` or `..`: it starts with a letter, digit, `_` or `-`.
const PlainSegment = S.String.check(S.isPattern(/^[A-Za-z0-9_-][A-Za-z0-9._-]{0,11}$/u));
const decodeRoot = S.decodeUnknownOption(FleetHostRoot);
const ReceiptJson = S.fromJsonString(FleetHostReadReceipt);
const encodeReceipt = S.encodeResult(ReceiptJson);
const decodeReceipt = S.decodeResult(ReceiptJson);

describe("schema-derived fleet host properties", () => {
  it.prop(
    "builds a command the read-only check accepts for every root of plain segments",
    { roots: Arbitrary.schema(PlainSegment.pipe(S.NonEmptyArray, S.NonEmptyArray)) },
    ({ roots }) => {
      const decoded = A.map(roots, (segments) => decodeRoot(A.join(segments, "/")));
      assertTrue(A.every(decoded, O.isSome));
      const valid = A.getSomes(decoded);
      assertTrue(A.isReadonlyArrayNonEmpty(valid) && isReadOnlyFleetHostCommand(fleetHostReadCommand(valid)));
    },
    { arbitrary: fcRuns(50) }
  );

  it.prop(
    "round trips every generated host receipt through the report's JSON",
    { receipt: Arbitrary.schema(FleetHostReadReceipt) },
    ({ receipt }) => {
      // Compared as JSON text: a generated -0 encodes as 0, so the decoded value differs by Object.is.
      const encoded = Result.getOrThrow(encodeReceipt(receipt));
      const reencoded = decodeReceipt(encoded).pipe(Result.getOrThrow, encodeReceipt, Result.getOrThrow);
      expect(reencoded).toBe(encoded);
    },
    { arbitrary: fcRuns(50) }
  );
});

describe("the remote output", () => {
  it("splits files exactly, torn tails and batch boundaries included, and keeps a repeated path once", () => {
    const parsed = parseFleetHostReadOutput(
      A.join(
        [
          "==> a/runs/r/attempts.ndjson <==",
          "{}",
          "",
          "==> b/runs/r/attempts.ndjson <==",
          '{"torn',
          "==> empty/runs/r/attempts.ndjson <==",
          "",
          "==> c/runs/r/attempts.ndjson <==",
          "{}",
          // A second `tail` invocation's header follows the previous file's bytes directly.
          '{"cut==> d/runs/r/attempts.ndjson <==',
          "{}",
          "",
          "==> a/runs/r/attempts.ndjson <==",
          "{}",
          "",
        ],
        "\n"
      )
    );
    deepStrictEqual(
      A.map(parsed, (file) => [file.path, file.contents]),
      [
        ["a/runs/r/attempts.ndjson", "{}\n"],
        ["b/runs/r/attempts.ndjson", '{"torn'],
        ["empty/runs/r/attempts.ndjson", ""],
        ["c/runs/r/attempts.ndjson", '{}\n{"cut'],
        ["d/runs/r/attempts.ndjson", "{}\n"],
      ]
    );
    deepStrictEqual(parseFleetHostReadOutput(""), []);
  });

  it("classifies live checkouts and this fleet's store partition, and nothing else", () => {
    const classify = classifyFleetHostJournalPath(REPO_KEY);
    const live = classify("YeeBois/projects/beep-effect/.beep/yeet/runs/main-1/attempts.ndjson");
    assertSome(
      O.flatMap(live, (entry) => entry.checkout),
      "YeeBois/projects/beep-effect"
    );
    const stored = classify(`.local/state/beep/yeet/attempts/${REPO_KEY}/runs/main-1/attempts.ndjson`);
    assertSome(
      O.map(stored, (entry) => [O.isNone(entry.checkout), entry.runId]),
      [true, "main-1"]
    );
    // A checkout at the home directory itself still counts, under no checkout path.
    assertSome(
      O.map(classify(".beep/yeet/runs/main-1/attempts.ndjson"), (entry) => entry.runId),
      "main-1"
    );
    assertNone(classify(".local/state/beep/yeet/attempts/github.com__acme__other/runs/main-1/attempts.ndjson"));
    assertNone(classify("YeeBois/projects/junk/runs/main-1/deeper/attempts.ndjson"));
    assertNone(classify("YeeBois/projects/junk/runs/main-1/attempts.ndjson"));
    assertNone(classify("runs//attempts.ndjson"));
    assertNone(classify("attempts.ndjson"));
  });
});

it.layer(Platform, { timeout: "30 seconds" })("fleet host source", (it) => {
  it.effect("reads every configured host once, in order, with only the read-only command", () =>
    Effect.gen(function* () {
      yield* writeClone(CLONE, ORIGIN);
      yield* writeHosts(FLEET);
      const calls = yield* Ref.make<ReadonlyArray<ShellCall>>([]);
      const answers = yield* fleetAnswers();
      const read = yield* readHosts(fakeShell(FLEET, answers, calls));

      const recorded = yield* Ref.get(calls);
      deepStrictEqual(
        A.map(recorded, (call) => call.route),
        A.map(FLEET, (entry) => entry.route)
      );
      expect(A.every(recorded, (call) => isReadOnlyFleetHostCommand(call.command))).toBe(true);
      deepStrictEqual(receiptRows(read), [
        ["beep-worker", "read", null, 0, 3, 4, 2],
        ["tbk-worker", "unreachable", "timeout", null, 0, 0, 0],
        ["dankserver", "unreachable", "connection-failed", 255, 0, 0, 0],
        ["tom-pc-1-wsl", "partial", null, 1, 1, 1, 0],
        ["grok-bot", "unreachable", "output-truncated", 0, 0, 0, 0],
      ]);
      deepStrictEqual(
        A.map(read.journals, (journal) => [journal.checkout, A.length(journal.attempts)]),
        [
          ["beep-worker:YeeBois/projects/beep-effect", 2],
          ["beep-worker:YeeBois/projects/beep-effect-worktrees/lane", 1],
          ["beep-worker:(retained)", 1],
          ["tom-pc-1-wsl:YeeBois/projects/beep-effect", 1],
        ]
      );
      // The store's copy of attempt 1 is dropped: the live journal of the same run holds it.
      const retained = O.getOrThrow(
        A.findFirst(read.journals, (journal) => journal.checkout === "beep-worker:(retained)")
      );
      expect(retained.diagnostics.duplicateStartedRowsDeduplicated).toBe(1);
      deepStrictEqual(
        A.map(
          A.flatMap(read.journals, (journal) => journal.attempts),
          (attempt) => O.getOrNull(attempt.host)
        ),
        ["beep-worker", null, "beep-worker", "beep-worker", "tom-pc-1-wsl"]
      );
    })
  );

  it.effect("reports a wrapper refusal, a spawn failure and a refused command as unreachable", () =>
    Effect.gen(function* () {
      const hosts = [BEEP_WORKER, TBK_WORKER, DANKSERVER];
      yield* writeClone(CLONE, ORIGIN);
      yield* writeHosts(hosts);
      const calls = yield* Ref.make<ReadonlyArray<ShellCall>>([]);
      const answers = HashMap.fromIterable([
        answer("ssh-beep-worker-yubi", output(78, "")),
        answer("ssh-tbk-worker", shellFailure("spawn-failed")),
        answer("ssh-dankserver-worker", shellFailure("refused-command")),
      ]);
      const read = yield* readHosts(fakeShell(hosts, answers, calls));
      deepStrictEqual(
        A.map(read.receipts, (receipt) => O.getOrNull(receipt.unreachableReason)),
        ["route-failed", "spawn-failed", "refused-command"]
      );
      deepStrictEqual(read.journals, []);
    })
  );

  it.effect("narrows each host to the branch's run", () =>
    Effect.gen(function* () {
      yield* writeClone(CLONE, ORIGIN);
      yield* writeHosts([BEEP_WORKER]);
      const calls = yield* Ref.make<ReadonlyArray<ShellCall>>([]);
      const beepWorker = yield* beepWorkerOutput();
      const answers = HashMap.fromIterable([answer("ssh-beep-worker-yubi", output(0, beepWorker))]);
      const read = yield* readHosts(fakeShell([BEEP_WORKER], answers, calls), { branch: O.some("feat/lane") });
      deepStrictEqual(
        A.map(read.journals, (journal) => journal.checkout),
        ["beep-worker:YeeBois/projects/beep-effect-worktrees/lane"]
      );
      deepStrictEqual(receiptRows(read), [["beep-worker", "read", null, 0, 1, 1, 2]]);
    })
  );

  it.effect("reads no host without the flag, a GitHub origin, or a decodable hosts.json", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const calls = yield* Ref.make<ReadonlyArray<ShellCall>>([]);
      const shell = fakeShell(FLEET, HashMap.empty(), calls);
      const none = FleetHostsRead.make({ journals: [], receipts: [] });
      yield* fs.remove(FLEET_STATE, { recursive: true }).pipe(Effect.ignore);
      yield* writeClone(CLONE, "/srv/git/beep-effect.git");
      const noOrigin = yield* readHosts(shell);
      yield* writeClone(CLONE, ORIGIN);
      const noFile = yield* readHosts(shell);
      yield* writeHosts(FLEET);
      const noFlag = yield* readHosts(shell, { fleetHosts: false });
      yield* fs.writeFileString(
        `${FLEET_STATE}/${REPO_KEY}/hosts.json`,
        '{"schemaVersion":"fleet-hosts/v1","hosts":[{}]}'
      );
      const undecodable = yield* readHosts(shell);
      deepStrictEqual([noOrigin, noFile, noFlag, undecodable], [none, none, none, none]);
      const recorded = yield* Ref.get(calls);
      deepStrictEqual(recorded, []);
    })
  );

  it.effect("the fake shell dies on any command that is not the journal read", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<ReadonlyArray<ShellCall>>([]);
      const shell = fakeShell([TBK_WORKER], HashMap.fromIterable([answer("ssh-tbk-worker", output(0, ""))]), calls);
      const forged = yield* Effect.exit(shell.run("ssh-tbk-worker", "'mkdir' '-p' 'x'" as FleetHostReadCommand));
      expect(Exit.hasDies(forged)).toBe(true);
      const otherRoots = yield* Effect.exit(shell.run("ssh-tbk-worker", fleetHostReadCommand([root("elsewhere")])));
      expect(Exit.hasDies(otherRoots)).toBe(true);
      const read = yield* shell.run("ssh-tbk-worker", fleetHostReadCommand(TBK_WORKER.roots));
      expect(read.exitCode).toBe(0);
    })
  );
});

const CommandLayer = Layer.mergeAll(
  Layer.provideMerge(Layer.mergeAll(YeetEconomicsSource.layer, YeetReviewLaneSource.layer), Platform),
  TestConsole.layer
);

it.layer(CommandLayer, { timeout: "30 seconds" })("yeet economics --fleet-hosts", (it) => {
  it.effect("folds the hosts into the report as aggregates and never prints a raw row", () =>
    Effect.gen(function* () {
      yield* writeClone(CLONE, ORIGIN);
      yield* writeHosts(FLEET);
      const calls = yield* Ref.make<ReadonlyArray<ShellCall>>([]);
      const answers = yield* fleetAnswers();
      const shell = fakeShell(FLEET, answers, calls);
      const hostSource = yield* YeetFleetHostSource.make.pipe(Effect.provideService(FleetHostShell, shell));
      const run = (json: boolean) =>
        withEnv(
          runYeetEconomics(
            YeetEconomicsOptions.make({ json, branch: O.none(), fleet: false, fleetHosts: true }),
            Effect.succeed(CLONE)
          )
        ).pipe(Effect.provideService(YeetFleetHostSource, hostSource));
      yield* run(true);
      yield* run(false);
      const lines = yield* TestConsole.logLines;
      const report = yield* YeetEconomicsReportJson.decode(`${lines[0]}`);
      expect(report.scope.kind).toBe("fleet");
      deepStrictEqual(
        A.map(report.scope.hosts, (receipt) => [receipt.host, receipt.status]),
        [
          ["beep-worker", "read"],
          ["tbk-worker", "unreachable"],
          ["dankserver", "unreachable"],
          ["tom-pc-1-wsl", "partial"],
          ["grok-bot", "unreachable"],
        ]
      );
      expect(report.scope.checkouts).toContain("beep-worker:(retained)");
      deepStrictEqual(
        A.map(report.attempts.all.hostMix, (row) => [row.key, row.count]),
        [
          ["beep-worker", 3],
          ["tom-pc-1-wsl", 1],
          ["unrecorded", 1],
        ]
      );
      const text = `${lines[1]}`;
      expect(
        Str.includes(
          "  fleet hosts: beep-worker read (3 journal(s), 4 attempt(s), 2 skipped file(s)), tbk-worker unreachable (timeout)"
        )(text)
      ).toBe(true);
      // Only aggregates leave the fold: no row tag, head or attempt id reaches the output.
      const leaks = A.filter(A.map(lines, String), (line) =>
        A.some(["attempt-started", HEAD_SHA, attemptId(1)], (raw) => Str.includes(raw)(line))
      );
      deepStrictEqual(leaks, []);
      const recorded = yield* Ref.get(calls);
      expect(A.length(recorded)).toBe(2 * A.length(FLEET));
    })
  );
});

it.layer(SecureRandom.layerWebCrypto)("the live fleet host shell", (it) => {
  const READ = fleetHostReadCommand([root("YeeBois/projects")]);
  const liveShell = (spawner: ScriptedSpawner) => FleetHostShell.make.pipe(provideSpawner(spawner));

  it.effect("runs the wrapper with the one read command and standard input closed", () =>
    Effect.gen(function* () {
      const spawner = ScriptedSpawner.make((command, args) =>
        command === "ssh-tbk-worker" && A.every(args, isReadOnlyFleetHostCommand)
          ? { stdout: "==> x <==\n", exit: 1 }
          : { exit: 99 }
      );
      const shell = yield* liveShell(spawner);
      const output = yield* shell.run("ssh-tbk-worker", READ);
      deepStrictEqual([output.exitCode, output.stdout, output.truncated], [1, "==> x <==\n", false]);
      deepStrictEqual(
        A.map(spawner.spawns, (spawn) => [spawn.command, spawn.args, spawn.options.stdin]),
        [["ssh-tbk-worker", [READ], "ignore"]]
      );
    })
  );

  it.effect("refuses a forged command without starting anything", () =>
    Effect.gen(function* () {
      const spawner = ScriptedSpawner.make(() => ({}));
      const shell = yield* liveShell(spawner);
      const error = yield* shell.run("ssh-tbk-worker", "'rm' '-rf' 'x'" as FleetHostReadCommand).pipe(Effect.flip);
      expect(error.reason).toBe("refused-command");
      deepStrictEqual(spawner.spawns, []);
    })
  );

  it.effect("reports a wrapper that is not installed as a spawn failure", () =>
    Effect.gen(function* () {
      const shell = yield* liveShell(ScriptedSpawner.make((command) => ScriptedSpawner.notFound(command)));
      const error = yield* shell.run("ssh-grok-bot", READ).pipe(Effect.flip);
      expect(error.reason).toBe("spawn-failed");
    })
  );
});

// Its own test clock: the adjustment cannot leak into another test.
describe("the live fleet host shell's deadline", () => {
  const secureRandom = SecureRandom.make((size) => globalThis.crypto.getRandomValues(new Uint8Array(size)));

  it.effect("times a read out after two minutes", () =>
    Effect.gen(function* () {
      const shell = yield* FleetHostShell.make.pipe(provideSpawner(ScriptedSpawner.make(() => ({ hang: true }))));
      const read = fleetHostReadCommand([root("YeeBois/projects")]);
      const fiber = yield* shell.run("ssh-dankserver-worker", read).pipe(Effect.flip, Effect.forkChild);
      yield* TestClock.adjust(Duration.minutes(2));
      const error = yield* Fiber.join(fiber);
      expect(error.reason).toBe("timeout");
    }).pipe(Effect.provideService(SecureRandom.SecureRandom, secureRandom))
  );
});
