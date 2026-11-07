/**
 * Mining runner profiles, the runner service contract and its live child-process layer.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { sanitizeLibraryDiagnostic } from "./Library.adapter.ts";
import { LibraryMineRunnerError } from "./Library.mine.errors.ts";
import { LibraryMineProfileId, LibraryMineTier } from "./Library.mine.schemas.ts";

const $I = $RepoCliId.create("commands/Research/Library/Library.mine.runner");

/**
 * How a runner receives its prompt: on stdin, or as a prompt file named in its task argv.
 *
 * **Example** (Inspect LibraryMinePromptTransport)
 * ```ts
 * import { LibraryMinePromptTransport } from "@beep/repo-cli/commands/Research"
 * console.log(LibraryMinePromptTransport.literals)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LibraryMinePromptTransport = LiteralKit(["stdin", "prompt-file"]).pipe(
  $I.annoteSchema("LibraryMinePromptTransport", { description: "How a runner receives its prompt." })
);
/**
 * Runtime type of LibraryMinePromptTransport.
 *
 * @category models
 * @since 0.0.0
 */
export type LibraryMinePromptTransport = typeof LibraryMinePromptTransport.Type;

/**
 * A runner profile: the pool pin and route a tier job launches on.
 *
 * **Example** (Inspect the T1 default)
 * ```ts
 * import { libraryMineProfile } from "@beep/repo-cli/commands/Research"
 * console.log(libraryMineProfile("codex-luna").model) // "gpt-6-luna"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LibraryMineProfile extends S.Opaque<LibraryMineProfile, { readonly brand: unique symbol }>()(
  S.Struct({
    id: LibraryMineProfileId,
    tiers: S.Array(LibraryMineTier),
    command: S.String,
    model: S.String,
    effort: S.String,
    route: S.String,
    externalLane: S.Boolean,
    transport: LibraryMinePromptTransport,
    outputFile: S.Boolean,
  }).pipe($I.annoteSchema("LibraryMineProfile", { description: "Pool pin and route a tier job launches on." }))
) {}

const profiles = {
  "codex-luna": LibraryMineProfile.make({
    id: "codex-luna",
    tiers: ["t1"],
    command: "codex",
    model: "gpt-6-luna",
    effort: "medium",
    route: "codex-cli",
    externalLane: false,
    transport: "stdin",
    outputFile: true,
  }),
  // Step 2 of the Claude fallback chain (AGENTS.md): Codex GPT-6.1 Sol medium for T2 reads.
  "codex-sol": LibraryMineProfile.make({
    id: "codex-sol",
    tiers: ["t2"],
    command: "codex",
    model: "gpt-6.1-sol",
    effort: "medium",
    route: "codex-cli",
    externalLane: false,
    transport: "stdin",
    outputFile: true,
  }),
  junie: LibraryMineProfile.make({
    id: "junie",
    tiers: ["t2"],
    command: "junie",
    model: "claude-opus-5-5",
    effort: "medium",
    route: "junie-cli",
    externalLane: true,
    transport: "prompt-file",
    outputFile: false,
  }),
  claude: LibraryMineProfile.make({
    id: "claude",
    tiers: ["t1", "t2"],
    command: "claude",
    model: "claude-opus-5-5",
    effort: "medium",
    route: "claude-code",
    externalLane: false,
    transport: "stdin",
    outputFile: false,
  }),
  // The approved proxy-workflow binding of codex.heavy: CLIProxyAPI fails over across every admitted
  // ChatGPT login, so a single exhausted Codex CLI account does not stop the batch.
  "proxy-sol": LibraryMineProfile.make({
    id: "proxy-sol",
    tiers: ["t2"],
    command: "claude",
    model: "gpt-6.1-sol(medium)",
    effort: "medium",
    route: "proxy-workflow",
    externalLane: false,
    transport: "stdin",
    outputFile: false,
  }),
  // child.heavy through the proxy: claude-opus-5-5 across every admitted Claude login, not only the CLI's.
  "proxy-opus": LibraryMineProfile.make({
    id: "proxy-opus",
    tiers: ["t1", "t2"],
    command: "claude",
    model: "claude-opus-5-5",
    effort: "medium",
    route: "proxy-workflow",
    externalLane: false,
    transport: "stdin",
    outputFile: false,
  }),
  cursor: LibraryMineProfile.make({
    id: "cursor",
    tiers: ["t2"],
    command: "cursor-agent",
    model: "claude-opus-5-5-medium",
    effort: "medium",
    route: "cursor-seat",
    externalLane: true,
    transport: "prompt-file",
    outputFile: false,
  }),
} satisfies Record<LibraryMineProfileId, LibraryMineProfile>;

/**
 * Resolve a runner profile by id.
 *
 * **Example** (Junie is an external lane)
 * ```ts
 * import { libraryMineProfile } from "@beep/repo-cli/commands/Research"
 * console.log(libraryMineProfile("junie").externalLane) // true
 * ```
 *
 * @param id - Runner profile id.
 * @returns The profile's pins, route and transport.
 * @category configuration
 * @since 0.0.0
 */
export const libraryMineProfile = (id: LibraryMineProfileId): LibraryMineProfile => profiles[id];

/**
 * Paths a runner's argv names for one job.
 *
 * **Example** (Inspect launch path fields)
 * ```ts
 * import { LibraryMineLaunchPaths } from "@beep/repo-cli/commands/Research"
 * console.log(Object.keys(LibraryMineLaunchPaths.fields))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LibraryMineLaunchPaths extends S.Opaque<LibraryMineLaunchPaths, { readonly brand: unique symbol }>()(
  S.Struct({
    cwd: S.String,
    schemaPath: S.String,
    outputPath: S.String,
    promptPath: S.String,
  }).pipe($I.annoteSchema("LibraryMineLaunchPaths", { description: "Paths a runner argv names for one job." }))
) {}

const fileTask = (promptPath: string) =>
  `Read the job file ${promptPath} and follow it exactly. Do not edit any file. Reply with only the JSON object it asks for.`;

/**
 * Build the exact launch argv for a profile; the same argv is recorded on the ModelRun.
 *
 * **Example** (T1 codex argv)
 * ```ts
 * import { libraryMineArgv, libraryMineProfile, LibraryMineLaunchPaths } from "@beep/repo-cli/commands/Research"
 * const paths = LibraryMineLaunchPaths.make({ cwd: "/library", schemaPath: "/library/t1.json", outputPath: "/library/out.json", promptPath: "/library/prompt.md" })
 * console.log(libraryMineArgv(libraryMineProfile("codex-luna"), paths).join(" "))
 * ```
 *
 * @param profile - Runner profile to launch.
 * @param paths - Working directory, output schema, output and prompt paths for the job.
 * @returns The argv, command first.
 * @category configuration
 * @since 0.0.0
 */
export const libraryMineArgv: {
  (profile: LibraryMineProfile, paths: LibraryMineLaunchPaths): ReadonlyArray<string>;
  (paths: LibraryMineLaunchPaths): (profile: LibraryMineProfile) => ReadonlyArray<string>;
} = dual(
  2,
  (profile: LibraryMineProfile, paths: LibraryMineLaunchPaths): ReadonlyArray<string> =>
    Match.value(profile.id).pipe(
      Match.when(Match.is("codex-luna", "codex-sol"), () => [
        "codex",
        "exec",
        "-m",
        profile.model,
        "-c",
        `model_reasoning_effort="${profile.effort}"`,
        "--output-schema",
        paths.schemaPath,
        "-s",
        "read-only",
        "--skip-git-repo-check",
        "--cd",
        paths.cwd,
        "-o",
        paths.outputPath,
        "-",
      ]),
      Match.when("claude", () => [
        "claude",
        "-p",
        "--model",
        profile.model,
        "--effort",
        profile.effort,
        "--output-format",
        "text",
        "--tools",
        "",
        "--strict-mcp-config",
        "--no-session-persistence",
      ]),
      Match.when(Match.is("proxy-sol", "proxy-opus"), () => [
        "claude",
        "-p",
        "--model",
        profile.model,
        "--settings",
        `{"effortLevel":"${profile.effort}"}`,
        "--output-format",
        "text",
        "--tools",
        "",
        "--strict-mcp-config",
        "--mcp-config",
        '{"mcpServers":{}}',
        "--no-session-persistence",
      ]),
      Match.when("junie", () => [
        "junie",
        `--model=${profile.model}`,
        `--effort=${profile.effort}`,
        "--output-format=text",
        "--skip-update-check",
        "-p",
        paths.cwd,
        `--task=${fileTask(paths.promptPath)}`,
      ]),
      Match.when("cursor", () => [
        "cursor-agent",
        "-p",
        "--model",
        profile.model,
        "--output-format",
        "text",
        "--sandbox",
        "enabled",
        "--workspace",
        paths.cwd,
        fileTask(paths.promptPath),
      ]),
      Match.exhaustive
    )
);

/**
 * One runner launch: argv, prompt and the file a `-o` style runner writes.
 *
 * **Example** (Inspect request fields)
 * ```ts
 * import { LibraryMineRunRequest } from "@beep/repo-cli/commands/Research"
 * console.log(Object.keys(LibraryMineRunRequest.fields))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LibraryMineRunRequest extends S.Opaque<LibraryMineRunRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    tier: LibraryMineTier,
    jobKey: S.String,
    profile: LibraryMineProfile,
    argv: S.Array(S.String),
    cwd: S.String,
    prompt: S.String,
    outputPath: S.Option(S.String),
    timeoutMinutes: S.Int.check(S.isGreaterThanOrEqualTo(1)),
  }).pipe($I.annoteSchema("LibraryMineRunRequest", { description: "One runner launch." }))
) {}

/**
 * Launches tier jobs and returns the runner's final answer text.
 *
 * **Details**
 *
 * The live layer spawns the argv; tests provide a fake that answers without a model.
 *
 * **Example** (Provide a fake runner)
 * ```ts
 * import { LibraryMineRunner } from "@beep/repo-cli/commands/Research"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * const fake = Layer.succeed(LibraryMineRunner, LibraryMineRunner.of({ run: () => Effect.succeed("{}") }))
 * console.log(Layer.isLayer(fake))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class LibraryMineRunner extends Context.Service<
  LibraryMineRunner,
  {
    readonly run: (request: LibraryMineRunRequest) => Effect.Effect<string, LibraryMineRunnerError>;
  }
>()($I`LibraryMineRunner`) {}

const quotaPattern = /quota|rate.?limit|\b429\b|usage.?limit|exceeded/i;
const runnerFailure = (message: string) => LibraryMineRunnerError.make({ quota: false, message });

const PROXY_BASE_URL = "http://127.0.0.1:8317";

// Inherited Anthropic host credentials outrank ANTHROPIC_AUTH_TOKEN and break proxy routing, so the
// proxy profile launches with a minimal environment instead of extending the parent's.
const launchEnvironment = Effect.fnUntraced(function* (profile: LibraryMineProfile, fs: FileSystem.FileSystem) {
  if (profile.route !== "proxy-workflow") return { extendEnv: true } as const;
  const home = yield* Config.String("HOME").pipe(Effect.mapError(() => runnerFailure("HOME is not set.")));
  const path = yield* Config.String("PATH").pipe(
    Config.withDefault("/usr/bin:/bin"),
    Effect.mapError(() => runnerFailure("PATH could not be read."))
  );
  const token = yield* fs
    .readFileString(`${home}/.cli-proxy-api/client-token`)
    .pipe(Effect.mapError(() => runnerFailure("The local proxy client token is unavailable.")));
  return {
    extendEnv: false,
    env: {
      HOME: home,
      PATH: `${home}/.local/bin:${path}`,
      TERM: "dumb",
      ANTHROPIC_BASE_URL: PROXY_BASE_URL,
      ANTHROPIC_AUTH_TOKEN: Redacted.make(Str.trim(token)),
      ANTHROPIC_DEFAULT_HAIKU_MODEL: "gpt-6-luna",
    },
  } as const;
});

const decodedText = <E, R>(stream: Stream.Stream<Uint8Array, E, R>) =>
  stream.pipe(Stream.decodeText(), Stream.mkString);

const makeLiveRunner = Effect.fn("LibraryMineRunner.make")(function* () {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const fs = yield* FileSystem.FileSystem;
  const run = Effect.fn("LibraryMineRunner.run")(function* (request: LibraryMineRunRequest) {
    const [command, ...args] = request.argv;
    if (command === undefined) return yield* runnerFailure("Runner argv is empty.");
    const stdin =
      request.profile.transport === "stdin"
        ? { stream: Stream.make(new TextEncoder().encode(request.prompt)), endOnDone: true }
        : "ignore";
    const collected = yield* Effect.scoped(
      Effect.gen(function* () {
        const environment = yield* launchEnvironment(request.profile, fs);
        const handle = yield* ChildProcess.make(command, args, {
          cwd: request.cwd,
          ...environment,
          stdin,
          stdout: "pipe",
          stderr: "pipe",
          forceKillAfter: Duration.seconds(5),
        });
        return yield* Effect.all([decodedText(handle.stdout), decodedText(handle.stderr), handle.exitCode], {
          concurrency: "unbounded",
        });
      })
    ).pipe(
      Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
      Effect.mapError((cause) => runnerFailure(`${command} failed to launch: ${cause.message}`)),
      Effect.timeoutOrElse({
        duration: Duration.minutes(request.timeoutMinutes),
        orElse: () => Effect.fail(runnerFailure(`${command} timed out after ${request.timeoutMinutes} minutes.`)),
      })
    );
    const [stdout, stderr, exitCode] = collected;
    if (exitCode !== 0) {
      const tail = Str.slice(-2000)(stderr);
      // Junie reports quota exhaustion only in the log file its stderr names, so read that log's tail too.
      const logPath = O.flatMap(O.fromNullishOr(/log file: (\S+\.log)/.exec(tail)), (match) =>
        O.fromNullishOr(match[1])
      );
      const logTail = O.isSome(logPath)
        ? yield* fs.readFileString(logPath.value).pipe(
            Effect.map(Str.slice(-20000)),
            Effect.orElseSucceed(() => "")
          )
        : "";
      return yield* LibraryMineRunnerError.make({
        quota: quotaPattern.test(tail) || quotaPattern.test(logTail),
        message: `${command} exited ${exitCode}: ${sanitizeLibraryDiagnostic(tail)}`,
      });
    }
    if (O.isNone(request.outputPath)) return stdout;
    return yield* fs
      .readFileString(request.outputPath.value)
      .pipe(Effect.mapError(() => runnerFailure(`${command} wrote no output file.`)));
  });
  return LibraryMineRunner.of({ run });
});

/**
 * Live runner layer that spawns the profile argv with effect/process.
 *
 * **Example** (Use LibraryMineRunnerLive)
 * ```ts
 * import { LibraryMineRunnerLive } from "@beep/repo-cli/commands/Research"
 * console.log(LibraryMineRunnerLive !== undefined)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const LibraryMineRunnerLive = Layer.effect(LibraryMineRunner, makeLiveRunner());

/**
 * Extract the JSON object from a runner's final answer, tolerating a Markdown fence.
 *
 * **Example** (Strip a fence)
 * ```ts
 * import { libraryMineAnswerJson } from "@beep/repo-cli/commands/Research"
 * console.log(libraryMineAnswerJson("```json\n{\"a\":1}\n```")) // {"a":1}
 * ```
 *
 * @param text - Final answer text.
 * @returns The text from the first `{` to the last `}`, or the trimmed text when none.
 * @category utilities
 * @since 0.0.0
 */
export const libraryMineAnswerJson = (text: string): string => {
  const start = Str.indexOf("{")(text);
  const end = Str.lastIndexOf("}")(text);
  return O.isSome(start) && O.isSome(end) && end.value > start.value
    ? Str.slice(start.value, end.value + 1)(text)
    : Str.trim(text);
};

/**
 * Whether a profile may launch jobs of a tier.
 *
 * **Example** (Junie does not triage)
 * ```ts
 * import { libraryMineProfile, libraryMineProfileServes } from "@beep/repo-cli/commands/Research"
 * console.log(libraryMineProfileServes(libraryMineProfile("junie"), "t1")) // false
 * ```
 *
 * @param profile - Runner profile.
 * @param tier - Mining tier.
 * @returns `true` when the profile lists the tier.
 * @category utilities
 * @since 0.0.0
 */
export const libraryMineProfileServes: {
  (profile: LibraryMineProfile, tier: LibraryMineTier): boolean;
  (tier: LibraryMineTier): (profile: LibraryMineProfile) => boolean;
} = dual(2, (profile: LibraryMineProfile, tier: LibraryMineTier): boolean => A.contains(profile.tiers, tier));
