import type * as Command from "@alchemy.run/domain/Command";
import type * as Read from "@alchemy.run/domain/Read";
import type * as View from "@alchemy.run/domain/View";
import * as A from "@beep/utils/Array";
import { Sequence } from "@proto/kernel/Measure";
import * as Cause from "effect/Cause";
import type * as Context from "effect/Context";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as P from "@beep/utils/Predicate";
import type * as Headers from "effect/http/Headers";
import * as Ref from "effect/Ref";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { Credentials } from "./Credentials.context.ts";

/**
 * Where a committed command sits: its stream and the version it reached.
 * Passing it to a read waits until the read has applied that write.
 *
 * @category models
 * @since 0.0.0
 */
export const Receipt = S.Struct({ stream: S.NonEmptyString, version: Sequence });
/**
 * @category models
 * @since 0.0.0
 */
export type Receipt = typeof Receipt.Type;

/**
 * A view's state with the revision it is valid at (the cursor the library
 * returns) and the epoch of the subscription that delivered it: a reconnect
 * starts a new epoch.
 *
 * @category models
 * @since 0.0.0
 */
export interface Revisioned<S> {
  readonly state: S;
  readonly revision: number;
  readonly epoch: number;
}

/**
 * How a command went, always with the command id it was sent with:
 * committed (`Accepted`, with its receipt), refused by the model
 * (`Rejected`, one of the command's declared rejections), refused for
 * authority (`Denied`), or unknown (`Unknown`: transport failed or the
 * answer was lost, so it may have committed; retry with the same id).
 *
 * @category models
 * @since 0.0.0
 */
export type CommandOutcome<Rejection> =
  | { readonly _tag: "Accepted"; readonly commandId: string; readonly receipt: Receipt }
  | { readonly _tag: "Rejected"; readonly commandId: string; readonly rejection: Rejection }
  | { readonly _tag: "Denied"; readonly commandId: string; readonly reason: string }
  | { readonly _tag: "Unknown"; readonly commandId: string; readonly reason: string };

/** Failures that mean "not allowed", whichever command declares them. */
const deniedTags = HashSet.make("MissingGrant", "Unauthorized", "Unaccountable");

/** What every binding needs: the Api client, the caller's credentials, and ids. */
export type BindingServices<Id> = Id | Credentials | SecureRandom.SecureRandom;

/**
 * A command's binding: `send` mints the command id (or reuses the one given,
 * for a retry) and returns a typed outcome; it never fails.
 *
 * @category models
 * @since 0.0.0
 */
export interface CommandBinding<Id, Target, Input, Rejection> {
  readonly tag: string;
  readonly send: (call: {
    readonly target: Target;
    readonly input: Input;
    readonly commandId?: string | undefined;
  }) => Effect.Effect<CommandOutcome<Rejection>, never, BindingServices<Id>>;
}

/**
 * Bind one command of a contract Api.
 *
 * **Details**
 *
 * A declared rejection is `Rejected`, except the authority refusals
 * (`MissingGrant`, `Unauthorized`, `Unaccountable`), which are `Denied`.
 * Anything else, transport failure or a defect, is `Unknown`, and the caller
 * retries with the outcome's `commandId`: the platform answers a reused id
 * from the first receipt, so a retry never applies twice.
 *
 * **Example** (A generated command binding)
 * ```ts
 * import { AcceptClaim } from "@proto/party-contract/Claim/AcceptClaim.command";
 * import { ReviewerContract } from "@proto/party-contract/ReviewerApi.contract";
 * import * as Bindings from "@proto/party-web/Bindings";
 *
 * const accept = Bindings.command(ReviewerContract, AcceptClaim, (client) => client.AcceptClaim);
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const command: {
  <Id, Client, C extends Command.Any, Target, Input, E>(
    cls: C,
    select: CommandSelect<Client, Target, Input, E>,
  ): (api: ContractApi<Id, Client>) => CommandBinding<Id, Target, Input, InstanceType<C["rejects"][number]>>;
  <Id, Client, C extends Command.Any, Target, Input, E>(
    api: ContractApi<Id, Client>,
    cls: C,
    select: CommandSelect<Client, Target, Input, E>,
  ): CommandBinding<Id, Target, Input, InstanceType<C["rejects"][number]>>;
} = dual(3, <Id, Client, C extends Command.Any, Target, Input, E>(
  api: ContractApi<Id, Client>,
  cls: C,
  select: CommandSelect<Client, Target, Input, E>,
): CommandBinding<Id, Target, Input, InstanceType<C["rejects"][number]>> => {
  type Rejection = InstanceType<C["rejects"][number]>;
  // One of the command's declared rejections, matched by its schema as the library's Foldkit binding does.
  const isDeclared = (error: unknown): error is Rejection => A.some(cls.rejects, (rejection) => S.is(rejection)(error));
  const classify = (commandId: string, error: unknown): CommandOutcome<Rejection> => {
    const tag = (error as { readonly _tag?: unknown } | null)?._tag;
    return !P.isString(tag)
      ? { _tag: "Unknown", commandId, reason: String(error) }
      : HashSet.has(deniedTags, tag)
        ? { _tag: "Denied", commandId, reason: tag }
        : isDeclared(error)
          ? { _tag: "Rejected", commandId, rejection: error }
          : { _tag: "Unknown", commandId, reason: tag };
  };
  return {
    tag: cls.tag,
    send: Effect.fn(`Bindings.command.${cls.tag}`)(function* ({
      target,
      input,
      commandId,
    }: Parameters<CommandBinding<Id, Target, Input, Rejection>["send"]>[0]) {
        const random = yield* SecureRandom.SecureRandom;
        const id = commandId ?? (yield* random.uuidV4());
        const client = yield* Effect.service(api.Client);
        const credentials = yield* Credentials;
        const headers = yield* credentials.headers;
        return yield* select(client)(target, input, { commandId: id, headers }).pipe(
          Effect.map((receipt): CommandOutcome<Rejection> => ({
            _tag: "Accepted",
            commandId: id,
            receipt: { stream: receipt.stream, version: receipt.version },
          })),
          Effect.catch((error) => Effect.succeed(classify(id, error))),
          Effect.catchCause((cause) =>
            Effect.succeed<CommandOutcome<Rejection>>({ _tag: "Unknown", commandId: id, reason: Cause.pretty(cause) }),
          ),
        );
    }),
  };
});

/** A contract Api, as a binding needs it: the key of its typed client. */
interface ContractApi<Id, Client> {
  readonly Client: Context.Key<Id, Client>;
}

/** Picks a command's call off a contract's client. */
type CommandSelect<Client, Target, Input, E> = (
  client: Client,
) => (
  target: Target,
  input: Input,
  options?: { readonly commandId?: string; readonly headers?: Headers.Input },
) => Effect.Effect<Receipt, E>;

/** The two reads a view binding uses, as the library's view client declares them. */
interface ViewReads<Key, S, Ev, E> {
  readonly snapshot: (
    key: Key,
    options?: { readonly headers?: Headers.Input; readonly atLeast?: Receipt },
  ) => Effect.Effect<Read.Snapshot<S>, E | View.ConsistencyTimeout>;
  readonly events: (
    key: Key,
    options?: { readonly headers?: Headers.Input; readonly after?: number },
  ) => Stream.Stream<View.Entry<NonNullable<S>, Ev, Key> | Read.CaughtUp, E>;
}

/**
 * A view's binding: a read that can wait for a receipt (read-after-write),
 * and a subscription that delivers each state with its revision and
 * reconnects with a new epoch after a failure.
 *
 * @category models
 * @since 0.0.0
 */
export interface ViewBinding<Id, Key, S, E> {
  readonly read: (
    key: Key,
    atLeast?: Receipt,
  ) => Effect.Effect<Revisioned<S>, E | View.ConsistencyTimeout, BindingServices<Id>>;
  readonly subscribe: (key: Key) => Stream.Stream<Revisioned<S>, E | View.ConsistencyTimeout, BindingServices<Id>>;
}

/**
 * Bind one view of a contract Api.
 *
 * **Details**
 *
 * `subscribe` reads a snapshot (state and cursor), then follows `events`
 * after that cursor, so no change is missed or seen twice. When the stream
 * fails it reconnects on a backoff, five times at most, with a new epoch
 * and a fresh snapshot. A consumer ignores any state whose revision is not
 * newer than one it has, which is how a reconnect's stale snapshot is
 * dropped.
 *
 * **Example** (A generated view binding)
 * ```ts
 * import { ReviewerContract } from "@proto/party-contract/ReviewerApi.contract";
 * import * as Bindings from "@proto/party-web/Bindings";
 *
 * const review = Bindings.view(ReviewerContract, (client) => client.ClaimReview);
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const view: {
  <Id, Client, Key, St, Ev, E>(
    select: (client: Client) => ViewReads<Key, St, Ev, E>,
  ): (api: ContractApi<Id, Client>) => ViewBinding<Id, Key, St, E>;
  <Id, Client, Key, St, Ev, E>(
    api: ContractApi<Id, Client>,
    select: (client: Client) => ViewReads<Key, St, Ev, E>,
  ): ViewBinding<Id, Key, St, E>;
} = dual(2, <Id, Client, Key, St, Ev, E>(
  api: ContractApi<Id, Client>,
  select: (client: Client) => ViewReads<Key, St, Ev, E>,
): ViewBinding<Id, Key, St, E> => {
  const reads = Effect.map(Effect.service(api.Client), select);
  const headers = Effect.flatMap(Effect.service(Credentials), (credentials) => credentials.headers);
  return {
    read: Effect.fn("Bindings.view.read")(function* (key: Key, atLeast?: Receipt) {
      const view = yield* reads;
      const auth = yield* headers;
      const snapshot = yield* view.snapshot(key, { headers: auth, ...(atLeast !== undefined ? { atLeast } : {}) });
      return { state: snapshot.state, revision: snapshot.cursor, epoch: 0 };
    }),
    subscribe: (key) =>
      Stream.unwrap(
        Effect.map(Ref.make(0), (epochs) =>
          Stream.unwrap(
            Effect.gen(function* () {
              const epoch = yield* Ref.getAndUpdate(epochs, (n) => n + 1);
              const view = yield* reads;
              const auth = yield* headers;
              const snapshot = yield* view.snapshot(key, { headers: auth });
              const live = view.events(key, { headers: auth, after: snapshot.cursor }).pipe(
                Stream.filter((entry): entry is View.Entry<NonNullable<St>, Ev, Key> => "envelope" in entry),
                Stream.map((entry): Revisioned<St> => ({
                  state: entry.state as St,
                  revision: entry.envelope.seq,
                  epoch,
                })),
              );
              const first: Revisioned<St> = { state: snapshot.state, revision: snapshot.cursor, epoch };
              return pipe(Stream.succeed(first), Stream.concat(live));
            }),
          ).pipe(Stream.retry(Schedule.max([Schedule.exponential("50 millis"), Schedule.recurs(5)]))),
        ),
      ),
  };
});

/**
 * Bind one query of a contract Api: ask it, optionally after a receipt.
 *
 * @category constructors
 * @since 0.0.0
 */
export const query: {
  <Id, Client, Input, Result, E>(select: QuerySelect<Client, Input, Result, E>): (api: ContractApi<Id, Client>) => QueryBinding<Id, Input, Result, E>;
  <Id, Client, Input, Result, E>(api: ContractApi<Id, Client>, select: QuerySelect<Client, Input, Result, E>): QueryBinding<Id, Input, Result, E>;
} = dual(
  2,
  <Id, Client, Input, Result, E>(api: ContractApi<Id, Client>, select: QuerySelect<Client, Input, Result, E>): QueryBinding<Id, Input, Result, E> =>
    Effect.fn("Bindings.query")(function* (input: Input, options?: { readonly atLeast?: Receipt; readonly take?: number }) {
      const client = yield* Effect.service(api.Client);
      const credentials = yield* Credentials;
      const headers = yield* credentials.headers;
      return yield* select(client)(input, { ...options, headers });
    }),
);

/** Picks a query's call off a contract's client. */
type QuerySelect<Client, Input, Result, E> = (
  client: Client,
) => (
  input: Input,
  options?: { readonly headers?: Headers.Input; readonly atLeast?: Receipt; readonly take?: number },
) => Effect.Effect<Result, E>;

/** A query's binding: ask it, optionally after a receipt or for a page size. */
type QueryBinding<Id, Input, Result, E> = (
  input: Input,
  options?: { readonly atLeast?: Receipt; readonly take?: number },
) => Effect.Effect<Result, E, Id | Credentials>;
