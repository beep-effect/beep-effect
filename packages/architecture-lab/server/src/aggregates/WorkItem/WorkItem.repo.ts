/**
 * WorkItem repository adapter.
 *
 * @packageDocumentation
 * @category repositories
 * @since 0.0.0
 */

import { WorkItemConfig } from "@beep/architecture-lab-config/layer";
import {
  fromWorkItemRow,
  toWorkItemInsert,
  WORK_ITEM_TABLE_NAME,
  workItemTable,
} from "@beep/architecture-lab-tables/aggregates/WorkItem";
import * as WorkItemUseCaseServer from "@beep/architecture-lab-use-cases/server";
import { PostgresDrizzle } from "@beep/postgres";
import { A } from "@beep/utils";
import { eq } from "drizzle-orm";
import { Effect, HashMap, pipe, Ref } from "effect";
import * as O from "effect/Option";
import type * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem";
import type { PostgresDrizzleDatabase } from "@beep/postgres";

type WorkItemStore = HashMap.HashMap<DomainWorkItem.WorkItemId, DomainWorkItem.WorkItem>;

const getStoredWorkItem = Effect.fn("ArchitectureLab.WorkItemRepository.getStored")(function* (
  store: Ref.Ref<WorkItemStore>,
  id: DomainWorkItem.WorkItemId
) {
  const workItems = yield* Ref.get(store);
  const found = HashMap.get(workItems, id);
  if (O.isNone(found)) {
    return yield* WorkItemUseCaseServer.WorkItem.WorkItemRepositoryNotFound.make({ workItemId: id });
  }
  return found.value;
});

/**
 * Build the in-memory WorkItem repository used by the fast architecture lab proof.
 *
 * **Example** (Create and list WorkItems)
 *
 * ```ts
 * import { ArchitectureLabConfigTest } from "@beep/architecture-lab-config/test"
 * import * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem"
 * import { makeInMemoryWorkItemRepository } from "@beep/architecture-lab-server/aggregates/WorkItem"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const repository = yield* makeInMemoryWorkItemRepository()
 *   const id = S.decodeUnknownSync(DomainWorkItem.WorkItemId)("work-item-1")
 *   const workItem = DomainWorkItem.create(
 *     DomainWorkItem.CreateWorkItemInput.make({
 *       id,
 *       title: "Persist WorkItem in memory",
 *       priority: O.none()
 *     })
 *   )
 *   yield* repository.create(workItem)
 *   return yield* repository.list
 * }).pipe(Effect.provide(ArchitectureLabConfigTest))
 *
 * Effect.runPromise(program).then((items) => console.log(items.length)) // 1
 * ```
 *
 * @effects Reads `WorkItemConfig`, allocates an in-memory `Ref`, and mutates
 * that process-local store for create, save, get, and list repository calls.
 * @category repositories
 * @since 0.0.0
 */
export const makeInMemoryWorkItemRepository = Effect.fn("ArchitectureLab.WorkItemRepository.makeInMemory")(
  function* () {
    const config = yield* WorkItemConfig;
    const store = yield* Ref.make(HashMap.empty<DomainWorkItem.WorkItemId, DomainWorkItem.WorkItem>());

    return WorkItemUseCaseServer.WorkItem.WorkItemRepository.of({
      create: Effect.fn("ArchitectureLab.WorkItemRepository.create")(function* (workItem) {
        const workItems = yield* Ref.get(store);
        if (O.isSome(HashMap.get(workItems, workItem.id))) {
          return yield* WorkItemUseCaseServer.WorkItem.WorkItemRepositoryConflict.make({
            workItemId: workItem.id,
            reason: `${config.serverConfig.repositoryName} already contains ${WORK_ITEM_TABLE_NAME}`,
          });
        }
        yield* Ref.update(store, (current) => HashMap.set(current, workItem.id, workItem));
        return workItem;
      }),
      get: Effect.fn("ArchitectureLab.WorkItemRepository.get")(function* (id) {
        return yield* getStoredWorkItem(store, id);
      }),
      list: Effect.gen(function* () {
        const workItems = yield* Ref.get(store);
        return A.fromIterable(HashMap.values(workItems));
      }).pipe(Effect.withSpan("ArchitectureLab.WorkItemRepository.list")),
      save: Effect.fn("ArchitectureLab.WorkItemRepository.save")(function* (workItem) {
        yield* getStoredWorkItem(store, workItem.id);
        yield* Ref.update(store, (workItems) => HashMap.set(workItems, workItem.id, workItem));
        return workItem;
      }),
    });
  }
);

const repositoryUnavailable =
  (operation: string) =>
  <A, E, R>(
    effect: Effect.Effect<A, E, R>
  ): Effect.Effect<A, WorkItemUseCaseServer.WorkItem.WorkItemRepositoryUnavailable, R> =>
    effect.pipe(
      Effect.tapError((cause) =>
        Effect.logDebug("ArchitectureLab WorkItem repository adapter dropped driver failure").pipe(
          Effect.annotateLogs({ operation, table: WORK_ITEM_TABLE_NAME, cause })
        )
      ),
      Effect.mapError(() =>
        WorkItemUseCaseServer.WorkItem.WorkItemRepositoryUnavailable.make({
          reason: `${operation} failed against ${WORK_ITEM_TABLE_NAME}`,
        })
      )
    );

const findDrizzleWorkItem = Effect.fn("ArchitectureLab.WorkItemRepository.findDrizzle")(function* (
  db: PostgresDrizzleDatabase,
  id: DomainWorkItem.WorkItemId
) {
  const rows = yield* db
    .select()
    .from(workItemTable)
    .where(eq(workItemTable.id, id))
    .limit(1)
    .pipe(repositoryUnavailable("select WorkItem"));

  return pipe(rows, A.head, O.map(fromWorkItemRow));
});

const getDrizzleWorkItem = Effect.fn("ArchitectureLab.WorkItemRepository.getDrizzle")(function* (
  db: PostgresDrizzleDatabase,
  id: DomainWorkItem.WorkItemId
) {
  const found = yield* findDrizzleWorkItem(db, id);
  if (O.isNone(found)) {
    return yield* WorkItemUseCaseServer.WorkItem.WorkItemRepositoryNotFound.make({ workItemId: id });
  }
  return found.value;
});

/**
 * Build a Drizzle-backed WorkItem repository used by live persistence tests.
 *
 * **Example** (List with unavailable fallback)
 *
 * ```ts
 * import { makeDrizzleWorkItemRepository } from "@beep/architecture-lab-server/aggregates/WorkItem"
 * import { Effect } from "effect"
 *
 * const program = makeDrizzleWorkItemRepository().pipe(
 *   Effect.flatMap((repository) => repository.list),
 *   Effect.catchTag("WorkItemRepositoryUnavailable", (error) => Effect.succeed([error.reason]))
 * )
 * const describe = <A, E, R>(_effect: Effect.Effect<A, E, R>) => "Postgres-backed WorkItem repository wired"
 *
 * console.log(describe(program)) // "Postgres-backed WorkItem repository wired"
 * ```
 *
 * @effects Requires `PostgresDrizzle`; executes `select`, `insert`, and
 * `update` statements against the WorkItem table and redacts driver failures to
 * `WorkItemRepositoryUnavailable`.
 * @category repositories
 * @since 0.0.0
 */
export const makeDrizzleWorkItemRepository = Effect.fn("ArchitectureLab.WorkItemRepository.makeDrizzle")(function* () {
  const db = yield* PostgresDrizzle;

  return WorkItemUseCaseServer.WorkItem.WorkItemRepository.of({
    create: Effect.fn("ArchitectureLab.WorkItemRepository.drizzleCreate")(function* (workItem) {
      const existing = yield* findDrizzleWorkItem(db, workItem.id);
      if (O.isSome(existing)) {
        return yield* WorkItemUseCaseServer.WorkItem.WorkItemRepositoryConflict.make({
          workItemId: workItem.id,
          reason: `${WORK_ITEM_TABLE_NAME} already contains ${workItem.id}`,
        });
      }

      const rows = yield* db
        .insert(workItemTable)
        .values(toWorkItemInsert(workItem))
        .returning()
        .pipe(repositoryUnavailable("insert WorkItem"));

      return pipe(
        rows,
        A.head,
        O.map(fromWorkItemRow),
        O.getOrElse(() => workItem)
      );
    }),
    get: Effect.fn("ArchitectureLab.WorkItemRepository.drizzleGet")(function* (id) {
      return yield* getDrizzleWorkItem(db, id);
    }),
    list: Effect.gen(function* () {
      const rows = yield* db.select().from(workItemTable).pipe(repositoryUnavailable("list WorkItem"));
      return A.map(rows, fromWorkItemRow);
    }).pipe(Effect.withSpan("ArchitectureLab.WorkItemRepository.drizzleList")),
    save: Effect.fn("ArchitectureLab.WorkItemRepository.drizzleSave")(function* (workItem) {
      yield* getDrizzleWorkItem(db, workItem.id);
      const rows = yield* db
        .update(workItemTable)
        .set(toWorkItemInsert(workItem))
        .where(eq(workItemTable.id, workItem.id))
        .returning()
        .pipe(repositoryUnavailable("update WorkItem"));

      return pipe(
        rows,
        A.head,
        O.map(fromWorkItemRow),
        O.getOrElse(() => workItem)
      );
    }),
  });
});

/**
 * Build the default WorkItem repository for normal slice tests.
 *
 * **Example** (List empty default repository)
 *
 * ```ts
 * import { ArchitectureLabConfigTest } from "@beep/architecture-lab-config/test"
 * import { makeWorkItemRepository } from "@beep/architecture-lab-server/aggregates/WorkItem"
 * import { Effect } from "effect"
 *
 * const program = makeWorkItemRepository().pipe(
 *   Effect.flatMap((repository) => repository.list),
 *   Effect.map((items) => items.length),
 *   Effect.provide(ArchitectureLabConfigTest)
 * )
 *
 * Effect.runPromise(program).then((count) => console.log(count)) // 0
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export const makeWorkItemRepository = makeInMemoryWorkItemRepository;
