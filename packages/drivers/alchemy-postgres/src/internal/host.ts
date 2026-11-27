/**
 * The per-model runtime the Postgres platform's stores share: storage and jobs
 * for the upstream `Backfill` roles, the in-process `Backfill.Network` that
 * routes between them (exactly as `Domain.InMemory` wires it), the delivery
 * outbox and the background workers.
 */
import * as Backfill from "@alchemy.run/domain/Backfill";
import { A, O, P, R, Str } from "@beep/utils";
import * as Cause from "effect/Cause";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { constUndefined, flow } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Order from "effect/Order";
import * as Queue from "effect/Queue";
import * as Ref from "effect/Ref";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as SqlError from "effect/sql/SqlError";
import * as Tracer from "effect/Tracer";
import * as Tuple from "effect/Tuple";
import { AlchemyPostgresError } from "../AlchemyPostgres.errors.ts";
import { JobRoleAttribute, TargetKindAttribute, TargetNameAttribute } from "../AlchemyPostgres.instruments.ts";
import { DeliveryRow, encodeJson } from "../AlchemyPostgres.schema.ts";
import type * as DomainPlatform from "@alchemy.run/domain/Platform";
import type * as Scope from "effect/Scope";
import type * as SqlClient from "effect/sql/SqlClient";
import type { AlchemyPostgresConfig } from "../AlchemyPostgres.config.ts";
import type { AlchemyPostgresOperation } from "../AlchemyPostgres.errors.ts";
import type { AlchemyPostgresTables } from "../AlchemyPostgres.schema.ts";

const isStorageError = (error: unknown): error is SqlError.SqlError | S.SchemaError =>
  SqlError.isSqlError(error) || S.isSchemaError(error);

/** Turn a storage failure into a typed defect: the kernel's store methods have no error channel. */
export const orDieAs =
  (operation: AlchemyPostgresOperation) =>
  (table: string) =>
  <A, E, R>(
    self: Effect.Effect<A, E | SqlError.SqlError | S.SchemaError, R>
  ): Effect.Effect<A, Exclude<E, SqlError.SqlError | S.SchemaError>, R> =>
    Effect.catchIf(
      self,
      isStorageError,
      (cause) => Effect.die(AlchemyPostgresError.fromUnknown(operation, cause, table)),
      Effect.fail
    );

/** Decode the rows a statement returned. */
export const rowsOf = <Schema extends S.Codec<unknown>>(row: Schema) => S.decodeUnknownEffect(S.Array(row));

const trustUntyped = <A>(_: unknown): _ is A => true;

const KvRow = S.Struct({ key: S.String, value: S.Unknown });
const decodeKv = rowsOf(KvRow);
const JobRef = S.Struct({ address: S.String, job_id: S.String, revision: S.Int });
const decodeJobRefs = rowsOf(JobRef);
const decodeDeliveries = rowsOf(DeliveryRow);
const decodeGenerations = rowsOf(S.Struct({ generation: S.Int }));

const retryCeilingMillis = Duration.toMillis(Duration.minutes(1));
const bigintSafeRetryExponentCap = 30;
const jobRetryMillis = Duration.toMillis(Duration.seconds(1));
const claimReleaseBudget = Duration.seconds(5);
const byPosition = Order.mapInput(Order.Number, (row: DeliveryRow) => row.position);

const failureTagLimit = 64;

const tagOf = (value: unknown): O.Option<string> =>
  P.hasProperty(value, "_tag") && P.isString(value._tag) ? O.some(Str.slice(0, failureTagLimit)(value._tag)) : O.none();

/**
 * The bounded tag a failure is logged by: its `_tag`, or what kind of failure
 * it was. Never its message, payload, stack or the cause rendered as text,
 * which can carry instance ids, paths and event payloads.
 */
export const failureTagOf = (value: unknown): string => O.getOrElse(tagOf(value), () => "Untagged");

/** {@link failureTagOf} for a whole cause: interruption, or the tag of what failed first. */
export const causeTagOf = (cause: Cause.Cause<unknown>): string =>
  Cause.hasInterruptsOnly(cause)
    ? "Interrupted"
    : cause.pipe(
        Cause.squash,
        tagOf,
        O.getOrElse(() => (Cause.hasFails(cause) ? "UntaggedFailure" : "UntaggedDefect"))
      );

/** The role an address belongs to (`node`, `run`, `scanner`, `source`, `consumer`), never its key. */
export const roleOf: (address: string) => string = flow(Str.split(":"), A.headNonEmpty);

const splitAtFirstSlash = (rest: string): O.Option<readonly [string, string]> =>
  O.map(Str.indexOf("/")(rest), (at) => [Str.slice(0, at)(rest), Str.slice(at + 1)(rest)] as const);

interface Plans {
  model: ReadonlyArray<string>;
  planOf: (target: string) => Backfill.Plan | undefined;
}

interface HostDeps {
  readonly config: AlchemyPostgresConfig;
  readonly modelName: string;
  readonly now: Effect.Effect<number>;
  readonly owner: string;
  readonly scope: Scope.Scope;
  readonly sql: SqlClient.SqlClient;
  readonly tables: AlchemyPostgresTables;
  readonly wakeDeliveries: Queue.Queue<void>;
  readonly wakeJobs: Queue.Queue<void>;
}

export type HostContext = ReturnType<typeof makeContext>;

/** Build one model's shared runtime. Workers start with {@link HostContext.startWorkers}. */
export const makeContext = (deps: HostDeps) => {
  const { config, modelName, now, owner, scope, sql, tables, wakeDeliveries, wakeJobs } = deps;
  const poll = Duration.millis(config.pollMillis);
  const signalDeliveries = Queue.offer(wakeDeliveries, undefined).pipe(Effect.asVoid);
  const signalJobs = Queue.offer(wakeJobs, undefined).pipe(Effect.asVoid);
  const plans: Plans = { model: [], planOf: constUndefined };
  // decision: backfill-waits-poll-interval
  const limits: Backfill.Limits = {
    ...Backfill.defaultLimits,
    ...O.getOrElse(config.backfill, () => ({})),
    pollMillis: config.pollMillis,
  };
  const workers: Array<Effect.Effect<void>> = [];
  const delivers = MutableHashMap.empty<string, (delivery: DomainPlatform.Delivery) => Effect.Effect<void>>();
  const sourceRoles = MutableHashMap.empty<string, (id: string) => Backfill.Source>();
  const consumerRoles = MutableHashMap.empty<string, (key: string) => Backfill.Consumer>();
  const consumerRoutes = MutableHashMap.empty<string, Backfill.ScannerHost["route"]>();

  const lockName = (object: string) => `${tables.backfillKv}|${modelName}|${object}`;

  const exclusive =
    (lock: string) =>
    <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
      sql
        .withTransaction(sql`SELECT pg_advisory_xact_lock(hashtext(${lockName(lock)}))`.pipe(Effect.andThen(effect)))
        .pipe(
          Effect.catchIf(
            SqlError.isSqlError,
            (cause) => Effect.die(AlchemyPostgresError.fromUnknown("backfill", cause, tables.backfillKv)),
            Effect.fail
          )
        );

  const storage = (address: string, lock: string): Backfill.Storage => {
    const orDie = orDieAs("backfill")(tables.backfillKv);
    const put = (key: string, value: unknown) =>
      encodeJson(value).pipe(
        Effect.flatMap(
          (json) => sql`INSERT INTO ${sql(tables.backfillKv)} (model, address, key, value)
            VALUES (${modelName}, ${address}, ${key}, ${json}::jsonb)
            ON CONFLICT (model, address, key) DO UPDATE SET value = EXCLUDED.value`
        )
      );
    return {
      get: <A>(key: string) =>
        sql`SELECT key, value FROM ${sql(tables.backfillKv)}
          WHERE model = ${modelName} AND address = ${address} AND key = ${key}`.pipe(
          Effect.flatMap(decodeKv),
          Effect.map((rows) =>
            O.getOrUndefined(
              O.flatMap(A.head(rows), ({ value }) => O.liftPredicate(value, (stored) => trustUntyped<A>(stored)))
            )
          ),
          orDie
        ),
      put: (entries) =>
        Effect.forEach(R.toEntries(entries), ([key, value]) => put(key, value), { concurrency: 1, discard: true }).pipe(
          orDie
        ),
      delete: (keys) =>
        A.match(keys, {
          onEmpty: () => Effect.void,
          onNonEmpty: (some) =>
            sql`DELETE FROM ${sql(tables.backfillKv)}
              WHERE model = ${modelName} AND address = ${address} AND key IN ${sql.in(some)}`.pipe(
              Effect.asVoid,
              orDie
            ),
        }),
      list: <A>(options: { readonly prefix: string; readonly startAfter?: string; readonly limit?: number }) =>
        sql`SELECT key, value FROM ${sql(tables.backfillKv)}
          WHERE model = ${modelName} AND address = ${address}
            AND left(key, ${Str.length(options.prefix)}) = ${options.prefix}
            AND key COLLATE "C" > ${options.startAfter ?? ""}
          ORDER BY key COLLATE "C"
          LIMIT ${options.limit ?? 2_147_483_647}`.pipe(
          Effect.flatMap(decodeKv),
          Effect.map(
            flow(
              A.filter((row): row is { readonly key: string; readonly value: A } => trustUntyped<A>(row.value)),
              A.map(({ key, value }) => Tuple.make(key, value))
            )
          ),
          orDie
        ),
      exclusive: exclusive(lock),
    };
  };

  const jobs = (address: string): Backfill.Jobs => ({
    schedule: Effect.fn("AlchemyPostgres.Backfill.schedule")(function* (id: string, afterMillis: number) {
      const at = yield* now;
      const due = at + Math.max(0, afterMillis);
      yield* sql`INSERT INTO ${sql(tables.backfillJob)} AS job (model, address, job_id, due_at)
          VALUES (${modelName}, ${address}, ${id}, ${due})
          ON CONFLICT (model, address, job_id) DO UPDATE
          SET revision = job.revision + 1,
            due_at = CASE WHEN job.locked_until > ${at} THEN EXCLUDED.due_at ELSE LEAST(job.due_at, EXCLUDED.due_at) END`;
      yield* sql.afterCommit(signalJobs);
    }, orDieAs("backfill")(tables.backfillJob)),
  });

  const nodes = MutableHashMap.empty<string, Backfill.Node>();
  const node = (path: string): Backfill.Node =>
    O.getOrElse(MutableHashMap.get(nodes, path), () => {
      const address = `node:${path}`;
      const created = Backfill.makeNode(storage(address, address), jobs(address), net, limits);
      MutableHashMap.set(nodes, path, created);
      return created;
    });
  const consumerRole = (target: string, key: string) => {
    const { kind, name } = Backfill.consumerOf(target);
    return O.map(MutableHashMap.get(consumerRoles, `${kind}:${name}`), (role) => role(key));
  };
  const scanners = MutableHashMap.empty<string, Backfill.Scanner>();
  const scannerAt = (address: string, target: string): Backfill.Scanner =>
    O.getOrElse(MutableHashMap.get(scanners, address), () => {
      const { kind, name } = Backfill.consumerOf(target);
      const created = Backfill.makeScanner(
        storage(address, address),
        jobs(address),
        net,
        {
          route: (routeTarget, ref, rows) =>
            O.match(MutableHashMap.get(consumerRoutes, `${kind}:${name}`), {
              onNone: () => Effect.succeed([]),
              onSome: (route) => route(routeTarget, ref, rows),
            }),
        },
        limits
      );
      MutableHashMap.set(scanners, address, created);
      return created;
    });
  const scanner = (target: string, ref: Backfill.SourceRef) =>
    scannerAt(`scanner:${target}/${ref.source}/${ref.id}`, target);
  const runs = MutableHashMap.empty<string, Backfill.Run>();
  const run = (target: string): Backfill.Run =>
    O.getOrElse(MutableHashMap.get(runs, target), () => {
      const address = `run:${target}`;
      const created = Backfill.makeRun(storage(address, address), jobs(address), net, {
        waitMillis: 0,
        againMillis: config.pollMillis,
      });
      MutableHashMap.set(runs, target, created);
      return created;
    });
  const sourceOf = (ref: Backfill.SourceRef) =>
    O.map(MutableHashMap.get(sourceRoles, ref.source), (role) => role(ref.id));
  const viaSource = <A>(ref: Backfill.SourceRef, missing: A, use: (role: Backfill.Source) => Effect.Effect<A>) =>
    Effect.suspend(() => O.match(sourceOf(ref), { onNone: () => Effect.succeed(missing), onSome: use }));
  const viaConsumer = <A>(
    target: string,
    key: string,
    missing: A,
    use: (role: Backfill.Consumer) => Effect.Effect<A>
  ) => Effect.suspend(() => O.match(consumerRole(target, key), { onNone: () => Effect.succeed(missing), onSome: use }));
  const net: Backfill.Network = {
    node: {
      register: (path, ref) => Effect.suspend(() => node(path).register(path, ref)),
      child: (path, child) => Effect.suspend(() => node(path).child(path, child)),
      list: (path, after) =>
        Effect.suspend(() =>
          Effect.map(
            node(path).list(path, after),
            ({ children, next, rows }): Backfill.Listing =>
              P.isUndefined(next) ? { rows, children } : { rows, children, next }
          )
        ),
    },
    source: {
      cursor: (ref, target) => viaSource(ref, 0, (role) => role.cursor(target)),
      read: (ref, target, key, after, limit) =>
        viaSource(ref, { from: after, rows: [], handoff: "live" }, (role) =>
          Effect.map(
            role.read(target, key, after, limit),
            ({ from, handoff, rows }): Backfill.Read =>
              P.isUndefined(handoff) ? { from, rows } : { from, rows, handoff }
          )
        ),
      log: (ref, after, limit) => viaSource(ref, [], (role) => role.log(after, limit)),
      handoff: (ref, target, key, through) => viaSource(ref, "live", (role) => role.handoff(target, key, through)),
    },
    consumer: {
      push: (target, key, deliveries) => viaConsumer(target, key, undefined, (role) => role.push(target, deliveries)),
      ready: (target, key, waitMillis) => viaConsumer(target, key, "settled", (role) => role.ready(target, waitMillis)),
      start: (target, key, ref, waitMillis) =>
        viaConsumer(target, key, "settled", (role) => role.start(target, ref, waitMillis)),
    },
    scanner: {
      scan: (target, ref, waitMillis) => Effect.suspend(() => scanner(target, ref).scan(target, ref, waitMillis)),
      ready: (target, ref, waitMillis) => Effect.suspend(() => scanner(target, ref).ready(target, waitMillis)),
      kick: (target, ref) => Effect.suspend(() => scanner(target, ref).kick(target, ref)),
    },
    relay: { run: (name, items, relayed) => Effect.suspend(() => relay.run(name, items, relayed)) },
    run: {
      begin: (target, plan) => Effect.suspend(() => run(target).begin(target, plan)),
      phase: (target) => Effect.suspend(() => run(target).phase(target)),
      progress: (target) => Effect.suspend(() => run(target).progress(target)),
    },
  };
  const relay = Backfill.makeRelay(net);
  const register = (ref: Backfill.SourceRef) => net.node.register(Backfill.leafOf(ref), ref);

  const jobRunnerFromAddress = (address: string): O.Option<(id: string) => Effect.Effect<void>> => {
    const after = (prefix: string) => O.map(O.liftPredicate(address, Str.startsWith(prefix)), Str.slice(prefix.length));
    return O.firstSomeOf([
      O.map(after("node:"), (path) => (id: string) => node(path).run(id)),
      O.map(after("run:"), (target) => (id: string) => run(target).run(id)),
      O.flatMap(after("scanner:"), (rest) =>
        O.map(
          splitAtFirstSlash(rest),
          ([target]) =>
            (id: string) =>
              scannerAt(address, target).run(id)
        )
      ),
      O.flatMap(after("source:"), (rest) =>
        O.flatMap(splitAtFirstSlash(rest), ([source, id]) =>
          O.map(MutableHashMap.get(sourceRoles, source), (role) => () => role(id).flush)
        )
      ),
      O.flatMap(after("consumer:"), (rest) =>
        O.flatMap(splitAtFirstSlash(rest), ([target, key]) =>
          O.map(consumerRole(target, key), (role) => (id: string) => role.merge(Str.slice("bf-merge:".length)(id)))
        )
      ),
    ]);
  };

  const jobPass = Effect.gen(function* () {
    const at = yield* now;
    const claimed = yield* sql`UPDATE ${sql(tables.backfillJob)} SET locked_until = ${at + config.leaseMillis}
      WHERE (model, address, job_id) IN (
        SELECT model, address, job_id FROM ${sql(tables.backfillJob)}
        WHERE model = ${modelName} AND due_at <= ${at} AND locked_until <= ${at}
        ORDER BY due_at LIMIT ${config.deliveryBatchSize}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING address, job_id, revision`.pipe(Effect.flatMap(decodeJobRefs));
    yield* Effect.forEach(
      claimed,
      Effect.fnUntraced(function* ({ address, job_id, revision }) {
        const where = sql`model = ${modelName} AND address = ${address} AND job_id = ${job_id}`;
        const exit = yield* O.match(jobRunnerFromAddress(address), {
          onNone: () => Effect.exit(Effect.void),
          onSome: (runJob) =>
            Effect.exit(
              runJob(job_id).pipe(
                Effect.withSpan("AlchemyPostgres.Backfill.runJob", {
                  attributes: { [JobRoleAttribute]: roleOf(address) },
                })
              )
            ),
        });
        if (Exit.isSuccess(exit)) {
          yield* sql`DELETE FROM ${sql(tables.backfillJob)} WHERE ${where} AND revision = ${revision}`;
          yield* sql`UPDATE ${sql(tables.backfillJob)} SET locked_until = 0 WHERE ${where}`;
          return;
        }
        yield* Effect.logError(`alchemy-postgres ${modelName} backfill job failed`).pipe(
          Effect.annotateLogs({ model: modelName, role: roleOf(address), failure: causeTagOf(exit.cause) })
        );
        const later = yield* now;
        yield* sql`UPDATE ${sql(tables.backfillJob)} SET locked_until = 0, due_at = ${later + jobRetryMillis}
            WHERE ${where}`;
      }),
      { concurrency: 1, discard: true }
    );
    return A.isReadonlyArrayNonEmpty(claimed);
  }).pipe(orDieAs("backfill")(tables.backfillJob));

  const pollTail =
    <Row, E, Req>(read: (after: number) => Effect.Effect<ReadonlyArray<Row>, E, Req>, seqOf: (row: Row) => number) =>
    (after: number): Stream.Stream<Row, E, Req> =>
      Stream.unwrap(
        Effect.map(Ref.make(after), (cursor) =>
          Stream.fromEffectSchedule(
            Ref.get(cursor).pipe(
              Effect.flatMap(read),
              Effect.tap((fresh) =>
                O.match(A.last(fresh), { onNone: () => Effect.void, onSome: (row) => Ref.set(cursor, seqOf(row)) })
              )
            ),
            Schedule.spaced(poll)
          ).pipe(Stream.flatMap(Stream.fromIterable))
        )
      );

  const consumerKeys = (consumer: {
    readonly id: string;
    readonly target: string;
    readonly lockOf: (key: string) => string;
    readonly singleSource: boolean;
    readonly history: DomainPlatform.ViewKit["history"];
    readonly apply: (key: string, deliveries: ReadonlyArray<DomainPlatform.Delivery>) => Effect.Effect<void>;
  }) => {
    const roles = MutableHashMap.empty<string, Backfill.Consumer>();
    const role = (key: string): Backfill.Consumer =>
      O.getOrElse(MutableHashMap.get(roles, key), () => {
        const address = `consumer:${consumer.target}/${key}`;
        const created = Backfill.makeConsumer(
          storage(address, consumer.lockOf(key)),
          jobs(address),
          net,
          {
            key,
            target: () => consumer.target,
            singleSource: () => consumer.singleSource,
            sources: () => plans.planOf(consumer.target)?.sources ?? [],
            history: (ref, rows) => consumer.history(consumer.target, ref.source, ref.id, rows),
            apply: (deliveries) => consumer.apply(key, deliveries),
          },
          limits
        );
        MutableHashMap.set(roles, key, created);
        return created;
      });
    MutableHashMap.set(consumerRoles, consumer.id, role);
    MutableHashMap.set(consumerRoutes, consumer.id, (target, ref, rows) =>
      consumer.history(target, ref.source, ref.id, rows)
    );
    return role;
  };

  const resetConsumer = <E, R>(consumer: string, generation: number, clear: Effect.Effect<unknown, E, R>) =>
    sql.withTransaction(
      Effect.gen(function* () {
        const rows = yield* sql`SELECT generation FROM ${sql(tables.consumerGeneration)}
          WHERE model = ${modelName} AND consumer = ${consumer} FOR UPDATE`.pipe(Effect.flatMap(decodeGenerations));
        const stored = O.getOrElse(
          O.map(A.head(rows), (row) => row.generation),
          () => 0
        );
        if (stored >= generation && A.isReadonlyArrayNonEmpty(rows)) return;
        if (stored < generation) yield* clear;
        yield* sql`INSERT INTO ${sql(tables.consumerGeneration)} (model, consumer, generation)
          VALUES (${modelName}, ${consumer}, ${generation})
          ON CONFLICT (model, consumer) DO UPDATE SET generation = EXCLUDED.generation`;
      })
    );

  const outbox = (producer: string, deliveries: ReadonlyArray<DomainPlatform.Delivery>, at: number) =>
    Effect.forEach(
      deliveries,
      (delivery) =>
        Effect.flatMap(
          encodeJson(delivery),
          (json) => sql`INSERT INTO ${sql(tables.delivery)}
            (model, producer, source, source_seq, target_kind, target_name, target_key, delivery, status, at)
            VALUES (${modelName}, ${producer}, ${delivery.source}, ${delivery.seq}, ${delivery.target.kind},
              ${delivery.target.name}, ${delivery.key}, ${json}::jsonb, 'pending', ${at})`
        ),
      { concurrency: 1, discard: true }
    ).pipe(Effect.andThen(sql.afterCommit(signalDeliveries)));

  const claimLeasedHeads = Effect.fnUntraced(function* (at: number, hosted: A.NonEmptyReadonlyArray<string>) {
    const rows = yield* sql`UPDATE ${sql(tables.delivery)}
      SET locked_until = ${at + config.leaseMillis}, claimed_by = ${owner}
      WHERE position IN (
        SELECT head.position FROM ${sql(tables.delivery)} head
        WHERE head.model = ${modelName} AND head.status = 'pending' AND head.producer IN ${sql.in(hosted)}
          AND head.next_attempt_at <= ${at} AND head.locked_until <= ${at}
          AND NOT EXISTS (
            SELECT 1 FROM ${sql(tables.delivery)} earlier
            WHERE earlier.model = head.model AND earlier.status = 'pending'
              AND earlier.source = head.source AND earlier.target_kind = head.target_kind
              AND earlier.target_name = head.target_name AND earlier.position < head.position
          )
        ORDER BY head.position LIMIT ${config.deliveryBatchSize}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING position, producer, delivery`.pipe(Effect.flatMap(decodeDeliveries));
    return A.sort(rows, byPosition);
  });

  const acknowledge = (row: DeliveryRow) =>
    sql`UPDATE ${sql(tables.delivery)} SET status = 'delivered', attempts = attempts + 1, locked_until = 0
      WHERE position = ${row.position} AND claimed_by = ${owner}`;

  const retryLater = Effect.fnUntraced(function* (row: DeliveryRow, cause: Cause.Cause<unknown>) {
    const at = yield* now;
    yield* Effect.logError(`alchemy-postgres ${modelName} delivery failed; retrying`).pipe(
      Effect.annotateLogs({
        model: modelName,
        position: row.position,
        targetKind: row.delivery.target.kind,
        targetName: row.delivery.target.name,
        failure: causeTagOf(cause),
      })
    );
    yield* sql`UPDATE ${sql(tables.delivery)}
      SET attempts = attempts + 1, locked_until = 0,
        next_attempt_at = ${at} + LEAST(${config.pollMillis} * POWER(2, LEAST(attempts, ${bigintSafeRetryExponentCap}))::bigint, ${retryCeilingMillis})
      WHERE position = ${row.position} AND claimed_by = ${owner}`;
  });

  const release = (rows: ReadonlyArray<DeliveryRow>) =>
    A.match(rows, {
      onEmpty: () => Effect.void,
      onNonEmpty: (left) =>
        sql`UPDATE ${sql(tables.delivery)} SET locked_until = 0
          WHERE ${sql.in(
            "position",
            A.map(left, ({ position }) => position)
          )} AND claimed_by = ${owner}`.pipe(Effect.asVoid),
    });

  const deliverRow = (row: DeliveryRow) => {
    const { envelope, target } = row.delivery;
    const hostedProducerDeliver = Effect.fromOption(MutableHashMap.get(delivers, row.producer)).pipe(Effect.orDie);
    return hostedProducerDeliver.pipe(
      Effect.flatMap((deliver) => deliver(row.delivery)),
      Effect.withSpan("AlchemyPostgres.Outbox.deliver", {
        kind: "consumer",
        attributes: { [TargetKindAttribute]: target.kind, [TargetNameAttribute]: target.name },
        parent: P.isUndefined(envelope.trace) ? undefined : Tracer.externalSpan(envelope.trace),
      })
    );
  };

  const deliverAll = (rows: ReadonlyArray<DeliveryRow>): Effect.Effect<boolean, SqlError.SqlError> =>
    A.match(rows, {
      onEmpty: () => Effect.succeed(true),
      onNonEmpty: ([row, ...rest]) =>
        Effect.exit(deliverRow(row)).pipe(
          Effect.flatMap(
            Exit.match({
              onSuccess: () => acknowledge(row).pipe(Effect.andThen(deliverAll(rest))),
              onFailure: (cause) => retryLater(row, cause).pipe(Effect.andThen(release(rest)), Effect.as(false)),
            })
          )
        ),
    });

  const releaseOnInterrupt = (rows: ReadonlyArray<DeliveryRow>, exit: Exit.Exit<boolean, SqlError.SqlError>) =>
    Exit.hasInterrupts(exit)
      ? release(rows).pipe(
          Effect.interruptible,
          Effect.timeoutOption(claimReleaseBudget),
          Effect.asVoid,
          Effect.catchCause(logFailure("delivery release"))
        )
      : Effect.void;

  const deliveryPass = Effect.gen(function* () {
    const at = yield* now;
    const hosted = delivers.pipe(MutableHashMap.keys, A.fromIterable);
    return yield* Effect.acquireUseRelease(
      A.isReadonlyArrayNonEmpty(hosted) ? claimLeasedHeads(at, hosted) : Effect.succeed(A.empty<DeliveryRow>()),
      (rows) => Effect.map(deliverAll(rows), (completed) => completed && A.isReadonlyArrayNonEmpty(rows)),
      releaseOnInterrupt
    );
  }).pipe(orDieAs("deliver")(tables.delivery));

  const logFailure = (what: string) => (cause: Cause.Cause<unknown>) =>
    Effect.logError(`alchemy-postgres ${modelName} ${what} failed`).pipe(
      Effect.annotateLogs({ model: modelName, failure: causeTagOf(cause) })
    );

  const worker = (name: string, wake: Queue.Queue<void>, pass: Effect.Effect<boolean>) =>
    Effect.forever(
      Queue.take(wake).pipe(
        Effect.timeoutOption(poll),
        Effect.andThen(Effect.repeat(pass, { while: P.isTruthy })),
        Effect.catchCause(logFailure(`${name} pass`))
      )
    );

  const startWorkers = Effect.suspend(() =>
    Effect.forEach(
      [worker("delivery", wakeDeliveries, deliveryPass), worker("backfill job", wakeJobs, jobPass), ...workers],
      (work) => Effect.forkIn(work, scope),
      { concurrency: 1, discard: true }
    )
  );

  return {
    config,
    consumerKeys,
    delivers,
    exclusive,
    jobs,
    limits,
    lockKey: lockName,
    logFailure,
    modelName,
    net,
    now,
    outbox,
    plans,
    poll,
    pollTail,
    register,
    resetConsumer,
    run,
    scope,
    sourceRoles,
    sql,
    startWorkers,
    storage,
    tables,
    workers,
  };
};
