/**
 * The per-model runtime the Postgres platform's stores share: storage and jobs
 * for the upstream `Backfill` roles, the in-process `Backfill.Network` that
 * routes between them (exactly as `Domain.InMemory` wires it), the delivery
 * outbox and the background workers.
 */
import * as Backfill from "@alchemy.run/domain/Backfill";
import { A, O, P, R, Str } from "@beep/utils";
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
import * as Tuple from "effect/Tuple";
import { AlchemyPostgresError } from "../AlchemyPostgres.errors.ts";
import { DeliveryRow, encodeJson } from "../AlchemyPostgres.schema.ts";
import type * as DomainPlatform from "@alchemy.run/domain/Platform";
import type * as Cause from "effect/Cause";
import type * as Scope from "effect/Scope";
import type * as SqlClient from "effect/sql/SqlClient";
import type { AlchemyPostgresConfig } from "../AlchemyPostgres.config.ts";
import type { AlchemyPostgresOperation } from "../AlchemyPostgres.errors.ts";
import type { AlchemyPostgresTables } from "../AlchemyPostgres.schema.ts";

/** SQL and row-decoding failures: infrastructure, never domain outcomes. */
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

/**
 * `Backfill.Storage` hands back whatever it put, typed by its caller: the
 * contract is untyped by design (a Durable Object's storage is too), so values
 * read back are trusted as the type the role asks for.
 */
const isStored = <A>(_: unknown): _ is A => true;

const KvRow = S.Struct({ key: S.String, value: S.Unknown });
const decodeKv = rowsOf(KvRow);
const JobRef = S.Struct({ address: S.String, job_id: S.String, revision: S.Int });
const decodeJobRefs = rowsOf(JobRef);
const decodeDeliveries = rowsOf(DeliveryRow);
const decodeGenerations = rowsOf(S.Struct({ generation: S.Int }));

/** How long a claimed outbox row or job stays leased to the host running it. */
const leaseMillis = Duration.toMillis(Duration.seconds(30));
/** The longest a failed delivery waits before its next attempt. */
const retryCeilingMillis = Duration.toMillis(Duration.minutes(1));
/** How long a failed backfill job waits before it runs again. */
const jobRetryMillis = Duration.toMillis(Duration.seconds(1));
const byPosition = Order.mapInput(Order.Number, (row: DeliveryRow) => row.position);

/** Split `rest` at its first `/`: `["view:Name", "a-1/b"]` for `view:Name/a-1/b`. */
const splitFirst = (rest: string): O.Option<readonly [string, string]> =>
  O.map(Str.indexOf("/")(rest), (at) => [Str.slice(0, at)(rest), Str.slice(at + 1)(rest)] as const);

/** The consumers in the model and their plans, as of the latest `start`. */
interface Plans {
  model: ReadonlyArray<string>;
  planOf: (target: string) => Backfill.Plan | undefined;
}

interface HostDeps {
  readonly config: AlchemyPostgresConfig;
  readonly modelName: string;
  readonly now: Effect.Effect<number>;
  /** This host's id, written on the outbox rows it leases. */
  readonly owner: string;
  readonly scope: Scope.Scope;
  readonly sql: SqlClient.SqlClient;
  readonly tables: AlchemyPostgresTables;
  /** Wakes the delivery worker after a commit; polling covers other processes. */
  readonly wakeDeliveries: Queue.Queue<void>;
  /** Wakes the backfill job worker after a job is scheduled. */
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
  // A waiting key asks again after `pollMillis`, rather than at once (InMemory's
  // work queue runs it as soon as other work has run; a polled table would spin).
  const limits: Backfill.Limits = {
    ...Backfill.defaultLimits,
    ...O.getOrElse(config.backfill, () => ({})),
    pollMillis: config.pollMillis,
  };
  /** Background passes started once every store is built. */
  const workers: Array<Effect.Effect<void>> = [];
  /** Each producer's `deliver`, by producer (`Account`, `view:Statement`): an outbox row names it. */
  const delivers = MutableHashMap.empty<string, (delivery: DomainPlatform.Delivery) => Effect.Effect<void>>();
  /** The source part of each hosted aggregate and view, by its name. */
  const sourceRoles = MutableHashMap.empty<string, (id: string) => Backfill.Source>();
  /** The consumer part of each hosted view and projection, by `kind:name`. */
  const consumerRoles = MutableHashMap.empty<string, (key: string) => Backfill.Consumer>();
  /** Each consumer's routing of a source's stored rows: what its scanners use. */
  const consumerRoutes = MutableHashMap.empty<string, Backfill.ScannerHost["route"]>();

  /** The advisory-lock name of one object in this model. */
  const lockName = (object: string) => `${tables.backfillKv}|${modelName}|${object}`;

  /** Run `effect` in a transaction holding `lock`: every other holder on any process waits. */
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

  /** `Backfill.Storage` for one object: a key-ordered KV table section, locked by `lock`. */
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
              O.flatMap(A.head(rows), ({ value }) => O.liftPredicate(value, (stored) => isStored<A>(stored)))
            )
          ),
          orDie
        ),
      put: (entries) =>
        Effect.forEach(R.toEntries(entries), ([key, value]) => put(key, value), { discard: true }).pipe(orDie),
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
              A.filter((row): row is { readonly key: string; readonly value: A } => isStored<A>(row.value)),
              A.map(({ key, value }) => Tuple.make(key, value))
            )
          ),
          orDie
        ),
      exclusive: exclusive(lock),
    };
  };

  /** Durable `Backfill.Jobs` for one object: a job table row per id, earliest due wins. */
  const jobs = (address: string): Backfill.Jobs => ({
    schedule: Effect.fn("AlchemyPostgres.backfill.schedule")(function* (id: string, afterMillis: number) {
      const at = yield* now;
      const due = at + Math.max(0, afterMillis);
      // A job running now runs again at the new due time; a pending one keeps the earlier one.
      yield* sql`INSERT INTO ${sql(tables.backfillJob)} AS job (model, address, job_id, due_at)
          VALUES (${modelName}, ${address}, ${id}, ${due})
          ON CONFLICT (model, address, job_id) DO UPDATE
          SET revision = job.revision + 1,
            due_at = CASE WHEN job.locked_until > ${at} THEN EXCLUDED.due_at ELSE LEAST(job.due_at, EXCLUDED.due_at) END`;
      yield* sql.afterCommit(signalJobs);
    }, orDieAs("backfill")(tables.backfillJob)),
  });

  // ---------------------------------------------------------------- roles, as InMemory wires them
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
  /** The scanner at `address`, for one consumer generation. */
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
  /** The root of a consumer generation's run. */
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
  /** Call the source role of `ref`, or answer `missing` when its source is not in the model. */
  const viaSource = <A>(ref: Backfill.SourceRef, missing: A, use: (role: Backfill.Source) => Effect.Effect<A>) =>
    Effect.suspend(() => O.match(sourceOf(ref), { onNone: () => Effect.succeed(missing), onSome: use }));
  /** Call a consumer key's role, or answer `missing` when its consumer is not in the model. */
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
    // A source or consumer no longer in the model has nothing to give, and takes nothing.
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
  /** List an instance in the directory; its first commit waits for it. */
  const register = (ref: Backfill.SourceRef) => net.node.register(Backfill.leafOf(ref), ref);

  /** The job runner at `address`, rebuilt from the address after a restart. */
  const jobRunner = (address: string): O.Option<(id: string) => Effect.Effect<void>> => {
    const after = (prefix: string) => O.map(O.liftPredicate(address, Str.startsWith(prefix)), Str.slice(prefix.length));
    return O.firstSomeOf([
      O.map(after("node:"), (path) => (id: string) => node(path).run(id)),
      O.map(after("run:"), (target) => (id: string) => run(target).run(id)),
      O.flatMap(after("scanner:"), (rest) =>
        O.map(
          splitFirst(rest),
          ([target]) =>
            (id: string) =>
              scannerAt(address, target).run(id)
        )
      ),
      O.flatMap(after("source:"), (rest) =>
        O.flatMap(splitFirst(rest), ([source, id]) =>
          O.map(MutableHashMap.get(sourceRoles, source), (role) => () => role(id).flush)
        )
      ),
      O.flatMap(after("consumer:"), (rest) =>
        O.flatMap(splitFirst(rest), ([target, key]) =>
          O.map(consumerRole(target, key), (role) => (id: string) => role.merge(Str.slice("bf-merge:".length)(id)))
        )
      ),
    ]);
  };

  /** Claim due jobs, run each, and drop a job only when no newer request came in while it ran. */
  const jobPass = Effect.gen(function* () {
    const at = yield* now;
    const claimed = yield* sql`UPDATE ${sql(tables.backfillJob)} SET locked_until = ${at + leaseMillis}
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
        const exit = yield* O.match(jobRunner(address), {
          // A role no longer in the model: nothing to run.
          onNone: () => Effect.exit(Effect.void),
          onSome: (runJob) => Effect.exit(runJob(job_id)),
        });
        if (Exit.isSuccess(exit)) {
          yield* sql`DELETE FROM ${sql(tables.backfillJob)} WHERE ${where} AND revision = ${revision}`;
          yield* sql`UPDATE ${sql(tables.backfillJob)} SET locked_until = 0 WHERE ${where}`;
          return;
        }
        yield* Effect.logError(`alchemy-postgres ${modelName} backfill job ${address} ${job_id} failed`, exit.cause);
        const later = yield* now;
        yield* sql`UPDATE ${sql(tables.backfillJob)} SET locked_until = 0, due_at = ${later + jobRetryMillis}
            WHERE ${where}`;
      }),
      { discard: true }
    );
    return A.isReadonlyArrayNonEmpty(claimed);
  }).pipe(orDieAs("backfill")(tables.backfillJob));

  /** Rows after a cursor, then every page committed later: a live tail polled at `pollMillis`. */
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

  /**
   * The consumer part of catch-up for each key of a view or projection, as
   * InMemory builds it: it buffers and merges history while a backfill runs,
   * and applies through `apply`. Registers the consumer and its routing.
   */
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

  /**
   * Start a consumer's stored keys over when its generation is newer than the
   * one that built them (a rebuilt view or projection), then record it.
   */
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

  // ---------------------------------------------------------------- outbox
  /** Stage deliveries in the outbox inside the caller's transaction; the worker wakes after it commits. */
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
      { discard: true }
    ).pipe(Effect.andThen(sql.afterCommit(signalDeliveries)));

  /**
   * Claim the next deliverable outbox rows for this host: the oldest pending row
   * of each `(source, target)` whose retry is due and that no host holds a lease
   * on. `FOR UPDATE SKIP LOCKED` plus the lease keep two hosts on one database
   * from claiming one row; heads-only keeps every `(source, target)` in order.
   * Rows from producers this host does not run wait for a host that does.
   */
  const claim = Effect.fnUntraced(function* (at: number, hosted: A.NonEmptyReadonlyArray<string>) {
    const rows = yield* sql`UPDATE ${sql(tables.delivery)}
      SET locked_until = ${at + leaseMillis}, claimed_by = ${owner}
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

  /** A failed run stays pending: count the attempt, back off, and release the lease. */
  const retryLater = Effect.fnUntraced(function* (row: DeliveryRow, cause: Cause.Cause<unknown>) {
    const at = yield* now;
    yield* Effect.logError(
      `alchemy-postgres ${modelName} delivery ${row.position} to ${row.delivery.target.kind} ${row.delivery.target.name} failed; retrying`,
      cause
    );
    yield* sql`UPDATE ${sql(tables.delivery)}
      SET attempts = attempts + 1, locked_until = 0,
        next_attempt_at = ${at} + LEAST(${config.pollMillis} * POWER(2, attempts)::bigint, ${retryCeilingMillis})
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

  /** Route one claimed row through its producer's kit; `claim` only returns rows of hosted producers. */
  const deliverRow = (row: DeliveryRow) =>
    Effect.fromOption(MutableHashMap.get(delivers, row.producer)).pipe(
      Effect.orDie,
      Effect.flatMap((deliver) => deliver(row.delivery))
    );

  /** Deliver claimed rows in position order; the first failure stops the pass and frees the rest. */
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

  /** One pass: claim, deliver; another pass follows while every claimed row was delivered. */
  const deliveryPass = Effect.gen(function* () {
    const at = yield* now;
    const hosted = A.fromIterable(MutableHashMap.keys(delivers));
    const rows = A.isReadonlyArrayNonEmpty(hosted) ? yield* claim(at, hosted) : [];
    const completed = yield* deliverAll(rows);
    return completed && A.isReadonlyArrayNonEmpty(rows);
  }).pipe(orDieAs("deliver")(tables.delivery));

  /** Log a background failure; the next pass, poll or wake runs the work again. */
  const logFailure = (what: string) => (cause: Cause.Cause<unknown>) =>
    Effect.logError(`alchemy-postgres ${modelName} ${what} failed`, cause);

  /** Run `pass` while it reports more work, on every wake and every poll interval. */
  const worker = (name: string, wake: Queue.Queue<void>, pass: Effect.Effect<boolean>) =>
    Effect.forever(
      Queue.take(wake).pipe(
        Effect.timeoutOption(poll),
        Effect.andThen(Effect.repeat(pass, { while: P.isTruthy })),
        Effect.catchCause(logFailure(`${name} pass`))
      )
    );

  /** Start the outbox, backfill and per-store workers in the model's scope. */
  const startWorkers = Effect.suspend(() =>
    Effect.forEach(
      [worker("delivery", wakeDeliveries, deliveryPass), worker("backfill job", wakeJobs, jobPass), ...workers],
      (work) => Effect.forkIn(work, scope),
      { discard: true }
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
