import * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem";
import { makeDrizzleWorkItemRepository } from "@beep/architecture-lab-server/aggregates/WorkItem";
import { toWorkItemInsert } from "@beep/architecture-lab-tables/aggregates/WorkItem";
import { PostgresDrizzle } from "@beep/postgres";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { DateTime, Effect, Option as O } from "effect";
import * as S from "effect/Schema";
import type { PostgresDrizzleDatabase } from "@beep/postgres";

type ScriptedResult = Effect.Effect<ReadonlyArray<unknown>, string>;

/**
 * Drizzle double whose query builders are chainable proxies over scripted
 * effects: each `select`/`insert`/`update` chain resolves to the next scripted
 * result, and an exhausted script resolves to an empty row set.
 */
const scriptedDb = (results: ReadonlyArray<ScriptedResult>): PostgresDrizzleDatabase => {
  let cursor = 0;
  const query = (): PostgresDrizzleDatabase => {
    const effect = Effect.suspend(() => results[cursor++] ?? Effect.succeed([]));
    return new Proxy(effect, {
      get(target, prop, receiver) {
        if (prop === "pipe" || typeof prop === "symbol" || prop in target) {
          const value = Reflect.get(target, prop, receiver);
          return typeof value === "function" ? value.bind(target) : value;
        }
        return () => receiver;
      },
    }) as unknown as PostgresDrizzleDatabase;
  };

  return {
    $client: {} as PostgresDrizzleDatabase["$client"],
    select: query,
    insert: query,
    update: query,
  } as unknown as PostgresDrizzleDatabase;
};

const withScriptedDb =
  (...results: ReadonlyArray<ScriptedResult>) =>
  <A, E>(effect: Effect.Effect<A, E, PostgresDrizzle>): Effect.Effect<A, E> =>
    Effect.provideService(effect, PostgresDrizzle, scriptedDb(results));

const decodeWorkItemId = S.decodeUnknownEffect(DomainWorkItem.WorkItemId);

const fixedTimestamp = DateTime.toDateUtc(DateTime.makeUnsafe(0));

const workItemRows = (workItem: DomainWorkItem.WorkItem): ReadonlyArray<unknown> => [
  {
    ...toWorkItemInsert(workItem),
    createdAt: fixedTimestamp,
    updatedAt: fixedTimestamp,
  },
];

describe("WorkItem Drizzle repository", () => {
  it.effect(
    "translates WorkItem rows, empty reads, conflicts, and driver failures",
    Effect.fnUntraced(function* () {
      const id = yield* decodeWorkItemId("work-item-1");
      const workItem = DomainWorkItem.create(
        DomainWorkItem.CreateWorkItemInput.make({
          id,
          title: "Persist through Drizzle",
          priority: O.none(),
        })
      );
      const rows = Effect.succeed(workItemRows(workItem));
      const noRows = Effect.succeed([]);
      const repository = makeDrizzleWorkItemRepository();

      const created = yield* Effect.flatMap(repository, (repo) => repo.create(workItem)).pipe(
        withScriptedDb(noRows, rows)
      );
      const createdWithoutReturning = yield* Effect.flatMap(repository, (repo) => repo.create(workItem)).pipe(
        withScriptedDb(noRows, noRows)
      );
      const loaded = yield* Effect.flatMap(repository, (repo) => repo.get(id)).pipe(withScriptedDb(rows));
      const listed = yield* Effect.flatMap(repository, (repo) => repo.list).pipe(withScriptedDb(rows));
      const saved = yield* Effect.flatMap(repository, (repo) => repo.save(workItem)).pipe(withScriptedDb(rows, rows));
      const conflict = yield* Effect.flatMap(repository, (repo) => repo.create(workItem)).pipe(
        withScriptedDb(rows),
        Effect.flip
      );
      const missing = yield* Effect.flatMap(repository, (repo) => repo.get(id)).pipe(
        withScriptedDb(noRows),
        Effect.flip
      );
      const unavailable = yield* Effect.flatMap(repository, (repo) => repo.list).pipe(
        withScriptedDb(Effect.fail("driver down")),
        Effect.flip
      );

      expect(created.id).toBe(id);
      expect(createdWithoutReturning).toBe(workItem);
      expect(loaded.id).toBe(id);
      expect(listed).toHaveLength(1);
      expect(saved.id).toBe(id);
      expect(conflict._tag).toBe("WorkItemRepositoryConflict");
      expect(missing._tag).toBe("WorkItemRepositoryNotFound");
      expect(unavailable._tag).toBe("WorkItemRepositoryUnavailable");
    })
  );
});
