/**
 * Hand one deployed cache token to a receiving command without printing it.
 * The token is read from the stack's state (the `Random` record Alchemy keeps)
 * and written to the receiver's stdin; the receiver's own output is discarded,
 * so the value never reaches a terminal or a log. This is how CI secrets and
 * workstation credentials are issued and rotated (`gh secret set` reads the
 * value from stdin).
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $InfraTurboCacheId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { CachePolicy, PrincipalName, TeamSlug, tokenHolders } from "./CachePolicy.ts";
import { foundationId, tokenId, workerId } from "./TurboCache.ts";

const $I = $InfraTurboCacheId.create("TokenHandoff");

const TokenRecord = S.Struct({
  attr: S.Struct({ text: S.Redacted(S.NonEmptyString) }),
  resourceType: S.tag("Alchemy.Random"),
  status: S.Literals(["created", "updated"]),
});

const WorkerRecord = S.Struct({
  attr: S.Struct({ url: S.NonEmptyString }),
  status: S.Literals(["created", "updated"]),
});

/**
 * A token handoff that did not deliver a credential. The message never
 * contains state contents, the token or the receiver's output.
 *
 * **Example** (Construct a handoff failure)
 *
 * ```ts
 * import { TokenHandoffError } from "@beep/infra-turbo-cache/TokenHandoff"
 *
 * const error = TokenHandoffError.make({ message: "The team is not configured." })
 * console.log(error._tag) // "TokenHandoffError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class TokenHandoffError extends S.TaggedError<TokenHandoffError, { readonly brand: unique symbol }>(
  $I`TokenHandoffError`
)(
  "TokenHandoffError",
  { message: S.String },
  $I.annoteError<TokenHandoffError>("TokenHandoffError", {
    description: "A token handoff that did not deliver a credential.",
  })
) {}

/**
 * Who receives which token, and through which command: `command` is the
 * executable that reads the token from stdin, `args` its arguments.
 *
 * **Example** (Refuse an empty receiver)
 *
 * ```ts
 * import { TokenHandoffOptions } from "@beep/infra-turbo-cache/TokenHandoff"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(TokenHandoffOptions.fields.command)("")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TokenHandoffOptions extends S.Opaque<TokenHandoffOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    resourceNamePrefix: S.NonEmptyString,
    policy: CachePolicy,
    team: TeamSlug,
    principal: PrincipalName,
    command: S.NonEmptyString,
    args: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("TokenHandoffOptions", { description: "Who receives which cache token, through which command." })
  )
) {}

/**
 * What a client needs besides the token: the cache origin and its team.
 *
 * **Example** (Describe an enrolment)
 *
 * ```ts
 * import { TokenHandoffResult } from "@beep/infra-turbo-cache/TokenHandoff"
 * import * as S from "effect/Schema"
 *
 * const result = TokenHandoffResult.make({ TURBO_API: "https://cache.example.test", TURBO_TEAM: "beep" })
 * console.log(S.is(TokenHandoffResult)(result)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TokenHandoffResult extends S.Opaque<TokenHandoffResult, { readonly brand: unique symbol }>()(
  S.Struct({ TURBO_API: S.NonEmptyString, TURBO_TEAM: TeamSlug }).pipe(
    $I.annoteSchema("TokenHandoffResult", { description: "The cache origin and team a client pairs with its token." })
  )
) {}

const holderOf = (policy: CachePolicy, team: TeamSlug, principal: PrincipalName) =>
  A.findFirst(tokenHolders(policy), (holder) => holder.team === team && holder.principal.name === principal);

const failure = (message: string) => TokenHandoffError.make({ message });

/**
 * Read a principal's token from state and send it to a receiver's stdin.
 *
 * **Details**
 *
 * `read` resolves a resource's state record by fully qualified name; pass the
 * deployed stack's `State.get`. Only a principal the policy lists can receive a
 * token, and only a completed deployment has one: a handoff never regenerates
 * a token. A receiver that exits non-zero fails the handoff.
 *
 * **Example** (Hand a reader token to a receiver)
 *
 * ```ts
 * import { CachePolicy } from "@beep/infra-turbo-cache/CachePolicy"
 * import { handoffToken, TokenHandoffOptions } from "@beep/infra-turbo-cache/TokenHandoff"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 *
 * const policy = S.decodeUnknownSync(CachePolicy)({
 *   teams: [{ slug: "beep", principals: [{ name: "ci-pr", access: "read", rotation: 1 }] }],
 * })
 *
 * const program = handoffToken(() => Effect.succeed(undefined), TokenHandoffOptions.make({
 *   args: ["secret", "set", "TURBO_CACHE_READ_TOKEN"],
 *   command: "gh",
 *   policy,
 *   principal: "ci-pr",
 *   resourceNamePrefix: "TurboCache",
 *   team: "beep",
 * }))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const handoffToken = Effect.fn("TurboCache.handoffToken")(function* (
  read: (fqn: string) => Effect.Effect<unknown, TokenHandoffError>,
  options: TokenHandoffOptions
) {
  const holder = holderOf(options.policy, options.team, options.principal);
  if (O.isNone(holder) || options.command.length === 0) {
    return yield* failure(
      "The team, principal or receiving command is invalid. Only principals the cache policy lists can receive a token. Fix: pass a configured team and principal and `-- <command>`."
    );
  }
  const { principal } = holder.value;

  const tokenState = yield* read(`${foundationId(options)}/${tokenId(options, { team: options.team, principal })}`);
  const tokenRecord = S.decodeUnknownOption(TokenRecord)(tokenState);
  const workerState = yield* read(workerId(options));
  const workerRecord = S.decodeUnknownOption(WorkerRecord)(workerState);

  if (O.isNone(tokenRecord) || O.isNone(workerRecord)) {
    return yield* failure(
      "The cache has no completed deployment of this token in state. A handoff never regenerates a token. Fix: deploy the stack (raise the principal's rotation to mint a new token), then retry."
    );
  }

  const origin = yield* Effect.try({
    catch: () =>
      failure("The deployed cache URL in state is invalid. Fix: inspect the Worker record with `alchemy state read`."),
    try: () => new URL(workerRecord.value.attr.url).origin,
  });

  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const token = tokenRecord.value.attr.text;
  const receiverFailed = failure(
    "The credential receiver failed. Its output is suppressed to prevent credential disclosure. Fix: verify the receiving command."
  );

  const code = yield* spawner
    .exitCode(
      ChildProcess.make(options.command, [...options.args], {
        stderr: "ignore",
        stdin: Stream.sync(() => new TextEncoder().encode(Redacted.value(token))),
        stdout: "ignore",
      })
    )
    .pipe(Effect.mapError(() => receiverFailed));

  if (code !== 0) {
    return yield* receiverFailed;
  }

  return TokenHandoffResult.make({ TURBO_API: origin, TURBO_TEAM: options.team });
});

const SourceFailure = S.Struct({
  _tag: S.optionalKey(S.String),
  message: S.String,
  name: S.optionalKey(S.String),
});

/**
 * Turn a state-read failure into a {@link TokenHandoffError} that keeps the
 * source's tag and message but nothing else, so a credential carried in the
 * cause never reaches the output.
 *
 * **Example** (Describe a missing-credential failure)
 *
 * ```ts
 * import { stateReadFailure } from "@beep/infra-turbo-cache/TokenHandoff"
 * import * as Cause from "effect/Cause"
 *
 * const error = stateReadFailure(Cause.fail({ _tag: "StateStoreError", message: "no such bucket" }))
 * console.log(error.message.includes("StateStoreError: no such bucket")) // true
 * ```
 *
 * @param cause - Why reading the stack's state failed; only its tag and message survive.
 * @returns A handoff error naming the source tag and message.
 *
 * @category constructors
 * @since 0.0.0
 */
export const stateReadFailure = (cause: Cause.Cause<unknown>): TokenHandoffError => {
  const source = cause.pipe(Cause.squash, S.decodeUnknownOption(SourceFailure));
  const detail = O.match(source, {
    onNone: () => "UnknownFailure: No tagged source message is available.",
    onSome: (value) => `${value._tag ?? value.name ?? "UnknownFailure"}: ${value.message}`,
  });
  const fix = O.exists(source, (value) => P.isTagged(value, "CredentialsUnavailable"))
    ? "export AWS credentials for the state store (aws-vault `export-credentials`), then retry"
    : "verify the state store and stage; a missing or outdated store is an operator bootstrap, never a handoff retry";
  return failure(
    `The token handoff failed before sending a credential. ${detail} State provisioning remains disabled. Fix: ${fix}.`
  );
};
