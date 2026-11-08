import * as NodeBuffer from "node:buffer";
import * as NodeZlib from "node:zlib";
import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import {
  CACHE_LOCAL_SUMMARY_REFUSAL,
  CiStepEnvironment,
  ciBootstrapCommands,
  ciCommand,
  prepareCachePilotRequest,
  prepareCachePilotSources,
  readStepVariable,
  runCachePilotInputs,
  summarizeCacheLocalObservation,
} from "@beep/repo-cli/commands/Ci";
import { FsUtilsLive } from "@beep/repo-utils";
import { it } from "@beep/test-runner";
import { assert, expect } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";
import * as FileSystem from "effect/FileSystem";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientError from "effect/http/HttpClientError";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { Header } from "tar";
import { NodeTestLayer } from "./support/CommandTest.ts";
import { provideSpawner } from "./support/ScriptedProcess.ts";

// The cache-pilot commands in process: the platform is real over scoped temp
// directories, every child process is scripted, and the step environment comes
// from a ConfigProvider. The golden byte parity against the retired shell
// adapters stays in ci-cache-pilot.test.ts and cache-local-summary.test.ts.

const runCi = Command.runWith(ciCommand, { version: "0.0.0" });
const runBootstrap = Command.runWith(Command.make("ci").pipe(Command.withSubcommands(ciBootstrapCommands)), {
  version: "0.0.0",
});

const lines = (logged: ReadonlyArray<unknown>) => A.map(logged, (line) => `${line}`);
const loggedLines = Effect.map(TestConsole.logLines, lines);
const errorLines = Effect.map(TestConsole.errorLines, lines);
// Each test reads its own console: the suite layer's is shared across tests.
const freshConsole = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.provideServiceEffect(effect, Console.Console, TestConsole.make);
const spawnLines = (spawner: ScriptedSpawner) =>
  A.map(spawner.spawns, ({ command, args }) => A.join([command, ...args], " "));

const withPath = (PATH: string) =>
  Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ PATH }));
const withStep = (environment: Readonly<Record<string, string>>) =>
  Effect.provideService(CiStepEnvironment, ConfigProvider.fromUnknown(environment, { preserveEmptyStrings: true }));

// The scripted spawner, with `before` run for each spawn ahead of its scripted
// answer: the files a real child would have written.
const provideSpawnerWith =
  (spawner: ScriptedSpawner, before: (command: string, args: ReadonlyArray<string>) => Effect.Effect<void>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    Effect.flatMap(Effect.service(ChildProcessSpawner.ChildProcessSpawner), (inner) =>
      Effect.provideService(
        effect,
        ChildProcessSpawner.ChildProcessSpawner,
        ChildProcessSpawner.make((command) =>
          (ChildProcess.isStandardCommand(command)
            ? before(command.command, A.map(command.args, String))
            : Effect.void
          ).pipe(Effect.andThen(inner.spawn(command)))
        )
      )
    ).pipe(provideSpawner(spawner));

// `process.geteuid` replaced for one effect, restored afterwards.
const withGeteuid = <A, E, R>(geteuid: (() => number) | undefined, effect: Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const previous = Object.getOwnPropertyDescriptor(process, "geteuid");
      Object.defineProperty(process, "geteuid", { value: geteuid, configurable: true, writable: true });
      return previous;
    }),
    () => effect,
    (previous) =>
      Effect.sync(() =>
        Object.defineProperty(process, "geteuid", previous ?? { value: undefined, configurable: true, writable: true })
      )
  );

const reportedExit = (failure: unknown) =>
  P.hasProperty(failure, "exitCode") && P.hasProperty(failure, "message")
    ? { exitCode: failure.exitCode, message: `${failure.message}` }
    : { exitCode: undefined, message: `${failure}` };

// The full `ci` group also needs the repository file utilities and git.
const platform = FsUtilsLive.pipe(Layer.provideMerge(NodeTestLayer));

// `ci cache-sandbox`, which builds the operational service over the scripted spawner.
const sandbox = (paths: { readonly bwrap: string; readonly aptSources: string }) =>
  runBootstrap(["cache-sandbox", "--bwrap", paths.bwrap, "--apt-sources", paths.aptSources]);

it.layer(platform, { timeout: "60 seconds" })("cache pilot host commands in process", (it) => {
  const makeTools = Effect.fnUntraced(function* (tools: ReadonlyArray<string>) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const root = yield* fs.makeTempDirectoryScoped({ prefix: "ci-cache-sandbox-in-process-" });
    const bin = path.join(root, "bin");
    const apt = path.join(root, "apt");
    yield* fs.makeDirectory(bin);
    yield* fs.makeDirectory(apt);
    yield* fs.writeFileString(path.join(apt, "third-party.list"), "deb https://example.test stable main\n");
    yield* fs.writeFileString(path.join(apt, "ubuntu.sources"), "Types: deb\n");
    // A directory and a non-executable file named like a manager are skipped on PATH.
    yield* fs.makeDirectory(path.join(bin, "yum"));
    yield* Effect.forEach(
      tools,
      Effect.fnUntraced(function* (name) {
        yield* fs.writeFileString(path.join(bin, name), "#!/bin/sh\n");
        yield* fs.chmod(path.join(bin, name), 0o755);
      }),
      { discard: true }
    );
    return { root, bin, apt, bwrap: path.join(root, "bwrap") };
  });
  const installBwrap = (fs: FileSystem.FileSystem, bwrap: string) =>
    Effect.fnUntraced(function* (command: string, args: ReadonlyArray<string>) {
      if (A.contains([command, ...args], "install")) {
        yield* fs.writeFileString(bwrap, "#!/bin/sh\n");
        yield* fs.chmod(bwrap, 0o755);
      }
    }, Effect.orDie);

  it.effect(
    "runs only the version probe when the sandbox executable is present",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const { bin, apt, bwrap } = yield* makeTools([]);
      yield* fs.writeFileString(bwrap, "#!/bin/sh\n");
      yield* fs.chmod(bwrap, 0o755);
      const spawner = ScriptedSpawner.make(() => ({ stdout: "bubblewrap 0.11.0\n" }));
      yield* runBootstrap(["cache-sandbox", "--bwrap", bwrap, "--apt-sources", apt]).pipe(
        withPath(bin),
        provideSpawner(spawner)
      );
      expect(spawnLines(spawner)).toEqual([`${bwrap} --version`]);
    }, freshConsole)
  );

  it.effect(
    "installs through dnf before apt-get and fails on a failed install or a still-missing sandbox",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const { bin, apt, bwrap } = yield* makeTools(["dnf", "apt-get"]);
      const paths = { bwrap, aptSources: apt };
      const missing = ScriptedSpawner.make(() => ({}));
      const notExecutable = yield* sandbox(paths).pipe(
        withPath(`/nonexistent:${bin}`),
        provideSpawner(missing),
        Effect.flip
      );
      expect(reportedExit(notExecutable)).toEqual({ exitCode: 1, message: `${bwrap} is not executable` });
      expect(A.map(missing.spawns, ({ args }) => A.contains(args, "dnf") || A.contains(args, "install"))).toEqual([
        true,
      ]);

      const refused = ScriptedSpawner.make(() => ({ exit: 2 }));
      const failed = yield* sandbox(paths).pipe(withPath(bin), provideSpawner(refused), Effect.flip);
      expect(reportedExit(failed).exitCode).toBe(2);
      expect(reportedExit(failed).message).toMatch(/^(dnf|sudo) exited 2$/u);

      const installing = ScriptedSpawner.make(() => ({}));
      yield* sandbox(paths).pipe(withPath(bin), provideSpawnerWith(installing, installBwrap(fs, bwrap)));
      assertSome(A.last(spawnLines(installing)), `${bwrap} --version`);
    }, freshConsole)
  );

  it.effect(
    "runs the install directly as root or without geteuid and through sudo -n otherwise",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const { bin, apt, bwrap } = yield* makeTools(["dnf"]);
      const firstSpawn = Effect.fnUntraced(function* (geteuid: (() => number) | undefined) {
        const installing = ScriptedSpawner.make(() => ({}));
        yield* fs.remove(bwrap, { force: true });
        yield* withGeteuid(
          geteuid,
          sandbox({ bwrap, aptSources: apt }).pipe(
            withPath(bin),
            provideSpawnerWith(installing, installBwrap(fs, bwrap))
          )
        );
        return A.head(spawnLines(installing));
      });
      const root = yield* firstSpawn(() => 0);
      const noGeteuid = yield* firstSpawn(undefined);
      const user = yield* firstSpawn(() => 1000);
      assertSome(root, "dnf install -y bubblewrap");
      assertSome(noGeteuid, "dnf install -y bubblewrap");
      assertSome(user, "sudo -n dnf install -y bubblewrap");
    }, freshConsole)
  );

  it.effect(
    "prunes the apt sources before an apt-get install and reports a failed prune",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const { bin, apt, bwrap } = yield* makeTools(["apt-get"]);
      const paths = { bwrap, aptSources: apt };
      const listingFails = ScriptedSpawner.make((command) => ({ exit: command === "ls" ? 2 : 0 }));
      const pruneFailure = yield* sandbox(paths).pipe(withPath(bin), provideSpawner(listingFails), Effect.flip);
      expect(reportedExit(pruneFailure)).toEqual({ exitCode: 1, message: `ci prune-apt: ls -l ${apt} exited 2` });
      const pruneErrors = yield* errorLines;
      expect(pruneErrors).toContain(`ci prune-apt: ls -l ${apt} exited 2`);

      const installing = ScriptedSpawner.make(() => ({}));
      yield* sandbox(paths).pipe(withPath(bin), provideSpawnerWith(installing, installBwrap(fs, bwrap)));
      const commands = A.filter(spawnLines(installing), (line) => !Str.startsWith("ls ")(line));
      expect(A.map(commands, (line) => Str.replace(/^sudo -n /u, "")(line))).toEqual([
        "apt-get update",
        "apt-get install -y --no-install-recommends bubblewrap",
        `${bwrap} --version`,
      ]);
      const kept = yield* Effect.forEach(["third-party.list", "ubuntu.sources"], (name) =>
        fs.exists(path.join(apt, name))
      );
      expect(kept).toEqual([false, true]);
    }, freshConsole)
  );

  it.effect(
    "fails with a workflow error when the runner has no supported package manager",
    Effect.fnUntraced(function* () {
      const { root, apt, bwrap } = yield* makeTools([]);
      const spawner = ScriptedSpawner.make(() => ({}));
      const message = `::error::Producer inspection requires ${bwrap}; no supported package manager.`;
      // An empty PATH entry is the working directory, as `command -v` reads it.
      const failure = yield* sandbox({ bwrap, aptSources: apt }).pipe(
        withPath(`:${root}/bin`),
        provideSpawner(spawner),
        Effect.flip
      );
      expect(reportedExit(failure)).toEqual({ exitCode: 1, message });
      const logged = yield* loggedLines;
      expect(logged).toContain(message);
      const unset = yield* sandbox({ bwrap, aptSources: apt }).pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({})),
        provideSpawner(spawner),
        Effect.flip
      );
      expect(reportedExit(unset).message).toBe(message);
      expect(spawner.spawns).toEqual([]);
    }, freshConsole)
  );

  const makeLayout = Effect.fnUntraced(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const base = yield* fs.makeTempDirectoryScoped({ prefix: "ci-cache-cleanup-in-process-" });
    const workspace = path.join(base, "ws");
    const trees = A.map(["a", "b"], (suffix) => `${workspace}-worktrees/cache-producer-11-1-${suffix}`);
    yield* Effect.forEach([workspace, ...trees], (directory) => fs.makeDirectory(directory, { recursive: true }), {
      discard: true,
    });
    return { base, workspace, trees };
  });

  it.effect(
    "removes the signed trial's owned worktrees, inputs and private directory",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const { base, workspace, trees } = yield* makeLayout();
      const inputs = `${workspace}/.beep/cache/protected-producer-trial`;
      const trialRoot = `${base}/home/.cache/beep/cache-producer-trial-v1`;
      yield* fs.makeDirectory(inputs, { recursive: true });
      yield* fs.makeDirectory(trialRoot, { recursive: true });
      const spawner = ScriptedSpawner.make(() => ({}));
      yield* runBootstrap(["cache-pilot-cleanup", ""]).pipe(
        withStep({
          GITHUB_WORKSPACE: workspace,
          GITHUB_RUN_ID: "11",
          GITHUB_RUN_ATTEMPT: "1",
          TRIAL_WORKTREE_A: trees[0] ?? "",
          TRIAL_WORKTREE_B: trees[1] ?? "",
          TRIAL_INPUTS: inputs,
          TRIAL_ROOT: trialRoot,
          HOME: `${base}/home`,
        }),
        provideSpawner(spawner)
      );
      expect(spawnLines(spawner)).toEqual(A.map(trees, (tree) => `git worktree remove -- ${tree}`));
      const remaining = yield* Effect.forEach([inputs, trialRoot], (target) => fs.exists(target));
      expect(remaining).toEqual([false, false]);
    }, freshConsole)
  );

  it.effect(
    "refuses foreign paths, keeps cleaning the owned ones and exits 1",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const { base, workspace, trees } = yield* makeLayout();
      const foreignTree = `${base}/elsewhere`;
      const trialRoot = `${base}/runner/beep-cache-local-observation.Ab12Cd`;
      yield* fs.makeDirectory(foreignTree);
      yield* fs.makeDirectory(trialRoot, { recursive: true });
      const spawner = ScriptedSpawner.make(() => ({ exit: 1 }));
      const step = {
        GITHUB_WORKSPACE: workspace,
        GITHUB_RUN_ID: "11",
        GITHUB_RUN_ATTEMPT: "1",
        TRIAL_WORKTREE_A: trees[0] ?? "",
        TRIAL_WORKTREE_B: foreignTree,
        TRIAL_INPUTS: `${workspace}/.beep/cache/protected-producer-trial`,
        TRIAL_ROOT: trialRoot,
        RUNNER_TEMP: `${base}/runner`,
      };
      const failure = yield* runBootstrap(["cache-pilot-cleanup", "local"]).pipe(
        withStep(step),
        provideSpawner(spawner),
        Effect.flip
      );
      expect(reportedExit(failure)).toEqual({ exitCode: 1, message: "Cache pilot cleanup refused or failed a path." });
      const refusals = yield* loggedLines;
      expect(refusals).toEqual([
        "::error::Refusing unexpected producer worktree.",
        "::error::Refusing unexpected producer input directory.",
      ]);
      const cleaned = yield* Effect.forEach([trialRoot, foreignTree], (target) => fs.exists(target));
      expect(cleaned).toEqual([false, true]);

      // Empty worktree and input variables are skipped; an unmarked private root is refused.
      const unmarked = yield* runBootstrap(["cache-pilot-cleanup", "local"]).pipe(
        withStep({ ...step, TRIAL_WORKTREE_A: "", TRIAL_WORKTREE_B: "", TRIAL_INPUTS: "", TRIAL_ROOT: foreignTree }),
        provideSpawner(spawner),
        Effect.flip
      );
      expect(reportedExit(unmarked).exitCode).toBe(1);
      const unmarkedLogged = yield* loggedLines;
      assertSome(A.last(unmarkedLogged), "::error::Refusing unexpected private pilot directory.");
      const kept = yield* fs.exists(foreignTree);
      expect(kept).toBe(true);
    }, freshConsole)
  );

  it.effect(
    "reports an unremovable path, an unbound variable and an unsupported mode",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const { workspace } = yield* makeLayout();
      const inputs = `${workspace}/.beep/cache/local-pilot-observation`;
      yield* fs.makeDirectory(inputs, { recursive: true });
      // A remove that fails: the platform's own, without `force`, over a missing path.
      const unforced = Effect.provideService(FileSystem.FileSystem, {
        ...fs,
        remove: (target: string) => fs.remove(Str.concat("-missing")(target)),
      });
      const spawner = ScriptedSpawner.make(() => ({}));
      const failure = yield* runBootstrap(["cache-pilot-cleanup", "local"]).pipe(
        withStep({ GITHUB_WORKSPACE: workspace, TRIAL_WORKTREE_A: "", TRIAL_WORKTREE_B: "", TRIAL_INPUTS: inputs }),
        unforced,
        provideSpawner(spawner),
        Effect.flip
      );
      expect(reportedExit(failure)).toEqual({ exitCode: 1, message: `cannot remove ${inputs}` });
      const errors = yield* errorLines;
      expect(errors).toContain(`ci cache-pilot-cleanup: cannot remove ${inputs}`);

      // A worktree whose existence cannot be read counts as absent.
      const unreadableTree = yield* runBootstrap(["cache-pilot-cleanup", "local"]).pipe(
        withStep({
          GITHUB_WORKSPACE: workspace,
          TRIAL_WORKTREE_A: `${workspace}/missing`,
          TRIAL_WORKTREE_B: "",
          TRIAL_INPUTS: "",
          TRIAL_ROOT: "",
        }),
        Effect.provideService(FileSystem.FileSystem, {
          ...fs,
          exists: (target: string) => Effect.as(fs.stat(target), true),
        }),
        provideSpawner(spawner),
        Effect.flip
      );
      expect(reportedExit(unreadableTree).exitCode).toBe(1);
      const unreadableLogged = yield* loggedLines;
      assertSome(A.last(unreadableLogged), "::error::Refusing unexpected private pilot directory.");

      const unbound = yield* runBootstrap(["cache-pilot-cleanup"]).pipe(withStep({}), Effect.flip);
      expect(reportedExit(unbound)).toEqual({
        exitCode: 1,
        message: "ci cache-pilot-cleanup: GITHUB_WORKSPACE: unbound variable",
      });
      const unsupported = yield* runBootstrap(["cache-pilot-cleanup", "nightly"]).pipe(Effect.flip);
      expect(reportedExit(unsupported)).toEqual({ exitCode: 64, message: "Unsupported cleanup mode." });
      const reported = yield* errorLines;
      expect(A.takeRight(reported, 2)).toEqual([
        "ci cache-pilot-cleanup: GITHUB_WORKSPACE: unbound variable",
        "Unsupported cleanup mode.",
      ]);
      expect(spawner.spawns).toEqual([]);
    }, freshConsole)
  );

  it.effect(
    "reads the process environment when no step environment is supplied",
    Effect.fnUntraced(function* () {
      const name = "BEEP_CI_CACHE_PILOT_IN_PROCESS_NEVER_SET";
      const unbound = yield* readStepVariable("ci cache-pilot-cleanup", name).pipe(Effect.flip);
      expect(reportedExit(unbound)).toEqual({
        exitCode: 1,
        message: `ci cache-pilot-cleanup: ${name}: unbound variable`,
      });
    }, freshConsole)
  );
});

// The input preparation over a synthetic checkout: no git repository, no
// worktree and no build ever runs, every child process is scripted.
const SIMPLE_PROFILE =
  '{"$schema": "x", "tasks": {"lint": {"cache": false, "outputs": []}, "build": {"dependsOn": ["^build"]}}, "extends": ["//"]}';
const PROFILE_PATH = "packages/foundation/primitive/types/turbo.json";
const NATIVE = "fixture-native-never-executed";
const NATIVE_SHA256 = "1eef7aff593cc8a24fdb48945e027520bc48c59f1ef20f9fb2099d230cd4dc11";
const REVISION = Str.repeat(40)("c");
const INPUTS = ".beep/cache/local-pilot-observation";
const encodeJson = S.encodeEffect(S.fromJsonString(S.Unknown));
const stablePins = {
  stable: { reportedVersion: "2.11.10", sha256: NATIVE_SHA256 },
  canary: { reportedVersion: "x", sha256: "x" },
};

// The registry answers every request with `archive`; `offline` fails every request.
const registryClient = (archive: Uint8Array) =>
  HttpClient.make((request) =>
    Effect.succeed(HttpClientResponse.fromWeb(request, new Response(NodeBuffer.Buffer.from(archive))))
  );
const offline = HttpClient.make((request) =>
  Effect.fail(
    new HttpClientError.HttpClientError({
      reason: new HttpClientError.TransportError({ request, description: "offline" }),
    })
  )
);
const registry = (archive: Uint8Array) => Effect.provideService(HttpClient.HttpClient, registryClient(archive));

it.layer(platform, { timeout: "60 seconds" })("cache pilot inputs in process", (it) => {
  const makeRoot = Effect.fnUntraced(function* (profile: string, pins: unknown) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const base = yield* fs
      .makeTempDirectoryScoped({ prefix: "ci-cache-inputs-in-process-" })
      .pipe(Effect.flatMap(fs.realPath));
    const root = path.join(base, "root");
    const write = Effect.fnUntraced(function* (relative: string, body: string) {
      yield* fs.makeDirectory(path.dirname(path.join(root, relative)), { recursive: true });
      yield* fs.writeFileString(path.join(root, relative), body);
    });
    yield* write("node_modules/@turbo/linux-64/bin/turbo", NATIVE);
    yield* write("node_modules/@biomejs/cli-linux-x64/biome", "fixture-biome-never-executed");
    yield* write("fixture-bin/node", "fixture-node-never-executed");
    yield* fs.chmod(path.join(root, "fixture-bin/node"), 0o500);
    const pinsJson = yield* encodeJson(pins);
    yield* write("goals/turborepo-quality-cache-adoption/research/errors-only-client-pins.json", pinsJson);
    yield* write(PROFILE_PATH, profile);
    yield* fs.makeDirectory(path.join(base, "private"));
    const step = {
      BEEP_CACHE_PRODUCER_PRIVATE_ROOT: `${base}/private`,
      BEEP_CACHE_PRODUCER_CHANNEL: "stable",
      GITHUB_RUN_ID: "11",
      GITHUB_RUN_ATTEMPT: "1",
      GITHUB_SHA: REVISION,
      GITHUB_OUTPUT: `${base}/outputs`,
      PATH: `${root}/fixture-bin`,
    };
    return { base, root, step };
  });
  // `path.resolve(".")` is the checkout the job runs in: the fixture root here.
  const inCheckout = (root: string) =>
    Effect.provideServiceEffect(
      Path.Path,
      Effect.map(Effect.service(Path.Path), (path) => ({
        ...path,
        resolve: (...segments: ReadonlyArray<string>) =>
          A.match(segments, {
            onEmpty: () => path.resolve(),
            onNonEmpty: (all) => (all.length === 1 && all[0] === "." ? root : path.resolve(...all)),
          }),
      }))
    );
  // `beep cache dependencies|activation --output <file>` writes its receipt.
  const writeOutputs = (fs: FileSystem.FileSystem, root: string) =>
    Effect.fnUntraced(function* (command: string, args: ReadonlyArray<string>) {
      const output = O.flatMap(
        A.findFirstIndex(args, (arg) => arg === "--output"),
        (index) => A.get(args, index + 1)
      );
      if (command === "bun" && O.isSome(output)) yield* fs.writeFileString(`${root}/${output.value}`, "{}\n");
    }, Effect.orDie);
  const gitScript = (head: string, diffExit = 0) =>
    ScriptedSpawner.make((command, args) =>
      command === "git" && args[0] === "rev-parse"
        ? { stdout: `${head}\n\n` }
        : { exit: command === "git" && args[0] === "diff" ? diffExit : 0 }
    );

  it.effect(
    "prepares the full local pilot request through the scripted job steps",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const { base, root, step } = yield* makeRoot(
        Str.replace('"outputs": []', '"outputs": [], "daemon": false')(SIMPLE_PROFILE),
        stablePins
      );
      const spawner = gitScript(REVISION);
      yield* runCachePilotInputs("local", "@beep/types#lint").pipe(
        withStep(step),
        inCheckout(root),
        registry(new Uint8Array()),
        provideSpawnerWith(spawner, writeOutputs(fs, root))
      );
      const trees = A.map(["a", "b"], (suffix) => `${base}/root-worktrees/cache-producer-11-1-${suffix}`);
      expect(spawnLines(spawner)).toEqual([
        "git rev-parse HEAD",
        "git diff --quiet HEAD",
        `bun --no-env-file run beep cache dependencies --output ${INPUTS}/dependencies.json`,
        `bun --no-env-file run beep cache activation --request ${INPUTS}/activation-request.json --output ${INPUTS}/activation.json`,
        `git worktree add --detach ${trees[0]} ${REVISION}`,
        `git worktree add --detach ${trees[1]} ${REVISION}`,
        "git diff --quiet HEAD",
      ]);
      expect(spawner.spawns[0]?.env).toEqual({
        BEEP_CACHE_PILOT_MODE: "local",
        BEEP_CACHE_PILOT_COMPUTATION: "@beep/types#lint",
        BEEP_CACHE_PILOT_INPUTS: INPUTS,
      });
      const request = yield* fs.readFileString(`${root}/${INPUTS}/request.json`);
      expect(request).toContain(`"nodeExecutable": "${root}/fixture-bin/node"`);
      expect(request).toContain(`"selection": "full"`);
      const after = yield* fs.readFileString(`${root}/${INPUTS}/after.json`);
      expect(after).toContain('"cache": true,\n      "outputs": [],\n      "daemon": false');
    }, freshConsole)
  );

  it.effect(
    "stops at a moved checkout, a dirty tree and a platform failure",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const { root, step } = yield* makeRoot(SIMPLE_PROFILE, stablePins);
      const attempt = (spawner: ScriptedSpawner, checkout = root) =>
        runCachePilotInputs("local", "@beep/types#lint").pipe(
          withStep(step),
          inCheckout(checkout),
          registry(new Uint8Array()),
          provideSpawnerWith(spawner, writeOutputs(fs, root)),
          Effect.flip,
          Effect.map(reportedExit)
        );
      const moved = yield* attempt(gitScript(Str.repeat(40)("d")));
      expect(moved).toEqual({ exitCode: 1, message: "Checkout is not at GITHUB_SHA." });
      const dirty = yield* attempt(gitScript(REVISION, 1));
      expect(dirty).toEqual({ exitCode: 1, message: "git exited 1" });
      // A checkout without the reviewed pins: the platform failure exits 1 with its message.
      const unreadable = yield* attempt(gitScript(REVISION), `${root}-missing`);
      expect(unreadable.exitCode).toBe(1);
      expect(Str.startsWith("ci cache-pilot-inputs: ")(unreadable.message)).toBe(true);
      const reported = yield* errorLines;
      assertSome(A.last(reported), unreadable.message);
    }, freshConsole)
  );

  it.effect(
    "refuses unsupported modes and computations through the ci command, defaulting empty positionals",
    Effect.fnUntraced(function* () {
      const spawner = ScriptedSpawner.make(() => ({}));
      const refusals = yield* Effect.forEach(
        [
          ["cache-pilot-inputs", "unknown"],
          ["cache-pilot-inputs", "local", "@beep/unknown#lint"],
          ["cache-pilot-inputs", "", "@beep/types#lint"],
        ],
        (argv) =>
          runCi(argv).pipe(registry(new Uint8Array()), provideSpawner(spawner), Effect.flip, Effect.map(reportedExit))
      );
      expect(refusals).toEqual([
        { exitCode: 64, message: "Unsupported pilot input mode." },
        { exitCode: 64, message: "Unsupported pilot computation." },
        { exitCode: 64, message: "Signed execution remains restricted to identity lint." },
      ]);
      // Both positionals default: the signed identity lint pilot, stopped by its missing step variable.
      const defaulted = yield* runCi(["cache-pilot-inputs"]).pipe(
        withStep({}),
        registry(new Uint8Array()),
        provideSpawner(ScriptedSpawner.make(() => ({ stdout: `${REVISION}\n` }))),
        Effect.flip,
        Effect.map(reportedExit)
      );
      expect(defaulted).toEqual({ exitCode: 1, message: "ci cache-pilot-inputs: GITHUB_SHA: unbound variable" });
      expect(spawner.spawns).toEqual([]);
    }, freshConsole)
  );

  it.effect(
    "refuses a failed worktree, a missing node and a profile without a lint task",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const { root, step } = yield* makeRoot(SIMPLE_PROFILE, stablePins);
      yield* prepareCachePilotSources(root, "local", "@beep/types#lint").pipe(
        withStep(step),
        registry(new Uint8Array())
      );
      yield* Effect.forEach(
        ["dependencies.json", "activation.json"],
        (name) => fs.writeFileString(`${root}/${INPUTS}/${name}`, "{}\n"),
        { discard: true }
      );
      const worktree = yield* prepareCachePilotRequest(root, "local").pipe(
        withStep(step),
        provideSpawner(ScriptedSpawner.make(() => ({ exit: 128 }))),
        Effect.flip,
        Effect.map(reportedExit)
      );
      expect(worktree).toEqual({ exitCode: 1, message: "ci cache-pilot-inputs: git worktree add exited 128" });
      const noNode = yield* prepareCachePilotRequest(root, "local").pipe(
        withStep({ ...step, PATH: `:${root}/missing` }),
        provideSpawner(ScriptedSpawner.make(() => ({}))),
        Effect.flip,
        Effect.map(reportedExit)
      );
      expect(noNode).toEqual({ exitCode: 1, message: "ci cache-pilot-inputs: node is not on PATH" });

      const noLint = yield* Effect.forEach(['{"tasks": {"build": {}}}', '{"tasks": []}', "[]"], (profile) =>
        Effect.gen(function* () {
          const untasked = yield* makeRoot(profile, stablePins);
          return yield* prepareCachePilotSources(untasked.root, "local", "@beep/types#lint").pipe(
            withStep(untasked.step),
            registry(new Uint8Array()),
            Effect.flip,
            Effect.map(reportedExit)
          );
        })
      );
      expect(noLint).toEqual(
        A.replicate({ exitCode: 1, message: `ci cache-pilot-inputs: ${PROFILE_PATH} has no tasks.lint object` }, 3)
      );
    }, freshConsole)
  );

  it.effect(
    "refuses an unsourced, undownloadable, non-gzip, non-tar or oversized canary archive",
    Effect.fnUntraced(function* () {
      const digest = yield* Digest.Digest;
      const integrityOf = Effect.fnUntraced(function* (archive: Uint8Array) {
        const hash = yield* digest.digest(Digest.sha512, archive);
        return `sha512-${Base64.encode(hash)}`;
      });
      const canary = (overrides: Readonly<Record<string, string | undefined>>) => ({
        stable: stablePins.stable,
        canary: {
          reportedVersion: "2.11.11-canary.1",
          sha256: "",
          tarball: "https://registry.npmjs.org/@turbo/linux-64/-/linux-64-2.11.11-canary.1.tgz",
          archiveMember: "turbo-linux-x64/bin/turbo",
          ...overrides,
        },
      });
      const prepare = Effect.fnUntraced(function* (pins: unknown, client: HttpClient.HttpClient) {
        const { root, step } = yield* makeRoot(SIMPLE_PROFILE, pins);
        const failure = yield* prepareCachePilotSources(root, "local", "@beep/types#lint").pipe(
          withStep({ ...step, BEEP_CACHE_PRODUCER_CHANNEL: "canary" }),
          Effect.provideService(HttpClient.HttpClient, client),
          Effect.flip
        );
        return reportedExit(failure).message;
      });
      const plain = new TextEncoder().encode("not a gzip stream");
      const notTar = NodeZlib.gzipSync(NodeBuffer.Buffer.from(Str.repeat(600)("x")));
      const header = (name: string) => {
        const block = NodeBuffer.Buffer.alloc(512);
        const mtime = DateTime.toDateUtc(DateTime.makeUnsafe(0));
        new Header({ path: name, size: 0, type: "File", mode: 0o644, mtime }).encode(block);
        return block;
      };
      const crowded = NodeZlib.gzipSync(
        NodeBuffer.Buffer.concat([...A.makeBy(33, (n) => header(`file-${n}`)), NodeBuffer.Buffer.alloc(1024)])
      );
      const cases: ReadonlyArray<readonly [Readonly<Record<string, string | undefined>>, Uint8Array, boolean]> = [
        // [pin overrides, served archive, offline]
        [{ tarball: undefined }, plain, false],
        [{}, plain, true],
        [{}, plain, false],
        [{}, notTar, false],
        [{}, crowded, false],
      ];
      const refusals = yield* Effect.forEach(
        cases,
        Effect.fnUntraced(function* ([overrides, archive, unreachable]) {
          const integrity = yield* integrityOf(archive);
          return yield* prepare(canary({ integrity, ...overrides }), unreachable ? offline : registryClient(archive));
        })
      );
      expect(refusals).toEqual([
        "Native canary must use its reviewed public registry source.",
        "Native canary archive could not be downloaded.",
        "Native canary archive exceeds its reviewed extraction bounds.",
        "Native canary archive is not a readable gzip tar archive.",
        "Native canary archive exceeds its reviewed extraction bounds.",
      ]);
    }, freshConsole)
  );
});

// The local observation summary, through the ci command group in process.
const CLIENT = { version: "2.11.10", sha256: Str.repeat(64)("b"), namespace: "team_beep_local_observation_v1" };
const SUMMARY_REVISION = Str.repeat(40)("a");
const localFixture = () => ({
  request: { channel: "stable", client: CLIENT, selection: "full" },
  report: {
    schemaVersion: "cache-pilot-local/v5",
    authority: "local-observation-only",
    sourceRevision: SUMMARY_REVISION,
    channel: "stable",
    client: CLIENT,
    key: { computation: "@beep/types#lint" },
    selection: "full",
    checks: [{ name: "bounded-control", passed: true }],
    runs: [{}],
    mutations: [{}],
    nonExecutions: [{}],
  },
});

it.layer(platform, { timeout: "60 seconds" })("cache local summary in process", (it) => {
  it.effect(
    "publishes the summary once and refuses an existing output without printing private values",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const directory = yield* fs.makeTempDirectoryScoped({ prefix: "cache-local-summary-in-process-" });
      const { report, request } = localFixture();
      const reportFile = path.join(directory, "report.json");
      const requestFile = path.join(directory, "request.json");
      const output = path.join(directory, "public.json");
      const reportJson = yield* encodeJson(report);
      const requestJson = yield* encodeJson(request);
      yield* fs.writeFileString(reportFile, reportJson);
      yield* fs.writeFileString(requestFile, requestJson);
      const argv = [
        "cache-local-summary",
        "--report",
        reportFile,
        "--request",
        requestFile,
        "--output",
        output,
        "--revision",
        SUMMARY_REVISION,
        "--channel",
        "stable",
        "--computation",
        "@beep/types#lint",
      ];
      yield* runCi(argv).pipe(registry(new Uint8Array()));
      const published = yield* fs.readFileString(output);
      expect(published).toContain('"allChecksPassed":true');
      const info = yield* fs.stat(output);
      expect(info.mode & 0o777).toBe(0o600);
      const refused = yield* runCi(argv).pipe(registry(new Uint8Array()), Effect.flip, Effect.map(reportedExit));
      expect(refused).toEqual({ exitCode: 1, message: CACHE_LOCAL_SUMMARY_REFUSAL });
      const reported = yield* errorLines;
      expect(reported).toEqual([CACHE_LOCAL_SUMMARY_REFUSAL]);
      const unchanged = yield* fs.readFileString(output);
      expect(unchanged).toBe(published);
    }, freshConsole)
  );

  it.effect(
    "refuses an invalid revision, non-UTF-8 bytes and a summary over its byte bound",
    Effect.fnUntraced(function* () {
      const { report, request } = localFixture();
      const encoder = new TextEncoder();
      const requestJson = yield* encodeJson(request);
      const reportJson = yield* encodeJson(report);
      const requestBytes = encoder.encode(requestJson);
      const reportBytes = encoder.encode(reportJson);
      const summarize = (reportInput: Uint8Array, requestInput: Uint8Array, revision = SUMMARY_REVISION) =>
        summarizeCacheLocalObservation(reportInput, requestInput, revision, "stable", "@beep/types#lint");
      const badRevision = yield* summarize(reportBytes, requestBytes, "not-a-revision").pipe(Effect.flip);
      const notUtf8 = yield* summarize(new Uint8Array([0xff, 0xfe, 0x00]), requestBytes).pipe(Effect.flip);
      // The version pattern bounds its shape, not its length: a long one overflows the summary.
      const client = { ...CLIENT, version: `1.2.${Str.repeat(70_000)("3")}` };
      const longReport = yield* encodeJson({ ...report, client });
      const longRequest = yield* encodeJson({ ...request, client });
      const oversized = yield* summarize(encoder.encode(longReport), encoder.encode(longRequest)).pipe(Effect.flip);
      const accepted = yield* summarize(reportBytes, requestBytes).pipe(Effect.isSuccess);
      expect([badRevision, notUtf8, oversized]).toEqual(["refused", "refused", "refused"]);
      assert.isTrue(accepted);
    }, freshConsole)
  );
});
