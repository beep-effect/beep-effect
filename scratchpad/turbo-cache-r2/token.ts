import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import type { CacheIdentity } from "./config.js";
import { foundationId, tokenId, workerId } from "./config.js";

const TokenRecord = S.Struct({
  attr: S.Struct({ text: S.Redacted(S.NonEmptyString) }),
  resourceType: S.Literal("Alchemy.Random"),
  status: S.Literals(["created", "updated"]),
});

const WorkerRecord = S.Struct({
  attr: S.Struct({ url: S.NonEmptyString }),
  status: S.Literals(["created", "updated"]),
});

export class TokenHandoffError extends S.TaggedError<TokenHandoffError, { readonly brand: unique symbol }>()(
  "TokenHandoffError",
  {
    message: S.String,
  },
) {}

export interface TokenHandoffOptions extends CacheIdentity {
  readonly teams: readonly string[];
  readonly team: string;
  readonly command: string;
  readonly args: readonly string[];
}

export const handoffToken = Effect.fn("TurboCache.handoffToken")(function* handoffToken(
  read: (fqn: string) => Effect.Effect<unknown, TokenHandoffError>,
  options: TokenHandoffOptions,
) {
  if (!A.some(options.teams, (team) => team === options.team) || options.command.length === 0) {
    return yield* TokenHandoffError.make({
      message:
        "The team or receiving command is invalid. Only configured teams can receive credentials. Fix: pass a configured team and `-- <command>`.",
    });
  }

  const tokenState = yield* read(`${foundationId(options)}/${tokenId(options, options.team)}`);
  const tokenRecord = S.decodeUnknownOption(TokenRecord)(tokenState);

  const workerState = yield* read(workerId(options));
  const workerRecord = S.decodeUnknownOption(WorkerRecord)(workerState);

  if (O.isNone(tokenRecord) || O.isNone(workerRecord)) {
    return yield* TokenHandoffError.make({
      message:
        "The cache has no completed deployment in state. A missing token cannot be regenerated during handoff. Fix: deploy the cartridge through the Stack workflow, then retry the handoff.",
    });
  }

  const origin = yield* Effect.try({
    catch: () =>
      TokenHandoffError.make({
        message:
          "The deployed cache URL is invalid. State does not contain a valid URL. Fix: inspect the configured Worker through the Stack state workflow.",
      }),
    try: () => new URL(workerRecord.value.attr.url).origin,
  });

  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const token = tokenRecord.value.attr.text;

  const code = yield* spawner
    .exitCode(
      ChildProcess.make(options.command, [...options.args], {
        stderr: "ignore",
        stdin: Stream.sync(() => new TextEncoder().encode(Redacted.value(token))),
        stdout: "ignore",
      }),
    )
    .pipe(
      Effect.mapError(
        () =>
          TokenHandoffError.make({
            message:
              "The credential receiver could not run. Its output is suppressed to prevent credential disclosure. Fix: verify the receiving command.",
          }),
      ),
    );

  if (code !== 0) {
    return yield* TokenHandoffError.make({
      message:
        "The credential receiver failed. Its output is suppressed to prevent credential disclosure. Fix: verify the receiving command.",
    });
  }

  return { TURBO_API: origin, TURBO_TEAM: options.team };
});
