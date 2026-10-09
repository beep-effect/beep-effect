/**
 * Operational CI profiles, trusted environment export and host resource sampling.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { runGitLines } from "../../internal/repo-run/ChangedFiles.ts";
import { CiCommandError } from "./Ci.errors.ts";
import { CiChangeProfile, CiDesktopInput, CiGoalDocument, CiResourceSample } from "./CiOperational.schemas.ts";
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
const isGoal = S.is(CiGoalDocument);
const isDesktop = S.is(CiDesktopInput);
const decodeNumber = S.decodeUnknownEffect(S.FiniteFromString);
const decodeSample = S.decodeUnknownEffect(CiResourceSample);
const unavailable = Console.error("::warning::Runner resource measurement unavailable; lane exit status is preserved.");

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
    readonly changeProfile: (base: string) => Effect.Effect<void, CiCommandError>;
    readonly jobEnvironment: Effect.Effect<void, CiCommandError>;
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
    const crypto = yield* Crypto.Crypto;
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const context = yield* Effect.context<Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner>();
    const append = (target: string, body: string) => fs.writeFileString(target, body, { flag: "a" });
    const changeProfile = Effect.fn("Ci.changeProfile")(
      function* (base: string) {
        const event = yield* text("GITHUB_EVENT_NAME");
        const paths =
          event === "pull_request"
            ? yield* runGitLines(path.resolve("."), ["diff", "--name-only", `${base}...HEAD`]).pipe(
                Effect.provide(context)
              )
            : [];
        const profile = CiChangeProfile.make({
          goalsOnly: event === "pull_request" && A.isReadonlyArrayNonEmpty(paths) && A.every(paths, isGoal),
          desktopRustRelevant: event !== "pull_request" || A.some(paths, isDesktop),
        });
        const output = `goals_only=${profile.goalsOnly}\ndesktop_rust_relevant=${profile.desktopRustRelevant}\n`;
        const target = yield* text("GITHUB_OUTPUT");
        if (Str.isNonEmpty(target)) yield* append(target, output);
        yield* Console.log(Str.trimEnd(output));
      },
      Effect.mapError(CiCommandError.new("Failed to determine the CI change profile."))
    );

    const jobEnvironment = Effect.gen(function* () {
      const target = yield* text("GITHUB_ENV");
      if (Str.isEmpty(target)) return yield* CiCommandError.make({ message: "ci-job-env: GITHUB_ENV is not set" });
      const event = yield* text("GITHUB_EVENT_NAME");
      const repo = yield* text("GITHUB_REPOSITORY");
      const head = yield* text("BEEP_CI_HEAD_REPOSITORY");
      const trusted = event === "push";
      const same = event === "pull_request" && Str.isNonEmpty(repo) && repo === head;
      let mode = "not requested";
      let appMode = "not requested";
      const entries: Array<readonly [string, Redacted.Redacted<string>]> = [];
      const add = (name: string, value: string) => {
        entries.push([name, Redacted.make(value)]);
      };
      if ((yield* text("BEEP_CI_TURBO_REMOTE_CACHE")) === "true") {
        const api = yield* text("BEEP_CI_TURBO_API");
        const team = yield* text("BEEP_CI_TURBO_TEAM");
        const token = yield* secret(trusted ? "TURBO_TOKEN" : "TURBO_READ_TOKEN");
        const permitted =
          (trusted || same) &&
          Str.isNonEmpty(api) &&
          Str.isNonEmpty(team) &&
          token.pipe(Redacted.value, Str.isNonEmpty);
        mode = permitted
          ? trusted
            ? "read-write (trusted push)"
            : "read-only (same-repository pull request)"
          : "local-only";
        add("TURBO_API", permitted ? api : "");
        entries.push(["TURBO_TOKEN", permitted ? token : Redacted.make("")]);
        add("TURBO_TEAM", permitted ? team : "");
        add("TURBO_CACHE", permitted ? (trusted ? "local:rw,remote:rw" : "local:rw,remote:r") : "local:rw");
        add("TURBO_LOG_ORDER", "stream");
        add("BEEP_CI_TURBO_REMOTE_MODE", mode);
      }
      if ((yield* text("BEEP_CI_APP_SECRETS")) === "true") {
        for (const name of appNames) entries.push([name, trusted ? yield* secret(name) : Redacted.make("")]);
        appMode = trusted ? "exported (trusted push)" : "blank";
      }
      const rendered = yield* Effect.forEach(
        entries,
        Effect.fn("Ci.renderEnvironmentEntry")(function* ([name, value]) {
          const raw = Redacted.value(value);
          let delimiter = `beep_ci_env_${yield* crypto.randomUUIDv4}`;
          while (A.contains(Str.split(raw, /\r?\n/u), delimiter))
            delimiter = `beep_ci_env_${yield* crypto.randomUUIDv4}`;
          return `${name}<<${delimiter}\n${raw}\n${delimiter}\n`;
        }),
        { concurrency: 1 }
      );
      yield* append(target, A.join(rendered, ""));
      yield* Console.log(`ci-job-env: turbo remote cache ${mode}; application secrets ${appMode}`);
    }).pipe(
      Effect.mapError(CiCommandError.new("Failed to export the CI job environment.")),
      Effect.withSpan("Ci.jobEnvironment")
    );

    const runnerResources = Effect.fn("Ci.runnerResources")(
      function* (lane: string, command: string, args: ReadonlyArray<string>) {
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
          return yield* decodeSample({
            epoch: DateTime.toEpochMillis(yield* DateTime.now) / 1000,
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
          ChildProcess.make("bash", ["-c", '"$@"; exit "$?"', "beep-ci-lane", command, ...args], {
            stdin: "inherit",
            stdout: "inherit",
            stderr: "inherit",
          })
        );
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
                "| Measurement | Value |",
                "| --- | --- |",
                `| Lane exit status | ${status} |`,
                `| Elapsed seconds | ${Math.floor(last.epoch - first.epoch)} |`,
                `| Memory samples (5-second interval) | ${A.length(samples)} |`,
                `| Host memory GiB | ${(last.total / 1048576).toFixed(2)} |`,
                `| Sampled used-memory peak GiB | ${(peak / 1048576).toFixed(2)} |`,
                `| Minimum available memory GiB | ${(available / 1048576).toFixed(2)} |`,
                ...(delta > 0
                  ? [
                      `| Host CPU busy percent (excluding I/O wait) | ${((100 * (delta - (last.idle - first.idle))) / delta).toFixed(1)} |`,
                    ]
                  : []),
                `| Swap-in / swap-out pages | ${last.swapIn - first.swapIn} / ${last.swapOut - first.swapOut} |`,
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
            if (Str.isNonEmpty(target)) yield* append(target, summary).pipe(Effect.catch(() => unavailable));
          }).pipe(Effect.catch(() => unavailable));
        }
        return status;
      },
      Effect.mapError(CiCommandError.new("Failed to execute the CI lane."))
    );
    return { changeProfile, jobEnvironment, runnerResources };
  })
);
