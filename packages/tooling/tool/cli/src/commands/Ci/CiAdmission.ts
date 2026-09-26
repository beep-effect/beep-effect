/**
 * `bun run beep ci admission`: decide heavy-matrix admission for the current
 * GitHub event and hand the verdict to the workflow (ttc B8).
 *
 * **Details**
 *
 * The `check.yml` admission job runs this once per run before the reusable
 * heavy workflow is called. It reads `GITHUB_EVENT_NAME` / `GITHUB_EVENT_PATH`
 * (overridable by `--event-name` / `--event-path`), diffs against
 * `origin/<base>`, prints the {@link HeavyAdmission} JSON, and with
 * `--github-output` appends `verdict=`, `admitted=`, `docs_only=` and
 * `sources=` to `$GITHUB_OUTPUT`. Every verdict exits 0; only unreadable
 * inputs exit non-zero.
 *
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils";
import { SchemaUtils } from "@beep/schema";
import { Config, Console, Effect, FileSystem, pipe } from "effect";
import { Command, Flag } from "effect/cli";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { runRepoCommandCapture } from "../../internal/repo-run/index.ts";
import { JsonStringCodec } from "../../internal/schema/JsonCodec.ts";
import { CiCommandError } from "./Ci.errors.ts";
import {
  decideHeavyAdmission,
  HeavyAdmission,
  HeavyAdmissionEventName,
  HeavyAdmissionReadInput,
  readHeavyAdmissionEvent,
  renderHeavyAdmissionGithubOutput,
  renderHeavyAdmissionSummary,
} from "./HeavyAdmission.ts";
import type * as Crypto from "effect/Crypto";
import type { ChildProcessSpawner } from "effect/process";

const $I = $RepoCliId.create("commands/Ci/CiAdmission");

/**
 * JSON codec for the admission verdict the command prints.
 *
 * **Example** (Encode a verdict)
 *
 * ```ts
 * import { HeavyAdmission, HeavyAdmissionJson } from "@beep/repo-cli/commands/Ci"
 * import { Effect } from "effect"
 *
 * const admission = HeavyAdmission.make({ verdict: "run", admitted: true, sources: ["main-push"], docsOnly: false, changedPathCount: 0 })
 * Effect.runPromise(HeavyAdmissionJson.encode(admission)).then((text) => console.log(text.includes("\"verdict\":\"run\""))) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const HeavyAdmissionJson = JsonStringCodec(HeavyAdmission);

/**
 * The resolved inputs of one `ci admission` invocation.
 *
 * **Details**
 *
 * `eventName` and `eventPath` are `None` when neither the flag nor the
 * environment variable supplied them; `githubOutputPath` is `$GITHUB_OUTPUT`
 * when `--github-output` was requested. `cwd` is the checkout to diff.
 *
 * **Example** (Construct an invocation)
 *
 * ```ts
 * import { CiAdmissionInput } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const input = CiAdmissionInput.make({ eventName: O.some("push"), cwd: "." })
 * console.log(input.json) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiAdmissionInput extends S.Class<CiAdmissionInput>($I`CiAdmissionInput`)(
  {
    eventName: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    eventPath: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    base: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    githubOutputPath: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    json: S.Boolean.pipe(SchemaUtils.withKeyDefaults(true)),
    cwd: S.String,
  },
  $I.annote("CiAdmissionInput", {
    description: "Resolved flags and environment of one ci admission invocation.",
  })
) {}

const decodeEventName = S.decodeUnknownEffect(HeavyAdmissionEventName);

/**
 * Decide admission for the resolved inputs, print it, and append the
 * `$GITHUB_OUTPUT` lines when a path was resolved.
 *
 * **Example** (Reference the runner)
 *
 * ```ts
 * import { CiAdmissionInput, runCiAdmission } from "@beep/repo-cli/commands/Ci"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const program = runCiAdmission(CiAdmissionInput.make({ eventName: O.some("push"), cwd: "." }))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param input - The resolved flags and environment.
 * @param capture - The command capture to run `git` through; the repo capture by default.
 * @returns The decided admission after printing it.
 * @category use-cases
 * @since 0.0.0
 */
export const runCiAdmission = Effect.fn("Ci.runCiAdmission")(function* (
  input: CiAdmissionInput,
  capture: typeof runRepoCommandCapture = runRepoCommandCapture
): Effect.fn.Return<
  HeavyAdmission,
  CiCommandError,
  FileSystem.FileSystem | Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner
> {
  const rawEventName = yield* Effect.fromOption(input.eventName, () =>
    CiCommandError.make({ message: "ci admission needs an event name: set GITHUB_EVENT_NAME or pass --event-name." })
  );
  const eventName = yield* decodeEventName(rawEventName).pipe(
    CiCommandError.mapError(`ci admission does not decide "${rawEventName}" events (pull_request, push, merge_group).`)
  );
  const event = yield* readHeavyAdmissionEvent(
    HeavyAdmissionReadInput.make({ eventName, eventPath: input.eventPath, base: input.base, cwd: input.cwd }),
    capture
  );
  const admission = decideHeavyAdmission(event);
  yield* input.json
    ? HeavyAdmissionJson.encode(admission).pipe(
        CiCommandError.mapError("Failed to encode the heavy admission verdict."),
        Effect.flatMap(Console.log)
      )
    : Console.log(renderHeavyAdmissionSummary(admission));
  if (O.isSome(input.githubOutputPath)) {
    const fs = yield* FileSystem.FileSystem;
    yield* fs
      .writeFileString(input.githubOutputPath.value, renderHeavyAdmissionGithubOutput(admission), { flag: "a" })
      .pipe(CiCommandError.mapError(`Failed to append the admission verdict to ${input.githubOutputPath.value}.`));
  }
  return admission;
});

const envOption = (name: string): Effect.Effect<O.Option<string>> =>
  Config.option(Config.String(name)).pipe(Effect.orElseSucceed(O.none<string>));

const flagOrEnv = (flag: O.Option<string>, name: string): Effect.Effect<O.Option<string>> =>
  O.match(flag, { onNone: () => envOption(name), onSome: (value) => Effect.succeedSome(value) });

const githubOutputPathFor = (requested: boolean): Effect.Effect<O.Option<string>, CiCommandError> =>
  requested
    ? envOption("GITHUB_OUTPUT").pipe(
        Effect.flatMap(
          O.match({
            onNone: () =>
              Effect.fail(CiCommandError.make({ message: "--github-output needs GITHUB_OUTPUT in the environment." })),
            onSome: (value) => Effect.succeedSome(value),
          })
        )
      )
    : Effect.succeedNone;

interface CiAdmissionFlags {
  readonly base: O.Option<string>;
  readonly eventName: O.Option<string>;
  readonly eventPath: O.Option<string>;
  readonly githubOutput: boolean;
  readonly json: boolean;
}

// Flags win over the environment; the checkout is the repo root the command runs in.
const resolveCiAdmissionInput = Effect.fn("Ci.resolveCiAdmissionInput")(function* (
  flags: CiAdmissionFlags
): Effect.fn.Return<CiAdmissionInput, CiCommandError, FileSystem.FileSystem> {
  const cwd = yield* findRepoRoot().pipe(CiCommandError.mapError("Failed to locate repository root."));
  const eventName = yield* flagOrEnv(flags.eventName, "GITHUB_EVENT_NAME");
  const eventPath = yield* flagOrEnv(flags.eventPath, "GITHUB_EVENT_PATH");
  const githubOutputPath = yield* githubOutputPathFor(flags.githubOutput);
  return CiAdmissionInput.make({
    eventName,
    eventPath,
    base: flags.base,
    githubOutputPath,
    json: flags.json,
    cwd,
  });
});

/**
 * The `ci admission` subcommand.
 *
 * **Example** (Register the subcommand)
 *
 * ```ts
 * import { ciAdmissionCommand } from "@beep/repo-cli/commands/Ci"
 * import { Command } from "effect/cli"
 *
 * const ci = Command.make("ci").pipe(Command.withSubcommands([ciAdmissionCommand]))
 * console.log(typeof ci) // "object"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const ciAdmissionCommand = Command.make(
  "admission",
  {
    eventName: Flag.String("event-name").pipe(
      Flag.optional,
      Flag.withDescription("GitHub event name (default: GITHUB_EVENT_NAME)")
    ),
    eventPath: Flag.String("event-path").pipe(
      Flag.optional,
      Flag.withDescription("GitHub event payload JSON path (default: GITHUB_EVENT_PATH)")
    ),
    base: Flag.String("base").pipe(
      Flag.optional,
      Flag.withDescription("Base branch to diff against (default: the payload's pull_request.base.ref)")
    ),
    json: Flag.Boolean("json").pipe(
      Flag.withDefault(true),
      Flag.withDescription("Print the HeavyAdmission JSON (disable with --no-json for a one-line summary)")
    ),
    githubOutput: Flag.Boolean("github-output").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Append verdict=, admitted=, docs_only=, sources= to $GITHUB_OUTPUT")
    ),
  },
  (flags) =>
    pipe(
      resolveCiAdmissionInput(flags),
      Effect.flatMap((input) => runCiAdmission(input)),
      Effect.catchTag("CiCommandError", (error) =>
        Console.error(`[ci] ${error.message}`).pipe(Effect.andThen(failWithReportedExit(`[ci] ${error.message}`)))
      )
    )
).pipe(Command.withDescription("Decide heavy-matrix admission for the current GitHub event"));
