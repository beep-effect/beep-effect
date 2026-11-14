/**
 * Operational CI profiles, trusted environment export and host resource sampling.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { ActionOutputs } from "@beep/github-actions/ActionOutputs";
import { WorkflowCommand } from "@beep/github-commands/WorkflowCommand";
import { GitHubMarkdown } from "@beep/github-reporting/GitHubMarkdown";
import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils/Root";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { CiCommandError } from "./Ci.errors.ts";
import {
  CI_RELEVANCE_LANE_VALUES,
  CiChangeProfile,
  CiEnvironmentSelection,
  CiLaneRelevance,
  CiOperationalPatterns,
  CiResourceSample,
  ciOperationalPatterns,
} from "./CiOperational.schemas.ts";
import { CiRunnerOutputsLive } from "./CiRunnerOutputs.ts";
import type * as Scope from "effect/Scope";

const $I = $RepoCliId.create("commands/Ci/CiOperational.service");
const text = (name: string) => Config.String(name).pipe(Config.withDefault(""));
const secret = (name: string) => Config.Redacted(`BEEP_CI_SECRET_${name}`).pipe(Config.withDefault(Redacted.make("")));
const appNames = [
  "DATABASE_URL",
  "DATABASE_URL_UNPOOLED",
  "EMAIL_RESEND_API_KEY",
  "AUTH_SECRET",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "SECURITY_TRUSTED_ORIGINS",
  "LIVEBLOCKS_SECRET_KEY",
];
const PATTERN_FILE = "packages/tooling/tool/cli/src/commands/Ci/CiOperational.patterns.json";
/** The hosted image's apt source directory; only it is pruned with `sudo`. */
const SYSTEM_APT_SOURCES = "/etc/apt/sources.list.d";
const environmentEntry = S.Tuple([S.String, S.Redacted(S.String)]);
const decodeNumber = S.decodeUnknownEffect(S.FiniteFromString);
const decodeSample = S.decodeUnknownEffect(CiResourceSample);
const encodePatterns = S.encodeEffect(S.fromJsonString(CiOperationalPatterns, { space: 2 }));
const isCiCommandError = S.is(CiCommandError);
const decodePatterns = S.decodeUnknownEffect(S.fromJsonString(CiOperationalPatterns));
const unavailable = Console.error(
  WorkflowCommand.warning("Runner resource measurement unavailable; lane exit status is preserved.")
);
const unavailableDirect = Console.error(
  WorkflowCommand.warning("Runner resource measurement unavailable; running lane directly.")
);
const diffUnavailable = Console.error(
  "ci-change-profile: pinned PR diff unavailable; keeping every verification profile active"
);
/** The profile of a run with no diff to scope: every verification stays active. */
const fullProfile = CiChangeProfile.make({
  goalsOnly: false,
  docsOnly: false,
  desktopRustRelevant: true,
  lanes: CiLaneRelevance.make({
    codegen: true,
    ecosystem: true,
    nix: true,
    desktop_ipc: true,
    sast: true,
    security: true,
  }),
});
const inherited = { stdin: "inherit", stdout: "inherit", stderr: "inherit" } as const;

// `grep -E` semantics: a pattern matches a path when it matches anywhere in it.
const searchFor = (pattern: string) => {
  const expression = new RegExp(pattern, "u");
  return (line: string): boolean => expression.test(line);
};

/**
 * Classify a pinned pull-request diff into the hosted change profile.
 *
 * **Details**
 *
 * A pattern matches a path when it matches anywhere in it (`grep -E` semantics), the same test
 * the check.yml path gates run with `grep -Eq` over the pattern data. An empty diff is neither
 * goals-only nor docs-only and makes no described lane relevant; a lane the pattern data does not
 * describe is always relevant.
 *
 * **Example** (A Semgrep rule change makes only SAST relevant)
 *
 * ```ts
 * import { classifyChangeProfile, ciOperationalPatterns } from "@beep/repo-cli/commands/Ci"
 *
 * const profile = classifyChangeProfile(ciOperationalPatterns, [".semgrep/first-party.yml"])
 * console.log(profile.lanes.sast, profile.lanes.security) // true false
 * ```
 *
 * @param patterns - The pattern data the checkout carries.
 * @param paths - Repo-relative changed paths, one per `git diff --name-only --no-renames` line.
 * @returns The goals-only, docs-only, Rust and per-lane profile.
 * @category utilities
 * @since 0.0.0
 */
export const classifyChangeProfile: {
  (paths: ReadonlyArray<string>): (patterns: CiOperationalPatterns) => CiChangeProfile;
  (patterns: CiOperationalPatterns, paths: ReadonlyArray<string>): CiChangeProfile;
} = dual(2, (patterns: CiOperationalPatterns, paths: ReadonlyArray<string>): CiChangeProfile => {
  const goals = searchFor(patterns.goals);
  const docs = searchFor(patterns.docs);
  const codeRoot = searchFor(patterns.codeRoots);
  const desktop = searchFor(patterns.desktop);
  const changed = A.isReadonlyArrayNonEmpty(paths);
  // A lane the pattern file does not describe stays relevant; a described lane runs when a
  // changed path matches its inputs.
  const relevant = (pattern: string | undefined): boolean =>
    O.match(O.fromUndefinedOr(pattern), { onNone: () => true, onSome: (row) => A.some(paths, searchFor(row)) });
  const lanes = patterns.lanes;
  return CiChangeProfile.make({
    goalsOnly: changed && A.every(paths, goals),
    docsOnly: changed && !A.some(paths, codeRoot) && A.every(paths, (line: string) => goals(line) || docs(line)),
    desktopRustRelevant: changed && A.some(paths, desktop),
    lanes: CiLaneRelevance.make({
      codegen: relevant(lanes?.codegen),
      ecosystem: relevant(lanes?.ecosystem),
      nix: relevant(lanes?.nix),
      desktop_ipc: relevant(lanes?.desktop_ipc),
      sast: relevant(lanes?.sast),
      security: relevant(lanes?.security),
    }),
  });
});

// The GitHub output and shell `eval` text: the three retired-adapter lines, then one
// `<lane>_relevant` line per relevance lane in declaration order.
const renderChangeProfile = (profile: CiChangeProfile): string =>
  A.join(
    [
      `goals_only=${profile.goalsOnly}`,
      `docs_only=${profile.docsOnly}`,
      `desktop_rust_relevant=${profile.desktopRustRelevant}`,
      ...A.map(CI_RELEVANCE_LANE_VALUES, (lane) => `${lane}_relevant=${profile.lanes[lane]}`),
      "",
    ],
    "\n"
  );

// `$(git diff ...)` drops the trailing newlines; each remaining line is one path.
const diffLines = (stdout: string): ReadonlyArray<string> =>
  A.filter(Str.split(Str.replace(/\n+$/u, "")(stdout), "\n"), Str.isNonEmpty);

/**
 * CI operational contract, with platform dependencies supplied by its live layer.
 *
 * **Example** (Reference the contract)
 *
 * ```ts
 * import { CiOperational } from "@beep/repo-cli/commands/Ci"
 * console.log(CiOperational.key)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class CiOperational extends Context.Service<
  CiOperational,
  {
    readonly patterns: (write: boolean) => Effect.Effect<void, CiCommandError>;
    readonly changeProfile: (base: O.Option<string>, head: O.Option<string>) => Effect.Effect<void, CiCommandError>;
    readonly jobEnvironment: Effect.Effect<void, CiCommandError>;
    readonly pruneAptSources: (directory: string) => Effect.Effect<void, CiCommandError>;
    readonly runnerResources: (
      lane: string,
      command: string,
      args: ReadonlyArray<string>
    ) => Effect.Effect<number, CiCommandError, Scope.Scope>;
  }
>()($I`CiOperational`) {}

/**
 * Live platform implementation; environment values are never rendered to logs.
 *
 * **Example** (Supply the operational service)
 *
 * ```ts
 * import { CiOperationalLive } from "@beep/repo-cli/commands/Ci"
 * console.log(CiOperationalLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const CiOperationalLive = Layer.effect(
  CiOperational,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const outputs = yield* ActionOutputs;
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const append = (target: string, body: string) => fs.writeFileString(target, body, { flag: "a" });
    const patterns = Effect.fn("Ci.patterns")(
      function* (write: boolean) {
        const root = yield* findRepoRoot().pipe(
          Effect.provideService(FileSystem.FileSystem, fs),
          Effect.provideService(Path.Path, path)
        );
        const target = path.join(root, PATTERN_FILE);
        const projection = `${yield* encodePatterns(ciOperationalPatterns)}\n`;
        if (write) yield* fs.writeFileString(target, projection);
        else if ((yield* fs.readFileString(target)) !== projection)
          return yield* CiCommandError.make({ message: "CI pattern projection is stale." });
        yield* Console.log(write ? "CI pattern projection written." : "CI pattern projection is in sync.");
      },
      Effect.mapError(CiCommandError.new("Failed to synchronize CI patterns. Run bun run beep ci patterns --write."))
    );
    // A spawned command's stdout and exit status; stderr stays on the job log.
    const capture = Effect.fn("Ci.capture")(function* (command: string, args: ReadonlyArray<string>) {
      const handle = yield* spawner.spawn(
        ChildProcess.make(command, args, { stdin: "ignore", stdout: "pipe", stderr: "inherit" })
      );
      const [stdout, status] = yield* Effect.all(
        [handle.stdout.pipe(Stream.decodeText, Stream.mkString), handle.exitCode],
        {
          concurrency: 2,
        }
      );
      return { stdout, status };
    }, Effect.scoped);
    // The checkout's own pattern file classifies its tree; a binary built from
    // main must not judge a pull request by main's compiled-in literals. A file
    // that is present but unreadable fails closed.
    const changeProfilePatterns = Effect.gen(function* () {
      const root = yield* findRepoRoot().pipe(
        Effect.provideService(FileSystem.FileSystem, fs),
        Effect.provideService(Path.Path, path),
        Effect.option
      );
      if (O.isNone(root)) return ciOperationalPatterns;
      const target = path.join(root.value, PATTERN_FILE);
      const read = fs
        .exists(target)
        .pipe(
          Effect.flatMap((present) =>
            present
              ? fs.readFileString(target).pipe(Effect.flatMap(decodePatterns), Effect.asSome)
              : Effect.succeed(O.none<CiOperationalPatterns>())
          )
        );
      const loaded = yield* read.pipe(
        CiCommandError.mapError(`ci-change-profile: could not read the CI patterns from ${target}`)
      );
      return O.getOrElse(loaded, () => ciOperationalPatterns);
    });
    const pinnedDiff = (base: string, head: string) =>
      // KEEP (D-22): the change profile reads git's C-quoted `--name-only` lines, so a path with a non-ASCII
      // or special byte never matches a docs pattern and keeps every profile active (pinned by the `quoted
      // path` golden in `ci-bootstrap-parity`); `Git.changedFiles`' `-z` paths are raw.
      // biome-ignore lint/plugin/no-hand-rolled-git-gh-spawn: KEEP (D-22), reason above
      capture("git", ["diff", "--name-only", "--no-renames", `${base}...${head}`]).pipe(
        Effect.map(({ stdout, status }) => (status === 0 ? O.some(diffLines(stdout)) : O.none())),
        Effect.orElseSucceed(O.none<ReadonlyArray<string>>)
      );
    const emitChangeProfile = Effect.fn("Ci.emitChangeProfile")(
      function* (patterns: CiOperationalPatterns, positionalBase: O.Option<string>, positionalHead: O.Option<string>) {
        const event = yield* Config.String("GITHUB_EVENT_NAME").pipe(Config.withDefault("local"));
        // Hosted callers pin the refs; explicit arguments are the local seam.
        const pinned = Effect.fn("Ci.pinnedRef")(function* (name: string, positional: O.Option<string>) {
          const value = yield* text(name);
          return Str.isNonEmpty(value) ? value : O.getOrElse(positional, () => "");
        });
        const base = yield* pinned("BEEP_CI_PR_BASE_SHA", positionalBase);
        const head = yield* pinned("BEEP_CI_PR_HEAD_SHA", positionalHead);
        const paths =
          event === "pull_request" && Str.isNonEmpty(base) && Str.isNonEmpty(head)
            ? yield* pinnedDiff(base, head)
            : O.none<ReadonlyArray<string>>();
        if (event === "pull_request" && O.isNone(paths)) yield* diffUnavailable;
        const profile = O.match(paths, {
          onNone: () => fullProfile,
          onSome: (changed) => classifyChangeProfile(patterns, changed),
        });
        const output = renderChangeProfile(profile);
        const target = yield* text("GITHUB_OUTPUT");
        if (Str.isNonEmpty(target)) yield* append(target, output);
        yield* Console.log(Str.trimEnd(output));
      },
      Effect.mapError(CiCommandError.new("Failed to determine the CI change profile."))
    );
    const changeProfile = (base: O.Option<string>, head: O.Option<string>) =>
      Effect.flatMap(changeProfilePatterns, (patterns) => emitChangeProfile(patterns, base, head)).pipe(
        Effect.withSpan("Ci.changeProfile")
      );

    const pruneAptSources = Effect.fn("Ci.pruneAptSources")(
      function* (directory: string) {
        // Echo a command's stdout like the shell did and fail on a non-zero exit.
        const echoed = Effect.fn("Ci.echoAptCommand")(function* (
          label: string,
          command: string,
          args: ReadonlyArray<string>
        ) {
          const { stdout, status } = yield* capture(command, args);
          if (Str.isNonEmpty(stdout)) yield* Console.log(Str.replace(/\n$/u, "")(stdout));
          if (status !== 0) return yield* CiCommandError.make({ message: `ci prune-apt: ${label} exited ${status}` });
        });
        const listing = (heading: string) =>
          Console.log(heading).pipe(Effect.andThen(echoed(`ls -l ${directory}`, "ls", ["-l", directory])));
        yield* listing("apt sources before pruning:");
        if (directory === SYSTEM_APT_SOURCES) {
          yield* echoed("sudo find", "sudo", [
            "find",
            directory,
            "-maxdepth",
            "1",
            "-type",
            "f",
            "(",
            "-name",
            "*.list",
            "-o",
            "-name",
            "*.sources",
            ")",
            "!",
            "-name",
            "ubuntu.sources",
            "-print",
            "-delete",
          ]);
        } else {
          // `find -maxdepth 1 -type f` without privilege: regular files only, symlinks excluded.
          const prefix = Str.endsWith("/")(directory) ? directory : `${directory}/`;
          // Sorted so the deletion log is stable; readDirectory order is filesystem-defined.
          const entries = yield* Effect.map(fs.readDirectory(directory), A.sort(Order.String));
          const pruned = A.filter(
            entries,
            (name) => (Str.endsWith(".list")(name) || Str.endsWith(".sources")(name)) && name !== "ubuntu.sources"
          );
          yield* Effect.forEach(
            pruned,
            Effect.fnUntraced(function* (name) {
              const target = `${prefix}${name}`;
              const symlink = yield* fs.readLink(target).pipe(Effect.isSuccess);
              const info = yield* fs.stat(target);
              if (symlink || info.type !== "File") return;
              yield* Console.log(target);
              yield* fs.remove(target);
            }),
            { concurrency: 1, discard: true }
          );
        }
        yield* listing("apt sources after pruning:");
      },
      Effect.mapError((error) =>
        isCiCommandError(error) ? error : CiCommandError.new(error, "Failed to prune the apt sources.")
      )
    );

    const entry = (name: string, value: string): typeof environmentEntry.Type => [name, Redacted.make(value)];
    const turboEnvironment = Effect.fn("Ci.selectTurboEnvironment")(function* (trusted: boolean, same: boolean) {
      if ((yield* text("BEEP_CI_TURBO_REMOTE_CACHE")) !== "true")
        return CiEnvironmentSelection.make({ mode: "not requested", entries: [] });
      const api = yield* text("BEEP_CI_TURBO_API");
      const team = yield* text("BEEP_CI_TURBO_TEAM");
      const token = yield* secret(trusted ? "TURBO_TOKEN" : "TURBO_READ_TOKEN");
      const permitted =
        (trusted || same) && Str.isNonEmpty(api) && Str.isNonEmpty(team) && token.pipe(Redacted.value, Str.isNonEmpty);
      const select = (
        mode: CiEnvironmentSelection["mode"],
        cache: string,
        selectedApi: string,
        selectedTeam: string,
        selectedToken: Redacted.Redacted<string>
      ) =>
        CiEnvironmentSelection.make({
          mode,
          entries: [
            entry("TURBO_API", selectedApi),
            ["TURBO_TOKEN", selectedToken],
            entry("TURBO_TEAM", selectedTeam),
            entry("TURBO_CACHE", cache),
            entry("TURBO_LOG_ORDER", "stream"),
            entry("BEEP_CI_TURBO_REMOTE_MODE", mode),
          ],
        });
      return Match.value({ permitted, trusted }).pipe(
        Match.when({ permitted: false }, () => select("local-only", "local:rw", "", "", Redacted.make(""))),
        Match.when({ trusted: true }, () =>
          select("read-write (trusted push)", "local:rw,remote:rw", api, team, token)
        ),
        Match.orElse(() => select("read-only (same-repository pull request)", "local:rw,remote:r", api, team, token))
      );
    });
    const applicationEnvironment = Effect.fn("Ci.selectApplicationEnvironment")(function* (trusted: boolean) {
      if ((yield* text("BEEP_CI_APP_SECRETS")) !== "true")
        return CiEnvironmentSelection.make({ mode: "not requested", entries: [] });
      const entries = yield* Effect.forEach(
        appNames,
        Effect.fn("Ci.selectApplicationSecret")(function* (name) {
          const value = trusted ? yield* secret(name) : Redacted.make("");
          return environmentEntry.make([name, value]);
        }),
        { concurrency: 1 }
      );
      return CiEnvironmentSelection.make({ mode: trusted ? "exported (trusted push)" : "blank", entries });
    });
    // `ActionOutputs` frames each entry as a `GITHUB_ENV` heredoc block whose
    // delimiter is derived from the value, so no value can close its block early.
    // Entries append one at a time, in order: a runner-file write failure fails
    // the step with the earlier entries written, and no later step reads them
    // (reuse-ledger #93).
    const exportEnvironmentEntry = ([name, value]: readonly [string, Redacted.Redacted<string>]) =>
      outputs.exportVariable(name, Redacted.value(value));
    const jobEnvironment = Effect.gen(function* () {
      const target = yield* text("GITHUB_ENV");
      if (Str.isEmpty(target)) return yield* CiCommandError.make({ message: "ci-job-env: GITHUB_ENV is not set" });
      const event = yield* text("GITHUB_EVENT_NAME");
      const repo = yield* text("GITHUB_REPOSITORY");
      const head = yield* text("BEEP_CI_HEAD_REPOSITORY");
      const trusted = event === "push";
      const same = event === "pull_request" && Str.isNonEmpty(repo) && repo === head;
      const turbo = yield* turboEnvironment(trusted, same);
      const app = yield* applicationEnvironment(trusted);
      yield* Effect.forEach(A.appendAll(turbo.entries, app.entries), exportEnvironmentEntry, {
        concurrency: 1,
        discard: true,
      });
      yield* Console.log(`ci-job-env: turbo remote cache ${turbo.mode}; application secrets ${app.mode}`);
    }).pipe(
      Effect.mapError(CiCommandError.new("Failed to export the CI job environment.")),
      Effect.withSpan("Ci.jobEnvironment")
    );

    // The lane without measurement: the shell adapter's `exec "$@"` fallback.
    const directRun = Effect.fn("Ci.runLaneDirectly")(function* (command: string, args: ReadonlyArray<string>) {
      yield* unavailableDirect;
      const child = yield* spawner.spawn(ChildProcess.make(command, args, inherited));
      return yield* child.exitCode;
    });
    const measuredRun = Effect.fn("Ci.measuredRun")(function* (
      lane: string,
      command: string,
      args: ReadonlyArray<string>,
      started: Ref.Ref<boolean>
    ) {
      const procRoot = yield* Config.String("BEEP_CI_PROC_ROOT").pipe(Config.withDefault("/proc"));
      const temp = yield* Config.String("RUNNER_TEMP").pipe(
        Config.orElse(() => Config.String("TMPDIR")),
        Config.withDefault("/tmp")
      );
      const dir = path.join(temp, "beep-runner-resources");
      const samplesPath = path.join(dir, `${lane}.tsv`);
      const summaryPath = path.join(dir, `${lane}.md`);
      const readSample = Effect.gen(function* () {
        const mem = yield* fs.readFileString(path.join(procRoot, "meminfo"));
        const stat = yield* fs.readFileString(path.join(procRoot, "stat"));
        const swap = yield* fs.readFileString(path.join(procRoot, "vmstat"));
        const readCounter = Effect.fn("Ci.readCounter")(function* (body: string, key: string) {
          const line = A.findFirst(Str.split(body, "\n"), Str.startsWith(key));
          return yield* decodeNumber(
            O.match(line, { onNone: () => "0", onSome: (value) => Str.split(Str.trim(value), /\s+/u)[1] ?? "0" })
          );
        });
        const cpuLine = O.getOrElse(A.findFirst(Str.split(stat, "\n"), Str.startsWith("cpu ")), () => "cpu");
        const cpu = yield* Effect.forEach(
          A.take(A.drop(Str.split(Str.trim(cpuLine), /\s+/u), 1), 8),
          (value) => decodeNumber(value),
          { concurrency: 1 }
        );
        const now1 = yield* DateTime.now;
        return yield* decodeSample({
          epoch: DateTime.toEpochMillis(now1) / 1000,
          total: yield* readCounter(mem, "MemTotal:"),
          available: yield* readCounter(mem, "MemAvailable:"),
          cpu: A.reduce(cpu, 0, (sum, value) => sum + value),
          idle: (cpu[3] ?? 0) + (cpu[4] ?? 0),
          swapIn: yield* readCounter(swap, "pswpin "),
          swapOut: yield* readCounter(swap, "pswpout "),
        });
      });
      const measurementFailed = yield* Ref.make(false);
      const samples: Array<CiResourceSample> = [];
      const sample = Effect.gen(function* () {
        const value = yield* readSample;
        yield* append(
          samplesPath,
          `${value.epoch}\t${value.total}\t${value.available}\t${value.total - value.available}\n`
        );
        samples.push(value);
        return value;
      });
      const initial = yield* Effect.gen(function* () {
        yield* fs.makeDirectory(dir, { recursive: true });
        yield* fs.writeFileString(samplesPath, "epoch\ttotal_kib\tavailable_kib\tused_kib\n");
        yield* fs.writeFileString(summaryPath, "");
        return yield* sample;
      }).pipe(Effect.option);
      const sampler = yield* O.match(initial, {
        onNone: () => unavailable.pipe(Effect.as(O.none<Fiber.Fiber<unknown, unknown>>())),
        onSome: Effect.fn("Ci.startSampler")(function* () {
          const fiber = yield* Effect.sleep(Duration.seconds(5)).pipe(
            Effect.andThen(sample),
            Effect.forever,
            Effect.catch(() => Ref.set(measurementFailed, true)),
            Effect.forkChild
          );
          return O.some(fiber);
        }),
      });
      const child = yield* spawner.spawn(
        ChildProcess.make("bash", ["-c", '"$@"; exit "$?"', "beep-ci-lane", command, ...args], inherited)
      );
      yield* Ref.set(started, true);
      const status = yield* child.exitCode;
      if (O.isSome(sampler)) yield* Fiber.interrupt(sampler.value);
      if (yield* Ref.get(measurementFailed)) {
        yield* unavailable;
        return status;
      }
      if (O.isSome(initial)) {
        yield* Effect.gen(function* () {
          const last = yield* sample;
          const first = initial.value;
          const peak = A.reduce(samples, 0, (max, value) => Math.max(max, value.total - value.available));
          const available = A.reduce(samples, first.available, (min, value) => Math.min(min, value.available));
          const delta = last.cpu - first.cpu;
          const summary = A.join(
            [
              `### Runner resources: ${lane}`,
              "",
              GitHubMarkdown.table(
                ["Measurement", "Value"],
                [
                  ["Lane exit status", `${status}`],
                  ["Elapsed seconds", `${Math.floor(last.epoch - first.epoch)}`],
                  ["Memory samples (5-second interval)", `${A.length(samples)}`],
                  ["Host memory GiB", (last.total / 1048576).toFixed(2)],
                  ["Sampled used-memory peak GiB", (peak / 1048576).toFixed(2)],
                  ["Minimum available memory GiB", (available / 1048576).toFixed(2)],
                  ...(delta > 0
                    ? [
                        [
                          "Host CPU busy percent (excluding I/O wait)",
                          ((100 * (delta - (last.idle - first.idle))) / delta).toFixed(1),
                        ],
                      ]
                    : []),
                  ["Swap-in / swap-out pages", `${last.swapIn - first.swapIn} / ${last.swapOut - first.swapOut}`],
                ]
              ),
              "",
              "Host-wide samples include the OS and other processes. Peaks between samples may be missed.",
              "Elapsed time excludes checkout/setup and is not billed instance lifetime.",
              "",
            ],
            "\n"
          );
          yield* fs.writeFileString(summaryPath, summary);
          yield* Console.log(summary);
          const target = yield* text("GITHUB_STEP_SUMMARY");
          if (Str.isNonEmpty(target)) yield* outputs.summary(summary).pipe(Effect.catch(() => unavailable));
        }).pipe(Effect.catch(() => unavailable));
      }
      return status;
    });
    // A measurement that cannot start the lane still runs it, exactly once:
    // only a failure before the measured spawn falls back to a direct run.
    const runnerResources = Effect.fn("Ci.runnerResources")(
      function* (lane: string, command: string, args: ReadonlyArray<string>) {
        const started = yield* Ref.make(false);
        return yield* measuredRun(lane, command, args, started).pipe(
          Effect.catch((error) =>
            Effect.flatMap(Ref.get(started), (running) => (running ? Effect.fail(error) : directRun(command, args)))
          )
        );
      },
      Effect.mapError(CiCommandError.new("Failed to execute the CI lane."))
    );
    return { patterns, changeProfile, jobEnvironment, pruneAptSources, runnerResources };
  })
).pipe(Layer.provide(CiRunnerOutputsLive));
