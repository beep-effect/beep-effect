/**
 * Worker repository adapter.
 *
 * @packageDocumentation
 * @category repositories
 * @since 0.0.0
 */

import {
  fromWorkerRow,
  toWorkerInsert,
  WORKER_TABLE_NAME,
  workerTable,
} from "@beep/architecture-lab-tables/entities/Worker";
import * as WorkerUseCaseServer from "@beep/architecture-lab-use-cases/server";
import { PostgresDrizzle } from "@beep/postgres";
import { A } from "@beep/utils";
import { eq } from "drizzle-orm";
import { Effect, HashMap, pipe, Ref } from "effect";
import * as O from "effect/Option";
import type * as DomainWorker from "@beep/architecture-lab-domain/entities/Worker";
import type { PostgresDrizzleDatabase } from "@beep/postgres";
import type * as ArchitectureLabIdentity from "@beep/shared-domain/identity/ArchitectureLab";

type WorkerStore = HashMap.HashMap<ArchitectureLabIdentity.WorkerId, DomainWorker.Worker>;

const getStoredWorker = Effect.fn("ArchitectureLab.WorkerRepository.getStored")(function* (
  store: Ref.Ref<WorkerStore>,
  id: ArchitectureLabIdentity.WorkerId
) {
  const workers = yield* Ref.get(store);
  const found = HashMap.get(workers, id);
  if (O.isNone(found)) {
    return yield* WorkerUseCaseServer.Worker.WorkerRepositoryNotFound.make({ workerId: id });
  }
  return found.value;
});

/**
 * Build the in-memory Worker repository used by the fast architecture lab proof.
 *
 * **Example** (Create worker then list)
 *
 * ```ts
 * import * as DomainWorker from "@beep/architecture-lab-domain/entities/Worker"
 * import { makeInMemoryWorkerRepository } from "@beep/architecture-lab-server/entities/Worker"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const repository = yield* makeInMemoryWorkerRepository()
 *   const worker = DomainWorker.create(
 *     DomainWorker.CreateWorkerInput.make({
 *       id: S.decodeUnknownSync(ArchitectureLabIdentity.WorkerId)(1),
 *       organizationId: S.decodeUnknownSync(DomainWorker.WorkerOrganizationId)(10),
 *       displayName: "Avery Reviewer"
 *     })
 *   )
 *   yield* repository.create(worker)
 *   return yield* repository.list
 * })
 *
 * Effect.runPromise(program).then((workers) => console.log(workers.length)) // 1
 * ```
 *
 * @effects Allocates an in-memory `Ref` and mutates that process-local store
 * for create, get, and list repository calls.
 * @category repositories
 * @since 0.0.0
 */
export const makeInMemoryWorkerRepository = Effect.fn("ArchitectureLab.WorkerRepository.makeInMemory")(function* () {
  const store = yield* Ref.make(HashMap.empty<ArchitectureLabIdentity.WorkerId, DomainWorker.Worker>());

  return WorkerUseCaseServer.Worker.WorkerRepository.of({
    create: Effect.fn("ArchitectureLab.WorkerRepository.create")(function* (worker) {
      const workers = yield* Ref.get(store);
      if (O.isSome(HashMap.get(workers, worker.id))) {
        return yield* WorkerUseCaseServer.Worker.WorkerRepositoryConflict.make({
          workerId: worker.id,
          reason: `${WORKER_TABLE_NAME} already contains ${worker.id}`,
        });
      }
      yield* Ref.update(store, (current) => HashMap.set(current, worker.id, worker));
      return worker;
    }),
    get: Effect.fn("ArchitectureLab.WorkerRepository.get")(function* (id) {
      return yield* getStoredWorker(store, id);
    }),
    list: Effect.gen(function* () {
      const workers = yield* Ref.get(store);
      return A.fromIterable(HashMap.values(workers));
    }).pipe(Effect.withSpan("ArchitectureLab.WorkerRepository.list")),
  });
});

const repositoryUnavailable =
  (operation: string) =>
  <A, E, R>(
    effect: Effect.Effect<A, E, R>
  ): Effect.Effect<A, WorkerUseCaseServer.Worker.WorkerRepositoryUnavailable, R> =>
    effect.pipe(
      Effect.tapError((cause) =>
        Effect.logDebug("ArchitectureLab Worker repository adapter dropped driver failure").pipe(
          Effect.annotateLogs({ operation, table: WORKER_TABLE_NAME, cause })
        )
      ),
      Effect.mapError(() =>
        WorkerUseCaseServer.Worker.WorkerRepositoryUnavailable.make({
          reason: `${operation} failed against ${WORKER_TABLE_NAME}`,
        })
      )
    );

const findDrizzleWorker = Effect.fn("ArchitectureLab.WorkerRepository.findDrizzle")(function* (
  db: PostgresDrizzleDatabase,
  id: ArchitectureLabIdentity.WorkerId
) {
  const rows = yield* db
    .select()
    .from(workerTable)
    .where(eq(workerTable.id, id))
    .limit(1)
    .pipe(repositoryUnavailable("select Worker"));

  return pipe(rows, A.head, O.map(fromWorkerRow));
});

const getDrizzleWorker = Effect.fn("ArchitectureLab.WorkerRepository.getDrizzle")(function* (
  db: PostgresDrizzleDatabase,
  id: ArchitectureLabIdentity.WorkerId
) {
  const found = yield* findDrizzleWorker(db, id);
  if (O.isNone(found)) {
    return yield* WorkerUseCaseServer.Worker.WorkerRepositoryNotFound.make({ workerId: id });
  }
  return found.value;
});

/**
 * Build a Drizzle-backed Worker repository used by live persistence tests.
 *
 * **Example** (List with unavailable catch)
 *
 * ```ts
 * import { makeDrizzleWorkerRepository } from "@beep/architecture-lab-server/entities/Worker"
 * import { Effect } from "effect"
 *
 * const program = makeDrizzleWorkerRepository().pipe(
 *   Effect.flatMap((repository) => repository.list),
 *   Effect.catchTag("WorkerRepositoryUnavailable", (error) => Effect.succeed([error.reason]))
 * )
 * const describe = <A, E, R>(_effect: Effect.Effect<A, E, R>) => "Postgres-backed Worker repository wired"
 *
 * console.log(describe(program)) // "Postgres-backed Worker repository wired"
 * ```
 *
 * @effects Requires `PostgresDrizzle`; executes `select` and `insert`
 * statements against the Worker table and redacts driver failures to
 * `WorkerRepositoryUnavailable`.
 * @category repositories
 * @since 0.0.0
 */
export const makeDrizzleWorkerRepository = Effect.fn("ArchitectureLab.WorkerRepository.makeDrizzle")(function* () {
  const db = yield* PostgresDrizzle;

  return WorkerUseCaseServer.Worker.WorkerRepository.of({
    create: Effect.fn("ArchitectureLab.WorkerRepository.drizzleCreate")(function* (worker) {
      const existing = yield* findDrizzleWorker(db, worker.id);
      if (O.isSome(existing)) {
        return yield* WorkerUseCaseServer.Worker.WorkerRepositoryConflict.make({
          workerId: worker.id,
          reason: `${WORKER_TABLE_NAME} already contains ${worker.id}`,
        });
      }

      const rows = yield* db
        .insert(workerTable)
        .values(toWorkerInsert(worker))
        .returning()
        .pipe(repositoryUnavailable("insert Worker"));

      return pipe(
        rows,
        A.head,
        O.map(fromWorkerRow),
        O.getOrElse(() => worker)
      );
    }),
    get: Effect.fn("ArchitectureLab.WorkerRepository.drizzleGet")(function* (id) {
      return yield* getDrizzleWorker(db, id);
    }),
    list: Effect.gen(function* () {
      const rows = yield* db.select().from(workerTable).pipe(repositoryUnavailable("list Worker"));
      return A.map(rows, fromWorkerRow);
    }).pipe(Effect.withSpan("ArchitectureLab.WorkerRepository.drizzleList")),
  });
});

/**
 * Build the default Worker repository for normal slice tests.
 *
 * **Example** (Default repository list count)
 *
 * ```ts
 * import { makeWorkerRepository } from "@beep/architecture-lab-server/entities/Worker"
 * import { Effect } from "effect"
 *
 * const program = makeWorkerRepository().pipe(
 *   Effect.flatMap((repository) => repository.list),
 *   Effect.map((workers) => workers.length)
 * )
 *
 * Effect.runPromise(program).then((count) => console.log(count)) // 0
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export const makeWorkerRepository = makeInMemoryWorkerRepository;
