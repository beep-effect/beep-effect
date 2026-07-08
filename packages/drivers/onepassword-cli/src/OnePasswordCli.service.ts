/**
 * Effect service for the native 1Password CLI.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $OnepasswordCliId } from "@beep/identity";
import { NonNegativeInt } from "@beep/schema";
import { OnePasswordReference } from "@beep/shared-domain/values/OnePasswordReference";
import { thunkEmptyStr } from "@beep/utils";
import { Context, Effect, Layer, Redacted, Stream } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { OnePasswordCliError } from "./OnePasswordCli.errors.ts";
import {
  OnePasswordCliAccount,
  OnePasswordCliProcessResult,
  OnePasswordReferenceProbe,
} from "./OnePasswordCli.models.ts";

const $I = $OnepasswordCliId.create("OnePasswordCli.service");
const decodeOnePasswordCliAccount = S.decodeUnknownEffect(OnePasswordCliAccount);
const decodeOnePasswordReference = S.decodeUnknownEffect(OnePasswordReference);

// shared driver boundary idiom; no in-family home; future foundation capability candidate.
// fallow-ignore-next-line code-duplication
const collectText = <E>(stream: Stream.Stream<Uint8Array, E>): Effect.Effect<string, E> =>
  stream.pipe(
    Stream.decodeText(),
    Stream.runFold(thunkEmptyStr, (acc, chunk) => `${acc}${chunk}`)
  );

/**
 * Product-neutral process runner used by the 1Password CLI driver.
 *
 * @example
 * ```ts
 * import type { OnePasswordCliRunner } from "@beep/onepassword-cli/OnePasswordCli.service"
 * import { OnePasswordCliProcessResult } from "@beep/onepassword-cli/OnePasswordCli.models"
 * import { Effect } from "effect"
 *
 * const runner: OnePasswordCliRunner = (command, args) =>
 *   Effect.succeed(
 *     OnePasswordCliProcessResult.make({ exitCode: 0, stderr: "", stdout: `${command} ${args.join(" ")}` })
 *   )
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export type OnePasswordCliRunner = (
  command: string,
  args: ReadonlyArray<string>
) => Effect.Effect<OnePasswordCliProcessResult, OnePasswordCliError>;

/**
 * Runtime shape exposed by the 1Password CLI driver service.
 *
 * @category services
 * @since 0.0.0
 */
interface OnePasswordCliShape {
  readonly probeReference: (reference: string) => Effect.Effect<OnePasswordReferenceProbe, OnePasswordCliError>;
  readonly read: (reference: string) => Effect.Effect<Redacted.Redacted<string>, OnePasswordCliError>;
  readonly whoami: Effect.Effect<OnePasswordCliAccount, OnePasswordCliError>;
}

const runNative = (
  spawner: ChildProcessSpawner.ChildProcessSpawner["Service"],
  commandPath: string,
  args: ReadonlyArray<string>
): Effect.Effect<OnePasswordCliProcessResult, OnePasswordCliError> => {
  const command = ChildProcess.make(commandPath, A.fromIterable(args), {
    stdin: "ignore",
    stderr: "pipe",
    stdout: "pipe",
  });

  return Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* spawner.spawn(command);
      const [stdout, stderr, exitCode] = yield* Effect.all(
        [collectText(handle.stdout), collectText(handle.stderr), handle.exitCode],
        { concurrency: "unbounded" }
      );

      return OnePasswordCliProcessResult.make({ exitCode, stderr, stdout });
    })
  ).pipe(
    Effect.mapError((cause) =>
      OnePasswordCliError.fromUnknown("run", "Failed to execute the 1Password CLI.", { cause, command: commandPath })
    )
  );
};

const failExit = (
  operation: string,
  command: string,
  result: OnePasswordCliProcessResult,
  message: string
): Effect.Effect<never, OnePasswordCliError> =>
  Effect.fail(
    OnePasswordCliError.fromUnknown(operation, message, {
      command,
      exitCode: result.exitCode,
      stderr: result.stderr,
      stdout: result.stdout,
    })
  );

const makeService = (commandPath: string, runner: OnePasswordCliRunner): OnePasswordCliShape => {
  const whoami = Effect.gen(function* () {
    const result = yield* runner(commandPath, ["whoami"]);
    if (result.exitCode !== 0) {
      return yield* failExit("whoami", commandPath, result, "1Password CLI is not signed in.");
    }

    return yield* decodeOnePasswordCliAccount({
      account: result.stdout,
      signedIn: true,
    }).pipe(
      Effect.mapError((cause) =>
        OnePasswordCliError.fromUnknown("whoami", "Failed to decode 1Password CLI account status.", {
          cause,
          command: commandPath,
        })
      )
    );
  }).pipe(Effect.withSpan("OnePasswordCli.whoami"));

  const read = Effect.fn("OnePasswordCli.read")(function* (reference: string) {
    const result = yield* runner(commandPath, ["read", reference, "--no-newline"]);
    if (result.exitCode !== 0) {
      return yield* failExit("read", commandPath, result, "1Password CLI could not resolve the secret reference.");
    }

    return Redacted.make(result.stdout);
  });

  const probeReference = Effect.fn("OnePasswordCli.probeReference")(function* (reference: string) {
    const typedReference = yield* decodeOnePasswordReference(reference).pipe(
      Effect.mapError((cause) =>
        OnePasswordCliError.fromUnknown("probeReference", "Invalid 1Password secret reference.", {
          cause,
          command: commandPath,
        })
      )
    );
    const value = yield* read(typedReference);
    return OnePasswordReferenceProbe.make({
      byteLength: NonNegativeInt.make(new TextEncoder().encode(Redacted.value(value)).byteLength),
      reference: typedReference,
      status: "resolved",
    });
  });

  return {
    probeReference,
    read,
    whoami,
  };
};

/**
 * Effect service for native `op` execution.
 *
 * @example
 * ```ts
 * import { OnePasswordCli } from "@beep/onepassword-cli/OnePasswordCli.service"
 *
 * console.log(OnePasswordCli)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class OnePasswordCli extends Context.Service<OnePasswordCli, OnePasswordCliShape>()($I`OnePasswordCli`) {
  /**
   * Build a live 1Password CLI layer.
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly makeLayer = (
    commandPath = "op"
  ): Layer.Layer<OnePasswordCli, never, ChildProcessSpawner.ChildProcessSpawner> =>
    Layer.effect(
      OnePasswordCli,
      Effect.gen(function* () {
        const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
        return OnePasswordCli.of(makeService(commandPath, (command, args) => runNative(spawner, command, args)));
      })
    );

  /**
   * Build a deterministic test layer from an injected command runner.
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly makeLayerFromRunner = (
    runner: OnePasswordCliRunner,
    commandPath = "op"
  ): Layer.Layer<OnePasswordCli> => Layer.succeed(OnePasswordCli, OnePasswordCli.of(makeService(commandPath, runner)));
}
